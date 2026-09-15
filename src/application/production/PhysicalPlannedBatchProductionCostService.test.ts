import { describe, expect, it } from 'vitest';
import {
  ProductionRequirementError,
  type ProductionRequirementErrorCode,
} from '../../domain/productionRequirements';
import type { MaterialBackedComponentCostLine } from '../productComponents/MaterialBackedComponentCostService';
import {
  FullyLoadedProductUnitCostServiceError,
  type FullyLoadedProductUnitCostResult,
} from '../productCosts/FullyLoadedProductUnitCostService';
import type { RecursiveFullyLoadedProductComponentCostLine } from '../productCosts/RecursiveFullyLoadedProductComponentCostService';
import type {
  WasteAdjustedDirectMaterialCostLine,
  WasteAdjustedDirectMaterialCostResult,
} from '../productCosts/WasteAdjustedDirectMaterialCostService';
import type { ProductionRequirementPlanResult } from './ProductionRequirementService';
import {
  PhysicalPlannedBatchProductionCostService,
  PhysicalPlannedBatchProductionCostServiceError,
  type PhysicalPlannedBatchFullyLoadedCostProvider,
  type PhysicalPlannedBatchProductionRequirementProvider,
} from './PhysicalPlannedBatchProductionCostService';

function directLine(
  overrides: Partial<WasteAdjustedDirectMaterialCostLine> = {},
): WasteAdjustedDirectMaterialCostLine {
  return {
    materialId: 'MAT-1',
    baseUnit: 'g',
    source: 'yield',
    status: 'ready',
    effectiveBaseQuantityPerProduct: 10,
    wasteReserveBaseQuantityPerProduct: 1,
    plannedBaseQuantityPerProduct: 11,
    costPerBaseUnit: 2,
    baseDirectMaterialCostPerUnit: 20,
    safetyWasteReserveCostPerUnit: 2,
    pricingDirectMaterialCostPerUnit: 22,
    packageCost: null,
    packageBaseQuantity: null,
    packageConversionSource: null,
    costingCalibrationId: null,
    requirementContributions: [
      {
        source: 'yield',
        sourceId: 'YS-1',
        conversionSource: 'calibration',
        calibrationId: 'CAL-1',
        effectiveBaseQuantityPerProduct: 10,
        wasteReserveBaseQuantityPerProduct: 1,
        plannedBaseQuantityPerProduct: 11,
        plannedBatchBaseQuantity: 11,
      },
    ],
    costContributions: [],
    issues: [],
    ...overrides,
  };
}

function directCost(
  overrides: Partial<WasteAdjustedDirectMaterialCostResult> = {},
): WasteAdjustedDirectMaterialCostResult {
  return {
    productId: 'PROD-1',
    productIsActive: true,
    status: 'ready',
    planningBasisQuantity: 1,
    safetyWasteRate: 0.1,
    safetyWastePercentage: 10,
    safetyWasteMultiplier: 1.1,
    observedDefectRateIncluded: false,
    baseDirectMaterialCostSubtotal: 20,
    safetyWasteReserveCostSubtotal: 2,
    pricingDirectMaterialCostPerUnit: 22,
    lines: [directLine()],
    requirementIssues: [],
    costIssues: [],
    issues: [],
    ...overrides,
  };
}

function materialComponent(
  overrides: Partial<MaterialBackedComponentCostLine> = {},
): MaterialBackedComponentCostLine {
  return {
    componentId: 'COMP-MAT',
    parentProductId: 'PROD-1',
    role: 'vessel',
    sourceMaterialId: 'MAT-VESSEL',
    sourceMaterialName: 'Purchased Vessel',
    quantityPerParent: 2,
    status: 'ready',
    costPerPc: 3,
    componentCostContribution: 6,
    costingTrace: null,
    sourceAvailability: null,
    issues: [],
    ...overrides,
  };
}

