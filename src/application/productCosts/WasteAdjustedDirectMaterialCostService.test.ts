import { describe, expect, it, vi } from 'vitest';
import type { WasteAdjustedMaterialRequirement } from '../../domain/productionRequirements';
import type { RecipeMaterialCostLine } from '../../domain/recipeMaterialCostPreview';
import type { ProductionRequirementPlanResult } from '../production/ProductionRequirementService';
import type { RecipeMaterialCostPreviewResult } from '../recipeCosts/RecipeMaterialCostPreviewService';
import {
  WasteAdjustedDirectMaterialCostService,
  WasteAdjustedDirectMaterialCostServiceError,
} from './WasteAdjustedDirectMaterialCostService';

interface RequirementOptions {
  baseUnit?: WasteAdjustedMaterialRequirement['baseUnit'];
  effective?: number;
  reserve?: number;
  planned?: number;
  batch?: number;
  safetyWasteRate?: number;
}

function requirement(
  materialId: string,
  options: RequirementOptions = {},
): WasteAdjustedMaterialRequirement {
  const baseUnit = options.baseUnit ?? 'g';
  const effective = options.effective ?? 100;
  const reserve = options.reserve ?? 10;
  const planned = options.planned ?? effective + reserve;
  const batch = options.batch ?? (baseUnit === 'pc' ? Math.ceil(planned) : planned);
  const safetyWasteRate = options.safetyWasteRate ?? (effective === 0 ? 0 : reserve / effective);

  return {
    materialId,
    baseUnit,
    source: 'yield',
    effectiveBaseQuantityPerProduct: effective,
    safetyWasteRate,
    safetyWasteMultiplier: 1 + safetyWasteRate,
    wasteReserveBaseQuantityPerProduct: reserve,
    plannedBaseQuantityPerProduct: planned,
    plannedBatchBaseQuantity: batch,
    contributions: [
      {
        source: 'yield',
        sourceId: `yield-${materialId}`,
        conversionSource: 'test',
        calibrationId: null,
        effectiveBaseQuantityPerProduct: effective,
        wasteReserveBaseQuantityPerProduct: reserve,
        plannedBaseQuantityPerProduct: planned,
        plannedBatchBaseQuantity: planned,
      },
    ],
  };
}

function costLine(
  materialId: string,
  costPerBaseUnit: number,
  effective = 100,
  baseUnit: RecipeMaterialCostLine['baseUnit'] = 'g',
): RecipeMaterialCostLine {
  return {
    materialId,
    baseUnit,
    baseQuantityPerProduct: effective,
    source: 'yield',
    costPerBaseUnit,
    materialCostPerProduct: effective * costPerBaseUnit,
    packageCost: 250,
    packageBaseQuantity: 1000,
    packageConversionSource: 'standard',
    costingCalibrationId: null,
    contributions: [
      {
        source: 'yield',
        sourceId: `yield-${materialId}`,
        baseQuantityPerProduct: effective,
        conversionSource: 'test',
        calibrationId: null,
        materialCostPerProduct: effective * costPerBaseUnit,
      },
    ],
  };
}

function plan(
  requirements: WasteAdjustedMaterialRequirement[],
  overrides: Partial<ProductionRequirementPlanResult> = {},
): ProductionRequirementPlanResult {
  return {
    productId: 'Product-A',
    productIsActive: true,
    status: 'ready',
    effectiveYieldSampleId: 'yield-1',
    skippedInvalidYieldSampleIds: [],
    issues: [],
    plannedQuantity: 1,
    safetyWasteRate: 0.1,
    safetyWastePercentage: 10,
    safetyWasteMultiplier: 1.1,
    observedDefectRateIncluded: false,
    requirements,
    ...overrides,
  };
}

function preview(
  lines: RecipeMaterialCostLine[],
  overrides: Partial<RecipeMaterialCostPreviewResult> = {},
): RecipeMaterialCostPreviewResult {
  return {
    productId: 'Product-A',
    productIsActive: true,
    status: 'ready',
    requirementStatus: 'ready',
    effectiveYieldSampleId: 'yield-1',
    skippedInvalidYieldSampleIds: [],
    lines,
    totalMaterialCostPerProduct: lines.reduce(
      (sum, line) => sum + line.materialCostPerProduct,
      0,
    ),
    requirementIssues: [],
    costIssues: [],
    ...overrides,
  };
}

