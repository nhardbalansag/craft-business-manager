import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createEmptyBusinessDataset,
  CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
} from '../../domain/businessDataset';
import type { BusinessDataset } from '../../domain/types';
import {
  assemblyCapacityTraceService,
  calibrationService,
  componentSourceAvailabilityService,
  effectiveRecipeRequirementService,
  expectedBatchFinancialsService,
  fullyLoadedProductUnitCostService,
  persistenceCoordinator,
  physicalPlannedBatchProductionCostService,
  plannedBatchCapacityFeasibilityService,
  productComponentService,
  productPricingQuoteService,
  recipeMaterialCostPreviewService,
  recursiveFullyLoadedProductComponentCostService,
  validatedAtomicDatasetHydrationService,
} from '../session';

function derivedEquivalenceFixture(): BusinessDataset {
  return {
    schemaVersion: CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
    materials: [
      {
        id: 'mat-calibrated-plaster',
        name: 'Cup-Measured Casting Plaster',
        group: 'plaster',
        baseUnit: 'g',
        purchaseQuantity: 1,
        purchaseUnit: 'cup',
        packageCost: 84,
        onHandQuantity: 3,
        onHandUnit: 'cup',
        isActive: true,
      },
      {
        id: 'mat-wax',
        name: 'Soy Wax',
        group: 'wax',
        baseUnit: 'g',
        purchaseQuantity: 1,
        purchaseUnit: 'kg',
        packageCost: 300,
        onHandQuantity: 2,
        onHandUnit: 'kg',
        isActive: true,
      },
      {
        id: 'mat-wick',
        name: 'Cotton Wick',
        group: 'wick',
        baseUnit: 'pc',
        purchaseQuantity: 100,
        purchaseUnit: 'pc',
        packageCost: 100,
        onHandQuantity: 100,
        onHandUnit: 'pc',
        isActive: true,
      },
      {
        id: 'mat-box',
        name: 'Gift Box',
        group: 'packaging',
        baseUnit: 'pc',
        purchaseQuantity: 10,
        purchaseUnit: 'pc',
        packageCost: 50,
        onHandQuantity: 20,
        onHandUnit: 'pc',
        isActive: true,
      },
    ],
    materialCalibrations: [
      {
        id: 'cal-plaster-old',
        materialId: 'mat-calibrated-plaster',
        measuredVolume: 5,
        volumeUnit: 'cup',
        knownWeight: 1,
        weightUnit: 'kg',
        recordedAt: '2026-09-01T08:00:00.000Z',
      },
      {
        id: 'cal-plaster-new',
        materialId: 'mat-calibrated-plaster',
        measuredVolume: 4,
        volumeUnit: 'cup',
        knownWeight: 0.84,
        weightUnit: 'kg',
        recordedAt: '2026-09-15T08:00:00.000Z',
        notes: 'Latest production calibration: 210 g/cup.',
      },
    ],
    mixPresets: [
      {
        id: 'mix-candle',
        name: 'Candle Wax Mix',
        compatibleCategories: ['candle'],
        basis: 'weight',
        lines: [{ materialId: 'mat-wax', role: 'primary', parts: 1 }],
        isActive: true,
      },
    ],
    products: [
      {
        id: 'product-calibrated',
        name: 'Calibrated Plaster Sample',
        category: 'paintable-art',
        safetyWasteRate: 0,
        isActive: true,
      },
      {
        id: 'product-child',
        name: 'Scented Candle Insert',
        category: 'candle',
        mixPresetId: 'mix-candle',
        safetyWasteRate: 0.05,
        isActive: true,
      },
      {
        id: 'product-parent',
        name: 'Two-Candle Gift Set',
        category: 'candle',
        safetyWasteRate: 0,
        isActive: true,
      },
    ],
    yieldSamples: [
      {
        id: 'yield-child-1',
        productId: 'product-child',
        mixPresetId: 'mix-candle',
        materialInputs: [{ materialId: 'mat-wax', quantity: 500, unit: 'g' }],
        goodPieces: 10,
        rejectedPieces: 0,
        recordedAt: '2026-09-15T09:00:00.000Z',
      },
    ],
    recipeItems: [
      {
        id: 'recipe-calibrated-plaster',
        productId: 'product-calibrated',
        materialId: 'mat-calibrated-plaster',
        quantityPerProduct: 0.5,
        unit: 'cup',
        role: 'consumable',
      },
      {
        id: 'recipe-child-wick',
        productId: 'product-child',
        materialId: 'mat-wick',
        quantityPerProduct: 1,
        unit: 'pc',
        role: 'finish',
      },
    ],
    productComponents: [
      {
        id: 'component-parent-box',
        parentProductId: 'product-parent',
        sourceType: 'material',
        sourceId: 'mat-box',
        role: 'vessel',
        quantityPerParent: 1,
      },
      {
        id: 'component-parent-child',
        parentProductId: 'product-parent',
        sourceType: 'product',
        sourceId: 'product-child',
        role: 'molded-component',
        quantityPerParent: 2,
      },
    ],
    productStocks: [
      { productId: 'product-child', onHandQuantity: 10 },
      { productId: 'product-parent', onHandQuantity: 0 },
    ],
    productFinancialProfiles: [
      {
        productId: 'product-child',
        laborCostPerUnit: 5,
        overheadCostPerUnit: 2,
        pricingPolicy: null,
      },
      {
        productId: 'product-parent',
        laborCostPerUnit: 10,
        overheadCostPerUnit: 3,
        pricingPolicy: { method: 'markup-percent', value: 0.25 },
      },
    ],
  };
}

