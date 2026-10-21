import { describe, expect, it } from 'vitest';
import { createEmptyBusinessDatasetV2 } from '../../domain/businessDatasetV2';
import {
  extendBusinessDatasetV2,
  type PhysicalBusinessDatasetV3,
} from '../../domain/physicalBusinessDatasetV3';
import type { ProductFinancialProfile } from '../../domain/productFinancialProfile';
import type { ProfitMarkupMarginMetricsResult } from './ProfitMarkupMarginMetricsService';
import type { FullyLoadedProductUnitCostResult } from '../productCosts/FullyLoadedProductUnitCostService';
import type { PhysicalPlannedBatchProductionCostResult } from '../production/PhysicalPlannedBatchProductionCostService';
import { ExpectedBatchFinancialsService } from '../production/ExpectedBatchFinancialsService';
import { InMemoryCalibrationRepository } from '../calibrations/InMemoryCalibrationRepository';
import { InMemoryMaterialRepository } from '../materials/InMemoryMaterialRepository';
import { InMemoryMixPresetRepository } from '../mixPresets/InMemoryMixPresetRepository';
import { InMemoryMoldRepository } from '../molds/InMemoryMoldRepository';
import { InMemoryProductComponentRepository } from '../productComponents/InMemoryProductComponentRepository';
import { InMemoryProductFinancialProfileRepository } from '../productFinancialProfiles/InMemoryProductFinancialProfileRepository';
import { InMemoryProductPriceTierRepository } from '../productPriceTiers/InMemoryProductPriceTierRepository';
import { ProductPriceTierQuoteService } from '../productPriceTiers/ProductPriceTierQuoteService';
import { ProductPriceTierService } from '../productPriceTiers/ProductPriceTierService';
import { InMemoryProductRepository } from '../products/InMemoryProductRepository';
import { InMemoryProductStockRepository } from '../productStocks/InMemoryProductStockRepository';
import { InMemoryFixedRecipeItemRepository } from '../recipeItems/InMemoryFixedRecipeItemRepository';
import { InMemoryStorageLocationRepository } from '../storageLocations/InMemoryStorageLocationRepository';
import { InMemoryYieldSampleRepository } from '../yieldSamples/InMemoryYieldSampleRepository';
import { SheetJsWorkbookCodec } from '../../storage/sheetJsWorkbookCodec';
import { CompleteSourceSnapshotService } from '../persistence/CompleteSourceSnapshotService';
import { CompleteSourceSnapshotServiceV2 } from '../persistence/CompleteSourceSnapshotServiceV2';
import { PersistenceCoordinator } from '../persistence/PersistenceCoordinator';
import { PhysicalDatasetHydrationServiceV3 } from '../persistence/PhysicalDatasetHydrationServiceV3';
import { PhysicalSourceSnapshotServiceV3 } from '../persistence/PhysicalSourceSnapshotServiceV3';
import { ValidatedAtomicDatasetHydrationServiceV2 } from '../persistence/ValidatedAtomicDatasetHydrationServiceV2';
import { ProductPriceResolutionService } from './ProductPriceResolutionService';
import { ProductPricingQuoteIntegrationService } from './ProductPricingQuoteIntegrationService';
import { ProductPricingQuoteService } from './ProductPricingQuoteService';

const PRODUCT_ID = 'PROD-TP9';
const codec = new SheetJsWorkbookCodec();

