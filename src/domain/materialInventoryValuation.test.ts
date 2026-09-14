import { describe, expect, it } from 'vitest';
import type { Material } from './materials';
import { MaterialCostingError } from './materialCosting';
import {
  MaterialInventoryError,
  calculateMaterialInventoryValuation,
} from './materialInventory';

function material(overrides: Partial<Material> = {}): Material {
  return {
    id: 'MAT-PLASTER',
    name: 'Plaster of Paris',
    group: 'plaster',
    baseUnit: 'g',
    purchaseQuantity: 1,
    purchaseUnit: 'kg',
    packageCost: 66,
    onHandQuantity: 0.6,
    onHandUnit: 'kg',
    isActive: true,
    ...overrides,
  };
}

describe('calculateMaterialInventoryValuation', () => {
  it('calculates inventory value from normalized stock and cost per base unit', () => {
    const result = calculateMaterialInventoryValuation(material());

    expect(result.normalizedBaseQuantity).toBe(600);
    expect(result.baseUnit).toBe('g');
    expect(result.costPerBaseUnit).toBeCloseTo(0.066, 12);
    expect(result.inventoryValue).toBeCloseTo(39.6, 12);
  });

  it('calculates count-based inventory value', () => {
    const result = calculateMaterialInventoryValuation(
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

    expect(result.costPerBaseUnit).toBeCloseTo(0.8, 12);
    expect(result.normalizedBaseQuantity).toBe(40);
    expect(result.inventoryValue).toBeCloseTo(32, 12);
  });

  it('values stock entered in the configured purchase package', () => {
    const result = calculateMaterialInventoryValuation(
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

    expect(result.normalizedBaseQuantity).toBe(50);
    expect(result.costPerBaseUnit).toBeCloseTo(1.2, 12);
    expect(result.inventoryValue).toBeCloseTo(60, 12);
  });

  it('returns zero inventory value when valid stock is zero', () => {
    const result = calculateMaterialInventoryValuation(material({ onHandQuantity: 0 }));
    expect(result.normalizedBaseQuantity).toBe(0);
    expect(result.inventoryValue).toBe(0);
  });

  it('rejects negative stock as a business-invalid inventory state', () => {
    try {
      calculateMaterialInventoryValuation(material({ onHandQuantity: -0.25 }));
      throw new Error('Expected valuation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(MaterialInventoryError);
      expect((error as MaterialInventoryError).code).toBe('NEGATIVE_ON_HAND_QUANTITY');
    }
  });

  it('propagates missing package conversion instead of inventing a value', () => {
    expect(() =>
      calculateMaterialInventoryValuation(
        material({
          id: 'MAT-LABEL',
          name: 'Product Label',
          group: 'packaging',
          baseUnit: 'pc',
          purchaseQuantity: 1,
          purchaseUnit: 'pack',
          packageCost: 120,
          manualBaseUnitsPerPurchaseUnit: undefined,
          onHandQuantity: 10,
          onHandUnit: 'pc',
        }),
      ),
    ).toThrow(MaterialCostingError);
  });

  it('propagates invalid negative package cost from package costing validation', () => {
    expect(() => calculateMaterialInventoryValuation(material({ packageCost: -1 }))).toThrow(
      MaterialCostingError,
    );
  });
});
