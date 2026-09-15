import { describe, expect, it } from 'vitest';
import type { ExpectedBatchFinancialsResult } from './ExpectedBatchFinancialsService';
import { ExpectedBatchFinancialsServiceError } from './ExpectedBatchFinancialsService';
import type {
  AssemblyCapacityTraceResult,
  LimitingResource,
} from './AssemblyCapacityTraceService';
import {
  PlannedBatchCapacityFeasibilityService,
  PlannedBatchCapacityFeasibilityServiceError,
  type PlannedBatchCapacityFinancialsProvider,
  type PlannedBatchCapacityTraceProvider,
} from './PlannedBatchCapacityFeasibilityService';

function financials(
  overrides: Partial<ExpectedBatchFinancialsResult> = {},
): ExpectedBatchFinancialsResult {
  const unitCost = {
    productId: 'PROD-1',
    productName: 'Test Product',
    productIsActive: true,
    status: 'ready' as const,
    directMaterialCost: null,
    directMaterialMode: 'neutral-component-only' as const,
    directMaterialCostSubtotal: 0,
    materialComponentCostSubtotal: 22,
    productComponentCostSubtotal: 0,
    inputMaterialComponentSubtotal: 22,
    laborCostPerUnit: 5,
    overheadCostPerUnit: 3,
    knownFullyLoadedUnitCostSubtotal: 30,
    totalFullyLoadedUnitCost: 30,
    componentLines: [],
    issues: [],
  };

  const pricingQuote = {
    productId: 'PROD-1',
    productName: 'Test Product',
    productIsActive: true,
    status: 'ready' as const,
    costStatus: 'ready' as const,
    sellingPriceStatus: 'ready' as const,
    metricsStatus: 'ready' as const,
    financialProfile: {
      productId: 'PROD-1',
      laborCostPerUnit: 5,
      overheadCostPerUnit: 3,
      pricingPolicy: { method: 'profit-amount' as const, value: 10 },
    },
    fullyLoadedUnitCost: unitCost,
    unitEconomics: {
      productId: 'PROD-1',
      productName: 'Test Product',
      productIsActive: true,
      status: 'ready' as const,
      sellingPriceStatus: 'ready' as const,
      costStatus: 'ready' as const,
      totalFullyLoadedUnitCost: 30,
      knownFullyLoadedUnitCostSubtotal: 30,
      sellingPrice: 40,
      pricingPolicy: { method: 'profit-amount' as const, value: 10 },
      profitPerUnit: 10,
      effectiveMarkup: 1 / 3,
      effectiveMargin: 0.25,
      reconciliation: {
        totalFullyLoadedUnitCost: 30,
        profitPerUnit: 10,
        recomposedSellingPrice: 40,
        sellingPrice: 40,
        reconciliationDifference: 0,
      },
      upstreamIssues: [],
      issues: [],
    },
    knownFullyLoadedUnitCostSubtotal: 30,
    totalFullyLoadedUnitCost: 30,
    pricingPolicy: { method: 'profit-amount' as const, value: 10 },
    sellingPrice: 40,
    profitPerUnit: 10,
    effectiveMarkup: 1 / 3,
    effectiveMargin: 0.25,
    issues: [],
  };

  const physicalBatchCost = {
    productId: 'PROD-1',
    productName: 'Test Product',
    productIsActive: true,
    status: 'ready' as const,
    unitCostStatus: 'ready' as const,
    requirementStatus: 'ready' as const,
    plannedQuantity: 8,
    productionRequirements: {
      productId: 'PROD-1',
      productIsActive: true,
      status: 'ready' as const,
      effectiveYieldSampleId: null,
      skippedInvalidYieldSampleIds: [],
      issues: [],
      plannedQuantity: 8,
      safetyWasteRate: 0,
      safetyWastePercentage: 0,
      safetyWasteMultiplier: 1,
      observedDefectRateIncluded: false,
      requirements: [],
    },
    unitCostEvidence: unitCost,
    directMaterialMode: 'neutral-component-only' as const,
    directMaterialLines: [],
    materialComponentLines: [],
    productComponentLines: [],
    plannedDirectMaterialCostSubtotal: 0,
    plannedMaterialComponentCostSubtotal: 176,
    plannedProductComponentCostSubtotal: 0,
    laborCostPerUnit: 5,
    laborBatchCost: 40,
    overheadCostPerUnit: 3,
    overheadBatchCost: 24,
    knownPlannedProductionCostSubtotal: 240,
    plannedProductionCost: 240,
    standardUnitCostTimesQuantity: 240,
    physicalVsStandardCostDifference: 0,
    issues: [],
  };

  return {
    productId: 'PROD-1',
    productName: 'Test Product',
    productIsActive: true,
    status: 'ready',
    plannedQuantity: 8,
    pricingQuote,
    physicalBatchCost,
    sellingPrice: 40,
    profitPerUnit: 10,
    plannedProductionCost: 240,
    expectedRevenue: 320,
    expectedProfit: 80,
    batchMargin: 0.25,
    plannedAverageCostPerFinishedUnit: 30,
    unitProfitTimesQuantity: 80,
    physicalVsUnitProfitDifference: 0,
    reconciliation: {
      expectedRevenue: 320,
      plannedProductionCost: 240,
      expectedProfit: 80,
      recomposedRevenue: 320,
      reconciliationDifference: 0,
    },
    issues: [],
    ...overrides,
  };
}

