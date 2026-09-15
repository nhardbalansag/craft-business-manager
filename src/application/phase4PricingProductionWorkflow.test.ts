import { describe, expect, it } from 'vitest';
import { PricingError } from '../domain/pricing';
import { CalibrationService } from './calibrations/CalibrationService';
import { InMemoryCalibrationRepository } from './calibrations/InMemoryCalibrationRepository';
import { InMemoryMaterialRepository } from './materials/InMemoryMaterialRepository';
import { MaterialService } from './materials/MaterialService';
import { InMemoryMixPresetRepository } from './mixPresets/InMemoryMixPresetRepository';
import { MixPresetService } from './mixPresets/MixPresetService';
import { FullyLoadedProductUnitCostService } from './productCosts/FullyLoadedProductUnitCostService';
import { RecursiveFullyLoadedProductComponentCostService } from './productCosts/RecursiveFullyLoadedProductComponentCostService';
import { WasteAdjustedDirectMaterialCostService } from './productCosts/WasteAdjustedDirectMaterialCostService';
import { AssemblyCapacitySynthesisService } from './production/AssemblyCapacitySynthesisService';
import { AssemblyCapacityTraceService } from './production/AssemblyCapacityTraceService';
import { ExpectedBatchFinancialsService } from './production/ExpectedBatchFinancialsService';
import { PhysicalPlannedBatchProductionCostService } from './production/PhysicalPlannedBatchProductionCostService';
import { PlannedBatchCapacityFeasibilityService } from './production/PlannedBatchCapacityFeasibilityService';
import { ProductionCapacityService } from './production/ProductionCapacityService';
import { ProductionRequirementService } from './production/ProductionRequirementService';
import { ComponentCapacityService } from './productComponents/ComponentCapacityService';
import { ComponentSourceAvailabilityService } from './productComponents/ComponentSourceAvailabilityService';
import { InMemoryProductComponentRepository } from './productComponents/InMemoryProductComponentRepository';
import { MaterialBackedComponentCostService } from './productComponents/MaterialBackedComponentCostService';
import { ProductComponentService } from './productComponents/ProductComponentService';
import { InMemoryProductFinancialProfileRepository } from './productFinancialProfiles/InMemoryProductFinancialProfileRepository';
import { ProductFinancialProfileService } from './productFinancialProfiles/ProductFinancialProfileService';
import { InMemoryProductRepository } from './products/InMemoryProductRepository';
import { ProductService } from './products/ProductService';
import { InMemoryProductStockRepository } from './productStocks/InMemoryProductStockRepository';
import { ProductStockService } from './productStocks/ProductStockService';
import { ProductPricingQuoteService } from './pricing/ProductPricingQuoteService';
import { ProfitMarkupMarginMetricsService } from './pricing/ProfitMarkupMarginMetricsService';
import { SellingPriceDerivationService } from './pricing/SellingPriceDerivationService';
import { RecipeMaterialCostPreviewService } from './recipeCosts/RecipeMaterialCostPreviewService';
import { EffectiveRecipeRequirementService } from './recipeRequirements/EffectiveRecipeRequirementService';
import { FixedRecipeItemService } from './recipeItems/FixedRecipeItemService';
import { InMemoryFixedRecipeItemRepository } from './recipeItems/InMemoryFixedRecipeItemRepository';
import { InMemoryYieldSampleRepository } from './yieldSamples/InMemoryYieldSampleRepository';
import { YieldHistoryService } from './yieldSamples/YieldHistoryService';
import { YieldSampleEvidenceService } from './yieldSamples/YieldSampleEvidenceService';

