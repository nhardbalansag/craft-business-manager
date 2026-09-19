import { describe, expect, it } from 'vitest';
import {
  PRICING_METHODS,
  PricingError,
  calculateEffectiveMargin,
  calculateEffectiveMarkup,
  calculateProfitPerUnit,
  clonePricingPolicy,
  deriveSellingPrice,
  deriveUnitEconomics,
  isPricingMethod,
  validatePricingPolicy,
  validatePricingSellingPrice,
  validatePricingUnitCost,
  type PricingPolicy,
} from './pricing';

function expectPricingError(
  action: () => unknown,
  code: PricingError['code'],
): void {
  try {
    action();
    throw new Error('Expected PricingError.');
  } catch (error) {
    expect(error).toBeInstanceOf(PricingError);
    expect((error as PricingError).code).toBe(code);
  }
}

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

describe('Phase 4 pricing policy validation', () => {
  it.each<PricingPolicy>([
    { method: 'profit-amount', value: 30 },
    { method: 'markup-percent', value: 0.5 },
    { method: 'margin-percent', value: 0.25 },
    { method: 'profit-amount', value: 0 },
    { method: 'markup-percent', value: 0 },
    { method: 'margin-percent', value: 0 },
  ])('accepts valid canonical policy $method / $value', (policy) => {
    expect(() => validatePricingPolicy(policy)).not.toThrow();
  });

  it.each(PRICING_METHODS)('rejects non-finite %s policy values', (method) => {
    for (const value of [NaN, Infinity, -Infinity]) {
      expectPricingError(
        () => validatePricingPolicy({ method, value }),
        'NON_FINITE_POLICY_VALUE',
      );
    }
  });

  it('rejects negative fixed profit amount', () => {
    expectPricingError(
      () => validatePricingPolicy({ method: 'profit-amount', value: -0.01 }),
      'NEGATIVE_POLICY_VALUE',
    );
  });

  it('rejects negative markup rate', () => {
    expectPricingError(
      () => validatePricingPolicy({ method: 'markup-percent', value: -0.01 }),
      'NEGATIVE_POLICY_VALUE',
    );
  });

  it.each([-0.01, 1, 1.25])('rejects invalid target margin %s', (value) => {
    expectPricingError(
      () => validatePricingPolicy({ method: 'margin-percent', value }),
      'INVALID_MARGIN_RATE',
    );
  });

  it('rejects a corrupted unsupported pricing method at runtime', () => {
    const policy = {
      method: 'retail-price',
      value: 10,
    } as unknown as PricingPolicy;

    expectPricingError(() => validatePricingPolicy(policy), 'INVALID_PRICING_METHOD');
  });
});

describe('Phase 4 pricing numeric validation', () => {
  it.each([0, 0.01, 100])('accepts finite non-negative unit cost %s', (value) => {
    expect(() => validatePricingUnitCost(value)).not.toThrow();
  });

  it('rejects negative unit cost', () => {
    expectPricingError(() => validatePricingUnitCost(-0.01), 'NEGATIVE_UNIT_COST');
  });

  it.each([NaN, Infinity, -Infinity])('rejects non-finite unit cost %s', (value) => {
    expectPricingError(() => validatePricingUnitCost(value), 'NON_FINITE_UNIT_COST');
  });

  it.each([0, 0.01, 100])('accepts finite non-negative selling price %s', (value) => {
    expect(() => validatePricingSellingPrice(value)).not.toThrow();
  });

  it('rejects negative selling price', () => {
    expectPricingError(() => validatePricingSellingPrice(-0.01), 'NEGATIVE_SELLING_PRICE');
  });

  it.each([NaN, Infinity, -Infinity])('rejects non-finite selling price %s', (value) => {
    expectPricingError(() => validatePricingSellingPrice(value), 'NON_FINITE_SELLING_PRICE');
  });
});

describe('Phase 4 selling-price formulas', () => {
  it('derives fixed-profit selling price', () => {
    expect(deriveSellingPrice(37, { method: 'profit-amount', value: 30 })).toBe(67);
  });

  it('allows zero fixed profit', () => {
    expect(deriveSellingPrice(37, { method: 'profit-amount', value: 0 })).toBe(37);
  });

  it('derives markup selling price from canonical decimal rate', () => {
    expect(deriveSellingPrice(100, { method: 'markup-percent', value: 0.5 })).toBe(150);
  });

  it('allows zero markup', () => {
    expect(deriveSellingPrice(100, { method: 'markup-percent', value: 0 })).toBe(100);
  });

  it('derives target-margin selling price from canonical decimal rate', () => {
    expect(deriveSellingPrice(100, { method: 'margin-percent', value: 0.25 })).toBeCloseTo(
      133.33333333333334,
    );
  });

  it('allows zero target margin', () => {
    expect(deriveSellingPrice(100, { method: 'margin-percent', value: 0 })).toBe(100);
  });

  it('does not round repeating monetary results in the domain', () => {
    const price = deriveSellingPrice(10, { method: 'margin-percent', value: 0.3 });
    expect(price).toBe(10 / 0.7);
    expect(price).not.toBe(Number(price.toFixed(2)));
  });

  it('rejects invalid margin instead of returning a fake zero price', () => {
    expectPricingError(
      () => deriveSellingPrice(100, { method: 'margin-percent', value: 1 }),
      'INVALID_MARGIN_RATE',
    );
  });

  it('rejects derived non-finite selling price', () => {
    expectPricingError(
      () => deriveSellingPrice(Number.MAX_VALUE, { method: 'markup-percent', value: 1 }),
      'NON_FINITE_SELLING_PRICE',
    );
  });
});

describe('Phase 4 unit economics diagnostics', () => {
  it('calculates profit per unit', () => {
    expect(calculateProfitPerUnit(37, 67)).toBe(30);
  });

  it('allows an externally supplied price below cost for diagnostic loss analysis', () => {
    expect(calculateProfitPerUnit(100, 80)).toBe(-20);
  });

  it('calculates effective markup', () => {
    expect(calculateEffectiveMarkup(100, 150)).toBe(0.5);
  });

  it('returns null effective markup when unit cost is zero', () => {
    expect(calculateEffectiveMarkup(0, 10)).toBeNull();
  });

  it('calculates effective margin', () => {
    expect(calculateEffectiveMargin(100, 125)).toBe(0.2);
  });

  it('returns null effective margin when selling price is zero', () => {
    expect(calculateEffectiveMargin(0, 0)).toBeNull();
  });

  it('derives one consistent fixed-profit unit-economics snapshot', () => {
    expect(deriveUnitEconomics(100, { method: 'profit-amount', value: 25 })).toEqual({
      sellingPrice: 125,
      profitPerUnit: 25,
      effectiveMarkup: 0.25,
      effectiveMargin: 0.2,
    });
  });

  it('keeps zero-cost markup diagnostics explicitly unavailable', () => {
    expect(deriveUnitEconomics(0, { method: 'markup-percent', value: 0.5 })).toEqual({
      sellingPrice: 0,
      profitPerUnit: 0,
      effectiveMarkup: null,
      effectiveMargin: null,
    });
  });

  it('can report a 100% effective margin diagnostic when zero cost has positive fixed profit', () => {
    expect(deriveUnitEconomics(0, { method: 'profit-amount', value: 10 })).toEqual({
      sellingPrice: 10,
      profitPerUnit: 10,
      effectiveMarkup: null,
      effectiveMargin: 1,
    });
  });
});
