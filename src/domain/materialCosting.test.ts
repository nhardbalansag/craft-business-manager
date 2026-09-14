import { describe, expect, it } from 'vitest';
import type { MaterialCalibrationEvidence } from './materialCalibration';
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

function calibration(overrides: Partial<MaterialCalibrationEvidence> = {}): MaterialCalibrationEvidence {
  return {
    id: 'CAL-PLASTER-001',
    materialId: 'MAT-PLASTER',
    measuredVolume: 5,
    volumeUnit: 'cup',
    knownWeight: 1,
    weightUnit: 'kg',
    recordedAt: '2026-09-14T16:00:00+08:00',
    ...overrides,
  };
}

describe('material package costing', () => {
  it('derives cost per gram from a standard kilogram purchase', () => {
    const result = calculateMaterialPackageCosting(material());

    expect(result.standardBaseUnitsPerPurchaseUnit).toBe(1000);
    expect(result.manualBaseUnitsPerPurchaseUnit).toBeNull();
    expect(result.calibrationBaseUnitsPerPurchaseUnit).toBeNull();
    expect(result.effectiveBaseUnitsPerPurchaseUnit).toBe(1000);
    expect(result.effectiveConversionSource).toBe('standard');
    expect(result.effectiveCalibrationId).toBeNull();
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

  it('lets an explicit manual conversion override a standard same-dimension conversion', () => {
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

  it('uses the latest material calibration for cup -> gram package costing', () => {
    const result = calculateMaterialPackageCosting(
      material({
        purchaseQuantity: 2,
        purchaseUnit: 'cup',
        packageCost: 40,
      }),
      [calibration()],
    );

    expect(result.standardBaseUnitsPerPurchaseUnit).toBeNull();
    expect(result.calibrationBaseUnitsPerPurchaseUnit).toBe(200);
    expect(result.effectiveBaseUnitsPerPurchaseUnit).toBe(200);
    expect(result.effectiveConversionSource).toBe('calibration');
    expect(result.effectiveCalibrationId).toBe('CAL-PLASTER-001');
    expect(result.packageBaseQuantity).toBe(400);
    expect(result.costPerBaseUnit).toBeCloseTo(0.1, 12);
  });

  it('lets material calibration outrank a manual g/cup fallback', () => {
    const result = calculateMaterialPackageCosting(
      material({
        purchaseUnit: 'cup',
        manualBaseUnitsPerPurchaseUnit: 180,
        packageCost: 20,
      }),
      [calibration()],
    );

    expect(result.manualBaseUnitsPerPurchaseUnit).toBe(180);
    expect(result.calibrationBaseUnitsPerPurchaseUnit).toBe(200);
    expect(result.effectiveBaseUnitsPerPurchaseUnit).toBe(200);
    expect(result.effectiveConversionSource).toBe('calibration');
  });

  it('falls back to an explicit manual g/cup conversion when no calibration exists', () => {
    const result = calculateMaterialPackageCosting(
      material({
        purchaseUnit: 'cup',
        manualBaseUnitsPerPurchaseUnit: 185,
        packageCost: 18.5,
      }),
    );

    expect(result.effectiveBaseUnitsPerPurchaseUnit).toBe(185);
    expect(result.effectiveConversionSource).toBe('manual');
    expect(result.effectiveCalibrationId).toBeNull();
    expect(result.costPerBaseUnit).toBeCloseTo(0.1, 12);
  });

  it('requires calibration or an explicit manual fallback for cup -> gram costing', () => {
    try {
      calculateMaterialPackageCosting(material({ purchaseUnit: 'cup', manualBaseUnitsPerPurchaseUnit: undefined }));
      throw new Error('Expected costing to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(MaterialCostingError);
      expect((error as MaterialCostingError).code).toBe('MISSING_MATERIAL_CALIBRATION');
    }
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

  it('rejects invalid manual conversion values even when calibration is available', () => {
    for (const manualBaseUnitsPerPurchaseUnit of [0, -10, Number.NaN]) {
      try {
        calculateMaterialPackageCosting(
          material({ purchaseUnit: 'cup', manualBaseUnitsPerPurchaseUnit }),
          [calibration()],
        );
        throw new Error('Expected costing to fail.');
      } catch (error) {
        expect(error).toBeInstanceOf(MaterialCostingError);
        expect((error as MaterialCostingError).code).toBe('INVALID_MANUAL_CONVERSION');
      }
    }
  });
});