async function hydrate(dataset: BusinessDataset): Promise<void> {
  const result = await validatedAtomicDatasetHydrationService.hydrate(dataset);
  expect(result).toEqual({ status: 'hydrated' });
}

async function roundTripCurrentWorkbook(): Promise<void> {
  const exported = await persistenceCoordinator.exportCurrentWorkbook();
  expect(exported.status).toBe('exported');
  expect(exported.bytes.byteLength).toBeGreaterThan(0);

  await hydrate(createEmptyBusinessDataset());

  const imported = await persistenceCoordinator.importAndApplyWorkbook(exported.bytes);
  expect(imported.status).toBe('hydrated');
}

function derivedServiceIdentities() {
  return [
    calibrationService,
    effectiveRecipeRequirementService,
    recipeMaterialCostPreviewService,
    componentSourceAvailabilityService,
    recursiveFullyLoadedProductComponentCostService,
    fullyLoadedProductUnitCostService,
    productPricingQuoteService,
    physicalPlannedBatchProductionCostService,
    expectedBatchFinancialsService,
    assemblyCapacityTraceService,
    plannedBatchCapacityFeasibilityService,
  ] as const;
}

beforeEach(async () => {
  await hydrate(createEmptyBusinessDataset());
});

afterEach(async () => {
  await hydrate(createEmptyBusinessDataset());
});

