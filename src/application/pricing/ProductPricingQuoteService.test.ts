import { describe, expect, it } from 'vitest';
import type { ProductFinancialProfile } from '../../domain/productFinancialProfile';
import type { PricingPolicy } from '../../domain/pricing';
import {
  FullyLoadedProductUnitCostServiceError,
  type FullyLoadedProductUnitCostResult,
} from '../productCosts/FullyLoadedProductUnitCostService';
import type { ProfitMarkupMarginMetricsResult } from './ProfitMarkupMarginMetricsService';
import {
  ProductPricingQuoteService,
  ProductPricingQuoteServiceError,
  type ProductPricingQuoteCostProvider,
  type ProductPricingQuoteFinancialProfileProvider,
  type ProductPricingQuoteMetricsProvider,
} from './ProductPricingQuoteService';

function profile(
  overrides: Partial<ProductFinancialProfile> = {},
): ProductFinancialProfile {
  return {
    productId: 'P',
    laborCostPerUnit: 20,
    overheadCostPerUnit: 10,
    pricingPolicy: { method: 'profit-amount', value: 20 },
    notes: 'Primary quote profile',
    ...overrides,
  };
}

function cost(
  overrides: Partial<FullyLoadedProductUnitCostResult> = {},
): FullyLoadedProductUnitCostResult {
  return {
    productId: 'P',
    productName: 'Product P',
    productIsActive: true,
    status: 'ready',
    directMaterialCost: null,
    directMaterialMode: 'costed',
    directMaterialCostSubtotal: 70,
    materialComponentCostSubtotal: 0,
    productComponentCostSubtotal: 0,
    inputMaterialComponentSubtotal: 70,
    laborCostPerUnit: 20,
    overheadCostPerUnit: 10,
    knownFullyLoadedUnitCostSubtotal: 100,
    totalFullyLoadedUnitCost: 100,
    componentLines: [],
    issues: [],
    ...overrides,
  };
}

function metrics(
  overrides: Partial<ProfitMarkupMarginMetricsResult> = {},
): ProfitMarkupMarginMetricsResult {
  return {
    productId: 'P',
    productName: 'Product P',
    productIsActive: true,
    status: 'ready',
    sellingPriceStatus: 'ready',
    costStatus: 'ready',
    totalFullyLoadedUnitCost: 100,
    knownFullyLoadedUnitCostSubtotal: 100,
    sellingPrice: 120,
    pricingPolicy: { method: 'profit-amount', value: 20 },
    profitPerUnit: 20,
    effectiveMarkup: 0.2,
    effectiveMargin: 1 / 6,
    reconciliation: {
      totalFullyLoadedUnitCost: 100,
      profitPerUnit: 20,
      recomposedSellingPrice: 120,
      sellingPrice: 120,
      reconciliationDifference: 0,
    },
    upstreamIssues: [],
    issues: [],
    ...overrides,
  };
}

class CostProvider implements ProductPricingQuoteCostProvider {
  readonly calls: string[] = [];
  error: Error | null = null;

  constructor(public result: FullyLoadedProductUnitCostResult) {}

  async costProduct(productId: string): Promise<FullyLoadedProductUnitCostResult> {
    this.calls.push(productId);
    if (this.error) throw this.error;
    return this.result;
  }
}

class ProfileProvider implements ProductPricingQuoteFinancialProfileProvider {
  readonly calls: string[] = [];

  constructor(public result: ProductFinancialProfile | null) {}

  async getProfile(productId: string): Promise<ProductFinancialProfile | null> {
    this.calls.push(productId);
    return this.result;
  }
}

class MetricsProvider implements ProductPricingQuoteMetricsProvider {
  readonly calls: string[] = [];

  constructor(public result: ProfitMarkupMarginMetricsResult) {}

  async deriveForProduct(productId: string): Promise<ProfitMarkupMarginMetricsResult> {
    this.calls.push(productId);
    return this.result;
  }
}

function subject(
  costResult: FullyLoadedProductUnitCostResult = cost(),
  profileResult: ProductFinancialProfile | null = profile(),
  metricsResult: ProfitMarkupMarginMetricsResult = metrics(),
): {
  service: ProductPricingQuoteService;
  costs: CostProvider;
  profiles: ProfileProvider;
  metrics: MetricsProvider;
} {
  const costs = new CostProvider(costResult);
  const profiles = new ProfileProvider(profileResult);
  const metricsProvider = new MetricsProvider(metricsResult);

  return {
    service: new ProductPricingQuoteService(costs, profiles, metricsProvider),
    costs,
    profiles,
    metrics: metricsProvider,
  };
}

