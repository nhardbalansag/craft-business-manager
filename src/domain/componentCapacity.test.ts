import { describe, expect, it } from 'vitest';
import { ComponentCapacityError, deriveComponentCapacity } from './componentCapacity';

describe('deriveComponentCapacity', () => {
  it('derives exact integer capacity', () => {
    expect(deriveComponentCapacity({ availableQuantity: 10, quantityPerParent: 2 })).toEqual({
      availableQuantity: 10,
      quantityPerParent: 2,
      capacityPieces: 5,
    });
  });

  it('floors capacity when availability has a remainder', () => {
    expect(deriveComponentCapacity({ availableQuantity: 10, quantityPerParent: 3 }).capacityPieces).toBe(3);
  });

  it('returns zero when availability is lower than one parent requirement', () => {
    expect(deriveComponentCapacity({ availableQuantity: 2, quantityPerParent: 3 }).capacityPieces).toBe(0);
  });

  it('accepts explicit zero availability', () => {
    expect(deriveComponentCapacity({ availableQuantity: 0, quantityPerParent: 4 }).capacityPieces).toBe(0);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid available quantity %s',
    (availableQuantity) => {
      expect(() => deriveComponentCapacity({ availableQuantity, quantityPerParent: 1 })).toThrowError(
        ComponentCapacityError,
      );
      try {
        deriveComponentCapacity({ availableQuantity, quantityPerParent: 1 });
      } catch (error) {
        expect(error).toMatchObject({ code: 'INVALID_AVAILABLE_QUANTITY' });
      }
    },
  );

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid quantity per parent %s',
    (quantityPerParent) => {
      expect(() => deriveComponentCapacity({ availableQuantity: 10, quantityPerParent })).toThrowError(
        ComponentCapacityError,
      );
      try {
        deriveComponentCapacity({ availableQuantity: 10, quantityPerParent });
      } catch (error) {
        expect(error).toMatchObject({ code: 'INVALID_QUANTITY_PER_PARENT' });
      }
    },
  );
});
