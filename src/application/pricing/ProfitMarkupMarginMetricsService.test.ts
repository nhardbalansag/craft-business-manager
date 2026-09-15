import { describe, expect, it } from 'vitest';
import type { PricingPolicy } from '../../domain/pricing';
import type {
  SellingPriceDerivationIssue,
  SellingPriceDerivationResult,
} from './SellingPriceDerivationService';
import {
  ProfitMarkupMarginMetricsService,
  type ProfitMarkupMarginMetricsSellingPriceProvider,
} from './ProfitMarkupMarginMetricsService';

function readySellingPrice(
  overrides: Partial<SellingPriceDerivationResult> = {},
): SellingPriceDerivationResult {
  return {
    productId: 'P',
    productName: 'Product P',
    productIsActive: true,
    status: 'ready',
    costStatus: 'ready',
    totalFullyLoadedUnitCost: 100,
    knownFullyLoadedUnitCostSubtotal: 100,
    pricingPolicy: { method: 'profit-amount', value: 20 },
    sellingPrice: 120,
    issues: [],
    ...overrides,
  };
}

class SellingPriceProvider implements ProfitMarkupMarginMetricsSellingPriceProvider {
  readonly calls: string[] = [];

  constructor(public result: SellingPriceDerivationResult) {}

  async deriveForProduct(productId: string): Promise<SellingPriceDerivationResult> {
    this.calls.push(productId);
    return this.result;
  }
}

function service(result: SellingPriceDerivationResult = readySellingPrice()): {
  service: ProfitMarkupMarginMetricsService;
  provider: SellingPriceProvider;
} {
  const provider = new SellingPriceProvider(result);
  return {
    service: new ProfitMarkupMarginMetricsService(provider),
    provider,
  };
}

