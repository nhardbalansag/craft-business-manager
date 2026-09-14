import type { FixedRecipeItemRequirement, FixedRecipeItemRole } from './fixedRecipeItems';
import type { Material } from './materials';
import type { YieldSampleLearning } from './yieldLearning';

export type EffectiveRequirementSource = 'yield' | 'fixed' | 'combined';

export type EffectiveRequirementContribution =
  | {
      source: 'yield';
      sourceId: string;
      baseQuantityPerProduct: number;
      conversionSource: string;
      calibrationId: string | null;
    }
  | {
      source: 'fixed';
      sourceId: string;
      role: FixedRecipeItemRole;
      baseQuantityPerProduct: number;
      conversionSource: string;
      calibrationId: string | null;
    };

export interface EffectiveMaterialRequirement {
  materialId: string;
  baseUnit: Material['baseUnit'];
  baseQuantityPerProduct: number;
  source: EffectiveRequirementSource;
  contributions: EffectiveRequirementContribution[];
}

export interface EffectiveRecipeRequirements {
  productId: string;
  effectiveYieldSampleId: string | null;
  requirements: EffectiveMaterialRequirement[];
}

export type EffectiveRecipeRequirementErrorCode =
  | 'PRODUCT_MISMATCH'
  | 'MATERIAL_BASE_UNIT_CONFLICT'
  | 'INVALID_REQUIREMENT_QUANTITY';

export class EffectiveRecipeRequirementError extends Error {
  readonly code: EffectiveRecipeRequirementErrorCode;
  readonly productId: string;
  readonly materialId?: string;

  constructor(
    code: EffectiveRecipeRequirementErrorCode,
    message: string,
    context: { productId: string; materialId?: string },
  ) {
    super(message);
    this.name = 'EffectiveRecipeRequirementError';
    this.code = code;
    this.productId = context.productId;
    this.materialId = context.materialId;
  }
}

function comparable(value: string): string {
  return value.trim().toLowerCase();
}

function assertFinitePositive(productId: string, materialId: string, quantity: number): void {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new EffectiveRecipeRequirementError(
      'INVALID_REQUIREMENT_QUANTITY',
      `Requirement for material ${materialId} must be a finite value greater than zero.`,
      { productId, materialId },
    );
  }
}

/**
 * Combines yield-derived and fixed per-product requirements by material identity.
 *
 * Inputs must already be normalized to each material's canonical base unit. The
 * derived total is combined, while contribution records preserve where every part
 * of the requirement came from.
 */
export function synthesizeEffectiveRecipeRequirements(
  productId: string,
  yieldLearning: YieldSampleLearning | null,
  fixedRequirements: readonly FixedRecipeItemRequirement[],
): EffectiveRecipeRequirements {
  const productKey = comparable(productId);
  const byMaterial = new Map<string, EffectiveMaterialRequirement>();

  if (yieldLearning && comparable(yieldLearning.productId) !== productKey) {
    throw new EffectiveRecipeRequirementError(
      'PRODUCT_MISMATCH',
      `Yield sample ${yieldLearning.sampleId} belongs to product ${yieldLearning.productId}, not ${productId}.`,
      { productId },
    );
  }

  for (const requirement of yieldLearning?.materialRequirements ?? []) {
    assertFinitePositive(productId, requirement.materialId, requirement.baseQuantityPerGoodPiece);
    const key = comparable(requirement.materialId);
    byMaterial.set(key, {
      materialId: requirement.materialId,
      baseUnit: requirement.baseUnit,
      baseQuantityPerProduct: requirement.baseQuantityPerGoodPiece,
      source: 'yield',
      contributions: [
        {
          source: 'yield',
          sourceId: yieldLearning!.sampleId,
          baseQuantityPerProduct: requirement.baseQuantityPerGoodPiece,
          conversionSource: requirement.conversionSource,
          calibrationId: requirement.calibrationId,
        },
      ],
    });
  }

  for (const requirement of fixedRequirements) {
    if (comparable(requirement.productId) !== productKey) {
      throw new EffectiveRecipeRequirementError(
        'PRODUCT_MISMATCH',
        `Fixed recipe item ${requirement.itemId} belongs to product ${requirement.productId}, not ${productId}.`,
        { productId, materialId: requirement.materialId },
      );
    }

    assertFinitePositive(productId, requirement.materialId, requirement.baseQuantityPerProduct);
    const key = comparable(requirement.materialId);
    const existing = byMaterial.get(key);

    const contribution: EffectiveRequirementContribution = {
      source: 'fixed',
      sourceId: requirement.itemId,
      role: requirement.role,
      baseQuantityPerProduct: requirement.baseQuantityPerProduct,
      conversionSource: requirement.conversionSource,
      calibrationId: requirement.calibrationId,
    };

    if (!existing) {
      byMaterial.set(key, {
        materialId: requirement.materialId,
        baseUnit: requirement.baseUnit,
        baseQuantityPerProduct: requirement.baseQuantityPerProduct,
        source: 'fixed',
        contributions: [contribution],
      });
      continue;
    }

    if (existing.baseUnit !== requirement.baseUnit) {
      throw new EffectiveRecipeRequirementError(
        'MATERIAL_BASE_UNIT_CONFLICT',
        `Material ${requirement.materialId} resolves to conflicting base units ${existing.baseUnit} and ${requirement.baseUnit}.`,
        { productId, materialId: requirement.materialId },
      );
    }

    existing.baseQuantityPerProduct += requirement.baseQuantityPerProduct;
    existing.source = 'combined';
    existing.contributions.push(contribution);
  }

  return {
    productId,
    effectiveYieldSampleId: yieldLearning?.sampleId ?? null,
    requirements: [...byMaterial.values()].sort((a, b) =>
      a.materialId.localeCompare(b.materialId, undefined, { sensitivity: 'base' }),
    ),
  };
}
