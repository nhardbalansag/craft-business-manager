import { describe, expect, it } from 'vitest';
import {
  YIELD_RECIPE_SOURCE_KINDS,
  YieldRecipeSourceResolutionError,
  cloneResolvedYieldRecipeSource,
  isYieldRecipeSourceKind,
  resolveYieldRecipeSource,
} from './yieldRecipeSource';

describe('YRS1A Yield recipe source resolution contract', () => {
  it('resolves a legacy no-preset Yield Sample as manual', () => {
    expect(
      resolveYieldRecipeSource({
        id: 'YLD-0001',
      }),
    ).toEqual({ kind: 'manual' });
  });

  it('resolves an existing Yield Sample mixPresetId as Mix preset provenance', () => {
    expect(
      resolveYieldRecipeSource({
        id: 'YLD-0002',
        mixPresetId: '  MIX-PLASTER  ',
      }),
    ).toEqual({
      kind: 'mix-preset',
      mixPresetId: 'MIX-PLASTER',
    });
  });

  it('resolves explicit Mold Formula provenance when no MixPreset provenance exists', () => {
    expect(
      resolveYieldRecipeSource(
        { id: 'YLD-0003' },
        {
          moldId: '  MOLD-0012 ',
          moldYieldProfileId: ' PMYP-0004  ',
        },
      ),
    ).toEqual({
      kind: 'mold-formula',
      moldId: 'MOLD-0012',
      moldYieldProfileId: 'PMYP-0004',
    });
  });

  it('treats a blank legacy mixPresetId as absent for defensive read compatibility', () => {
    expect(
      resolveYieldRecipeSource({
        id: 'YLD-0004',
        mixPresetId: '   ',
      }),
    ).toEqual({ kind: 'manual' });
  });

  it('fails closed instead of silently choosing when MixPreset and Mold Formula provenance both exist', () => {
    expect(() =>
      resolveYieldRecipeSource(
        {
          id: 'YLD-0005',
          mixPresetId: 'MIX-001',
        },
        {
          moldId: 'MOLD-001',
          moldYieldProfileId: 'PMYP-001',
        },
      ),
    ).toThrowError(
      expect.objectContaining({
        name: 'YieldRecipeSourceResolutionError',
        code: 'AMBIGUOUS_RECIPE_SOURCE',
        sampleId: 'YLD-0005',
      }),
    );
  });

  it('rejects incomplete Mold Formula source projections before resolution', () => {
    expect(() =>
      resolveYieldRecipeSource(
        { id: 'YLD-0006' },
        {
          moldId: '   ',
          moldYieldProfileId: 'PMYP-001',
        },
      ),
    ).toThrowError(
      expect.objectContaining({
        code: 'INVALID_MOLD_ID',
      }),
    );

    expect(() =>
      resolveYieldRecipeSource(
        { id: 'YLD-0007' },
        {
          moldId: 'MOLD-001',
          moldYieldProfileId: '  ',
        },
      ),
    ).toThrowError(
      expect.objectContaining({
        code: 'INVALID_MOLD_YIELD_PROFILE_ID',
      }),
    );
  });

  it('publishes only the three supported source kinds', () => {
    expect(YIELD_RECIPE_SOURCE_KINDS).toEqual([
      'manual',
      'mix-preset',
      'mold-formula',
    ]);

    for (const kind of YIELD_RECIPE_SOURCE_KINDS) {
      expect(isYieldRecipeSourceKind(kind)).toBe(true);
    }

    expect(isYieldRecipeSourceKind('preset')).toBe(false);
    expect(isYieldRecipeSourceKind('formula')).toBe(false);
    expect(isYieldRecipeSourceKind(undefined)).toBe(false);
  });

  it('clones resolved source views without sharing object identity', () => {
    const source = resolveYieldRecipeSource(
      { id: 'YLD-0008' },
      {
        moldId: 'MOLD-008',
        moldYieldProfileId: 'PMYP-008',
      },
    );

    const clone = cloneResolvedYieldRecipeSource(source);

    expect(clone).toEqual(source);
    expect(clone).not.toBe(source);
  });

  it('exposes a stable typed resolution error contract', () => {
    const error = new YieldRecipeSourceResolutionError(
      'AMBIGUOUS_RECIPE_SOURCE',
      'ambiguous',
      {
        sampleId: 'YLD-X',
        input: { source: 'test' },
      },
    );

    expect(error).toMatchObject({
      name: 'YieldRecipeSourceResolutionError',
      code: 'AMBIGUOUS_RECIPE_SOURCE',
      sampleId: 'YLD-X',
      input: { source: 'test' },
    });
  });
});