function setup(
  requirementResult: ProductionRequirementPlanResult,
  costResult: RecipeMaterialCostPreviewResult,
) {
  const requirementProvider = {
    plan: vi.fn().mockResolvedValue(requirementResult),
  };
  const costProvider = {
    previewForProduct: vi.fn().mockResolvedValue(costResult),
  };
  const service = new WasteAdjustedDirectMaterialCostService(
    requirementProvider,
    costProvider,
  );

  return { service, requirementProvider, costProvider };
}

describe('WasteAdjustedDirectMaterialCostService', () => {
  it('derives base, safety-reserve, and pricing direct-material cost from one-unit evidence', async () => {
    const req = requirement('wax', { effective: 100, reserve: 10, planned: 110 });
    const { service, requirementProvider } = setup(plan([req]), preview([costLine('wax', 0.02)]));

    const result = await service.costProduct(' Product-A ');

    expect(requirementProvider.plan).toHaveBeenCalledWith('Product-A', 1);
    expect(result.status).toBe('ready');
    expect(result.planningBasisQuantity).toBe(1);
    expect(result.baseDirectMaterialCostSubtotal).toBeCloseTo(2);
    expect(result.safetyWasteReserveCostSubtotal).toBeCloseTo(0.2);
    expect(result.pricingDirectMaterialCostPerUnit).toBeCloseTo(2.2);
    expect(result.lines[0]).toMatchObject({
      materialId: 'wax',
      effectiveBaseQuantityPerProduct: 100,
      wasteReserveBaseQuantityPerProduct: 10,
      plannedBaseQuantityPerProduct: 110,
      costPerBaseUnit: 0.02,
      baseDirectMaterialCostPerUnit: 2,
      safetyWasteReserveCostPerUnit: 0.2,
      pricingDirectMaterialCostPerUnit: 2.2,
    });
  });

  it('keeps a zero safety-waste reserve as explicit zero cost', async () => {
    const req = requirement('wax', {
      effective: 100,
      reserve: 0,
      planned: 100,
      safetyWasteRate: 0,
    });
    const { service } = setup(
      plan([req], {
        safetyWasteRate: 0,
        safetyWastePercentage: 0,
        safetyWasteMultiplier: 1,
      }),
      preview([costLine('wax', 0.02)]),
    );

    const result = await service.costProduct('Product-A');

    expect(result.status).toBe('ready');
    expect(result.baseDirectMaterialCostSubtotal).toBeCloseTo(2);
    expect(result.safetyWasteReserveCostSubtotal).toBe(0);
    expect(result.pricingDirectMaterialCostPerUnit).toBeCloseTo(2);
  });

  it('aggregates multiple materials and sorts lines deterministically', async () => {
    const beta = requirement('beta', { effective: 2, reserve: 0.2, planned: 2.2 });
    const alpha = requirement('Alpha', { effective: 3, reserve: 0.3, planned: 3.3 });
    const { service } = setup(
      plan([beta, alpha]),
      preview([
        costLine('beta', 4, 2),
        costLine('alpha', 5, 3),
      ]),
    );

    const result = await service.costProduct('Product-A');

    expect(result.lines.map((line) => line.materialId)).toEqual(['Alpha', 'beta']);
    expect(result.baseDirectMaterialCostSubtotal).toBeCloseTo(23);
    expect(result.safetyWasteReserveCostSubtotal).toBeCloseTo(2.3);
    expect(result.pricingDirectMaterialCostPerUnit).toBeCloseTo(25.3);
  });

  it('uses precise plannedBaseQuantityPerProduct and ignores one-piece pc batch rounding', async () => {
    const wick = requirement('wick', {
      baseUnit: 'pc',
      effective: 0.4,
      reserve: 0.04,
      planned: 0.44,
      batch: 1,
    });
    const { service } = setup(
      plan([wick]),
      preview([costLine('wick', 10, 0.4, 'pc')]),
    );

    const result = await service.costProduct('Product-A');

    expect(result.lines[0]?.plannedBaseQuantityPerProduct).toBe(0.44);
    expect(wick.plannedBatchBaseQuantity).toBe(1);
    expect(result.pricingDirectMaterialCostPerUnit).toBeCloseTo(4.4);
    expect(result.pricingDirectMaterialCostPerUnit).not.toBe(10);
  });

  it('does not apply the safety-waste multiplier a second time', async () => {
    const req = requirement('wax', { effective: 10, reserve: 1, planned: 11 });
    const { service } = setup(plan([req]), preview([costLine('wax', 3, 10)]));

    const result = await service.costProduct('Product-A');

    expect(result.pricingDirectMaterialCostPerUnit).toBeCloseTo(33);
    expect(result.pricingDirectMaterialCostPerUnit).not.toBeCloseTo(36.3);
  });

  it('preserves known cost evidence but reports partial when requirements are partial', async () => {
    const req = requirement('wax');
    const requirementResult = plan([req], {
      status: 'partial',
      issues: [
        {
          code: 'YIELD_HISTORY_NOT_DERIVABLE',
          message: 'Some yield evidence is invalid.',
        },
      ],
    });
    const { service } = setup(requirementResult, preview([costLine('wax', 0.02)]));

    const result = await service.costProduct('Product-A');

    expect(result.status).toBe('partial');
    expect(result.pricingDirectMaterialCostPerUnit).toBeCloseTo(2.2);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'REQUIREMENT_PARTIAL' }),
    );
    expect(result.requirementIssues).toEqual(requirementResult.issues);
  });

  it('preserves known cost evidence but reports partial when costing is partial', async () => {
    const req = requirement('wax');
    const costResult = preview([costLine('wax', 0.02)], {
      status: 'partial',
      costIssues: [
        {
          code: 'MATERIAL_COST_NOT_DERIVABLE',
          materialId: 'other',
          message: 'Other material is not costable.',
        },
      ],
    });
    const { service } = setup(plan([req]), costResult);

    const result = await service.costProduct('Product-A');

    expect(result.status).toBe('partial');
    expect(result.pricingDirectMaterialCostPerUnit).toBeCloseTo(2.2);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'COST_PARTIAL' }));
    expect(result.costIssues).toEqual(costResult.costIssues);
  });

  it('keeps a known subtotal when one planned material is missing cost evidence', async () => {
    const wax = requirement('wax');
    const dye = requirement('dye', { effective: 5, reserve: 0.5, planned: 5.5 });
    const { service } = setup(
      plan([wax, dye]),
      preview([costLine('wax', 0.02)], { status: 'partial' }),
    );

    const result = await service.costProduct('Product-A');

    expect(result.status).toBe('partial');
    expect(result.pricingDirectMaterialCostPerUnit).toBeCloseTo(2.2);
    expect(result.lines.find((line) => line.materialId === 'dye')).toMatchObject({
      status: 'not-ready',
      costPerBaseUnit: null,
      pricingDirectMaterialCostPerUnit: null,
    });
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'MATERIAL_COST_EVIDENCE_MISSING', materialId: 'dye' }),
    );
  });

  it('preserves the existing no-requirements state as not-ready', async () => {
    const requirementResult = plan([], {
      status: 'not-ready',
      issues: [
        {
          code: 'NO_REQUIREMENTS',
          message: 'No direct requirements are derivable.',
        },
      ],
    });
    const costResult = preview([], {
      status: 'not-ready',
      requirementStatus: 'not-ready',
      requirementIssues: requirementResult.issues,
    });
    const { service } = setup(requirementResult, costResult);

    const result = await service.costProduct('Product-A');

    expect(result.status).toBe('not-ready');
    expect(result.lines).toEqual([]);
    expect(result.baseDirectMaterialCostSubtotal).toBeNull();
    expect(result.safetyWasteReserveCostSubtotal).toBeNull();
    expect(result.pricingDirectMaterialCostPerUnit).toBeNull();
    expect(result.requirementIssues[0]?.code).toBe('NO_REQUIREMENTS');
  });

  it('joins material evidence case-insensitively while preserving requirement identity', async () => {
    const req = requirement('Wax-A');
    const { service } = setup(
      plan([req]),
      preview([costLine('  wax-a  ', 0.02)]),
    );

    const result = await service.costProduct('Product-A');

    expect(result.status).toBe('ready');
    expect(result.lines[0]?.materialId).toBe('Wax-A');
  });

  it('fails a base-unit mismatch closed without publishing a derived cost', async () => {
    const req = requirement('wax', { baseUnit: 'g' });
    const { service } = setup(
      plan([req]),
      preview([costLine('wax', 0.02, 100, 'ml')]),
    );

    const result = await service.costProduct('Product-A');

    expect(result.status).toBe('not-ready');
    expect(result.pricingDirectMaterialCostPerUnit).toBeNull();
    expect(result.lines[0]).toMatchObject({ status: 'not-ready', costPerBaseUnit: null });
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'MATERIAL_BASE_UNIT_MISMATCH', materialId: 'wax' }),
    );
  });

  it('surfaces unmatched cost evidence instead of silently accepting inconsistent providers', async () => {
    const req = requirement('wax');
    const { service } = setup(
      plan([req]),
      preview([costLine('wax', 0.02), costLine('ghost', 1, 1)]),
    );

    const result = await service.costProduct('Product-A');

    expect(result.status).toBe('partial');
    expect(result.pricingDirectMaterialCostPerUnit).toBeCloseTo(2.2);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'MATERIAL_REQUIREMENT_EVIDENCE_MISSING',
        materialId: 'ghost',
      }),
    );
  });

  it('throws a typed error when requirement and cost evidence belong to different Products', async () => {
    const req = requirement('wax');
    const { service } = setup(
      plan([req], { productId: 'Product-A' }),
      preview([costLine('wax', 0.02)], { productId: 'Product-B' }),
    );

    await expect(service.costProduct('Product-A')).rejects.toBeInstanceOf(
      WasteAdjustedDirectMaterialCostServiceError,
    );
    await expect(service.costProduct('Product-A')).rejects.toMatchObject({
      code: 'PRODUCT_EVIDENCE_MISMATCH',
      requirementProductId: 'Product-A',
      costProductId: 'Product-B',
    });
  });

  it('fails non-finite cost evidence closed', async () => {
    const req = requirement('wax');
    const invalidCostLine = costLine('wax', Number.POSITIVE_INFINITY);
    const { service } = setup(plan([req]), preview([invalidCostLine]));

    const result = await service.costProduct('Product-A');

    expect(result.status).toBe('not-ready');
    expect(result.pricingDirectMaterialCostPerUnit).toBeNull();
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'DERIVED_COST_INVALID', materialId: 'wax' }),
    );
  });

  it('fails quantity/cost reconciliation errors closed', async () => {
    const req = requirement('wax', { effective: 1, reserve: 0.1, planned: 1.2 });
    const { service } = setup(plan([req]), preview([costLine('wax', 10, 1)]));

    const result = await service.costProduct('Product-A');

    expect(result.status).toBe('not-ready');
    expect(result.pricingDirectMaterialCostPerUnit).toBeNull();
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'DERIVED_COST_RECONCILIATION_FAILED',
        materialId: 'wax',
      }),
    );
  });

  it('defensively clones source issues and nested contribution evidence', async () => {
    const req = requirement('wax');
    const requirementResult = plan([req], {
      status: 'partial',
      issues: [
        {
          code: 'YIELD_HISTORY_NOT_DERIVABLE',
          message: 'Original requirement issue.',
        },
      ],
    });
    const line = costLine('wax', 0.02);
    const costResult = preview([line], {
      status: 'partial',
      costIssues: [
        {
          code: 'MATERIAL_COST_NOT_DERIVABLE',
          materialId: 'other',
          message: 'Original cost issue.',
        },
      ],
    });
    const { service } = setup(requirementResult, costResult);

    const result = await service.costProduct('Product-A');
    result.requirementIssues[0]!.message = 'mutated';
    result.costIssues[0]!.message = 'mutated';
    result.lines[0]!.requirementContributions[0]!.sourceId = 'mutated';
    result.lines[0]!.costContributions[0]!.sourceId = 'mutated';

    expect(requirementResult.issues[0]!.message).toBe('Original requirement issue.');
    expect(costResult.costIssues[0]!.message).toBe('Original cost issue.');
    expect(req.contributions[0]!.sourceId).toBe('yield-wax');
    expect(line.contributions[0]!.sourceId).toBe('yield-wax');
  });
});
