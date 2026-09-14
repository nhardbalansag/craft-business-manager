import { describe, expect, it } from 'vitest';
import type { Material } from '../../domain/materials';
import type { MixPreset } from '../../domain/mixPresets';
import type { Product } from '../../domain/products';
import type { YieldSample } from '../../domain/yieldSamples';
import { InMemoryMaterialRepository } from '../materials/InMemoryMaterialRepository';
import { InMemoryMixPresetRepository } from '../mixPresets/InMemoryMixPresetRepository';
import { InMemoryProductRepository } from '../products/InMemoryProductRepository';
import { InMemoryYieldSampleRepository } from './InMemoryYieldSampleRepository';
import {
  YieldSampleApplicationError,
  YieldSampleEvidenceService,
} from './YieldSampleEvidenceService';

function material(id: string, overrides: Partial<Material> = {}): Material {
  const water = id === 'MAT-WATER';
  return {
    id,
    name: id,
    group: water ? 'liquid' : 'plaster',
    baseUnit: water ? 'mL' : 'g',
    purchaseQuantity: 1,
    purchaseUnit: water ? 'L' : 'kg',
    packageCost: 100,
    onHandQuantity: 1,
    onHandUnit: water ? 'L' : 'kg',
    isActive: true,
    ...overrides,
  };
}

function preset(overrides: Partial<MixPreset> = {}): MixPreset {
  return {
    id: 'MIX-PLASTER-2-1',
    name: 'Plaster 2:1',
    compatibleCategories: ['paintable-art', 'candle-pot'],
    basis: 'volume',
    lines: [
      { materialId: 'MAT-PLASTER', role: 'primary', parts: 2 },
      { materialId: 'MAT-WATER', role: 'secondary', parts: 1 },
    ],
    isActive: true,
    ...overrides,
  };
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'ART-001',
    name: 'Paintable Star',
    category: 'paintable-art',
    mixPresetId: 'MIX-PLASTER-2-1',
    safetyWasteRate: 0.05,
    isActive: true,
    ...overrides,
  };
}

function sample(overrides: Partial<YieldSample> = {}): YieldSample {
  return {
    id: 'YS-001',
    productId: 'ART-001',
    mixPresetId: 'MIX-PLASTER-2-1',
    materialInputs: [
      { materialId: 'MAT-PLASTER', quantity: 3, unit: 'cup' },
      { materialId: 'MAT-WATER', quantity: 1.5, unit: 'cup' },
    ],
    goodPieces: 8,
    rejectedPieces: 1,
    recordedAt: '2026-09-14T10:00:00+08:00',
    notes: ' batch one ',
    ...overrides,
  };
}

function setup() {
  const materialRepository = new InMemoryMaterialRepository([
    material('MAT-PLASTER'),
    material('MAT-WATER'),
  ]);
  const mixPresetRepository = new InMemoryMixPresetRepository([preset()]);
  const productRepository = new InMemoryProductRepository([product()]);
  const repository = new InMemoryYieldSampleRepository();
  const service = new YieldSampleEvidenceService(
    repository,
    productRepository,
    mixPresetRepository,
    materialRepository,
  );
  return { service, repository, materialRepository, mixPresetRepository, productRepository };
}

async function expectCode(
  promise: Promise<unknown>,
  code: YieldSampleApplicationError['code'],
) {
  try {
    await promise;
    throw new Error('Expected YieldSampleApplicationError.');
  } catch (error) {
    expect(error).toBeInstanceOf(YieldSampleApplicationError);
    expect((error as YieldSampleApplicationError).code).toBe(code);
  }
}

