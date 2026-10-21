import { describe, expect, it } from 'vitest';
import type { ProductPriceTier } from '../../domain/productPriceTiers';
import {
  FullyLoadedProductUnitCostServiceError,
  type FullyLoadedProductUnitCostResult,
} from '../productCosts/FullyLoadedProductUnitCostService';
import {
  ProductPriceTierQuoteService,
  ProductPriceTierQuoteServiceError,
  type ProductPriceTierDefaultPricingEvidence,
  type ProductPriceTierDefaultPricingProvider,
  type ProductPriceTierQuoteCostProvider,
  type ProductPriceTierQuoteTierProvider,
} from './ProductPriceTierQuoteService';

function cost(
  status: FullyLoadedProductUnitCostResult['status'] = 'ready',
  overrides: Partial<FullyLoadedProductUnitCostResult> = {},
): FullyLoadedProductUnitCostResult {
  const ready = status === 'ready';
  const known = status === 'not-ready' ? null : 30;

  return {
    productId: 'PROD-A',
    productName: 'Product A',
    productIsActive: true,
    status,
    directMaterialCost: null,
    directMaterialMode: ready ? 'costed' : 'unresolved',
    directMaterialCostSubtotal: ready ? 20 : 0,
    materialComponentCostSubtotal: 0,
    productComponentCostSubtotal: 0,
    inputMaterialComponentSubtotal: ready ? 20 : null,
    laborCostPerUnit: ready ? 5 : null,
    overheadCostPerUnit: ready ? 5 : null,
    knownFullyLoadedUnitCostSubtotal: known,
    totalFullyLoadedUnitCost: ready ? 30 : null,
    componentLines: [],
    issues: status === 'ready'
      ? []
      : [{
          code: status === 'partial'
            ? 'FINANCIAL_PROFILE_MISSING'
            : 'DIRECT_MATERIAL_COST_NOT_READY',
          message: `cost is ${status}`,
          productId: 'PROD-A',
        }],
    ...overrides,
  };
}

function tier(overrides: Partial<ProductPriceTier> = {}): ProductPriceTier {
  return {
    id: 'TIER-0001',
    productId: 'PROD-A',
    name: 'Bulk 20+',
    kind: 'bulk',
    priceBasis: 'per-unit',
    priceAmount: 40,
    unitsPerOffer: 1,
    minimumOrderQuantity: 20,
    additionalCostPerOffer: 0,
    isActive: true,
    ...overrides,
  };
}

function setup(
  costResult: FullyLoadedProductUnitCostResult,
  tiers: ProductPriceTier[],
  defaultQuote: ProductPriceTierDefaultPricingEvidence = {
    productId: 'PROD-A',
    status: 'ready',
    sellingPrice: 50,
  },
) {
  const costs: ProductPriceTierQuoteCostProvider = {
    async costProduct() {
      return costResult;
    },
  };
  const tierProvider: ProductPriceTierQuoteTierProvider = {
    async listTiersByProduct() {
      return tiers;
    },
  };

  const defaultPricing: ProductPriceTierDefaultPricingProvider = {
    async quoteProduct() {
      return defaultQuote;
    },
  };

  return new ProductPriceTierQuoteService(costs, tierProvider, defaultPricing);
}