function workflow() {
  const materialRepository = new InMemoryMaterialRepository();
  const calibrationRepository = new InMemoryCalibrationRepository();
  const mixPresetRepository = new InMemoryMixPresetRepository();
  const productRepository = new InMemoryProductRepository();
  const productComponentRepository = new InMemoryProductComponentRepository();
  const productStockRepository = new InMemoryProductStockRepository();
  const productFinancialProfileRepository = new InMemoryProductFinancialProfileRepository();
  const yieldSampleRepository = new InMemoryYieldSampleRepository();
  const fixedRecipeItemRepository = new InMemoryFixedRecipeItemRepository();

  const calibrationEvidenceProvider = async (materialId: string) => {
    const key = materialId.trim().toLowerCase();
    return (await calibrationRepository.list()).filter(
      (record) => record.materialId.trim().toLowerCase() === key,
    );
  };

  const productComponentService = new ProductComponentService(
    productComponentRepository,
    productRepository,
    materialRepository,
  );
  const productStockService = new ProductStockService(productStockRepository, productRepository);
  const productFinancialProfileService = new ProductFinancialProfileService(
    productFinancialProfileRepository,
    productRepository,
  );
  const componentSourceAvailabilityService = new ComponentSourceAvailabilityService(
    materialRepository,
    productRepository,
    productStockRepository,
    calibrationEvidenceProvider,
  );
  const componentCapacityService = new ComponentCapacityService(componentSourceAvailabilityService);
  const materialBackedComponentCostService = new MaterialBackedComponentCostService(
    materialRepository,
    componentSourceAvailabilityService,
    calibrationEvidenceProvider,
  );
  const materialService = new MaterialService(
    materialRepository,
    calibrationEvidenceProvider,
    productComponentService,
  );
  const calibrationService = new CalibrationService(calibrationRepository, materialRepository);
  const productService = new ProductService(
    productRepository,
    mixPresetRepository,
    productComponentService,
  );
  const mixPresetService = new MixPresetService(
    mixPresetRepository,
    materialRepository,
    productRepository,
  );
  const yieldSampleEvidenceService = new YieldSampleEvidenceService(
    yieldSampleRepository,
    productRepository,
    mixPresetRepository,
    materialRepository,
  );
  const yieldHistoryService = new YieldHistoryService(
    yieldSampleRepository,
    productRepository,
    materialRepository,
    calibrationRepository,
  );
  const fixedRecipeItemService = new FixedRecipeItemService(
    fixedRecipeItemRepository,
    productRepository,
    materialRepository,
    calibrationRepository,
  );
  const effectiveRecipeRequirementService = new EffectiveRecipeRequirementService(
    productRepository,
    yieldHistoryService,
    fixedRecipeItemService,
  );
  const recipeMaterialCostPreviewService = new RecipeMaterialCostPreviewService(
    effectiveRecipeRequirementService,
    materialRepository,
    calibrationRepository,
  );
  const productionRequirementService = new ProductionRequirementService(
    effectiveRecipeRequirementService,
    productService,
  );
  const wasteAdjustedDirectMaterialCostService = new WasteAdjustedDirectMaterialCostService(
    productionRequirementService,
    recipeMaterialCostPreviewService,
  );
  const recursiveFullyLoadedProductComponentCostService =
    new RecursiveFullyLoadedProductComponentCostService(
      productRepository,
      productComponentRepository,
      wasteAdjustedDirectMaterialCostService,
      materialBackedComponentCostService,
      productFinancialProfileService,
    );
  const fullyLoadedProductUnitCostService = new FullyLoadedProductUnitCostService(
    productRepository,
    productComponentRepository,
    wasteAdjustedDirectMaterialCostService,
    materialBackedComponentCostService,
    recursiveFullyLoadedProductComponentCostService,
    productFinancialProfileService,
  );
  const physicalPlannedBatchProductionCostService = new PhysicalPlannedBatchProductionCostService(
    productionRequirementService,
    fullyLoadedProductUnitCostService,
  );
  const sellingPriceDerivationService = new SellingPriceDerivationService(
    fullyLoadedProductUnitCostService,
    productFinancialProfileService,
  );
  const profitMarkupMarginMetricsService = new ProfitMarkupMarginMetricsService(
    sellingPriceDerivationService,
  );
  const productPricingQuoteService = new ProductPricingQuoteService(
    fullyLoadedProductUnitCostService,
    productFinancialProfileService,
    profitMarkupMarginMetricsService,
  );
  const expectedBatchFinancialsService = new ExpectedBatchFinancialsService(
    productPricingQuoteService,
    physicalPlannedBatchProductionCostService,
  );
  const productionCapacityService = new ProductionCapacityService(
    productionRequirementService,
    materialRepository,
    calibrationRepository,
  );
  const assemblyCapacitySynthesisService = new AssemblyCapacitySynthesisService(
    productionCapacityService,
    productComponentService,
    componentCapacityService,
  );
  const assemblyCapacityTraceService = new AssemblyCapacityTraceService(
    assemblyCapacitySynthesisService,
    productRepository,
    materialRepository,
  );
  const plannedBatchCapacityFeasibilityService = new PlannedBatchCapacityFeasibilityService(
    expectedBatchFinancialsService,
    assemblyCapacityTraceService,
  );

  return {
    materialService,
    calibrationService,
    productService,
    mixPresetService,
    yieldSampleEvidenceService,
    fixedRecipeItemService,
    productComponentService,
    productStockService,
    productFinancialProfileService,
    fullyLoadedProductUnitCostService,
    productPricingQuoteService,
    physicalPlannedBatchProductionCostService,
    expectedBatchFinancialsService,
    assemblyCapacityTraceService,
    plannedBatchCapacityFeasibilityService,
  };
}

type Workflow = ReturnType<typeof workflow>;
type MaterialInput = Parameters<Workflow['materialService']['createMaterial']>[0];
type ProductInput = Parameters<Workflow['productService']['createProduct']>[0];
type FixedItemInput = Parameters<Workflow['fixedRecipeItemService']['createItem']>[0];
type ComponentInput = Parameters<Workflow['productComponentService']['createComponent']>[0];
type FinancialProfileInput = Parameters<Workflow['productFinancialProfileService']['upsertProfile']>[0];

async function addMaterial(services: Workflow, input: MaterialInput) {
  return services.materialService.createMaterial(input);
}

async function addProduct(services: Workflow, input: ProductInput) {
  return services.productService.createProduct(input);
}

async function addFixedItem(services: Workflow, input: FixedItemInput) {
  return services.fixedRecipeItemService.createItem(input);
}

async function addComponent(services: Workflow, input: ComponentInput) {
  return services.productComponentService.createComponent(input);
}

