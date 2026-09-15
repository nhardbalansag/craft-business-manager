import { describe, expect, it } from 'vitest';
import type { BusinessDataset } from './types';
import {
  ProductFinancialProfileError,
  cloneProductFinancialProfile,
  normalizeProductFinancialProfile,
  validateProductFinancialProfileContract,
  type ProductFinancialProfile,
} from './productFinancialProfile';

function baseProfile(
  overrides: Partial<ProductFinancialProfile> = {},
): ProductFinancialProfile {
  return {
    productId: 'CANDLE-001',
    laborCostPerUnit: 12.5,
    overheadCostPerUnit: 4.25,
    pricingPolicy: { method: 'profit-amount', value: 30 },
    notes: 'Standard retail profile',
    ...overrides,
  };
}

function expectProfileError(
  profile: ProductFinancialProfile,
  code: ProductFinancialProfileError['code'],
): void {
  try {
    validateProductFinancialProfileContract(profile);
    throw new Error('Expected ProductFinancialProfileError.');
  } catch (error) {
    expect(error).toBeInstanceOf(ProductFinancialProfileError);
    expect((error as ProductFinancialProfileError).code).toBe(code);
  }
}

describe('ProductFinancialProfile contract', () => {
  it('accepts a valid configured profile', () => {
    expect(() => validateProductFinancialProfileContract(baseProfile())).not.toThrow();
  });

  it('accepts explicit zero labor and overhead', () => {
    expect(() =>
      validateProductFinancialProfileContract(
        baseProfile({ laborCostPerUnit: 0, overheadCostPerUnit: 0 }),
      ),
    ).not.toThrow();
  });

  it('accepts an explicitly unconfigured pricing policy', () => {
    expect(() =>
      validateProductFinancialProfileContract(baseProfile({ pricingPolicy: null })),
    ).not.toThrow();
  });

  it('rejects blank Product identity', () => {
    expectProfileError(baseProfile({ productId: '   ' }), 'INVALID_PRODUCT_ID');
  });

  it.each([NaN, Infinity, -Infinity])('rejects non-finite labor cost %s', (value) => {
    expectProfileError(
      baseProfile({ laborCostPerUnit: value }),
      'NON_FINITE_LABOR_COST',
    );
  });

  it('rejects negative labor cost', () => {
    expectProfileError(baseProfile({ laborCostPerUnit: -0.01 }), 'NEGATIVE_LABOR_COST');
  });

  it.each([NaN, Infinity, -Infinity])('rejects non-finite overhead cost %s', (value) => {
    expectProfileError(
      baseProfile({ overheadCostPerUnit: value }),
      'NON_FINITE_OVERHEAD_COST',
    );
  });

  it('rejects negative overhead cost', () => {
    expectProfileError(baseProfile({ overheadCostPerUnit: -1 }), 'NEGATIVE_OVERHEAD_COST');
  });

  it('rejects an unsupported pricing method without claiming policy-value authority', () => {
    const invalid = baseProfile({
      pricingPolicy: { method: 'retail-price', value: 10 } as unknown as NonNullable<
        ProductFinancialProfile['pricingPolicy']
      >,
    });

    expectProfileError(invalid, 'INVALID_PRICING_METHOD');
  });

  it('normalizes Product identity and notes while preserving explicit null policy', () => {
    const normalized = normalizeProductFinancialProfile(
      baseProfile({
        productId: '  CANDLE-001  ',
        pricingPolicy: null,
        notes: '  seasonal profile  ',
      }),
    );

    expect(normalized).toEqual({
      productId: 'CANDLE-001',
      laborCostPerUnit: 12.5,
      overheadCostPerUnit: 4.25,
      pricingPolicy: null,
      notes: 'seasonal profile',
    });
  });

  it('omits blank notes during normalization', () => {
    expect(normalizeProductFinancialProfile(baseProfile({ notes: '   ' })).notes).toBeUndefined();
  });

  it('deep-clones the nested pricing policy', () => {
    const original = baseProfile();
    const cloned = cloneProductFinancialProfile(original);

    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned.pricingPolicy).not.toBe(original.pricingPolicy);

    if (cloned.pricingPolicy && original.pricingPolicy) {
      cloned.pricingPolicy.value = 999;
      expect(original.pricingPolicy.value).toBe(30);
    }
  });

  it('normalization also clones the nested pricing policy', () => {
    const original = baseProfile();
    const normalized = normalizeProductFinancialProfile(original);

    expect(normalized.pricingPolicy).not.toBe(original.pricingPolicy);
  });

  it('establishes Product financial profiles as BusinessDataset source data', () => {
    const profile = baseProfile({ pricingPolicy: null });
    const dataset: BusinessDataset = {
      schemaVersion: 1,
      materials: [],
      mixPresets: [],
      products: [],
      yieldSamples: [],
      recipeItems: [],
      productComponents: [],
      productStocks: [],
      productFinancialProfiles: [profile],
    };

    expect(dataset.productFinancialProfiles).toEqual([profile]);
  });
});
