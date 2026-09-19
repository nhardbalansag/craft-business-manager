import { nextSequentialId } from './identifiers';

export const PRODUCT_PRICE_TIER_KINDS = ['package', 'bulk', 'custom'] as const;
export type ProductPriceTierKind = (typeof PRODUCT_PRICE_TIER_KINDS)[number];

export const PRODUCT_PRICE_TIER_PRICE_BASES = ['per-unit', 'per-offer'] as const;
export type ProductPriceTierPriceBasis = (typeof PRODUCT_PRICE_TIER_PRICE_BASES)[number];

/**
 * Authoritative tiered-pricing source record.
 *
 * The existing ProductFinancialProfile pricing policy remains the Default / Single
 * pricing source. These records represent additive Package / Bulk / Custom offers.
 * Derived cost, profit, markup, margin, and discount values never belong here.
 */
export interface ProductPriceTier {
  id: string;
  productId: string;
  name: string;
  kind: ProductPriceTierKind;
  priceBasis: ProductPriceTierPriceBasis;
  priceAmount: number;
  unitsPerOffer: number;
  minimumOrderQuantity: number;
  additionalCostPerOffer: number;
  notes?: string;
  isActive: boolean;
}

const KIND_SET: ReadonlySet<string> = new Set(PRODUCT_PRICE_TIER_KINDS);
const PRICE_BASIS_SET: ReadonlySet<string> = new Set(PRODUCT_PRICE_TIER_PRICE_BASES);

export type ProductPriceTierErrorCode =
  | 'INVALID_ID'
  | 'INVALID_PRODUCT_ID'
  | 'INVALID_NAME'
  | 'INVALID_KIND'
  | 'INVALID_PRICE_BASIS'
  | 'NON_FINITE_PRICE_AMOUNT'
  | 'NEGATIVE_PRICE_AMOUNT'
  | 'NON_FINITE_UNITS_PER_OFFER'
  | 'NON_INTEGER_UNITS_PER_OFFER'
  | 'NON_POSITIVE_UNITS_PER_OFFER'
  | 'NON_FINITE_MINIMUM_ORDER_QUANTITY'
  | 'NON_INTEGER_MINIMUM_ORDER_QUANTITY'
  | 'NON_POSITIVE_MINIMUM_ORDER_QUANTITY'
  | 'PER_UNIT_UNITS_PER_OFFER_MISMATCH'
  | 'MINIMUM_BELOW_OFFER_SIZE'
  | 'MINIMUM_NOT_OFFER_MULTIPLE'
  | 'NON_FINITE_ADDITIONAL_COST_PER_OFFER'
  | 'NEGATIVE_ADDITIONAL_COST_PER_OFFER'
  | 'INVALID_ACTIVE_STATE';

export class ProductPriceTierError extends Error {
  readonly code: ProductPriceTierErrorCode;
  readonly tierId?: string;
  readonly productId?: string;
  readonly input?: unknown;

  constructor(
    code: ProductPriceTierErrorCode,
    message: string,
    context: {
      tierId?: string;
      productId?: string;
      input?: unknown;
    } = {},
  ) {
    super(message);
    this.name = 'ProductPriceTierError';
    this.code = code;
    this.tierId = context.tierId;
    this.productId = context.productId;
    this.input = context.input;
  }
}

export function isProductPriceTierKind(value: unknown): value is ProductPriceTierKind {
  return typeof value === 'string' && KIND_SET.has(value);
}

export function isProductPriceTierPriceBasis(
  value: unknown,
): value is ProductPriceTierPriceBasis {
  return typeof value === 'string' && PRICE_BASIS_SET.has(value);
}

export function cloneProductPriceTier(tier: ProductPriceTier): ProductPriceTier {
  return { ...tier };
}

/**
 * Allocates the normal stable identifier used when creating a new price tier.
 *
 * Explicit legacy/custom IDs remain valid source identities at lower domain boundaries;
 * only matching TIER-<number> IDs participate in the automatic sequence.
 */
export function nextProductPriceTierId(existingIds: readonly string[]): string {
  return nextSequentialId(existingIds, 'TIER');
}

/**
 * Normalizes only textual source fields.
 *
 * Financial and quantity values retain full source precision and are validated
 * rather than silently repaired. Blank notes are omitted.
 */
export function normalizeProductPriceTier(tier: ProductPriceTier): ProductPriceTier {
  const notes = tier.notes?.trim();

  return {
    ...tier,
    id: tier.id.trim(),
    productId: tier.productId.trim(),
    name: tier.name.trim(),
    notes: notes ? notes : undefined,
  };
}

/**
 * Validates the pure ProductPriceTier source contract.
 *
 * Product existence/active state, duplicate persisted IDs, and normal-UI stable
 * ID allocation belong to later application/repository phases.
 */
