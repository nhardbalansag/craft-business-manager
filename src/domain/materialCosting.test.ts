import { describe, expect, it } from 'vitest';
import type { Material } from './materials';
import {
  MaterialCostingError,
  calculateMaterialPackageCosting,
} from './materialCosting';

function material(overrides: Partial<Material> = {}): Material {
  return {
    id: 'MAT-PLASTER',
    name: 'Plaster of Paris',
    group: 'plaster',
    baseUnit: 'g',
    purchaseQuantity: 1,
    purchaseUnit: 'kg',
    packageCost: 66,
    onHandQuantity: 0,
    onHandUnit: 'g',
    isActive: true,
    ...overrides,
  };
}

describe('material package costing', () => {
  it('derives cost per gram from a standard kilogram purchase', () => {
    const result = calculateMaterialPackageCosting(material());

    expect(result.standardBaseUnitsPerPurchaseUnit).toBe(1000);
    expect(result.manualBaseUnitsPerPurchaseUnit).toBeNull();
    expect(result.effectiveBaseUnitsPerPurchaseUnit).toBe(1000);
    expect(result.effectiveConversionSource).toBe('standard');
    expect(result.packageBaseQuantity).toBe(1000);
    expect(result.costPerBaseUnit).toBeCloseTo(0.066, 12);
  });

  it('supports fractional and multi-unit standard packages', () => {
    const result = calculateMaterialPackageCosting(
      material({ purchaseQuantity: 2.5, purchaseUnit: 'kg', packageCost: 250 }),
    );

    expect(result.packageBaseQuantity).toBe(2500);
    expect(result.costPerBaseUnit).toBeCloseTo(0.1, 12);
  });

  it('supports count-based purchases', () => {
    const result = calculateMaterialPackageCosting(
      material({
        id: 'MAT-WICK',
        name: 'Cotton Wick',
        group: 'wick',
        baseUnit: 'pc',
        purchaseQuantity: 100,
        purchaseUnit: 'pc',
        packageCost: 80,
        onHandUnit: 'pc',
      }),
    );

    expect(result.packageBaseQuantity).toBe(100);
    expect(result.costPerBaseUnit).toBeCloseTo(0.8, 12);
  });

  it('uses a manual conversion for package labels', () => {
    const result = calculateMaterialPackageCosting(
      material({
        id: 'MAT-LABEL',
        name: 'Product Label',
        group: 'packaging',
        baseUnit: 'pc',
        purchaseQuantity: 1,
        purchaseUnit: 'pack',
        manualBaseUnitsPerPurchaseUnit: 100,
        packageCost: 120,
        onHandUnit: 'pack',
      }),
    );

    expect(result.standardBaseUnitsPerPurchaseUnit).toBeNull();
    expect(result.manualBaseUnitsPerPurchaseUnit).toBe(100);
    expect(result.effectiveConversionSource).toBe('manual');
    expect(result.packageBaseQuantity).toBe(100);
    expect(result.costPerBaseUnit).toBeCloseTo(1.2, 12);
  });

  it('lets an explicit manual conversion override a standard conversion', () => {
    const result = calculateMaterialPackageCosting(
      material({
        purchaseQuantity: 1,
        purchaseUnit: 'kg',
        manualBaseUnitsPerPurchaseUnit: 950,
        packageCost: 95,
      }),
    );

    expect(result.standardBaseUnitsPerPurchaseUnit).toBe(1000);
    expect(result.manualBaseUnitsPerPurchaseUnit).toBe(950);
    expect(result.effectiveBaseUnitsPerPurchaseUnit).toBe(950);
    expect(result.effectiveConversionSource).toBe('manual');
    expect(result.costPerBaseUnit).toBeCloseTo(0.1, 12);
  });

  it('allows a zero-cost package while preserving a valid quantity', () => {
    const result = calculateMaterialPackageCosting(material({ packageCost: 0 }));
    expect(result.costPerBaseUnit).toBe(0);
  });

  it('rejects zero or negative purchase quantity before division', () => {
    for (const purchaseQuantity of [0, -1]) {
      try {
        calculateMaterialPackageCosting(material({ purchaseQuantity }));
        throw new Error('Expected costing to fail.');
      } catch (error) {
        expect(error).toBeInstanceOf(MaterialCostingError);
        expect((error as MaterialCostingError).code).toBe('NON_POSITIVE_PURCHASE_QUANTITY');
      }
    }
  });

  it('rejects non-finite purchase quantity and package cost', () => {
    expect(() => calculateMaterialPackageCosting(material({ purchaseQuantity: Number.NaN }))).toThrow(
      MaterialCostingError,
    );
    expect(() => calculateMaterialPackageCosting(material({ packageCost: Number.POSITIVE_INFINITY }))).toThrow(
      MaterialCostingError,
    );
  });

  it('rejects negative package cost', () => {
    try {
      calculateMaterialPackageCosting(material({ packageCost: -1 }));
      throw new Error('Expected costing to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(MaterialCostingError);
      expect((error as MaterialCostingError).code).toBe('NEGATIVE_PACKAGE_COST');
    }
  });

  it('rejects missing conversion for a non-standard package label', () => {
    try {
      calculateMaterialPackageCosting(
        material({
          baseUnit: 'pc',
          purchaseUnit: 'box',
          manualBaseUnitsPerPurchaseUnit: undefined,
          onHandUnit: 'box',
        }),
      );
      throw new Error('Expected costing to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(MaterialCostingError);
      expect((error as MaterialCostingError).code).toBe('MISSING_PACKAGE_CONVERSION');
    }
  });

  it('rejects invalid manual conversion values', () => {
    for (const manualBaseUnitsPerPurchaseUnit of [0, -10, Number.NaN]) {
      try {
        calculateMaterialPackageCosting(material({ manualBaseUnitsPerPurchaseUnit }));
        throw new Error('Expected costing to fail.');
      } catch (error) {
        expect(error).toBeInstanceOf(MaterialCostingError);
        expect((error as MaterialCostingError).code).toBe('INVALID_MANUAL_CONVERSION');
      }
    }
  });
});
