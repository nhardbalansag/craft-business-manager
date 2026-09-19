export const PRICING_METHODS = [
  'profit-amount',
  'markup-percent',
  'margin-percent',
] as const;

export type PricingMethod = (typeof PRICING_METHODS)[number];

/** Authoritative Phase 4 pricing-policy source shape. */
export interface PricingPolicy {
  method: PricingMethod;
  value: number;
}

export interface UnitEconomics {
  sellingPrice: number;
  profitPerUnit: number;
  effectiveMarkup: number | null;
  effectiveMargin: number | null;
}

export type PricingErrorCode =
  | 'INVALID_PRICING_METHOD'
  | 'NON_FINITE_POLICY_VALUE'
  | 'NEGATIVE_POLICY_VALUE'
  | 'INVALID_MARGIN_RATE'
  | 'NON_FINITE_UNIT_COST'
  | 'NEGATIVE_UNIT_COST'
  | 'NON_FINITE_SELLING_PRICE'
  | 'NEGATIVE_SELLING_PRICE';

export class PricingError extends Error {
  readonly code: PricingErrorCode;
  readonly method?: string;
  readonly input?: unknown;

  constructor(
    code: PricingErrorCode,
    message: string,
    context: { method?: string; input?: unknown } = {},
  ) {
    super(message);
    this.name = 'PricingError';
    this.code = code;
    this.method = context.method;
    this.input = context.input;
  }
}

const PRICING_METHOD_SET: ReadonlySet<string> = new Set(PRICING_METHODS);

export function isPricingMethod(value: unknown): value is PricingMethod {
  return typeof value === 'string' && PRICING_METHOD_SET.has(value);
}

export function clonePricingPolicy(policy: PricingPolicy): PricingPolicy {
  return { ...policy };
}

/**
 * Validates the authoritative Phase 4 pricing policy.
 *
 * Percentage methods use canonical decimal rates: 0.50 = 50%.
 */
export function validatePricingPolicy(policy: PricingPolicy): void {
  if (!isPricingMethod(policy.method)) {
    throw new PricingError(
      'INVALID_PRICING_METHOD',
      `Unsupported pricing method: ${String(policy.method)}.`,
      { method: String(policy.method), input: policy.method },
    );
  }

  if (!Number.isFinite(policy.value)) {
    throw new PricingError(
      'NON_FINITE_POLICY_VALUE',
      'Pricing policy value must be finite.',
      { method: policy.method, input: policy.value },
    );
  }

  if (policy.method === 'margin-percent') {
    if (policy.value < 0 || policy.value >= 1) {
      throw new PricingError(
        'INVALID_MARGIN_RATE',
        'Target margin rate must be greater than or equal to 0 and less than 1.',
        { method: policy.method, input: policy.value },
      );
    }

    return;
  }

  if (policy.value < 0) {
    throw new PricingError(
      'NEGATIVE_POLICY_VALUE',
      'Profit amount and markup rate cannot be negative.',
      { method: policy.method, input: policy.value },
    );
  }
}

export function validatePricingUnitCost(unitCost: number): void {
  if (!Number.isFinite(unitCost)) {
    throw new PricingError(
      'NON_FINITE_UNIT_COST',
      'Pricing unit cost must be finite.',
      { input: unitCost },
    );
  }

  if (unitCost < 0) {
    throw new PricingError(
      'NEGATIVE_UNIT_COST',
      'Pricing unit cost cannot be negative.',
      { input: unitCost },
    );
  }
}

export function validatePricingSellingPrice(sellingPrice: number): void {
  if (!Number.isFinite(sellingPrice)) {
    throw new PricingError(
      'NON_FINITE_SELLING_PRICE',
      'Selling price must be finite.',
      { input: sellingPrice },
    );
  }

  if (sellingPrice < 0) {
    throw new PricingError(
      'NEGATIVE_SELLING_PRICE',
      'Selling price cannot be negative.',
      { input: sellingPrice },
    );
  }
}

/** Derives a full-precision selling price from a validated policy. */
export function deriveSellingPrice(unitCost: number, policy: PricingPolicy): number {
  validatePricingUnitCost(unitCost);
  validatePricingPolicy(policy);

  let sellingPrice: number;

  switch (policy.method) {
    case 'profit-amount':
      sellingPrice = unitCost + policy.value;
      break;
    case 'markup-percent':
      sellingPrice = unitCost * (1 + policy.value);
      break;
    case 'margin-percent':
      sellingPrice = unitCost / (1 - policy.value);
      break;
  }

  validatePricingSellingPrice(sellingPrice);
  return sellingPrice;
}

export function calculateProfitPerUnit(unitCost: number, sellingPrice: number): number {
  validatePricingUnitCost(unitCost);
  validatePricingSellingPrice(sellingPrice);
  return sellingPrice - unitCost;
}

export function calculateEffectiveMarkup(
  unitCost: number,
  sellingPrice: number,
): number | null {
  const profitPerUnit = calculateProfitPerUnit(unitCost, sellingPrice);
  return unitCost === 0 ? null : profitPerUnit / unitCost;
}

export function calculateEffectiveMargin(
  unitCost: number,
  sellingPrice: number,
): number | null {
  const profitPerUnit = calculateProfitPerUnit(unitCost, sellingPrice);
  return sellingPrice === 0 ? null : profitPerUnit / sellingPrice;
}

/**
 * Derives one internally consistent unit-economics snapshot from one validated
 * unit-cost/policy pair. No monetary or rate rounding occurs in the domain.
 */
export function deriveUnitEconomics(unitCost: number, policy: PricingPolicy): UnitEconomics {
  const sellingPrice = deriveSellingPrice(unitCost, policy);
  const profitPerUnit = calculateProfitPerUnit(unitCost, sellingPrice);

  return {
    sellingPrice,
    profitPerUnit,
    effectiveMarkup: unitCost === 0 ? null : profitPerUnit / unitCost,
    effectiveMargin: sellingPrice === 0 ? null : profitPerUnit / sellingPrice,
  };
}
