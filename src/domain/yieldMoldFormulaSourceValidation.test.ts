import { describe, expect, it } from 'vitest';
import type { Mold } from './molds';
import type { PlasterMoldYieldProfile } from './plasterMoldYieldProfiles';
import type { YieldMoldFormulaSource } from './yieldMoldFormulaSource';
import type { YieldSample } from './yieldSamples';
import { validateYieldMoldFormulaSourceReferences } from './yieldMoldFormulaSourceValidation';

function sample(
  overrides: Partial<YieldSample> = {},
): YieldSample {
  return {
    id: 'YLD-001',
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
  overrides: Partial<Mold> = {},
): Mold {
  return {
    id: 'MOLD-001',
    productId: 'PROD-001',
    name: 'Test Mold',
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

function validContext(overrides: {
  sources?: YieldMoldFormulaSource[];
  yieldSamples?: YieldSample[];
  molds?: Mold[];
  profiles?: PlasterMoldYieldProfile[];
  mode?: 'historical' | 'recording';
} = {}) {
  return {
    sources: overrides.sources ?? [source()],
    yieldSamples: overrides.yieldSamples ?? [sample()],
    molds: overrides.molds ?? [mold()],
    profiles: overrides.profiles ?? [profile()],
    ...(overrides.mode ? { mode: overrides.mode } : {}),
  };
}

describe('YRS1C Yield Mold Formula source referential validation', () => {
  it('accepts valid provenance relationships', () => {
    expect(
      validateYieldMoldFormulaSourceReferences(validContext()),
    ).toEqual({
      valid: true,
      issues: [],
    });
  });

  it('matches source identities trim-aware and case-insensitively', () => {
    const result = validateYieldMoldFormulaSourceReferences(
      validContext({
        sources: [
          source({
            yieldSampleId: ' yld-001 ',
            moldId: ' mold-001 ',
            moldYieldProfileId: ' pmyp-001 ',
          }),
        ],
      }),
    );

    expect(result.valid).toBe(true);
  });

  it('reports missing Yield Sample, Mold, and profile references independently', () => {
    const result = validateYieldMoldFormulaSourceReferences({
      sources: [source()],
      yieldSamples: [],
      molds: [],
      profiles: [],
    });

    expect(result.issues.map((issue) => issue.code)).toEqual([
      'MISSING_YIELD_SAMPLE_REFERENCE',
      'MISSING_MOLD_REFERENCE',
      'MISSING_MOLD_YIELD_PROFILE_REFERENCE',
    ]);
    expect(result.issues.map((issue) => issue.path)).toEqual([
      'yieldMoldFormulaSources[0].yieldSampleId',
      'yieldMoldFormulaSources[0].moldId',
      'yieldMoldFormulaSources[0].moldYieldProfileId',
    ]);
  });

  it('rejects simultaneous MixPreset and Mold Formula provenance', () => {
    const result = validateYieldMoldFormulaSourceReferences(
      validContext({
        yieldSamples: [
          sample({
            mixPresetId: 'MIX-001',
          }),
        ],
      }),
    );

    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'MIX_PRESET_SOURCE_CONFLICT',
        field: 'yieldSampleId',
      }),
    ]);
  });

  it('requires the referenced Mold to belong to the Yield Sample Product', () => {
    const result = validateYieldMoldFormulaSourceReferences(
      validContext({
        molds: [
          mold({
            productId: 'PROD-OTHER',
          }),
        ],
      }),
    );

    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'MOLD_PRODUCT_MISMATCH',
        field: 'moldId',
      }),
    ]);
  });

  it('requires the referenced profile to belong to the provenance Mold', () => {
    const result = validateYieldMoldFormulaSourceReferences(
      validContext({
        profiles: [
          profile({
            moldId: 'MOLD-OTHER',
          }),
        ],
      }),
    );

    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'PROFILE_MOLD_MISMATCH',
        field: 'moldYieldProfileId',
      }),
    ]);
  });

  it('enforces one Mold Formula provenance source per Yield Sample', () => {
    const result = validateYieldMoldFormulaSourceReferences(
      validContext({
        sources: [
          source(),
          source({
            yieldSampleId: ' yld-001 ',
            moldId: 'MOLD-002',
            moldYieldProfileId: 'PMYP-002',
          }),
        ],
        molds: [
          mold(),
          mold({
            id: 'MOLD-002',
            name: 'Second Mold',
          }),
        ],
        profiles: [
          profile(),
          profile({
            id: 'PMYP-002',
            moldId: 'MOLD-002',
          }),
        ],
      }),
    );

    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'DUPLICATE_YIELD_MOLD_FORMULA_SOURCE',
        sourceIndex: 1,
        field: 'yieldSampleId',
      }),
    ]);
  });

  it('allows archived Mold and profile references in historical validation mode', () => {
    const result = validateYieldMoldFormulaSourceReferences(
      validContext({
        molds: [mold({ isActive: false })],
        profiles: [profile({ isActive: false })],
        mode: 'historical',
      }),
    );

    expect(result.valid).toBe(true);
  });

  it('uses historical validation mode by default', () => {
    const result = validateYieldMoldFormulaSourceReferences(
      validContext({
        molds: [mold({ isActive: false })],
        profiles: [profile({ isActive: false })],
      }),
    );

    expect(result.valid).toBe(true);
  });

  it('requires active Mold and profile references for new recording', () => {
    const result = validateYieldMoldFormulaSourceReferences(
      validContext({
        molds: [mold({ isActive: false })],
        profiles: [profile({ isActive: false })],
        mode: 'recording',
      }),
    );

    expect(result.issues.map((issue) => issue.code)).toEqual([
      'MOLD_INACTIVE_AT_RECORDING',
      'PROFILE_INACTIVE_AT_RECORDING',
    ]);
  });

  it('does not produce missing-reference diagnostics for intrinsically blank IDs', () => {
    const result = validateYieldMoldFormulaSourceReferences(
      validContext({
        sources: [
          source({
            yieldSampleId: ' ',
            moldId: '',
            moldYieldProfileId: '   ',
          }),
        ],
      }),
    );

    expect(result).toEqual({
      valid: true,
      issues: [],
    });
  });

  it('can report ownership mismatches independently in one source row', () => {
    const result = validateYieldMoldFormulaSourceReferences(
      validContext({
        molds: [
          mold({
            productId: 'PROD-OTHER',
          }),
        ],
        profiles: [
          profile({
            moldId: 'MOLD-OTHER',
          }),
        ],
      }),
    );

    expect(result.issues.map((issue) => issue.code)).toEqual([
      'MOLD_PRODUCT_MISMATCH',
      'PROFILE_MOLD_MISMATCH',
    ]);
  });

  it('does not mutate source collections while validating', () => {
    const input = validContext({ mode: 'recording' });
    const before = structuredClone(input);

    validateYieldMoldFormulaSourceReferences(input);

    expect(input).toEqual(before);
  });
});