describe('YieldSampleEvidenceService', () => {
  it('records, normalizes, retrieves and filters immutable batch evidence', async () => {
    const { service } = setup();
    const created = await service.recordSample(
      sample({ id: ' YS-001 ', productId: ' ART-001 ', notes: '  batch one  ' }),
    );
    expect(created).toMatchObject({ id: 'YS-001', productId: 'ART-001', notes: 'batch one' });

    await service.recordSample(
      sample({
        id: 'YS-002',
        mixPresetId: undefined,
        materialInputs: [{ materialId: 'MAT-PLASTER', quantity: 600, unit: 'g' }],
        recordedAt: '2026-09-15T10:00:00+08:00',
      }),
    );

    expect((await service.listSamples({ productId: 'art-001' })).map((item) => item.id)).toEqual([
      'YS-002',
      'YS-001',
    ]);
    expect((await service.listSamples({ materialId: 'mat-water' })).map((item) => item.id)).toEqual([
      'YS-001',
    ]);
    expect((await service.listSamples({ mixPresetId: 'mix-plaster-2-1' })).map((item) => item.id)).toEqual([
      'YS-001',
    ]);
  });

  it('reserves sample IDs case-insensitively', async () => {
    const { service } = setup();
    await service.recordSample(sample());
    await expectCode(service.recordSample(sample({ id: 'ys-001' })), 'DUPLICATE_YIELD_SAMPLE_ID');
  });

  it('requires active product references for new samples', async () => {
    const { service, productRepository } = setup();
    await expectCode(service.recordSample(sample({ productId: 'MISSING' })), 'PRODUCT_NOT_FOUND');

    const existing = await productRepository.findById('ART-001');
    await productRepository.replace({ ...existing!, isActive: false });
    await expectCode(service.recordSample(sample()), 'PRODUCT_INACTIVE');
  });

  it('validates optional mix existence, active state and category compatibility', async () => {
    const { service, mixPresetRepository } = setup();
    await expectCode(
      service.recordSample(sample({ mixPresetId: 'MISSING' })),
      'MIX_PRESET_NOT_FOUND',
    );

    await mixPresetRepository.replace(preset({ isActive: false }));
    await expectCode(service.recordSample(sample()), 'MIX_PRESET_INACTIVE');

    await mixPresetRepository.replace(preset({ compatibleCategories: ['candle'] }));
    await expectCode(service.recordSample(sample()), 'MIX_PRESET_CATEGORY_MISMATCH');
  });

  it('requires active materials and rejects units that cannot normalize to the material base unit', async () => {
    const { service, materialRepository } = setup();
    await expectCode(
      service.recordSample(
        sample({ materialInputs: [{ materialId: 'MISSING', quantity: 1, unit: 'g' }] }),
      ),
      'MATERIAL_NOT_FOUND',
    );

    const water = await materialRepository.findById('MAT-WATER');
    await materialRepository.replace({ ...water!, isActive: false });
    await expectCode(service.recordSample(sample()), 'MATERIAL_INACTIVE');

    await materialRepository.replace({ ...water!, isActive: true });
    await expectCode(
      service.recordSample(
        sample({ materialInputs: [{ materialId: 'MAT-PLASTER', quantity: 50, unit: 'mL' }] }),
      ),
      'MATERIAL_UNIT_INCOMPATIBLE',
    );
  });

  it('allows the material-specific plaster cup-to-gram bridge without requiring calibration yet', async () => {
    const { service } = setup();
    await expect(
      service.recordSample(
        sample({ materialInputs: [{ materialId: 'MAT-PLASTER', quantity: 3, unit: 'cup' }] }),
      ),
    ).resolves.toMatchObject({ id: 'YS-001' });
  });

  it('retains historical evidence after referenced records are archived', async () => {
    const { service, productRepository, materialRepository, mixPresetRepository } = setup();
    await service.recordSample(sample());

    const productRecord = await productRepository.findById('ART-001');
    const materialRecord = await materialRepository.findById('MAT-PLASTER');
    const presetRecord = await mixPresetRepository.findById('MIX-PLASTER-2-1');
    await productRepository.replace({ ...productRecord!, isActive: false });
    await materialRepository.replace({ ...materialRecord!, isActive: false });
    await mixPresetRepository.replace({ ...presetRecord!, isActive: false });

    await expect(service.getSample('YS-001')).resolves.toMatchObject({
      id: 'YS-001',
      productId: 'ART-001',
    });
  });

  it('protects nested evidence from mutation through repository reads', async () => {
    const { service, repository } = setup();
    await service.recordSample(sample());
    const first = await repository.findById('YS-001');
    first!.materialInputs[0].quantity = 999;
    expect((await service.getSample('YS-001'))?.materialInputs[0].quantity).toBe(3);
  });
});
