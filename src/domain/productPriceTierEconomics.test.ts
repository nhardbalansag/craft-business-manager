import { describe, expect, it } from 'vitest';
import { PricingError } from './pricing';
import { ProductPriceTierError, type ProductPriceTier } from './productPriceTiers';
import { deriveProductPriceTierEconomics } from './productPriceTierEconomics';

function tier(overrides: Partial<ProductPriceTier> = {}): ProductPriceTier {
  return {
    id: 'TIER-0001',
    productId: 'PROD-0001',
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

describe('deriveProductPriceTierEconomics', () => {
  it('derives per-unit bulk economics without rounding', () => {
    const result = deriveProductPriceTierEconomics(
      31.125,
      tier({ priceAmount: 40.75 }),
    );

    expect(result).toEqual({
      fullyLoadedUnitCost: 31.125,
      unitsPerOffer: 1,
      baseOfferCost: 31.125,
      additionalCostPerOffer: 0,
      totalOfferCost: 31.125,
      offerSellingPrice: 40.75,
      effectiveUnitSellingPrice: 40.75,
      profitPerOffer: 9.625,
      effectiveProfitPerUnit: 9.625,
      effectiveMarkup: 9.625 / 31.125,
      effectiveMargin: 9.625 / 40.75,
    });
  });

  it('derives package per-offer economics including additional package cost', () => {
    const result = deriveProductPriceTierEconomics(
      30,
      tier({
        name: 'Package 6',
        kind: 'package',
        priceBasis: 'per-offer',
        priceAmount: 270,
        unitsPerOffer: 6,
        minimumOrderQuantity: 6,
        additionalCostPerOffer: 20,
      }),
    );

    expect(result.baseOfferCost).toBe(180);
    expect(result.totalOfferCost).toBe(200);
    expect(result.offerSellingPrice).toBe(270);
    expect(result.effectiveUnitSellingPrice).toBe(45);
    expect(result.profitPerOffer).toBe(70);
    expect(result.effectiveProfitPerUnit).toBeCloseTo(70 / 6, 12);
    expect(result.effectiveMarkup).toBeCloseTo(0.35, 12);
    expect(result.effectiveMargin).toBeCloseTo(70 / 270, 12);
  });

  it('derives custom per-offer economics at full precision', () => {
    const result = deriveProductPriceTierEconomics(
      22.345,
      tier({
        name: 'Party Pack',
        kind: 'custom',
        priceBasis: 'per-offer',
        priceAmount: 500,
        unitsPerOffer: 12,
        minimumOrderQuantity: 12,
        additionalCostPerOffer: 18.75,
      }),
    );

    expect(result.baseOfferCost).toBeCloseTo(22.345 * 12, 12);
    expect(result.totalOfferCost).toBeCloseTo(22.345 * 12 + 18.75, 12);
    expect(result.effectiveUnitSellingPrice).toBeCloseTo(500 / 12, 12);
    expect(result.profitPerOffer).toBeCloseTo(
      500 - (22.345 * 12 + 18.75),
      12,
    );
  });

  it('returns null markup only when total offer cost is zero', () => {
    const zeroCost = deriveProductPriceTierEconomics(
      0,
      tier({ priceAmount: 10, additionalCostPerOffer: 0 }),
    );
    expect(zeroCost.totalOfferCost).toBe(0);
    expect(zeroCost.effectiveMarkup).toBeNull();
    expect(zeroCost.effectiveMargin).toBe(1);

    const additionalCost = deriveProductPriceTierEconomics(
      0,
      tier({ priceAmount: 10, additionalCostPerOffer: 2 }),
    );
    expect(additionalCost.totalOfferCost).toBe(2);
    expect(additionalCost.effectiveMarkup).toBe(4);
  });

  it('returns null margin only when offer selling price is zero', () => {
    const result = deriveProductPriceTierEconomics(
      25,
      tier({ priceAmount: 0 }),
    );

    expect(result.offerSellingPrice).toBe(0);
    expect(result.profitPerOffer).toBe(-25);
    expect(result.effectiveProfitPerUnit).toBe(-25);
    expect(result.effectiveMarkup).toBe(-1);
    expect(result.effectiveMargin).toBeNull();
  });

  it('permits negative profit so below-cost pricing can be diagnosed later', () => {
    const result = deriveProductPriceTierEconomics(
      50,
      tier({ priceAmount: 40 }),
    );

    expect(result.profitPerOffer).toBe(-10);
    expect(result.effectiveProfitPerUnit).toBe(-10);
    expect(result.effectiveMarkup).toBe(-0.2);
    expect(result.effectiveMargin).toBe(-0.25);
  });

  it('validates authoritative unit cost using the existing pricing contract', () => {
    expect(() => deriveProductPriceTierEconomics(-1, tier())).toThrowError(PricingError);
    expect(() => deriveProductPriceTierEconomics(Number.NaN, tier())).toThrowError(PricingError);
    expect(() => deriveProductPriceTierEconomics(Number.POSITIVE_INFINITY, tier())).toThrowError(
      PricingError,
    );
  });

  it('validates the tier source contract before deriving economics', () => {
    expect(() =>
      deriveProductPriceTierEconomics(
        20,
        tier({
          priceBasis: 'per-offer',
          unitsPerOffer: 6,
          minimumOrderQuantity: 5,
        }),
      ),
    ).toThrowError(ProductPriceTierError);
  });

  it('does not mutate the source tier', () => {
    const source = tier({
      name: 'Package 6',
      kind: 'package',
      priceBasis: 'per-offer',
      priceAmount: 270,
      unitsPerOffer: 6,
      minimumOrderQuantity: 6,
      additionalCostPerOffer: 20,
    });
    const snapshot = { ...source };

    deriveProductPriceTierEconomics(30, source);

    expect(source).toEqual(snapshot);
  });
});
