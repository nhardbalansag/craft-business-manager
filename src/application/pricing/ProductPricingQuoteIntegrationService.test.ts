import { describe, expect, it } from 'vitest';
import type { ProductPriceTierQuoteResult } from '../productPriceTiers/ProductPriceTierQuoteService';
import type { ProductPricingQuoteResult } from './ProductPricingQuoteService';
import {
  ProductPricingQuoteIntegrationService,
  type ProductPricingQuoteIntegrationDefaultProvider,
  type ProductPricingQuoteIntegrationTierProvider,
} from './ProductPricingQuoteIntegrationService';

function defaultQuote(
  overrides: Partial<ProductPricingQuoteResult> = {},
): ProductPricingQuoteResult {
  return {
    productId: 'P',
    productName: 'Product P',
    productIsActive: true,
    status: 'ready',
    costStatus: 'ready',
    sellingPriceStatus: 'ready',
    metricsStatus: 'ready',
    financialProfile: null,
    fullyLoadedUnitCost: {
      productId: 'P',
      productName: 'Product P',
      productIsActive: true,
      status: 'ready',
      directMaterialCost: null,
      directMaterialMode: 'neutral-component-only',
      directMaterialCostSubtotal: 0,
      materialComponentCostSubtotal: 0,
      productComponentCostSubtotal: 0,
      inputMaterialComponentSubtotal: 0,
      laborCostPerUnit: 30,
      overheadCostPerUnit: 20,
      knownFullyLoadedUnitCostSubtotal: 50,
      totalFullyLoadedUnitCost: 50,
      componentLines: [],
      issues: [],
    },
    unitEconomics: {
      productId: 'P',
      productName: 'Product P',
      productIsActive: true,
      status: 'ready',
      sellingPriceStatus: 'ready',
      costStatus: 'ready',
      totalFullyLoadedUnitCost: 50,
      knownFullyLoadedUnitCostSubtotal: 50,
      sellingPrice: 70,
      pricingPolicy: { method: 'profit-amount', value: 20 },
      profitPerUnit: 20,
      effectiveMarkup: 0.4,
      effectiveMargin: 20 / 70,
      reconciliation: {
        totalFullyLoadedUnitCost: 50,
        profitPerUnit: 20,
        recomposedSellingPrice: 70,
        sellingPrice: 70,
        reconciliationDifference: 0,
      },
      upstreamIssues: [],
      issues: [],
    },
    knownFullyLoadedUnitCostSubtotal: 50,
    totalFullyLoadedUnitCost: 50,
    pricingPolicy: { method: 'profit-amount', value: 20 },
    sellingPrice: 70,
    profitPerUnit: 20,
    effectiveMarkup: 0.4,
    effectiveMargin: 20 / 70,
    issues: [],
    ...overrides,
  };
}

function tierQuote(
  overrides: Partial<ProductPriceTierQuoteResult> = {},
): ProductPriceTierQuoteResult {
  return {
    productId: 'P',
    productName: 'Product P',
    productIsActive: true,
    status: 'ready',
    costStatus: 'ready',
    defaultPricingStatus: 'ready',
    defaultSellingPrice: 70,
    knownFullyLoadedUnitCostSubtotal: 50,
    totalFullyLoadedUnitCost: 50,
    fullyLoadedUnitCost: structuredClone(defaultQuote().fullyLoadedUnitCost),
    tiers: [{
      tier: {
        id: 'TIER-0001',
        productId: 'P',
        name: 'Bulk 20+',
        kind: 'bulk',
        priceBasis: 'per-unit',
        priceAmount: 60,
        unitsPerOffer: 1,
        minimumOrderQuantity: 20,
        additionalCostPerOffer: 0,
        isActive: true,
      },
      status: 'ready',
      economics: {
        fullyLoadedUnitCost: 50,
        unitsPerOffer: 1,
        baseOfferCost: 50,
        additionalCostPerOffer: 0,
        totalOfferCost: 50,
        offerSellingPrice: 60,
        effectiveUnitSellingPrice: 60,
        profitPerOffer: 10,
        effectiveProfitPerUnit: 10,
        effectiveMarkup: 0.2,
        effectiveMargin: 1 / 6,
      },
      defaultComparison: {
        defaultSellingPrice: 70,
        defaultEquivalentOfferPrice: 70,
        discountAmountVsDefault: 10,
        discountRateVsDefault: 1 / 7,
      },
      belowCost: false,
      warnings: [],
      issues: [],
    }],
    issues: [],
    ...overrides,
  };
}

