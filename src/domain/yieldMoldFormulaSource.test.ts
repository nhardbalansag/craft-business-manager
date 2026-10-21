import { describe, expect, it } from 'vitest';
import {
  YieldMoldFormulaSourceError,
  cloneYieldMoldFormulaSource,
  normalizeYieldMoldFormulaSource,
  toMoldFormulaYieldRecipeSourceReference,
  validateYieldMoldFormulaSourceContract,
  type YieldMoldFormulaSource,
} from './yieldMoldFormulaSource';
import { resolveYieldRecipeSource } from './yieldRecipeSource';

function source(
  overrides: Partial<YieldMoldFormulaSource> = {},
): YieldMoldFormulaSource {
  return {
    yieldSampleId: 'YLD-0010',
    moldId: 'MOLD-0012',
    moldYieldProfileId: 'PMYP-0004',
    ...overrides,
  };
}

describe('YRS1B Yield Mold Formula provenance source contract', () => {
  it('accepts the minimal authoritative provenance source shape', () => {
    const value = source();

    expect(() =>
      validateYieldMoldFormulaSourceContract(value),
    ).not.toThrow();

    expect(value).toEqual({
      yieldSampleId: 'YLD-0010',
      moldId: 'MOLD-0012',
      moldYieldProfileId: 'PMYP-0004',
    });
  });

  it('normalizes identifiers without changing case or adding derived values', () => {
    expect(
      normalizeYieldMoldFormulaSource(
        source({
          yieldSampleId: '  YLD-AbC  ',
          moldId: '  Mold-X  ',
          moldYieldProfileId: '  Pmyp-Y  ',
        }),
      ),
    ).toEqual({
      yieldSampleId: 'YLD-AbC',
      moldId: 'Mold-X',
      moldYieldProfileId: 'Pmyp-Y',
    });
  });

  it('clones source records without sharing object identity', () => {
    const value = source();
    const clone = cloneYieldMoldFormulaSource(value);

    expect(clone).toEqual(value);
    expect(clone).not.toBe(value);
  });

  it.each([
    [
      'yieldSampleId',
      { yieldSampleId: '   ' },
      'INVALID_YIELD_SAMPLE_ID',
    ],
    [
      'moldId',
      { moldId: '' },
      'INVALID_MOLD_ID',
    ],
    [
      'moldYieldProfileId',
      { moldYieldProfileId: '   ' },
      'INVALID_MOLD_YIELD_PROFILE_ID',
    ],
  ] as const)(
    'rejects a blank %s',
    (_field, overrides, code) => {
      expect(() =>
        validateYieldMoldFormulaSourceContract(source(overrides)),
      ).toThrowError(
        expect.objectContaining({
          name: 'YieldMoldFormulaSourceError',
          code,
        }),
      );
    },
  );

  it('exposes a stable coded error context', () => {
    const error = new YieldMoldFormulaSourceError(
      'INVALID_MOLD_ID',
      'invalid',
      {
        yieldSampleId: 'YLD-1',
        moldId: '',
        moldYieldProfileId: 'PMYP-1',
        input: '',
      },
    );

    expect(error).toMatchObject({
      name: 'YieldMoldFormulaSourceError',
      code: 'INVALID_MOLD_ID',
      yieldSampleId: 'YLD-1',
      moldId: '',
      moldYieldProfileId: 'PMYP-1',
      input: '',
    });
  });

  it('adapts authoritative provenance into the YRS1A resolver reference', () => {
    const provenance = source({
      moldId: ' MOLD-009 ',
      moldYieldProfileId: ' PMYP-009 ',
    });

    const reference =
      toMoldFormulaYieldRecipeSourceReference(provenance);

    expect(reference).toEqual({
      moldId: 'MOLD-009',
      moldYieldProfileId: 'PMYP-009',
    });

    expect(
      resolveYieldRecipeSource(
        { id: provenance.yieldSampleId },
        reference,
      ),
    ).toEqual({
      kind: 'mold-formula',
      moldId: 'MOLD-009',
      moldYieldProfileId: 'PMYP-009',
    });
  });

  it('stores provenance only and does not persist theoretical formula outputs', () => {
    const value = source() as YieldMoldFormulaSource &
      Record<string, unknown>;

    expect(value).not.toHaveProperty('adjustedWaterGrams');
    expect(value).not.toHaveProperty('plasterGrams');
    expect(value).not.toHaveProperty('glueGrams');
    expect(value).not.toHaveProperty('totalMixtureGrams');
    expect(value).not.toHaveProperty('requestedQuantity');
    expect(value).not.toHaveProperty('requiredPours');
    expect(value).not.toHaveProperty('producedCapacityPieces');
    expect(value).not.toHaveProperty('cost');
    expect(value).not.toHaveProperty('isActive');
  });
});
