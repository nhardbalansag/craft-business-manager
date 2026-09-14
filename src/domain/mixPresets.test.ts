import { describe, expect, it } from 'vitest';
import {
  MIX_PRESET_LINE_ROLES,
  MIX_RATIO_BASES,
  MixPresetError,
  cloneMixPreset,
  isMixPresetCompatibleWithCategory,
  isMixPresetLineRole,
  isRatioBasis,
  resolveMixRatio,
  validateMixPresetContract,
  type MixPreset,
} from './mixPresets';
import type { Unit } from './units';

function plasterPreset(overrides: Partial<MixPreset> = {}): MixPreset {
  return {
    id: 'MIX-PLASTER-2-1',
    name: 'Plaster 2:1',
    compatibleCategories: ['paintable-art', 'candle-pot'],
    basis: 'volume',
    lines: [
      { materialId: 'MAT-PLASTER', role: 'primary', parts: 2 },
      { materialId: 'MAT-WATER', role: 'secondary', parts: 1 },
    ],
    notes: 'Standard plaster mix',
    isActive: true,
    ...overrides,
  };
}

function candlePreset(overrides: Partial<MixPreset> = {}): MixPreset {
  return {
    id: 'MIX-CANDLE-100-8',
    name: 'Wax 100:8',
    compatibleCategories: ['candle'],
    basis: 'weight',
    lines: [
      { materialId: 'MAT-WAX', role: 'primary', parts: 100 },
      { materialId: 'MAT-FRAG', role: 'secondary', parts: 8 },
    ],
    isActive: true,
    ...overrides,
  };
}

function expectMixError(action: () => unknown, code: MixPresetError['code']): void {
  try {
    action();
    throw new Error('Expected mix preset operation to fail.');
  } catch (error) {
    expect(error).toBeInstanceOf(MixPresetError);
    expect((error as MixPresetError).code).toBe(code);
  }
}

describe('mix preset enums and compatibility', () => {
  it('locks the supported ratio bases and line roles', () => {
    expect(MIX_RATIO_BASES).toEqual(['weight', 'volume']);
    expect(MIX_PRESET_LINE_ROLES).toEqual(['primary', 'secondary', 'additive']);
    expect(isRatioBasis('weight')).toBe(true);
    expect(isRatioBasis('count')).toBe(false);
    expect(isMixPresetLineRole('additive')).toBe(true);
    expect(isMixPresetLineRole('finish')).toBe(false);
  });

  it('checks explicit product-category compatibility', () => {
    const preset = plasterPreset();
    expect(isMixPresetCompatibleWithCategory(preset, 'paintable-art')).toBe(true);
    expect(isMixPresetCompatibleWithCategory(preset, 'candle-pot')).toBe(true);
    expect(isMixPresetCompatibleWithCategory(preset, 'candle')).toBe(false);
  });
});

