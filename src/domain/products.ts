import { SafetyWastePolicyError, validateSafetyWasteRate } from './safetyWastePolicy';

export const PRODUCT_CATEGORIES = ['paintable-art', 'candle-pot', 'candle'] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
export type ProductProductionStyle = 'molded' | 'poured';
export type ProductMixBasisGuidance = 'volume' | 'weight';
export type ProductYieldGuidance = 'recommended' | 'supported';

export interface ProductCategoryRule {
  category: ProductCategory;
  label: string;
  productionStyle: ProductProductionStyle;
  typicalMixBasis: ProductMixBasisGuidance;
  yieldLearning: ProductYieldGuidance;
  /** Product/component composition is intentionally deferred to Phase 3. */
  componentCompositionPhase: 3;
}

export const PRODUCT_CATEGORY_RULES: Readonly<Record<ProductCategory, ProductCategoryRule>> = {
  'paintable-art': {
    category: 'paintable-art',
    label: 'Paintable art',
    productionStyle: 'molded',
    typicalMixBasis: 'volume',
    yieldLearning: 'recommended',
    componentCompositionPhase: 3,
  },
  'candle-pot': {
    category: 'candle-pot',
    label: 'Candle pot',
    productionStyle: 'molded',
    typicalMixBasis: 'volume',
    yieldLearning: 'recommended',
    componentCompositionPhase: 3,
  },
  candle: {
    category: 'candle',
    label: 'Candle',
    productionStyle: 'poured',
    typicalMixBasis: 'weight',
    yieldLearning: 'supported',
    componentCompositionPhase: 3,
  },
};

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  /** Optional reference only; mix-preset contract/validation is implemented in Phase 2.1B/2.1C. */
  mixPresetId?: string;
  /** Planning reserve entered as a decimal rate, e.g. 0.05 = 5%. Must satisfy 0 <= rate < 1. */
  safetyWasteRate: number;
  notes?: string;
  isActive: boolean;
}

const PRODUCT_CATEGORY_SET: ReadonlySet<string> = new Set(PRODUCT_CATEGORIES);

export type ProductContractErrorCode =
  | 'INVALID_ID'
  | 'INVALID_NAME'
  | 'INVALID_CATEGORY'
  | 'INVALID_MIX_PRESET_ID'
  | 'INVALID_SAFETY_WASTE_RATE'
  | 'INVALID_ACTIVE_STATE';

export class ProductContractError extends Error {
  readonly code: ProductContractErrorCode;
  readonly input?: unknown;

  constructor(code: ProductContractErrorCode, message: string, input?: unknown) {
    super(message);
    this.name = 'ProductContractError';
    this.code = code;
    this.input = input;
  }
}

export function isProductCategory(value: unknown): value is ProductCategory {
  return typeof value === 'string' && PRODUCT_CATEGORY_SET.has(value);
}

export function parseProductCategory(value: unknown): ProductCategory {
  if (!isProductCategory(value)) {
    throw new ProductContractError(
      'INVALID_CATEGORY',
      `Unsupported product category: ${String(value)}.`,
      value,
    );
  }
  return value;
}

export function getProductCategoryRule(category: ProductCategory): ProductCategoryRule {
  return PRODUCT_CATEGORY_RULES[category];
}

export function cloneProduct(product: Product): Product {
  return { ...product };
}

/**
 * Validates the authoritative Product source contract.
 * Duplicate identity/name checks belong to ProductService.
 * Mix-preset compatibility belongs to ProductService/MixPresetService.
 * Safety-waste range semantics are centralized in Phase 2.4A.
 * Applying the safety-waste multiplier belongs to Phase 2.4B.
 */
export function validateProductContract(product: Product): void {
  if (!product.id.trim()) {
    throw new ProductContractError('INVALID_ID', 'Product ID is required.', product.id);
  }

  if (!product.name.trim()) {
    throw new ProductContractError('INVALID_NAME', 'Product name is required.', product.name);
  }

  if (!isProductCategory(product.category)) {
    throw new ProductContractError(
      'INVALID_CATEGORY',
      `Unsupported product category: ${String(product.category)}.`,
      product.category,
    );
  }

  if (product.mixPresetId !== undefined && !product.mixPresetId.trim()) {
    throw new ProductContractError(
      'INVALID_MIX_PRESET_ID',
      'Mix preset ID cannot be blank when provided.',
      product.mixPresetId,
    );
  }

  try {
    validateSafetyWasteRate(product.safetyWasteRate);
  } catch (error) {
    if (error instanceof SafetyWastePolicyError) {
      throw new ProductContractError(
        'INVALID_SAFETY_WASTE_RATE',
        error.message,
        product.safetyWasteRate,
      );
    }
    throw error;
  }

  if (typeof product.isActive !== 'boolean') {
    throw new ProductContractError(
      'INVALID_ACTIVE_STATE',
      'Product active state must be a boolean.',
      product.isActive,
    );
  }
}
