import {
  clonePricingPolicy,
  isPricingMethod,
  type PricingPolicy,
} from './pricing';

/**
 * Authoritative Phase 4 Product-level financial source record.
 *
 * Missing profile and explicit zero-cost profile are intentionally different states.
 * Derived total cost, selling price, revenue, and profit never belong on this source record.
 */
export interface ProductFinancialProfile {
  productId: string;
  laborCostPerUnit: number;
  overheadCostPerUnit: number;
  pricingPolicy: PricingPolicy | null;
  notes?: string;
}

export type ProductFinancialProfileErrorCode =
  | 'INVALID_PRODUCT_ID'
  | 'NON_FINITE_LABOR_COST'
  | 'NEGATIVE_LABOR_COST'
  | 'NON_FINITE_OVERHEAD_COST'
  | 'NEGATIVE_OVERHEAD_COST'
  | 'INVALID_PRICING_METHOD';

export class ProductFinancialProfileError extends Error {
  readonly code: ProductFinancialProfileErrorCode;
  readonly productId?: string;
  readonly input?: unknown;

  constructor(
    code: ProductFinancialProfileErrorCode,
    message: string,
    context: { productId?: string; input?: unknown } = {},
  ) {
    super(message);
    this.name = 'ProductFinancialProfileError';
    this.code = code;
    this.productId = context.productId;
    this.input = context.input;
  }
}

export function cloneProductFinancialProfile(
  profile: ProductFinancialProfile,
): ProductFinancialProfile {
  return {
    ...profile,
    pricingPolicy:
      profile.pricingPolicy === null ? null : clonePricingPolicy(profile.pricingPolicy),
  };
}

/**
 * Normalizes source text without sanitizing financial values.
 *
 * Monetary values retain full precision. Pricing policy value semantics are validated
 * by Phase 4.1B rather than silently repaired here.
 */
export function normalizeProductFinancialProfile(
  profile: ProductFinancialProfile,
): ProductFinancialProfile {
  const notes = profile.notes?.trim();

  return {
    ...profile,
    productId: profile.productId.trim(),
    pricingPolicy:
      profile.pricingPolicy === null ? null : clonePricingPolicy(profile.pricingPolicy),
    notes: notes ? notes : undefined,
  };
}

/**
 * Validates only the authoritative Phase 4.1A source contract.
 *
 * Product existence and one-profile-per-Product enforcement belong to 4.1C.
 * Pricing policy numeric ranges/formulas belong to 4.1B.
 */
export function validateProductFinancialProfileContract(
  profile: ProductFinancialProfile,
): void {
  if (!profile.productId.trim()) {
    throw new ProductFinancialProfileError(
      'INVALID_PRODUCT_ID',
      'Financial profile Product ID is required.',
      { productId: profile.productId, input: profile.productId },
    );
  }

  if (!Number.isFinite(profile.laborCostPerUnit)) {
    throw new ProductFinancialProfileError(
      'NON_FINITE_LABOR_COST',
      'Labor cost per unit must be finite.',
      { productId: profile.productId, input: profile.laborCostPerUnit },
    );
  }

  if (profile.laborCostPerUnit < 0) {
    throw new ProductFinancialProfileError(
      'NEGATIVE_LABOR_COST',
      'Labor cost per unit cannot be negative.',
      { productId: profile.productId, input: profile.laborCostPerUnit },
    );
  }

  if (!Number.isFinite(profile.overheadCostPerUnit)) {
    throw new ProductFinancialProfileError(
      'NON_FINITE_OVERHEAD_COST',
      'Overhead cost per unit must be finite.',
      { productId: profile.productId, input: profile.overheadCostPerUnit },
    );
  }

  if (profile.overheadCostPerUnit < 0) {
    throw new ProductFinancialProfileError(
      'NEGATIVE_OVERHEAD_COST',
      'Overhead cost per unit cannot be negative.',
      { productId: profile.productId, input: profile.overheadCostPerUnit },
    );
  }

  if (
    profile.pricingPolicy !== null &&
    !isPricingMethod(profile.pricingPolicy?.method)
  ) {
    throw new ProductFinancialProfileError(
      'INVALID_PRICING_METHOD',
      `Unsupported pricing method: ${String(profile.pricingPolicy?.method)}.`,
      { productId: profile.productId, input: profile.pricingPolicy?.method },
    );
  }
}
