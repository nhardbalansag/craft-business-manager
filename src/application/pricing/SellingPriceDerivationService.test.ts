import { describe, expect, it } from 'vitest';
import type { ProductFinancialProfile } from '../../domain/productFinancialProfile';
import type { PricingPolicy } from '../../domain/pricing';
import type { FullyLoadedProductUnitCostResult } from '../productCosts/FullyLoadedProductUnitCostService';
import {
  SellingPriceDerivationService,
  type SellingPriceCostProvider,
  type SellingPriceFinancialProfileProvider,
} from './SellingPriceDerivationService';

function readyCost(
  overrides: Partial<FullyLoadedProductUnitCostResult> = {},
): FullyLoadedProductUnitCostResult {
  return {
    productId: 'P',
    productName: 'Product P',
    productIsActive: true,
    status: 'ready',
    directMaterialCost: null,
    directMaterialMode: 'costed',
    directMaterialCostSubtotal: 60,
    materialComponentCostSubtotal: 10,
    productComponentCostSubtotal: 5,
    inputMaterialComponentSubtotal: 75,
    laborCostPerUnit: 15,
    overheadCostPerUnit: 10,
    knownFullyLoadedUnitCostSubtotal: 100,
    totalFullyLoadedUnitCost: 100,
    componentLines: [],
    issues: [],
    ...overrides,
  };
}

function profile(
  pricingPolicy: PricingPolicy | null = { method: 'profit-amount', value: 20 },
  overrides: Partial<ProductFinancialProfile> = {},
): ProductFinancialProfile {
  return {
    productId: 'P',
    laborCostPerUnit: 15,
    overheadCostPerUnit: 10,
    pricingPolicy,
    ...overrides,
  };
}

class CostProvider implements SellingPriceCostProvider {
  readonly calls: string[] = [];

  constructor(public result: FullyLoadedProductUnitCostResult) {}

  async costProduct(productId: string): Promise<FullyLoadedProductUnitCostResult> {
    this.calls.push(productId);
    return this.result;
  }
}

class ProfileProvider implements SellingPriceFinancialProfileProvider {
  readonly calls: string[] = [];

  constructor(public result: ProductFinancialProfile | null) {}

  async getProfile(productId: string): Promise<ProductFinancialProfile | null> {
    this.calls.push(productId);
    return this.result;
  }
}

function service(
  cost: FullyLoadedProductUnitCostResult = readyCost(),
  financialProfile: ProductFinancialProfile | null = profile(),
): {
  service: SellingPriceDerivationService;
  costs: CostProvider;
  profiles: ProfileProvider;
} {
  const costs = new CostProvider(cost);
  const profiles = new ProfileProvider(financialProfile);
  return {
    service: new SellingPriceDerivationService(costs, profiles),
    costs,
    profiles,
  };
}

