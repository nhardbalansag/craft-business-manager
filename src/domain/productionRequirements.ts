import type {
  EffectiveMaterialRequirement,
  EffectiveRequirementContribution,
  EffectiveRequirementSource,
} from './effectiveRecipeRequirements';
import type { Material } from './materials';
import type { ProductSafetyWastePolicy } from './safetyWastePolicy';

export interface WasteAdjustedRequirementContribution {
  source: EffectiveRequirementContribution['source'];
  sourceId: string;
  role?: Extract<EffectiveRequirementContribution, { source: 'fixed' }>['role'];
  conversionSource: string;
  calibrationId: string | null;
  effectiveBaseQuantityPerProduct: number;
  wasteReserveBaseQuantityPerProduct: number;
  plannedBaseQuantityPerProduct: number;
  plannedBatchBaseQuantity: number;
}

export interface WasteAdjustedMaterialRequirement {
  materialId: string;
  baseUnit: Material['baseUnit'];
  source: EffectiveRequirementSource;
  effectiveBaseQuantityPerProduct: number;
  safetyWasteRate: number;
  safetyWasteMultiplier: number;
  wasteReserveBaseQuantityPerProduct: number;
  plannedBaseQuantityPerProduct: number;
  plannedBatchBaseQuantity: number;
  contributions: WasteAdjustedRequirementContribution[];
}

export interface WasteAdjustedProductionRequirements {
  productId: string;
  plannedQuantity: number;
  safetyWasteRate: number;
  safetyWastePercentage: number;
  safetyWasteMultiplier: number;
  observedDefectRateIncluded: false;
  requirements: WasteAdjustedMaterialRequirement[];
}

export type ProductionRequirementErrorCode =
  | 'PRODUCT_MISMATCH'
  | 'NON_FINITE_PLANNED_QUANTITY'
  | 'NEGATIVE_PLANNED_QUANTITY'
  | 'NON_INTEGER_PLANNED_QUANTITY'
  | 'INVALID_EFFECTIVE_REQUIREMENT'
  | 'INVALID_CONTRIBUTION'
  | 'CONTRIBUTION_RECONCILIATION_FAILED'
  | 'NON_FINITE_DERIVED_QUANTITY';

export class ProductionRequirementError extends Error {
  readonly code: ProductionRequirementErrorCode;
  readonly productId: string;
  readonly materialId?: string;
  readonly input?: unknown;

  constructor(
    code: ProductionRequirementErrorCode,
    message: string,
    context: { productId: string; materialId?: string; input?: unknown },
  ) {
    super(message);
    this.name = 'ProductionRequirementError';
    this.code = code;
    this.productId = context.productId;
    this.materialId = context.materialId;
    this.input = context.input;
  }
}

function comparable(value: string): string {
  return value.trim().toLowerCase();
}

function assertPlannedQuantity(productId: string, quantity: number): void {
  if (!Number.isFinite(quantity)) {
    throw new ProductionRequirementError(
      'NON_FINITE_PLANNED_QUANTITY',
      'Planned production quantity must be finite.',
      { productId, input: quantity },
    );
  }
  if (quantity < 0) {
    throw new ProductionRequirementError(
      'NEGATIVE_PLANNED_QUANTITY',
      'Planned production quantity cannot be negative.',
      { productId, input: quantity },
    );
  }
  if (!Number.isInteger(quantity)) {
    throw new ProductionRequirementError(
      'NON_INTEGER_PLANNED_QUANTITY',
      'Planned production quantity must be a whole number of finished products.',
      { productId, input: quantity },
    );
  }
}

function assertFinitePositive(
  productId: string,
  materialId: string,
  quantity: number,
  code: 'INVALID_EFFECTIVE_REQUIREMENT' | 'INVALID_CONTRIBUTION',
): void {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new ProductionRequirementError(
      code,
      `Material ${materialId} requirement quantity must be finite and greater than zero.`,
      { productId, materialId, input: quantity },
    );
  }
}

function assertFiniteDerived(productId: string, materialId: string, ...values: number[]): void {
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new ProductionRequirementError(
      'NON_FINITE_DERIVED_QUANTITY',
      `Waste-adjusted quantities for material ${materialId} must remain finite and non-negative.`,
      { productId, materialId, input: values },
    );
  }
}

function nearlyEqual(a: number, b: number): boolean {
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= Number.EPSILON * 32 * scale;
}

