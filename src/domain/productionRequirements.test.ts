import { describe, expect, it } from 'vitest';
import type { EffectiveMaterialRequirement } from './effectiveRecipeRequirements';
import {
  ProductionRequirementError,
  deriveWasteAdjustedProductionRequirements,
} from './productionRequirements';
import { deriveProductSafetyWastePolicy } from './safetyWastePolicy';

function requirements(): EffectiveMaterialRequirement[] {
  return [
    {
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
          sourceId: 'RI-001',
          role: 'consumable',
          baseQuantityPerProduct: 5,
          conversionSource: 'standard',
          calibrationId: null,
        },
      ],
    },
    {
      materialId: 'MAT-WATER',
      baseUnit: 'mL',
      baseQuantityPerProduct: 45,
      source: 'yield',
      contributions: [
        {
          source: 'yield',
          sourceId: 'YS-001',
          baseQuantityPerProduct: 45,
          conversionSource: 'standard',
          calibrationId: null,
        },
      ],
    },
  ];
}

describe('waste-adjusted production requirements', () => {
  it('applies one safety-waste multiplier to per-piece and planned-batch quantities', () => {
    const result = deriveWasteAdjustedProductionRequirements(
      'ART-001',
      requirements(),
      deriveProductSafetyWastePolicy({ id: 'ART-001', safetyWasteRate: 0.05 }),
      10,
    );

    expect(result).toMatchObject({
      productId: 'ART-001',
      plannedQuantity: 10,
      safetyWasteRate: 0.05,
      safetyWastePercentage: 5,
      safetyWasteMultiplier: 1.05,
      observedDefectRateIncluded: false,
    });

    const plaster = result.requirements[0];
    expect(plaster.effectiveBaseQuantityPerProduct).toBe(80);
    expect(plaster.wasteReserveBaseQuantityPerProduct).toBeCloseTo(4);
    expect(plaster.plannedBaseQuantityPerProduct).toBeCloseTo(84);
    expect(plaster.plannedBatchBaseQuantity).toBeCloseTo(840);

    expect(plaster.contributions).toEqual([
      expect.objectContaining({
        source: 'yield',
        sourceId: 'YS-001',
        effectiveBaseQuantityPerProduct: 75,
        wasteReserveBaseQuantityPerProduct: 3.75,
        plannedBaseQuantityPerProduct: 78.75,
        plannedBatchBaseQuantity: 787.5,
      }),
      expect.objectContaining({
        source: 'fixed',
        sourceId: 'RI-001',
        role: 'consumable',
        effectiveBaseQuantityPerProduct: 5,
        wasteReserveBaseQuantityPerProduct: 0.25,
        plannedBaseQuantityPerProduct: 5.25,
        plannedBatchBaseQuantity: 52.5,
      }),
    ]);
  });

  it('rounds only the final planned batch total upward for indivisible count materials', () => {
    const countRequirement: EffectiveMaterialRequirement = {
      materialId: 'MAT-BRUSH',
      baseUnit: 'pc',
      baseQuantityPerProduct: 1,
      source: 'fixed',
      contributions: [
        {
          source: 'fixed',
          sourceId: 'RI-BRUSH',
          role: 'finish',
          baseQuantityPerProduct: 1,
          conversionSource: 'standard',
          calibrationId: null,
        },
      ],
    };

    const result = deriveWasteAdjustedProductionRequirements(
      'ART-001',
      [countRequirement],
      deriveProductSafetyWastePolicy({ id: 'ART-001', safetyWasteRate: 0.05 }),
      8,
    );

    const brush = result.requirements[0];
    expect(brush.plannedBaseQuantityPerProduct).toBeCloseTo(1.05, 10);
    expect(brush.wasteReserveBaseQuantityPerProduct).toBeCloseTo(0.05, 10);
    expect(brush.contributions[0].plannedBatchBaseQuantity).toBeCloseTo(8.4, 10);
    expect(brush.plannedBatchBaseQuantity).toBe(9);
  });

  it('handles zero planned quantity without changing per-piece planning', () => {
    const result = deriveWasteAdjustedProductionRequirements(
      'ART-001',
      requirements(),
      deriveProductSafetyWastePolicy({ id: 'ART-001', safetyWasteRate: 0.1 }),
      0,
    );

    expect(result.requirements[0].plannedBaseQuantityPerProduct).toBeCloseTo(88);
    expect(result.requirements[0].plannedBatchBaseQuantity).toBe(0);
    expect(result.requirements[1].plannedBatchBaseQuantity).toBe(0);
  });

  it('leaves quantities unchanged when safety waste is zero', () => {
    const result = deriveWasteAdjustedProductionRequirements(
      'ART-001',
      requirements(),
      deriveProductSafetyWastePolicy({ id: 'ART-001', safetyWasteRate: 0 }),
      3,
    );

    expect(result.requirements[0].wasteReserveBaseQuantityPerProduct).toBe(0);
    expect(result.requirements[0].plannedBaseQuantityPerProduct).toBe(80);
    expect(result.requirements[0].plannedBatchBaseQuantity).toBe(240);
  });

  it.each([
    [Number.NaN, 'NON_FINITE_PLANNED_QUANTITY'],
    [Number.POSITIVE_INFINITY, 'NON_FINITE_PLANNED_QUANTITY'],
    [-1, 'NEGATIVE_PLANNED_QUANTITY'],
    [1.5, 'NON_INTEGER_PLANNED_QUANTITY'],
  ] as const)('rejects invalid planned quantity %s', (quantity, code) => {
    try {
      deriveWasteAdjustedProductionRequirements(
        'ART-001',
        requirements(),
        deriveProductSafetyWastePolicy({ id: 'ART-001', safetyWasteRate: 0.05 }),
        quantity,
      );
      throw new Error('Expected planned quantity validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(ProductionRequirementError);
      expect((error as ProductionRequirementError).code).toBe(code);
    }
  });

  it('rejects a policy belonging to another product', () => {
    expect(() =>
      deriveWasteAdjustedProductionRequirements(
        'ART-001',
        requirements(),
        deriveProductSafetyWastePolicy({ id: 'ART-002', safetyWasteRate: 0.05 }),
        1,
      ),
    ).toThrowError(expect.objectContaining({ code: 'PRODUCT_MISMATCH' }));
  });

  it('rejects non-positive effective requirement quantities', () => {
    const broken = requirements();
    broken[0] = { ...broken[0], baseQuantityPerProduct: 0 };

    expect(() =>
      deriveWasteAdjustedProductionRequirements(
        'ART-001',
        broken,
        deriveProductSafetyWastePolicy({ id: 'ART-001', safetyWasteRate: 0.05 }),
        1,
      ),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_EFFECTIVE_REQUIREMENT' }));
  });

  it('rejects contribution totals that do not reconcile to the effective requirement', () => {
    const broken = requirements();
    broken[0] = {
      ...broken[0],
      contributions: broken[0].contributions.map((contribution, index) =>
        index === 0 ? { ...contribution, baseQuantityPerProduct: 74 } : contribution,
      ),
    };

    expect(() =>
      deriveWasteAdjustedProductionRequirements(
        'ART-001',
        broken,
        deriveProductSafetyWastePolicy({ id: 'ART-001', safetyWasteRate: 0.05 }),
        1,
      ),
    ).toThrowError(expect.objectContaining({ code: 'CONTRIBUTION_RECONCILIATION_FAILED' }));
  });
});