function productComponent(
  overrides: Partial<RecursiveFullyLoadedProductComponentCostLine> = {},
): RecursiveFullyLoadedProductComponentCostLine {
  return {
    componentId: 'COMP-CHILD',
    parentProductId: 'PROD-1',
    role: 'molded-component',
    childProductId: 'CHILD-1',
    childProductName: 'Handmade Pot',
    quantityPerParent: 2,
    path: ['prod-1', 'child-1'],
    status: 'ready',
    childDirectMaterialCost: null,
    childDirectMaterialMode: 'neutral-component-only',
    childMaterialComponentCostSubtotal: 0,
    childProductComponentCostSubtotal: 0,
    childLaborCostPerUnit: 1,
    childOverheadCostPerUnit: 1,
    knownChildProductionCostSubtotal: 7,
    childFullyLoadedUnitCost: 7,
    knownComponentCostContribution: 14,
    componentCostContribution: 14,
    breakdown: [],
    issues: [],
    ...overrides,
  };
}

function unitCost(
  overrides: Partial<FullyLoadedProductUnitCostResult> = {},
): FullyLoadedProductUnitCostResult {
  return {
    productId: 'PROD-1',
    productName: 'Test Product',
    productIsActive: true,
    status: 'ready',
    directMaterialCost: directCost(),
    directMaterialMode: 'costed',
    directMaterialCostSubtotal: 22,
    materialComponentCostSubtotal: 0,
    productComponentCostSubtotal: 0,
    inputMaterialComponentSubtotal: 22,
    laborCostPerUnit: 5,
    overheadCostPerUnit: 3,
    knownFullyLoadedUnitCostSubtotal: 30,
    totalFullyLoadedUnitCost: 30,
    componentLines: [],
    issues: [],
    ...overrides,
  };
}

function plan(overrides: Partial<ProductionRequirementPlanResult> = {}): ProductionRequirementPlanResult {
  return {
    productId: 'PROD-1',
    productIsActive: true,
    status: 'ready',
    effectiveYieldSampleId: 'YS-1',
    skippedInvalidYieldSampleIds: [],
    issues: [],
    plannedQuantity: 3,
    safetyWasteRate: 0.1,
    safetyWastePercentage: 10,
    safetyWasteMultiplier: 1.1,
    observedDefectRateIncluded: false,
    requirements: [
      {
        materialId: 'MAT-1',
        baseUnit: 'g',
        source: 'yield',
        effectiveBaseQuantityPerProduct: 10,
        safetyWasteRate: 0.1,
        safetyWasteMultiplier: 1.1,
        wasteReserveBaseQuantityPerProduct: 1,
        plannedBaseQuantityPerProduct: 11,
        plannedBatchBaseQuantity: 33,
        contributions: [
          {
            source: 'yield',
            sourceId: 'YS-1',
            conversionSource: 'calibration',
            calibrationId: 'CAL-1',
            effectiveBaseQuantityPerProduct: 10,
            wasteReserveBaseQuantityPerProduct: 1,
            plannedBaseQuantityPerProduct: 11,
            plannedBatchBaseQuantity: 33,
          },
        ],
      },
    ],
    ...overrides,
  };
}

function service(
  planned: ProductionRequirementPlanResult = plan(),
  cost: FullyLoadedProductUnitCostResult = unitCost(),
): PhysicalPlannedBatchProductionCostService {
  const requirements: PhysicalPlannedBatchProductionRequirementProvider = {
    async plan() {
      return planned;
    },
  };
  const costs: PhysicalPlannedBatchFullyLoadedCostProvider = {
    async costProduct() {
      return cost;
    },
  };
  return new PhysicalPlannedBatchProductionCostService(requirements, costs);
}