function materialLimiter(overrides: Partial<Extract<LimitingResource, { resourceType: 'material-requirement' }>> = {}): Extract<LimitingResource, { resourceType: 'material-requirement' }> {
  return {
    resourceType: 'material-requirement',
    capacityPieces: 10,
    materialId: 'MAT-PLASTER',
    materialName: 'Plaster',
    baseUnit: 'g',
    normalizedOnHandBaseQuantity: 1000,
    plannedBaseQuantityPerProduct: 100,
    path: [
      { kind: 'product', id: 'PROD-1', name: 'Test Product' },
      { kind: 'material', id: 'MAT-PLASTER', name: 'Plaster' },
    ],
    ...overrides,
  };
}

function materialComponentLimiter(overrides: Partial<Extract<LimitingResource, { resourceType: 'material-backed-component' }>> = {}): Extract<LimitingResource, { resourceType: 'material-backed-component' }> {
  return {
    resourceType: 'material-backed-component',
    capacityPieces: 10,
    componentId: 'COMP-JAR',
    parentProductId: 'PROD-1',
    parentProductName: 'Test Product',
    role: 'vessel',
    materialId: 'MAT-JAR',
    materialName: 'Glass Jar',
    availableQuantity: 10,
    quantityPerParent: 1,
    path: [
      { kind: 'product', id: 'PROD-1', name: 'Test Product' },
      { kind: 'material', id: 'MAT-JAR', name: 'Glass Jar' },
    ],
    ...overrides,
  };
}

function productComponentLimiter(overrides: Partial<Extract<LimitingResource, { resourceType: 'product-backed-component' }>> = {}): Extract<LimitingResource, { resourceType: 'product-backed-component' }> {
  return {
    resourceType: 'product-backed-component',
    capacityPieces: 10,
    componentId: 'COMP-CANDLE',
    parentProductId: 'PROD-1',
    parentProductName: 'Test Product',
    role: 'molded-component',
    productId: 'PROD-CANDLE',
    productName: 'Candle',
    availableQuantity: 20,
    quantityPerParent: 2,
    path: [
      { kind: 'product', id: 'PROD-1', name: 'Test Product' },
      { kind: 'product', id: 'PROD-CANDLE', name: 'Candle' },
    ],
    ...overrides,
  };
}

