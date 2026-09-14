import { describe, expect, it } from 'vitest';
import { InMemoryCalibrationRepository } from '../calibrations/InMemoryCalibrationRepository';
import { InMemoryMaterialRepository } from '../materials/InMemoryMaterialRepository';
import { InMemoryYieldSampleRepository } from './InMemoryYieldSampleRepository';
import { YieldLearningService, YieldLearningServiceError } from './YieldLearningService';
import type { Material } from '../../domain/materials';
import type { YieldSample } from '../../domain/yieldSamples';

const material: Material = {
  id: 'MAT-WAX',
  name: 'Soy Wax',
  group: 'wax',
  baseUnit: 'g',
  purchaseQuantity: 1,
  purchaseUnit: 'kg',
  packageCost: 200,
  onHandQuantity: 1,
  onHandUnit: 'kg',
  isActive: false,
};

const sample: YieldSample = {
  id: 'YS-WAX-1',
  productId: 'CND-001',
  materialInputs: [{ materialId: 'MAT-WAX', quantity: 500, unit: 'g' }],
  goodPieces: 10,
  rejectedPieces: 2,
  recordedAt: '2026-09-14T09:00:00.000Z',
};

describe('YieldLearningService', () => {
  it('derives learning from stored historical evidence even when a material is archived', async () => {
    const service = new YieldLearningService(
      new InMemoryYieldSampleRepository([sample]),
      new InMemoryMaterialRepository([material]),
      new InMemoryCalibrationRepository(),
    );

    const result = await service.deriveBySampleId('ys-wax-1');
    expect(result.materialRequirements[0].baseQuantityPerGoodPiece).toBe(50);
    expect(result.defectRate).toBeCloseTo(2 / 12);
  });

  it('returns a controlled error when the sample does not exist', async () => {
    const service = new YieldLearningService(
      new InMemoryYieldSampleRepository(),
      new InMemoryMaterialRepository([material]),
      new InMemoryCalibrationRepository(),
    );

    await expect(service.deriveBySampleId('missing')).rejects.toEqual(
      expect.objectContaining<Partial<YieldLearningServiceError>>({
        code: 'SAMPLE_NOT_FOUND',
        sampleId: 'missing',
      }),
    );
  });
});