export function validateProductPriceTierContract(tier: ProductPriceTier): void {
  const context = {
    tierId: tier.id,
    productId: tier.productId,
  };

  if (!tier.id.trim()) {
    throw new ProductPriceTierError('INVALID_ID', 'Product price tier ID is required.', {
      ...context,
      input: tier.id,
    });
  }

  if (!tier.productId.trim()) {
    throw new ProductPriceTierError(
      'INVALID_PRODUCT_ID',
      'Product price tier Product ID is required.',
      {
        ...context,
        input: tier.productId,
      },
    );
  }

  if (!tier.name.trim()) {
    throw new ProductPriceTierError('INVALID_NAME', 'Product price tier name is required.', {
      ...context,
      input: tier.name,
    });
  }

  if (!isProductPriceTierKind(tier.kind)) {
    throw new ProductPriceTierError(
      'INVALID_KIND',
      `Unsupported product price tier kind: ${String(tier.kind)}.`,
      {
        ...context,
        input: tier.kind,
      },
    );
  }

  if (!isProductPriceTierPriceBasis(tier.priceBasis)) {
    throw new ProductPriceTierError(
      'INVALID_PRICE_BASIS',
      `Unsupported product price tier price basis: ${String(tier.priceBasis)}.`,
      {
        ...context,
        input: tier.priceBasis,
      },
    );
  }

  if (!Number.isFinite(tier.priceAmount)) {
    throw new ProductPriceTierError(
      'NON_FINITE_PRICE_AMOUNT',
      'Product price tier price amount must be finite.',
      {
        ...context,
        input: tier.priceAmount,
      },
    );
  }

  if (tier.priceAmount < 0) {
    throw new ProductPriceTierError(
      'NEGATIVE_PRICE_AMOUNT',
      'Product price tier price amount cannot be negative.',
      {
        ...context,
        input: tier.priceAmount,
      },
    );
  }

  if (!Number.isFinite(tier.unitsPerOffer)) {
    throw new ProductPriceTierError(
      'NON_FINITE_UNITS_PER_OFFER',
      'Product price tier units per offer must be finite.',
      {
        ...context,
        input: tier.unitsPerOffer,
      },
    );
  }

  if (!Number.isInteger(tier.unitsPerOffer)) {
    throw new ProductPriceTierError(
      'NON_INTEGER_UNITS_PER_OFFER',
      'Product price tier units per offer must be a whole-piece count.',
      {
        ...context,
        input: tier.unitsPerOffer,
      },
    );
  }

  if (tier.unitsPerOffer <= 0) {
    throw new ProductPriceTierError(
      'NON_POSITIVE_UNITS_PER_OFFER',
      'Product price tier units per offer must be greater than zero.',
      {
        ...context,
        input: tier.unitsPerOffer,
      },
    );
  }

  if (!Number.isFinite(tier.minimumOrderQuantity)) {
    throw new ProductPriceTierError(
      'NON_FINITE_MINIMUM_ORDER_QUANTITY',
      'Product price tier minimum order quantity must be finite.',
      {
        ...context,
        input: tier.minimumOrderQuantity,
      },
    );
  }

  if (!Number.isInteger(tier.minimumOrderQuantity)) {
    throw new ProductPriceTierError(
      'NON_INTEGER_MINIMUM_ORDER_QUANTITY',
      'Product price tier minimum order quantity must be a whole-piece count.',
      {
        ...context,
        input: tier.minimumOrderQuantity,
      },
    );
  }

  if (tier.minimumOrderQuantity <= 0) {
    throw new ProductPriceTierError(
      'NON_POSITIVE_MINIMUM_ORDER_QUANTITY',
      'Product price tier minimum order quantity must be greater than zero.',
      {
        ...context,
        input: tier.minimumOrderQuantity,
      },
    );
  }

  if (tier.priceBasis === 'per-unit' && tier.unitsPerOffer !== 1) {
    throw new ProductPriceTierError(
      'PER_UNIT_UNITS_PER_OFFER_MISMATCH',
      'Per-unit price tiers must use exactly one Product unit per offer.',
      {
        ...context,
        input: tier.unitsPerOffer,
      },
    );
  }

  if (tier.priceBasis === 'per-offer') {
    if (tier.minimumOrderQuantity < tier.unitsPerOffer) {
      throw new ProductPriceTierError(
        'MINIMUM_BELOW_OFFER_SIZE',
        'Per-offer minimum order quantity cannot be smaller than the offer size.',
        {
          ...context,
          input: tier.minimumOrderQuantity,
        },
      );
    }

    if (tier.minimumOrderQuantity % tier.unitsPerOffer !== 0) {
      throw new ProductPriceTierError(
        'MINIMUM_NOT_OFFER_MULTIPLE',
        'Per-offer minimum order quantity must be a whole multiple of units per offer.',
        {
          ...context,
          input: tier.minimumOrderQuantity,
        },
      );
    }
  }

  if (!Number.isFinite(tier.additionalCostPerOffer)) {
    throw new ProductPriceTierError(
      'NON_FINITE_ADDITIONAL_COST_PER_OFFER',
      'Product price tier additional cost per offer must be finite.',
      {
        ...context,
        input: tier.additionalCostPerOffer,
      },
    );
  }

  if (tier.additionalCostPerOffer < 0) {
    throw new ProductPriceTierError(
      'NEGATIVE_ADDITIONAL_COST_PER_OFFER',
      'Product price tier additional cost per offer cannot be negative.',
      {
        ...context,
        input: tier.additionalCostPerOffer,
      },
    );
  }

  if (typeof tier.isActive !== 'boolean') {
    throw new ProductPriceTierError(
      'INVALID_ACTIVE_STATE',
      'Product price tier active state must be a boolean.',
      {
        ...context,
        input: tier.isActive,
      },
    );
  }
}