function trace(
  overrides: Partial<AssemblyCapacityTraceResult> = {},
): AssemblyCapacityTraceResult {
  return {
    productId: 'PROD-1',
    productName: 'Test Product',
    productIsActive: true,
    status: 'ready',
    overallAssemblyCapacity: 10,
    capacitySynthesis: {
      productId: 'PROD-1',
      productIsActive: true,
      status: 'ready',
      directMaterialApplicable: true,
      directMaterialCapacity: {
        productId: 'PROD-1',
        productIsActive: true,
        status: 'ready',
        requirementStatus: 'ready',
        effectiveYieldSampleId: null,
        skippedInvalidYieldSampleIds: [],
        safetyWasteRate: 0,
        safetyWastePercentage: 0,
        safetyWasteMultiplier: 1,
        observedDefectRateIncluded: false,
        produciblePieces: 10,
        limitingMaterialIds: ['MAT-PLASTER'],
        materials: [
          {
            materialId: 'MAT-PLASTER',
            baseUnit: 'g',
            normalizedOnHandBaseQuantity: 1000,
            plannedBaseQuantityPerProduct: 100,
            capacityPieces: 10,
            isLimiting: true,
            enteredOnHandQuantity: 1,
            enteredOnHandUnit: 'kg',
            inventoryConversionSource: 'standard',
            inventoryCalibrationId: null,
          },
        ],
        issues: [],
      },
      componentCapacities: [],
      overallAssemblyCapacity: 10,
      issues: [],
    },
    limitingResources: [materialLimiter()],
    issues: [],
    ...overrides,
  };
}

function withCapacity(
  capacity: number,
  overrides: Partial<AssemblyCapacityTraceResult> = {},
): AssemblyCapacityTraceResult {
  const base = trace();
  return {
    ...base,
    overallAssemblyCapacity: capacity,
    capacitySynthesis: {
      ...base.capacitySynthesis,
      overallAssemblyCapacity: capacity,
      directMaterialCapacity: {
        ...base.capacitySynthesis.directMaterialCapacity,
        produciblePieces: capacity,
        materials: base.capacitySynthesis.directMaterialCapacity.materials.map((entry) => ({
          ...entry,
          capacityPieces: capacity,
        })),
      },
    },
    limitingResources: [materialLimiter({ capacityPieces: capacity })],
    ...overrides,
  };
}

function subject(
  financialValue: ExpectedBatchFinancialsResult = financials(),
  traceValue: AssemblyCapacityTraceResult = trace(),
): PlannedBatchCapacityFeasibilityService {
  return new PlannedBatchCapacityFeasibilityService(
    { async projectBatch() { return financialValue; } },
    { async trace() { return traceValue; } },
  );
}