describe('ProductPricingQuoteService', () => {
  it('assembles a fully ready fixed-profit Product pricing quote', async () => {
    const { service } = subject();
    const result = await service.quoteProduct('P');

    expect(result.status).toBe('ready');
    expect(result.productId).toBe('P');
    expect(result.productName).toBe('Product P');
    expect(result.totalFullyLoadedUnitCost).toBe(100);
    expect(result.sellingPrice).toBe(120);
    expect(result.profitPerUnit).toBe(20);
    expect(result.effectiveMarkup).toBe(0.2);
    expect(result.effectiveMargin).toBeCloseTo(1 / 6, 12);
    expect(result.issues).toEqual([]);
  });

  it('assembles a ready markup-policy quote without recomputing metrics', async () => {
    const policy: PricingPolicy = { method: 'markup-percent', value: 0.5 };
    const { service } = subject(
      cost(),
      profile({ pricingPolicy: policy }),
      metrics({
        pricingPolicy: policy,
        sellingPrice: 150,
        profitPerUnit: 50,
        effectiveMarkup: 0.5,
        effectiveMargin: 1 / 3,
        reconciliation: {
          totalFullyLoadedUnitCost: 100,
          profitPerUnit: 50,
          recomposedSellingPrice: 150,
          sellingPrice: 150,
          reconciliationDifference: 0,
        },
      }),
    );
    const result = await service.quoteProduct('P');

    expect(result.status).toBe('ready');
    expect(result.pricingPolicy).toEqual(policy);
    expect(result.sellingPrice).toBe(150);
    expect(result.profitPerUnit).toBe(50);
    expect(result.effectiveMarkup).toBe(0.5);
    expect(result.effectiveMargin).toBe(1 / 3);
  });

  it('assembles a ready target-margin quote without recomputing metrics', async () => {
    const policy: PricingPolicy = { method: 'margin-percent', value: 0.25 };
    const sellingPrice = 100 / 0.75;
    const profit = sellingPrice - 100;
    const { service } = subject(
      cost(),
      profile({ pricingPolicy: policy }),
      metrics({
        pricingPolicy: policy,
        sellingPrice,
        profitPerUnit: profit,
        effectiveMarkup: profit / 100,
        effectiveMargin: 0.25,
        reconciliation: {
          totalFullyLoadedUnitCost: 100,
          profitPerUnit: profit,
          recomposedSellingPrice: sellingPrice,
          sellingPrice,
          reconciliationDifference: 0,
        },
      }),
    );
    const result = await service.quoteProduct('P');

    expect(result.status).toBe('ready');
    expect(result.sellingPrice).toBe(sellingPrice);
    expect(result.effectiveMargin).toBe(0.25);
  });

  it('exposes complete financial-profile evidence', async () => {
    const sourceProfile = profile({ notes: 'Display this note' });
    const { service } = subject(cost(), sourceProfile, metrics());
    const result = await service.quoteProduct('P');

    expect(result.financialProfile).toEqual(sourceProfile);
  });

  it('retains the complete nested 4.2C cost result', async () => {
    const sourceCost = cost({
      issues: [
        {
          code: 'DIRECT_MATERIAL_COST_PARTIAL',
          message: 'trace-only fixture issue',
          productId: 'P',
        },
      ],
    });
    const { service } = subject(sourceCost, profile(), metrics());
    const result = await service.quoteProduct('P');

    expect(result.fullyLoadedUnitCost).toEqual(sourceCost);
  });

  it('retains the complete nested 4.3B unit-economics result', async () => {
    const sourceMetrics = metrics({
      issues: [
        {
          code: 'EFFECTIVE_MARKUP_UNAVAILABLE_ZERO_COST',
          message: 'trace-only fixture issue',
          productId: 'P',
        },
      ],
    });
    const { service } = subject(cost(), profile(), sourceMetrics);
    const result = await service.quoteProduct('P');

    expect(result.unitEconomics).toEqual(sourceMetrics);
  });

  it('mirrors authoritative nested evidence into top-level convenience fields', async () => {
    const { service } = subject();
    const result = await service.quoteProduct('P');

    expect(result.knownFullyLoadedUnitCostSubtotal).toBe(
      result.fullyLoadedUnitCost.knownFullyLoadedUnitCostSubtotal,
    );
    expect(result.totalFullyLoadedUnitCost).toBe(
      result.fullyLoadedUnitCost.totalFullyLoadedUnitCost,
    );
    expect(result.pricingPolicy).toEqual(result.unitEconomics.pricingPolicy);
    expect(result.sellingPrice).toBe(result.unitEconomics.sellingPrice);
    expect(result.profitPerUnit).toBe(result.unitEconomics.profitPerUnit);
    expect(result.effectiveMarkup).toBe(result.unitEconomics.effectiveMarkup);
    expect(result.effectiveMargin).toBe(result.unitEconomics.effectiveMargin);
  });

  it('keeps a zero-denominator diagnostic quote ready when 4.3B is ready', async () => {
    const zeroCost = cost({
      directMaterialCostSubtotal: 0,
      inputMaterialComponentSubtotal: 0,
      laborCostPerUnit: 0,
      overheadCostPerUnit: 0,
      knownFullyLoadedUnitCostSubtotal: 0,
      totalFullyLoadedUnitCost: 0,
    });
    const zeroProfile = profile({
      laborCostPerUnit: 0,
      overheadCostPerUnit: 0,
      pricingPolicy: { method: 'profit-amount', value: 0 },
    });
    const zeroMetrics = metrics({
      totalFullyLoadedUnitCost: 0,
      knownFullyLoadedUnitCostSubtotal: 0,
      sellingPrice: 0,
      pricingPolicy: { method: 'profit-amount', value: 0 },
      profitPerUnit: 0,
      effectiveMarkup: null,
      effectiveMargin: null,
      reconciliation: {
        totalFullyLoadedUnitCost: 0,
        profitPerUnit: 0,
        recomposedSellingPrice: 0,
        sellingPrice: 0,
        reconciliationDifference: 0,
      },
      issues: [
        {
          code: 'EFFECTIVE_MARKUP_UNAVAILABLE_ZERO_COST',
          message: 'zero cost',
          productId: 'P',
        },
        {
          code: 'EFFECTIVE_MARGIN_UNAVAILABLE_ZERO_PRICE',
          message: 'zero price',
          productId: 'P',
        },
      ],
    });
    const { service } = subject(zeroCost, zeroProfile, zeroMetrics);
    const result = await service.quoteProduct('P');

    expect(result.status).toBe('ready');
    expect(result.effectiveMarkup).toBeNull();
    expect(result.effectiveMargin).toBeNull();
    expect(result.unitEconomics.issues).toHaveLength(2);
  });

  it('returns partial when cost is ready but pricing policy is unconfigured', async () => {
    const noPolicyProfile = profile({ pricingPolicy: null });
    const partialMetrics = metrics({
      status: 'partial',
      sellingPriceStatus: 'partial',
      pricingPolicy: null,
      sellingPrice: null,
      profitPerUnit: null,
      effectiveMarkup: null,
      effectiveMargin: null,
      reconciliation: null,
    });
    const { service } = subject(cost(), noPolicyProfile, partialMetrics);
    const result = await service.quoteProduct('P');

    expect(result.status).toBe('partial');
    expect(result.totalFullyLoadedUnitCost).toBe(100);
    expect(result.sellingPrice).toBeNull();
    expect(result.issues.map((issue) => issue.code)).toContain('UPSTREAM_PARTIAL');
  });

  it('returns partial for consistent partial cost and metrics evidence', async () => {
    const partialCost = cost({
      status: 'partial',
      totalFullyLoadedUnitCost: null,
      knownFullyLoadedUnitCostSubtotal: 80,
    });
    const partialMetrics = metrics({
      status: 'partial',
      sellingPriceStatus: 'partial',
      costStatus: 'partial',
      totalFullyLoadedUnitCost: null,
      knownFullyLoadedUnitCostSubtotal: 80,
      sellingPrice: null,
      profitPerUnit: null,
      effectiveMarkup: null,
      effectiveMargin: null,
      reconciliation: null,
    });
    const { service } = subject(partialCost, profile(), partialMetrics);
    const result = await service.quoteProduct('P');

    expect(result.status).toBe('partial');
    expect(result.knownFullyLoadedUnitCostSubtotal).toBe(80);
  });

  it('returns not-ready for consistent not-ready cost and metrics evidence', async () => {
    const notReadyCost = cost({
      status: 'not-ready',
      totalFullyLoadedUnitCost: null,
      knownFullyLoadedUnitCostSubtotal: null,
    });
    const notReadyMetrics = metrics({
      status: 'not-ready',
      sellingPriceStatus: 'not-ready',
      costStatus: 'not-ready',
      totalFullyLoadedUnitCost: null,
      knownFullyLoadedUnitCostSubtotal: null,
      sellingPrice: null,
      profitPerUnit: null,
      effectiveMarkup: null,
      effectiveMargin: null,
      reconciliation: null,
    });
    const { service } = subject(notReadyCost, profile(), notReadyMetrics);
    const result = await service.quoteProduct('P');

    expect(result.status).toBe('not-ready');
    expect(result.issues.map((issue) => issue.code)).toContain('UPSTREAM_NOT_READY');
  });

  it('keeps a missing financial profile explicit and not-ready', async () => {
    const notReadyCost = cost({
      status: 'not-ready',
      laborCostPerUnit: null,
      overheadCostPerUnit: null,
      totalFullyLoadedUnitCost: null,
      knownFullyLoadedUnitCostSubtotal: 70,
    });
    const notReadyMetrics = metrics({
      status: 'not-ready',
      sellingPriceStatus: 'not-ready',
      costStatus: 'not-ready',
      totalFullyLoadedUnitCost: null,
      knownFullyLoadedUnitCostSubtotal: 70,
      pricingPolicy: null,
      sellingPrice: null,
      profitPerUnit: null,
      effectiveMarkup: null,
      effectiveMargin: null,
      reconciliation: null,
    });
    const { service } = subject(notReadyCost, null, notReadyMetrics);
    const result = await service.quoteProduct('P');

    expect(result.status).toBe('not-ready');
    expect(result.financialProfile).toBeNull();
    expect(result.issues.map((issue) => issue.code)).toContain('FINANCIAL_PROFILE_MISSING');
  });

  it('fails closed when requested and cost Product identities differ', async () => {
    const otherCost = cost({ productId: 'OTHER' });
    const otherProfile = profile({ productId: 'OTHER' });
    const otherMetrics = metrics({ productId: 'OTHER' });
    const { service, costs, profiles, metrics: metricProvider } = subject(
      otherCost,
      otherProfile,
      otherMetrics,
    );
    const result = await service.quoteProduct('  P  ');

    expect(costs.calls).toEqual(['P']);
    expect(profiles.calls).toEqual(['OTHER']);
    expect(metricProvider.calls).toEqual(['OTHER']);
    expect(result.status).toBe('not-ready');
    expect(result.issues[0].code).toBe('COST_PRODUCT_MISMATCH');
  });

  it('accepts case-insensitive equivalent Product identities', async () => {
    const { service } = subject(
      cost({ productId: 'p' }),
      profile({ productId: 'P' }),
      metrics({ productId: 'P' }),
    );
    expect((await service.quoteProduct('P')).status).toBe('ready');
  });

  it('fails closed for a financial-profile Product identity mismatch', async () => {
    const { service } = subject(cost(), profile({ productId: 'OTHER' }), metrics());
    const result = await service.quoteProduct('P');

    expect(result.status).toBe('not-ready');
    expect(result.issues.map((issue) => issue.code)).toContain(
      'FINANCIAL_PROFILE_PRODUCT_MISMATCH',
    );
  });

  it('fails closed for a metrics Product identity mismatch', async () => {
    const { service } = subject(cost(), profile(), metrics({ productId: 'OTHER' }));
    const result = await service.quoteProduct('P');

    expect(result.status).toBe('not-ready');
    expect(result.issues.map((issue) => issue.code)).toContain('METRICS_PRODUCT_MISMATCH');
  });

  it('fails closed for cost-status disagreement', async () => {
    const { service } = subject(cost(), profile(), metrics({ costStatus: 'partial' }));
    const result = await service.quoteProduct('P');

    expect(result.status).toBe('not-ready');
    expect(result.issues.map((issue) => issue.code)).toContain('COST_STATUS_MISMATCH');
  });

  it('fails closed for authoritative total-cost disagreement', async () => {
    const { service } = subject(cost(), profile(), metrics({ totalFullyLoadedUnitCost: 101 }));
    const result = await service.quoteProduct('P');

    expect(result.status).toBe('not-ready');
    expect(result.issues.map((issue) => issue.code)).toContain('TOTAL_COST_MISMATCH');
  });

  it('fails closed for known-subtotal disagreement', async () => {
    const { service } = subject(
      cost(),
      profile(),
      metrics({ knownFullyLoadedUnitCostSubtotal: 99 }),
    );
    const result = await service.quoteProduct('P');

    expect(result.status).toBe('not-ready');
    expect(result.issues.map((issue) => issue.code)).toContain('KNOWN_SUBTOTAL_MISMATCH');
  });

  it('fails closed for configured pricing-policy disagreement', async () => {
    const { service } = subject(
      cost(),
      profile({ pricingPolicy: { method: 'markup-percent', value: 0.5 } }),
      metrics(),
    );
    const result = await service.quoteProduct('P');

    expect(result.status).toBe('not-ready');
    expect(result.issues.map((issue) => issue.code)).toContain('PRICING_POLICY_MISMATCH');
  });

  it('fails closed for a contradictory ready metrics state without a profile', async () => {
    const { service } = subject(cost(), null, metrics());
    const result = await service.quoteProduct('P');

    expect(result.status).toBe('not-ready');
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['FINANCIAL_PROFILE_MISSING', 'READY_STATE_INCONSISTENT']),
    );
  });

  it('keeps archived Products inspectable when all pricing evidence is ready', async () => {
    const { service } = subject(
      cost({ productIsActive: false }),
      profile(),
      metrics({ productIsActive: false }),
    );
    const result = await service.quoteProduct('P');

    expect(result.status).toBe('ready');
    expect(result.productIsActive).toBe(false);
  });

  it('defensively clones profile, cost, and unit-economics evidence', async () => {
    const sourceProfile = profile({
      pricingPolicy: { method: 'markup-percent', value: 0.2 },
    });
    const sourceCost = cost({
      issues: [
        {
          code: 'DIRECT_MATERIAL_COST_PARTIAL',
          message: 'original cost issue',
          productId: 'P',
        },
      ],
    });
    const sourceMetrics = metrics({
      pricingPolicy: { method: 'markup-percent', value: 0.2 },
      issues: [
        {
          code: 'EFFECTIVE_MARKUP_UNAVAILABLE_ZERO_COST',
          message: 'original metrics issue',
          productId: 'P',
        },
      ],
    });
    const { service } = subject(sourceCost, sourceProfile, sourceMetrics);
    const result = await service.quoteProduct('P');

    if (!sourceProfile.pricingPolicy || !sourceMetrics.reconciliation) {
      throw new Error('Expected source evidence for defensive-clone test.');
    }

    sourceProfile.pricingPolicy.value = 99;
    sourceCost.issues[0].message = 'mutated cost issue';
    sourceMetrics.issues[0].message = 'mutated metrics issue';
    sourceMetrics.reconciliation.profitPerUnit = 999;

    expect(result.financialProfile?.pricingPolicy?.value).toBe(0.2);
    expect(result.fullyLoadedUnitCost.issues[0].message).toBe('original cost issue');
    expect(result.unitEconomics.issues[0].message).toBe('original metrics issue');
    expect(result.unitEconomics.reconciliation?.profitPerUnit).toBe(20);
    expect(result.pricingPolicy?.value).toBe(0.2);
  });

  it('translates a known 4.2C Product-not-found error into the 4.3C application error', async () => {
    const fixture = subject();
    fixture.costs.error = new FullyLoadedProductUnitCostServiceError(
      'PRODUCT_NOT_FOUND',
      'Product MISSING was not found for fully loaded unit costing.',
      'MISSING',
    );

    await expect(fixture.service.quoteProduct('MISSING')).rejects.toMatchObject({
      name: 'ProductPricingQuoteServiceError',
      code: 'PRODUCT_NOT_FOUND',
      productId: 'MISSING',
    } satisfies Partial<ProductPricingQuoteServiceError>);
  });

  it('propagates unexpected upstream errors instead of converting them to readiness', async () => {
    const fixture = subject();
    fixture.costs.error = new Error('unexpected');

    await expect(fixture.service.quoteProduct('P')).rejects.toThrow('unexpected');
  });
});