class DefaultProvider implements ProductPricingQuoteIntegrationDefaultProvider {
  readonly calls: string[] = [];
  constructor(readonly result: ProductPricingQuoteResult) {}

  async quoteProduct(productId: string): Promise<ProductPricingQuoteResult> {
    this.calls.push(productId);
    return this.result;
  }
}

class TierProvider implements ProductPricingQuoteIntegrationTierProvider {
  readonly calls: string[] = [];
  error: Error | null = null;

  constructor(readonly result: ProductPriceTierQuoteResult) {}

  async quoteProduct(productId: string): Promise<ProductPriceTierQuoteResult> {
    this.calls.push(productId);
    if (this.error) throw this.error;
    return this.result;
  }
}

describe('TP7 ProductPricingQuoteIntegrationService', () => {
  it('preserves every Default / Single field while exposing tier alternatives additively', async () => {
    const base = defaultQuote();
    const alternatives = tierQuote();
    const defaults = new DefaultProvider(base);
    const tiers = new TierProvider(alternatives);
    const service = new ProductPricingQuoteIntegrationService(defaults, tiers);

    const result = await service.quoteProduct(' P ');

    expect(result.productId).toBe(base.productId);
    expect(result.status).toBe(base.status);
    expect(result.sellingPrice).toBe(70);
    expect(result.profitPerUnit).toBe(20);
    expect(result.effectiveMarkup).toBe(0.4);
    expect(result.effectiveMargin).toBe(20 / 70);
    expect(result.pricingPolicy).toEqual(base.pricingPolicy);
    expect(result.tierPricing).toEqual(alternatives);
    expect(result.integrationIssues).toEqual([]);
    expect(defaults.calls).toEqual([' P ']);
    expect(tiers.calls).toEqual(['P']);
  });

  it('exposes an empty alternative set without changing Default / Single semantics', async () => {
    const service = new ProductPricingQuoteIntegrationService(
      new DefaultProvider(defaultQuote()),
      new TierProvider(tierQuote({ tiers: [] })),
    );

    const result = await service.quoteProduct('P');

    expect(result.sellingPrice).toBe(70);
    expect(result.tierPricing?.tiers).toEqual([]);
    expect(result.integrationIssues).toEqual([]);
  });

  it('keeps the Default / Single quote available when the tier boundary fails', async () => {
    const tiers = new TierProvider(tierQuote());
    tiers.error = new Error('Tier repository unavailable');
    const service = new ProductPricingQuoteIntegrationService(
      new DefaultProvider(defaultQuote()),
      tiers,
    );

    const result = await service.quoteProduct('P');

    expect(result.status).toBe('ready');
    expect(result.sellingPrice).toBe(70);
    expect(result.tierPricing).toBeNull();
    expect(result.integrationIssues).toEqual([{
      code: 'TIER_PRICING_UNAVAILABLE',
      message: 'Tier repository unavailable',
      productId: 'P',
    }]);
  });

  it('fails the additive tier evidence closed when Product identity contradicts Default / Single', async () => {
    const service = new ProductPricingQuoteIntegrationService(
      new DefaultProvider(defaultQuote()),
      new TierProvider(tierQuote({ productId: 'OTHER' })),
    );

    const result = await service.quoteProduct('P');

    expect(result.sellingPrice).toBe(70);
    expect(result.tierPricing).toBeNull();
    expect(result.integrationIssues[0]).toMatchObject({
      code: 'TIER_PRICING_PRODUCT_MISMATCH',
      productId: 'P',
    });
  });

  it('returns defensive integrated evidence', async () => {
    const base = defaultQuote();
    const alternatives = tierQuote();
    const service = new ProductPricingQuoteIntegrationService(
      new DefaultProvider(base),
      new TierProvider(alternatives),
    );

    const result = await service.quoteProduct('P');
    result.fullyLoadedUnitCost.productName = 'mutated';
    result.tierPricing!.tiers[0]!.tier.name = 'mutated';

    expect(base.fullyLoadedUnitCost.productName).toBe('Product P');
    expect(alternatives.tiers[0]!.tier.name).toBe('Bulk 20+');
  });
});
