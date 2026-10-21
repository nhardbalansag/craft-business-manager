import { describe, expect, it } from 'vitest';
import type { ProductFinancialProfile } from '../../domain/productFinancialProfile';
import type { Product } from '../../domain/products';
import type { ProfitMarkupMarginMetricsResult } from './ProfitMarkupMarginMetricsService';
import type { FullyLoadedProductUnitCostResult } from '../productCosts/FullyLoadedProductUnitCostService';
import type { PhysicalPlannedBatchProductionCostResult } from '../production/PhysicalPlannedBatchProductionCostService';
import { ExpectedBatchFinancialsService } from '../production/ExpectedBatchFinancialsService';
import { InMemoryProductPriceTierRepository } from '../productPriceTiers/InMemoryProductPriceTierRepository';
import { ProductPriceTierQuoteService } from '../productPriceTiers/ProductPriceTierQuoteService';
import { ProductPriceTierService } from '../productPriceTiers/ProductPriceTierService';
import { InMemoryProductRepository } from '../products/InMemoryProductRepository';
import { ProductPricingQuoteService } from './ProductPricingQuoteService';

const PRODUCT_ID = 'PROD-TP4';

function product(): Product {
  return {
    id: PRODUCT_ID,
    name: 'TP4 Compatibility Product',
    category: 'candle',
    safetyWasteRate: 0,
    isActive: true,
  };
}

function costEvidence(): FullyLoadedProductUnitCostResult {
  return {
    productId: PRODUCT_ID,
    productName: 'TP4 Compatibility Product',
    productIsActive: true,
    status: 'ready',
    directMaterialCost: null,
    directMaterialMode: 'costed',
    directMaterialCostSubtotal: 70,
    materialComponentCostSubtotal: 0,
    productComponentCostSubtotal: 0,
    inputMaterialComponentSubtotal: 70,
    laborCostPerUnit: 20,
    overheadCostPerUnit: 10,
    knownFullyLoadedUnitCostSubtotal: 100,
    totalFullyLoadedUnitCost: 100,
    componentLines: [],
    issues: [],
  };
}

function financialProfile(): ProductFinancialProfile {
  return {
    productId: PRODUCT_ID,
    laborCostPerUnit: 20,
    overheadCostPerUnit: 10,
    pricingPolicy: { method: 'profit-amount', value: 20 },
    notes: 'Authoritative Default / Single profile',
  };
}

function metricsEvidence(): ProfitMarkupMarginMetricsResult {
  return {
    productId: PRODUCT_ID,
    productName: 'TP4 Compatibility Product',
    productIsActive: true,
    status: 'ready',
    sellingPriceStatus: 'ready',
    costStatus: 'ready',
    totalFullyLoadedUnitCost: 100,
    knownFullyLoadedUnitCostSubtotal: 100,
    sellingPrice: 120,
    pricingPolicy: { method: 'profit-amount', value: 20 },
    profitPerUnit: 20,
    effectiveMarkup: 0.2,
    effectiveMargin: 1 / 6,
    reconciliation: {
      totalFullyLoadedUnitCost: 100,
      profitPerUnit: 20,
      recomposedSellingPrice: 120,
      sellingPrice: 120,
      reconciliationDifference: 0,
    },
    upstreamIssues: [],
    issues: [],
  };
}

function batchEvidence(
  productId: string,
  plannedQuantity: number,
): PhysicalPlannedBatchProductionCostResult {
  const unitCost = costEvidence();
  const plannedProductionCost = 100 * plannedQuantity;

  return {
    productId,
    productName: 'TP4 Compatibility Product',
    productIsActive: true,
    status: 'ready',
    unitCostStatus: 'ready',
    requirementStatus: 'ready',
    plannedQuantity,
    productionRequirements: {
      productId,
      productIsActive: true,
      status: 'ready',
      effectiveYieldSampleId: null,
      skippedInvalidYieldSampleIds: [],
      issues: [],
      plannedQuantity,
      safetyWasteRate: 0,
      safetyWastePercentage: 0,
      safetyWasteMultiplier: 1,
      observedDefectRateIncluded: false,
      requirements: [],
    },
    unitCostEvidence: unitCost,
    directMaterialMode: 'costed',
    directMaterialLines: [],
    materialComponentLines: [],
    productComponentLines: [],
    plannedDirectMaterialCostSubtotal: 70 * plannedQuantity,
    plannedMaterialComponentCostSubtotal: 0,
    plannedProductComponentCostSubtotal: 0,
    laborCostPerUnit: 20,
    laborBatchCost: 20 * plannedQuantity,
    overheadCostPerUnit: 10,
    overheadBatchCost: 10 * plannedQuantity,
    knownPlannedProductionCostSubtotal: plannedProductionCost,
    plannedProductionCost,
    standardUnitCostTimesQuantity: plannedProductionCost,
    physicalVsStandardCostDifference: 0,
    issues: [],
  };
}

