import { describe, expect, it } from 'vitest';
import type { FixedRecipeItemRequirement } from './fixedRecipeItems';
import {
  EffectiveRecipeRequirementError,
  synthesizeEffectiveRecipeRequirements,
} from './effectiveRecipeRequirements';
import type { YieldSampleLearning } from './yieldLearning';

const yieldLearning: YieldSampleLearning = {
  sampleId: 'YS-001',
  productId: 'ART-001',
  goodPieces: 8,
  rejectedPieces: 1,
  totalPieces: 9,
  defectRate: 1 / 9,
  materialRequirements: [
    {
      materialId: 'MAT-PLASTER',
      sourceQuantity: 3,
      sourceUnit: 'cup',
      baseUnit: 'g',
      normalizedBaseQuantityConsumed: 600,
      baseQuantityPerGoodPiece: 75,
      conversionSource: 'calibration',
      calibrationId: 'CAL-001',
    },
    {
      materialId: 'MAT-WATER',
      sourceQuantity: 1.5,
      sourceUnit: 'cup',
      baseUnit: 'mL',
      normalizedBaseQuantityConsumed: 360,
      baseQuantityPerGoodPiece: 45,
      conversionSource: 'standard',
      calibrationId: null,
    },
  ],
};

const fixedPaint: FixedRecipeItemRequirement = {
  itemId: 'REC-PAINT',
  productId: 'ART-001',
  materialId: 'MAT-PAINT',
  role: 'finish',
  sourceQuantity: 2,
  sourceUnit: 'mL',
  baseUnit: 'mL',
  baseQuantityPerProduct: 2,
  conversionSource: 'standard',
  calibrationId: null,
};

const fixedPlaster: FixedRecipeItemRequirement = {
  itemId: 'REC-PLASTER',
  productId: 'ART-001',
  materialId: 'MAT-PLASTER',
  role: 'other',
  sourceQuantity: 5,
  sourceUnit: 'g',
  baseUnit: 'g',
  baseQuantityPerProduct: 5,
  conversionSource: 'standard',
  calibrationId: null,
};

describe('synthesizeEffectiveRecipeRequirements', () => {
  it('returns yield-only canonical requirements with source traceability', () => {
    const result = synthesizeEffectiveRecipeRequirements('ART-001', yieldLearning, []);

    expect(result.effectiveYieldSampleId).toBe('YS-001');
    expect(result.requirements).toHaveLength(2);
    expect(result.requirements.find((item) => item.materialId === 'MAT-PLASTER')).toEqual(
      expect.objectContaining({
        baseUnit: 'g',
        baseQuantityPerProduct: 75,
        source: 'yield',
      }),
    );
  });

  it('returns fixed-only requirements', () => {
    const result = synthesizeEffectiveRecipeRequirements('ART-001', null, [fixedPaint]);

    expect(result.effectiveYieldSampleId).toBeNull();
    expect(result.requirements).toEqual([
      expect.objectContaining({
        materialId: 'MAT-PAINT',
        baseQuantityPerProduct: 2,
        source: 'fixed',
      }),
    ]);
  });

  it('combines yield and fixed quantities for the same material only after canonical normalization', () => {
    const result = synthesizeEffectiveRecipeRequirements('ART-001', yieldLearning, [fixedPlaster]);
    const plaster = result.requirements.find((item) => item.materialId === 'MAT-PLASTER');

    expect(plaster).toEqual(
      expect.objectContaining({
        baseUnit: 'g',
        baseQuantityPerProduct: 80,
        source: 'combined',
      }),
    );
    expect(plaster?.contributions).toEqual([
      expect.objectContaining({ source: 'yield', sourceId: 'YS-001', baseQuantityPerProduct: 75 }),
      expect.objectContaining({ source: 'fixed', sourceId: 'REC-PLASTER', baseQuantityPerProduct: 5 }),
    ]);
  });

  it('combines independent fixed and yield materials into one sorted requirement set', () => {
    const result = synthesizeEffectiveRecipeRequirements('ART-001', yieldLearning, [fixedPaint]);
    expect(result.requirements.map((item) => item.materialId)).toEqual([
      'MAT-PAINT',
      'MAT-PLASTER',
      'MAT-WATER',
    ]);
  });

  it('rejects product-mismatched source inputs', () => {
    expect(() =>
      synthesizeEffectiveRecipeRequirements('OTHER', yieldLearning, []),
    ).toThrowError(EffectiveRecipeRequirementError);

    expect(() =>
      synthesizeEffectiveRecipeRequirements('OTHER', null, [fixedPaint]),
    ).toThrowError(
      expect.objectContaining<Partial<EffectiveRecipeRequirementError>>({ code: 'PRODUCT_MISMATCH' }),
    );
  });

  it('rejects conflicting canonical units for the same material', () => {
    expect(() =>
      synthesizeEffectiveRecipeRequirements('ART-001', yieldLearning, [
        { ...fixedPlaster, baseUnit: 'mL' },
      ]),
    ).toThrowError(
      expect.objectContaining<Partial<EffectiveRecipeRequirementError>>({
        code: 'MATERIAL_BASE_UNIT_CONFLICT',
        materialId: 'MAT-PLASTER',
      }),
    );
  });

  it('rejects non-positive derived requirement quantities', () => {
    expect(() =>
      synthesizeEffectiveRecipeRequirements('ART-001', null, [
        { ...fixedPaint, baseQuantityPerProduct: 0 },
      ]),
    ).toThrowError(
      expect.objectContaining<Partial<EffectiveRecipeRequirementError>>({
        code: 'INVALID_REQUIREMENT_QUANTITY',
      }),
    );
  });
});
