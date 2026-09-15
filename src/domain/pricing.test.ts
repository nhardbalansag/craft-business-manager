import { describe, expect, it } from 'vitest';
import {
  PRICING_METHODS,
  clonePricingPolicy,
  isPricingMethod,
  type PricingPolicy,
} from './pricing';

describe('Phase 4 pricing source types', () => {
  it('exposes the three supported pricing methods', () => {
    expect(PRICING_METHODS).toEqual([
      'profit-amount',
      'markup-percent',
      'margin-percent',
    ]);
    expect(PRICING_METHODS.every((method) => isPricingMethod(method))).toBe(true);
  });

  it('rejects unsupported pricing method identifiers', () => {
    expect(isPricingMethod('retail-price')).toBe(false);
    expect(isPricingMethod('')).toBe(false);
    expect(isPricingMethod(null)).toBe(false);
  });

  it('clones pricing policy source data', () => {
    const policy: PricingPolicy = { method: 'markup-percent', value: 0.5 };
    const cloned = clonePricingPolicy(policy);

    expect(cloned).toEqual(policy);
    expect(cloned).not.toBe(policy);
  });
});
