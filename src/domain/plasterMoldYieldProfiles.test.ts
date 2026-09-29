import { describe, expect, it } from 'vitest';
import {
  clonePlasterMoldYieldProfile,
  normalizePlasterMoldYieldProfile,
  PlasterMoldYieldProfileError,
  type PlasterMoldYieldProfile,
  validatePlasterMoldYieldProfileContract,
} from './plasterMoldYieldProfiles';

function profile(
  overrides: Partial<PlasterMoldYieldProfile> = {},
): PlasterMoldYieldProfile {
  return {
    id: 'PMYP-0001',
    moldId: 'MOLD-0001',
    waterMaterialId: 'MAT-WATER',
    plasterMaterialId: 'MAT-PLASTER',
    glueMaterialId: 'MAT-GLUE',
    waterFillWeightGrams: 50,
    waterAdjustmentRate: 0.3,
    plasterFactor: 0.75,
    glueFactor: 0.05,
    piecesPerPour: 1,
    notes: 'Primary casting profile',
    isActive: true,
    ...overrides,
  };
}

function expectCode(
  fn: () => void,
  code: PlasterMoldYieldProfileError['code'],
) {
  try {
    fn();
    throw new Error('Expected PlasterMoldYieldProfileError.');
  } catch (error) {
    expect(error).toBeInstanceOf(PlasterMoldYieldProfileError);
    expect((error as PlasterMoldYieldProfileError).code).toBe(code);
  }
}

