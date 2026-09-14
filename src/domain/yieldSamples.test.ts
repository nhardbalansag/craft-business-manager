import { describe, expect, it } from 'vitest';
import {
  cloneYieldSample,
  normalizeYieldSampleEvidence,
  validateYieldSampleContract,
  YieldSampleContractError,
  type YieldSample,
} from './yieldSamples';

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
    notes: 'First mold run',
    ...overrides,
  };
}

function expectCode(fn: () => void, code: YieldSampleContractError['code']) {
  try {
    fn();
    throw new Error('Expected YieldSampleContractError.');
  } catch (error) {
    expect(error).toBeInstanceOf(YieldSampleContractError);
    expect((error as YieldSampleContractError).code).toBe(code);
  }
}

describe('YieldSample evidence contract', () => {
  it('accepts real multi-material batch evidence', () => {
    expect(() => validateYieldSampleContract(sample())).not.toThrow();
  });

  it('supports a single material input and count evidence', () => {
    expect(() =>
      validateYieldSampleContract(
        sample({
          mixPresetId: undefined,
          materialInputs: [{ materialId: 'MAT-WICK', quantity: 12, unit: 'pc' }],
          goodPieces: 12,
          rejectedPieces: 0,
        }),
      ),
    ).not.toThrow();
  });

  it('normalizes string source fields without changing measured quantities', () => {
    const normalized = normalizeYieldSampleEvidence(
      sample({
        id: ' YS-001 ',
        productId: ' ART-001 ',
        mixPresetId: ' MIX-PLASTER-2-1 ',
        materialInputs: [{ materialId: ' MAT-PLASTER ', quantity: 3.25, unit: 'cup' }],
        notes: '  observed batch  ',
      }),
    );

    expect(normalized).toMatchObject({
      id: 'YS-001',
      productId: 'ART-001',
      mixPresetId: 'MIX-PLASTER-2-1',
      notes: 'observed batch',
    });
    expect(normalized.materialInputs[0]).toEqual({
      materialId: 'MAT-PLASTER',
      quantity: 3.25,
      unit: 'cup',
    });
  });

  it('deep-clones material input evidence', () => {
    const original = sample();
    const cloned = cloneYieldSample(original);
    cloned.materialInputs[0].quantity = 999;
    expect(original.materialInputs[0].quantity).toBe(3);
  });

  it('rejects missing identity fields and blank optional mix IDs', () => {
    expectCode(() => validateYieldSampleContract(sample({ id: ' ' })), 'INVALID_ID');
    expectCode(
      () => validateYieldSampleContract(sample({ productId: ' ' })),
      'INVALID_PRODUCT_ID',
    );
    expectCode(
      () => validateYieldSampleContract(sample({ mixPresetId: ' ' })),
      'INVALID_MIX_PRESET_ID',
    );
  });

  it('requires at least one material input', () => {
    expectCode(
      () => validateYieldSampleContract(sample({ materialInputs: [] })),
      'EMPTY_MATERIAL_INPUTS',
    );
  });

  it('rejects blank material IDs and duplicate materials case-insensitively', () => {
    expectCode(
      () =>
        validateYieldSampleContract(
          sample({ materialInputs: [{ materialId: ' ', quantity: 1, unit: 'g' }] }),
        ),
      'INVALID_MATERIAL_ID',
    );

    expectCode(
      () =>
        validateYieldSampleContract(
          sample({
            materialInputs: [
              { materialId: 'MAT-PLASTER', quantity: 1, unit: 'cup' },
              { materialId: ' mat-plaster ', quantity: 200, unit: 'g' },
            ],
          }),
        ),
      'DUPLICATE_MATERIAL',
    );
  });

  it('requires positive finite material quantities', () => {
    for (const quantity of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expectCode(
        () =>
          validateYieldSampleContract(
            sample({ materialInputs: [{ materialId: 'MAT-PLASTER', quantity, unit: 'g' }] }),
          ),
        'INVALID_QUANTITY',
      );
    }
  });

  it('rejects unsupported runtime units', () => {
    expectCode(
      () =>
        validateYieldSampleContract(
          sample({
            materialInputs: [
              { materialId: 'MAT-PLASTER', quantity: 1, unit: 'bag' as never },
            ],
          }),
        ),
      'INVALID_UNIT',
    );
  });

  it('requires positive integer good pieces', () => {
    for (const goodPieces of [0, -1, 1.5, Number.NaN]) {
      expectCode(
        () => validateYieldSampleContract(sample({ goodPieces })),
        'INVALID_GOOD_PIECES',
      );
    }
  });

  it('requires non-negative integer rejected pieces', () => {
    for (const rejectedPieces of [-1, 1.5, Number.NaN]) {
      expectCode(
        () => validateYieldSampleContract(sample({ rejectedPieces })),
        'INVALID_REJECTED_PIECES',
      );
    }
  });

  it('requires a valid recorded date/time', () => {
    for (const recordedAt of ['', 'not-a-date']) {
      expectCode(
        () => validateYieldSampleContract(sample({ recordedAt })),
        'INVALID_RECORDED_AT',
      );
    }
  });
});
