import { describe, expect, it } from 'vitest';
import type { MaterialCalibrationEvidence } from './materialCalibration';
import type { Material } from './materials';
import {
  deriveYieldSampleLearning,
  YieldLearningError,
} from './yieldLearning';
import type { YieldSample } from './yieldSamples';

const plaster: Material = {
  id: 'MAT-PLASTER',
  name: 'Plaster',
  group: 'plaster',
  baseUnit: 'g',
  purchaseQuantity: 1,
  purchaseUnit: 'kg',
  packageCost: 66,
  onHandQuantity: 2,
  onHandUnit: 'kg',
  isActive: true,
};

const water: Material = {
  id: 'MAT-WATER',
  name: 'Water',
  group: 'liquid',
  baseUnit: 'mL',
  purchaseQuantity: 1,
  purchaseUnit: 'L',
  packageCost: 20,
  onHandQuantity: 1,
  onHandUnit: 'L',
  isActive: true,
};

const calibration: MaterialCalibrationEvidence = {
  id: 'CAL-PLASTER-1',
  materialId: 'MAT-PLASTER',
  measuredVolume: 5,
  volumeUnit: 'cup',
  knownWeight: 1,
  weightUnit: 'kg',
  recordedAt: '2026-09-14T08:00:00.000Z',
};

const sample: YieldSample = {
  id: 'YS-001',
  productId: 'ART-001',
  mixPresetId: 'MIX-PLASTER',
  materialInputs: [
    { materialId: 'MAT-PLASTER', quantity: 3, unit: 'cup' },
    { materialId: 'MAT-WATER', quantity: 1.5, unit: 'cup' },
  ],
  goodPieces: 8,
  rejectedPieces: 1,
  recordedAt: '2026-09-14T09:00:00.000Z',
};

describe('yield learning', () => {
  it('derives canonical consumption and per-good-piece requirements for every material', () => {
    const result = deriveYieldSampleLearning(sample, [plaster, water], [calibration]);

    expect(result.defectRate).toBeCloseTo(1 / 9);
    expect(result.totalPieces).toBe(9);

    expect(result.materialRequirements).toEqual([
      expect.objectContaining({
        materialId: 'MAT-PLASTER',
        normalizedBaseQuantityConsumed: 600,
        baseQuantityPerGoodPiece: 75,
        conversionSource: 'calibration',
        calibrationId: 'CAL-PLASTER-1',
      }),
      expect.objectContaining({
        materialId: 'MAT-WATER',
        normalizedBaseQuantityConsumed: 360,
        baseQuantityPerGoodPiece: 45,
        conversionSource: 'standard',
        calibrationId: null,
      }),
    ]);
  });

  it('does not put rejected pieces in the learning denominator', () => {
    const result = deriveYieldSampleLearning(
      { ...sample, materialInputs: [{ materialId: 'MAT-WATER', quantity: 1, unit: 'L' }] },
      [water],
    );

    expect(result.materialRequirements[0].normalizedBaseQuantityConsumed).toBe(1000);
    expect(result.materialRequirements[0].baseQuantityPerGoodPiece).toBe(125);
    expect(result.defectRate).toBeCloseTo(1 / 9);
  });

  it('uses calibration before a manual cup-to-gram fallback', () => {
    const manualPlaster: Material = {
      ...plaster,
      purchaseUnit: 'cup',
      purchaseQuantity: 1,
      manualBaseUnitsPerPurchaseUnit: 180,
    };

    const result = deriveYieldSampleLearning(
      { ...sample, materialInputs: [{ materialId: 'MAT-PLASTER', quantity: 1, unit: 'cup' }] },
      [manualPlaster],
      [calibration],
    );

    expect(result.materialRequirements[0].normalizedBaseQuantityConsumed).toBe(200);
    expect(result.materialRequirements[0].conversionSource).toBe('calibration');
  });

  it('uses the explicit manual cup-to-gram fallback when no calibration exists', () => {
    const manualPlaster: Material = {
      ...plaster,
      purchaseUnit: 'cup',
      purchaseQuantity: 1,
      manualBaseUnitsPerPurchaseUnit: 180,
    };

    const result = deriveYieldSampleLearning(
      { ...sample, materialInputs: [{ materialId: 'MAT-PLASTER', quantity: 2, unit: 'cup' }] },
      [manualPlaster],
    );

    expect(result.materialRequirements[0].normalizedBaseQuantityConsumed).toBe(360);
    expect(result.materialRequirements[0].conversionSource).toBe('manual');
    expect(result.materialRequirements[0].calibrationId).toBeNull();
  });

  it('rejects cup-to-weight learning when neither calibration nor manual fallback exists', () => {
    expect(() => deriveYieldSampleLearning(sample, [plaster, water])).toThrowError(
      expect.objectContaining<Partial<YieldLearningError>>({
        code: 'MISSING_MATERIAL_CALIBRATION',
        materialId: 'MAT-PLASTER',
      }),
    );
  });

  it('rejects learning when a referenced material no longer exists', () => {
    expect(() => deriveYieldSampleLearning(sample, [water], [calibration])).toThrowError(
      expect.objectContaining<Partial<YieldLearningError>>({
        code: 'MATERIAL_NOT_FOUND',
        materialId: 'MAT-PLASTER',
      }),
    );
  });
});
