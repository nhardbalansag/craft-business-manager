import { describe, expect, it } from 'vitest';
import {
  cloneProductPriceTier,
  isProductPriceTierKind,
  isProductPriceTierPriceBasis,
  normalizeProductPriceTier,
  nextProductPriceTierId,
  nextProductPriceTierId,
  PRODUCT_PRICE_TIER_KINDS,
  PRODUCT_PRICE_TIER_PRICE_BASES,
  ProductPriceTierError,
  type ProductPriceTier,
  validateProductPriceTierContract,
} from './productPriceTiers';

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

describe('ProductPriceTier stable IDs', () => {
  it('uses the TIER-0001 convention when no numeric tier IDs exist', () => {
    const existingIds = ['WHOLESALE-OLD', 'TIER-EVENT', 'CUSTOM-0007'];

    expect(nextProductPriceTierId(existingIds)).toBe('TIER-0001');
    expect(existingIds).toEqual(['WHOLESALE-OLD', 'TIER-EVENT', 'CUSTOM-0007']);
  });

  it('continues after the highest numeric TIER identifier while ignoring legacy/custom IDs', () => {
    expect(
      nextProductPriceTierId([
        'TIER-0002',
        'tier-0010',
        'TIER-PREMIUM',
        'WHOLESALE-0042',
        'CUSTOM-EVENT',
      ]),
    ).toBe('TIER-0011');
  });

  it('keeps explicit legacy/custom tier IDs valid at the domain boundary', () => {
    expect(() => validateProductPriceTierContract(tier({ id: 'WHOLESALE-OLD' }))).not.toThrow();
    expect(() => validateProductPriceTierContract(tier({ id: 'tier-event-vip' }))).not.toThrow();
  });
});

