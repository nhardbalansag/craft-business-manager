import { describe, expect, it } from 'vitest';
import {
  calculatePlasterMoldFormula,
  PlasterMoldFormulaError,
  validatePlasterMoldFormulaInput,
  type PlasterMoldFormulaInput,
} from './plasterMoldFormula';

function input(overrides: Partial<PlasterMoldFormulaInput> = {}): PlasterMoldFormulaInput {
  return {
    waterFillWeightGrams: 50,
    waterAdjustmentRate: 0.3,
    plasterFactor: 0.75,
    glueFactor: 0.05,
    piecesPerPour: 1,
    ...overrides,
  };
}

function expectCode(fn: () => void, code: PlasterMoldFormulaError['code']) {
  try {
    fn();
    throw new Error('Expected PlasterMoldFormulaError.');
  } catch (error) {
    expect(error).toBeInstanceOf(PlasterMoldFormulaError);
    expect((error as PlasterMoldFormulaError).code).toBe(code);
  }
}

describe('plaster mold formula input contract', () => {
  it('accepts the locked MY0 defaults without requiring a requested quantity', () => {
    expect(() => validatePlasterMoldFormulaInput(input())).not.toThrow();
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid water fill weight %s',
    (waterFillWeightGrams) => {
      expectCode(
        () => validatePlasterMoldFormulaInput(input({ waterFillWeightGrams })),
        'INVALID_WATER_FILL_WEIGHT',
      );
    },
  );

  it.each([-0.01, 1, 1.2, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid water adjustment rate %s',
    (waterAdjustmentRate) => {
      expectCode(
        () => validatePlasterMoldFormulaInput(input({ waterAdjustmentRate })),
        'INVALID_WATER_ADJUSTMENT_RATE',
      );
    },
  );

  it.each([-0.01, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid plaster factor %s',
    (plasterFactor) => {
      expectCode(
        () => validatePlasterMoldFormulaInput(input({ plasterFactor })),
        'INVALID_PLASTER_FACTOR',
      );
    },
  );

  it.each([-0.01, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid glue factor %s',
    (glueFactor) => {
      expectCode(
        () => validatePlasterMoldFormulaInput(input({ glueFactor })),
        'INVALID_GLUE_FACTOR',
      );
    },
  );

  it.each([0, -1, 1.5, Number.NaN])('rejects invalid pieces per pour %s', (piecesPerPour) => {
    expectCode(
      () => validatePlasterMoldFormulaInput(input({ piecesPerPour })),
      'INVALID_PIECES_PER_POUR',
    );
  });

  it.each([0, -1, 1.5, Number.NaN])(
    'rejects invalid requested quantity %s',
    (requestedQuantity) => {
      expectCode(
        () => validatePlasterMoldFormulaInput(input({ requestedQuantity })),
        'INVALID_REQUESTED_QUANTITY',
      );
    },
  );

  it('allows zero plaster or glue factors because MY0 defines them as non-negative', () => {
    expect(() =>
      validatePlasterMoldFormulaInput(input({ plasterFactor: 0, glueFactor: 0 })),
    ).not.toThrow();
  });
});

describe('plaster mold formula calculation', () => {
  it('matches the canonical 50 g MY0 example exactly', () => {
    const result = calculatePlasterMoldFormula(input());

    expect(result).toMatchObject({
      unit: 'g',
      waterFillWeightGrams: 50,
      waterAdjustmentRate: 0.3,
      plasterFactor: 0.75,
      glueFactor: 0.05,
      piecesPerPour: 1,
      perPour: {
        adjustedWaterGrams: 35,
        plasterGrams: 26.25,
        glueGrams: 1.75,
        totalMixtureGrams: 63,
      },
      perPiece: {
        adjustedWaterGrams: 35,
        plasterGrams: 26.25,
        glueGrams: 1.75,
        totalMixtureGrams: 63,
      },
    });
    expect(result.requestedQuantityEstimate).toBeUndefined();
  });

  it('derives multi-cavity per-piece and requested-quantity estimates', () => {
    const result = calculatePlasterMoldFormula(
      input({
        piecesPerPour: 4,
        requestedQuantity: 21,
      }),
    );

    expect(result.perPiece).toEqual({
      adjustedWaterGrams: 8.75,
      plasterGrams: 6.5625,
      glueGrams: 0.4375,
      totalMixtureGrams: 15.75,
    });

    expect(result.requestedQuantityEstimate).toEqual({
      requestedQuantity: 21,
      requiredPours: 6,
      producedCapacityPieces: 24,
      extraCapacityPieces: 3,
      totals: {
        adjustedWaterGrams: 210,
        plasterGrams: 157.5,
        glueGrams: 10.5,
        totalMixtureGrams: 378,
      },
    });
  });

  it('treats glue as additional material rather than replacing adjusted water', () => {
    const result = calculatePlasterMoldFormula(input());

    expect(result.perPour.totalMixtureGrams).toBe(
      result.perPour.adjustedWaterGrams +
        result.perPour.plasterGrams +
        result.perPour.glueGrams,
    );
  });

  it('does not apply Product safety waste or emit Yield evidence fields', () => {
    const result = calculatePlasterMoldFormula(input({ requestedQuantity: 10 }));

    expect(result).not.toHaveProperty('safetyWasteRate');
    expect(result).not.toHaveProperty('yieldSample');
    expect(result.requestedQuantityEstimate).toBeDefined();
  });

  it('preserves deterministic arithmetic without hidden rounding', () => {
    const result = calculatePlasterMoldFormula(
      input({
        waterFillWeightGrams: 33.3,
        waterAdjustmentRate: 0.17,
        plasterFactor: 0.625,
        glueFactor: 0.0375,
        piecesPerPour: 3,
      }),
    );

    const adjusted = 33.3 * (1 - 0.17);
    expect(result.perPour.adjustedWaterGrams).toBe(adjusted);
    expect(result.perPour.plasterGrams).toBe(adjusted * 0.625);
    expect(result.perPour.glueGrams).toBe(adjusted * 0.0375);
    expect(result.perPiece.totalMixtureGrams).toBe(
      result.perPour.totalMixtureGrams / 3,
    );
  });

  it('rejects arithmetic overflow instead of returning non-finite derived quantities', () => {
    expectCode(
      () =>
        calculatePlasterMoldFormula(
          input({
            waterFillWeightGrams: Number.MAX_VALUE,
            plasterFactor: Number.MAX_VALUE,
          }),
        ),
      'DERIVED_QUANTITY_INVALID',
    );
  });
});
