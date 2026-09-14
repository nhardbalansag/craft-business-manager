import type {
  EffectiveMaterialRequirement,
  EffectiveRequirementContribution,
  EffectiveRequirementSource,
} from './effectiveRecipeRequirements';
import type { Material } from './materials';
import type { PackageConversionSource } from './materialCosting';

export interface MaterialCostBasis {
  materialId: string;
  baseUnit: Material['baseUnit'];
  costPerBaseUnit: number;
  packageCost: number;
  packageBaseQuantity: number;
  packageConversionSource: PackageConversionSource;
  costingCalibrationId: string | null;
}

export type CostedRequirementContribution = EffectiveRequirementContribution & {
  materialCostPerProduct: number;
};

export interface RecipeMaterialCostLine {
  materialId: string;
  baseUnit: Material['baseUnit'];
  baseQuantityPerProduct: number;
  source: EffectiveRequirementSource;
  costPerBaseUnit: number;
  materialCostPerProduct: number;
  packageCost: number;
  packageBaseQuantity: number;
  packageConversionSource: PackageConversionSource;
  costingCalibrationId: string | null;
  contributions: CostedRequirementContribution[];
}

export interface RecipeMaterialCostPreview {
  productId: string;
  lines: RecipeMaterialCostLine[];
  totalMaterialCostPerProduct: number;
}

export type RecipeMaterialCostPreviewErrorCode =
  | 'MATERIAL_ID_MISMATCH'
  | 'MATERIAL_BASE_UNIT_MISMATCH'
  | 'INVALID_REQUIREMENT_QUANTITY'
  | 'INVALID_COST_PER_BASE_UNIT'
  | 'INVALID_PACKAGE_BASE_QUANTITY'
  | 'CONTRIBUTION_TOTAL_MISMATCH'
  | 'INVALID_MATERIAL_COST';

export class RecipeMaterialCostPreviewError extends Error {
  readonly code: RecipeMaterialCostPreviewErrorCode;
  readonly materialId: string;

  constructor(code: RecipeMaterialCostPreviewErrorCode, message: string, materialId: string) {
    super(message);
    this.name = 'RecipeMaterialCostPreviewError';
    this.code = code;
    this.materialId = materialId;
  }
}

function comparable(value: string): string {
  return value.trim().toLowerCase();
}

function nearlyEqual(a: number, b: number): boolean {
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= Number.EPSILON * 32 * scale;
}

/**
 * Prices one already-normalized effective material requirement.
 *
 * Requirement quantities are canonical Phase 1 base quantities. The cost basis is
 * derived independently from the material purchase package. This function validates
 * that the two views refer to the same material/base unit before multiplying them.
 */
export function priceEffectiveMaterialRequirement(
  requirement: EffectiveMaterialRequirement,
  basis: MaterialCostBasis,
): RecipeMaterialCostLine {
  if (comparable(requirement.materialId) !== comparable(basis.materialId)) {
    throw new RecipeMaterialCostPreviewError(
      'MATERIAL_ID_MISMATCH',
      `Requirement material ${requirement.materialId} does not match cost basis ${basis.materialId}.`,
      requirement.materialId,
    );
  }

  if (requirement.baseUnit !== basis.baseUnit) {
    throw new RecipeMaterialCostPreviewError(
      'MATERIAL_BASE_UNIT_MISMATCH',
      `Material ${requirement.materialId} requirement uses ${requirement.baseUnit}, but costing uses ${basis.baseUnit}.`,
      requirement.materialId,
    );
  }

  if (!Number.isFinite(requirement.baseQuantityPerProduct) || requirement.baseQuantityPerProduct <= 0) {
    throw new RecipeMaterialCostPreviewError(
      'INVALID_REQUIREMENT_QUANTITY',
      `Material ${requirement.materialId} requirement must be a finite value greater than zero.`,
      requirement.materialId,
    );
  }

  if (!Number.isFinite(basis.costPerBaseUnit) || basis.costPerBaseUnit < 0) {
    throw new RecipeMaterialCostPreviewError(
      'INVALID_COST_PER_BASE_UNIT',
      `Material ${requirement.materialId} cost per base unit must be finite and non-negative.`,
      requirement.materialId,
    );
  }

  if (!Number.isFinite(basis.packageBaseQuantity) || basis.packageBaseQuantity <= 0) {
    throw new RecipeMaterialCostPreviewError(
      'INVALID_PACKAGE_BASE_QUANTITY',
      `Material ${requirement.materialId} package base quantity must be finite and greater than zero.`,
      requirement.materialId,
    );
  }

  const contributionTotal = requirement.contributions.reduce(
    (sum, contribution) => sum + contribution.baseQuantityPerProduct,
    0,
  );
  if (!Number.isFinite(contributionTotal) || !nearlyEqual(contributionTotal, requirement.baseQuantityPerProduct)) {
    throw new RecipeMaterialCostPreviewError(
      'CONTRIBUTION_TOTAL_MISMATCH',
      `Material ${requirement.materialId} contribution quantities do not equal its effective requirement.`,
      requirement.materialId,
    );
  }

  const materialCostPerProduct = requirement.baseQuantityPerProduct * basis.costPerBaseUnit;
  if (!Number.isFinite(materialCostPerProduct) || materialCostPerProduct < 0) {
    throw new RecipeMaterialCostPreviewError(
      'INVALID_MATERIAL_COST',
      `Material ${requirement.materialId} produced an invalid per-product material cost.`,
      requirement.materialId,
    );
  }

  const contributions: CostedRequirementContribution[] = requirement.contributions.map((contribution) => {
    const cost = contribution.baseQuantityPerProduct * basis.costPerBaseUnit;
    if (!Number.isFinite(cost) || cost < 0) {
      throw new RecipeMaterialCostPreviewError(
        'INVALID_MATERIAL_COST',
        `Material ${requirement.materialId} contribution ${contribution.sourceId} produced an invalid cost.`,
        requirement.materialId,
      );
    }
    return { ...contribution, materialCostPerProduct: cost };
  });

  return {
    materialId: requirement.materialId,
    baseUnit: requirement.baseUnit,
    baseQuantityPerProduct: requirement.baseQuantityPerProduct,
    source: requirement.source,
    costPerBaseUnit: basis.costPerBaseUnit,
    materialCostPerProduct,
    packageCost: basis.packageCost,
    packageBaseQuantity: basis.packageBaseQuantity,
    packageConversionSource: basis.packageConversionSource,
    costingCalibrationId: basis.costingCalibrationId,
    contributions,
  };
}

export function buildRecipeMaterialCostPreview(
  productId: string,
  lines: readonly RecipeMaterialCostLine[],
): RecipeMaterialCostPreview {
  const sorted = [...lines].sort((a, b) =>
    a.materialId.localeCompare(b.materialId, undefined, { sensitivity: 'base' }),
  );
  const totalMaterialCostPerProduct = sorted.reduce((sum, line) => sum + line.materialCostPerProduct, 0);

  if (!Number.isFinite(totalMaterialCostPerProduct) || totalMaterialCostPerProduct < 0) {
    throw new RecipeMaterialCostPreviewError(
      'INVALID_MATERIAL_COST',
      `Product ${productId} produced an invalid total material cost.`,
      sorted[0]?.materialId ?? '',
    );
  }

  return {
    productId,
    lines: sorted,
    totalMaterialCostPerProduct,
  };
}
