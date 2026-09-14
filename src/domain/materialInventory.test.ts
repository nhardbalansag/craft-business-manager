import { describe, expect, it } from 'vitest';
import type { Material } from './materials';
import { MaterialInventoryError, normalizeMaterialOnHand } from './materialInventory';

function material(overrides: Partial<Material> = {}): Material {
  return {
    id: 'MAT-PLASTER',
    name: 'Plaster of Paris',
    group: 'plaster',
    baseUnit: 'g',
    purchaseQuantity: 1,
    purchaseUnit: 'kg',
    packageCost: 66,
    onHandQuantity: 2.5,
    onHandUnit: 'kg',
    isActive: true,
    ...overrides,
  };
}

describe('normalizeMaterialOnHand', () => {
  it('normalizes kg stock into grams', () => {
    expect(normalizeMaterialOnHand(material())).toEqual({
      enteredQuantity: 2.5,
      enteredUnit: 'kg',
      baseUnit: 'g',
      baseUnitsPerOnHandUnit: 1000,
      normalizedBaseQuantity: 2500,
      conversionSource: 'standard',
    });
  });

  it('normalizes liters into milliliters', () => {
    const result = normalizeMaterialOnHand(
      material({
        id: 'MAT-WATER',
        name: 'Water',
        group: 'liquid',
        baseUnit: 'mL',
        purchaseQuantity: 1,
        purchaseUnit: 'L',
        packageCost: 30,
        onHandQuantity: 1.5,
        onHandUnit: 'L',
      }),
    );

    expect(result.normalizedBaseQuantity).toBe(1500);
    expect(result.baseUnitsPerOnHandUnit).toBe(1000);
  });

  it('normalizes count stock without changing the quantity', () => {
    const result = normalizeMaterialOnHand(
      material({
        id: 'MAT-WICK',
        name: 'Cotton Wick',
        group: 'wick',
        baseUnit: 'pc',
        purchaseQuantity: 100,
        purchaseUnit: 'pc',
        packageCost: 80,
        onHandQuantity: 40,
        onHandUnit: 'pc',
      }),
    );

    expect(result.normalizedBaseQuantity).toBe(40);
    expect(result.baseUnitsPerOnHandUnit).toBe(1);
  });

  it('normalizes a matching package-label stock using its effective package conversion', () => {
    const result = normalizeMaterialOnHand(
      material({
        id: 'MAT-LABEL',
        name: 'Product Label',
        group: 'packaging',
        baseUnit: 'pc',
        purchaseQuantity: 1,
        purchaseUnit: 'pack',
        packageCost: 120,
        manualBaseUnitsPerPurchaseUnit: 100,
        onHandQuantity: 0.5,
        onHandUnit: 'pack',
      }),
    );

    expect(result.conversionSource).toBe('purchase-package');
    expect(result.baseUnitsPerOnHandUnit).toBe(100);
    expect(result.normalizedBaseQuantity).toBe(50);
  });

  it('rejects an arbitrary package label that is not the configured purchase package', () => {
    try {
      normalizeMaterialOnHand(
        material({
          id: 'MAT-LABEL',
          name: 'Product Label',
          group: 'packaging',
          baseUnit: 'pc',
          purchaseQuantity: 1,
          purchaseUnit: 'pack',
          packageCost: 120,
          manualBaseUnitsPerPurchaseUnit: 100,
          onHandQuantity: 1,
          onHandUnit: 'box',
        }),
      );
      throw new Error('Expected normalization to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(MaterialInventoryError);
      expect((error as MaterialInventoryError).code).toBe('UNRESOLVED_PACKAGE_ON_HAND_UNIT');
    }
  });

  it('rejects non-finite on-hand quantity', () => {
    expect(() => normalizeMaterialOnHand(material({ onHandQuantity: Number.NaN }))).toThrow(
      MaterialInventoryError,
    );
  });

  it('preserves negative quantities mathematically for Phase 1.3C validation', () => {
    expect(normalizeMaterialOnHand(material({ onHandQuantity: -2 })).normalizedBaseQuantity).toBe(-2000);
  });

  it('preserves fractional standard-unit quantities precisely', () => {
    const result = normalizeMaterialOnHand(material({ onHandQuantity: 0.125, onHandUnit: 'kg' }));
    expect(result.normalizedBaseQuantity).toBe(125);
  });
});
