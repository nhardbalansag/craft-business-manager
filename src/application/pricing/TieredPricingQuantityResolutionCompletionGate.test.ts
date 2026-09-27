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
import { ProductPriceResolutionService } from './ProductPriceResolutionService';
import { ProductPricingQuoteIntegrationService } from './ProductPricingQuoteIntegrationService';
import { ProductPricingQuoteService } from './ProductPricingQuoteService';

const PRODUCT_ID = 'PROD-TP8E';

function product(): Product {
  return {
    id: PRODUCT_ID,
    name: 'TP8E Completion Product',
    category: 'candle',
    safetyWasteRate: 0,
    isActive: true,
  };
}

function costEvidence(): FullyLoadedProductUnitCostResult {
  return {
    productId: PRODUCT_ID,
    productName: 'TP8E Completion Product',
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
    notes: 'TP8E authoritative Default / Single source',
  };
}

function metricsEvidence(): ProfitMarkupMarginMetricsResult {
  return {
    productId: PRODUCT_ID,
    productName: 'TP8E Completion Product',
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
  const plannedProductionCost = 100 * plannedQuantity;

  return {
    productId,
    productName: 'TP8E Completion Product',
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
    unitCostEvidence: costEvidence(),
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
  const integratedQuoteService = new ProductPricingQuoteIntegrationService(
    defaultQuoteService,
    tierQuoteService,
  );
  const resolutionService = new ProductPriceResolutionService(
    integratedQuoteService,
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
    integratedQuoteService,
    resolutionService,
    expectedBatchFinancialsService,
  };
}

describe('TP8E quantity-aware tier resolution completion gate', () => {
  it('keeps Default / Single as fallback while overlapping cheaper and Custom tiers remain manual alternatives', async () => {
    const { tierService, resolutionService } = setup();

    const bulk = await tierService.createTier({
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
    const cheaperBulk = await tierService.createTier({
      productId: PRODUCT_ID,
      name: 'Bulk 20+ Promo',
      kind: 'bulk',
      priceBasis: 'per-unit',
      priceAmount: 70,
      unitsPerOffer: 1,
      minimumOrderQuantity: 20,
      additionalCostPerOffer: 0,
      isActive: true,
    });
    const custom = await tierService.createTier({
      productId: PRODUCT_ID,
      name: 'Event Contract',
      kind: 'custom',
      priceBasis: 'per-unit',
      priceAmount: 75,
      unitsPerOffer: 1,
      minimumOrderQuantity: 20,
      additionalCostPerOffer: 0,
      isActive: true,
    });

    const defaultResolution = await resolutionService.resolve({
      productId: PRODUCT_ID,
      quantity: 20,
    });

    expect(defaultResolution).toMatchObject({
      mode: 'default',
      selectedTierId: null,
      status: 'ready',
      unitSellingPrice: 120,
      totalSellingPrice: 2400,
    });
    expect(defaultResolution.selectedTier).toBeNull();
    expect(defaultResolution.eligibleTierIds).toEqual([
      bulk.id,
      cheaperBulk.id,
      custom.id,
    ]);

    const explicitHigherTier = await resolutionService.resolve({
      productId: PRODUCT_ID,
      quantity: 20,
      selectedTierId: bulk.id,
    });

    expect(explicitHigherTier).toMatchObject({
      mode: 'explicit-tier',
      selectedTierId: bulk.id,
      status: 'ready',
      unitSellingPrice: 80,
      totalSellingPrice: 1600,
    });
    expect(explicitHigherTier.selectedTier?.tier.id).toBe(bulk.id);

    const explicitCustom = await resolutionService.resolve({
      productId: PRODUCT_ID,
      quantity: 20,
      selectedTierId: custom.id,
    });

    expect(explicitCustom).toMatchObject({
      mode: 'explicit-tier',
      selectedTierId: custom.id,
      status: 'ready',
      unitSellingPrice: 75,
      totalSellingPrice: 1500,
    });
  });

  it('enforces per-unit thresholds and exact Package divisibility without mixed Default remainders', async () => {
    const { tierService, resolutionService } = setup();

    const bulk = await tierService.createTier({
      productId: PRODUCT_ID,
      name: 'Bulk 20+',
      kind: 'bulk',
      priceBasis: 'per-unit',
      priceAmount: 105,
      unitsPerOffer: 1,
      minimumOrderQuantity: 20,
      additionalCostPerOffer: 0,
      isActive: true,
    });
    const pack = await tierService.createTier({
      productId: PRODUCT_ID,
      name: 'Package 6',
      kind: 'package',
      priceBasis: 'per-offer',
      priceAmount: 660,
      unitsPerOffer: 6,
      minimumOrderQuantity: 6,
      additionalCostPerOffer: 0,
      isActive: true,
    });

    const belowBulkMinimum = await resolutionService.resolve({
      productId: PRODUCT_ID,
      quantity: 19,
      selectedTierId: bulk.id,
    });
    expect(belowBulkMinimum.status).toBe('not-ready');
    expect(belowBulkMinimum.totalSellingPrice).toBeNull();
    expect(
      belowBulkMinimum.tierEligibility
        .find((candidate) => candidate.tierId === bulk.id)
        ?.issues.map((issue) => issue.code),
    ).toEqual(['QUANTITY_BELOW_MINIMUM']);

    const exactBulkMinimum = await resolutionService.resolve({
      productId: PRODUCT_ID,
      quantity: 20,
      selectedTierId: bulk.id,
    });
    expect(exactBulkMinimum).toMatchObject({
      status: 'ready',
      offerCount: 20,
      unitSellingPrice: 105,
      totalSellingPrice: 2100,
    });

    const divisiblePackage = await resolutionService.resolve({
      productId: PRODUCT_ID,
      quantity: 12,
      selectedTierId: pack.id,
    });
    expect(divisiblePackage).toMatchObject({
      status: 'ready',
      offerCount: 2,
      unitSellingPrice: 110,
      totalSellingPrice: 1320,
    });

    const nonDivisiblePackage = await resolutionService.resolve({
      productId: PRODUCT_ID,
      quantity: 7,
      selectedTierId: pack.id,
    });
    expect(nonDivisiblePackage.status).toBe('not-ready');
    expect(nonDivisiblePackage.offerCount).toBeNull();
    expect(nonDivisiblePackage.unitSellingPrice).toBeNull();
    expect(nonDivisiblePackage.totalSellingPrice).toBeNull();
    expect(nonDivisiblePackage.issues[0]?.code).toBe('SELECTED_TIER_INELIGIBLE');
    expect(
      nonDivisiblePackage.tierEligibility
        .find((candidate) => candidate.tierId === pack.id)
        ?.issues.map((issue) => issue.code),
    ).toEqual(['QUANTITY_NOT_OFFER_MULTIPLE']);
  });

  it('rejects archived tiers but keeps below-cost active tiers manually selectable with warnings', async () => {
    const { tierService, resolutionService } = setup();

    const archived = await tierService.createTier({
      productId: PRODUCT_ID,
      name: 'Archived Bulk',
      kind: 'bulk',
      priceBasis: 'per-unit',
      priceAmount: 110,
      unitsPerOffer: 1,
      minimumOrderQuantity: 10,
      additionalCostPerOffer: 0,
      isActive: true,
    });
    await tierService.archiveTier(archived.id);

    const belowCost = await tierService.createTier({
      productId: PRODUCT_ID,
      name: 'Below Cost Special',
      kind: 'custom',
      priceBasis: 'per-unit',
      priceAmount: 80,
      unitsPerOffer: 1,
      minimumOrderQuantity: 10,
      additionalCostPerOffer: 0,
      isActive: true,
    });

    const archivedResolution = await resolutionService.resolve({
      productId: PRODUCT_ID,
      quantity: 10,
      selectedTierId: archived.id,
    });
    expect(archivedResolution.status).toBe('not-ready');
    expect(archivedResolution.eligibleTierIds).not.toContain(archived.id);
    expect(
      archivedResolution.tierEligibility
        .find((candidate) => candidate.tierId === archived.id)
        ?.issues.map((issue) => issue.code),
    ).toEqual(['TIER_INACTIVE']);

    const belowCostResolution = await resolutionService.resolve({
      productId: PRODUCT_ID,
      quantity: 10,
      selectedTierId: belowCost.id,
    });
    expect(belowCostResolution.status).toBe('ready');
    expect(belowCostResolution.unitSellingPrice).toBe(80);
    expect(belowCostResolution.warnings.map((warning) => warning.code)).toEqual([
      'BELOW_COST',
    ]);
  });

  it('fails contradictory Product identity evidence closed', async () => {
    const { integratedQuoteService } = setup();
    const resolutionService = new ProductPriceResolutionService({
      async quoteProduct(productId) {
        const quote = await integratedQuoteService.quoteProduct(productId);
        return {
          ...quote,
          productId: 'OTHER-PRODUCT',
        };
      },
    });

    const result = await resolutionService.resolve({
      productId: PRODUCT_ID,
      quantity: 10,
    });

    expect(result.status).toBe('not-ready');
    expect(result.unitSellingPrice).toBeNull();
    expect(result.totalSellingPrice).toBeNull();
    expect(result.issues.map((issue) => issue.code)).toContain(
      'REQUEST_PRODUCT_MISMATCH',
    );
  });

  it('keeps Production financial projections on Default / Single after TP8 tiers and explicit preview resolution exist', async () => {
    const {
      tierService,
      resolutionService,
      expectedBatchFinancialsService,
    } = setup();

    const quantity = 20;
    const before = await expectedBatchFinancialsService.projectBatch(
      PRODUCT_ID,
      quantity,
    );

    const bulk = await tierService.createTier({
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

    const explicitPreview = await resolutionService.resolve({
      productId: PRODUCT_ID,
      quantity,
      selectedTierId: bulk.id,
    });
    expect(explicitPreview).toMatchObject({
      status: 'ready',
      unitSellingPrice: 80,
      totalSellingPrice: 1600,
    });

    const after = await expectedBatchFinancialsService.projectBatch(
      PRODUCT_ID,
      quantity,
    );

    expect(before.expectedRevenue).toBe(2400);
    expect(after.expectedRevenue).toBe(2400);
    expect(after.expectedRevenue).toBe(before.expectedRevenue);
    expect(after.sellingPrice).toBe(120);
    expect(after.expectedProfit).toBe(before.expectedProfit);
    expect(after.pricingQuote).toEqual(before.pricingQuote);
    expect(after.expectedRevenue).not.toBe(explicitPreview.totalSellingPrice);
  });
});