async function addProfile(services: Workflow, input: FinancialProfileInput) {
  return services.productFinancialProfileService.upsertProfile(input);
}

async function addSimpleMaterial(
  services: Workflow,
  input: Pick<MaterialInput, 'id' | 'name' | 'group' | 'baseUnit' | 'purchaseQuantity' | 'purchaseUnit' | 'packageCost' | 'onHandQuantity' | 'onHandUnit'>,
) {
  return addMaterial(services, { ...input, isActive: true });
}

async function addSimpleProduct(
  services: Workflow,
  input: Pick<ProductInput, 'id' | 'name' | 'category' | 'safetyWasteRate'> & Partial<Pick<ProductInput, 'mixPresetId'>>,
) {
  return addProduct(services, { ...input, isActive: true });
}

async function addDirectItem(
  services: Workflow,
  input: Pick<FixedItemInput, 'id' | 'productId' | 'materialId' | 'quantityPerProduct' | 'unit'> & Partial<Pick<FixedItemInput, 'role'>>,
) {
  return addFixedItem(services, { ...input, role: input.role ?? 'consumable' });
}

function productComponentLine(
  quote: Awaited<ReturnType<Workflow['productPricingQuoteService']['quoteProduct']>>,
  componentId: string,
) {
  const entry = quote.fullyLoadedUnitCost.componentLines.find(
    (candidate) => candidate.sourceType === 'product' && candidate.line.componentId === componentId,
  );
  if (!entry || entry.sourceType !== 'product') {
    throw new Error(`Expected Product-backed component ${componentId}.`);
  }
  return entry.line;
}

function materialComponentLine(
  quote: Awaited<ReturnType<Workflow['productPricingQuoteService']['quoteProduct']>>,
  componentId: string,
) {
  const entry = quote.fullyLoadedUnitCost.componentLines.find(
    (candidate) => candidate.sourceType === 'material' && candidate.line.componentId === componentId,
  );
  if (!entry || entry.sourceType !== 'material') {
    throw new Error(`Expected Material-backed component ${componentId}.`);
  }
  return entry.line;
}

