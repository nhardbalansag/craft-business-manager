import { describe, expect, it } from 'vitest';
import type { Material } from '../../domain/materials';
import { CalibrationApplicationError, CalibrationService } from './CalibrationService';
import { InMemoryCalibrationRepository } from './InMemoryCalibrationRepository';
import { InMemoryMaterialRepository } from '../materials/InMemoryMaterialRepository';

function plaster(overrides: Partial<Material> = {}): Material {
  return {
    id: 'MAT-PLASTER',
    name: 'Plaster Brand A',
    group: 'plaster',
    baseUnit: 'g',
    purchaseQuantity: 1,
    purchaseUnit: 'kg',
    packageCost: 66,
    onHandQuantity: 1,
    onHandUnit: 'kg',
    isActive: true,
    ...overrides,
  };
}

function service() {
  const materials = new InMemoryMaterialRepository([plaster()]);
  const calibrations = new InMemoryCalibrationRepository();
  return new CalibrationService(calibrations, materials);
}

describe('CalibrationService', () => {
  it('creates, lists, and resolves the effective calibration', async () => {
    const calibrationService = service();

    await calibrationService.createCalibration({
      id: 'CAL-OLD',
      materialId: 'MAT-PLASTER',
      measuredVolume: 5,
      volumeUnit: 'cup',
      knownWeight: 1,
      weightUnit: 'kg',
      recordedAt: '2026-09-01T09:00:00+08:00',
    });
    await calibrationService.createCalibration({
      id: 'CAL-NEW',
      materialId: 'MAT-PLASTER',
      measuredVolume: 4,
      volumeUnit: 'cup',
      knownWeight: 0.84,
      weightUnit: 'kg',
      recordedAt: '2026-09-14T09:00:00+08:00',
    });

    const records = await calibrationService.listCalibrations('mat-plaster');
    expect(records.map((record) => record.id)).toEqual(['CAL-NEW', 'CAL-OLD']);

    const effective = await calibrationService.getEffectiveCalibration('MAT-PLASTER');
    expect(effective?.evidence.id).toBe('CAL-NEW');
    expect(effective?.gramsPerCup).toBe(210);
  });

  it('rejects unknown materials and duplicate IDs', async () => {
    const calibrationService = service();

    await expect(
      calibrationService.createCalibration({
        id: 'CAL-MISSING',
        materialId: 'MAT-MISSING',
        measuredVolume: 1,
        volumeUnit: 'cup',
        knownWeight: 200,
        weightUnit: 'g',
        recordedAt: '2026-09-14T09:00:00+08:00',
      }),
    ).rejects.toMatchObject({ code: 'MATERIAL_NOT_FOUND' });

    const evidence = {
      id: 'CAL-001',
      materialId: 'MAT-PLASTER',
      measuredVolume: 5,
      volumeUnit: 'cup' as const,
      knownWeight: 1000,
      weightUnit: 'g' as const,
      recordedAt: '2026-09-14T09:00:00+08:00',
    };
    await calibrationService.createCalibration(evidence);
    await expect(calibrationService.createCalibration({ ...evidence, id: ' cal-001 ' })).rejects.toMatchObject({
      code: 'DUPLICATE_CALIBRATION_ID',
    });
  });

  it('deletes calibration evidence and returns null when no effective sample remains', async () => {
    const calibrationService = service();
    await calibrationService.createCalibration({
      id: 'CAL-001',
      materialId: 'MAT-PLASTER',
      measuredVolume: 5,
      volumeUnit: 'cup',
      knownWeight: 1,
      weightUnit: 'kg',
      recordedAt: '2026-09-14T09:00:00+08:00',
    });

    await calibrationService.deleteCalibration('CAL-001');
    expect(await calibrationService.getEffectiveCalibration('MAT-PLASTER')).toBeNull();

    await expect(calibrationService.deleteCalibration('CAL-001')).rejects.toBeInstanceOf(
      CalibrationApplicationError,
    );
  });
});
