import { describe, expect, it } from 'vitest';
import type { EffectiveMaterialRequirement } from './effectiveRecipeRequirements';
import {
  buildRecipeMaterialCostPreview,
  priceEffectiveMaterialRequirement,
  RecipeMaterialCostPreviewError,
  type MaterialCostBasis,
} from './recipeMaterialCostPreview';

const requirement: EffectiveMaterialRequirement = {
  materialId: 'MAT-PLASTER',
  baseUnit: 'g',
  baseQuantityPerProduct: 80,
  source: 'combined',
  contributions: [
    {
      source: 'yield',
      sourceId: 'YS-001',
      baseQuantityPerProduct: 75,
      conversionSource: 'calibration',
      calibrationId: 'CAL-001',
    },
    {
      source: 'fixed',
      sourceId: 'RI-PLASTER',
      role: 'consumable',
      baseQuantityPerProduct: 5,
      conversionSource: 'standard',
      calibrationId: null,
    },
  ],
};

const basis: MaterialCostBasis = {
  materialId: 'MAT-PLASTER',
  baseUnit: 'g',
  costPerBaseUnit: 0.066,
  packageCost: 66,
  packageBaseQuantity: 1000,
  packageConversionSource: 'standard',
  costingCalibrationId: null,
};

describe('recipe material cost preview', () => {
  it('prices a combined requirement and preserves contribution-level cost traceability', () => {
    const line = priceEffectiveMaterialRequirement(requirement, basis);

    expect(line.materialCostPerProduct).toBeCloseTo(5.28);
    expect(line.contributions).toHaveLength(2);
    expect(line.contributions[0].materialCostPerProduct).toBeCloseTo(4.95);
    expect(line.contributions[1].materialCostPerProduct).toBeCloseTo(0.33);
    expect(line.packageConversionSource).toBe('standard');
  });

  it('allows a zero-cost material while preserving a valid requirement', () => {
    const line = priceEffectiveMaterialRequirement(requirement, {
      ...basis,
      packageCost: 0,
      costPerBaseUnit: 0,
    });

    expect(line.materialCostPerProduct).toBe(0);
    expect(line.contributions.every((item) => item.materialCostPerProduct === 0)).toBe(true);
  });

  it('rejects a material/base-unit mismatch', () => {
    expect(() =>
      priceEffectiveMaterialRequirement(requirement, { ...basis, baseUnit: 'mL' }),
    ).toThrowError(
      expect.objectContaining<Partial<RecipeMaterialCostPreviewError>>({
        code: 'MATERIAL_BASE_UNIT_MISMATCH',
      }),
    );
  });

  it('rejects non-finite or negative base-unit cost', () => {
    for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, -0.01]) {
      expect(() =>
        priceEffectiveMaterialRequirement(requirement, { ...basis, costPerBaseUnit: invalid }),
      ).toThrowError(
        expect.objectContaining<Partial<RecipeMaterialCostPreviewError>>({
          code: 'INVALID_COST_PER_BASE_UNIT',
        }),
      );
    }
  });

  it('rejects contribution totals that do not reconcile to the effective requirement', () => {
    const inconsistent: EffectiveMaterialRequirement = {
      ...requirement,
      baseQuantityPerProduct: 90,
    };

    expect(() => priceEffectiveMaterialRequirement(inconsistent, basis)).toThrowError(
      expect.objectContaining<Partial<RecipeMaterialCostPreviewError>>({
        code: 'CONTRIBUTION_TOTAL_MISMATCH',
      }),
    );
  });

  it('builds a deterministic total material cost across material lines', () => {
    const plaster = priceEffectiveMaterialRequirement(requirement, basis);
    const wick = priceEffectiveMaterialRequirement(
      {
        materialId: 'MAT-WICK',
        baseUnit: 'pc',
        baseQuantityPerProduct: 1,
        source: 'fixed',
        contributions: [
          {
            source: 'fixed',
            sourceId: 'RI-WICK',
            role: 'finish',
            baseQuantityPerProduct: 1,
            conversionSource: 'standard',
            calibrationId: null,
          },
        ],
      },
      {
        materialId: 'MAT-WICK',
        baseUnit: 'pc',
        costPerBaseUnit: 1.2,
        packageCost: 120,
        packageBaseQuantity: 100,
        packageConversionSource: 'standard',
        costingCalibrationId: null,
      },
    );

    const preview = buildRecipeMaterialCostPreview('ART-001', [wick, plaster]);
    expect(preview.lines.map((line) => line.materialId)).toEqual(['MAT-PLASTER', 'MAT-WICK']);
    expect(preview.totalMaterialCostPerProduct).toBeCloseTo(6.48);
  });
});