describe('mix preset contract validation', () => {
  it('accepts multi-line and single-line presets', () => {
    expect(() => validateMixPresetContract(plasterPreset())).not.toThrow();
    expect(() =>
      validateMixPresetContract(
        candlePreset({
          id: 'MIX-WAX-ONLY',
          name: 'Wax only',
          lines: [{ materialId: 'MAT-WAX', role: 'primary', parts: 100 }],
        }),
      ),
    ).not.toThrow();
  });

  it('allows richer formulas with additive lines', () => {
    expect(() =>
      validateMixPresetContract(
        candlePreset({
          lines: [
            { materialId: 'MAT-WAX', role: 'primary', parts: 100 },
            { materialId: 'MAT-FRAG', role: 'secondary', parts: 8 },
            { materialId: 'MAT-DYE', role: 'additive', parts: 0.5 },
          ],
        }),
      ),
    ).not.toThrow();
  });

  it.each([
    [plasterPreset({ id: '   ' }), 'INVALID_ID'],
    [plasterPreset({ name: '   ' }), 'INVALID_NAME'],
    [plasterPreset({ compatibleCategories: [] }), 'INVALID_COMPATIBLE_CATEGORIES'],
    [
      plasterPreset({ compatibleCategories: ['paintable-art', 'gift-set' as 'paintable-art'] }),
      'INVALID_COMPATIBLE_CATEGORIES',
    ],
    [
      plasterPreset({ compatibleCategories: ['paintable-art', 'paintable-art'] }),
      'INVALID_COMPATIBLE_CATEGORIES',
    ],
    [plasterPreset({ basis: 'count' as 'volume' }), 'INVALID_BASIS'],
    [plasterPreset({ lines: [] }), 'EMPTY_LINES'],
    [
      plasterPreset({ lines: [{ materialId: '  ', role: 'primary', parts: 1 }] }),
      'INVALID_MATERIAL_ID',
    ],
    [
      plasterPreset({
        lines: [
          { materialId: 'MAT-PLASTER', role: 'primary', parts: 2 },
          { materialId: 'mat-plaster', role: 'secondary', parts: 1 },
        ],
      }),
      'DUPLICATE_MATERIAL',
    ],
    [
      plasterPreset({ lines: [{ materialId: 'MAT-PLASTER', role: 'finish' as 'primary', parts: 1 }] }),
      'INVALID_ROLE',
    ],
    [plasterPreset({ lines: [{ materialId: 'MAT-PLASTER', role: 'primary', parts: 0 }] }), 'INVALID_PARTS'],
    [plasterPreset({ lines: [{ materialId: 'MAT-PLASTER', role: 'primary', parts: -1 }] }), 'INVALID_PARTS'],
    [
      plasterPreset({ lines: [{ materialId: 'MAT-PLASTER', role: 'primary', parts: Number.NaN }] }),
      'INVALID_PARTS',
    ],
    [
      plasterPreset({ lines: [{ materialId: 'MAT-PLASTER', role: 'primary', parts: Number.POSITIVE_INFINITY }] }),
      'INVALID_PARTS',
    ],
    [
      plasterPreset({ lines: [{ materialId: 'MAT-WATER', role: 'secondary', parts: 1 }] }),
      'INVALID_PRIMARY_COUNT',
    ],
    [
      plasterPreset({
        lines: [
          { materialId: 'MAT-PLASTER', role: 'primary', parts: 2 },
          { materialId: 'MAT-WATER', role: 'primary', parts: 1 },
        ],
      }),
      'INVALID_PRIMARY_COUNT',
    ],
    [plasterPreset({ isActive: 'yes' as unknown as boolean }), 'INVALID_ACTIVE_STATE'],
  ] as const)('rejects invalid preset source data %#', (preset, code) => {
    expectMixError(() => validateMixPresetContract(preset as MixPreset), code);
  });

  it('deep-clones categories and line arrays', () => {
    const original = plasterPreset();
    const cloned = cloneMixPreset(original);

    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned.compatibleCategories).not.toBe(original.compatibleCategories);
    expect(cloned.lines).not.toBe(original.lines);
    expect(cloned.lines[0]).not.toBe(original.lines[0]);
  });
});

