import { describe, expect, it } from 'vitest';
import type { MaterialCalibrationEvidence } from '../../domain/materialCalibration';
import type { Material } from '../../domain/materials';
import type { EffectiveRecipeRequirementResult } from '../recipeRequirements/EffectiveRecipeRequirementService';
import { InMemoryCalibrationRepository } from '../calibrations/InMemoryCalibrationRepository';
import { InMemoryMaterialRepository } from '../materials/InMemoryMaterialRepository';
import {
  RecipeMaterialCostPreviewService,
  type EffectiveRecipeRequirementProvider,
} from './RecipeMaterialCostPreviewService';

const plaster: Material = {
  id: 'MAT-PLASTER',
  name: 'Casting Plaster',
  group: 'plaster',
  baseUnit: 'g',
  purchaseQuantity: 1,
  purchaseUnit: 'kg',
  packageCost: 66,
  onHandQuantity: 1,
  onHandUnit: 'kg',
  isActive: true,
};

const wick: Material = {
  id: 'MAT-WICK',
  name: 'Cotton Wick',
  group: 'wick',
  baseUnit: 'pc',
  purchaseQuantity: 100,
  purchaseUnit: 'pc',
  packageCost: 120,
  onHandQuantity: 100,
  onHandUnit: 'pc',
  isActive: true,
};

function requirementResult(
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
        baseQuantityPerProduct: 80,
        source: 'combined',
        contributions: [
          {
            source: 'yield',
            sourceId: 'YS-001',
            baseQuantityPerProduct: 75,
            conversionSource: 'standard',
            calibrationId: null,
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
      },
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
    ],
    issues: [],
    ...overrides,
  };
}

function provider(result: EffectiveRecipeRequirementResult): EffectiveRecipeRequirementProvider {
  return { deriveForProduct: async () => result };
}

describe('RecipeMaterialCostPreviewService', () => {
  it('prices every canonical requirement and returns a ready total', async () => {
    const service = new RecipeMaterialCostPreviewService(
      provider(requirementResult()),
      new InMemoryMaterialRepository([plaster, wick]),
      new InMemoryCalibrationRepository(),
    );

    const result = await service.previewForProduct('ART-001');

    expect(result.status).toBe('ready');
    expect(result.lines).toHaveLength(2);
    expect(result.lines.find((line) => line.materialId === 'MAT-PLASTER')?.materialCostPerProduct).toBeCloseTo(5.28);
    expect(result.lines.find((line) => line.materialId === 'MAT-WICK')?.materialCostPerProduct).toBeCloseTo(1.2);
    expect(result.totalMaterialCostPerProduct).toBeCloseTo(6.48);
    expect(result.costIssues).toEqual([]);
  });

  it('preserves upstream partial readiness even when all available requirements can be costed', async () => {
    const partial = requirementResult({
      status: 'partial',
      issues: [
        {
          code: 'YIELD_HISTORY_NOT_DERIVABLE',
          message: 'Newer yield evidence cannot currently be derived.',
        },
      ],
    });
    const service = new RecipeMaterialCostPreviewService(
      provider(partial),
      new InMemoryMaterialRepository([plaster, wick]),
      new InMemoryCalibrationRepository(),
    );

    const result = await service.previewForProduct('ART-001');
    expect(result.status).toBe('partial');
    expect(result.requirementStatus).toBe('partial');
    expect(result.requirementIssues).toHaveLength(1);
    expect(result.totalMaterialCostPerProduct).toBeCloseTo(6.48);
  });

  it('returns partial when one material cannot currently be costed but another can', async () => {
    const uncostableWick: Material = {
      ...wick,
      purchaseQuantity: 1,
      purchaseUnit: 'pack',
      manualBaseUnitsPerPurchaseUnit: undefined,
    };
    const service = new RecipeMaterialCostPreviewService(
      provider(requirementResult()),
      new InMemoryMaterialRepository([plaster, uncostableWick]),
      new InMemoryCalibrationRepository(),
    );

    const result = await service.previewForProduct('ART-001');
    expect(result.status).toBe('partial');
    expect(result.lines.map((line) => line.materialId)).toEqual(['MAT-PLASTER']);
    expect(result.costIssues).toEqual([
      expect.objectContaining({
        code: 'MATERIAL_COST_NOT_DERIVABLE',
        materialId: 'MAT-WICK',
      }),
    ]);
  });

  it('returns not-ready when no effective requirement can be priced', async () => {
    const onlyWick = requirementResult({ requirements: requirementResult().requirements.slice(1) });
    const uncostableWick: Material = {
      ...wick,
      purchaseQuantity: 1,
      purchaseUnit: 'pack',
      manualBaseUnitsPerPurchaseUnit: undefined,
    };
    const service = new RecipeMaterialCostPreviewService(
      provider(onlyWick),
      new InMemoryMaterialRepository([uncostableWick]),
      new InMemoryCalibrationRepository(),
    );

    const result = await service.previewForProduct('ART-001');
    expect(result.status).toBe('not-ready');
    expect(result.lines).toEqual([]);
    expect(result.totalMaterialCostPerProduct).toBe(0);
  });

  it('can price archived material records for historical product inspection', async () => {
    const archivedPlaster = { ...plaster, isActive: false };
    const plasterOnly = requirementResult({ requirements: requirementResult().requirements.slice(0, 1) });
    const service = new RecipeMaterialCostPreviewService(
      provider({ ...plasterOnly, productIsActive: false }),
      new InMemoryMaterialRepository([archivedPlaster]),
      new InMemoryCalibrationRepository(),
    );

    const result = await service.previewForProduct('ART-001');
    expect(result.status).toBe('ready');
    expect(result.productIsActive).toBe(false);
    expect(result.totalMaterialCostPerProduct).toBeCloseTo(5.28);
  });

  it('uses material-specific calibration when the purchase package itself is cup-based', async () => {
    const cupPlaster: Material = {
      ...plaster,
      purchaseQuantity: 5,
      purchaseUnit: 'cup',
      packageCost: 66,
    };
    const calibration: MaterialCalibrationEvidence = {
      id: 'CAL-PLASTER',
      materialId: 'MAT-PLASTER',
      measuredVolume: 5,
      volumeUnit: 'cup',
      knownWeight: 1,
      weightUnit: 'kg',
      recordedAt: '2026-09-14T10:00:00.000Z',
    };
    const plasterOnly = requirementResult({ requirements: requirementResult().requirements.slice(0, 1) });
    const service = new RecipeMaterialCostPreviewService(
      provider(plasterOnly),
      new InMemoryMaterialRepository([cupPlaster]),
      new InMemoryCalibrationRepository([calibration]),
    );

    const result = await service.previewForProduct('ART-001');
    expect(result.status).toBe('ready');
    expect(result.lines[0].packageConversionSource).toBe('calibration');
    expect(result.lines[0].costingCalibrationId).toBe('CAL-PLASTER');
    expect(result.lines[0].costPerBaseUnit).toBeCloseTo(0.066);
  });
});