function countMaterialScenario() {
  const countPlan = plan({
    plannedQuantity: 3,
    safetyWasteRate: 0,
    safetyWastePercentage: 0,
    safetyWasteMultiplier: 1,
    requirements: [
      {
        materialId: 'MAT-PC',
        baseUnit: 'pc',
        source: 'fixed',
        effectiveBaseQuantityPerProduct: 0.4,
        safetyWasteRate: 0,
        safetyWasteMultiplier: 1,
        wasteReserveBaseQuantityPerProduct: 0,
        plannedBaseQuantityPerProduct: 0.4,
        plannedBatchBaseQuantity: 2,
        contributions: [
          {
            source: 'fixed',
            sourceId: 'FIX-1',
            role: 'other',
            conversionSource: 'standard',
            calibrationId: null,
            effectiveBaseQuantityPerProduct: 0.4,
            wasteReserveBaseQuantityPerProduct: 0,
            plannedBaseQuantityPerProduct: 0.4,
            plannedBatchBaseQuantity: 1.2000000000000002,
          },
        ],
      },
    ],
  });

  const countDirect = directCost({
    safetyWasteRate: 0,
    safetyWastePercentage: 0,
    safetyWasteMultiplier: 1,
    baseDirectMaterialCostSubtotal: 4,
    safetyWasteReserveCostSubtotal: 0,
    pricingDirectMaterialCostPerUnit: 4,
    lines: [
      directLine({
        materialId: 'MAT-PC',
        baseUnit: 'pc',
        source: 'fixed',
        effectiveBaseQuantityPerProduct: 0.4,
        wasteReserveBaseQuantityPerProduct: 0,
        plannedBaseQuantityPerProduct: 0.4,
        costPerBaseUnit: 10,
        baseDirectMaterialCostPerUnit: 4,
        safetyWasteReserveCostPerUnit: 0,
        pricingDirectMaterialCostPerUnit: 4,
        requirementContributions: [],
      }),
    ],
  });

  const countCost = unitCost({
    directMaterialCost: countDirect,
    directMaterialCostSubtotal: 4,
    inputMaterialComponentSubtotal: 4,
    knownFullyLoadedUnitCostSubtotal: 12,
    totalFullyLoadedUnitCost: 12,
  });

  return { countPlan, countCost };
}

