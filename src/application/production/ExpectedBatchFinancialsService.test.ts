import { describe, expect, it } from 'vitest';
import type { FullyLoadedProductUnitCostResult } from '../productCosts/FullyLoadedProductUnitCostService';
import {
  ProductPricingQuoteServiceError,
  type ProductPricingQuoteResult,
} from '../pricing/ProductPricingQuoteService';
import {
  ExpectedBatchFinancialsService,
  ExpectedBatchFinancialsServiceError,
  type ExpectedBatchFinancialsPhysicalCostProvider,
  type ExpectedBatchFinancialsPricingQuoteProvider,
} from './ExpectedBatchFinancialsService';
import {
  PhysicalPlannedBatchProductionCostServiceError,
  type PhysicalPlannedBatchProductionCostResult,
} from './PhysicalPlannedBatchProductionCostService';

function unitCost(
  overrides: Partial<FullyLoadedProductUnitCostResult> = {},
): FullyLoadedProductUnitCostResult {
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
    knownFullyLoadedUnitCostSubtotal: 30,
    totalFullyLoadedUnitCost: 30,
    componentLines: [],
    issues: [],
    ...overrides,
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
      notes: null,
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

function service(
  pricingQuote: ProductPricingQuoteResult = quote(),
  physicalBatch: PhysicalPlannedBatchProductionCostResult = batch(),
): ExpectedBatchFinancialsService {
  const pricing: ExpectedBatchFinancialsPricingQuoteProvider = {
    async quoteProduct() {
      return pricingQuote;
    },
  };
  const physical: ExpectedBatchFinancialsPhysicalCostProvider = {
    async costPlannedBatch() {
      return physicalBatch;
    },
  };
  return new ExpectedBatchFinancialsService(pricing, physical);
}

function quoteForUnitCost(
  totalUnitCost: number,
  sellingPrice: number,
  profitPerUnit: number,
): ProductPricingQuoteResult {
  const cost = unitCost({
    knownFullyLoadedUnitCostSubtotal: totalUnitCost,
    totalFullyLoadedUnitCost: totalUnitCost,
  });
  const base = quote();
  return {
    ...base,
    fullyLoadedUnitCost: cost,
    unitEconomics: {
      ...base.unitEconomics,
      totalFullyLoadedUnitCost: totalUnitCost,
      knownFullyLoadedUnitCostSubtotal: totalUnitCost,
      sellingPrice,
      profitPerUnit,
      reconciliation: {
        totalFullyLoadedUnitCost: totalUnitCost,
        profitPerUnit,
        recomposedSellingPrice: totalUnitCost + profitPerUnit,
        sellingPrice,
        reconciliationDifference: sellingPrice - (totalUnitCost + profitPerUnit),
      },
    },
    knownFullyLoadedUnitCostSubtotal: totalUnitCost,
    totalFullyLoadedUnitCost: totalUnitCost,
    sellingPrice,
    profitPerUnit,
  };
}

function batchForUnitCost(
  totalUnitCost: number,
  plannedProductionCost: number,
  plannedQuantity = 3,
): PhysicalPlannedBatchProductionCostResult {
  const base = batch();
  return {
    ...base,
    plannedQuantity,
    productionRequirements: {
      ...base.productionRequirements,
      plannedQuantity,
    },
    unitCostEvidence: unitCost({
      knownFullyLoadedUnitCostSubtotal: totalUnitCost,
      totalFullyLoadedUnitCost: totalUnitCost,
    }),
    knownPlannedProductionCostSubtotal: plannedProductionCost,
    plannedProductionCost,
    standardUnitCostTimesQuantity: totalUnitCost * plannedQuantity,
    physicalVsStandardCostDifference:
      plannedProductionCost - totalUnitCost * plannedQuantity,
  };
}

describe('ExpectedBatchFinancialsService', () => {
  it('derives a ready batch financial projection when pricing and physical cost are ready', async () => {
    const result = await service().projectBatch('PROD-1', 3);

    expect(result).toMatchObject({
      status: 'ready',
      plannedQuantity: 3,
      sellingPrice: 40,
      profitPerUnit: 10,
      plannedProductionCost: 90,
      expectedRevenue: 120,
      expectedProfit: 30,
      batchMargin: 0.25,
      plannedAverageCostPerFinishedUnit: 30,
      unitProfitTimesQuantity: 30,
      physicalVsUnitProfitDifference: 0,
    });
  });

  it('derives expected revenue strictly from authoritative selling price times quantity', async () => {
    const result = await service().projectBatch('PROD-1', 3);
    expect(result.expectedRevenue).toBe(120);
  });

  it('derives expected profit from revenue minus physical planned production cost', async () => {
    const result = await service().projectBatch('PROD-1', 3);
    expect(result.expectedProfit).toBe(30);
    expect(result.reconciliation).toMatchObject({
      expectedRevenue: 120,
      plannedProductionCost: 90,
      expectedProfit: 30,
      recomposedRevenue: 120,
      reconciliationDifference: 0,
    });
  });

  it('uses physical batch cost so final-batch count rounding changes expected profit', async () => {
    const pricing = quoteForUnitCost(12, 15, 3);
    const physical = batchForUnitCost(12, 44, 3);
    const result = await service(pricing, physical).projectBatch('PROD-1', 3);

    expect(result.status).toBe('ready');
    expect(result.expectedRevenue).toBe(45);
    expect(result.expectedProfit).toBe(1);
    expect(result.unitProfitTimesQuantity).toBe(9);
    expect(result.physicalVsUnitProfitDifference).toBe(-8);
    expect(result.plannedAverageCostPerFinishedUnit).toBeCloseTo(44 / 3);
  });

  it('allows a legitimate negative physical batch profit caused by rounding/cost reality', async () => {
    const pricing = quoteForUnitCost(10, 12, 2);
    const physical = batchForUnitCost(10, 44, 3);
    const result = await service(pricing, physical).projectBatch('PROD-1', 3);

    expect(result.status).toBe('ready');
    expect(result.expectedRevenue).toBe(36);
    expect(result.expectedProfit).toBe(-8);
    expect(result.batchMargin).toBeCloseTo(-8 / 36);
    expect(result.unitProfitTimesQuantity).toBe(6);
    expect(result.physicalVsUnitProfitDifference).toBe(-14);
  });

  it('handles zero planned quantity safely without Infinity or NaN', async () => {
    const zeroBatch = batchForUnitCost(30, 0, 0);
    const result = await service(quote(), zeroBatch).projectBatch('PROD-1', 0);

    expect(result.status).toBe('ready');
    expect(result.expectedRevenue).toBe(0);
    expect(result.expectedProfit).toBe(0);
    expect(result.batchMargin).toBeNull();
    expect(result.plannedAverageCostPerFinishedUnit).toBeNull();
    expect(result.unitProfitTimesQuantity).toBe(0);
    expect(result.physicalVsUnitProfitDifference).toBe(0);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'ZERO_REVENUE_BATCH_MARGIN_UNAVAILABLE' }),
        expect.objectContaining({ code: 'ZERO_QUANTITY_AVERAGE_COST_UNAVAILABLE' }),
      ]),
    );
  });

  it('keeps zero selling-price margin unavailable without downgrading otherwise ready evidence', async () => {
    const pricing = quoteForUnitCost(0, 0, 0);
    const physical = batchForUnitCost(0, 0, 3);
    const result = await service(pricing, physical).projectBatch('PROD-1', 3);

    expect(result.status).toBe('ready');
    expect(result.expectedRevenue).toBe(0);
    expect(result.expectedProfit).toBe(0);
    expect(result.batchMargin).toBeNull();
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'ZERO_REVENUE_BATCH_MARGIN_UNAVAILABLE' }),
      ]),
    );
  });

  it('keeps archived Products inspectable when both upstream sources agree', async () => {
    const pricing = quote({ productIsActive: false });
    pricing.fullyLoadedUnitCost.productIsActive = false;
    pricing.unitEconomics.productIsActive = false;
    pricing.financialProfile = pricing.financialProfile
      ? { ...pricing.financialProfile }
      : null;
    const physical = batch({ productIsActive: false });
    physical.unitCostEvidence.productIsActive = false;
    physical.productionRequirements.productIsActive = false;

    const result = await service(pricing, physical).projectBatch('PROD-1', 3);
    expect(result.status).toBe('ready');
    expect(result.productIsActive).toBe(false);
  });

  it('preserves authoritative expected revenue when physical batch cost is partial', async () => {
    const physical = batch({
      status: 'partial',
      knownPlannedProductionCostSubtotal: 80,
      plannedProductionCost: null,
    });
    const result = await service(quote(), physical).projectBatch('PROD-1', 3);

    expect(result.status).toBe('partial');
    expect(result.expectedRevenue).toBe(120);
    expect(result.plannedProductionCost).toBeNull();
    expect(result.expectedProfit).toBeNull();
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'BATCH_COST_PARTIAL' })]),
    );
  });

  it('propagates partial pricing and withholds authoritative revenue/profit', async () => {
    const pricing = quote({
      status: 'partial',
      metricsStatus: 'partial',
      sellingPriceStatus: 'partial',
      sellingPrice: null,
      profitPerUnit: null,
    });
    const result = await service(pricing, batch()).projectBatch('PROD-1', 3);

    expect(result.status).toBe('partial');
    expect(result.expectedRevenue).toBeNull();
    expect(result.expectedProfit).toBeNull();
    expect(result.plannedProductionCost).toBe(90);
  });

  it('propagates not-ready pricing without upgrading it to partial', async () => {
    const pricing = quote({
      status: 'not-ready',
      metricsStatus: 'not-ready',
      sellingPriceStatus: 'not-ready',
      sellingPrice: null,
      profitPerUnit: null,
    });
    const result = await service(pricing, batch()).projectBatch('PROD-1', 3);

    expect(result.status).toBe('not-ready');
    expect(result.expectedRevenue).toBeNull();
    expect(result.expectedProfit).toBeNull();
  });

  it('propagates not-ready physical cost while retaining independent ready revenue', async () => {
    const physical = batch({
      status: 'not-ready',
      knownPlannedProductionCostSubtotal: null,
      plannedProductionCost: null,
    });
    const result = await service(quote(), physical).projectBatch('PROD-1', 3);

    expect(result.status).toBe('not-ready');
    expect(result.expectedRevenue).toBe(120);
    expect(result.expectedProfit).toBeNull();
  });

  it('fails closed on pricing-quote versus physical-batch Product identity mismatch', async () => {
    const physical = batch({ productId: 'OTHER' });
    const result = await service(quote(), physical).projectBatch('PROD-1', 3);

    expect(result.status).toBe('not-ready');
    expect(result.expectedRevenue).toBeNull();
    expect(result.expectedProfit).toBeNull();
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'QUOTE_BATCH_PRODUCT_MISMATCH' })]),
    );
  });

  it('fails closed on Product active-state mismatch', async () => {
    const result = await service(quote(), batch({ productIsActive: false })).projectBatch(
      'PROD-1',
      3,
    );
    expect(result.status).toBe('not-ready');
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'PRODUCT_ACTIVE_STATE_MISMATCH' })]),
    );
  });

  it('fails closed when physical batch returns a different quantity', async () => {
    const result = await service(quote(), batch({ plannedQuantity: 2 })).projectBatch(
      'PROD-1',
      3,
    );
    expect(result.status).toBe('not-ready');
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'BATCH_QUANTITY_MISMATCH' })]),
    );
  });

  it('fails closed on unit-cost status mismatch', async () => {
    const physical = batch({ unitCostStatus: 'partial' });
    const result = await service(quote(), physical).projectBatch('PROD-1', 3);
    expect(result.status).toBe('not-ready');
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'UNIT_COST_STATUS_MISMATCH' })]),
    );
  });

  it('fails closed on standard unit-cost mismatch between pricing and physical evidence', async () => {
    const physical = batch({
      unitCostEvidence: unitCost({
        knownFullyLoadedUnitCostSubtotal: 31,
        totalFullyLoadedUnitCost: 31,
      }),
    });
    const result = await service(quote(), physical).projectBatch('PROD-1', 3);
    expect(result.status).toBe('not-ready');
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'TOTAL_UNIT_COST_MISMATCH' })]),
    );
  });

  it('fails closed when a ready pricing quote carries non-finite selling price', async () => {
    const pricing = quote({ sellingPrice: Number.POSITIVE_INFINITY });
    const result = await service(pricing, batch()).projectBatch('PROD-1', 3);
    expect(result.status).toBe('not-ready');
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'SELLING_PRICE_INVALID' })]),
    );
  });

  it('fails closed when a ready pricing quote carries non-finite unit profit', async () => {
    const pricing = quote({ profitPerUnit: Number.NaN });
    const result = await service(pricing, batch()).projectBatch('PROD-1', 3);
    expect(result.status).toBe('not-ready');
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'UNIT_PROFIT_INVALID' })]),
    );
  });

  it('fails closed when ready physical evidence carries invalid planned production cost', async () => {
    const physical = batch({ plannedProductionCost: Number.POSITIVE_INFINITY });
    const result = await service(quote(), physical).projectBatch('PROD-1', 3);
    expect(result.status).toBe('not-ready');
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'PLANNED_PRODUCTION_COST_INVALID' }),
      ]),
    );
  });

  it('fails closed when derived expected revenue overflows', async () => {
    const pricing = quote({
      sellingPrice: Number.MAX_VALUE,
      profitPerUnit: Number.MAX_VALUE,
    });
    const physical = batchForUnitCost(30, 60, 2);
    const result = await service(pricing, physical).projectBatch('PROD-1', 2);

    expect(result.status).toBe('not-ready');
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'DERIVED_FINANCIAL_INVALID' })]),
    );
  });

  it('translates Product-not-found from the pricing quote boundary', async () => {
    const pricing: ExpectedBatchFinancialsPricingQuoteProvider = {
      async quoteProduct() {
        throw new ProductPricingQuoteServiceError(
          'PRODUCT_NOT_FOUND',
          'Product missing.',
          'MISSING',
        );
      },
    };
    const physical: ExpectedBatchFinancialsPhysicalCostProvider = {
      async costPlannedBatch() {
        return batch();
      },
    };
    const subject = new ExpectedBatchFinancialsService(pricing, physical);

    await expect(subject.projectBatch('MISSING', 2)).rejects.toMatchObject({
      name: 'ExpectedBatchFinancialsServiceError',
      code: 'PRODUCT_NOT_FOUND',
      productId: 'MISSING',
      plannedQuantity: 2,
    });
  });

  it('translates invalid planned quantity and preserves the underlying Phase 2 code', async () => {
    const pricing: ExpectedBatchFinancialsPricingQuoteProvider = {
      async quoteProduct() {
        return quote();
      },
    };
    const physical: ExpectedBatchFinancialsPhysicalCostProvider = {
      async costPlannedBatch(productId, plannedQuantity) {
        throw new PhysicalPlannedBatchProductionCostServiceError(
          'INVALID_PLANNED_QUANTITY',
          'Invalid quantity.',
          {
            productId,
            plannedQuantity,
            underlyingCode: 'NEGATIVE_PLANNED_QUANTITY',
          },
        );
      },
    };
    const subject = new ExpectedBatchFinancialsService(pricing, physical);

    await expect(subject.projectBatch('PROD-1', -1)).rejects.toMatchObject({
      code: 'INVALID_PLANNED_QUANTITY',
      underlyingCode: 'NEGATIVE_PLANNED_QUANTITY',
    });
  });

  it('translates production-requirement request errors', async () => {
    const pricing: ExpectedBatchFinancialsPricingQuoteProvider = {
      async quoteProduct() {
        return quote();
      },
    };
    const physical: ExpectedBatchFinancialsPhysicalCostProvider = {
      async costPlannedBatch(productId, plannedQuantity) {
        throw new PhysicalPlannedBatchProductionCostServiceError(
          'PRODUCTION_REQUIREMENT_INVALID',
          'Production requirement invalid.',
          { productId, plannedQuantity },
        );
      },
    };
    const subject = new ExpectedBatchFinancialsService(pricing, physical);

    await expect(subject.projectBatch('PROD-1', 3)).rejects.toMatchObject({
      code: 'PRODUCTION_REQUIREMENT_INVALID',
    });
  });

  it('defensively clones retained pricing and physical batch evidence', async () => {
    const sourceQuote = quote({
      issues: [
        {
          code: 'UPSTREAM_PARTIAL',
          message: 'Pricing trace.',
          productId: 'PROD-1',
        },
      ],
    });
    const sourceBatch = batch({
      issues: [
        {
          code: 'UPSTREAM_COST_PARTIAL',
          message: 'Physical trace.',
          productId: 'PROD-1',
        },
      ],
    });
    const result = await service(sourceQuote, sourceBatch).projectBatch('PROD-1', 3);

    result.pricingQuote.issues[0].message = 'Mutated quote';
    result.pricingQuote.fullyLoadedUnitCost.totalFullyLoadedUnitCost = 999;
    result.physicalBatchCost.issues[0].message = 'Mutated batch';
    result.physicalBatchCost.unitCostEvidence.totalFullyLoadedUnitCost = 888;

    expect(sourceQuote.issues[0].message).toBe('Pricing trace.');
    expect(sourceQuote.fullyLoadedUnitCost.totalFullyLoadedUnitCost).toBe(30);
    expect(sourceBatch.issues[0].message).toBe('Physical trace.');
    expect(sourceBatch.unitCostEvidence.totalFullyLoadedUnitCost).toBe(30);
  });

  it('propagates unexpected provider failures instead of relabeling them', async () => {
    const unexpected = new Error('pricing infrastructure unavailable');
    const pricing: ExpectedBatchFinancialsPricingQuoteProvider = {
      async quoteProduct() {
        throw unexpected;
      },
    };
    const physical: ExpectedBatchFinancialsPhysicalCostProvider = {
      async costPlannedBatch() {
        return batch();
      },
    };
    const subject = new ExpectedBatchFinancialsService(pricing, physical);

    await expect(subject.projectBatch('PROD-1', 3)).rejects.toBe(unexpected);
  });

  it('uses canonical Product identity from pricing when requesting physical cost', async () => {
    let physicalRequestedProductId: string | null = null;
    const pricing: ExpectedBatchFinancialsPricingQuoteProvider = {
      async quoteProduct() {
        return quote({ productId: 'PROD-1' });
      },
    };
    const physical: ExpectedBatchFinancialsPhysicalCostProvider = {
      async costPlannedBatch(productId) {
        physicalRequestedProductId = productId;
        return batch();
      },
    };
    const subject = new ExpectedBatchFinancialsService(pricing, physical);

    await subject.projectBatch(' prod-1 ', 3);
    expect(physicalRequestedProductId).toBe('PROD-1');
  });
});