describe('ProductPriceTierQuoteService', () => {
  it('quotes all tiers from the same authoritative fully loaded unit cost', async () => {
    const service = setup(
      cost('ready'),
      [
        tier(),
        tier({
          id: 'TIER-0002',
          name: 'Package 6',
          kind: 'package',
          priceBasis: 'per-offer',
          priceAmount: 270,
          unitsPerOffer: 6,
          minimumOrderQuantity: 6,
          additionalCostPerOffer: 20,
        }),
      ],
    );

    const result = await service.quoteProduct(' prod-a ');

    expect(result.status).toBe('ready');
    expect(result.costStatus).toBe('ready');
    expect(result.totalFullyLoadedUnitCost).toBe(30);
    expect(result.tiers).toHaveLength(2);

    expect(result.tiers[0]).toMatchObject({
      status: 'ready',
      tier: { id: 'TIER-0001', isActive: true },
      economics: {
        fullyLoadedUnitCost: 30,
        baseOfferCost: 30,
        totalOfferCost: 30,
        offerSellingPrice: 40,
        effectiveUnitSellingPrice: 40,
        profitPerOffer: 10,
        effectiveProfitPerUnit: 10,
      },
      issues: [],
    });

    expect(result.tiers[1]?.economics).toMatchObject({
      fullyLoadedUnitCost: 30,
      unitsPerOffer: 6,
      baseOfferCost: 180,
      additionalCostPerOffer: 20,
      totalOfferCost: 200,
      offerSellingPrice: 270,
      effectiveUnitSellingPrice: 45,
      profitPerOffer: 70,
    });
  });

  it('keeps archived tiers visible and derives their historical economics', async () => {
    const service = setup(
      cost('ready', { productIsActive: false }),
      [tier({ id: 'TIER-OLD', isActive: false, priceAmount: 35 })],
    );

    const result = await service.quoteProduct('PROD-A');

    expect(result.productIsActive).toBe(false);
    expect(result.status).toBe('ready');
    expect(result.tiers[0]?.tier.isActive).toBe(false);
    expect(result.tiers[0]?.status).toBe('ready');
    expect(result.tiers[0]?.economics?.profitPerOffer).toBe(5);
  });

  it('marks below-cost tiers explicitly without rejecting valid tier economics', async () => {
    const service = setup(cost('ready'), [tier({ priceAmount: 20 })]);

    const result = await service.quoteProduct('PROD-A');
    const line = result.tiers[0]!;

    expect(line.status).toBe('ready');
    expect(line.economics?.profitPerOffer).toBe(-10);
    expect(line.economics?.effectiveMarkup).toBeCloseTo(-1 / 3, 12);
    expect(line.belowCost).toBe(true);
    expect(line.warnings).toEqual([
      expect.objectContaining({ code: 'BELOW_COST', tierId: 'TIER-0001' }),
    ]);
    expect(line.issues).toEqual([]);
    expect(line.defaultComparison).toMatchObject({
      defaultSellingPrice: 50,
      defaultEquivalentOfferPrice: 50,
      discountAmountVsDefault: 30,
      discountRateVsDefault: 0.6,
    });
  });


  it('compares a package offer with the Default / Single equivalent at full precision', async () => {
    const service = setup(
      cost('ready'),
      [
        tier({
          id: 'TIER-PACK',
          name: 'Package 6',
          kind: 'package',
          priceBasis: 'per-offer',
          priceAmount: 270,
          unitsPerOffer: 6,
          minimumOrderQuantity: 6,
          additionalCostPerOffer: 20,
        }),
      ],
      { productId: 'PROD-A', status: 'ready', sellingPrice: 50 },
    );

    const line = (await service.quoteProduct('PROD-A')).tiers[0]!;

    expect(line.status).toBe('ready');
    expect(line.defaultComparison).toEqual({
      defaultSellingPrice: 50,
      defaultEquivalentOfferPrice: 300,
      discountAmountVsDefault: 30,
      discountRateVsDefault: 0.1,
    });
    expect(line.belowCost).toBe(false);
    expect(line.warnings).toEqual([]);
  });

  it('preserves negative discount when a tier is more expensive than Default / Single', async () => {
    const line = (
      await setup(
        cost('ready'),
        [tier({ priceAmount: 60 })],
        { productId: 'PROD-A', status: 'ready', sellingPrice: 50 },
      ).quoteProduct('PROD-A')
    ).tiers[0]!;

    expect(line.defaultComparison).toMatchObject({
      defaultEquivalentOfferPrice: 50,
      discountAmountVsDefault: -10,
      discountRateVsDefault: -0.2,
    });
  });

  it('uses null discount rate when the Default / Single equivalent price is zero', async () => {
    const line = (
      await setup(
        cost('ready'),
        [tier({ priceAmount: 0 })],
        { productId: 'PROD-A', status: 'ready', sellingPrice: 0 },
      ).quoteProduct('PROD-A')
    ).tiers[0]!;

    expect(line.defaultComparison).toEqual({
      defaultSellingPrice: 0,
      defaultEquivalentOfferPrice: 0,
      discountAmountVsDefault: 0,
      discountRateVsDefault: null,
    });
    expect(line.belowCost).toBe(true);
  });

  it('keeps ready tier economics but marks comparison partial when Default / Single is partial', async () => {
    const result = await setup(
      cost('ready'),
      [tier()],
      { productId: 'PROD-A', status: 'partial', sellingPrice: null },
    ).quoteProduct('PROD-A');

    expect(result.status).toBe('partial');
    expect(result.defaultPricingStatus).toBe('partial');
    expect(result.defaultSellingPrice).toBeNull();
    expect(result.tiers[0]?.status).toBe('partial');
    expect(result.tiers[0]?.economics).not.toBeNull();
    expect(result.tiers[0]?.defaultComparison).toBeNull();
    expect(result.tiers[0]?.issues).toMatchObject([
      { code: 'DEFAULT_QUOTE_PARTIAL', tierId: 'TIER-0001' },
    ]);
  });

  it('keeps ready tier economics but marks comparison partial when Default / Single is not ready', async () => {
    const result = await setup(
      cost('ready'),
      [tier()],
      { productId: 'PROD-A', status: 'not-ready', sellingPrice: null },
    ).quoteProduct('PROD-A');

    expect(result.status).toBe('partial');
    expect(result.tiers[0]?.status).toBe('partial');
    expect(result.tiers[0]?.economics).not.toBeNull();
    expect(result.tiers[0]?.defaultComparison).toBeNull();
    expect(result.tiers[0]?.issues[0]?.code).toBe('DEFAULT_QUOTE_NOT_READY');
  });

  it('fails closed when Default / Single pricing evidence belongs to another Product', async () => {
    const result = await setup(
      cost('ready'),
      [tier()],
      { productId: 'OTHER', status: 'ready', sellingPrice: 50 },
    ).quoteProduct('PROD-A');

    expect(result.status).toBe('not-ready');
    expect(result.issues.map((issue) => issue.code)).toContain(
      'DEFAULT_QUOTE_PRODUCT_MISMATCH',
    );
    expect(result.tiers[0]?.economics).not.toBeNull();
    expect(result.tiers[0]?.defaultComparison).toBeNull();
    expect(result.tiers[0]?.status).toBe('not-ready');
  });

  it('fails closed when a ready Default / Single quote has an invalid selling price', async () => {
    const result = await setup(
      cost('ready'),
      [tier()],
      { productId: 'PROD-A', status: 'ready', sellingPrice: -1 },
    ).quoteProduct('PROD-A');

    expect(result.status).toBe('not-ready');
    expect(result.issues.map((issue) => issue.code)).toContain(
      'DEFAULT_SELLING_PRICE_INVALID',
    );
    expect(result.tiers[0]?.economics).not.toBeNull();
    expect(result.tiers[0]?.defaultComparison).toBeNull();
  });

  it('returns partial tier quotes when authoritative cost is partial', async () => {
    const service = setup(
      cost('partial', {
        knownFullyLoadedUnitCostSubtotal: 24,
        totalFullyLoadedUnitCost: null,
      }),
      [tier(), tier({ id: 'TIER-0002', name: 'Bulk 50+', minimumOrderQuantity: 50 })],
    );

    const result = await service.quoteProduct('PROD-A');

    expect(result.status).toBe('partial');
    expect(result.knownFullyLoadedUnitCostSubtotal).toBe(24);
    expect(result.totalFullyLoadedUnitCost).toBeNull();
    expect(result.issues.map((issue) => issue.code)).toContain('UPSTREAM_COST_PARTIAL');
    expect(result.tiers.every((line) => line.status === 'partial')).toBe(true);
    expect(result.tiers.every((line) => line.economics === null)).toBe(true);
  });

  it('returns not-ready tier quotes when authoritative cost is not ready', async () => {
    const service = setup(cost('not-ready'), [tier()]);

    const result = await service.quoteProduct('PROD-A');

    expect(result.status).toBe('not-ready');
    expect(result.tiers[0]?.status).toBe('not-ready');
    expect(result.tiers[0]?.economics).toBeNull();
    expect(result.issues.map((issue) => issue.code)).toContain('UPSTREAM_COST_NOT_READY');
  });

  it('treats a ready cost result with no valid total as contradictory', async () => {
    const service = setup(
      cost('ready', {
        totalFullyLoadedUnitCost: null,
        knownFullyLoadedUnitCostSubtotal: 30,
      }),
      [tier()],
    );

    const result = await service.quoteProduct('PROD-A');

    expect(result.status).toBe('not-ready');
    expect(result.issues.map((issue) => issue.code)).toContain('READY_COST_INVALID');
    expect(result.tiers[0]?.status).toBe('not-ready');
    expect(result.tiers[0]?.economics).toBeNull();
  });

  it('fails closed when cost evidence belongs to a different Product', async () => {
    const service = setup(cost('ready', { productId: 'OTHER' }), []);

    const result = await service.quoteProduct('PROD-A');

    expect(result.productId).toBe('OTHER');
    expect(result.status).toBe('not-ready');
    expect(result.issues.map((issue) => issue.code)).toContain('COST_PRODUCT_MISMATCH');
  });

  it('fails closed when a returned tier belongs to another Product', async () => {
    const service = setup(cost('ready'), [tier({ productId: 'OTHER' })]);

    const result = await service.quoteProduct('PROD-A');

    expect(result.status).toBe('not-ready');
    expect(result.tiers[0]?.status).toBe('not-ready');
    expect(result.tiers[0]?.issues).toMatchObject([
      { code: 'TIER_PRODUCT_MISMATCH', tierId: 'TIER-0001' },
    ]);
  });

  it('fails closed when tier source validation prevents economics derivation', async () => {
    const service = setup(
      cost('ready'),
      [
        tier({
          priceBasis: 'per-offer',
          unitsPerOffer: 6,
          minimumOrderQuantity: 5,
        }),
      ],
    );

    const result = await service.quoteProduct('PROD-A');

    expect(result.status).toBe('not-ready');
    expect(result.tiers[0]?.economics).toBeNull();
    expect(result.tiers[0]?.issues[0]).toMatchObject({
      code: 'ECONOMICS_DERIVATION_FAILED',
      underlyingCode: 'MINIMUM_BELOW_OFFER_SIZE',
    });
  });

  it('returns ready with an empty tier collection when Product cost is ready', async () => {
    const result = await setup(cost('ready'), []).quoteProduct('PROD-A');

    expect(result.status).toBe('ready');
    expect(result.tiers).toEqual([]);
    expect(result.issues).toEqual([]);
  });

  it('translates missing Product cost errors to a tier quote service error', async () => {
    const costs: ProductPriceTierQuoteCostProvider = {
      async costProduct(productId) {
        throw new FullyLoadedProductUnitCostServiceError(
          'PRODUCT_NOT_FOUND',
          `Product ${productId} not found.`,
          productId,
        );
      },
    };
    const tiers: ProductPriceTierQuoteTierProvider = {
      async listTiersByProduct() {
        return [];
      },
    };
    const defaultPricing: ProductPriceTierDefaultPricingProvider = {
      async quoteProduct(productId) {
        return { productId, status: 'not-ready', sellingPrice: null };
      },
    };
    const service = new ProductPriceTierQuoteService(costs, tiers, defaultPricing);

    await expect(service.quoteProduct('missing')).rejects.toBeInstanceOf(
      ProductPriceTierQuoteServiceError,
    );
    await expect(service.quoteProduct('missing')).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      productId: 'missing',
    });
  });

  it('defensively clones cost, tier, economics, and issue results', async () => {
    const sourceCost = cost('partial', {
      knownFullyLoadedUnitCostSubtotal: 24,
      issues: [{
        code: 'FINANCIAL_PROFILE_MISSING',
        message: 'missing profile',
        productId: 'PROD-A',
      }],
    });
    const sourceTier = tier();
    const service = setup(sourceCost, [sourceTier]);

    const first = await service.quoteProduct('PROD-A');
    first.fullyLoadedUnitCost.issues[0]!.message = 'mutated';
    first.tiers[0]!.tier.name = 'mutated tier';
    first.tiers[0]!.issues[0]!.message = 'mutated line issue';

    const second = await service.quoteProduct('PROD-A');

    expect(sourceCost.issues[0]?.message).toBe('missing profile');
    expect(sourceTier.name).toBe('Bulk 20+');
    expect(second.fullyLoadedUnitCost.issues[0]?.message).toBe('missing profile');
    expect(second.tiers[0]?.tier.name).toBe('Bulk 20+');
    expect(second.tiers[0]?.issues[0]?.message).not.toBe('mutated line issue');
  });
});