describe('ProductPriceTier contract', () => {
  it('exposes only the planned tier kinds and price bases', () => {
    expect(PRODUCT_PRICE_TIER_KINDS).toEqual(['package', 'bulk', 'custom']);
    expect(PRODUCT_PRICE_TIER_PRICE_BASES).toEqual(['per-unit', 'per-offer']);

    expect(isProductPriceTierKind('package')).toBe(true);
    expect(isProductPriceTierKind('bulk')).toBe(true);
    expect(isProductPriceTierKind('custom')).toBe(true);
    expect(isProductPriceTierKind('single')).toBe(false);

    expect(isProductPriceTierPriceBasis('per-unit')).toBe(true);
    expect(isProductPriceTierPriceBasis('per-offer')).toBe(true);
    expect(isProductPriceTierPriceBasis('fixed')).toBe(false);
  });

  it('allocates TIER-0001 when only legacy/custom explicit IDs exist', () => {
    const existingIds = ['WHOLESALE', 'TIER-CUSTOM', 'LEGACY-PRICE-7'];

    expect(nextProductPriceTierId(existingIds)).toBe('TIER-0001');
    expect(existingIds).toEqual(['WHOLESALE', 'TIER-CUSTOM', 'LEGACY-PRICE-7']);
  });

  it('continues after the highest matching numeric tier ID across mixed IDs', () => {
    expect(
      nextProductPriceTierId([
        'TIER-0002',
        'tier-0010',
        'TIER-CUSTOM',
        'WHOLESALE-2026',
        'TIER-0007',
      ]),
    ).toBe('TIER-0011');
  });

  it('allows explicit legacy/custom tier IDs at the domain contract boundary', () => {
    expect(() => validateProductPriceTierContract(tier({ id: 'EVENT-PARTNER-PRICE' }))).not.toThrow();
    expect(() => validateProductPriceTierContract(tier({ id: 'tier-custom-alpha' }))).not.toThrow();
  });

  it('accepts a per-unit bulk tier', () => {
    expect(() => validateProductPriceTierContract(tier())).not.toThrow();
  });

  it('accepts a per-offer package tier', () => {
    expect(() =>
      validateProductPriceTierContract(
        tier({
          name: '6-piece Package',
          kind: 'package',
          priceBasis: 'per-offer',
          priceAmount: 270,
          unitsPerOffer: 6,
          minimumOrderQuantity: 6,
          additionalCostPerOffer: 20,
        }),
      ),
    ).not.toThrow();
  });

  it('accepts a custom per-offer tier with a higher minimum that is a whole offer multiple', () => {
    expect(() =>
      validateProductPriceTierContract(
        tier({
          name: 'Event Partner Pack',
          kind: 'custom',
          priceBasis: 'per-offer',
          priceAmount: 500,
          unitsPerOffer: 12,
          minimumOrderQuantity: 24,
        }),
      ),
    ).not.toThrow();
  });

  it('accepts explicit zero price and zero additional offer cost as source facts', () => {
    expect(() =>
      validateProductPriceTierContract(
        tier({
          priceAmount: 0,
          additionalCostPerOffer: 0,
        }),
      ),
    ).not.toThrow();
  });

  it('normalizes textual identities/name/notes without changing numeric source values', () => {
    expect(
      normalizeProductPriceTier(
        tier({
          id: '  TIER-0042  ',
          productId: '  PROD-CANDLE  ',
          name: '  Event Package  ',
          priceAmount: 275.125,
          additionalCostPerOffer: 17.75,
          notes: '  includes gift box  ',
        }),
      ),
    ).toEqual({
      ...tier(),
      id: 'TIER-0042',
      productId: 'PROD-CANDLE',
      name: 'Event Package',
      priceAmount: 275.125,
      additionalCostPerOffer: 17.75,
      notes: 'includes gift box',
    });
  });

  it('omits blank normalized notes', () => {
    expect(normalizeProductPriceTier(tier({ notes: '   ' }))).toEqual({
      ...tier(),
      notes: undefined,
    });
  });

  it('defensively clones source records', () => {
    const original = tier({ notes: 'original' });
    const cloned = cloneProductPriceTier(original);

    cloned.name = 'Changed';
    cloned.priceAmount = 10;
    cloned.notes = 'changed';

    expect(original).toEqual(tier({ notes: 'original' }));
  });

  it('rejects blank tier, Product, and name fields', () => {
    expect(() => validateProductPriceTierContract(tier({ id: '   ' }))).toThrowError(
      expect.objectContaining<Partial<ProductPriceTierError>>({ code: 'INVALID_ID' }),
    );
    expect(() => validateProductPriceTierContract(tier({ productId: '\t' }))).toThrowError(
      expect.objectContaining<Partial<ProductPriceTierError>>({ code: 'INVALID_PRODUCT_ID' }),
    );
    expect(() => validateProductPriceTierContract(tier({ name: ' ' }))).toThrowError(
      expect.objectContaining<Partial<ProductPriceTierError>>({ code: 'INVALID_NAME' }),
    );
  });

  it('rejects unsupported tier kinds and price bases at runtime', () => {
    expect(() =>
      validateProductPriceTierContract(
        tier({ kind: 'single' as ProductPriceTier['kind'] }),
      ),
    ).toThrowError(
      expect.objectContaining<Partial<ProductPriceTierError>>({ code: 'INVALID_KIND' }),
    );

    expect(() =>
      validateProductPriceTierContract(
        tier({ priceBasis: 'fixed' as ProductPriceTier['priceBasis'] }),
      ),
    ).toThrowError(
      expect.objectContaining<Partial<ProductPriceTierError>>({ code: 'INVALID_PRICE_BASIS' }),
    );
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects non-finite price amount %s',
    (priceAmount) => {
      expect(() => validateProductPriceTierContract(tier({ priceAmount }))).toThrowError(
        expect.objectContaining<Partial<ProductPriceTierError>>({
          code: 'NON_FINITE_PRICE_AMOUNT',
        }),
      );
    },
  );

  it('rejects negative price amount', () => {
    expect(() => validateProductPriceTierContract(tier({ priceAmount: -0.01 }))).toThrowError(
      expect.objectContaining<Partial<ProductPriceTierError>>({ code: 'NEGATIVE_PRICE_AMOUNT' }),
    );
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects non-finite units per offer %s',
    (unitsPerOffer) => {
      expect(() => validateProductPriceTierContract(tier({ unitsPerOffer }))).toThrowError(
        expect.objectContaining<Partial<ProductPriceTierError>>({
          code: 'NON_FINITE_UNITS_PER_OFFER',
        }),
      );
    },
  );

  it('requires a positive whole-piece units-per-offer count', () => {
    expect(() => validateProductPriceTierContract(tier({ unitsPerOffer: 1.5 }))).toThrowError(
      expect.objectContaining<Partial<ProductPriceTierError>>({
        code: 'NON_INTEGER_UNITS_PER_OFFER',
      }),
    );
    expect(() => validateProductPriceTierContract(tier({ unitsPerOffer: 0 }))).toThrowError(
      expect.objectContaining<Partial<ProductPriceTierError>>({
        code: 'NON_POSITIVE_UNITS_PER_OFFER',
      }),
    );
    expect(() => validateProductPriceTierContract(tier({ unitsPerOffer: -1 }))).toThrowError(
      expect.objectContaining<Partial<ProductPriceTierError>>({
        code: 'NON_POSITIVE_UNITS_PER_OFFER',
      }),
    );
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects non-finite minimum order quantity %s',
    (minimumOrderQuantity) => {
      expect(() =>
        validateProductPriceTierContract(tier({ minimumOrderQuantity })),
      ).toThrowError(
        expect.objectContaining<Partial<ProductPriceTierError>>({
          code: 'NON_FINITE_MINIMUM_ORDER_QUANTITY',
        }),
      );
    },
  );

  it('requires a positive whole-piece minimum order quantity', () => {
    expect(() =>
      validateProductPriceTierContract(tier({ minimumOrderQuantity: 2.5 })),
    ).toThrowError(
      expect.objectContaining<Partial<ProductPriceTierError>>({
        code: 'NON_INTEGER_MINIMUM_ORDER_QUANTITY',
      }),
    );
    expect(() =>
      validateProductPriceTierContract(tier({ minimumOrderQuantity: 0 })),
    ).toThrowError(
      expect.objectContaining<Partial<ProductPriceTierError>>({
        code: 'NON_POSITIVE_MINIMUM_ORDER_QUANTITY',
      }),
    );
  });

  it('requires per-unit tiers to represent exactly one Product unit per offer', () => {
    expect(() =>
      validateProductPriceTierContract(
        tier({
          priceBasis: 'per-unit',
          unitsPerOffer: 6,
          minimumOrderQuantity: 20,
        }),
      ),
    ).toThrowError(
      expect.objectContaining<Partial<ProductPriceTierError>>({
        code: 'PER_UNIT_UNITS_PER_OFFER_MISMATCH',
      }),
    );
  });

  it('requires per-offer minimum quantity to cover at least one full offer', () => {
    expect(() =>
      validateProductPriceTierContract(
        tier({
          kind: 'package',
          priceBasis: 'per-offer',
          unitsPerOffer: 6,
          minimumOrderQuantity: 5,
        }),
      ),
    ).toThrowError(
      expect.objectContaining<Partial<ProductPriceTierError>>({
        code: 'MINIMUM_BELOW_OFFER_SIZE',
      }),
    );
  });

  it('requires per-offer minimum quantity to be a whole offer multiple', () => {
    expect(() =>
      validateProductPriceTierContract(
        tier({
          kind: 'package',
          priceBasis: 'per-offer',
          unitsPerOffer: 6,
          minimumOrderQuantity: 10,
        }),
      ),
    ).toThrowError(
      expect.objectContaining<Partial<ProductPriceTierError>>({
        code: 'MINIMUM_NOT_OFFER_MULTIPLE',
      }),
    );
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects non-finite additional cost per offer %s',
    (additionalCostPerOffer) => {
      expect(() =>
        validateProductPriceTierContract(tier({ additionalCostPerOffer })),
      ).toThrowError(
        expect.objectContaining<Partial<ProductPriceTierError>>({
          code: 'NON_FINITE_ADDITIONAL_COST_PER_OFFER',
        }),
      );
    },
  );

  it('rejects negative additional cost per offer', () => {
    expect(() =>
      validateProductPriceTierContract(tier({ additionalCostPerOffer: -1 })),
    ).toThrowError(
      expect.objectContaining<Partial<ProductPriceTierError>>({
        code: 'NEGATIVE_ADDITIONAL_COST_PER_OFFER',
      }),
    );
  });

  it('rejects a non-boolean active state', () => {
    expect(() =>
      validateProductPriceTierContract(
        tier({ isActive: 'yes' as unknown as boolean }),
      ),
    ).toThrowError(
      expect.objectContaining<Partial<ProductPriceTierError>>({
        code: 'INVALID_ACTIVE_STATE',
      }),
    );
  });

  it('includes tier/Product/input context in typed errors', () => {
    try {
      validateProductPriceTierContract(
        tier({
          id: ' TIER-X ',
          productId: ' PROD-X ',
          priceAmount: -5,
        }),
      );
      throw new Error('Expected validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(ProductPriceTierError);
      expect(error).toMatchObject({
        code: 'NEGATIVE_PRICE_AMOUNT',
        tierId: ' TIER-X ',
        productId: ' PROD-X ',
        input: -5,
      });
    }
  });
});
