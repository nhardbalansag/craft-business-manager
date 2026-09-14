import { describe, expect, it } from 'vitest';
import type { MaterialCalibrationEvidence } from './materialCalibration';
import type { Material } from './materials';
import {
  MaterialInventoryError,
  calculateMaterialInventoryValuation,
  normalizeMaterialOnHand,
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
    onHandQuantity: 2.5,
    onHandUnit: 'kg',
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

describe('normalizeMaterialOnHand', () => {
  it('normalizes kg stock into grams', () => {
    expect(normalizeMaterialOnHand(material())).toEqual({
      enteredQuantity: 2.5,
      enteredUnit: 'kg',
      baseUnit: 'g',
      baseUnitsPerOnHandUnit: 1000,
      normalizedBaseQuantity: 2500,
      conversionSource: 'standard',
      calibrationId: null,
      purchasePackageConversionSource: null,
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
    expect(result.conversionSource).toBe('standard');
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
    expect(result.purchasePackageConversionSource).toBe('manual');
    expect(result.baseUnitsPerOnHandUnit).toBe(100);
    expect(result.normalizedBaseQuantity).toBe(50);
  });

  it('uses material calibration for dry stock entered in cups', () => {
    const result = normalizeMaterialOnHand(
      material({ onHandQuantity: 3, onHandUnit: 'cup' }),
      [calibration()],
    );

    expect(result.conversionSource).toBe('calibration');
    expect(result.calibrationId).toBe('CAL-PLASTER-001');
    expect(result.baseUnitsPerOnHandUnit).toBe(200);
    expect(result.normalizedBaseQuantity).toBe(600);
  });

  it('uses the latest valid calibration sample for dry cup stock', () => {
    const result = normalizeMaterialOnHand(
      material({ onHandQuantity: 2, onHandUnit: 'cup' }),
      [
        calibration({ id: 'CAL-OLD', recordedAt: '2026-09-01T09:00:00+08:00' }),
        calibration({
          id: 'CAL-NEW',
          measuredVolume: 4,
          knownWeight: 0.84,
          weightUnit: 'kg',
          recordedAt: '2026-09-14T09:00:00+08:00',
        }),
      ],
    );

    expect(result.calibrationId).toBe('CAL-NEW');
    expect(result.baseUnitsPerOnHandUnit).toBe(210);
    expect(result.normalizedBaseQuantity).toBe(420);
  });

  it('falls back to manual g/cup only when cup is the configured purchase unit', () => {
    const result = normalizeMaterialOnHand(
      material({
        purchaseUnit: 'cup',
        manualBaseUnitsPerPurchaseUnit: 190,
        onHandQuantity: 3,
        onHandUnit: 'cup',
      }),
    );

    expect(result.conversionSource).toBe('manual');
    expect(result.baseUnitsPerOnHandUnit).toBe(190);
    expect(result.normalizedBaseQuantity).toBe(570);
  });

  it('requires a material calibration for cup stock when no valid manual cup fallback exists', () => {
    try {
      normalizeMaterialOnHand(material({ purchaseUnit: 'kg', onHandQuantity: 3, onHandUnit: 'cup' }));
      throw new Error('Expected normalization to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(MaterialInventoryError);
      expect((error as MaterialInventoryError).code).toBe('MISSING_MATERIAL_CALIBRATION');
    }
  });

  it('rejects unsupported cross-dimension stock rather than guessing', () => {
    try {
      normalizeMaterialOnHand(material({ onHandUnit: 'L' }));
      throw new Error('Expected normalization to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(MaterialInventoryError);
      expect((error as MaterialInventoryError).code).toBe('UNRESOLVED_CROSS_DIMENSION_UNIT');
    }
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

  it('preserves negative quantities mathematically for valuation validation', () => {
    expect(normalizeMaterialOnHand(material({ onHandQuantity: -2 })).normalizedBaseQuantity).toBe(-2000);
  });

  it('preserves fractional standard-unit quantities precisely', () => {
    const result = normalizeMaterialOnHand(material({ onHandQuantity: 0.125, onHandUnit: 'kg' }));
    expect(result.normalizedBaseQuantity).toBe(125);
  });
});

describe('calculateMaterialInventoryValuation with calibration', () => {
  it('values calibrated cup stock using standard package cost per gram', () => {
    const result = calculateMaterialInventoryValuation(
      material({
        purchaseQuantity: 1,
        purchaseUnit: 'kg',
        packageCost: 66,
        onHandQuantity: 3,
        onHandUnit: 'cup',
      }),
      [calibration()],
    );

    expect(result.normalizedBaseQuantity).toBe(600);
    expect(result.costPerBaseUnit).toBeCloseTo(0.066, 12);
    expect(result.inventoryValue).toBeCloseTo(39.6, 12);
  });
});
