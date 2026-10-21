import { describe, expect, it } from 'vitest';
import type { Material } from '../../domain/materials';
import type { MixPreset } from '../../domain/mixPresets';
import type { Mold } from '../../domain/molds';
import type { PlasterMoldYieldProfile } from '../../domain/plasterMoldYieldProfiles';
import type { Product } from '../../domain/products';
import type { YieldMoldFormulaSource } from '../../domain/yieldMoldFormulaSource';
import type { YieldSample } from '../../domain/yieldSamples';
import { InMemoryMaterialRepository } from '../materials/InMemoryMaterialRepository';
import { InMemoryMixPresetRepository } from '../mixPresets/InMemoryMixPresetRepository';
import { InMemoryMoldRepository } from '../molds/InMemoryMoldRepository';
import { InMemoryPlasterMoldYieldProfileRepository } from '../plasterMoldYieldProfiles/InMemoryPlasterMoldYieldProfileRepository';
import { InMemoryProductRepository } from '../products/InMemoryProductRepository';
import { InMemoryYieldMoldFormulaSourceRepository } from '../yieldMoldFormulaSources/InMemoryYieldMoldFormulaSourceRepository';
import { YieldMoldFormulaSourceService } from '../yieldMoldFormulaSources/YieldMoldFormulaSourceService';
import { InMemoryYieldSampleRepository } from '../yieldSamples/InMemoryYieldSampleRepository';
import { YieldSampleEvidenceService } from '../yieldSamples/YieldSampleEvidenceService';
import {
  YieldRecipeSourceRecordingError,
  YieldRecipeSourceRecordingService,
} from './YieldRecipeSourceRecordingService';

function material(overrides: Partial<Material> = {}): Material {
  return {
    id: 'MAT-PLASTER',
    name: 'Plaster',
    group: 'plaster',
    baseUnit: 'g',
    purchaseQuantity: 1000,
    purchaseUnit: 'g',
    packageCost: 100,
    onHandQuantity: 5000,
    onHandUnit: 'g',
    isActive: true,
    ...overrides,
  };
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'PROD-001',
    name: 'Paintable Dino',
    category: 'paintable-art',
    safetyWasteRate: 0.05,
    isActive: true,
    ...overrides,
  };
}

function preset(overrides: Partial<MixPreset> = {}): MixPreset {
  return {
    id: 'MIX-001',
    name: 'Standard plaster',
    compatibleCategories: ['paintable-art'],
    basis: 'weight',
    lines: [
      {
        materialId: 'MAT-PLASTER',
        role: 'primary',
        parts: 1,
      },
    ],
    isActive: true,
    ...overrides,
  };
}

function mold(overrides: Partial<Mold> = {}): Mold {
  return {
    id: 'MOLD-001',
    productId: 'PROD-001',
    name: 'Dino Mold',
    isActive: true,
    ...overrides,
  };
}

function profile(
  overrides: Partial<PlasterMoldYieldProfile> = {},
): PlasterMoldYieldProfile {
  return {
    id: 'PMYP-001',
    moldId: 'MOLD-001',
    waterMaterialId: 'MAT-WATER',
    plasterMaterialId: 'MAT-PLASTER',
    glueMaterialId: 'MAT-GLUE',
    waterFillWeightGrams: 50,
    waterAdjustmentRate: 0.3,
    plasterFactor: 0.75,
    glueFactor: 0.05,
    piecesPerPour: 4,
    isActive: true,
    ...overrides,
  };
}

function sample(
  overrides: Partial<Omit<YieldSample, 'mixPresetId'>> = {},
): Omit<YieldSample, 'mixPresetId'> {
  return {
    id: 'YLD-001',
    productId: 'PROD-001',
    materialInputs: [
      {
        materialId: 'MAT-PLASTER',
        quantity: 100,
        unit: 'g',
      },
    ],
    goodPieces: 4,
    rejectedPieces: 0,
    recordedAt: '2026-09-29T11:00:00.000Z',
    ...overrides,
  };
}

class FailAfterInsertSourceRepository extends InMemoryYieldMoldFormulaSourceRepository {
  override async insert(source: YieldMoldFormulaSource): Promise<void> {
    await super.insert(source);
    throw new Error('source insert failed after write');
  }
}

class FailInsertAndRollbackSourceRepository extends FailAfterInsertSourceRepository {
  override async delete(_yieldSampleId: string): Promise<void> {
    throw new Error('source rollback failed');
  }
}

