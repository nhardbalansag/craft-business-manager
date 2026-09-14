import { describe, expect, it } from 'vitest';
import type { Material } from './materials';
import {
  MaterialCalibrationError,
  deriveMaterialCupWeightCalibration,
  type MaterialCalibrationEvidence,
} from './materialCalibration';

function material(overrides: Partial<Material> = {}): Material {
  return {
    id: 'MAT-PLASTER',
    name: 'Plaster Brand A',
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

function evidence(overrides: Partial<MaterialCalibrationEvidence> = {}): MaterialCalibrationEvidence {
  return {
    id: 'CAL-PLASTER-001',
    materialId: 'MAT-PLASTER',
    measuredVolume: 5,
    volumeUnit: 'cup',
    knownWeight: 1,
    weightUnit: 'kg',
    recordedAt: '2026-09-14T15:45:00+08:00',
    notes: '  Five level cups from the same bag.  ',
    ...overrides,
  };
}

describe('deriveMaterialCupWeightCalibration', () => {
  it('derives 200 g/cup from 5 cups weighing 1 kg', () => {
    const result = deriveMaterialCupWeightCalibration(material(), evidence());

    expect(result.measuredCups).toBe(5);
    expect(result.knownWeightGrams).toBe(1000);
    expect(result.gramsPerCup).toBe(200);
    expect(result.evidence.notes).toBe('Five level cups from the same bag.');
  });

  it('converts other supported volume and weight units before deriving grams per cup', () => {
    const result = deriveMaterialCupWeightCalibration(
      material(),
      evidence({ measuredVolume: 120, volumeUnit: 'mL', knownWeight: 100, weightUnit: 'g' }),
    );

    expect(result.measuredCups).toBe(0.5);
    expect(result.knownWeightGrams).toBe(100);
    expect(result.gramsPerCup).toBe(200);
  });

  it('supports fractional cup measurements without rounding the derived calibration', () => {
    const result = deriveMaterialCupWeightCalibration(
      material(),
      evidence({ measuredVolume: 0.25, knownWeight: 55, weightUnit: 'g' }),
    );

    expect(result.measuredCups).toBe(0.25);
    expect(result.gramsPerCup).toBe(220);
  });

  it('belongs to one specific material and rejects a mismatched material ID', () => {
    expect(() =>
      deriveMaterialCupWeightCalibration(
        material({ id: 'MAT-WAX', name: 'Soy Wax', group: 'wax' }),
        evidence(),
      ),
    ).toThrowError(expect.objectContaining({ code: 'MATERIAL_MISMATCH' }));
  });

  it('rejects calibration for a non-weight-based material', () => {
    expect(() =>
      deriveMaterialCupWeightCalibration(
        material({ id: 'MAT-WATER', name: 'Water', group: 'liquid', baseUnit: 'mL' }),
        evidence({ materialId: 'MAT-WATER' }),
      ),
    ).toThrowError(expect.objectContaining({ code: 'MATERIAL_NOT_WEIGHT_BASED' }));
  });

  it.each([
    ['zero measured volume', evidence({ measuredVolume: 0 }), 'NON_POSITIVE_VOLUME'],
    ['negative measured volume', evidence({ measuredVolume: -1 }), 'NON_POSITIVE_VOLUME'],
    ['non-finite measured volume', evidence({ measuredVolume: Number.NaN }), 'NON_FINITE_VOLUME'],
    ['zero known weight', evidence({ knownWeight: 0 }), 'NON_POSITIVE_WEIGHT'],
    ['negative known weight', evidence({ knownWeight: -5 }), 'NON_POSITIVE_WEIGHT'],
    ['non-finite known weight', evidence({ knownWeight: Number.POSITIVE_INFINITY }), 'NON_FINITE_WEIGHT'],
  ])('rejects %s', (_label, calibrationEvidence, code) => {
    try {
      deriveMaterialCupWeightCalibration(material(), calibrationEvidence);
      throw new Error('Expected calibration to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(MaterialCalibrationError);
      expect((error as MaterialCalibrationError).code).toBe(code);
    }
  });

  it('rejects a non-volume measurement unit at runtime', () => {
    const invalid = evidence() as MaterialCalibrationEvidence & { volumeUnit: string };
    invalid.volumeUnit = 'kg';

    expect(() =>
      deriveMaterialCupWeightCalibration(material(), invalid as MaterialCalibrationEvidence),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_VOLUME_UNIT' }));
  });

  it('rejects a non-weight known-weight unit at runtime', () => {
    const invalid = evidence() as MaterialCalibrationEvidence & { weightUnit: string };
    invalid.weightUnit = 'cup';

    expect(() =>
      deriveMaterialCupWeightCalibration(material(), invalid as MaterialCalibrationEvidence),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_WEIGHT_UNIT' }));
  });

  it('requires stable identity and a valid recordedAt timestamp', () => {
    expect(() => deriveMaterialCupWeightCalibration(material(), evidence({ id: '   ' }))).toThrowError(
      expect.objectContaining({ code: 'INVALID_CALIBRATION_ID' }),
    );

    expect(() =>
      deriveMaterialCupWeightCalibration(material(), evidence({ materialId: '   ' })),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_MATERIAL_ID' }));

    expect(() =>
      deriveMaterialCupWeightCalibration(material(), evidence({ recordedAt: 'not-a-date' })),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_RECORDED_AT' }));
  });
});