describe('SellingPriceDerivationService', () => {
  it('derives fixed-profit selling price from ready 4.2C cost', async () => {
    const { service: subject } = service();
    const result = await subject.deriveForProduct('P');

    expect(result.status).toBe('ready');
    expect(result.totalFullyLoadedUnitCost).toBe(100);
    expect(result.sellingPrice).toBe(120);
    expect(result.pricingPolicy).toEqual({ method: 'profit-amount', value: 20 });
    expect(result.issues).toEqual([]);
  });

  it('derives markup selling price', async () => {
    const { service: subject } = service(
      readyCost(),
      profile({ method: 'markup-percent', value: 0.5 }),
    );
    expect((await subject.deriveForProduct('P')).sellingPrice).toBe(150);
  });

  it('derives target-margin selling price', async () => {
    const { service: subject } = service(
      readyCost(),
      profile({ method: 'margin-percent', value: 0.25 }),
    );
    expect((await subject.deriveForProduct('P')).sellingPrice).toBeCloseTo(133.33333333333334, 12);
  });

  it('retains full precision for repeating target-margin prices', async () => {
    const { service: subject } = service(
      readyCost({ totalFullyLoadedUnitCost: 1, knownFullyLoadedUnitCostSubtotal: 1 }),
      profile({ method: 'margin-percent', value: 1 / 3 }),
    );
    const result = await subject.deriveForProduct('P');
    expect(result.sellingPrice).toBe(1 / (1 - 1 / 3));
  });

  it('accepts zero fixed-profit policy', async () => {
    const { service: subject } = service(readyCost(), profile({ method: 'profit-amount', value: 0 }));
    expect((await subject.deriveForProduct('P')).sellingPrice).toBe(100);
  });

  it('accepts zero markup policy', async () => {
    const { service: subject } = service(readyCost(), profile({ method: 'markup-percent', value: 0 }));
    expect((await subject.deriveForProduct('P')).sellingPrice).toBe(100);
  });

  it('accepts zero margin policy', async () => {
    const { service: subject } = service(readyCost(), profile({ method: 'margin-percent', value: 0 }));
    expect((await subject.deriveForProduct('P')).sellingPrice).toBe(100);
  });

  it('supports a zero ready unit cost without inventing a minimum price', async () => {
    const { service: subject } = service(
      readyCost({ totalFullyLoadedUnitCost: 0, knownFullyLoadedUnitCostSubtotal: 0 }),
      profile({ method: 'profit-amount', value: 12 }),
    );
    expect((await subject.deriveForProduct('P')).sellingPrice).toBe(12);
  });

  it('keeps ready cost visible but selling price unresolved when pricing policy is null', async () => {
    const { service: subject } = service(readyCost(), profile(null));
    const result = await subject.deriveForProduct('P');

    expect(result.status).toBe('partial');
    expect(result.totalFullyLoadedUnitCost).toBe(100);
    expect(result.sellingPrice).toBeNull();
    expect(result.pricingPolicy).toBeNull();
    expect(result.issues.map((issue) => issue.code)).toContain('PRICING_POLICY_MISSING');
  });

  it('fails closed when the financial profile is missing', async () => {
    const { service: subject } = service(readyCost(), null);
    const result = await subject.deriveForProduct('P');

    expect(result.status).toBe('partial');
    expect(result.sellingPrice).toBeNull();
    expect(result.issues.map((issue) => issue.code)).toContain('FINANCIAL_PROFILE_MISSING');
  });

  it('fails closed when the financial profile belongs to another Product', async () => {
    const { service: subject } = service(readyCost(), profile(undefined, { productId: 'OTHER' }));
    const result = await subject.deriveForProduct('P');

    expect(result.status).toBe('partial');
    expect(result.sellingPrice).toBeNull();
    expect(result.issues.map((issue) => issue.code)).toContain('FINANCIAL_PROFILE_PRODUCT_MISMATCH');
  });

  it('fails closed for negative fixed-profit policy', async () => {
    const { service: subject } = service(readyCost(), profile({ method: 'profit-amount', value: -1 }));
    const result = await subject.deriveForProduct('P');

    expect(result.status).toBe('partial');
    expect(result.sellingPrice).toBeNull();
    expect(result.issues[0]).toMatchObject({
      code: 'PRICING_POLICY_INVALID',
      underlyingCode: 'NEGATIVE_POLICY_VALUE',
    });
  });

  it('fails closed for negative markup policy', async () => {
    const { service: subject } = service(readyCost(), profile({ method: 'markup-percent', value: -0.1 }));
    const result = await subject.deriveForProduct('P');
    expect(result.issues[0]).toMatchObject({
      code: 'PRICING_POLICY_INVALID',
      underlyingCode: 'NEGATIVE_POLICY_VALUE',
    });
  });

  it('fails closed for target margin at or above 100 percent', async () => {
    const { service: subject } = service(readyCost(), profile({ method: 'margin-percent', value: 1 }));
    const result = await subject.deriveForProduct('P');
    expect(result.issues[0]).toMatchObject({
      code: 'PRICING_POLICY_INVALID',
      underlyingCode: 'INVALID_MARGIN_RATE',
    });
  });

  it('fails closed for a non-finite pricing-policy value', async () => {
    const { service: subject } = service(
      readyCost(),
      profile({ method: 'markup-percent', value: Number.POSITIVE_INFINITY }),
    );
    const result = await subject.deriveForProduct('P');
    expect(result.issues[0]).toMatchObject({
      code: 'PRICING_POLICY_INVALID',
      underlyingCode: 'NON_FINITE_POLICY_VALUE',
    });
  });

  it('fails closed for an unsupported pricing method from corrupted/imported data', async () => {
    const corrupt = { method: 'bogus-method', value: 1 } as unknown as PricingPolicy;
    const { service: subject } = service(readyCost(), profile(corrupt));
    const result = await subject.deriveForProduct('P');
    expect(result.issues[0]).toMatchObject({
      code: 'PRICING_POLICY_INVALID',
      underlyingCode: 'INVALID_PRICING_METHOD',
    });
  });

  it('preserves partial 4.2C evidence but never prices the known subtotal', async () => {
    const { service: subject } = service(
      readyCost({
        status: 'partial',
        knownFullyLoadedUnitCostSubtotal: 80,
        totalFullyLoadedUnitCost: null,
      }),
      profile({ method: 'profit-amount', value: 20 }),
    );
    const result = await subject.deriveForProduct('P');

    expect(result.status).toBe('partial');
    expect(result.knownFullyLoadedUnitCostSubtotal).toBe(80);
    expect(result.sellingPrice).toBeNull();
    expect(result.issues.map((issue) => issue.code)).toContain('COST_PARTIAL');
  });

  it('does not derive price from not-ready 4.2C cost', async () => {
    const { service: subject } = service(
      readyCost({
        status: 'not-ready',
        knownFullyLoadedUnitCostSubtotal: null,
        totalFullyLoadedUnitCost: null,
      }),
      profile({ method: 'profit-amount', value: 20 }),
    );
    const result = await subject.deriveForProduct('P');

    expect(result.status).toBe('not-ready');
    expect(result.sellingPrice).toBeNull();
    expect(result.issues.map((issue) => issue.code)).toContain('COST_NOT_READY');
  });

  it('fails closed when ready 4.2C evidence has a null authoritative total', async () => {
    const { service: subject } = service(
      readyCost({ totalFullyLoadedUnitCost: null }),
      profile({ method: 'profit-amount', value: 20 }),
    );
    const result = await subject.deriveForProduct('P');

    expect(result.status).toBe('not-ready');
    expect(result.sellingPrice).toBeNull();
    expect(result.issues.map((issue) => issue.code)).toContain('COST_TOTAL_INVALID');
  });

  it('fails closed when ready 4.2C evidence has a non-finite authoritative total', async () => {
    const { service: subject } = service(
      readyCost({ totalFullyLoadedUnitCost: Number.NaN }),
      profile({ method: 'profit-amount', value: 20 }),
    );
    const result = await subject.deriveForProduct('P');
    expect(result.status).toBe('not-ready');
    expect(result.issues.map((issue) => issue.code)).toContain('COST_TOTAL_INVALID');
  });

  it('fails closed before reading policy when cost evidence belongs to another Product', async () => {
    const fixture = service(readyCost({ productId: 'OTHER' }), profile());
    const result = await fixture.service.deriveForProduct('P');

    expect(result.status).toBe('not-ready');
    expect(result.sellingPrice).toBeNull();
    expect(result.issues.map((issue) => issue.code)).toEqual(['COST_PRODUCT_MISMATCH']);
    expect(fixture.profiles.calls).toEqual([]);
  });

  it('uses authoritative totalFullyLoadedUnitCost rather than known subtotal', async () => {
    const { service: subject } = service(
      readyCost({ totalFullyLoadedUnitCost: 100, knownFullyLoadedUnitCostSubtotal: 999 }),
      profile({ method: 'profit-amount', value: 20 }),
    );
    const result = await subject.deriveForProduct('P');
    expect(result.sellingPrice).toBe(120);
  });

  it('changes selling price when policy changes without changing cost evidence', async () => {
    const cost = readyCost();
    const fixture = service(cost, profile({ method: 'profit-amount', value: 10 }));
    const first = await fixture.service.deriveForProduct('P');

    fixture.profiles.result = profile({ method: 'markup-percent', value: 0.5 });
    const second = await fixture.service.deriveForProduct('P');

    expect(first.totalFullyLoadedUnitCost).toBe(100);
    expect(second.totalFullyLoadedUnitCost).toBe(100);
    expect(first.sellingPrice).toBe(110);
    expect(second.sellingPrice).toBe(150);
  });

  it('keeps archived Products inspectable and priceable', async () => {
    const { service: subject } = service(readyCost({ productIsActive: false }), profile());
    const result = await subject.deriveForProduct('P');
    expect(result.status).toBe('ready');
    expect(result.productIsActive).toBe(false);
    expect(result.sellingPrice).toBe(120);
  });

  it('fails closed when the derived selling price overflows to non-finite', async () => {
    const { service: subject } = service(
      readyCost({
        totalFullyLoadedUnitCost: Number.MAX_VALUE,
        knownFullyLoadedUnitCostSubtotal: Number.MAX_VALUE,
      }),
      profile({ method: 'markup-percent', value: 1 }),
    );
    const result = await subject.deriveForProduct('P');

    expect(result.status).toBe('partial');
    expect(result.sellingPrice).toBeNull();
    expect(result.issues[0]).toMatchObject({
      code: 'SELLING_PRICE_DERIVATION_FAILED',
      underlyingCode: 'NON_FINITE_SELLING_PRICE',
    });
  });

  it('defensively clones the configured pricing policy', async () => {
    const sourcePolicy: PricingPolicy = { method: 'profit-amount', value: 20 };
    const fixture = service(readyCost(), profile(sourcePolicy));
    const result = await fixture.service.deriveForProduct('P');

    sourcePolicy.value = 999;
    fixture.profiles.result!.pricingPolicy!.value = 777;

    expect(result.pricingPolicy).toEqual({ method: 'profit-amount', value: 20 });
    expect(result.sellingPrice).toBe(120);
  });

  it('uses canonical cost Product identity when reading the financial profile', async () => {
    const fixture = service(readyCost({ productId: 'Product-ABC' }), profile(undefined, { productId: 'product-abc' }));
    const result = await fixture.service.deriveForProduct('product-abc');

    expect(fixture.profiles.calls).toEqual(['Product-ABC']);
    expect(result.status).toBe('ready');
  });
});
