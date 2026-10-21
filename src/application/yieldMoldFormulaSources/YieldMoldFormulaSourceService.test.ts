import { describe, expect, it } from 'vitest';
import type { Mold } from '../../domain/molds';
import type { PlasterMoldYieldProfile } from '../../domain/plasterMoldYieldProfiles';
import type { YieldMoldFormulaSource } from '../../domain/yieldMoldFormulaSource';
import type { YieldSample } from '../../domain/yieldSamples';
import { InMemoryMoldRepository } from '../molds/InMemoryMoldRepository';
import { InMemoryPlasterMoldYieldProfileRepository } from '../plasterMoldYieldProfiles/InMemoryPlasterMoldYieldProfileRepository';
import { InMemoryYieldSampleRepository } from '../yieldSamples/InMemoryYieldSampleRepository';
import { InMemoryYieldMoldFormulaSourceRepository } from './InMemoryYieldMoldFormulaSourceRepository';
import {
  YieldMoldFormulaSourceApplicationError,
  YieldMoldFormulaSourceService,
} from './YieldMoldFormulaSourceService';

function sample(
  id = 'YLD-001',
  overrides: Partial<YieldSample> = {},
): YieldSample {
  return {
    id,
    productId: 'PROD-001',
    materialInputs: [
      {
        materialId: 'MAT-001',
        quantity: 10,
        unit: 'g',
      },
    ],
    goodPieces: 1,
    rejectedPieces: 0,
    recordedAt: '2026-09-29T00:00:00.000Z',
    ...overrides,
  };
}

function mold(
  id = 'MOLD-001',
  overrides: Partial<Mold> = {},
): Mold {
  return {
    id,
    productId: 'PROD-001',
    name: id,
    isActive: true,
    ...overrides,
  };
}

function profile(
  id = 'PMYP-001',
  moldId = 'MOLD-001',
  overrides: Partial<PlasterMoldYieldProfile> = {},
): PlasterMoldYieldProfile {
  return {
    id,
    moldId,
    waterMaterialId: 'MAT-WATER',
    plasterMaterialId: 'MAT-PLASTER',
    glueMaterialId: 'MAT-GLUE',
    waterFillWeightGrams: 50,
    waterAdjustmentRate: 0.3,
    plasterFactor: 0.75,
    glueFactor: 0.05,
    piecesPerPour: 1,
    isActive: true,
    ...overrides,
  };
}

function source(
  overrides: Partial<YieldMoldFormulaSource> = {},
): YieldMoldFormulaSource {
  return {
    yieldSampleId: 'YLD-001',
    moldId: 'MOLD-001',
    moldYieldProfileId: 'PMYP-001',
    ...overrides,
  };
}

function setup(overrides: {
  sources?: YieldMoldFormulaSource[];
  yieldSamples?: YieldSample[];
  molds?: Mold[];
  profiles?: PlasterMoldYieldProfile[];
} = {}) {
  const sourceRepository =
    new InMemoryYieldMoldFormulaSourceRepository(
      overrides.sources ?? [],
    );
  const yieldSamples = new InMemoryYieldSampleRepository(
    overrides.yieldSamples ?? [sample()],
  );
  const molds = new InMemoryMoldRepository(
    overrides.molds ?? [mold()],
  );
  const profiles =
    new InMemoryPlasterMoldYieldProfileRepository(
      overrides.profiles ?? [profile()],
    );

  return {
    sourceRepository,
    service: new YieldMoldFormulaSourceService(
      sourceRepository,
      yieldSamples,
      molds,
      profiles,
    ),
  };
}

