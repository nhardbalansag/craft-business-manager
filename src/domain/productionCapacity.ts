import type { Material } from './materials';

export interface MaterialCapacityInput {
  materialId: string;
  baseUnit: Material['baseUnit'];
  normalizedOnHandBaseQuantity: number;
  plannedBaseQuantityPerProduct: number;
}

export interface MaterialCapacityResult extends MaterialCapacityInput {
  capacityPieces: number;
  isLimiting: boolean;
}

export interface InventoryLimitedCapacityResult {
  productId: string;
  produciblePieces: number;
  limitingMaterialIds: string[];
  materials: MaterialCapacityResult[];
}

export type ProductionCapacityErrorCode =
  | 'NO_REQUIRED_MATERIALS'
  | 'DUPLICATE_MATERIAL'
  | 'INVALID_ON_HAND_QUANTITY'
  | 'INVALID_PLANNED_REQUIREMENT';

export class ProductionCapacityError extends Error {
  readonly code: ProductionCapacityErrorCode;
  readonly productId: string;
  readonly materialId?: string;
  readonly input?: unknown;

  constructor(
    code: ProductionCapacityErrorCode,
    message: string,
    context: { productId: string; materialId?: string; input?: unknown },
  ) {
    super(message);
    this.name = 'ProductionCapacityError';
    this.code = code;
    this.productId = context.productId;
    this.materialId = context.materialId;
    this.input = context.input;
  }
}

function comparable(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Calculates direct-material production capacity from already-normalized Phase 1
 * inventory and already waste-adjusted Phase 2.4B per-product requirements.
 *
 * Formula per material:
 *   floor(normalized on-hand / planned base quantity per product)
 *
 * Overall capacity is the minimum material capacity. Every material tied at the
 * minimum is reported as limiting. Component/vessel capacity remains Phase 3.
 */
export function deriveInventoryLimitedCapacity(
  productId: string,
  inputs: readonly MaterialCapacityInput[],
): InventoryLimitedCapacityResult {
  const normalizedProductId = productId.trim();

  if (inputs.length === 0) {
    throw new ProductionCapacityError(
      'NO_REQUIRED_MATERIALS',
      `Product ${normalizedProductId} has no material requirements to evaluate for capacity.`,
      { productId: normalizedProductId },
    );
  }

  const seen = new Set<string>();
  const capacities = inputs.map((input) => {
    const materialId = input.materialId.trim();
    const key = comparable(materialId);

    if (seen.has(key)) {
      throw new ProductionCapacityError(
        'DUPLICATE_MATERIAL',
        `Material ${materialId} appears more than once in the production-capacity input.`,
        { productId: normalizedProductId, materialId },
      );
    }
    seen.add(key);

    if (!Number.isFinite(input.normalizedOnHandBaseQuantity) || input.normalizedOnHandBaseQuantity < 0) {
      throw new ProductionCapacityError(
        'INVALID_ON_HAND_QUANTITY',
        `Normalized on-hand quantity for material ${materialId} must be finite and non-negative.`,
        {
          productId: normalizedProductId,
          materialId,
          input: input.normalizedOnHandBaseQuantity,
        },
      );
    }

    if (!Number.isFinite(input.plannedBaseQuantityPerProduct) || input.plannedBaseQuantityPerProduct <= 0) {
      throw new ProductionCapacityError(
        'INVALID_PLANNED_REQUIREMENT',
        `Planned per-product requirement for material ${materialId} must be finite and greater than zero.`,
        {
          productId: normalizedProductId,
          materialId,
          input: input.plannedBaseQuantityPerProduct,
        },
      );
    }

    return {
      materialId,
      baseUnit: input.baseUnit,
      normalizedOnHandBaseQuantity: input.normalizedOnHandBaseQuantity,
      plannedBaseQuantityPerProduct: input.plannedBaseQuantityPerProduct,
      capacityPieces: Math.max(
        0,
        Math.floor(input.normalizedOnHandBaseQuantity / input.plannedBaseQuantityPerProduct),
      ),
      isLimiting: false,
    } satisfies MaterialCapacityResult;
  });

  const produciblePieces = Math.min(...capacities.map((entry) => entry.capacityPieces));
  const limitingMaterialIds = capacities
    .filter((entry) => entry.capacityPieces === produciblePieces)
    .map((entry) => entry.materialId)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  const limiting = new Set(limitingMaterialIds.map(comparable));
  const materials = capacities
    .map((entry) => ({ ...entry, isLimiting: limiting.has(comparable(entry.materialId)) }))
    .sort((a, b) => a.materialId.localeCompare(b.materialId, undefined, { sensitivity: 'base' }));

  return {
    productId: normalizedProductId,
    produciblePieces,
    limitingMaterialIds,
    materials,
  };
}