function setup(options: {
  yieldRepository?: InMemoryYieldSampleRepository;
  sourceRepository?: InMemoryYieldMoldFormulaSourceRepository;
  materials?: Material[];
  products?: Product[];
  presets?: MixPreset[];
  molds?: Mold[];
  profiles?: PlasterMoldYieldProfile[];
} = {}) {
  const yieldRepository =
    options.yieldRepository ?? new InMemoryYieldSampleRepository();
  const sourceRepository =
    options.sourceRepository ??
    new InMemoryYieldMoldFormulaSourceRepository();
  const materialRepository = new InMemoryMaterialRepository(
    options.materials ?? [material()],
  );
  const productRepository = new InMemoryProductRepository(
    options.products ?? [product()],
  );
  const mixPresetRepository = new InMemoryMixPresetRepository(
    options.presets ?? [preset()],
  );
  const moldRepository = new InMemoryMoldRepository(
    options.molds ?? [mold()],
  );
  const profileRepository =
    new InMemoryPlasterMoldYieldProfileRepository(
      options.profiles ?? [profile()],
    );

  const evidence = new YieldSampleEvidenceService(
    yieldRepository,
    productRepository,
    mixPresetRepository,
    materialRepository,
  );
  const provenance = new YieldMoldFormulaSourceService(
    sourceRepository,
    yieldRepository,
    moldRepository,
    profileRepository,
  );

  return {
    yieldRepository,
    sourceRepository,
    evidence,
    provenance,
    service: new YieldRecipeSourceRecordingService(
      evidence,
      provenance,
      yieldRepository,
      sourceRepository,
    ),
  };
}

