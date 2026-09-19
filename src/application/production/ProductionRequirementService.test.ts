import { describe, expect, it } from 'vitest';
import type { ProductSafetyWastePolicy } from '../../domain/safetyWastePolicy';
import type { EffectiveRecipeRequirementResult } from '../recipeRequirements/EffectiveRecipeRequirementService';
import {
  ProductionRequirementService,
  type EffectiveRequirementProvider,
  type SafetyWastePolicyProvider,
} from './ProductionRequirementService';

function effectiveResult(
  overrides: Partial<EffectiveRecipeRequirementResult> = {},
): EffectiveRecipeRequirementResult {
  return {
    productId: 'ART-001',
    productIsActive: true,
    status: 'ready',
    effectiveYieldSampleId: 'YS-001',
    skippedInvalidYieldSampleIds: [],
    requirements: [
      {
        materialId: 'MAT-PLASTER',
        baseUnit: 'g',
        baseQuantityPerProduct: 75,
        source: 'yield',
        contributions: [
          {
            source: 'yield',
            sourceId: 'YS-001',
            baseQuantityPerProduct: 75,
            conversionSource: 'calibration',
            calibrationId: 'CAL-001',
          },
        ],
      },
    ],
    issues: [],
    ...overrides,
  };
}

function policy(overrides: Partial<ProductSafetyWastePolicy> = {}): ProductSafetyWastePolicy {
  return {
    productId: 'ART-001',
    rate: 0.05,
    percentage: 5,
    multiplier: 1.05,
    purpose: 'planning-reserve',
    observedDefectRateIncluded: false,
    ...overrides,
  };
}

function service(
  effective = effectiveResult(),
  wastePolicy = policy(),
): ProductionRequirementService {
  const effectiveProvider: EffectiveRequirementProvider = {
    async deriveForProduct() {
      return effective;
    },
  };
  const policyProvider: SafetyWastePolicyProvider = {
    async getSafetyWastePolicy() {
      return wastePolicy;
    },
  };
  return new ProductionRequirementService(effectiveProvider, policyProvider);
}

describe('ProductionRequirementService', () => {
  it('produces a waste-adjusted planned batch while preserving readiness metadata', async () => {
    const result = await service().plan('ART-001', 8);

    expect(result).toMatchObject({
      productId: 'ART-001',
      productIsActive: true,
      status: 'ready',
      effectiveYieldSampleId: 'YS-001',
      plannedQuantity: 8,
      safetyWasteRate: 0.05,
      safetyWastePercentage: 5,
      safetyWasteMultiplier: 1.05,
      observedDefectRateIncluded: false,
    });
    expect(result.requirements[0]).toMatchObject({
      materialId: 'MAT-PLASTER',
      effectiveBaseQuantityPerProduct: 75,
      wasteReserveBaseQuantityPerProduct: 3.75,
      plannedBaseQuantityPerProduct: 78.75,
      plannedBatchBaseQuantity: 630,
    });
  });

  it('preserves partial readiness and issues while planning valid requirements', async () => {
    const result = await service(
      effectiveResult({
        status: 'partial',
        skippedInvalidYieldSampleIds: ['YS-002'],
        issues: [
          {
            code: 'FIXED_ITEM_NOT_DERIVABLE',
            sourceId: 'RI-BROKEN',
            message: 'Fixed line cannot currently be normalized.',
          },
        ],
      }),
    ).plan('ART-001', 2);

    expect(result.status).toBe('partial');
    expect(result.skippedInvalidYieldSampleIds).toEqual(['YS-002']);
    expect(result.issues).toEqual([
      expect.objectContaining({ code: 'FIXED_ITEM_NOT_DERIVABLE', sourceId: 'RI-BROKEN' }),
    ]);
    expect(result.requirements[0].plannedBatchBaseQuantity).toBeCloseTo(157.5);
  });

  it('keeps a not-ready product as an empty plan rather than inventing requirements', async () => {
    const result = await service(
      effectiveResult({
        status: 'not-ready',
        effectiveYieldSampleId: null,
        requirements: [],
        issues: [{ code: 'NO_REQUIREMENTS', message: 'No derivable requirements.' }],
      }),
    ).plan('ART-001', 5);

    expect(result.status).toBe('not-ready');
    expect(result.requirements).toEqual([]);
    expect(result.plannedQuantity).toBe(5);
  });

  it('supports archived-product historical planning without treating it as active production authorization', async () => {
    const result = await service(effectiveResult({ productIsActive: false })).plan('ART-001', 1);
    expect(result.productIsActive).toBe(false);
    expect(result.requirements[0].plannedBaseQuantityPerProduct).toBeCloseTo(78.75);
  });

  it('rejects fractional planned finished-product quantities', async () => {
    await expect(service().plan('ART-001', 2.5)).rejects.toMatchObject({
      name: 'ProductionRequirementError',
      code: 'NON_INTEGER_PLANNED_QUANTITY',
    });
  });
});