/**
 * Applies one product's validated safety-waste planning reserve to canonical effective
 * requirements and scales the result to a requested batch quantity.
 *
 * Observed defect loss is deliberately not applied here. Yield learning already
 * includes the material consumed while making rejected pieces; safety waste is an
 * independent future-production reserve.
 */
export function deriveWasteAdjustedProductionRequirements(
  productId: string,
  requirements: readonly EffectiveMaterialRequirement[],
  policy: ProductSafetyWastePolicy,
  plannedQuantity: number,
): WasteAdjustedProductionRequirements {
  const normalizedProductId = productId.trim();
  if (comparable(policy.productId) !== comparable(normalizedProductId)) {
    throw new ProductionRequirementError(
      'PRODUCT_MISMATCH',
      `Safety-waste policy belongs to product ${policy.productId}, not ${normalizedProductId}.`,
      { productId: normalizedProductId },
    );
  }

  assertPlannedQuantity(normalizedProductId, plannedQuantity);

  const adjustedRequirements = requirements.map((requirement) => {
    assertFinitePositive(
      normalizedProductId,
      requirement.materialId,
      requirement.baseQuantityPerProduct,
      'INVALID_EFFECTIVE_REQUIREMENT',
    );

    const contributionTotal = requirement.contributions.reduce((total, contribution) => {
      assertFinitePositive(
        normalizedProductId,
        requirement.materialId,
        contribution.baseQuantityPerProduct,
        'INVALID_CONTRIBUTION',
      );
      return total + contribution.baseQuantityPerProduct;
    }, 0);

    if (!nearlyEqual(contributionTotal, requirement.baseQuantityPerProduct)) {
      throw new ProductionRequirementError(
        'CONTRIBUTION_RECONCILIATION_FAILED',
        `Material ${requirement.materialId} contributions do not reconcile to its effective requirement.`,
        {
          productId: normalizedProductId,
          materialId: requirement.materialId,
          input: { contributionTotal, requirement: requirement.baseQuantityPerProduct },
        },
      );
    }

    const plannedBaseQuantityPerProduct = requirement.baseQuantityPerProduct * policy.multiplier;
    const wasteReserveBaseQuantityPerProduct =
      plannedBaseQuantityPerProduct - requirement.baseQuantityPerProduct;
    const plannedBatchBaseQuantity = plannedBaseQuantityPerProduct * plannedQuantity;

    assertFiniteDerived(
      normalizedProductId,
      requirement.materialId,
      plannedBaseQuantityPerProduct,
      wasteReserveBaseQuantityPerProduct,
      plannedBatchBaseQuantity,
    );

    const contributions: WasteAdjustedRequirementContribution[] = requirement.contributions.map(
      (contribution) => {
        const adjusted = contribution.baseQuantityPerProduct * policy.multiplier;
        const reserve = adjusted - contribution.baseQuantityPerProduct;
        const batch = adjusted * plannedQuantity;
        assertFiniteDerived(normalizedProductId, requirement.materialId, adjusted, reserve, batch);

        return {
          source: contribution.source,
          sourceId: contribution.sourceId,
          ...('role' in contribution ? { role: contribution.role } : {}),
          conversionSource: contribution.conversionSource,
          calibrationId: contribution.calibrationId,
          effectiveBaseQuantityPerProduct: contribution.baseQuantityPerProduct,
          wasteReserveBaseQuantityPerProduct: reserve,
          plannedBaseQuantityPerProduct: adjusted,
          plannedBatchBaseQuantity: batch,
        };
      },
    );

    return {
      materialId: requirement.materialId,
      baseUnit: requirement.baseUnit,
      source: requirement.source,
      effectiveBaseQuantityPerProduct: requirement.baseQuantityPerProduct,
      safetyWasteRate: policy.rate,
      safetyWasteMultiplier: policy.multiplier,
      wasteReserveBaseQuantityPerProduct,
      plannedBaseQuantityPerProduct,
      plannedBatchBaseQuantity,
      contributions,
    };
  });

  return {
    productId: normalizedProductId,
    plannedQuantity,
    safetyWasteRate: policy.rate,
    safetyWastePercentage: policy.percentage,
    safetyWasteMultiplier: policy.multiplier,
    observedDefectRateIncluded: false,
    requirements: adjustedRequirements,
  };
}