describe('Phase 4.6A integrated pricing / production workflow', () => {
  it('Scenario A — validates learned/fixed paintable-art cost, safety reserve, adders, and fixed PHP profit', async () => {
    const services = workflow();

    await addSimpleMaterial(services, {
      id: 'MAT-PLASTER',
      name: 'Plaster of Paris',
      group: 'plaster',
      baseUnit: 'g',
      purchaseQuantity: 1,
      purchaseUnit: 'kg',
      packageCost: 66,
      onHandQuantity: 5000,
      onHandUnit: 'g',
    });
    await addSimpleMaterial(services, {
      id: 'MAT-WATER',
      name: 'Production Water',
      group: 'liquid',
      baseUnit: 'mL',
      purchaseQuantity: 1,
      purchaseUnit: 'L',
      packageCost: 20,
      onHandQuantity: 5000,
      onHandUnit: 'mL',
    });
    await addSimpleMaterial(services, {
      id: 'MAT-PAINT',
      name: 'Paint',
      group: 'paint',
      baseUnit: 'mL',
      purchaseQuantity: 100,
      purchaseUnit: 'mL',
      packageCost: 50,
      onHandQuantity: 1000,
      onHandUnit: 'mL',
    });
    await addSimpleMaterial(services, {
      id: 'MAT-BRUSH',
      name: 'Mini Brush',
      group: 'accessory',
      baseUnit: 'pc',
      purchaseQuantity: 10,
      purchaseUnit: 'pc',
      packageCost: 30,
      onHandQuantity: 100,
      onHandUnit: 'pc',
    });

    await services.calibrationService.createCalibration({
      id: 'CAL-PLASTER-001',
      materialId: 'MAT-PLASTER',
      measuredVolume: 5,
      volumeUnit: 'cup',
      knownWeight: 1,
      weightUnit: 'kg',
      recordedAt: '2026-09-15T01:00:00.000Z',
    });
    await services.mixPresetService.createMixPreset({
      id: 'MIX-PLASTER-2-1',
      name: 'Plaster 2:1',
      compatibleCategories: ['paintable-art'],
      basis: 'volume',
      lines: [
        { materialId: 'MAT-PLASTER', role: 'primary', parts: 2 },
        { materialId: 'MAT-WATER', role: 'secondary', parts: 1 },
      ],
      isActive: true,
    });
    await addSimpleProduct(services, {
      id: 'ART-STAR',
      name: 'Paintable Star',
      category: 'paintable-art',
      mixPresetId: 'MIX-PLASTER-2-1',
      safetyWasteRate: 0.05,
    });
    await services.yieldSampleEvidenceService.recordSample({
      id: 'YS-STAR-001',
      productId: 'ART-STAR',
      mixPresetId: 'MIX-PLASTER-2-1',
      materialInputs: [
        { materialId: 'MAT-PLASTER', quantity: 3, unit: 'cup' },
        { materialId: 'MAT-WATER', quantity: 1.5, unit: 'cup' },
      ],
      goodPieces: 8,
      rejectedPieces: 1,
      recordedAt: '2026-09-15T02:00:00.000Z',
    });
    await addDirectItem(services, {
      id: 'RI-STAR-PAINT',
      productId: 'ART-STAR',
      materialId: 'MAT-PAINT',
      quantityPerProduct: 2,
      unit: 'mL',
      role: 'finish',
    });
    await addDirectItem(services, {
      id: 'RI-STAR-BRUSH',
      productId: 'ART-STAR',
      materialId: 'MAT-BRUSH',
      quantityPerProduct: 1,
      unit: 'pc',
      role: 'finish',
    });
    await addProfile(services, {
      productId: 'ART-STAR',
      laborCostPerUnit: 4,
      overheadCostPerUnit: 1.5,
      pricingPolicy: { method: 'profit-amount', value: 6 },
    });

    const quote = await services.productPricingQuoteService.quoteProduct('ART-STAR');
    const direct = quote.fullyLoadedUnitCost.directMaterialCost;

    expect(quote.status).toBe('ready');
    expect(direct?.status).toBe('ready');
    expect(direct?.lines.some((line) => line.source === 'yield')).toBe(true);
    expect(direct?.lines.some((line) => line.source === 'fixed')).toBe(true);
    expect(direct?.baseDirectMaterialCostSubtotal).toBeCloseTo(9.85, 10);
    expect(direct?.safetyWasteReserveCostSubtotal).toBeCloseTo(0.4925, 10);
    expect(direct?.pricingDirectMaterialCostPerUnit).toBeCloseTo(10.3425, 10);
    expect(quote.fullyLoadedUnitCost.laborCostPerUnit).toBe(4);
    expect(quote.fullyLoadedUnitCost.overheadCostPerUnit).toBe(1.5);
    expect(quote.totalFullyLoadedUnitCost).toBeCloseTo(15.8425, 10);
    expect(quote.pricingPolicy).toEqual({ method: 'profit-amount', value: 6 });
    expect(quote.sellingPrice).toBeCloseTo(21.8425, 10);
    expect(quote.profitPerUnit).toBeCloseTo(6, 10);
    expect(quote.sellingPrice! - quote.totalFullyLoadedUnitCost!).toBeCloseTo(6, 10);
  });

  it('Scenario B — keeps purchased vessel cost discrete while markup pricing reconciles', async () => {
    const services = workflow();

    await addSimpleMaterial(services, {
      id: 'MAT-WAX',
      name: 'Soy Wax',
      group: 'wax',
      baseUnit: 'g',
      purchaseQuantity: 1000,
      purchaseUnit: 'g',
      packageCost: 200,
      onHandQuantity: 5000,
      onHandUnit: 'g',
    });
    await addSimpleMaterial(services, {
      id: 'MAT-FRAGRANCE',
      name: 'Fragrance Oil',
      group: 'fragrance',
      baseUnit: 'g',
      purchaseQuantity: 100,
      purchaseUnit: 'g',
      packageCost: 50,
      onHandQuantity: 1000,
      onHandUnit: 'g',
    });
    await addSimpleMaterial(services, {
      id: 'MAT-GLASS',
      name: 'Glass Cup',
      group: 'container',
      baseUnit: 'pc',
      purchaseQuantity: 10,
      purchaseUnit: 'pc',
      packageCost: 100,
      onHandQuantity: 100,
      onHandUnit: 'pc',
    });
    await addSimpleProduct(services, {
      id: 'CANDLE-PURCHASED',
      name: 'Purchased Vessel Candle',
      category: 'candle',
      safetyWasteRate: 0.1,
    });
    await addDirectItem(services, {
      id: 'RI-WAX',
      productId: 'CANDLE-PURCHASED',
      materialId: 'MAT-WAX',
      quantityPerProduct: 100,
      unit: 'g',
    });
    await addDirectItem(services, {
      id: 'RI-FRAGRANCE',
      productId: 'CANDLE-PURCHASED',
      materialId: 'MAT-FRAGRANCE',
      quantityPerProduct: 10,
      unit: 'g',
    });
    await addComponent(services, {
      id: 'COMP-GLASS',
      parentProductId: 'CANDLE-PURCHASED',
      sourceType: 'material',
      sourceId: 'MAT-GLASS',
      role: 'vessel',
      quantityPerParent: 1,
    });
    await addProfile(services, {
      productId: 'CANDLE-PURCHASED',
      laborCostPerUnit: 4,
      overheadCostPerUnit: 3,
      pricingPolicy: { method: 'markup-percent', value: 0.5 },
    });

    const quote = await services.productPricingQuoteService.quoteProduct('CANDLE-PURCHASED');
    const vessel = materialComponentLine(quote, 'COMP-GLASS');

    expect(quote.status).toBe('ready');
    expect(quote.fullyLoadedUnitCost.directMaterialCost?.baseDirectMaterialCostSubtotal).toBeCloseTo(25, 10);
    expect(quote.fullyLoadedUnitCost.directMaterialCost?.safetyWasteReserveCostSubtotal).toBeCloseTo(2.5, 10);
    expect(quote.fullyLoadedUnitCost.directMaterialCostSubtotal).toBeCloseTo(27.5, 10);
    expect(vessel.quantityPerParent).toBe(1);
    expect(vessel.costPerPc).toBeCloseTo(10, 10);
    expect(vessel.componentCostContribution).toBeCloseTo(10, 10);
    expect(quote.fullyLoadedUnitCost.materialComponentCostSubtotal).toBeCloseTo(10, 10);
    expect(quote.totalFullyLoadedUnitCost).toBeCloseTo(44.5, 10);
    expect(quote.sellingPrice).toBeCloseTo(66.75, 10);
    expect(quote.profitPerUnit).toBeCloseTo(22.25, 10);
    expect(quote.effectiveMarkup).toBeCloseTo(0.5, 10);
    expect(quote.effectiveMargin).toBeCloseTo(1 / 3, 10);
  });

  it('Scenario C — rolls up handmade-pot production cost but excludes child retail economics', async () => {
    const services = workflow();

    await addSimpleMaterial(services, {
      id: 'MAT-PLASTER',
      name: 'Casting Plaster',
      group: 'plaster',
      baseUnit: 'g',
      purchaseQuantity: 1000,
      purchaseUnit: 'g',
      packageCost: 100,
      onHandQuantity: 10000,
      onHandUnit: 'g',
    });
    await addSimpleMaterial(services, {
      id: 'MAT-WAX',
      name: 'Soy Wax',
      group: 'wax',
      baseUnit: 'g',
      purchaseQuantity: 1000,
      purchaseUnit: 'g',
      packageCost: 200,
      onHandQuantity: 10000,
      onHandUnit: 'g',
    });
    await addSimpleProduct(services, {
      id: 'HANDMADE-POT',
      name: 'Handmade Pot',
      category: 'candle-pot',
      safetyWasteRate: 0.1,
    });
    await addDirectItem(services, {
      id: 'RI-POT-PLASTER',
      productId: 'HANDMADE-POT',
      materialId: 'MAT-PLASTER',
      quantityPerProduct: 200,
      unit: 'g',
    });
    await addProfile(services, {
      productId: 'HANDMADE-POT',
      laborCostPerUnit: 5,
      overheadCostPerUnit: 3,
      pricingPolicy: { method: 'profit-amount', value: 70 },
    });

    await addSimpleProduct(services, {
      id: 'CANDLE-HANDMADE',
      name: 'Handmade Pot Candle',
      category: 'candle',
      safetyWasteRate: 0.05,
    });
    await addDirectItem(services, {
      id: 'RI-PARENT-WAX',
      productId: 'CANDLE-HANDMADE',
      materialId: 'MAT-WAX',
      quantityPerProduct: 100,
      unit: 'g',
    });
    await addComponent(services, {
      id: 'COMP-HANDMADE-POT',
      parentProductId: 'CANDLE-HANDMADE',
      sourceType: 'product',
      sourceId: 'HANDMADE-POT',
      role: 'vessel',
      quantityPerParent: 1,
    });
    await addProfile(services, {
      productId: 'CANDLE-HANDMADE',
      laborCostPerUnit: 4,
      overheadCostPerUnit: 5,
      pricingPolicy: { method: 'margin-percent', value: 0.25 },
    });

    const childQuote = await services.productPricingQuoteService.quoteProduct('HANDMADE-POT');
    const parentQuote = await services.productPricingQuoteService.quoteProduct('CANDLE-HANDMADE');
    const childLine = productComponentLine(parentQuote, 'COMP-HANDMADE-POT');

    expect(childQuote.status).toBe('ready');
    expect(childQuote.fullyLoadedUnitCost.directMaterialCost?.baseDirectMaterialCostSubtotal).toBeCloseTo(20, 10);
    expect(childQuote.fullyLoadedUnitCost.directMaterialCost?.safetyWasteReserveCostSubtotal).toBeCloseTo(2, 10);
    expect(childQuote.totalFullyLoadedUnitCost).toBeCloseTo(30, 10);
    expect(childQuote.sellingPrice).toBeCloseTo(100, 10);

    expect(childLine.status).toBe('ready');
    expect(childLine.path).toEqual(['candle-handmade', 'handmade-pot']);
    expect(childLine.childLaborCostPerUnit).toBe(5);
    expect(childLine.childOverheadCostPerUnit).toBe(3);
    expect(childLine.childFullyLoadedUnitCost).toBeCloseTo(30, 10);
    expect(childLine.componentCostContribution).toBeCloseTo(30, 10);
    expect(childLine.componentCostContribution).not.toBeCloseTo(childQuote.sellingPrice!, 10);

    expect(parentQuote.fullyLoadedUnitCost.directMaterialCostSubtotal).toBeCloseTo(21, 10);
    expect(parentQuote.fullyLoadedUnitCost.productComponentCostSubtotal).toBeCloseTo(30, 10);
    expect(parentQuote.fullyLoadedUnitCost.laborCostPerUnit).toBe(4);
    expect(parentQuote.fullyLoadedUnitCost.overheadCostPerUnit).toBe(5);
    expect(parentQuote.totalFullyLoadedUnitCost).toBeCloseTo(60, 10);
    expect(parentQuote.sellingPrice).toBeCloseTo(80, 10);
    expect(parentQuote.profitPerUnit).toBeCloseTo(20, 10);
    expect(parentQuote.effectiveMargin).toBeCloseTo(0.25, 10);
  });

  it('Scenario D — integrates multiple child quantities and preserves tied component capacity limiters', async () => {
    const services = workflow();

    await addSimpleMaterial(services, {
      id: 'MAT-CHILD-A',
      name: 'Child A Material',
      group: 'other',
      baseUnit: 'g',
      purchaseQuantity: 100,
      purchaseUnit: 'g',
      packageCost: 50,
      onHandQuantity: 1000,
      onHandUnit: 'g',
    });
    await addSimpleMaterial(services, {
      id: 'MAT-CHILD-B',
      name: 'Child B Material',
      group: 'other',
      baseUnit: 'g',
      purchaseQuantity: 100,
      purchaseUnit: 'g',
      packageCost: 50,
      onHandQuantity: 1000,
      onHandUnit: 'g',
    });
    await addSimpleProduct(services, {
      id: 'CHILD-A',
      name: 'Event Piece A',
      category: 'paintable-art',
      safetyWasteRate: 0,
    });
    await addDirectItem(services, {
      id: 'RI-CHILD-A',
      productId: 'CHILD-A',
      materialId: 'MAT-CHILD-A',
      quantityPerProduct: 10,
      unit: 'g',
    });
    await addProfile(services, {
      productId: 'CHILD-A',
      laborCostPerUnit: 1,
      overheadCostPerUnit: 1,
      pricingPolicy: null,
    });
    await services.productStockService.setStock('CHILD-A', 4);

    await addSimpleProduct(services, {
      id: 'CHILD-B',
      name: 'Event Piece B',
      category: 'paintable-art',
      safetyWasteRate: 0,
    });
    await addDirectItem(services, {
      id: 'RI-CHILD-B',
      productId: 'CHILD-B',
      materialId: 'MAT-CHILD-B',
      quantityPerProduct: 4,
      unit: 'g',
    });
    await addProfile(services, {
      productId: 'CHILD-B',
      laborCostPerUnit: 1,
      overheadCostPerUnit: 1,
      pricingPolicy: null,
    });
    await services.productStockService.setStock('CHILD-B', 6);

    await addSimpleProduct(services, {
      id: 'EVENT-SET',
      name: 'Multi-component Event Set',
      category: 'candle',
      safetyWasteRate: 0,
    });
    await addComponent(services, {
      id: 'COMP-EVENT-A',
      parentProductId: 'EVENT-SET',
      sourceType: 'product',
      sourceId: 'CHILD-A',
      role: 'molded-component',
      quantityPerParent: 2,
    });
    await addComponent(services, {
      id: 'COMP-EVENT-B',
      parentProductId: 'EVENT-SET',
      sourceType: 'product',
      sourceId: 'CHILD-B',
      role: 'molded-component',
      quantityPerParent: 3,
    });
    await addProfile(services, {
      productId: 'EVENT-SET',
      laborCostPerUnit: 2,
      overheadCostPerUnit: 1,
      pricingPolicy: { method: 'profit-amount', value: 10 },
    });

    const quote = await services.productPricingQuoteService.quoteProduct('EVENT-SET');
    const feasibility = await services.plannedBatchCapacityFeasibilityService.assessBatch('EVENT-SET', 2);
    const lineA = productComponentLine(quote, 'COMP-EVENT-A');
    const lineB = productComponentLine(quote, 'COMP-EVENT-B');

    expect(lineA.childFullyLoadedUnitCost).toBeCloseTo(7, 10);
    expect(lineA.quantityPerParent).toBe(2);
    expect(lineA.componentCostContribution).toBeCloseTo(14, 10);
    expect(lineB.childFullyLoadedUnitCost).toBeCloseTo(4, 10);
    expect(lineB.quantityPerParent).toBe(3);
    expect(lineB.componentCostContribution).toBeCloseTo(12, 10);
    expect(quote.fullyLoadedUnitCost.directMaterialMode).toBe('neutral-component-only');
    expect(quote.totalFullyLoadedUnitCost).toBeCloseTo(29, 10);
    expect(quote.sellingPrice).toBeCloseTo(39, 10);
    expect(quote.profitPerUnit).toBeCloseTo(10, 10);

    expect(feasibility.status).toBe('ready');
    expect(feasibility.feasibility).toBe('within-current-capacity');
    expect(feasibility.currentAssemblyCapacity).toBe(2);
    expect(feasibility.limitingResources).toHaveLength(2);
    expect(feasibility.limitingResources).toEqual(expect.arrayContaining([
      expect.objectContaining({
        resourceType: 'product-backed-component',
        componentId: 'COMP-EVENT-A',
        productId: 'CHILD-A',
        quantityPerParent: 2,
        capacityPieces: 2,
      }),
      expect.objectContaining({
        resourceType: 'product-backed-component',
        componentId: 'COMP-EVENT-B',
        productId: 'CHILD-B',
        quantityPerParent: 3,
        capacityPieces: 2,
      }),
    ]));
  });

  it('Scenario E — uses physical final-batch pc rounding so batch profit differs from unit-profit × quantity', async () => {
    const services = workflow();

    await addSimpleMaterial(services, {
      id: 'MAT-PC',
      name: 'Shared Count Insert',
      group: 'accessory',
      baseUnit: 'pc',
      purchaseQuantity: 10,
      purchaseUnit: 'pc',
      packageCost: 100,
      onHandQuantity: 100,
      onHandUnit: 'pc',
    });
    await addSimpleProduct(services, {
      id: 'ROUNDING-PRODUCT',
      name: 'Count Rounding Product',
      category: 'paintable-art',
      safetyWasteRate: 0,
    });
    await addDirectItem(services, {
      id: 'RI-COUNT',
      productId: 'ROUNDING-PRODUCT',
      materialId: 'MAT-PC',
      quantityPerProduct: 0.4,
      unit: 'pc',
      role: 'other',
    });
    await addProfile(services, {
      productId: 'ROUNDING-PRODUCT',
      laborCostPerUnit: 5,
      overheadCostPerUnit: 3,
      pricingPolicy: { method: 'profit-amount', value: 5 },
    });

    const quote = await services.productPricingQuoteService.quoteProduct('ROUNDING-PRODUCT');
    const physical = await services.physicalPlannedBatchProductionCostService.costPlannedBatch('ROUNDING-PRODUCT', 3);
    const financials = await services.expectedBatchFinancialsService.projectBatch('ROUNDING-PRODUCT', 3);

    expect(quote.totalFullyLoadedUnitCost).toBeCloseTo(12, 10);
    expect(quote.sellingPrice).toBeCloseTo(17, 10);
    expect(quote.profitPerUnit).toBeCloseTo(5, 10);
    expect(quote.fullyLoadedUnitCost.directMaterialCost?.lines[0].plannedBaseQuantityPerProduct).toBeCloseTo(0.4, 10);

    expect(physical.status).toBe('ready');
    expect(physical.directMaterialLines[0].preciseBatchBaseQuantity).toBeCloseTo(1.2, 10);
    expect(physical.directMaterialLines[0].physicalBatchBaseQuantity).toBe(2);
    expect(physical.plannedDirectMaterialCostSubtotal).toBeCloseTo(20, 10);
    expect(physical.plannedProductionCost).toBeCloseTo(44, 10);
    expect(physical.standardUnitCostTimesQuantity).toBeCloseTo(36, 10);
    expect(physical.physicalVsStandardCostDifference).toBeCloseTo(8, 10);

    expect(financials.status).toBe('ready');
    expect(financials.expectedRevenue).toBeCloseTo(51, 10);
    expect(financials.expectedProfit).toBeCloseTo(7, 10);
    expect(financials.unitProfitTimesQuantity).toBeCloseTo(15, 10);
    expect(financials.physicalVsUnitProfitDifference).toBeCloseTo(-8, 10);
  });

  it('Scenario F — warns over capacity without clamping the request or mutating stock', async () => {
    const services = workflow();

    await addSimpleMaterial(services, {
      id: 'MAT-DIRECT',
      name: 'Direct Limited Material',
      group: 'other',
      baseUnit: 'g',
      purchaseQuantity: 100,
      purchaseUnit: 'g',
      packageCost: 100,
      onHandQuantity: 5,
      onHandUnit: 'g',
    });
    await addSimpleMaterial(services, {
      id: 'MAT-COMPONENT',
      name: 'Limited Purchased Component',
      group: 'container',
      baseUnit: 'pc',
      purchaseQuantity: 10,
      purchaseUnit: 'pc',
      packageCost: 50,
      onHandQuantity: 5,
      onHandUnit: 'pc',
    });
    await addSimpleProduct(services, {
      id: 'LIMITED-CANDLE',
      name: 'Limited Candle',
      category: 'candle',
      safetyWasteRate: 0,
    });
    await addDirectItem(services, {
      id: 'RI-LIMITED-DIRECT',
      productId: 'LIMITED-CANDLE',
      materialId: 'MAT-DIRECT',
      quantityPerProduct: 1,
      unit: 'g',
    });
    await addComponent(services, {
      id: 'COMP-LIMITED',
      parentProductId: 'LIMITED-CANDLE',
      sourceType: 'material',
      sourceId: 'MAT-COMPONENT',
      role: 'vessel',
      quantityPerParent: 1,
    });
    await addProfile(services, {
      productId: 'LIMITED-CANDLE',
      laborCostPerUnit: 1,
      overheadCostPerUnit: 1,
      pricingPolicy: { method: 'markup-percent', value: 0.25 },
    });

    const before = await services.materialService.listMaterials();
    const result = await services.plannedBatchCapacityFeasibilityService.assessBatch('LIMITED-CANDLE', 7);
    const after = await services.materialService.listMaterials();

    expect(result.status).toBe('ready');
    expect(result.plannedQuantity).toBe(7);
    expect(result.financials.plannedQuantity).toBe(7);
    expect(result.financials.status).toBe('ready');
    expect(result.financials.expectedRevenue).not.toBeNull();
    expect(result.financials.expectedProfit).not.toBeNull();
    expect(result.feasibility).toBe('over-current-capacity');
    expect(result.currentAssemblyCapacity).toBe(5);
    expect(result.overageQuantity).toBe(2);
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'OVER_CURRENT_CAPACITY',
        plannedQuantity: 7,
        currentAssemblyCapacity: 5,
        overageQuantity: 2,
      }),
    ]));
    expect(result.limitingResources).toHaveLength(2);
    expect(result.limitingResources).toEqual(expect.arrayContaining([
      expect.objectContaining({
        resourceType: 'material-requirement',
        materialId: 'MAT-DIRECT',
        capacityPieces: 5,
      }),
      expect.objectContaining({
        resourceType: 'material-backed-component',
        componentId: 'COMP-LIMITED',
        materialId: 'MAT-COMPONENT',
        capacityPieces: 5,
      }),
    ]));
    expect(after).toEqual(before);
  });

  it('Scenario G — preserves missing vs zero source evidence, rejects invalid margin, and propagates unresolved child cost', async () => {
    const services = workflow();

    await addSimpleMaterial(services, {
      id: 'MAT-BASE',
      name: 'Base Material',
      group: 'other',
      baseUnit: 'g',
      purchaseQuantity: 100,
      purchaseUnit: 'g',
      packageCost: 100,
      onHandQuantity: 1000,
      onHandUnit: 'g',
    });
    await addSimpleProduct(services, {
      id: 'READINESS-ROOT',
      name: 'Readiness Root',
      category: 'paintable-art',
      safetyWasteRate: 0,
    });
    await addDirectItem(services, {
      id: 'RI-READINESS',
      productId: 'READINESS-ROOT',
      materialId: 'MAT-BASE',
      quantityPerProduct: 1,
      unit: 'g',
    });

    const missing = await services.productPricingQuoteService.quoteProduct('READINESS-ROOT');
    expect(missing.financialProfile).toBeNull();
    expect(missing.totalFullyLoadedUnitCost).toBeNull();
    expect(missing.sellingPrice).toBeNull();
    expect(missing.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'FINANCIAL_PROFILE_MISSING' }),
    ]));

    await addProfile(services, {
      productId: 'READINESS-ROOT',
      laborCostPerUnit: 0,
      overheadCostPerUnit: 0,
      pricingPolicy: null,
    });
    const explicitZero = await services.productPricingQuoteService.quoteProduct('READINESS-ROOT');
    expect(explicitZero.financialProfile).toMatchObject({
      laborCostPerUnit: 0,
      overheadCostPerUnit: 0,
      pricingPolicy: null,
    });
    expect(explicitZero.costStatus).toBe('ready');
    expect(explicitZero.totalFullyLoadedUnitCost).toBeCloseTo(1, 10);
    expect(explicitZero.pricingPolicy).toBeNull();
    expect(explicitZero.sellingPrice).toBeNull();
    expect(explicitZero.profitPerUnit).toBeNull();

    await expect(addProfile(services, {
      productId: 'READINESS-ROOT',
      laborCostPerUnit: 0,
      overheadCostPerUnit: 0,
      pricingPolicy: { method: 'margin-percent', value: 1 },
    })).rejects.toBeInstanceOf(PricingError);

    await addSimpleProduct(services, {
      id: 'UNRESOLVED-CHILD',
      name: 'Unresolved Child',
      category: 'candle-pot',
      safetyWasteRate: 0,
    });
    await addDirectItem(services, {
      id: 'RI-UNRESOLVED-CHILD',
      productId: 'UNRESOLVED-CHILD',
      materialId: 'MAT-BASE',
      quantityPerProduct: 2,
      unit: 'g',
    });
    await addSimpleProduct(services, {
      id: 'NESTED-PARENT',
      name: 'Nested Parent',
      category: 'candle',
      safetyWasteRate: 0,
    });
    await addComponent(services, {
      id: 'COMP-UNRESOLVED-CHILD',
      parentProductId: 'NESTED-PARENT',
      sourceType: 'product',
      sourceId: 'UNRESOLVED-CHILD',
      role: 'vessel',
      quantityPerParent: 1,
    });
    await addProfile(services, {
      productId: 'NESTED-PARENT',
      laborCostPerUnit: 1,
      overheadCostPerUnit: 1,
      pricingPolicy: { method: 'profit-amount', value: 5 },
    });

    const unresolved = await services.productPricingQuoteService.quoteProduct('NESTED-PARENT');
    const unresolvedLine = productComponentLine(unresolved, 'COMP-UNRESOLVED-CHILD');

    expect(unresolvedLine.status).not.toBe('ready');
    expect(unresolvedLine.childFullyLoadedUnitCost).toBeNull();
    expect(unresolvedLine.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'FINANCIAL_PROFILE_MISSING', productId: 'UNRESOLVED-CHILD' }),
    ]));
    expect(unresolved.totalFullyLoadedUnitCost).toBeNull();
    expect(unresolved.sellingPrice).toBeNull();
    expect(unresolved.fullyLoadedUnitCost.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'PRODUCT_COMPONENT_PARTIAL', componentId: 'COMP-UNRESOLVED-CHILD' }),
    ]));
  });
});