describe('anchor-based ratio resolution', () => {
  it('resolves a 2:1 plaster mix from a primary volume anchor', () => {
    const result = resolveMixRatio(plasterPreset(), {
      materialId: 'MAT-PLASTER',
      quantity: 3,
      unit: 'cup',
    });

    expect(result.presetId).toBe('MIX-PLASTER-2-1');
    expect(result.basis).toBe('volume');
    expect(result.quantityPerPart).toBeCloseTo(1.5);
    expect(result.lines).toEqual([
      {
        materialId: 'MAT-PLASTER',
        role: 'primary',
        parts: 2,
        quantity: 3,
        unit: 'cup',
        isAnchor: true,
      },
      {
        materialId: 'MAT-WATER',
        role: 'secondary',
        parts: 1,
        quantity: 1.5,
        unit: 'cup',
        isAnchor: false,
      },
    ]);
  });

  it('resolves a 100:8 candle mix from a weight anchor', () => {
    const result = resolveMixRatio(candlePreset(), {
      materialId: 'MAT-WAX',
      quantity: 500,
      unit: 'g',
    });

    expect(result.quantityPerPart).toBeCloseTo(5);
    expect(result.lines.find((line) => line.materialId === 'MAT-WAX')?.quantity).toBeCloseTo(500);
    expect(result.lines.find((line) => line.materialId === 'MAT-FRAG')?.quantity).toBeCloseTo(40);
  });

  it('can anchor on a non-primary line and preserves deterministic line order', () => {
    const result = resolveMixRatio(plasterPreset(), {
      materialId: 'MAT-WATER',
      quantity: 1.5,
      unit: 'cup',
    });

    expect(result.anchorMaterialId).toBe('MAT-WATER');
    expect(result.lines.map((line) => line.materialId)).toEqual(['MAT-PLASTER', 'MAT-WATER']);
    expect(result.lines[0].quantity).toBeCloseTo(3);
    expect(result.lines[1].quantity).toBeCloseTo(1.5);
    expect(result.lines[1].isAnchor).toBe(true);
  });

  it('supports a single-line mix without inventing another material', () => {
    const result = resolveMixRatio(
      candlePreset({
        id: 'MIX-WAX-ONLY',
        lines: [{ materialId: 'MAT-WAX', role: 'primary', parts: 100 }],
      }),
      { materialId: 'MAT-WAX', quantity: 250, unit: 'g' },
    );

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].quantity).toBeCloseTo(250);
  });

  it('preserves ratio invariants for every resolved line', () => {
    const result = resolveMixRatio(
      candlePreset({
        lines: [
          { materialId: 'MAT-WAX', role: 'primary', parts: 100 },
          { materialId: 'MAT-FRAG', role: 'secondary', parts: 8 },
          { materialId: 'MAT-DYE', role: 'additive', parts: 0.5 },
        ],
      }),
      { materialId: 'MAT-FRAG', quantity: 16, unit: 'g' },
    );

    for (const line of result.lines) {
      expect(line.quantity / line.parts).toBeCloseTo(result.quantityPerPart);
      expect(line.unit).toBe('g');
    }
  });

  it.each([
    [{ materialId: 'MAT-UNKNOWN', quantity: 1, unit: 'cup' as Unit }, 'INVALID_ANCHOR_MATERIAL'],
    [{ materialId: 'MAT-PLASTER', quantity: 0, unit: 'cup' as Unit }, 'INVALID_ANCHOR_QUANTITY'],
    [{ materialId: 'MAT-PLASTER', quantity: -1, unit: 'cup' as Unit }, 'INVALID_ANCHOR_QUANTITY'],
    [
      { materialId: 'MAT-PLASTER', quantity: Number.POSITIVE_INFINITY, unit: 'cup' as Unit },
      'INVALID_ANCHOR_QUANTITY',
    ],
    [{ materialId: 'MAT-PLASTER', quantity: 1, unit: 'bag' as Unit }, 'INVALID_ANCHOR_UNIT'],
    [{ materialId: 'MAT-PLASTER', quantity: 100, unit: 'g' as Unit }, 'ANCHOR_UNIT_BASIS_MISMATCH'],
    [{ materialId: 'MAT-PLASTER', quantity: 1, unit: 'pc' as Unit }, 'ANCHOR_UNIT_BASIS_MISMATCH'],
  ] as const)('rejects invalid volume-anchor input %#', (anchor, code) => {
    expectMixError(() => resolveMixRatio(plasterPreset(), anchor), code);
  });

  it('rejects volume units for weight-basis presets', () => {
    expectMixError(
      () => resolveMixRatio(candlePreset(), { materialId: 'MAT-WAX', quantity: 2, unit: 'cup' }),
      'ANCHOR_UNIT_BASIS_MISMATCH',
    );
  });
});