describe('ProfitMarkupMarginMetricsService', () => {
  it('derives fixed-profit unit economics from the ready 4.3A result', async () => {
    const { service: subject } = service();
    const result = await subject.deriveForProduct('P');

    expect(result.status).toBe('ready');
    expect(result.totalFullyLoadedUnitCost).toBe(100);
    expect(result.sellingPrice).toBe(120);
    expect(result.profitPerUnit).toBe(20);
    expect(result.effectiveMarkup).toBe(0.2);
    expect(result.effectiveMargin).toBeCloseTo(1 / 6, 12);
    expect(result.pricingPolicy).toEqual({ method: 'profit-amount', value: 20 });
    expect(result.reconciliation).toEqual({
      totalFullyLoadedUnitCost: 100,
      profitPerUnit: 20,
      recomposedSellingPrice: 120,
      sellingPrice: 120,
      reconciliationDifference: 0,
    });
    expect(result.issues).toEqual([]);
  });

  it('derives effective metrics for a markup policy', async () => {
    const { service: subject } = service(
      readySellingPrice({
        pricingPolicy: { method: 'markup-percent', value: 0.5 },
        sellingPrice: 150,
      }),
    );
    const result = await subject.deriveForProduct('P');

    expect(result.profitPerUnit).toBe(50);
    expect(result.effectiveMarkup).toBe(0.5);
    expect(result.effectiveMargin).toBeCloseTo(1 / 3, 12);
    expect(result.pricingPolicy).toEqual({ method: 'markup-percent', value: 0.5 });
  });

  it('derives effective metrics for a target-margin policy', async () => {
    const sellingPrice = 100 / (1 - 0.25);
    const { service: subject } = service(
      readySellingPrice({
        pricingPolicy: { method: 'margin-percent', value: 0.25 },
        sellingPrice,
      }),
    );
    const result = await subject.deriveForProduct('P');

    expect(result.profitPerUnit).toBeCloseTo(sellingPrice - 100, 12);
    expect(result.effectiveMarkup).toBeCloseTo(1 / 3, 12);
    expect(result.effectiveMargin).toBeCloseTo(0.25, 12);
    expect(result.pricingPolicy).toEqual({ method: 'margin-percent', value: 0.25 });
  });

  it('retains full precision without presentation rounding', async () => {
    const unitCost = 1;
    const sellingPrice = unitCost / (1 - 1 / 3);
    const { service: subject } = service(
      readySellingPrice({
        totalFullyLoadedUnitCost: unitCost,
        knownFullyLoadedUnitCostSubtotal: unitCost,
        pricingPolicy: { method: 'margin-percent', value: 1 / 3 },
        sellingPrice,
      }),
    );
    const result = await subject.deriveForProduct('P');

    expect(result.sellingPrice).toBe(sellingPrice);
    expect(result.profitPerUnit).toBe(sellingPrice - unitCost);
    expect(result.effectiveMargin).toBe((sellingPrice - unitCost) / sellingPrice);
  });

  it('keeps ready status but marks effective markup unavailable when cost is zero', async () => {
    const { service: subject } = service(
      readySellingPrice({
        totalFullyLoadedUnitCost: 0,
        knownFullyLoadedUnitCostSubtotal: 0,
        pricingPolicy: { method: 'profit-amount', value: 12 },
        sellingPrice: 12,
      }),
    );
    const result = await subject.deriveForProduct('P');

    expect(result.status).toBe('ready');
    expect(result.profitPerUnit).toBe(12);
    expect(result.effectiveMarkup).toBeNull();
    expect(result.effectiveMargin).toBe(1);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'EFFECTIVE_MARKUP_UNAVAILABLE_ZERO_COST',
    ]);
  });

  it('keeps ready status and returns null ratios for zero cost and zero price', async () => {
    const { service: subject } = service(
      readySellingPrice({
        totalFullyLoadedUnitCost: 0,
        knownFullyLoadedUnitCostSubtotal: 0,
        pricingPolicy: { method: 'profit-amount', value: 0 },
        sellingPrice: 0,
      }),
    );
    const result = await subject.deriveForProduct('P');

    expect(result.status).toBe('ready');
    expect(result.profitPerUnit).toBe(0);
    expect(result.effectiveMarkup).toBeNull();
    expect(result.effectiveMargin).toBeNull();
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'EFFECTIVE_MARKUP_UNAVAILABLE_ZERO_COST',
      'EFFECTIVE_MARGIN_UNAVAILABLE_ZERO_PRICE',
    ]);
  });

  it('preserves partial upstream evidence without publishing metrics', async () => {
    const upstreamIssue: SellingPriceDerivationIssue = {
      code: 'PRICING_POLICY_MISSING',
      message: 'missing policy',
      productId: 'P',
    };
    const { service: subject } = service(
      readySellingPrice({
        status: 'partial',
        pricingPolicy: null,
        sellingPrice: null,
        issues: [upstreamIssue],
      }),
    );
    const result = await subject.deriveForProduct('P');

    expect(result.status).toBe('partial');
    expect(result.profitPerUnit).toBeNull();
    expect(result.reconciliation).toBeNull();
    expect(result.upstreamIssues).toEqual([upstreamIssue]);
    expect(result.issues.map((issue) => issue.code)).toContain('UPSTREAM_PARTIAL');
  });

  it('preserves not-ready upstream state without publishing metrics', async () => {
    const { service: subject } = service(
      readySellingPrice({
        status: 'not-ready',
        costStatus: 'not-ready',
        totalFullyLoadedUnitCost: null,
        knownFullyLoadedUnitCostSubtotal: null,
        pricingPolicy: null,
        sellingPrice: null,
      }),
    );
    const result = await subject.deriveForProduct('P');

    expect(result.status).toBe('not-ready');
    expect(result.profitPerUnit).toBeNull();
    expect(result.issues.map((issue) => issue.code)).toContain('UPSTREAM_NOT_READY');
  });

  it('fails closed when requested and upstream Product identities differ', async () => {
    const { service: subject, provider } = service(readySellingPrice({ productId: 'OTHER' }));
    const result = await subject.deriveForProduct('  P  ');

    expect(provider.calls).toEqual(['P']);
    expect(result.status).toBe('not-ready');
    expect(result.issues[0]).toMatchObject({
      code: 'UPSTREAM_PRODUCT_MISMATCH',
      productId: 'P',
    });
  });

  it('accepts case-insensitive equivalent Product identity', async () => {
    const { service: subject } = service(readySellingPrice({ productId: 'p' }));
    expect((await subject.deriveForProduct('P')).status).toBe('ready');
  });

  it('fails closed when a ready upstream result has no authoritative cost', async () => {
    const { service: subject } = service(
      readySellingPrice({ totalFullyLoadedUnitCost: null }),
    );
    const result = await subject.deriveForProduct('P');

    expect(result.status).toBe('not-ready');
    expect(result.profitPerUnit).toBeNull();
    expect(result.issues[0].code).toBe('UNIT_COST_INVALID');
  });

  it('fails closed for invalid ready unit cost', async () => {
    const { service: subject } = service(
      readySellingPrice({ totalFullyLoadedUnitCost: Number.POSITIVE_INFINITY }),
    );
    const result = await subject.deriveForProduct('P');
    expect(result.issues[0].code).toBe('UNIT_COST_INVALID');
  });

  it('fails closed when a ready upstream result has no authoritative selling price', async () => {
    const { service: subject } = service(readySellingPrice({ sellingPrice: null }));
    const result = await subject.deriveForProduct('P');

    expect(result.status).toBe('not-ready');
    expect(result.issues[0].code).toBe('SELLING_PRICE_INVALID');
  });

  it('fails closed for invalid ready selling price', async () => {
    const { service: subject } = service(readySellingPrice({ sellingPrice: -1 }));
    const result = await subject.deriveForProduct('P');
    expect(result.issues[0].code).toBe('SELLING_PRICE_INVALID');
  });

  it('fails closed when ready upstream evidence has no pricing policy', async () => {
    const { service: subject } = service(readySellingPrice({ pricingPolicy: null }));
    const result = await subject.deriveForProduct('P');

    expect(result.status).toBe('not-ready');
    expect(result.issues[0].code).toBe('PRICING_POLICY_MISSING');
  });

  it('fails closed for a corrupted pricing policy and preserves its pricing error code', async () => {
    const corruptedPolicy = { method: 'margin-percent', value: 1 } as PricingPolicy;
    const { service: subject } = service(readySellingPrice({ pricingPolicy: corruptedPolicy }));
    const result = await subject.deriveForProduct('P');

    expect(result.status).toBe('not-ready');
    expect(result.issues[0]).toMatchObject({
      code: 'PRICING_POLICY_INVALID',
      underlyingCode: 'INVALID_MARGIN_RATE',
    });
  });

  it('uses the authoritative upstream selling price instead of re-deriving it', async () => {
    const { service: subject } = service(
      readySellingPrice({
        pricingPolicy: { method: 'markup-percent', value: 0.5 },
        sellingPrice: 140,
      }),
    );
    const result = await subject.deriveForProduct('P');

    expect(result.status).toBe('ready');
    expect(result.sellingPrice).toBe(140);
    expect(result.profitPerUnit).toBe(40);
    expect(result.effectiveMarkup).toBe(0.4);
    expect(result.effectiveMargin).toBeCloseTo(40 / 140, 12);
  });

  it('keeps archived Products inspectable when upstream evidence is ready', async () => {
    const { service: subject } = service(readySellingPrice({ productIsActive: false }));
    const result = await subject.deriveForProduct('P');

    expect(result.status).toBe('ready');
    expect(result.productIsActive).toBe(false);
    expect(result.profitPerUnit).toBe(20);
  });

  it('defensively clones pricing-policy and upstream-issue evidence', async () => {
    const upstreamIssue: SellingPriceDerivationIssue = {
      code: 'COST_PARTIAL',
      message: 'original upstream issue',
      productId: 'P',
    };
    const source = readySellingPrice({
      pricingPolicy: { method: 'markup-percent', value: 0.2 },
      sellingPrice: 120,
      issues: [upstreamIssue],
    });
    const { service: subject } = service(source);
    const result = await subject.deriveForProduct('P');

    if (!source.pricingPolicy || !result.pricingPolicy) {
      throw new Error('Expected pricing policy evidence.');
    }
    source.pricingPolicy.value = 99;
    source.issues[0].message = 'mutated upstream issue';

    expect(result.pricingPolicy.value).toBe(0.2);
    expect(result.upstreamIssues[0].message).toBe('original upstream issue');
  });
});
