import { describe, expect, it } from 'vitest';
import {
  ProductPriceTierError,
  type ProductPriceTier,
} from './productPriceTiers';
import {
  evaluateProductPriceTierQuantityEligibility,
} from './productPriceTierQuantityEligibility';

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

describe('TP8B Product price tier quantity eligibility', () => {
  it('accepts an active per-unit tier at its exact minimum quantity', () => {
    expect(
      evaluateProductPriceTierQuantityEligibility(tier(), 20),
    ).toEqual({
      productId: 'PROD-0001',
      tierId: 'TIER-0001',
      quantity: 20,
      eligible: true,
      offerCount: 20,
      issues: [],
    });
  });

  it('accepts an active per-unit tier above its minimum without imposing package divisibility', () => {
    const result = evaluateProductPriceTierQuantityEligibility(
      tier({ minimumOrderQuantity: 10 }),
      17,
    );

    expect(result.eligible).toBe(true);
    expect(result.offerCount).toBe(17);
    expect(result.issues).toEqual([]);
  });

  it('rejects a quantity below the tier minimum', () => {
    const result = evaluateProductPriceTierQuantityEligibility(tier(), 19);

    expect(result.eligible).toBe(false);
    expect(result.offerCount).toBeNull();
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'QUANTITY_BELOW_MINIMUM',
        tierId: 'TIER-0001',
        productId: 'PROD-0001',
        quantity: 19,
      }),
    ]);
  });

  it.each([
    [6, 1],
    [12, 2],
    [18, 3],
  ])(
    'accepts a per-offer Package quantity %d as %d complete offer(s)',
    (quantity, offerCount) => {
      const result = evaluateProductPriceTierQuantityEligibility(
        tier({
          kind: 'package',
          priceBasis: 'per-offer',
          unitsPerOffer: 6,
          minimumOrderQuantity: 6,
        }),
        quantity,
      );

      expect(result.eligible).toBe(true);
      expect(result.offerCount).toBe(offerCount);
      expect(result.issues).toEqual([]);
    },
  );

  it.each([7, 13])(
    'rejects non-divisible per-offer quantity %d instead of creating a mixed remainder',
    (quantity) => {
      const result = evaluateProductPriceTierQuantityEligibility(
        tier({
          kind: 'package',
          priceBasis: 'per-offer',
          unitsPerOffer: 6,
          minimumOrderQuantity: 6,
        }),
        quantity,
      );

      expect(result.eligible).toBe(false);
      expect(result.offerCount).toBeNull();
      expect(result.issues).toEqual([
        expect.objectContaining({
          code: 'QUANTITY_NOT_OFFER_MULTIPLE',
          quantity,
        }),
      ]);
    },
  );

  it('uses price basis rather than kind for divisibility semantics', () => {
    const result = evaluateProductPriceTierQuantityEligibility(
      tier({
        kind: 'bulk',
        priceBasis: 'per-offer',
        unitsPerOffer: 5,
        minimumOrderQuantity: 10,
      }),
      12,
    );

    expect(result.eligible).toBe(false);
    expect(result.issues.map((candidate) => candidate.code)).toEqual([
      'QUANTITY_NOT_OFFER_MULTIPLE',
    ]);
  });

  it('applies the same structural quantity rules to Custom tiers without auto-select semantics', () => {
    const custom = tier({
      kind: 'custom',
      priceBasis: 'per-offer',
      unitsPerOffer: 4,
      minimumOrderQuantity: 8,
    });

    expect(
      evaluateProductPriceTierQuantityEligibility(custom, 8),
    ).toMatchObject({
      eligible: true,
      offerCount: 2,
    });
    expect(
      evaluateProductPriceTierQuantityEligibility(custom, 10).issues.map(
        (candidate) => candidate.code,
      ),
    ).toEqual(['QUANTITY_NOT_OFFER_MULTIPLE']);
  });

  it('rejects archived tiers even when the quantity otherwise qualifies', () => {
    const result = evaluateProductPriceTierQuantityEligibility(
      tier({ isActive: false }),
      20,
    );

    expect(result.eligible).toBe(false);
    expect(result.offerCount).toBeNull();
    expect(result.issues.map((candidate) => candidate.code)).toEqual([
      'TIER_INACTIVE',
    ]);
  });

  it('returns deterministic structural diagnostics for an archived, below-minimum, non-divisible tier', () => {
    const result = evaluateProductPriceTierQuantityEligibility(
      tier({
        isActive: false,
        kind: 'package',
        priceBasis: 'per-offer',
        unitsPerOffer: 6,
        minimumOrderQuantity: 12,
      }),
      7,
    );

    expect(result.eligible).toBe(false);
    expect(result.issues.map((candidate) => candidate.code)).toEqual([
      'TIER_INACTIVE',
      'QUANTITY_BELOW_MINIMUM',
      'QUANTITY_NOT_OFFER_MULTIPLE',
    ]);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects non-finite resolution quantity %s',
    (quantity) => {
      const result = evaluateProductPriceTierQuantityEligibility(tier(), quantity);

      expect(result.eligible).toBe(false);
      expect(result.offerCount).toBeNull();
      expect(result.issues.map((candidate) => candidate.code)).toEqual([
        'QUANTITY_NON_FINITE',
      ]);
    },
  );

  it('rejects fractional resolution quantities before tier threshold checks', () => {
    const result = evaluateProductPriceTierQuantityEligibility(tier(), 19.5);

    expect(result.issues.map((candidate) => candidate.code)).toEqual([
      'QUANTITY_NON_INTEGER',
    ]);
  });

  it.each([0, -1])(
    'rejects non-positive resolution quantity %d',
    (quantity) => {
      const result = evaluateProductPriceTierQuantityEligibility(tier(), quantity);

      expect(result.issues.map((candidate) => candidate.code)).toEqual([
        'QUANTITY_NON_POSITIVE',
      ]);
    },
  );

  it('does not mutate the Product price tier source record', () => {
    const source = tier({
      kind: 'package',
      priceBasis: 'per-offer',
      unitsPerOffer: 6,
      minimumOrderQuantity: 6,
      notes: 'Keep source unchanged',
    });
    const before = structuredClone(source);

    evaluateProductPriceTierQuantityEligibility(source, 12);

    expect(source).toEqual(before);
  });

  it('reuses the authoritative ProductPriceTier source validator instead of repairing invalid source data', () => {
    expect(() =>
      evaluateProductPriceTierQuantityEligibility(
        tier({
          priceBasis: 'per-unit',
          unitsPerOffer: 2,
        }),
        20,
      ),
    ).toThrowError(
      expect.objectContaining<Partial<ProductPriceTierError>>({
        code: 'PER_UNIT_UNITS_PER_OFFER_MISMATCH',
      }),
    );
  });
});