describe('YRS2B YieldRecipeSourceRecordingService', () => {
  it('records Manual evidence without MixPreset or Mold Formula provenance', async () => {
    const { service, yieldRepository, sourceRepository } = setup();

    const result = await service.record({
      sample: sample(),
      source: { kind: 'manual' },
    });

    expect(result).toMatchObject({
      sample: {
        id: 'YLD-001',
        mixPresetId: undefined,
      },
      recipeSource: { kind: 'manual' },
    });
    expect(result.moldFormulaSource).toBeUndefined();
    await expect(
      yieldRepository.findById('YLD-001'),
    ).resolves.toMatchObject({
      id: 'YLD-001',
      mixPresetId: undefined,
    });
    await expect(
      sourceRepository.findByYieldSampleId('YLD-001'),
    ).resolves.toBeNull();
  });

  it('rejects a blank Mix preset source selection before writing evidence', async () => {
    const { service, yieldRepository, sourceRepository } = setup();

    await expect(
      service.record({
        sample: sample(),
        source: {
          kind: 'mix-preset',
          mixPresetId: '   ',
        },
      }),
    ).rejects.toMatchObject({
      name: 'YieldSampleContractError',
      code: 'INVALID_MIX_PRESET_ID',
    });

    await expect(yieldRepository.list()).resolves.toEqual([]);
    await expect(sourceRepository.list()).resolves.toEqual([]);
  });

  it('records Mix preset provenance through the existing YieldSample field', async () => {
    const { service, yieldRepository, sourceRepository } = setup();

    const result = await service.record({
      sample: sample(),
      source: {
        kind: 'mix-preset',
        mixPresetId: ' MIX-001 ',
      },
    });

    expect(result.recipeSource).toEqual({
      kind: 'mix-preset',
      mixPresetId: 'MIX-001',
    });
    await expect(
      yieldRepository.findById('YLD-001'),
    ).resolves.toMatchObject({
      mixPresetId: 'MIX-001',
    });
    await expect(
      sourceRepository.findByYieldSampleId('YLD-001'),
    ).resolves.toBeNull();
  });

  it('atomically records Yield evidence plus Mold Formula provenance', async () => {
    const { service, yieldRepository, sourceRepository } = setup();

    const result = await service.record({
      sample: sample({
        id: ' YLD-001 ',
      }),
      source: {
        kind: 'mold-formula',
        moldId: ' mold-001 ',
        moldYieldProfileId: ' pmyp-001 ',
      },
    });

    expect(result).toEqual({
      sample: expect.objectContaining({
        id: 'YLD-001',
        mixPresetId: undefined,
      }),
      recipeSource: {
        kind: 'mold-formula',
        moldId: 'MOLD-001',
        moldYieldProfileId: 'PMYP-001',
      },
      moldFormulaSource: {
        yieldSampleId: 'YLD-001',
        moldId: 'MOLD-001',
        moldYieldProfileId: 'PMYP-001',
      },
    });

    await expect(
      yieldRepository.findById('YLD-001'),
    ).resolves.not.toBeNull();
    await expect(
      sourceRepository.findByYieldSampleId('YLD-001'),
    ).resolves.toEqual({
      yieldSampleId: 'YLD-001',
      moldId: 'MOLD-001',
      moldYieldProfileId: 'PMYP-001',
    });
  });

  it('fails preflight without writing either record when Yield evidence is invalid', async () => {
    const { service, yieldRepository, sourceRepository } = setup();

    await expect(
      service.record({
        sample: sample({
          materialInputs: [
            {
              materialId: 'MISSING',
              quantity: 100,
              unit: 'g',
            },
          ],
        }),
        source: {
          kind: 'mold-formula',
          moldId: 'MOLD-001',
          moldYieldProfileId: 'PMYP-001',
        },
      }),
    ).rejects.toMatchObject({
      code: 'MATERIAL_NOT_FOUND',
    });

    await expect(yieldRepository.list()).resolves.toEqual([]);
    await expect(sourceRepository.list()).resolves.toEqual([]);
  });

  it('fails preflight without writing either record when Mold Formula provenance is invalid', async () => {
    const { service, yieldRepository, sourceRepository } = setup({
      molds: [mold({ isActive: false })],
    });

    await expect(
      service.record({
        sample: sample(),
        source: {
          kind: 'mold-formula',
          moldId: 'MOLD-001',
          moldYieldProfileId: 'PMYP-001',
        },
      }),
    ).rejects.toMatchObject({
      code: 'MOLD_INACTIVE_AT_RECORDING',
    });

    await expect(yieldRepository.list()).resolves.toEqual([]);
    await expect(sourceRepository.list()).resolves.toEqual([]);
  });

  it('constructs source exclusivity by design instead of persisting two source types', async () => {
    const { service, yieldRepository } = setup();

    const rogueSample = {
      ...sample(),
      mixPresetId: 'MIX-ROGUE',
    } as YieldSample;

    await service.record({
      sample: rogueSample,
      source: {
        kind: 'mold-formula',
        moldId: 'MOLD-001',
        moldYieldProfileId: 'PMYP-001',
      },
    });

    const saved = await yieldRepository.findById('YLD-001');
    expect(saved?.mixPresetId).toBeUndefined();
  });

  it('also strips stray runtime MixPreset data in Manual mode', async () => {
    const { service, yieldRepository } = setup();
    const rogueSample = {
      ...sample(),
      mixPresetId: 'MIX-ROGUE',
    } as YieldSample;

    const result = await service.record({
      sample: rogueSample,
      source: { kind: 'manual' },
    });

    expect(result.recipeSource).toEqual({ kind: 'manual' });
    expect(
      (await yieldRepository.findById('YLD-001'))?.mixPresetId,
    ).toBeUndefined();
  });

  it('rolls back both identities when provenance insert fails after writing', async () => {
    const sourceRepository = new FailAfterInsertSourceRepository();
    const { service, yieldRepository } = setup({
      sourceRepository,
    });

    await expect(
      service.record({
        sample: sample(),
        source: {
          kind: 'mold-formula',
          moldId: 'MOLD-001',
          moldYieldProfileId: 'PMYP-001',
        },
      }),
    ).rejects.toMatchObject({
      name: 'YieldRecipeSourceRecordingError',
      code: 'APPLY_FAILED_RESTORED',
      sampleId: 'YLD-001',
    });

    await expect(yieldRepository.list()).resolves.toEqual([]);
    await expect(sourceRepository.list()).resolves.toEqual([]);
  });

  it('reports rollback failure distinctly when partial state cannot be fully cleared', async () => {
    const sourceRepository =
      new FailInsertAndRollbackSourceRepository();
    const { service, yieldRepository } = setup({
      sourceRepository,
    });

    await expect(
      service.record({
        sample: sample(),
        source: {
          kind: 'mold-formula',
          moldId: 'MOLD-001',
          moldYieldProfileId: 'PMYP-001',
        },
      }),
    ).rejects.toMatchObject({
      name: 'YieldRecipeSourceRecordingError',
      code: 'ROLLBACK_FAILED',
      sampleId: 'YLD-001',
    });

    await expect(yieldRepository.list()).resolves.toEqual([]);
    await expect(sourceRepository.list()).resolves.toEqual([
      {
        yieldSampleId: 'YLD-001',
        moldId: 'MOLD-001',
        moldYieldProfileId: 'PMYP-001',
      },
    ]);
  });

  it('rejects Manual or Mix preset recording when orphan Mold Formula provenance already reserves the sample ID', async () => {
    const sourceRepository =
      new InMemoryYieldMoldFormulaSourceRepository([
        {
          yieldSampleId: 'YLD-001',
          moldId: 'MOLD-001',
          moldYieldProfileId: 'PMYP-001',
        },
      ]);
    const { service, yieldRepository } = setup({
      sourceRepository,
    });

    await expect(
      service.record({
        sample: sample(),
        source: { kind: 'manual' },
      }),
    ).rejects.toMatchObject({
      name: 'YieldRecipeSourceRecordingError',
      code: 'EXISTING_MOLD_FORMULA_SOURCE',
      sampleId: 'YLD-001',
    });

    await expect(yieldRepository.list()).resolves.toEqual([]);
  });

  it('keeps the legacy direct evidence recording path available', async () => {
    const { evidence, yieldRepository, sourceRepository } = setup();

    await expect(
      evidence.recordSample({
        ...sample(),
        mixPresetId: 'MIX-001',
      }),
    ).resolves.toMatchObject({
      id: 'YLD-001',
      mixPresetId: 'MIX-001',
    });

    await expect(
      yieldRepository.findById('YLD-001'),
    ).resolves.not.toBeNull();
    await expect(sourceRepository.list()).resolves.toEqual([]);
  });
});