describe('PlasterMoldYieldProfile source contract', () => {
  it('accepts the canonical MY0 source inputs', () => {
    expect(() => validatePlasterMoldYieldProfileContract(profile())).not.toThrow();
  });

  it('stores authoritative inputs only and never calculated formula outputs', () => {
    const source = profile();

    expect(source).not.toHaveProperty('adjustedWaterGrams');
    expect(source).not.toHaveProperty('plasterGrams');
    expect(source).not.toHaveProperty('glueGrams');
    expect(source).not.toHaveProperty('totalMixtureGrams');
    expect(source).not.toHaveProperty('requiredPours');
    expect(source).not.toHaveProperty('perPiece');
  });

  it('normalizes textual source fields without changing configured numeric evidence', () => {
    expect(
      normalizePlasterMoldYieldProfile(
        profile({
          id: '  PMYP-0042 ',
          moldId: ' MOLD-CAST-42 ',
          waterMaterialId: ' MAT-WATER ',
          plasterMaterialId: ' MAT-PLASTER ',
          glueMaterialId: ' MAT-GLUE ',
          waterFillWeightGrams: 50.125,
          waterAdjustmentRate: 0.275,
          plasterFactor: 0.8,
          glueFactor: 0.045,
          piecesPerPour: 6,
          notes: '  six-cavity mold  ',
        }),
      ),
    ).toEqual({
      ...profile(),
      id: 'PMYP-0042',
      moldId: 'MOLD-CAST-42',
      waterMaterialId: 'MAT-WATER',
      plasterMaterialId: 'MAT-PLASTER',
      glueMaterialId: 'MAT-GLUE',
      waterFillWeightGrams: 50.125,
      waterAdjustmentRate: 0.275,
      plasterFactor: 0.8,
      glueFactor: 0.045,
      piecesPerPour: 6,
      notes: 'six-cavity mold',
    });
  });

  it('omits blank normalized notes', () => {
    expect(normalizePlasterMoldYieldProfile(profile({ notes: '   ' })).notes).toBeUndefined();
  });

  it('defensively clones the source record', () => {
    const original = profile();
    const cloned = clonePlasterMoldYieldProfile(original);

    cloned.waterFillWeightGrams = 99;
    cloned.notes = 'changed';

    expect(original.waterFillWeightGrams).toBe(50);
    expect(original.notes).toBe('Primary casting profile');
  });

  it('rejects blank source identity/reference fields', () => {
    expectCode(
      () => validatePlasterMoldYieldProfileContract(profile({ id: ' ' })),
      'INVALID_ID',
    );
    expectCode(
      () => validatePlasterMoldYieldProfileContract(profile({ moldId: '\t' })),
      'INVALID_MOLD_ID',
    );
    expectCode(
      () =>
        validatePlasterMoldYieldProfileContract(
          profile({ waterMaterialId: ' ' }),
        ),
      'INVALID_WATER_MATERIAL_ID',
    );
    expectCode(
      () =>
        validatePlasterMoldYieldProfileContract(
          profile({ plasterMaterialId: '' }),
        ),
      'INVALID_PLASTER_MATERIAL_ID',
    );
    expectCode(
      () =>
        validatePlasterMoldYieldProfileContract(
          profile({ glueMaterialId: '   ' }),
        ),
      'INVALID_GLUE_MATERIAL_ID',
    );
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects non-finite water fill weight %s',
    (waterFillWeightGrams) => {
      expectCode(
        () =>
          validatePlasterMoldYieldProfileContract(
            profile({ waterFillWeightGrams }),
          ),
        'NON_FINITE_WATER_FILL_WEIGHT',
      );
    },
  );

  it.each([0, -0.01])(
    'rejects non-positive water fill weight %s',
    (waterFillWeightGrams) => {
      expectCode(
        () =>
          validatePlasterMoldYieldProfileContract(
            profile({ waterFillWeightGrams }),
          ),
        'NON_POSITIVE_WATER_FILL_WEIGHT',
      );
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects non-finite water adjustment rate %s',
    (waterAdjustmentRate) => {
      expectCode(
        () =>
          validatePlasterMoldYieldProfileContract(
            profile({ waterAdjustmentRate }),
          ),
        'NON_FINITE_WATER_ADJUSTMENT_RATE',
      );
    },
  );

  it('rejects negative and 100%-or-higher water adjustment rates', () => {
    expectCode(
      () =>
        validatePlasterMoldYieldProfileContract(
          profile({ waterAdjustmentRate: -0.01 }),
        ),
      'NEGATIVE_WATER_ADJUSTMENT_RATE',
    );
    for (const waterAdjustmentRate of [1, 1.2]) {
      expectCode(
        () =>
          validatePlasterMoldYieldProfileContract(
            profile({ waterAdjustmentRate }),
          ),
        'WATER_ADJUSTMENT_RATE_NOT_BELOW_ONE',
      );
    }
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects non-finite plaster factor %s',
    (plasterFactor) => {
      expectCode(
        () =>
          validatePlasterMoldYieldProfileContract(profile({ plasterFactor })),
        'NON_FINITE_PLASTER_FACTOR',
      );
    },
  );

  it('rejects negative plaster factor while preserving explicit zero', () => {
    expectCode(
      () =>
        validatePlasterMoldYieldProfileContract(
          profile({ plasterFactor: -0.01 }),
        ),
      'NEGATIVE_PLASTER_FACTOR',
    );
    expect(() =>
      validatePlasterMoldYieldProfileContract(profile({ plasterFactor: 0 })),
    ).not.toThrow();
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects non-finite glue factor %s',
    (glueFactor) => {
      expectCode(
        () => validatePlasterMoldYieldProfileContract(profile({ glueFactor })),
        'NON_FINITE_GLUE_FACTOR',
      );
    },
  );

  it('rejects negative glue factor while preserving explicit zero', () => {
    expectCode(
      () =>
        validatePlasterMoldYieldProfileContract(profile({ glueFactor: -0.01 })),
      'NEGATIVE_GLUE_FACTOR',
    );
    expect(() =>
      validatePlasterMoldYieldProfileContract(profile({ glueFactor: 0 })),
    ).not.toThrow();
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects non-finite pieces per pour %s',
    (piecesPerPour) => {
      expectCode(
        () =>
          validatePlasterMoldYieldProfileContract(profile({ piecesPerPour })),
        'NON_FINITE_PIECES_PER_POUR',
      );
    },
  );

  it('requires a positive whole-piece pieces-per-pour count', () => {
    expectCode(
      () =>
        validatePlasterMoldYieldProfileContract(profile({ piecesPerPour: 1.5 })),
      'NON_INTEGER_PIECES_PER_POUR',
    );
    for (const piecesPerPour of [0, -1]) {
      expectCode(
        () =>
          validatePlasterMoldYieldProfileContract(profile({ piecesPerPour })),
        'NON_POSITIVE_PIECES_PER_POUR',
      );
    }
  });

  it('requires a boolean active state', () => {
    expectCode(
      () =>
        validatePlasterMoldYieldProfileContract(
          profile({ isActive: 'yes' as never }),
        ),
      'INVALID_ACTIVE_STATE',
    );
  });

  it('does not perform MY1C referential validation at this boundary', () => {
    expect(() =>
      validatePlasterMoldYieldProfileContract(
        profile({
          moldId: 'MOLD-NOT-LOOKED-UP-HERE',
          waterMaterialId: 'MAT-SAME',
          plasterMaterialId: 'MAT-SAME',
          glueMaterialId: 'MAT-SAME',
        }),
      ),
    ).not.toThrow();
  });
});
