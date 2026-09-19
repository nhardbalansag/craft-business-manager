import { describe, expect, it } from 'vitest';
import type { FullyLoadedProductUnitCostResult } from '../productCosts/FullyLoadedProductUnitCostService';
import {
  ProductPricingQuoteServiceError,
  type ProductPricingQuoteResult,
} from '../pricing/ProductPricingQuoteService';
import {
  ExpectedBatchFinancialsService,
  type ExpectedBatchFinancialsPhysicalCostProvider,
  type ExpectedBatchFinancialsPricingQuoteProvider,
} from './ExpectedBatchFinancialsService';
import {
  PhysicalPlannedBatchProductionCostServiceError,
  type PhysicalPlannedBatchProductionCostResult,
} from './PhysicalPlannedBatchProductionCostService';

function unitCost(total = 30): FullyLoadedProductUnitCostResult {
  return {
    productId: 'PROD-1',
    productName: 'Test Product',
    productIsActive: true,
    status: 'ready',
    directMaterialCost: null,
    directMaterialMode: 'neutral-component-only',
    directMaterialCostSubtotal: 0,
    materialComponentCostSubtotal: 22,
    productComponentCostSubtotal: 0,
    inputMaterialComponentSubtotal: 22,
    laborCostPerUnit: 5,
    overheadCostPerUnit: 3,
    knownFullyLoadedUnitCostSubtotal: total,
    totalFullyLoadedUnitCost: total,
    componentLines: [],
    issues: [],
  };
}

