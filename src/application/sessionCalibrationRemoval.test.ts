import { beforeEach, describe, expect, it } from 'vitest';
import {
  calibrationRepository,
  materialRepository,
  yieldLearningService,
  yieldSampleRepository,
} from './session';

describe('Calibration feature removal runtime boundary', () => {
  beforeEach(async () => {
    await Promise.all([
      calibrationRepository.replaceAll([]),
      materialRepository.replaceAll([]),
      yieldSampleRepository.replaceAll([]),
    ]);
  });

  it('keeps legacy calibration evidence inert and uses explicit manual cup-to-gram conversion', async () => {
    await materialRepository.replaceAll([
      {
        id: 'MAT-PLASTER',
        name: 'Plaster',
        group: 'plaster',
        baseUnit: 'g',
        purchaseQuantity: 1,
        purchaseUnit: 'cup',
        packageCost: 20,
        manualBaseUnitsPerPurchaseUnit: 100,
        onHandQuantity: 2,
        onHandUnit: 'cup',
        isActive: true,
      },
    ]);

    await calibrationRepository.replaceAll([
      {
        id: 'CAL-LEGACY',
        materialId: 'MAT-PLASTER',
        measuredVolume: 1,
        volumeUnit: 'cup',
        knownWeight: 200,
        weightUnit: 'g',
        recordedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    await yieldSampleRepository.replaceAll([
      {
        id: 'YS-1',
        productId: 'PRD-1',
        materialInputs: [
          {
            materialId: 'MAT-PLASTER',
            quantity: 1,
            unit: 'cup',
          },
        ],
        goodPieces: 1,
        rejectedPieces: 0,
        recordedAt: '2026-01-02T00:00:00.000Z',
      },
    ]);

    const learning = await yieldLearningService.deriveBySampleId('YS-1');
    expect(learning.materialRequirements).toHaveLength(1);
    expect(learning.materialRequirements[0]).toMatchObject({
      materialId: 'MAT-PLASTER',
      normalizedBaseQuantityConsumed: 100,
      baseQuantityPerGoodPiece: 100,
      conversionSource: 'manual',
      calibrationId: null,
    });
  });
});