function currentTieredDataset(): PhysicalBusinessDatasetV3 {
  const core = createEmptyBusinessDatasetV2();

  core.products.push({
    id: PRODUCT_ID,
    name: 'TP9 Integrated Product',
    category: 'candle',
    safetyWasteRate: 0,
    isActive: true,
  });

  core.productFinancialProfiles.push({
    productId: PRODUCT_ID,
    laborCostPerUnit: 20,
    overheadCostPerUnit: 10,
    pricingPolicy: { method: 'profit-amount', value: 20 },
    notes: 'Authoritative Default / Single pricing',
  });

  core.productPriceTiers.push(
    {
      id: 'TIER-PACK',
      productId: PRODUCT_ID,
      name: 'Package 6',
      kind: 'package',
      priceBasis: 'per-offer',
      pricingMethod: 'fixed-price',
      pricingValue: 660,
      unitsPerOffer: 6,
      minimumOrderQuantity: 6,
      additionalCostPerOffer: 30,
      notes: 'Six-unit event package',
      isActive: true,
    },
    {
      id: 'TIER-BULK',
      productId: PRODUCT_ID,
      name: 'Bulk 20+',
      kind: 'bulk',
      priceBasis: 'per-unit',
      pricingMethod: 'fixed-price',
      pricingValue: 90,
      unitsPerOffer: 1,
      minimumOrderQuantity: 20,
      additionalCostPerOffer: 0,
      notes: 'Below-cost regression tier',
      isActive: true,
    },
    {
      id: 'TIER-CUSTOM',
      productId: PRODUCT_ID,
      name: 'Custom Event Contract',
      kind: 'custom',
      priceBasis: 'per-unit',
      pricingMethod: 'fixed-price',
      pricingValue: 130,
      unitsPerOffer: 1,
      minimumOrderQuantity: 5,
      additionalCostPerOffer: 0,
      isActive: true,
    },
    {
      id: 'TIER-ARCHIVED',
      productId: PRODUCT_ID,
      name: 'Old Bulk',
      kind: 'bulk',
      priceBasis: 'per-unit',
      pricingMethod: 'fixed-price',
      pricingValue: 115,
      unitsPerOffer: 1,
      minimumOrderQuantity: 10,
      additionalCostPerOffer: 0,
      isActive: false,
    },
  );

  return extendBusinessDatasetV2(core);
}