describe('Phase 5.6A2 Phase 1-4 derived service equivalence', () => {
  it('Scenario B: preserves calibration-dependent cup-to-gram conversion, costing, and calibration selection', async () => {
    await hydrate(derivedEquivalenceFixture());
    const identitiesBefore = derivedServiceIdentities();

    const beforeCalibration = await calibrationService.getEffectiveCalibration(
      'mat-calibrated-plaster',
    );
    const beforeRequirements = await effectiveRecipeRequirementService.deriveForProduct(
      'product-calibrated',
    );
    const beforePreview = await recipeMaterialCostPreviewService.previewForProduct(
      'product-calibrated',
    );

    expect(beforeCalibration?.evidence.id).toBe('cal-plaster-new');
    expect(beforeCalibration?.gramsPerCup).toBe(210);
    expect(beforeRequirements.requirements).toEqual([
      expect.objectContaining({
        materialId: 'mat-calibrated-plaster',
        baseUnit: 'g',
        baseQuantityPerProduct: 105,
        source: 'fixed',
      }),
    ]);
    expect(beforePreview.lines).toEqual([
      expect.objectContaining({
        materialId: 'mat-calibrated-plaster',
        packageConversionSource: 'calibration',
        costingCalibrationId: 'cal-plaster-new',
        packageBaseQuantity: 210,
        costPerBaseUnit: 0.4,
        materialCostPerProduct: 42,
      }),
    ]);

    await roundTripCurrentWorkbook();

    expect(await calibrationService.getEffectiveCalibration('mat-calibrated-plaster')).toEqual(
      beforeCalibration,
    );
    expect(
      await effectiveRecipeRequirementService.deriveForProduct('product-calibrated'),
    ).toEqual(beforeRequirements);
    expect(await recipeMaterialCostPreviewService.previewForProduct('product-calibrated')).toEqual(
      beforePreview,
    );

    const identitiesAfter = derivedServiceIdentities();
    identitiesBefore.forEach((service, index) => expect(identitiesAfter[index]).toBe(service));
  });

  it('Scenario C: preserves yield-derived plus fixed recipe requirements and material-cost preview', async () => {
    await hydrate(derivedEquivalenceFixture());

    const beforeRequirements = await effectiveRecipeRequirementService.deriveForProduct(
      'product-child',
    );
    const beforePreview = await recipeMaterialCostPreviewService.previewForProduct('product-child');

    expect(beforeRequirements.status).toBe('ready');
    expect(beforeRequirements.effectiveYieldSampleId).toBe('yield-child-1');
    expect(beforeRequirements.requirements).toEqual([
      expect.objectContaining({
        materialId: 'mat-wax',
        baseQuantityPerProduct: 50,
        source: 'yield',
      }),
      expect.objectContaining({
        materialId: 'mat-wick',
        baseQuantityPerProduct: 1,
        source: 'fixed',
      }),
    ]);
    expect(beforePreview.status).toBe('ready');
    expect(beforePreview.totalMaterialCostPerProduct).toBeGreaterThan(0);

    await roundTripCurrentWorkbook();

    expect(await effectiveRecipeRequirementService.deriveForProduct('product-child')).toEqual(
      beforeRequirements,
    );
    expect(await recipeMaterialCostPreviewService.previewForProduct('product-child')).toEqual(
      beforePreview,
    );
  });

  it('Scenario D: preserves nested components, recursive cost behavior, source availability, and explicit ProductStock', async () => {
    await hydrate(derivedEquivalenceFixture());

    const beforeComponents = await productComponentService.listComponentsByParent('product-parent');
    const productComponent = beforeComponents.find(
      (component) => component.sourceType === 'product',
    );
    expect(productComponent).toBeDefined();

    const beforeMaterialAvailability = await componentSourceAvailabilityService.resolveSource(
      'material',
      'mat-box',
    );
    const beforeProductAvailability = await componentSourceAvailabilityService.resolveSource(
      'product',
      'product-child',
    );
    const beforeRecursiveCost = await recursiveFullyLoadedProductComponentCostService.costComponent(
      productComponent!,
    );
    const beforeParentCost = await fullyLoadedProductUnitCostService.costProduct('product-parent');

    expect(beforeMaterialAvailability).toEqual(
      expect.objectContaining({ status: 'ready', availableQuantity: 20, unit: 'pc' }),
    );
    expect(beforeProductAvailability).toEqual(
      expect.objectContaining({
        status: 'ready',
        availableQuantity: 10,
        unit: 'pc',
        productStock: expect.objectContaining({
          productId: 'product-child',
          onHandQuantity: 10,
        }),
      }),
    );
    expect(beforeRecursiveCost.status).toBe('ready');
    expect(beforeParentCost.status).toBe('ready');
    expect(beforeParentCost.productComponentCostSubtotal).toBeGreaterThan(0);
    expect(beforeParentCost.materialComponentCostSubtotal).toBeGreaterThan(0);

    await roundTripCurrentWorkbook();

    const afterComponents = await productComponentService.listComponentsByParent('product-parent');
    const afterProductComponent = afterComponents.find(
      (component) => component.sourceType === 'product',
    );

    expect(afterComponents).toEqual(beforeComponents);
    expect(await componentSourceAvailabilityService.resolveSource('material', 'mat-box')).toEqual(
      beforeMaterialAvailability,
    );
    expect(
      await componentSourceAvailabilityService.resolveSource('product', 'product-child'),
    ).toEqual(beforeProductAvailability);
    expect(
      await recursiveFullyLoadedProductComponentCostService.costComponent(afterProductComponent!),
    ).toEqual(beforeRecursiveCost);
    expect(await fullyLoadedProductUnitCostService.costProduct('product-parent')).toEqual(
      beforeParentCost,
    );
  });

  it('Scenario F: preserves Phase 4 unit cost, pricing, production cost, financials, and capacity meaning', async () => {
    await hydrate(derivedEquivalenceFixture());
    const plannedQuantity = 6;

    const beforeUnitCost = await fullyLoadedProductUnitCostService.costProduct('product-parent');
    const beforeQuote = await productPricingQuoteService.quoteProduct('product-parent');
    const beforePhysicalCost = await physicalPlannedBatchProductionCostService.costPlannedBatch(
      'product-parent',
      plannedQuantity,
    );
    const beforeFinancials = await expectedBatchFinancialsService.projectBatch(
      'product-parent',
      plannedQuantity,
    );
    const beforeCapacityTrace = await assemblyCapacityTraceService.trace('product-parent');
    const beforeFeasibility = await plannedBatchCapacityFeasibilityService.assessBatch(
      'product-parent',
      plannedQuantity,
    );

    expect(beforeUnitCost.status).toBe('ready');
    expect(beforeQuote.status).toBe('ready');
    expect(beforeQuote.sellingPrice).not.toBeNull();
    expect(beforeQuote.profitPerUnit).not.toBeNull();
    expect(beforePhysicalCost.status).toBe('ready');
    expect(beforeFinancials.status).toBe('ready');
    expect(beforeCapacityTrace.status).toBe('ready');
    expect(beforeCapacityTrace.overallAssemblyCapacity).toBe(5);
    expect(beforeCapacityTrace.limitingResources).toEqual([
      expect.objectContaining({
        resourceType: 'product-backed-component',
        productId: 'product-child',
        capacityPieces: 5,
      }),
    ]);
    expect(beforeFeasibility.status).toBe('ready');
    expect(beforeFeasibility.feasibility).toBe('over-current-capacity');
    expect(beforeFeasibility.currentAssemblyCapacity).toBe(5);
    expect(beforeFeasibility.overageQuantity).toBe(1);

    await roundTripCurrentWorkbook();

    expect(await fullyLoadedProductUnitCostService.costProduct('product-parent')).toEqual(
      beforeUnitCost,
    );
    expect(await productPricingQuoteService.quoteProduct('product-parent')).toEqual(beforeQuote);
    expect(
      await physicalPlannedBatchProductionCostService.costPlannedBatch(
        'product-parent',
        plannedQuantity,
      ),
    ).toEqual(beforePhysicalCost);
    expect(
      await expectedBatchFinancialsService.projectBatch('product-parent', plannedQuantity),
    ).toEqual(beforeFinancials);
    expect(await assemblyCapacityTraceService.trace('product-parent')).toEqual(
      beforeCapacityTrace,
    );
    expect(
      await plannedBatchCapacityFeasibilityService.assessBatch(
        'product-parent',
        plannedQuantity,
      ),
    ).toEqual(beforeFeasibility);
  });
});
