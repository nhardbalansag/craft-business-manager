import type { MaterialCalibrationEvidence } from './materialCalibration';
import type { Material } from './materials';
import {
  normalizeMaterialQuantity,
  type MaterialQuantityConversionSource,
} from './materialQuantity';
import type { InputUnit } from './units';
import { isSupportedUnit } from './units';

export const FIXED_RECIPE_ITEM_ROLES = [
  'consumable',
  'additive',
  'finish',
  'packaging',
  'other',
] as const;

export type FixedRecipeItemRole = (typeof FIXED_RECIPE_ITEM_ROLES)[number];

/**
 * Authoritative fixed per-product material input.
 *
 * Source quantity/unit are preserved exactly as entered. Canonical base quantity is
 * derived through Phase 1 conversion/calibration rules and is not persisted here.
 */
export interface FixedRecipeItem {
  id: string;
  productId: string;
  materialId: string;
  quantityPerProduct: number;
  unit: InputUnit;
  role: FixedRecipeItemRole;
  notes?: string;
}

export interface FixedRecipeItemRequirement {
  itemId: string;
  productId: string;
  materialId: string;
  role: FixedRecipeItemRole;
  sourceQuantity: number;
  sourceUnit: InputUnit;
  baseUnit: Material['baseUnit'];
  baseQuantityPerProduct: number;
  conversionSource: MaterialQuantityConversionSource;
  calibrationId: string | null;
}

const ROLE_SET: ReadonlySet<string> = new Set(FIXED_RECIPE_ITEM_ROLES);

export type FixedRecipeItemErrorCode =
  | 'INVALID_ID'
  | 'INVALID_PRODUCT_ID'
  | 'INVALID_MATERIAL_ID'
  | 'NON_FINITE_QUANTITY'
  | 'NON_POSITIVE_QUANTITY'
  | 'INVALID_UNIT'
  | 'INVALID_ROLE'
  | 'MATERIAL_MISMATCH'
  | 'PHASE3_COMPONENT_MATERIAL';

export class FixedRecipeItemError extends Error {
  readonly code: FixedRecipeItemErrorCode;
  readonly itemId?: string;
  readonly productId?: string;
  readonly materialId?: string;

  constructor(
    code: FixedRecipeItemErrorCode,
    message: string,
    context: { itemId?: string; productId?: string; materialId?: string } = {},
  ) {
    super(message);
    this.name = 'FixedRecipeItemError';
    this.code = code;
    this.itemId = context.itemId;
    this.productId = context.productId;
    this.materialId = context.materialId;
  }
}

export function isFixedRecipeItemRole(value: unknown): value is FixedRecipeItemRole {
  return typeof value === 'string' && ROLE_SET.has(value);
}

export function cloneFixedRecipeItem(item: FixedRecipeItem): FixedRecipeItem {
  return { ...item };
}

export function validateFixedRecipeItemContract(item: FixedRecipeItem): void {
  if (!item.id.trim()) {
    throw new FixedRecipeItemError('INVALID_ID', 'Recipe item ID is required.', {
      itemId: item.id,
    });
  }

  if (!item.productId.trim()) {
    throw new FixedRecipeItemError('INVALID_PRODUCT_ID', 'Recipe item product ID is required.', {
      itemId: item.id,
      productId: item.productId,
    });
  }

  if (!item.materialId.trim()) {
    throw new FixedRecipeItemError('INVALID_MATERIAL_ID', 'Recipe item material ID is required.', {
      itemId: item.id,
      materialId: item.materialId,
    });
  }

  if (!Number.isFinite(item.quantityPerProduct)) {
    throw new FixedRecipeItemError(
      'NON_FINITE_QUANTITY',
      'Recipe quantity per product must be finite.',
      { itemId: item.id, productId: item.productId, materialId: item.materialId },
    );
  }

  if (item.quantityPerProduct <= 0) {
    throw new FixedRecipeItemError(
      'NON_POSITIVE_QUANTITY',
      'Recipe quantity per product must be greater than zero.',
      { itemId: item.id, productId: item.productId, materialId: item.materialId },
    );
  }

  if (!isSupportedUnit(item.unit)) {
    throw new FixedRecipeItemError('INVALID_UNIT', `Unsupported recipe unit: ${String(item.unit)}.`, {
      itemId: item.id,
      productId: item.productId,
      materialId: item.materialId,
    });
  }

  if (!isFixedRecipeItemRole(item.role)) {
    throw new FixedRecipeItemError('INVALID_ROLE', `Unsupported recipe role: ${String(item.role)}.`, {
      itemId: item.id,
      productId: item.productId,
      materialId: item.materialId,
    });
  }
}

/**
 * Resolves one fixed recipe line to the material's canonical base unit.
 *
 * Purchased vessels/containers are intentionally excluded: they require Phase 3
 * component semantics rather than a flat Phase 2 material recipe line.
 */
export function deriveFixedRecipeItemRequirement(
  item: FixedRecipeItem,
  material: Material,
  calibrations: readonly MaterialCalibrationEvidence[] = [],
): FixedRecipeItemRequirement {
  validateFixedRecipeItemContract(item);

  if (item.materialId.trim().toLowerCase() !== material.id.trim().toLowerCase()) {
    throw new FixedRecipeItemError(
      'MATERIAL_MISMATCH',
      `Recipe item ${item.id} references ${item.materialId}, not material ${material.id}.`,
      { itemId: item.id, productId: item.productId, materialId: item.materialId },
    );
  }

  if (material.group === 'container') {
    throw new FixedRecipeItemError(
      'PHASE3_COMPONENT_MATERIAL',
      `Material ${material.name} is a container/vessel and must use Phase 3 component semantics.`,
      { itemId: item.id, productId: item.productId, materialId: material.id },
    );
  }

  const normalized = normalizeMaterialQuantity(
    material,
    item.quantityPerProduct,
    item.unit,
    calibrations,
  );

  return {
    itemId: item.id,
    productId: item.productId,
    materialId: material.id,
    role: item.role,
    sourceQuantity: item.quantityPerProduct,
    sourceUnit: item.unit,
    baseUnit: material.baseUnit,
    baseQuantityPerProduct: normalized.normalizedBaseQuantity,
    conversionSource: normalized.conversionSource,
    calibrationId: normalized.calibrationId,
  };
}