function costEvidence(): FullyLoadedProductUnitCostResult {
  return {
    productId: PRODUCT_ID,
    productName: 'TP9 Integrated Product',
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

function metricsEvidence(): ProfitMarkupMarginMetricsResult {
  return {
    productId: PRODUCT_ID,
    productName: 'TP9 Integrated Product',
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
    productName: 'TP9 Integrated Product',
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

function createHarness() {
  const materials = new InMemoryMaterialRepository();
  const calibrations = new InMemoryCalibrationRepository();
  const mixPresets = new InMemoryMixPresetRepository();
  const products = new InMemoryProductRepository();
  const yieldSamples = new InMemoryYieldSampleRepository();
  const recipeItems = new InMemoryFixedRecipeItemRepository();
  const productComponents = new InMemoryProductComponentRepository();
  const productStocks = new InMemoryProductStockRepository();
  const productFinancialProfiles = new InMemoryProductFinancialProfileRepository();
  const productPriceTiers = new InMemoryProductPriceTierRepository();
  const storageLocations = new InMemoryStorageLocationRepository();
  const molds = new InMemoryMoldRepository();

  const baseSnapshot = new CompleteSourceSnapshotService({
    materials,
    calibrations,
    mixPresets,
    products,
    yieldSamples,
    recipeItems,
    productComponents,
    productStocks,
    productFinancialProfiles,
  });

  const snapshotV2 = new CompleteSourceSnapshotServiceV2(
    baseSnapshot,
    productPriceTiers,
  );

  const hydrationV2 = new ValidatedAtomicDatasetHydrationServiceV2(
    {
      materials,
      calibrations,
      mixPresets,
      products,
      yieldSamples,
      recipeItems,
      productComponents,
      productStocks,
      productFinancialProfiles,
      productPriceTiers,
    },
    snapshotV2,
  );

  const snapshotV3 = new PhysicalSourceSnapshotServiceV3(
    snapshotV2,
    storageLocations,
    molds,
  );

  const hydrationV3 = new PhysicalDatasetHydrationServiceV3(
    hydrationV2,
    snapshotV3,
    storageLocations,
    molds,
  );

  const coordinator = new PersistenceCoordinator(
    snapshotV3,
    hydrationV3,
    codec,
    {
      clock: () => new Date('2026-09-27T14:10:00.000Z'),
      applicationVersion: 'tp9',
    },
  );

  const tierService = new ProductPriceTierService(productPriceTiers, products);

  const costs = {
    async costProduct() {
      return structuredClone(costEvidence());
    },
  };
  const profiles = {
    async getProfile(productId: string): Promise<ProductFinancialProfile | null> {
      return productFinancialProfiles.findByProductId(productId);
    },
  };
  const metrics = {
    async deriveForProduct() {
      return structuredClone(metricsEvidence());
    },
  };

  const defaultQuote = new ProductPricingQuoteService(
    costs,
    profiles,
    metrics,
  );
  const tierQuote = new ProductPriceTierQuoteService(
    costs,
    tierService,
    defaultQuote,
  );
  const integratedQuote = new ProductPricingQuoteIntegrationService(
    defaultQuote,
    tierQuote,
  );
  const resolver = new ProductPriceResolutionService(integratedQuote);
  const production = new ExpectedBatchFinancialsService(defaultQuote, {
    async costPlannedBatch(productId, plannedQuantity) {
      return batchEvidence(productId, plannedQuantity);
    },
  });

  return {
    snapshotV3,
    hydrationV3,
    coordinator,
    tierService,
    tierQuote,
    integratedQuote,
    resolver,
    production,
  };
}

async function expectHydrated(
  promise: Promise<{ status: string }>,
): Promise<void> {
  await expect(promise).resolves.toMatchObject({ status: 'hydrated' });
}

describe('TP9 integrated Tiered Pricing validation and completion gate', () => {
  it('preserves tier sources and all pricing semantics across real workbook export/import', async () => {
    const harness = createHarness();
    const source = currentTieredDataset();

    await expectHydrated(harness.hydrationV3.hydrate(source));

    const beforeSnapshot = await harness.snapshotV3.snapshot();
    const beforeTierQuote = await harness.tierQuote.quoteProduct(PRODUCT_ID);
    const beforeIntegrated = await harness.integratedQuote.quoteProduct(PRODUCT_ID);
    const beforeDefaultResolution = await harness.resolver.resolve({
      productId: PRODUCT_ID,
      quantity: 20,
    });
    const beforePackageResolution = await harness.resolver.resolve({
      productId: PRODUCT_ID,
      quantity: 12,
      selectedTierId: 'TIER-PACK',
    });
    const beforeCustomResolution = await harness.resolver.resolve({
      productId: PRODUCT_ID,
      quantity: 20,
      selectedTierId: 'TIER-CUSTOM',
    });
    const beforeProduction = await harness.production.projectBatch(
      PRODUCT_ID,
      20,
    );

    expect(beforeIntegrated.sellingPrice).toBe(120);
    expect(beforeDefaultResolution).toMatchObject({
      mode: 'default',
      status: 'ready',
      unitSellingPrice: 120,
      totalSellingPrice: 2400,
    });

    const packageLine = beforeTierQuote.tiers.find(
      (line) => line.tier.id === 'TIER-PACK',
    );
    expect(packageLine?.economics).toMatchObject({
      baseOfferCost: 600,
      additionalCostPerOffer: 30,
      totalOfferCost: 630,
      offerSellingPrice: 660,
      effectiveUnitSellingPrice: 110,
      profitPerOffer: 30,
      effectiveProfitPerUnit: 5,
    });
    expect(beforePackageResolution).toMatchObject({
      status: 'ready',
      offerCount: 2,
      unitSellingPrice: 110,
      totalSellingPrice: 1320,
    });

    const bulkLine = beforeTierQuote.tiers.find(
      (line) => line.tier.id === 'TIER-BULK',
    );
    expect(bulkLine?.economics).toMatchObject({
      offerSellingPrice: 90,
      effectiveUnitSellingPrice: 90,
      profitPerOffer: -10,
      effectiveProfitPerUnit: -10,
    });
    expect(bulkLine?.warnings.map((warning) => warning.code)).toEqual([
      'BELOW_COST',
    ]);

    const customLine = beforeTierQuote.tiers.find(
      (line) => line.tier.id === 'TIER-CUSTOM',
    );
    expect(customLine?.economics).toMatchObject({
      offerSellingPrice: 130,
      effectiveUnitSellingPrice: 130,
      profitPerOffer: 30,
      effectiveProfitPerUnit: 30,
    });
    expect(beforeCustomResolution).toMatchObject({
      status: 'ready',
      selectedTierId: 'TIER-CUSTOM',
      unitSellingPrice: 130,
      totalSellingPrice: 2600,
    });

    const archivedLine = beforeTierQuote.tiers.find(
      (line) => line.tier.id === 'TIER-ARCHIVED',
    );
    expect(archivedLine?.tier.isActive).toBe(false);
    const archivedResolution = await harness.resolver.resolve({
      productId: PRODUCT_ID,
      quantity: 20,
      selectedTierId: 'TIER-ARCHIVED',
    });
    expect(archivedResolution.status).toBe('not-ready');
    expect(
      archivedResolution.tierEligibility
        .find((candidate) => candidate.tierId === 'TIER-ARCHIVED')
        ?.issues.map((issue) => issue.code),
    ).toEqual(['TIER_INACTIVE']);

    expect(beforeProduction).toMatchObject({
      status: 'ready',
      sellingPrice: 120,
      expectedRevenue: 2400,
      expectedProfit: 400,
    });

    const exported = await harness.coordinator.exportCurrentWorkbook();
    expect(exported.status).toBe('exported');
    expect(exported.bytes.byteLength).toBeGreaterThan(0);

    await expectHydrated(
      harness.hydrationV3.hydrate(
        extendBusinessDatasetV2(createEmptyBusinessDatasetV2()),
      ),
    );
    expect((await harness.snapshotV3.snapshot()).productPriceTiers).toEqual([]);

    await expectHydrated(
      harness.coordinator.importAndApplyWorkbook(exported.bytes),
    );

    const afterSnapshot = await harness.snapshotV3.snapshot();
    const afterTierQuote = await harness.tierQuote.quoteProduct(PRODUCT_ID);
    const afterIntegrated = await harness.integratedQuote.quoteProduct(PRODUCT_ID);
    const afterDefaultResolution = await harness.resolver.resolve({
      productId: PRODUCT_ID,
      quantity: 20,
    });
    const afterPackageResolution = await harness.resolver.resolve({
      productId: PRODUCT_ID,
      quantity: 12,
      selectedTierId: 'TIER-PACK',
    });
    const afterCustomResolution = await harness.resolver.resolve({
      productId: PRODUCT_ID,
      quantity: 20,
      selectedTierId: 'TIER-CUSTOM',
    });
    const afterProduction = await harness.production.projectBatch(
      PRODUCT_ID,
      20,
    );

    expect(afterSnapshot).toEqual(beforeSnapshot);
    expect(afterTierQuote).toEqual(beforeTierQuote);
    expect(afterIntegrated).toEqual(beforeIntegrated);
    expect(afterDefaultResolution).toEqual(beforeDefaultResolution);
    expect(afterPackageResolution).toEqual(beforePackageResolution);
    expect(afterCustomResolution).toEqual(beforeCustomResolution);
    expect(afterProduction).toEqual(beforeProduction);

    expect(afterSnapshot.productPriceTiers.map((tier) => ({
      id: tier.id,
      kind: tier.kind,
      active: tier.isActive,
    }))).toEqual([
      { id: 'TIER-ARCHIVED', kind: 'bulk', active: false },
      { id: 'TIER-BULK', kind: 'bulk', active: true },
      { id: 'TIER-CUSTOM', kind: 'custom', active: true },
      { id: 'TIER-PACK', kind: 'package', active: true },
    ]);
  });

  it('keeps no-tier Products on the unchanged Default / Single path', async () => {
    const harness = createHarness();
    const source = currentTieredDataset();
    source.productPriceTiers = [];

    await expectHydrated(harness.hydrationV3.hydrate(source));

    const tierQuote = await harness.tierQuote.quoteProduct(PRODUCT_ID);
    const resolution = await harness.resolver.resolve({
      productId: PRODUCT_ID,
      quantity: 20,
    });
    const production = await harness.production.projectBatch(PRODUCT_ID, 20);

    expect(tierQuote.tiers).toEqual([]);
    expect(resolution).toMatchObject({
      mode: 'default',
      selectedTierId: null,
      status: 'ready',
      unitSellingPrice: 120,
      totalSellingPrice: 2400,
      eligibleTierIds: [],
    });
    expect(production).toMatchObject({
      sellingPrice: 120,
      expectedRevenue: 2400,
      expectedProfit: 400,
    });
  });
});
