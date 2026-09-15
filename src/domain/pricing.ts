export const PRICING_METHODS = [
  'profit-amount',
  'markup-percent',
  'margin-percent',
] as const;

export type PricingMethod = (typeof PRICING_METHODS)[number];

/**
 * Authoritative Phase 4 pricing-policy source shape.
 *
 * Numeric policy-value validation and selling-price formulas belong to Phase 4.1B.
 * This module establishes only the supported pricing method vocabulary and source type.
 */
export interface PricingPolicy {
  method: PricingMethod;
  value: number;
}

const PRICING_METHOD_SET: ReadonlySet<string> = new Set(PRICING_METHODS);

export function isPricingMethod(value: unknown): value is PricingMethod {
  return typeof value === 'string' && PRICING_METHOD_SET.has(value);
}

export function clonePricingPolicy(policy: PricingPolicy): PricingPolicy {
  return { ...policy };
}
