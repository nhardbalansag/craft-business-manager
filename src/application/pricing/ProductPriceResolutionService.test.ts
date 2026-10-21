import { describe, expect, it } from 'vitest';
import type { ProductPriceTierQuoteLine } from '../productPriceTiers/ProductPriceTierQuoteService';
import type { ProductPricingQuoteResult } from './ProductPricingQuoteService';
import type { IntegratedProductPricingQuoteResult } from './ProductPricingQuoteIntegrationService';
import {
  ProductPriceResolutionService,
  type ProductPriceResolutionQuoteProvider,
} from './ProductPriceResolutionService';

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

function tierLine(
  overrides: Partial<ProductPriceTierQuoteLine> = {},
): ProductPriceTierQuoteLine {
  return {
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
    ...overrides,
  };
}

function integratedQuote(
  overrides: Partial<IntegratedProductPricingQuoteResult> = {},
  tiers: ProductPriceTierQuoteLine[] = [tierLine()],
): IntegratedProductPricingQuoteResult {
  const defaults = defaultQuote();

  return {
    ...defaults,
    tierPricing: {
      productId: 'P',
      productName: 'Product P',
      productIsActive: true,
      status: 'ready',
      costStatus: 'ready',
      defaultPricingStatus: defaults.status,
      defaultSellingPrice: defaults.sellingPrice,
      knownFullyLoadedUnitCostSubtotal: 50,
      totalFullyLoadedUnitCost: 50,
      fullyLoadedUnitCost: structuredClone(defaults.fullyLoadedUnitCost),
      tiers,
      issues: [],
    },
    integrationIssues: [],
    ...overrides,
  };
}

class QuoteProvider implements ProductPriceResolutionQuoteProvider {
  readonly calls: string[] = [];

  constructor(readonly result: IntegratedProductPricingQuoteResult) {}

  async quoteProduct(productId: string): Promise<IntegratedProductPricingQuoteResult> {
    this.calls.push(productId);
    return this.result;
  }
}