describe('YRS2A YieldMoldFormulaSourceService', () => {
  it('creates canonical immutable provenance for an existing active source graph', async () => {
    const { service } = setup();

    const created = await service.createSource({
      yieldSampleId: ' yld-001 ',
      moldId: ' mold-001 ',
      moldYieldProfileId: ' pmyp-001 ',
    });

    expect(created).toEqual(source());
    await expect(
      service.getSourceForYieldSample(' YLD-001 '),
    ).resolves.toEqual(source());
  });

  it('rejects a second provenance source for the same Yield Sample', async () => {
    const { service } = setup({
      sources: [source()],
    });

    await expect(
      service.createSource(source({ moldId: 'MOLD-002' })),
    ).rejects.toMatchObject({
      name: 'YieldMoldFormulaSourceApplicationError',
      code: 'SOURCE_ALREADY_EXISTS',
      yieldSampleId: 'YLD-001',
    });
  });

  it('enforces MixPreset/Mold Formula exclusivity through the application boundary', async () => {
    const { service } = setup({
      yieldSamples: [
        sample('YLD-001', {
          mixPresetId: 'MIX-001',
        }),
      ],
    });

    await expect(
      service.createSource(source()),
    ).rejects.toMatchObject({
      code: 'MIX_PRESET_SOURCE_CONFLICT',
      yieldSampleId: 'YLD-001',
    });
  });

  it('rejects missing and ownership-mismatched references', async () => {
    const missing = setup({
      molds: [],
    });

    await expect(
      missing.service.createSource(source()),
    ).rejects.toMatchObject({
      code: 'MISSING_MOLD_REFERENCE',
      field: 'moldId',
    });

    const mismatch = setup({
      molds: [
        mold('MOLD-001', {
          productId: 'PROD-OTHER',
        }),
      ],
    });

    await expect(
      mismatch.service.createSource(source()),
    ).rejects.toMatchObject({
      code: 'MOLD_PRODUCT_MISMATCH',
      field: 'moldId',
    });
  });

  it('rejects a profile that belongs to another Mold', async () => {
    const { service } = setup({
      profiles: [profile('PMYP-001', 'MOLD-OTHER')],
    });

    await expect(
      service.createSource(source()),
    ).rejects.toMatchObject({
      code: 'PROFILE_MOLD_MISMATCH',
      field: 'moldYieldProfileId',
    });
  });

  it('requires active Mold/profile references for a newly created provenance source', async () => {
    const archivedMold = setup({
      molds: [mold('MOLD-001', { isActive: false })],
    });

    await expect(
      archivedMold.service.createSource(source()),
    ).rejects.toMatchObject({
      code: 'MOLD_INACTIVE_AT_RECORDING',
    });

    const archivedProfile = setup({
      profiles: [
        profile('PMYP-001', 'MOLD-001', {
          isActive: false,
        }),
      ],
    });

    await expect(
      archivedProfile.service.createSource(source()),
    ).rejects.toMatchObject({
      code: 'PROFILE_INACTIVE_AT_RECORDING',
    });
  });

  it('does not reject valid historical archived provenance while creating a new active source', async () => {
    const { service } = setup({
      sources: [
        source({
          yieldSampleId: 'YLD-OLD',
          moldId: 'MOLD-OLD',
          moldYieldProfileId: 'PMYP-OLD',
        }),
      ],
      yieldSamples: [
        sample('YLD-OLD'),
        sample('YLD-001'),
      ],
      molds: [
        mold('MOLD-OLD', { isActive: false }),
        mold('MOLD-001'),
      ],
      profiles: [
        profile('PMYP-OLD', 'MOLD-OLD', {
          isActive: false,
        }),
        profile(),
      ],
    });

    await expect(
      service.createSource(source()),
    ).resolves.toEqual(source());

    await expect(service.listSources()).resolves.toHaveLength(2);
  });

  it('lists/filter sources deterministically', async () => {
    const { service } = setup({
      sources: [
        source({
          yieldSampleId: 'YLD-002',
          moldId: 'MOLD-002',
          moldYieldProfileId: 'PMYP-002',
        }),
        source(),
      ],
    });

    await expect(service.listSources()).resolves.toEqual([
      source(),
      source({
        yieldSampleId: 'YLD-002',
        moldId: 'MOLD-002',
        moldYieldProfileId: 'PMYP-002',
      }),
    ]);

    await expect(
      service.listSources({ moldId: ' mold-002 ' }),
    ).resolves.toEqual([
      source({
        yieldSampleId: 'YLD-002',
        moldId: 'MOLD-002',
        moldYieldProfileId: 'PMYP-002',
      }),
    ]);
  });

  it('resolves Manual, Mix preset, and Mold Formula source views without changing Yield evidence', async () => {
    const manual = setup({
      yieldSamples: [sample('YLD-MANUAL')],
    });
    await expect(
      manual.service.resolveRecipeSourceForYieldSample('YLD-MANUAL'),
    ).resolves.toEqual({ kind: 'manual' });

    const preset = setup({
      yieldSamples: [
        sample('YLD-PRESET', {
          mixPresetId: 'MIX-001',
        }),
      ],
    });
    await expect(
      preset.service.resolveRecipeSourceForYieldSample('YLD-PRESET'),
    ).resolves.toEqual({
      kind: 'mix-preset',
      mixPresetId: 'MIX-001',
    });

    const formula = setup({
      sources: [
        source({
          yieldSampleId: 'YLD-FORMULA',
        }),
      ],
      yieldSamples: [sample('YLD-FORMULA')],
    });
    await expect(
      formula.service.resolveRecipeSourceForYieldSample('YLD-FORMULA'),
    ).resolves.toEqual({
      kind: 'mold-formula',
      moldId: 'MOLD-001',
      moldYieldProfileId: 'PMYP-001',
    });
  });

  it('reports missing Yield Sample on read-side resolution', async () => {
    const { service } = setup();

    await expect(
      service.resolveRecipeSourceForYieldSample('YLD-MISSING'),
    ).rejects.toBeInstanceOf(
      YieldMoldFormulaSourceApplicationError,
    );
    await expect(
      service.resolveRecipeSourceForYieldSample('YLD-MISSING'),
    ).rejects.toMatchObject({
      code: 'YIELD_SAMPLE_NOT_FOUND',
      yieldSampleId: 'YLD-MISSING',
    });
  });

  it('does not expose application-level mutation after provenance creation', () => {
    const { service } = setup();
    const exposed = service as unknown as Record<string, unknown>;

    expect(exposed.updateSource).toBeUndefined();
    expect(exposed.deleteSource).toBeUndefined();
  });
});
