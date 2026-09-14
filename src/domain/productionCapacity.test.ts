import { describe, expect, it } from 'vitest';
import {
  ProductionCapacityError,
  deriveInventoryLimitedCapacity,
  type MaterialCapacityInput,
} from './productionCapacity';

function input(overrides: Partial<MaterialCapacityInput> = {}): MaterialCapacityInput {
  return {
    materialId: 'MAT-PLASTER',
    baseUnit: 'g',
    normalizedOnHandBaseQuantity: 1000,
    plannedBaseQuantityPerProduct: 78.75,
    ...overrides,
  };
}

describe('inventory-limited production capacity', () => {
  it('calculates per-material and overall capacity using floor division', () => {
    const result = deriveInventoryLimitedCapacity('ART-001', [
      input(),
      input({
        materialId: 'MAT-WATER',
        baseUnit: 'mL',
        normalizedOnHandBaseQuantity: 500,
        plannedBaseQuantityPerProduct: 47.25,
      }),
      input({
        materialId: 'MAT-BRUSH',
        baseUnit: 'pc',
        normalizedOnHandBaseQuantity: 8,
        plannedBaseQuantityPerProduct: 1,
      }),
    ]);

    expect(result.produciblePieces).toBe(8);
    expect(result.limitingMaterialIds).toEqual(['MAT-BRUSH']);
    expect(result.materials).toEqual([
      expect.objectContaining({ materialId: 'MAT-BRUSH', capacityPieces: 8, isLimiting: true }),
      expect.objectContaining({ materialId: 'MAT-PLASTER', capacityPieces: 12, isLimiting: false }),
      expect.objectContaining({ materialId: 'MAT-WATER', capacityPieces: 10, isLimiting: false }),
    ]);
  });

  it('reports every tied limiting material deterministically', () => {
    const result = deriveInventoryLimitedCapacity('ART-001', [
      input({ materialId: 'MAT-Z', normalizedOnHandBaseQuantity: 10, plannedBaseQuantityPerProduct: 2 }),
      input({ materialId: 'MAT-A', normalizedOnHandBaseQuantity: 15, plannedBaseQuantityPerProduct: 3 }),
      input({ materialId: 'MAT-M', normalizedOnHandBaseQuantity: 100, plannedBaseQuantityPerProduct: 10 }),
    ]);

    expect(result.produciblePieces).toBe(5);
    expect(result.limitingMaterialIds).toEqual(['MAT-A', 'MAT-Z']);
    expect(result.materials.filter((entry) => entry.isLimiting).map((entry) => entry.materialId)).toEqual([
      'MAT-A',
      'MAT-Z',
    ]);
  });

  it('allows zero inventory and reports zero capacity', () => {
    const result = deriveInventoryLimitedCapacity('ART-001', [
      input({ normalizedOnHandBaseQuantity: 0 }),
    ]);

    expect(result.produciblePieces).toBe(0);
    expect(result.limitingMaterialIds).toEqual(['MAT-PLASTER']);
  });

  it('retains fractional base-unit precision before floor capacity', () => {
    const result = deriveInventoryLimitedCapacity('ART-001', [
      input({ normalizedOnHandBaseQuantity: 236.2499, plannedBaseQuantityPerProduct: 78.75 }),
    ]);
    expect(result.produciblePieces).toBe(2);
  });

  it('rejects missing requirements', () => {
    expect(() => deriveInventoryLimitedCapacity('ART-001', [])).toThrowError(ProductionCapacityError);
    try {
      deriveInventoryLimitedCapacity('ART-001', []);
    } catch (error) {
      expect((error as ProductionCapacityError).code).toBe('NO_REQUIRED_MATERIALS');
    }
  });

  it('rejects duplicate materials', () => {
    expect(() =>
      deriveInventoryLimitedCapacity('ART-001', [input(), input({ materialId: 'mat-plaster' })]),
    ).toThrowError(expect.objectContaining({ code: 'DUPLICATE_MATERIAL' }));
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])(
    'rejects invalid normalized inventory %s',
    (quantity) => {
      expect(() =>
        deriveInventoryLimitedCapacity('ART-001', [input({ normalizedOnHandBaseQuantity: quantity })]),
      ).toThrowError(expect.objectContaining({ code: 'INVALID_ON_HAND_QUANTITY' }));
    },
  );

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid planned requirement %s',
    (quantity) => {
      expect(() =>
        deriveInventoryLimitedCapacity('ART-001', [input({ plannedBaseQuantityPerProduct: quantity })]),
      ).toThrowError(expect.objectContaining({ code: 'INVALID_PLANNED_REQUIREMENT' }));
    },
  );
});