describe('PlannedBatchCapacityFeasibilityService', () => {
  it('classifies a ready requested batch within current capacity', async () => {
    const result = await subject().assessBatch('PROD-1', 8);
    expect(result).toMatchObject({
      status: 'ready',
      plannedQuantity: 8,
      feasibility: 'within-current-capacity',
      currentAssemblyCapacity: 10,
      overageQuantity: 0,
    });
    expect(result.warnings).toEqual([]);
    expect(result.limitingResources).toHaveLength(1);
  });

  it('treats an exact-capacity request as within current capacity', async () => {
    const result = await subject(financials({ plannedQuantity: 10 }), withCapacity(10)).assessBatch('PROD-1', 10);
    expect(result.feasibility).toBe('within-current-capacity');
    expect(result.overageQuantity).toBe(0);
  });

  it('classifies over-capacity without changing the requested quantity', async () => {
    const result = await subject(financials({ plannedQuantity: 12 }), withCapacity(10)).assessBatch('PROD-1', 12);
    expect(result.status).toBe('ready');
    expect(result.plannedQuantity).toBe(12);
    expect(result.feasibility).toBe('over-current-capacity');
    expect(result.currentAssemblyCapacity).toBe(10);
    expect(result.overageQuantity).toBe(2);
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'OVER_CURRENT_CAPACITY',
        plannedQuantity: 12,
        currentAssemblyCapacity: 10,
        overageQuantity: 2,
      }),
    ]);
    expect(result.warnings[0]?.message).toContain('has not been changed automatically');
  });

  it('reports positive requested quantity over authoritative zero capacity', async () => {
    const result = await subject(financials({ plannedQuantity: 3 }), withCapacity(0)).assessBatch('PROD-1', 3);
    expect(result.feasibility).toBe('over-current-capacity');
    expect(result.currentAssemblyCapacity).toBe(0);
    expect(result.overageQuantity).toBe(3);
  });

  it('treats zero quantity as within authoritative zero capacity', async () => {
    const result = await subject(financials({ plannedQuantity: 0 }), withCapacity(0)).assessBatch('PROD-1', 0);
    expect(result.status).toBe('ready');
    expect(result.feasibility).toBe('within-current-capacity');
    expect(result.overageQuantity).toBe(0);
  });

  it('preserves financial projection values when the requested batch is over capacity', async () => {
    const source = financials({
      plannedQuantity: 12,
      expectedRevenue: 480,
      expectedProfit: 100,
      batchMargin: 100 / 480,
    });
    const result = await subject(source, withCapacity(10)).assessBatch('PROD-1', 12);
    expect(result.feasibility).toBe('over-current-capacity');
    expect(result.financials.expectedRevenue).toBe(480);
    expect(result.financials.expectedProfit).toBe(100);
    expect(result.financials.batchMargin).toBeCloseTo(100 / 480);
  });

  it('preserves every authoritative typed tied limiting resource', async () => {
    const allLimiters: LimitingResource[] = [
      materialLimiter(),
      materialComponentLimiter(),
      productComponentLimiter(),
    ];
    const result = await subject(financials(), trace({ limitingResources: allLimiters })).assessBatch('PROD-1', 8);
    expect(result.status).toBe('ready');
    expect(result.limitingResources.map((entry) => entry.resourceType)).toEqual([
      'material-requirement',
      'material-backed-component',
      'product-backed-component',
    ]);
  });

  it('keeps numeric feasibility when limiter explanation is partial but synthesis capacity is ready', async () => {
    const partialTrace = trace({
      status: 'partial',
      limitingResources: [],
      issues: [{
        code: 'LIMITER_SOURCE_NOT_FOUND',
        message: 'Limiter label missing.',
        productId: 'PROD-1',
        sourceId: 'MAT-PLASTER',
      }],
    });
    const result = await subject(financials(), partialTrace).assessBatch('PROD-1', 8);
    expect(result.status).toBe('partial');
    expect(result.feasibility).toBe('within-current-capacity');
    expect(result.currentAssemblyCapacity).toBe(10);
    expect(result.limitingResources).toEqual([]);
    expect(result.warnings).toEqual([
      expect.objectContaining({ code: 'LIMITING_RESOURCE_EXPLANATION_INCOMPLETE' }),
    ]);
  });

  it('can still classify over capacity when limiter explanation is partial', async () => {
    const base = withCapacity(5);
    const partialTrace = {
      ...base,
      status: 'partial' as const,
      limitingResources: [],
      issues: [{
        code: 'NO_LIMITING_RESOURCES' as const,
        message: 'Limiter explanation incomplete.',
        productId: 'PROD-1',
      }],
    };
    const result = await subject(financials({ plannedQuantity: 8 }), partialTrace).assessBatch('PROD-1', 8);
    expect(result.status).toBe('partial');
    expect(result.feasibility).toBe('over-current-capacity');
    expect(result.overageQuantity).toBe(3);
    expect(result.warnings.map((entry) => entry.code)).toEqual([
      'OVER_CURRENT_CAPACITY',
      'LIMITING_RESOURCE_EXPLANATION_INCOMPLETE',
    ]);
  });

  it('reports capacity unresolved when the authoritative synthesis is partial', async () => {
    const base = trace();
    const partialTrace: AssemblyCapacityTraceResult = {
      ...base,
      status: 'partial',
      overallAssemblyCapacity: null,
      capacitySynthesis: {
        ...base.capacitySynthesis,
        status: 'partial',
        overallAssemblyCapacity: null,
        issues: [{ code: 'DIRECT_MATERIAL_CAPACITY_PARTIAL', message: 'Capacity partial.', productId: 'PROD-1' }],
      },
      limitingResources: [],
      issues: [{ code: 'UPSTREAM_CAPACITY_PARTIAL', message: 'Capacity partial.', productId: 'PROD-1' }],
    };
    const result = await subject(financials(), partialTrace).assessBatch('PROD-1', 8);
    expect(result.status).toBe('partial');
    expect(result.feasibility).toBe('capacity-unresolved');
    expect(result.currentAssemblyCapacity).toBeNull();
    expect(result.overageQuantity).toBeNull();
    expect(result.warnings).toEqual([
      expect.objectContaining({ code: 'CAPACITY_UNRESOLVED' }),
    ]);
  });

  it('keeps joined result not-ready when capacity synthesis is not-ready', async () => {
    const base = trace();
    const notReadyTrace: AssemblyCapacityTraceResult = {
      ...base,
      status: 'not-ready',
      overallAssemblyCapacity: null,
      capacitySynthesis: {
        ...base.capacitySynthesis,
        status: 'not-ready',
        overallAssemblyCapacity: null,
        issues: [{ code: 'DIRECT_MATERIAL_CAPACITY_NOT_READY', message: 'Capacity unavailable.', productId: 'PROD-1' }],
      },
      limitingResources: [],
      issues: [{ code: 'UPSTREAM_CAPACITY_NOT_READY', message: 'Capacity unavailable.', productId: 'PROD-1' }],
    };
    const result = await subject(financials(), notReadyTrace).assessBatch('PROD-1', 8);
    expect(result.status).toBe('not-ready');
    expect(result.feasibility).toBe('capacity-unresolved');
    expect(result.capacityTrace.status).toBe('not-ready');
  });

  it('keeps determinate capacity feasibility while financial evidence is partial', async () => {
    const partialFinancials = financials({
      status: 'partial',
      expectedProfit: null,
      batchMargin: null,
      issues: [{ code: 'BATCH_COST_PARTIAL', message: 'Batch cost partial.', productId: 'PROD-1' }],
    });
    const result = await subject(partialFinancials, trace()).assessBatch('PROD-1', 8);
    expect(result.status).toBe('partial');
    expect(result.feasibility).toBe('within-current-capacity');
    expect(result.currentAssemblyCapacity).toBe(10);
  });

  it('keeps safe capacity evidence while joined readiness is not-ready from financials', async () => {
    const notReadyFinancials = financials({
      status: 'not-ready',
      expectedRevenue: null,
      expectedProfit: null,
      batchMargin: null,
      issues: [{ code: 'PRICING_NOT_READY', message: 'Pricing unavailable.', productId: 'PROD-1' }],
    });
    const result = await subject(notReadyFinancials, trace()).assessBatch('PROD-1', 8);
    expect(result.status).toBe('not-ready');
    expect(result.feasibility).toBe('within-current-capacity');
    expect(result.currentAssemblyCapacity).toBe(10);
    expect(result.limitingResources).toHaveLength(1);
  });

  it('fails closed on financial/capacity Product identity mismatch', async () => {
    const result = await subject(financials(), trace({ productId: 'PROD-OTHER' })).assessBatch('PROD-1', 8);
    expect(result.status).toBe('not-ready');
    expect(result.feasibility).toBe('capacity-unresolved');
    expect(result.currentAssemblyCapacity).toBeNull();
    expect(result.limitingResources).toEqual([]);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'FINANCIAL_CAPACITY_PRODUCT_MISMATCH' }),
      expect.objectContaining({ code: 'TRACE_SYNTHESIS_PRODUCT_MISMATCH' }),
    ]));
  });

  it('fails closed on active-state mismatch between financials and capacity trace', async () => {
    const result = await subject(financials(), trace({ productIsActive: false })).assessBatch('PROD-1', 8);
    expect(result.status).toBe('not-ready');
    expect(result.feasibility).toBe('capacity-unresolved');
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'PRODUCT_ACTIVE_STATE_MISMATCH' }),
      expect.objectContaining({ code: 'TRACE_SYNTHESIS_ACTIVE_STATE_MISMATCH' }),
    ]));
  });

  it('fails closed when trace and retained synthesis Product identities disagree', async () => {
    const base = trace();
    const result = await subject(financials(), {
      ...base,
      capacitySynthesis: { ...base.capacitySynthesis, productId: 'PROD-OTHER' },
    }).assessBatch('PROD-1', 8);
    expect(result.status).toBe('not-ready');
    expect(result.feasibility).toBe('capacity-unresolved');
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'TRACE_SYNTHESIS_PRODUCT_MISMATCH' }),
    ]));
  });

  it('fails closed when trace and retained synthesis active-state evidence disagree', async () => {
    const base = trace();
    const result = await subject(financials(), {
      ...base,
      capacitySynthesis: { ...base.capacitySynthesis, productIsActive: false },
    }).assessBatch('PROD-1', 8);
    expect(result.status).toBe('not-ready');
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'TRACE_SYNTHESIS_ACTIVE_STATE_MISMATCH' }),
    ]));
  });

  it('fails closed on impossible trace/synthesis readiness pairing', async () => {
    const base = trace();
    const result = await subject(financials(), {
      ...base,
      status: 'ready',
      capacitySynthesis: { ...base.capacitySynthesis, status: 'partial' },
    }).assessBatch('PROD-1', 8);
    expect(result.status).toBe('not-ready');
    expect(result.feasibility).toBe('capacity-unresolved');
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'TRACE_SYNTHESIS_STATUS_MISMATCH' }),
    ]));
  });

  it('fails closed when authoritative trace and synthesis capacities disagree', async () => {
    const base = trace();
    const result = await subject(financials(), {
      ...base,
      overallAssemblyCapacity: 9,
    }).assessBatch('PROD-1', 8);
    expect(result.status).toBe('not-ready');
    expect(result.currentAssemblyCapacity).toBeNull();
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'TRACE_SYNTHESIS_CAPACITY_MISMATCH' }),
    ]));
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    -1,
    2.5,
  ])('fails closed on invalid authoritative capacity %s', async (invalidCapacity) => {
    const base = trace();
    const result = await subject(financials(), {
      ...base,
      overallAssemblyCapacity: invalidCapacity,
      capacitySynthesis: { ...base.capacitySynthesis, overallAssemblyCapacity: invalidCapacity },
    }).assessBatch('PROD-1', 8);
    expect(result.status).toBe('not-ready');
    expect(result.feasibility).toBe('capacity-unresolved');
    expect(result.currentAssemblyCapacity).toBeNull();
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CURRENT_CAPACITY_INVALID' }),
    ]));
  });

  it('fails closed when a ready trace provides no limiting resources', async () => {
    const result = await subject(financials(), trace({ limitingResources: [] })).assessBatch('PROD-1', 8);
    expect(result.status).toBe('not-ready');
    expect(result.feasibility).toBe('capacity-unresolved');
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'READY_TRACE_LIMITERS_MISSING' }),
    ]));
  });

  it('fails closed when a ready limiter capacity disagrees with the authoritative minimum', async () => {
    const result = await subject(financials(), trace({
      limitingResources: [materialLimiter({ capacityPieces: 9 })],
    })).assessBatch('PROD-1', 8);
    expect(result.status).toBe('not-ready');
    expect(result.feasibility).toBe('capacity-unresolved');
    expect(result.limitingResources).toEqual([]);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'LIMITER_CAPACITY_MISMATCH' }),
    ]));
  });

  it('keeps archived Products inspectable when active-state evidence agrees', async () => {
    const archivedFinancials = financials({ productIsActive: false });
    const base = trace();
    const archivedTrace: AssemblyCapacityTraceResult = {
      ...base,
      productIsActive: false,
      capacitySynthesis: { ...base.capacitySynthesis, productIsActive: false },
    };
    const result = await subject(archivedFinancials, archivedTrace).assessBatch('PROD-1', 8);
    expect(result.status).toBe('ready');
    expect(result.productIsActive).toBe(false);
    expect(result.feasibility).toBe('within-current-capacity');
  });

  it.each([
    ['PRODUCT_NOT_FOUND' as const, undefined],
    ['INVALID_PLANNED_QUANTITY' as const, 'PLANNED_QUANTITY_MUST_BE_WHOLE'],
    ['PRODUCTION_REQUIREMENT_INVALID' as const, 'REQUIREMENT_INVALID'],
  ])('translates controlled 4.4B error %s and preserves context', async (code, underlyingCode) => {
    const provider: PlannedBatchCapacityFinancialsProvider = {
      async projectBatch() {
        throw new ExpectedBatchFinancialsServiceError(code, 'Controlled failure.', {
          productId: 'PROD-1',
          plannedQuantity: 8,
          underlyingCode,
        });
      },
    };
    const service = new PlannedBatchCapacityFeasibilityService(provider, {
      async trace() { return trace(); },
    });

    await expect(service.assessBatch('PROD-1', 8)).rejects.toMatchObject({
      name: 'PlannedBatchCapacityFeasibilityServiceError',
      code,
      productId: 'PROD-1',
      plannedQuantity: 8,
      underlyingCode,
    } satisfies Partial<PlannedBatchCapacityFeasibilityServiceError>);
  });

  it('propagates unexpected financial-provider failures unchanged', async () => {
    const failure = new Error('database unavailable');
    const service = new PlannedBatchCapacityFeasibilityService(
      { async projectBatch() { throw failure; } },
      { async trace() { return trace(); } },
    );
    await expect(service.assessBatch('PROD-1', 8)).rejects.toBe(failure);
  });

  it('propagates unexpected capacity-provider failures unchanged', async () => {
    const failure = new Error('capacity backend unavailable');
    const service = new PlannedBatchCapacityFeasibilityService(
      { async projectBatch() { return financials(); } },
      { async trace() { throw failure; } },
    );
    await expect(service.assessBatch('PROD-1', 8)).rejects.toBe(failure);
  });

  it('uses canonical 4.4B Product identity for capacity tracing', async () => {
    let tracedProductId: string | undefined;
    const traceProvider: PlannedBatchCapacityTraceProvider = {
      async trace(productId) {
        tracedProductId = productId;
        return trace();
      },
    };
    const service = new PlannedBatchCapacityFeasibilityService(
      { async projectBatch() { return financials(); } },
      traceProvider,
    );
    await service.assessBatch('  prod-1  ', 8);
    expect(tracedProductId).toBe('PROD-1');
  });

  it('defensively clones financials, capacity trace, limiters, warnings, and issues', async () => {
    const sourceFinancials = financials({ plannedQuantity: 12 });
    const sourceTrace = withCapacity(10);
    const result = await subject(sourceFinancials, sourceTrace).assessBatch('PROD-1', 12);

    result.financials.productName = 'Mutated';
    result.capacityTrace.productName = 'Mutated';
    if (result.limitingResources[0]) result.limitingResources[0].path[0]!.name = 'Mutated';
    if (result.warnings[0]) result.warnings[0].message = 'Mutated';
    if (result.issues[0]) result.issues[0].message = 'Mutated';

    expect(sourceFinancials.productName).toBe('Test Product');
    expect(sourceTrace.productName).toBe('Test Product');
    expect(sourceTrace.limitingResources[0]?.path[0]?.name).toBe('Test Product');
  });
});