describe('PhysicalPlannedBatchProductionCostService', () => {
  it('derives a ready physical batch cost for continuous direct materials', async () => {
    const result = await service().costPlannedBatch('PROD-1', 3);

    expect(result).toMatchObject({
      status: 'ready',
      plannedQuantity: 3,
      plannedDirectMaterialCostSubtotal: 66,
      plannedMaterialComponentCostSubtotal: 0,
      plannedProductComponentCostSubtotal: 0,
      laborBatchCost: 15,
      overheadBatchCost: 9,
      knownPlannedProductionCostSubtotal: 90,
      plannedProductionCost: 90,
      standardUnitCostTimesQuantity: 90,
      physicalVsStandardCostDifference: 0,
    });
  });

  it('uses final-batch count-material rounding instead of unit cost times quantity', async () => {
    const { countPlan, countCost } = countMaterialScenario();
    const result = await service(countPlan, countCost).costPlannedBatch('PROD-1', 3);

    expect(result.status).toBe('ready');
    expect(result.plannedDirectMaterialCostSubtotal).toBe(20);
    expect(result.plannedProductionCost).toBe(44);
    expect(result.standardUnitCostTimesQuantity).toBe(36);
    expect(result.physicalVsStandardCostDifference).toBe(8);
  });

  it('exposes the physical count-rounding quantity and cost delta', async () => {
    const { countPlan, countCost } = countMaterialScenario();
    const result = await service(countPlan, countCost).costPlannedBatch('PROD-1', 3);
    const line = result.directMaterialLines[0];

    expect(line.preciseBatchBaseQuantity).toBeCloseTo(1.2);
    expect(line.physicalBatchBaseQuantity).toBe(2);
    expect(line.countRoundingExtraBaseQuantity).toBeCloseTo(0.8);
    expect(line.preciseBatchCost).toBeCloseTo(12);
    expect(line.countRoundingExtraCost).toBeCloseTo(8);
    expect(line.plannedBatchCost).toBe(20);
  });

  it('uses the Phase 2 safety-waste-adjusted physical requirement exactly once', async () => {
    const result = await service().costPlannedBatch('PROD-1', 3);
    const line = result.directMaterialLines[0];

    expect(line.plannedBaseQuantityPerProduct).toBe(11);
    expect(line.physicalBatchBaseQuantity).toBe(33);
    expect(line.plannedBatchCost).toBe(66);
  });

  it('scales Material-backed discrete component cost without parent waste inflation', async () => {
    const line = materialComponent();
    const cost = unitCost({
      materialComponentCostSubtotal: 6,
      inputMaterialComponentSubtotal: 28,
      knownFullyLoadedUnitCostSubtotal: 36,
      totalFullyLoadedUnitCost: 36,
      componentLines: [{ sourceType: 'material', line }],
    });
    const result = await service(plan(), cost).costPlannedBatch('PROD-1', 3);

    expect(result.materialComponentLines[0]).toMatchObject({
      quantityPerParent: 2,
      plannedComponentQuantity: 6,
      perParentCostContribution: 6,
      plannedBatchCost: 18,
    });
    expect(result.plannedMaterialComponentCostSubtotal).toBe(18);
    expect(result.plannedProductionCost).toBe(108);
  });

  it('scales Product-backed child fully loaded production cost', async () => {
    const line = productComponent();
    const cost = unitCost({
      productComponentCostSubtotal: 14,
      inputMaterialComponentSubtotal: 36,
      knownFullyLoadedUnitCostSubtotal: 44,
      totalFullyLoadedUnitCost: 44,
      componentLines: [{ sourceType: 'product', line }],
    });
    const result = await service(plan(), cost).costPlannedBatch('PROD-1', 3);

    expect(result.productComponentLines[0]).toMatchObject({
      childFullyLoadedUnitCost: 7,
      quantityPerParent: 2,
      plannedChildQuantity: 6,
      perParentCostContribution: 14,
      plannedBatchCost: 42,
    });
    expect(result.plannedProductComponentCostSubtotal).toBe(42);
    expect(result.plannedProductionCost).toBe(132);
  });

  it('scales root labor and overhead by requested quantity', async () => {
    const result = await service().costPlannedBatch('PROD-1', 3);
    expect(result.laborBatchCost).toBe(15);
    expect(result.overheadBatchCost).toBe(9);
  });

  it('reconciles multiple material and Product-backed component costs', async () => {
    const material = materialComponent();
    const child = productComponent();
    const cost = unitCost({
      materialComponentCostSubtotal: 6,
      productComponentCostSubtotal: 14,
      inputMaterialComponentSubtotal: 42,
      knownFullyLoadedUnitCostSubtotal: 50,
      totalFullyLoadedUnitCost: 50,
      componentLines: [
        { sourceType: 'material', line: material },
        { sourceType: 'product', line: child },
      ],
    });
    const result = await service(plan(), cost).costPlannedBatch('PROD-1', 3);

    expect(result.plannedDirectMaterialCostSubtotal).toBe(66);
    expect(result.plannedMaterialComponentCostSubtotal).toBe(18);
    expect(result.plannedProductComponentCostSubtotal).toBe(42);
    expect(result.plannedProductionCost).toBe(150);
  });

  it('supports controlled neutral direct-material semantics for genuine component-only Products', async () => {
    const neutralPlan = plan({
      status: 'not-ready',
      effectiveYieldSampleId: null,
      requirements: [],
      issues: [{ code: 'NO_REQUIREMENTS', message: 'No direct requirements.' }],
    });
    const component = materialComponent({ quantityPerParent: 1, componentCostContribution: 6 });
    const neutralCost = unitCost({
      directMaterialCost: directCost({
        status: 'not-ready',
        baseDirectMaterialCostSubtotal: null,
        safetyWasteReserveCostSubtotal: null,
        pricingDirectMaterialCostPerUnit: null,
        lines: [],
        requirementIssues: [{ code: 'NO_REQUIREMENTS', message: 'No direct requirements.' }],
        issues: [
          { code: 'REQUIREMENT_NOT_READY', message: 'No direct requirements.' },
          { code: 'COST_NOT_READY', message: 'No direct cost requirements.' },
        ],
      }),
      directMaterialMode: 'neutral-component-only',
      directMaterialCostSubtotal: 0,
      materialComponentCostSubtotal: 6,
      inputMaterialComponentSubtotal: 6,
      laborCostPerUnit: 2,
      overheadCostPerUnit: 1,
      knownFullyLoadedUnitCostSubtotal: 9,
      totalFullyLoadedUnitCost: 9,
      componentLines: [{ sourceType: 'material', line: component }],
    });

    const result = await service(neutralPlan, neutralCost).costPlannedBatch('PROD-1', 3);
    expect(result.status).toBe('ready');
    expect(result.directMaterialMode).toBe('neutral-component-only');
    expect(result.plannedDirectMaterialCostSubtotal).toBe(0);
    expect(result.plannedProductionCost).toBe(27);
  });

  it('fails closed when neutral direct-material mode contradicts the current physical plan', async () => {
    const neutralCost = unitCost({
      directMaterialMode: 'neutral-component-only',
      directMaterialCostSubtotal: 0,
      inputMaterialComponentSubtotal: 0,
      knownFullyLoadedUnitCostSubtotal: 8,
      totalFullyLoadedUnitCost: 8,
    });
    const result = await service(plan(), neutralCost).costPlannedBatch('PROD-1', 3);

    expect(result.status).toBe('not-ready');
    expect(result.plannedProductionCost).toBeNull();
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'NEUTRAL_DIRECT_MATERIAL_CONTRADICTION' })]),
    );
  });

  it('accepts zero requested quantity and returns safe zero physical costs when evidence is ready', async () => {
    const zeroPlan = plan({
      plannedQuantity: 0,
      requirements: [
        {
          ...plan().requirements[0],
          plannedBatchBaseQuantity: 0,
          contributions: plan().requirements[0].contributions.map((entry) => ({
            ...entry,
            plannedBatchBaseQuantity: 0,
          })),
        },
      ],
    });
    const result = await service(zeroPlan, unitCost()).costPlannedBatch('PROD-1', 0);

    expect(result.status).toBe('ready');
    expect(result.plannedProductionCost).toBe(0);
    expect(result.standardUnitCostTimesQuantity).toBe(0);
    expect(result.physicalVsStandardCostDifference).toBe(0);
  });

  it('keeps archived Products inspectable for historical batch planning', async () => {
    const archivedPlan = plan({ productIsActive: false });
    const archivedCost = unitCost({ productIsActive: false });
    const result = await service(archivedPlan, archivedCost).costPlannedBatch('PROD-1', 3);

    expect(result.status).toBe('ready');
    expect(result.productIsActive).toBe(false);
  });

  it('returns partial with a known physical subtotal when 4.2C evidence is partial', async () => {
    const partialCost = unitCost({
      status: 'partial',
      laborCostPerUnit: null,
      knownFullyLoadedUnitCostSubtotal: 25,
      totalFullyLoadedUnitCost: null,
      issues: [
        {
          code: 'FINANCIAL_PROFILE_MISSING',
          message: 'Labor is unresolved.',
          productId: 'PROD-1',
        },
      ],
    });
    const result = await service(plan(), partialCost).costPlannedBatch('PROD-1', 3);

    expect(result.status).toBe('partial');
    expect(result.plannedProductionCost).toBeNull();
    expect(result.knownPlannedProductionCostSubtotal).toBe(75);
  });

  it('returns partial when the physical direct-material plan is partial while preserving known cost', async () => {
    const partialPlan = plan({
      status: 'partial',
      issues: [
        {
          code: 'FIXED_ITEM_NOT_DERIVABLE',
          sourceId: 'FIX-BROKEN',
          message: 'One fixed input is unresolved.',
        },
      ],
    });
    const result = await service(partialPlan, unitCost()).costPlannedBatch('PROD-1', 3);

    expect(result.status).toBe('partial');
    expect(result.plannedProductionCost).toBeNull();
    expect(result.knownPlannedProductionCostSubtotal).toBe(90);
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'DIRECT_MATERIAL_PARTIAL' })]),
    );
  });

  it('returns not-ready when 4.2C has no authoritative cost basis', async () => {
    const unavailableCost = unitCost({
      status: 'not-ready',
      directMaterialCost: null,
      directMaterialMode: 'unresolved',
      directMaterialCostSubtotal: 0,
      inputMaterialComponentSubtotal: null,
      laborCostPerUnit: null,
      overheadCostPerUnit: null,
      knownFullyLoadedUnitCostSubtotal: null,
      totalFullyLoadedUnitCost: null,
      issues: [],
    });
    const unavailablePlan = plan({
      status: 'not-ready',
      requirements: [],
      issues: [{ code: 'NO_REQUIREMENTS', message: 'No requirements.' }],
    });
    const result = await service(unavailablePlan, unavailableCost).costPlannedBatch('PROD-1', 3);

    expect(result.status).toBe('not-ready');
    expect(result.plannedProductionCost).toBeNull();
  });

  it('fails closed on Product identity mismatch', async () => {
    const mismatchedCost = unitCost({ productId: 'OTHER' });
    const result = await service(plan(), mismatchedCost).costPlannedBatch('PROD-1', 3);

    expect(result.status).toBe('not-ready');
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'COST_PRODUCT_MISMATCH' }),
        expect.objectContaining({ code: 'PRODUCTION_PLAN_PRODUCT_MISMATCH' }),
      ]),
    );
  });

  it('fails closed when the returned physical planned quantity differs from the request', async () => {
    const mismatchedPlan = plan({ plannedQuantity: 2 });
    const result = await service(mismatchedPlan, unitCost()).costPlannedBatch('PROD-1', 3);

    expect(result.status).toBe('not-ready');
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'PRODUCTION_PLAN_QUANTITY_MISMATCH' })]),
    );
  });

  it('fails closed when a planned material has no matching cost evidence', async () => {
    const cost = unitCost({ directMaterialCost: directCost({ lines: [] }) });
    const result = await service(plan(), cost).costPlannedBatch('PROD-1', 3);

    expect(result.status).toBe('not-ready');
    expect(result.directMaterialLines[0].plannedBatchCost).toBeNull();
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'DIRECT_MATERIAL_EVIDENCE_MISSING' })]),
    );
  });

  it('fails closed when direct cost evidence contains a material absent from the current plan', async () => {
    const emptyPlan = plan({ requirements: [] });
    const result = await service(emptyPlan, unitCost()).costPlannedBatch('PROD-1', 3);

    expect(result.status).toBe('not-ready');
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'DIRECT_MATERIAL_REQUIREMENT_MISSING' })]),
    );
  });

  it('fails closed on a direct-material base-unit mismatch', async () => {
    const mismatchedCost = unitCost({
      directMaterialCost: directCost({ lines: [directLine({ baseUnit: 'mL' })] }),
    });
    const result = await service(plan(), mismatchedCost).costPlannedBatch('PROD-1', 3);

    expect(result.status).toBe('not-ready');
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'DIRECT_MATERIAL_BASE_UNIT_MISMATCH' })]),
    );
  });

  it('fails closed on non-finite direct-material cost evidence', async () => {
    const invalidCost = unitCost({
      directMaterialCost: directCost({ lines: [directLine({ costPerBaseUnit: Number.POSITIVE_INFINITY })] }),
    });
    const result = await service(plan(), invalidCost).costPlannedBatch('PROD-1', 3);

    expect(result.status).toBe('not-ready');
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'DIRECT_MATERIAL_COST_INVALID' })]),
    );
  });

  it('fails closed on invalid Material-backed component contribution', async () => {
    const line = materialComponent({ componentCostContribution: Number.NaN });
    const cost = unitCost({ componentLines: [{ sourceType: 'material', line }] });
    const result = await service(plan(), cost).costPlannedBatch('PROD-1', 3);

    expect(result.status).toBe('not-ready');
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'COMPONENT_COST_INVALID' })]),
    );
  });

  it('preserves partial Product-backed child evidence without publishing an authoritative total', async () => {
    const child = productComponent({
      status: 'partial',
      componentCostContribution: null,
      knownComponentCostContribution: 10,
      issues: [
        {
          code: 'FINANCIAL_PROFILE_MISSING',
          message: 'Child overhead unresolved.',
          productId: 'CHILD-1',
        },
      ],
    });
    const cost = unitCost({
      status: 'partial',
      productComponentCostSubtotal: 10,
      inputMaterialComponentSubtotal: 32,
      knownFullyLoadedUnitCostSubtotal: 40,
      totalFullyLoadedUnitCost: null,
      componentLines: [{ sourceType: 'product', line: child }],
    });
    const result = await service(plan(), cost).costPlannedBatch('PROD-1', 3);

    expect(result.status).toBe('partial');
    expect(result.plannedProductionCost).toBeNull();
    expect(result.productComponentLines[0].knownPlannedBatchCost).toBe(30);
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'PRODUCT_COMPONENT_PARTIAL' })]),
    );
  });

  it('fails closed on invalid root labor evidence', async () => {
    const invalidCost = unitCost({ laborCostPerUnit: Number.NaN });
    const result = await service(plan(), invalidCost).costPlannedBatch('PROD-1', 3);

    expect(result.status).toBe('not-ready');
    expect(result.laborBatchCost).toBeNull();
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'DERIVED_COST_INVALID' })]),
    );
  });

  it('translates Product-not-found from the authoritative 4.2C provider', async () => {
    const requirements: PhysicalPlannedBatchProductionRequirementProvider = {
      async plan() {
        return plan();
      },
    };
    const costs: PhysicalPlannedBatchFullyLoadedCostProvider = {
      async costProduct() {
        throw new FullyLoadedProductUnitCostServiceError(
          'PRODUCT_NOT_FOUND',
          'Product missing.',
          'MISSING',
        );
      },
    };
    const subject = new PhysicalPlannedBatchProductionCostService(requirements, costs);

    await expect(subject.costPlannedBatch('MISSING', 2)).rejects.toMatchObject({
      name: 'PhysicalPlannedBatchProductionCostServiceError',
      code: 'PRODUCT_NOT_FOUND',
      productId: 'MISSING',
    });
  });

  it.each<ProductionRequirementErrorCode>([
    'NON_FINITE_PLANNED_QUANTITY',
    'NEGATIVE_PLANNED_QUANTITY',
    'NON_INTEGER_PLANNED_QUANTITY',
  ])('translates %s while preserving the underlying planned-quantity code', async (code) => {
    const requirements: PhysicalPlannedBatchProductionRequirementProvider = {
      async plan(productId, requested) {
        throw new ProductionRequirementError(code, 'Invalid quantity.', {
          productId,
          input: requested,
        });
      },
    };
    const costs: PhysicalPlannedBatchFullyLoadedCostProvider = {
      async costProduct() {
        return unitCost();
      },
    };
    const subject = new PhysicalPlannedBatchProductionCostService(requirements, costs);

    try {
      await subject.costPlannedBatch('PROD-1', code === 'NON_INTEGER_PLANNED_QUANTITY' ? 1.5 : -1);
      throw new Error('Expected planned quantity validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(PhysicalPlannedBatchProductionCostServiceError);
      expect(error).toMatchObject({
        code: 'INVALID_PLANNED_QUANTITY',
        underlyingCode: code,
      });
    }
  });

  it('defensively clones retained production-plan and 4.2C evidence', async () => {
    const sourcePlan = plan();
    const sourceCost = unitCost({
      issues: [
        {
          code: 'DIRECT_MATERIAL_COST_PARTIAL',
          message: 'Trace issue.',
          productId: 'PROD-1',
        },
      ],
    });
    const result = await service(sourcePlan, sourceCost).costPlannedBatch('PROD-1', 3);

    result.productionRequirements.requirements[0].plannedBatchBaseQuantity = 999;
    result.productionRequirements.issues.push({ code: 'NO_REQUIREMENTS', message: 'Mutated.' });
    result.unitCostEvidence.issues[0].message = 'Mutated result';
    result.unitCostEvidence.directMaterialCost!.lines[0].issues.push({
      code: 'DERIVED_COST_INVALID',
      message: 'Mutated nested issue.',
    });

    expect(sourcePlan.requirements[0].plannedBatchBaseQuantity).toBe(33);
    expect(sourcePlan.issues).toEqual([]);
    expect(sourceCost.issues[0].message).toBe('Trace issue.');
    expect(sourceCost.directMaterialCost!.lines[0].issues).toEqual([]);
  });

  it('propagates unexpected provider failures instead of relabeling them', async () => {
    const unexpected = new Error('database unavailable');
    const requirements: PhysicalPlannedBatchProductionRequirementProvider = {
      async plan() {
        throw unexpected;
      },
    };
    const costs: PhysicalPlannedBatchFullyLoadedCostProvider = {
      async costProduct() {
        return unitCost();
      },
    };
    const subject = new PhysicalPlannedBatchProductionCostService(requirements, costs);

    await expect(subject.costPlannedBatch('PROD-1', 3)).rejects.toBe(unexpected);
  });
});