describe('TP8C ProductPriceResolutionService', () => {
  it('resolves Default / Single when no tier ID is supplied even when a cheaper tier is eligible', async () => {
    const quote = integratedQuote({}, [
      tierLine(),
      tierLine({
        tier: {
          ...tierLine().tier,
          id: 'TIER-0002',
          name: 'Bulk 30+',
          priceAmount: 50,
          minimumOrderQuantity: 30,
        },
        economics: {
          ...tierLine().economics!,
          offerSellingPrice: 50,
          effectiveUnitSellingPrice: 50,
          profitPerOffer: 0,
          effectiveProfitPerUnit: 0,
          effectiveMarkup: 0,
          effectiveMargin: 0,
        },
      }),
    ]);
    const provider = new QuoteProvider(quote);
    const service = new ProductPriceResolutionService(provider);

    const result = await service.resolve({
      productId: ' P ',
      quantity: 30,
    });

    expect(provider.calls).toEqual(['P']);
    expect(result).toMatchObject({
      mode: 'default',
      selectedTierId: null,
      status: 'ready',
      offerCount: 30,
      unitSellingPrice: 70,
      totalSellingPrice: 2100,
      eligibleTierIds: ['TIER-0001', 'TIER-0002'],
    });
    expect(result.selectedTier).toBeNull();
    expect(result.warnings).toEqual([]);
    expect(result.issues).toEqual([]);
  });

  it('resolves exactly the explicitly selected per-unit tier without ranking alternatives', async () => {
    const service = new ProductPriceResolutionService(
      new QuoteProvider(
        integratedQuote({}, [
          tierLine({
            tier: {
              ...tierLine().tier,
              id: 'TIER-0001',
              priceAmount: 55,
            },
            economics: {
              ...tierLine().economics!,
              offerSellingPrice: 55,
              effectiveUnitSellingPrice: 55,
            },
          }),
          tierLine({
            tier: {
              ...tierLine().tier,
              id: 'TIER-0002',
              name: 'Higher Price',
              priceAmount: 60,
            },
          }),
        ]),
      ),
    );

    const result = await service.resolve({
      productId: 'P',
      quantity: 20,
      selectedTierId: ' tier-0002 ',
    });

    expect(result).toMatchObject({
      mode: 'explicit-tier',
      selectedTierId: 'TIER-0002',
      status: 'ready',
      offerCount: 20,
      unitSellingPrice: 60,
      totalSellingPrice: 1200,
      eligibleTierIds: ['TIER-0001', 'TIER-0002'],
    });
    expect(result.selectedTier?.tier.id).toBe('TIER-0002');
  });

  it('resolves an explicit per-offer Package only for complete offers', async () => {
    const packageTier = tierLine({
      tier: {
        id: 'TIER-0003',
        productId: 'P',
        name: 'Package 6',
        kind: 'package',
        priceBasis: 'per-offer',
        priceAmount: 300,
        unitsPerOffer: 6,
        minimumOrderQuantity: 6,
        additionalCostPerOffer: 12,
        isActive: true,
      },
      economics: {
        fullyLoadedUnitCost: 40,
        unitsPerOffer: 6,
        baseOfferCost: 240,
        additionalCostPerOffer: 12,
        totalOfferCost: 252,
        offerSellingPrice: 300,
        effectiveUnitSellingPrice: 50,
        profitPerOffer: 48,
        effectiveProfitPerUnit: 8,
        effectiveMarkup: 48 / 252,
        effectiveMargin: 0.16,
      },
      defaultComparison: null,
    });

    const service = new ProductPriceResolutionService(
      new QuoteProvider(integratedQuote({}, [packageTier])),
    );

    const result = await service.resolve({
      productId: 'P',
      quantity: 12,
      selectedTierId: 'TIER-0003',
    });

    expect(result).toMatchObject({
      status: 'ready',
      offerCount: 2,
      unitSellingPrice: 50,
      totalSellingPrice: 600,
    });
  });

  it('fails a non-divisible explicit Package closed instead of mixing a Default remainder', async () => {
    const packageTier = tierLine({
      tier: {
        id: 'TIER-PACK',
        productId: 'P',
        name: 'Package 6',
        kind: 'package',
        priceBasis: 'per-offer',
        priceAmount: 300,
        unitsPerOffer: 6,
        minimumOrderQuantity: 6,
        additionalCostPerOffer: 0,
        isActive: true,
      },
      economics: {
        ...tierLine().economics!,
        unitsPerOffer: 6,
        offerSellingPrice: 300,
        effectiveUnitSellingPrice: 50,
      },
    });
    const service = new ProductPriceResolutionService(
      new QuoteProvider(integratedQuote({}, [packageTier])),
    );

    const result = await service.resolve({
      productId: 'P',
      quantity: 7,
      selectedTierId: 'TIER-PACK',
    });

    expect(result.status).toBe('not-ready');
    expect(result.unitSellingPrice).toBeNull();
    expect(result.totalSellingPrice).toBeNull();
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'SELECTED_TIER_INELIGIBLE',
        tierId: 'TIER-PACK',
      }),
    ]);
    expect(result.tierEligibility[0]?.issues.map((issue) => issue.code)).toEqual([
      'QUANTITY_NOT_OFFER_MULTIPLE',
    ]);
  });

  it('fails an archived selected tier closed', async () => {
    const archived = tierLine({
      tier: {
        ...tierLine().tier,
        isActive: false,
      },
    });
    const service = new ProductPriceResolutionService(
      new QuoteProvider(integratedQuote({}, [archived])),
    );

    const result = await service.resolve({
      productId: 'P',
      quantity: 20,
      selectedTierId: 'TIER-0001',
    });

    expect(result.status).toBe('not-ready');
    expect(result.eligibleTierIds).toEqual([]);
    expect(result.tierEligibility[0]?.issues.map((issue) => issue.code)).toEqual([
      'TIER_INACTIVE',
    ]);
    expect(result.issues[0]?.code).toBe('SELECTED_TIER_INELIGIBLE');
  });

  it('fails a missing explicit tier ID without falling back to Default / Single', async () => {
    const service = new ProductPriceResolutionService(
      new QuoteProvider(integratedQuote()),
    );

    const result = await service.resolve({
      productId: 'P',
      quantity: 20,
      selectedTierId: 'TIER-9999',
    });

    expect(result.mode).toBe('explicit-tier');
    expect(result.status).toBe('not-ready');
    expect(result.unitSellingPrice).toBeNull();
    expect(result.totalSellingPrice).toBeNull();
    expect(result.issues[0]?.code).toBe('SELECTED_TIER_NOT_FOUND');
  });

  it('keeps Default / Single resolvable when tier pricing is unavailable', async () => {
    const quote = integratedQuote({
      tierPricing: null,
      integrationIssues: [{
        code: 'TIER_PRICING_UNAVAILABLE',
        message: 'Tier repository unavailable',
        productId: 'P',
      }],
    });
    const service = new ProductPriceResolutionService(new QuoteProvider(quote));

    const result = await service.resolve({
      productId: 'P',
      quantity: 3,
    });

    expect(result).toMatchObject({
      status: 'ready',
      mode: 'default',
      unitSellingPrice: 70,
      totalSellingPrice: 210,
      eligibleTierIds: [],
    });
  });

  it('fails explicit tier resolution when integrated tier pricing is unavailable', async () => {
    const quote = integratedQuote({
      tierPricing: null,
      integrationIssues: [{
        code: 'TIER_PRICING_UNAVAILABLE',
        message: 'Tier repository unavailable',
        productId: 'P',
      }],
    });
    const service = new ProductPriceResolutionService(new QuoteProvider(quote));

    const result = await service.resolve({
      productId: 'P',
      quantity: 20,
      selectedTierId: 'TIER-0001',
    });

    expect(result.status).toBe('not-ready');
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'TIER_PRICING_UNAVAILABLE',
        message: 'Tier repository unavailable',
      }),
    ]);
  });

  it('allows tier economics when only Default comparison readiness is unavailable', async () => {
    const partialTier = tierLine({
      status: 'partial',
      defaultComparison: null,
      issues: [{
        code: 'DEFAULT_QUOTE_NOT_READY',
        message: 'Default comparison unavailable',
        productId: 'P',
        tierId: 'TIER-0001',
      }],
    });
    const quote = integratedQuote(
      {
        status: 'not-ready',
        sellingPriceStatus: 'not-ready',
        sellingPrice: null,
      },
      [partialTier],
    );
    const service = new ProductPriceResolutionService(new QuoteProvider(quote));

    const result = await service.resolve({
      productId: 'P',
      quantity: 20,
      selectedTierId: 'TIER-0001',
    });

    expect(result).toMatchObject({
      status: 'ready',
      mode: 'explicit-tier',
      unitSellingPrice: 60,
      totalSellingPrice: 1200,
    });
  });

  it('preserves a selected tier below-cost warning in resolved evidence', async () => {
    const belowCost = tierLine({
      economics: {
        ...tierLine().economics!,
        fullyLoadedUnitCost: 70,
        baseOfferCost: 70,
        totalOfferCost: 70,
        offerSellingPrice: 60,
        effectiveUnitSellingPrice: 60,
        profitPerOffer: -10,
        effectiveProfitPerUnit: -10,
        effectiveMarkup: -10 / 70,
        effectiveMargin: -1 / 6,
      },
      belowCost: true,
      warnings: [{
        code: 'BELOW_COST',
        message: 'This tier sells below cost.',
        productId: 'P',
        tierId: 'TIER-0001',
      }],
    });
    const service = new ProductPriceResolutionService(
      new QuoteProvider(integratedQuote({}, [belowCost])),
    );

    const result = await service.resolve({
      productId: 'P',
      quantity: 20,
      selectedTierId: 'TIER-0001',
    });

    expect(result.status).toBe('ready');
    expect(result.warnings).toEqual([{
      code: 'BELOW_COST',
      message: 'This tier sells below cost.',
      productId: 'P',
      tierId: 'TIER-0001',
    }]);
  });

  it('rejects invalid order quantity before applying Default or explicit tier pricing', async () => {
    const service = new ProductPriceResolutionService(
      new QuoteProvider(integratedQuote()),
    );

    const result = await service.resolve({
      productId: 'P',
      quantity: 0,
    });

    expect(result.status).toBe('not-ready');
    expect(result.issues[0]?.code).toBe('QUANTITY_NON_POSITIVE');
    expect(result.unitSellingPrice).toBeNull();
    expect(result.totalSellingPrice).toBeNull();
  });

  it('fails closed on requested/integrated Product identity contradiction', async () => {
    const service = new ProductPriceResolutionService(
      new QuoteProvider(integratedQuote()),
    );

    const result = await service.resolve({
      productId: 'OTHER',
      quantity: 20,
    });

    expect(result.status).toBe('not-ready');
    expect(result.issues[0]?.code).toBe('REQUEST_PRODUCT_MISMATCH');
  });

  it('returns defensive resolved evidence', async () => {
    const quote = integratedQuote();
    const service = new ProductPriceResolutionService(new QuoteProvider(quote));

    const result = await service.resolve({
      productId: 'P',
      quantity: 20,
      selectedTierId: 'TIER-0001',
    });

    result.integratedQuote.productName = 'mutated';
    result.selectedTier!.tier.name = 'mutated';
    result.tierEligibility[0]!.tierId = 'mutated';

    expect(quote.productName).toBe('Product P');
    expect(quote.tierPricing!.tiers[0]!.tier.name).toBe('Bulk 20+');
  });
});
