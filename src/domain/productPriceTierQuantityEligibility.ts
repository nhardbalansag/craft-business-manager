import {
  validateProductPriceTierContract,
  type ProductPriceTier,
} from './productPriceTiers';

export type ProductPriceResolutionQuantityIssueCode =
  | 'QUANTITY_NON_FINITE'
  | 'QUANTITY_NON_INTEGER'
  | 'QUANTITY_NON_POSITIVE';

export interface ProductPriceResolutionQuantityIssue {
  code: ProductPriceResolutionQuantityIssueCode;
  message: string;
  quantity: number;
}

export interface ProductPriceResolutionQuantityResult {
  quantity: number;
  valid: boolean;
  issues: ProductPriceResolutionQuantityIssue[];
}

export type ProductPriceTierQuantityEligibilityIssueCode =
  | ProductPriceResolutionQuantityIssueCode
  | 'TIER_INACTIVE'
  | 'QUANTITY_BELOW_MINIMUM'
  | 'QUANTITY_NOT_OFFER_MULTIPLE';

export interface ProductPriceTierQuantityEligibilityIssue {
  code: ProductPriceTierQuantityEligibilityIssueCode;
  message: string;
  productId: string;
  tierId: string;
  quantity: number;
}

export interface ProductPriceTierQuantityEligibilityResult {
  productId: string;
  tierId: string;
  quantity: number;
  eligible: boolean;
  offerCount: number | null;
  issues: ProductPriceTierQuantityEligibilityIssue[];
}

function quantityIssue(
  quantity: number,
  code: ProductPriceResolutionQuantityIssueCode,
  message: string,
): ProductPriceResolutionQuantityIssue {
  return { code, message, quantity };
}

/**
 * TP8B shared resolved-pricing quantity validation.
 *
 * Order-pricing quantities are finished Product units and must be finite,
 * whole, and greater than zero. This helper intentionally has no tier or
 * pricing-source selection semantics so TP8C can reuse the exact TP8B rule.
 */
export function evaluateProductPriceResolutionQuantity(
  quantity: number,
): ProductPriceResolutionQuantityResult {
  const issues: ProductPriceResolutionQuantityIssue[] = [];

  if (!Number.isFinite(quantity)) {
    issues.push(
      quantityIssue(
        quantity,
        'QUANTITY_NON_FINITE',
        'Resolved pricing quantity must be finite.',
      ),
    );
  } else if (!Number.isInteger(quantity)) {
    issues.push(
      quantityIssue(
        quantity,
        'QUANTITY_NON_INTEGER',
        'Resolved pricing quantity must be a whole finished-unit count.',
      ),
    );
  } else if (quantity <= 0) {
    issues.push(
      quantityIssue(
        quantity,
        'QUANTITY_NON_POSITIVE',
        'Resolved pricing quantity must be greater than zero.',
      ),
    );
  }

  return {
    quantity,
    valid: issues.length === 0,
    issues: issues.map((candidate) => ({ ...candidate })),
  };
}

function tierIssue(
  tier: ProductPriceTier,
  quantity: number,
  code: ProductPriceTierQuantityEligibilityIssueCode,
  message: string,
): ProductPriceTierQuantityEligibilityIssue {
  return {
    code,
    message,
    productId: tier.productId,
    tierId: tier.id,
    quantity,
  };
}

/**
 * TP8B pure quantity-eligibility contract.
 *
 * This function does not choose a tier, compare prices, inspect economics, or
 * change Default / Single behavior. It only determines whether one validated
 * saved tier can structurally apply to a requested finished-unit quantity.
 */
export function evaluateProductPriceTierQuantityEligibility(
  tier: ProductPriceTier,
  quantity: number,
): ProductPriceTierQuantityEligibilityResult {
  validateProductPriceTierContract(tier);

  const quantityValidation = evaluateProductPriceResolutionQuantity(quantity);

  if (!quantityValidation.valid) {
    return {
      productId: tier.productId,
      tierId: tier.id,
      quantity,
      eligible: false,
      offerCount: null,
      issues: quantityValidation.issues.map((candidate) =>
        tierIssue(
          tier,
          quantity,
          candidate.code,
          candidate.message,
        ),
      ),
    };
  }

  const issues: ProductPriceTierQuantityEligibilityIssue[] = [];

  if (!tier.isActive) {
    issues.push(
      tierIssue(
        tier,
        quantity,
        'TIER_INACTIVE',
        `Product price tier ${tier.id} is archived and cannot be selected for new resolved pricing.`,
      ),
    );
  }

  if (quantity < tier.minimumOrderQuantity) {
    issues.push(
      tierIssue(
        tier,
        quantity,
        'QUANTITY_BELOW_MINIMUM',
        `Quantity ${quantity} is below the minimum order quantity of ${tier.minimumOrderQuantity} for tier ${tier.id}.`,
      ),
    );
  }

  if (tier.priceBasis === 'per-offer' && quantity % tier.unitsPerOffer !== 0) {
    issues.push(
      tierIssue(
        tier,
        quantity,
        'QUANTITY_NOT_OFFER_MULTIPLE',
        `Quantity ${quantity} must be a whole multiple of ${tier.unitsPerOffer} units per offer for tier ${tier.id}.`,
      ),
    );
  }

  const eligible = issues.length === 0;
  const offerCount = eligible
    ? tier.priceBasis === 'per-offer'
      ? quantity / tier.unitsPerOffer
      : quantity
    : null;

  return {
    productId: tier.productId,
    tierId: tier.id,
    quantity,
    eligible,
    offerCount,
    issues: issues.map((candidate) => ({ ...candidate })),
  };
}
