import { describe, expect, it } from 'vitest';
import type { Material } from '../../domain/materials';
import { InMemoryCalibrationRepository } from '../calibrations/InMemoryCalibrationRepository';
import { InMemoryMaterialRepository } from './InMemoryMaterialRepository';
import { MaterialService } from './MaterialService';

function plaster(): Material {
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
  };
}

describe('MaterialService calibration integration', () => {
  it('allows calibrated cup stock to pass the persistence validation boundary', async () => {
    const materialRepository = new InMemoryMaterialRepository([plaster()]);
    const calibrationRepository = new InMemoryCalibrationRepository([
      {
        id: 'CAL-PLASTER-001',
        materialId: 'MAT-PLASTER',
        measuredVolume: 5,
        volumeUnit: 'cup',
        knownWeight: 1,
        weightUnit: 'kg',
        recordedAt: '2026-09-14T09:00:00+08:00',
      },
    ]);
    const materialService = new MaterialService(materialRepository, async (materialId) => {
      const records = await calibrationRepository.list();
      return records.filter(
        (record) => record.materialId.toLocaleLowerCase() === materialId.toLocaleLowerCase(),
      );
    });

    const updated = await materialService.updateMaterial('MAT-PLASTER', {
      onHandQuantity: 3,
      onHandUnit: 'cup',
    });

    expect(updated.onHandQuantity).toBe(3);
    expect(updated.onHandUnit).toBe('cup');
  });

  it('still rejects cup stock when no calibration/manual fallback exists', async () => {
    const materialRepository = new InMemoryMaterialRepository([plaster()]);
    const materialService = new MaterialService(materialRepository);

    await expect(
      materialService.updateMaterial('MAT-PLASTER', { onHandQuantity: 3, onHandUnit: 'cup' }),
    ).rejects.toMatchObject({ code: 'MISSING_MATERIAL_CALIBRATION' });
  });
});