function setup() {
  const productRepository = new InMemoryProductRepository([product()]);
  const tierRepository = new InMemoryProductPriceTierRepository();
  const tierService = new ProductPriceTierService(
    tierRepository,
    productRepository,
  );

  const costs = {
    async costProduct() {
      return structuredClone(costEvidence());
    },
  };
  const profiles = {
    async getProfile() {
      return structuredClone(financialProfile());
    },
  };
  const metrics = {
    async deriveForProduct() {
      return structuredClone(metricsEvidence());
    },
  };

  const defaultQuoteService = new ProductPricingQuoteService(
    costs,
    profiles,
    metrics,
  );
  const tierQuoteService = new ProductPriceTierQuoteService(
    costs,
    tierService,
    defaultQuoteService,
  );
  const expectedBatchFinancialsService = new ExpectedBatchFinancialsService(
    defaultQuoteService,
    {
      async costPlannedBatch(productId, plannedQuantity) {
        return batchEvidence(productId, plannedQuantity);
      },
    },
  );

  return {
    tierService,
    defaultQuoteService,
    tierQuoteService,
    expectedBatchFinancialsService,
  };
}

describe('TP4 Default / Single compatibility', () => {
  it('preserves the existing Default / Single quote when no tiers exist', async () => {
    const { defaultQuoteService, tierQuoteService } = setup();

    const quote = await defaultQuoteService.quoteProduct(PRODUCT_ID);
    const tierQuote = await tierQuoteService.quoteProduct(PRODUCT_ID);

    expect(quote).toMatchObject({
      productId: PRODUCT_ID,
      status: 'ready',
      totalFullyLoadedUnitCost: 100,
      sellingPrice: 120,
      profitPerUnit: 20,
      effectiveMarkup: 0.2,
      effectiveMargin: 1 / 6,
      pricingPolicy: { method: 'profit-amount', value: 20 },
    });
    expect(tierQuote.status).toBe('ready');
    expect(tierQuote.defaultSellingPrice).toBe(120);
    expect(tierQuote.tiers).toEqual([]);
  });

  it('adding Package / Bulk tiers does not change any existing Default / Single quote field', async () => {
    const {
      tierService,
      defaultQuoteService,
      tierQuoteService,
    } = setup();

    const before = await defaultQuoteService.quoteProduct(PRODUCT_ID);

    await tierService.createTier({
      productId: PRODUCT_ID,
      name: 'Package 6',
      kind: 'package',
      priceBasis: 'per-offer',
      priceAmount: 600,
      unitsPerOffer: 6,
      minimumOrderQuantity: 6,
      additionalCostPerOffer: 25,
      isActive: true,
    });
    await tierService.createTier({
      productId: PRODUCT_ID,
      name: 'Bulk 20+',
      kind: 'bulk',
      priceBasis: 'per-unit',
      priceAmount: 80,
      unitsPerOffer: 1,
      minimumOrderQuantity: 20,
      additionalCostPerOffer: 0,
      isActive: true,
    });

    const after = await defaultQuoteService.quoteProduct(PRODUCT_ID);
    const tierQuote = await tierQuoteService.quoteProduct(PRODUCT_ID);

    expect(after).toEqual(before);
    expect(after.sellingPrice).toBe(120);
    expect(after.profitPerUnit).toBe(20);
    expect(after.effectiveMarkup).toBe(0.2);
    expect(after.effectiveMargin).toBeCloseTo(1 / 6, 12);
    expect(after.pricingPolicy).toEqual({
      method: 'profit-amount',
      value: 20,
    });

    expect(tierQuote.tiers).toHaveLength(2);
    expect(
      tierQuote.tiers.find((line) => line.tier.name === 'Bulk 20+')
        ?.economics?.effectiveUnitSellingPrice,
    ).toBe(80);
    expect(tierQuote.defaultSellingPrice).toBe(120);
  });

  it('ExpectedBatchFinancials continues using Default / Single revenue even when a cheaper bulk tier exists', async () => {
    const {
      tierService,
      tierQuoteService,
      expectedBatchFinancialsService,
    } = setup();

    const quantity = 20;
    const before = await expectedBatchFinancialsService.projectBatch(
      PRODUCT_ID,
      quantity,
    );

    await tierService.createTier({
      productId: PRODUCT_ID,
      name: 'Bulk 20+',
      kind: 'bulk',
      priceBasis: 'per-unit',
      priceAmount: 80,
      unitsPerOffer: 1,
      minimumOrderQuantity: 20,
      additionalCostPerOffer: 0,
      isActive: true,
    });

    const tierQuote = await tierQuoteService.quoteProduct(PRODUCT_ID);
    const after = await expectedBatchFinancialsService.projectBatch(
      PRODUCT_ID,
      quantity,
    );

    const bulk = tierQuote.tiers.find(
      (line) => line.tier.name === 'Bulk 20+',
    );

    expect(bulk?.economics?.effectiveUnitSellingPrice).toBe(80);
    expect(bulk?.defaultComparison).toMatchObject({
      defaultSellingPrice: 120,
      discountAmountVsDefault: 40,
      discountRateVsDefault: 1 / 3,
    });

    expect(before.expectedRevenue).toBe(120 * quantity);
    expect(after.expectedRevenue).toBe(120 * quantity);
    expect(after.expectedRevenue).toBe(before.expectedRevenue);
    expect(after.sellingPrice).toBe(120);
    expect(after.expectedProfit).toBe(before.expectedProfit);
    expect(after.pricingQuote).toEqual(before.pricingQuote);
  });
});
