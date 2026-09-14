import { describe, expect, it } from 'vitest';
import { InMemoryCalibrationRepository } from '../calibrations/InMemoryCalibrationRepository';
import { InMemoryMaterialRepository } from '../materials/InMemoryMaterialRepository';
import { InMemoryProductRepository } from '../products/InMemoryProductRepository';
import type { Material } from '../../domain/materials';
import type { Product } from '../../domain/products';
import type { YieldSample } from '../../domain/yieldSamples';
import { InMemoryYieldSampleRepository } from './InMemoryYieldSampleRepository';
import { YieldHistoryService, YieldHistoryServiceError } from './YieldHistoryService';

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'PROD-1',
    name: 'Small Star',
    category: 'paintable-art',
    safetyWasteRate: 0.05,
    isActive: true,
    ...overrides,
  };
}

function plaster(overrides: Partial<Material> = {}): Material {
  return {
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
    ...overrides,
  };
}

function sample(
  id: string,
  recordedAt: string,
  quantity: number,
  unit: YieldSample['materialInputs'][number]['unit'] = 'g',
): YieldSample {
  return {
    id,
    productId: 'PROD-1',
    materialInputs: [{ materialId: 'MAT-PLASTER', quantity, unit }],
    goodPieces: 8,
    rejectedPieces: 1,
    recordedAt,
  };
}

function service(options: {
  products?: Product[];
  materials?: Material[];
  samples?: YieldSample[];
} = {}) {
  const sampleRepository = new InMemoryYieldSampleRepository(options.samples ?? []);
  const instance = new YieldHistoryService(
    sampleRepository,
    new InMemoryProductRepository(options.products ?? [product()]),
    new InMemoryMaterialRepository(options.materials ?? [plaster()]),
    new InMemoryCalibrationRepository(),
  );
  return { instance, sampleRepository };
}

describe('YieldHistoryService', () => {
  it('returns newest-first product history with deterministic ID tie-breaking', async () => {
    const recordedAt = '2026-09-10T08:00:00.000Z';
    const { instance } = service({
      samples: [
        sample('YS-001', '2026-09-09T08:00:00.000Z', 800),
        sample('YS-002', recordedAt, 760),
        sample('YS-003', recordedAt, 720),
      ],
    });

    await expect(instance.listHistory('prod-1')).resolves.toMatchObject([
      { id: 'YS-003' },
      { id: 'YS-002' },
      { id: 'YS-001' },
    ]);
  });

  it('selects the latest derivable sample and identifies it in the learned result', async () => {
    const { instance } = service({
      samples: [
        sample('YS-OLD', '2026-09-09T08:00:00.000Z', 800),
        sample('YS-NEW', '2026-09-10T08:00:00.000Z', 600),
      ],
    });

    const effective = await instance.getEffective('PROD-1');

    expect(effective.sample.id).toBe('YS-NEW');
    expect(effective.learning.sampleId).toBe('YS-NEW');
    expect(effective.learning.materialRequirements[0].baseQuantityPerGoodPiece).toBe(75);
    expect(effective.skippedInvalidSampleIds).toEqual([]);
  });

  it('skips a newer non-derivable sample and falls back to the newest valid history record', async () => {
    const { instance } = service({
      samples: [
        sample('YS-VALID', '2026-09-09T08:00:00.000Z', 800, 'g'),
        sample('YS-BROKEN', '2026-09-10T08:00:00.000Z', 3, 'cup'),
      ],
    });

    const effective = await instance.getEffective('PROD-1');

    expect(effective.sample.id).toBe('YS-VALID');
    expect(effective.skippedInvalidSampleIds).toEqual(['YS-BROKEN']);
    expect(effective.learning.materialRequirements[0].baseQuantityPerGoodPiece).toBe(100);
  });

  it('reports when a product has history but no currently valid sample', async () => {
    const { instance } = service({
      samples: [sample('YS-BROKEN', '2026-09-10T08:00:00.000Z', 3, 'cup')],
    });

    await expect(instance.getEffective('PROD-1')).rejects.toMatchObject({
      name: 'YieldHistoryServiceError',
      code: 'NO_VALID_SAMPLES',
      productId: 'PROD-1',
    });
  });

  it('blocks deleting the last effective sample for an active product', async () => {
    const { instance, sampleRepository } = service({
      samples: [sample('YS-ONLY', '2026-09-10T08:00:00.000Z', 600)],
    });

    await expect(instance.deleteSample('YS-ONLY')).rejects.toMatchObject({
      name: 'YieldHistoryServiceError',
      code: 'LAST_EFFECTIVE_SAMPLE',
      productId: 'PROD-1',
      sampleId: 'YS-ONLY',
    });
    await expect(sampleRepository.findById('YS-ONLY')).resolves.not.toBeNull();
  });

  it('allows deleting the current effective sample when another valid sample can take over', async () => {
    const { instance, sampleRepository } = service({
      samples: [
        sample('YS-OLD', '2026-09-09T08:00:00.000Z', 800),
        sample('YS-NEW', '2026-09-10T08:00:00.000Z', 600),
      ],
    });

    await instance.deleteSample('ys-new');

    await expect(sampleRepository.findById('YS-NEW')).resolves.toBeNull();
    await expect(instance.getEffective('PROD-1')).resolves.toMatchObject({
      sample: { id: 'YS-OLD' },
      learning: { sampleId: 'YS-OLD' },
    });
  });

  it('allows deleting a non-effective broken history record', async () => {
    const { instance, sampleRepository } = service({
      samples: [
        sample('YS-VALID', '2026-09-09T08:00:00.000Z', 800, 'g'),
        sample('YS-BROKEN', '2026-09-10T08:00:00.000Z', 3, 'cup'),
      ],
    });

    await instance.deleteSample('YS-BROKEN');

    await expect(sampleRepository.findById('YS-BROKEN')).resolves.toBeNull();
    await expect(instance.getEffective('PROD-1')).resolves.toMatchObject({
      sample: { id: 'YS-VALID' },
    });
  });

  it('allows an archived product to remove its final evidence sample', async () => {
    const { instance, sampleRepository } = service({
      products: [product({ isActive: false })],
      samples: [sample('YS-FINAL', '2026-09-10T08:00:00.000Z', 600)],
    });

    await instance.deleteSample('YS-FINAL');

    await expect(sampleRepository.findById('YS-FINAL')).resolves.toBeNull();
  });

  it('returns controlled errors for unknown product/sample identities', async () => {
    const { instance } = service();

    await expect(instance.listHistory('MISSING')).rejects.toBeInstanceOf(YieldHistoryServiceError);
    await expect(instance.listHistory('MISSING')).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
    await expect(instance.deleteSample('MISSING')).rejects.toMatchObject({ code: 'SAMPLE_NOT_FOUND' });
  });
});