function quote(
  overrides: Partial<ProductPricingQuoteResult> = {},
): ProductPricingQuoteResult {
  const cost = unitCost();
  return {
    productId: 'PROD-1',
    productName: 'Test Product',
    productIsActive: true,
    status: 'ready',
    costStatus: 'ready',
    sellingPriceStatus: 'ready',
    metricsStatus: 'ready',
    financialProfile: {
      productId: 'PROD-1',
      laborCostPerUnit: 5,
      overheadCostPerUnit: 3,
      pricingPolicy: { method: 'profit-amount', value: 10 },
    },
    fullyLoadedUnitCost: cost,
    unitEconomics: {
      productId: 'PROD-1',
      productName: 'Test Product',
      productIsActive: true,
      status: 'ready',
      sellingPriceStatus: 'ready',
      costStatus: 'ready',
      totalFullyLoadedUnitCost: 30,
      knownFullyLoadedUnitCostSubtotal: 30,
      sellingPrice: 40,
      pricingPolicy: { method: 'profit-amount', value: 10 },
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
    pricingPolicy: { method: 'profit-amount', value: 10 },
    sellingPrice: 40,
    profitPerUnit: 10,
    effectiveMarkup: 1 / 3,
    effectiveMargin: 0.25,
    issues: [],
    ...overrides,
  };
}

function batch(
  overrides: Partial<PhysicalPlannedBatchProductionCostResult> = {},
): PhysicalPlannedBatchProductionCostResult {
  return {
    productId: 'PROD-1',
    productName: 'Test Product',
    productIsActive: true,
    status: 'ready',
    unitCostStatus: 'ready',
    requirementStatus: 'ready',
    plannedQuantity: 3,
    productionRequirements: {
      productId: 'PROD-1',
      productIsActive: true,
      status: 'ready',
      effectiveYieldSampleId: null,
      skippedInvalidYieldSampleIds: [],
      issues: [],
      plannedQuantity: 3,
      safetyWasteRate: 0,
      safetyWastePercentage: 0,
      safetyWasteMultiplier: 1,
      observedDefectRateIncluded: false,
      requirements: [],
    },
    unitCostEvidence: unitCost(),
    directMaterialMode: 'neutral-component-only',
    directMaterialLines: [],
    materialComponentLines: [],
    productComponentLines: [],
    plannedDirectMaterialCostSubtotal: 0,
    plannedMaterialComponentCostSubtotal: 66,
    plannedProductComponentCostSubtotal: 0,
    laborCostPerUnit: 5,
    laborBatchCost: 15,
    overheadCostPerUnit: 3,
    overheadBatchCost: 9,
    knownPlannedProductionCostSubtotal: 90,
    plannedProductionCost: 90,
    standardUnitCostTimesQuantity: 90,
    physicalVsStandardCostDifference: 0,
    issues: [],
    ...overrides,
  };
}

function subject(
  pricingQuote: ProductPricingQuoteResult = quote(),
  physicalBatch: PhysicalPlannedBatchProductionCostResult = batch(),
): ExpectedBatchFinancialsService {
  return new ExpectedBatchFinancialsService(
    { async quoteProduct() { return pricingQuote; } },
    { async costPlannedBatch() { return physicalBatch; } },
  );
}

function scenario(
  totalUnitCost: number,
  sellingPrice: number,
  profitPerUnit: number,
  physicalCost: number,
  quantity = 3,
) {
  const pricing = quote({
    totalFullyLoadedUnitCost: totalUnitCost,
    knownFullyLoadedUnitCostSubtotal: totalUnitCost,
    sellingPrice,
    profitPerUnit,
    fullyLoadedUnitCost: unitCost(totalUnitCost),
    unitEconomics: {
      ...quote().unitEconomics,
      totalFullyLoadedUnitCost: totalUnitCost,
      knownFullyLoadedUnitCostSubtotal: totalUnitCost,
      sellingPrice,
      profitPerUnit,
    },
  });
  const physical = batch({
    plannedQuantity: quantity,
    productionRequirements: { ...batch().productionRequirements, plannedQuantity: quantity },
    unitCostEvidence: unitCost(totalUnitCost),
    knownPlannedProductionCostSubtotal: physicalCost,
    plannedProductionCost: physicalCost,
    standardUnitCostTimesQuantity: totalUnitCost * quantity,
    physicalVsStandardCostDifference: physicalCost - totalUnitCost * quantity,
  });
  return { pricing, physical };
}

describe('ExpectedBatchFinancialsService', () => {
  it('derives ready revenue, profit, margin, average cost, and reconciliation', async () => {
    const result = await subject().projectBatch('PROD-1', 3);
    expect(result).toMatchObject({
      status: 'ready',
      expectedRevenue: 120,
      expectedProfit: 30,
      batchMargin: 0.25,
      plannedAverageCostPerFinishedUnit: 30,
      unitProfitTimesQuantity: 30,
      physicalVsUnitProfitDifference: 0,
    });
    expect(result.reconciliation).toMatchObject({
      expectedRevenue: 120,
      plannedProductionCost: 90,
      expectedProfit: 30,
      recomposedRevenue: 120,
      reconciliationDifference: 0,
    });
  });

  it('uses physical batch cost so count rounding changes expected profit', async () => {
    const { pricing, physical } = scenario(12, 15, 3, 44);
    const result = await subject(pricing, physical).projectBatch('PROD-1', 3);
    expect(result.status).toBe('ready');
    expect(result.expectedRevenue).toBe(45);
    expect(result.expectedProfit).toBe(1);
    expect(result.unitProfitTimesQuantity).toBe(9);
    expect(result.physicalVsUnitProfitDifference).toBe(-8);
    expect(result.plannedAverageCostPerFinishedUnit).toBeCloseTo(44 / 3);
  });

  it('preserves valid negative physical batch profit and margin', async () => {
    const { pricing, physical } = scenario(10, 12, 2, 44);
    const result = await subject(pricing, physical).projectBatch('PROD-1', 3);
    expect(result.status).toBe('ready');
    expect(result.expectedProfit).toBe(-8);
    expect(result.batchMargin).toBeCloseTo(-8 / 36);
    expect(result.physicalVsUnitProfitDifference).toBe(-14);
  });

  it('handles zero quantity and zero-revenue diagnostics without Infinity or NaN', async () => {
    const { pricing, physical } = scenario(30, 40, 10, 0, 0);
    const result = await subject(pricing, physical).projectBatch('PROD-1', 0);
    expect(result.status).toBe('ready');
    expect(result.expectedRevenue).toBe(0);
    expect(result.expectedProfit).toBe(0);
    expect(result.batchMargin).toBeNull();
    expect(result.plannedAverageCostPerFinishedUnit).toBeNull();
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'ZERO_REVENUE_BATCH_MARGIN_UNAVAILABLE' }),
      expect.objectContaining({ code: 'ZERO_QUANTITY_AVERAGE_COST_UNAVAILABLE' }),
    ]));
  });

  it('allows zero selling price with unavailable batch margin when evidence is otherwise ready', async () => {
    const { pricing, physical } = scenario(0, 0, 0, 0);
    const result = await subject(pricing, physical).projectBatch('PROD-1', 3);
    expect(result.status).toBe('ready');
    expect(result.expectedRevenue).toBe(0);
    expect(result.expectedProfit).toBe(0);
    expect(result.batchMargin).toBeNull();
  });

  it('keeps archived Products inspectable when source active state agrees', async () => {
    const pricing = quote({ productIsActive: false });
    const physical = batch({ productIsActive: false });
    const result = await subject(pricing, physical).projectBatch('PROD-1', 3);
    expect(result.status).toBe('ready');
    expect(result.productIsActive).toBe(false);
  });

  it('keeps expected revenue when physical cost is partial but withholds expected profit', async () => {
    const physical = batch({ status: 'partial', knownPlannedProductionCostSubtotal: 80, plannedProductionCost: null });
    const result = await subject(quote(), physical).projectBatch('PROD-1', 3);
    expect(result.status).toBe('partial');
    expect(result.expectedRevenue).toBe(120);
    expect(result.plannedProductionCost).toBeNull();
    expect(result.expectedProfit).toBeNull();
  });

  it('propagates partial pricing and not-ready sources without upgrading them', async () => {
    const partialPricing = quote({ status: 'partial', sellingPrice: null, profitPerUnit: null });
    const partialResult = await subject(partialPricing, batch()).projectBatch('PROD-1', 3);
    expect(partialResult.status).toBe('partial');
    expect(partialResult.expectedRevenue).toBeNull();

    const notReadyBatch = batch({ status: 'not-ready', plannedProductionCost: null });
    const notReadyResult = await subject(quote(), notReadyBatch).projectBatch('PROD-1', 3);
    expect(notReadyResult.status).toBe('not-ready');
    expect(notReadyResult.expectedRevenue).toBe(120);
    expect(notReadyResult.expectedProfit).toBeNull();
  });

  it.each([
    ['product identity', quote(), batch({ productId: 'OTHER' }), 'QUOTE_BATCH_PRODUCT_MISMATCH'],
    ['active state', quote(), batch({ productIsActive: false }), 'PRODUCT_ACTIVE_STATE_MISMATCH'],
    ['quantity', quote(), batch({ plannedQuantity: 2 }), 'BATCH_QUANTITY_MISMATCH'],
    ['cost status', quote(), batch({ unitCostStatus: 'partial' }), 'UNIT_COST_STATUS_MISMATCH'],
  ] as const)('fails closed on %s contradiction', async (_label, pricing, physical, code) => {
    const result = await subject(pricing, physical).projectBatch('PROD-1', 3);
    expect(result.status).toBe('not-ready');
    expect(result.expectedRevenue).toBeNull();
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code })]));
  });

  it('fails closed on standard unit-cost disagreement', async () => {
    const physical = batch({ unitCostEvidence: unitCost(31) });
    const result = await subject(quote(), physical).projectBatch('PROD-1', 3);
    expect(result.status).toBe('not-ready');
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'TOTAL_UNIT_COST_MISMATCH' }),
    ]));
  });

  it.each([
    ['selling price', quote({ sellingPrice: Number.POSITIVE_INFINITY }), batch(), 'SELLING_PRICE_INVALID'],
    ['unit profit', quote({ profitPerUnit: Number.NaN }), batch(), 'UNIT_PROFIT_INVALID'],
    ['physical cost', quote(), batch({ plannedProductionCost: Number.POSITIVE_INFINITY }), 'PLANNED_PRODUCTION_COST_INVALID'],
  ] as const)('fails closed on invalid %s evidence', async (_label, pricing, physical, code) => {
    const result = await subject(pricing, physical).projectBatch('PROD-1', 3);
    expect(result.status).toBe('not-ready');
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code })]));
  });

  it('fails closed on non-finite derived revenue', async () => {
    const pricing = quote({ sellingPrice: Number.MAX_VALUE, profitPerUnit: Number.MAX_VALUE });
    const physical = batch({ plannedQuantity: 2, productionRequirements: { ...batch().productionRequirements, plannedQuantity: 2 } });
    const result = await subject(pricing, physical).projectBatch('PROD-1', 2);
    expect(result.status).toBe('not-ready');
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'DERIVED_FINANCIAL_INVALID' }),
    ]));
  });

  it('translates Product-not-found from the pricing boundary', async () => {
    const pricing: ExpectedBatchFinancialsPricingQuoteProvider = {
      async quoteProduct() {
        throw new ProductPricingQuoteServiceError('PRODUCT_NOT_FOUND', 'Missing.', 'MISSING');
      },
    };
    const physical: ExpectedBatchFinancialsPhysicalCostProvider = { async costPlannedBatch() { return batch(); } };
    const service = new ExpectedBatchFinancialsService(pricing, physical);
    await expect(service.projectBatch('MISSING', 2)).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND', productId: 'MISSING', plannedQuantity: 2,
    });
  });

  it('translates planned-quantity errors with underlying Phase 2 code', async () => {
    const pricing: ExpectedBatchFinancialsPricingQuoteProvider = { async quoteProduct() { return quote(); } };
    const physical: ExpectedBatchFinancialsPhysicalCostProvider = {
      async costPlannedBatch(productId, plannedQuantity) {
        throw new PhysicalPlannedBatchProductionCostServiceError('INVALID_PLANNED_QUANTITY', 'Invalid.', {
          productId, plannedQuantity, underlyingCode: 'NEGATIVE_PLANNED_QUANTITY',
        });
      },
    };
    const service = new ExpectedBatchFinancialsService(pricing, physical);
    await expect(service.projectBatch('PROD-1', -1)).rejects.toMatchObject({
      code: 'INVALID_PLANNED_QUANTITY', underlyingCode: 'NEGATIVE_PLANNED_QUANTITY',
    });
  });

  it('translates production-requirement errors and propagates unexpected failures', async () => {
    const pricing: ExpectedBatchFinancialsPricingQuoteProvider = { async quoteProduct() { return quote(); } };
    const invalidPhysical: ExpectedBatchFinancialsPhysicalCostProvider = {
      async costPlannedBatch(productId, plannedQuantity) {
        throw new PhysicalPlannedBatchProductionCostServiceError('PRODUCTION_REQUIREMENT_INVALID', 'Invalid.', {
          productId, plannedQuantity,
        });
      },
    };
    const service = new ExpectedBatchFinancialsService(pricing, invalidPhysical);
    await expect(service.projectBatch('PROD-1', 3)).rejects.toMatchObject({ code: 'PRODUCTION_REQUIREMENT_INVALID' });

    const unexpected = new Error('infrastructure unavailable');
    const failingPricing: ExpectedBatchFinancialsPricingQuoteProvider = { async quoteProduct() { throw unexpected; } };
    await expect(new ExpectedBatchFinancialsService(failingPricing, invalidPhysical).projectBatch('PROD-1', 3)).rejects.toBe(unexpected);
  });

  it('defensively clones retained 4.3C and 4.4A evidence', async () => {
    const sourceQuote = quote({ issues: [{ code: 'UPSTREAM_PARTIAL', message: 'Quote trace.', productId: 'PROD-1' }] });
    const sourceBatch = batch({ issues: [{ code: 'UPSTREAM_COST_PARTIAL', message: 'Batch trace.', productId: 'PROD-1' }] });
    const result = await subject(sourceQuote, sourceBatch).projectBatch('PROD-1', 3);

    result.pricingQuote.issues[0].message = 'Mutated';
    result.pricingQuote.fullyLoadedUnitCost.totalFullyLoadedUnitCost = 999;
    result.physicalBatchCost.issues[0].message = 'Mutated';
    result.physicalBatchCost.unitCostEvidence.totalFullyLoadedUnitCost = 888;

    expect(sourceQuote.issues[0].message).toBe('Quote trace.');
    expect(sourceQuote.fullyLoadedUnitCost.totalFullyLoadedUnitCost).toBe(30);
    expect(sourceBatch.issues[0].message).toBe('Batch trace.');
    expect(sourceBatch.unitCostEvidence.totalFullyLoadedUnitCost).toBe(30);
  });

  it('uses the canonical 4.3C Product identity for the physical-cost request', async () => {
    let requested: string | null = null;
    const pricing: ExpectedBatchFinancialsPricingQuoteProvider = { async quoteProduct() { return quote(); } };
    const physical: ExpectedBatchFinancialsPhysicalCostProvider = {
      async costPlannedBatch(productId) { requested = productId; return batch(); },
    };
    await new ExpectedBatchFinancialsService(pricing, physical).projectBatch(' prod-1 ', 3);
    expect(requested).toBe('PROD-1');
  });
});
