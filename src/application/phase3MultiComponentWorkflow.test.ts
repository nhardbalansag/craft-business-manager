import { describe, expect, it } from 'vitest';
import { ProductCompositionGraphError } from '../domain/productCompositionGraph';
import { InMemoryCalibrationRepository } from './calibrations/InMemoryCalibrationRepository';
import { InMemoryMaterialRepository } from './materials/InMemoryMaterialRepository';
import { MaterialService } from './materials/MaterialService';
import { InMemoryMixPresetRepository } from './mixPresets/InMemoryMixPresetRepository';
import { AssemblyCapacitySynthesisService } from './production/AssemblyCapacitySynthesisService';
import { AssemblyCapacityTraceService } from './production/AssemblyCapacityTraceService';
import { ProductionCapacityService } from './production/ProductionCapacityService';
import { ProductionRequirementService } from './production/ProductionRequirementService';
import { ComponentAwareProductCostService } from './productComponents/ComponentAwareProductCostService';
import { ComponentCapacityService } from './productComponents/ComponentCapacityService';
import { ComponentSourceAvailabilityService } from './productComponents/ComponentSourceAvailabilityService';
import { InMemoryProductComponentRepository } from './productComponents/InMemoryProductComponentRepository';
import { MaterialBackedComponentCostService } from './productComponents/MaterialBackedComponentCostService';
import { ProductBackedComponentCostService } from './productComponents/ProductBackedComponentCostService';
import { ProductComponentService } from './productComponents/ProductComponentService';
import { InMemoryProductRepository } from './products/InMemoryProductRepository';
import { ProductService } from './products/ProductService';
import { InMemoryProductStockRepository } from './productStocks/InMemoryProductStockRepository';
import { ProductStockService } from './productStocks/ProductStockService';
import { RecipeMaterialCostPreviewService } from './recipeCosts/RecipeMaterialCostPreviewService';
import { EffectiveRecipeRequirementService } from './recipeRequirements/EffectiveRecipeRequirementService';
import { FixedRecipeItemService } from './recipeItems/FixedRecipeItemService';
import { InMemoryFixedRecipeItemRepository } from './recipeItems/InMemoryFixedRecipeItemRepository';
import { InMemoryYieldSampleRepository } from './yieldSamples/InMemoryYieldSampleRepository';
import { YieldHistoryService } from './yieldSamples/YieldHistoryService';

function workflow() {
  const materialRepository = new InMemoryMaterialRepository();
  const calibrationRepository = new InMemoryCalibrationRepository();
  const mixPresetRepository = new InMemoryMixPresetRepository();
  const productRepository = new InMemoryProductRepository();
  const productComponentRepository = new InMemoryProductComponentRepository();
  const productStockRepository = new InMemoryProductStockRepository();
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
  const productService = new ProductService(
    productRepository,
    mixPresetRepository,
    productComponentService,
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
  const productBackedComponentCostService = new ProductBackedComponentCostService(
    productRepository,
    productComponentRepository,
    recipeMaterialCostPreviewService,
    materialBackedComponentCostService,
  );
  const componentAwareProductCostService = new ComponentAwareProductCostService(
    productRepository,
    productComponentRepository,
    recipeMaterialCostPreviewService,
    materialBackedComponentCostService,
    productBackedComponentCostService,
  );
  const productionRequirementService = new ProductionRequirementService(
    effectiveRecipeRequirementService,
    productService,
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

  return {
    materialService,
    productService,
    productComponentService,
    productStockService,
    fixedRecipeItemService,
    componentAwareProductCostService,
    assemblyCapacityTraceService,
  };
}

async function addMaterial(
  services: ReturnType<typeof workflow>,
  input: {
    id: string;
    name: string;
    group: 'wax' | 'wick' | 'container' | 'plaster' | 'packaging';
    baseUnit: 'g' | 'pc';
    purchaseQuantity: number;
    purchaseUnit: 'g' | 'pc';
    packageCost: number;
    onHandQuantity: number;
    onHandUnit: 'g' | 'pc';
  },
) {
  return services.materialService.createMaterial({
    ...input,
    isActive: true,
  });
}

async function addProduct(
  services: ReturnType<typeof workflow>,
  id: string,
  name: string,
  category: 'candle' | 'candle-pot' | 'paintable-art' = 'candle',
) {
  return services.productService.createProduct({
    id,
    name,
    category,
    safetyWasteRate: 0,
    isActive: true,
  });
}

async function addFixedItem(
  services: ReturnType<typeof workflow>,
  input: {
    id: string;
    productId: string;
    materialId: string;
    quantityPerProduct: number;
    unit: 'g' | 'pc';
    role?: 'consumable' | 'packaging';
  },
) {
  return services.fixedRecipeItemService.createItem({
    ...input,
    role: input.role ?? 'consumable',
  });
}

async function seedCandleMaterials(services: ReturnType<typeof workflow>) {
  await addMaterial(services, {
    id: 'MAT-WAX',
    name: 'Soy Wax',
    group: 'wax',
    baseUnit: 'g',
    purchaseQuantity: 1000,
    purchaseUnit: 'g',
    packageCost: 200,
    onHandQuantity: 1000,
    onHandUnit: 'g',
  });
  await addMaterial(services, {
    id: 'MAT-WICK',
    name: 'Cotton Wick',
    group: 'wick',
    baseUnit: 'pc',
    purchaseQuantity: 100,
    purchaseUnit: 'pc',
    packageCost: 100,
    onHandQuantity: 100,
    onHandUnit: 'pc',
  });
}

async function addBasicCandleRecipe(
  services: ReturnType<typeof workflow>,
  productId: string,
  prefix: string,
) {
  await addFixedItem(services, {
    id: `${prefix}-WAX`,
    productId,
    materialId: 'MAT-WAX',
    quantityPerProduct: 100,
    unit: 'g',
  });
  await addFixedItem(services, {
    id: `${prefix}-WICK`,
    productId,
    materialId: 'MAT-WICK',
    quantityPerProduct: 1,
    unit: 'pc',
  });
}

describe('Phase 3.6A integrated multi-component workflow', () => {
  it('Scenario A — integrates purchased Glass Cup cost/inventory and makes cup stock the parent limiter', async () => {
    const services = workflow();
    await seedCandleMaterials(services);
    await addMaterial(services, {
      id: 'MAT-GLASS',
      name: 'Glass Cup',
      group: 'container',
      baseUnit: 'pc',
      purchaseQuantity: 10,
      purchaseUnit: 'pc',
      packageCost: 200,
      onHandQuantity: 6,
      onHandUnit: 'pc',
    });
    await addProduct(services, 'CANDLE-PURCHASED', 'Purchased Vessel Candle');
    await addBasicCandleRecipe(services, 'CANDLE-PURCHASED', 'RI-PURCHASED');
    await services.productComponentService.createComponent({
      id: 'COMP-PURCHASED-GLASS',
      parentProductId: 'CANDLE-PURCHASED',
      sourceType: 'material',
      sourceId: 'MAT-GLASS',
      role: 'vessel',
      quantityPerParent: 1,
    });

    const cost = await services.componentAwareProductCostService.costProduct('CANDLE-PURCHASED');
    expect(cost.status).toBe('ready');
    expect(cost.directMaterialCostSubtotal).toBeCloseTo(21, 10);
    expect(cost.componentCostSubtotal).toBeCloseTo(20, 10);
    expect(cost.totalComponentAwareCost).toBeCloseTo(41, 10);
    expect(cost.componentLines).toHaveLength(1);
    expect(cost.componentLines[0]).toMatchObject({
      sourceType: 'material',
      line: {
        componentId: 'COMP-PURCHASED-GLASS',
        sourceMaterialId: 'MAT-GLASS',
        quantityPerParent: 1,
        status: 'ready',
        costPerPc: 20,
        componentCostContribution: 20,
      },
    });

    const trace = await services.assemblyCapacityTraceService.trace('CANDLE-PURCHASED');
    expect(trace.status).toBe('ready');
    expect(trace.capacitySynthesis.directMaterialCapacity.produciblePieces).toBe(10);
    expect(trace.capacitySynthesis.componentCapacities).toEqual([
      expect.objectContaining({
        componentId: 'COMP-PURCHASED-GLASS',
        sourceType: 'material',
        sourceId: 'MAT-GLASS',
        availableQuantity: 6,
        capacityPieces: 6,
        status: 'ready',
      }),
    ]);
    expect(trace.overallAssemblyCapacity).toBe(6);
    expect(trace.limitingResources).toEqual([
      expect.objectContaining({
        resourceType: 'material-backed-component',
        componentId: 'COMP-PURCHASED-GLASS',
        materialId: 'MAT-GLASS',
        materialName: 'Glass Cup',
        capacityPieces: 6,
        availableQuantity: 6,
        quantityPerParent: 1,
      }),
    ]);
  });

  it('Scenario B — rolls up Handmade Pot cost while explicit ProductStock limits current parent assembly', async () => {
    const services = workflow();
    await seedCandleMaterials(services);
    await addMaterial(services, {
      id: 'MAT-PLASTER',
      name: 'Casting Plaster',
      group: 'plaster',
      baseUnit: 'g',
      purchaseQuantity: 1000,
      purchaseUnit: 'g',
      packageCost: 100,
      onHandQuantity: 5000,
      onHandUnit: 'g',
    });
    await addProduct(services, 'PLASTER-POT', 'Handmade Plaster Pot', 'candle-pot');
    await addFixedItem(services, {
      id: 'RI-POT-PLASTER',
      productId: 'PLASTER-POT',
      materialId: 'MAT-PLASTER',
      quantityPerProduct: 200,
      unit: 'g',
    });
    await services.productStockService.setStock('PLASTER-POT', 4);

    await addProduct(services, 'CANDLE-HANDMADE', 'Handmade Pot Candle');
    await addBasicCandleRecipe(services, 'CANDLE-HANDMADE', 'RI-HANDMADE');
    await services.productComponentService.createComponent({
      id: 'COMP-HANDMADE-POT',
      parentProductId: 'CANDLE-HANDMADE',
      sourceType: 'product',
      sourceId: 'PLASTER-POT',
      role: 'vessel',
      quantityPerParent: 1,
    });

    const cost = await services.componentAwareProductCostService.costProduct('CANDLE-HANDMADE');
    expect(cost.status).toBe('ready');
    expect(cost.directMaterialCostSubtotal).toBeCloseTo(21, 10);
    expect(cost.componentCostSubtotal).toBeCloseTo(20, 10);
    expect(cost.totalComponentAwareCost).toBeCloseTo(41, 10);
    expect(cost.componentLines).toEqual([
      expect.objectContaining({
        sourceType: 'product',
        line: expect.objectContaining({
          componentId: 'COMP-HANDMADE-POT',
          childProductId: 'PLASTER-POT',
          childProductName: 'Handmade Plaster Pot',
          quantityPerParent: 1,
          status: 'ready',
          childComponentAwareUnitCost: 20,
          componentCostContribution: 20,
        }),
      }),
    ]);

    const trace = await services.assemblyCapacityTraceService.trace('CANDLE-HANDMADE');
    expect(trace.status).toBe('ready');
    expect(trace.capacitySynthesis.directMaterialCapacity.produciblePieces).toBe(10);
    expect(trace.capacitySynthesis.componentCapacities).toEqual([
      expect.objectContaining({
        componentId: 'COMP-HANDMADE-POT',
        sourceType: 'product',
        sourceId: 'PLASTER-POT',
        availableQuantity: 4,
        capacityPieces: 4,
        status: 'ready',
      }),
    ]);
    expect(trace.overallAssemblyCapacity).toBe(4);
    expect(trace.limitingResources).toEqual([
      expect.objectContaining({
        resourceType: 'product-backed-component',
        componentId: 'COMP-HANDMADE-POT',
        productId: 'PLASTER-POT',
        productName: 'Handmade Plaster Pot',
        availableQuantity: 4,
        quantityPerParent: 1,
        capacityPieces: 4,
      }),
    ]);

    await services.productStockService.setStock('PLASTER-POT', 0);
    const costAfterStockChange = await services.componentAwareProductCostService.costProduct('CANDLE-HANDMADE');
    expect(costAfterStockChange.totalComponentAwareCost).toBeCloseTo(41, 10);
    expect(costAfterStockChange.status).toBe('ready');
  });

  it('Scenario C — preserves three tied child Product limiters and numeric component-only cost evidence', async () => {
    const services = workflow();
    await addMaterial(services, {
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
    await addMaterial(services, {
      id: 'MAT-GLASS',
      name: 'Glass Cup',
      group: 'container',
      baseUnit: 'pc',
      purchaseQuantity: 10,
      purchaseUnit: 'pc',
      packageCost: 100,
      onHandQuantity: 50,
      onHandUnit: 'pc',
    });

    await addProduct(services, 'MINI-HEART', 'Mini Heart', 'paintable-art');
    await addProduct(services, 'MINI-STAR', 'Mini Star', 'paintable-art');
    await addProduct(services, 'MINI-FLOWER', 'Mini Flower', 'paintable-art');
    await addProduct(services, 'EVENT-SET', 'Multi-Mold Event Set');

    await addFixedItem(services, {
      id: 'RI-HEART-PLASTER',
      productId: 'MINI-HEART',
      materialId: 'MAT-PLASTER',
      quantityPerProduct: 10,
      unit: 'g',
    });
    await addFixedItem(services, {
      id: 'RI-STAR-PLASTER',
      productId: 'MINI-STAR',
      materialId: 'MAT-PLASTER',
      quantityPerProduct: 15,
      unit: 'g',
    });
    await addFixedItem(services, {
      id: 'RI-FLOWER-PLASTER',
      productId: 'MINI-FLOWER',
      materialId: 'MAT-PLASTER',
      quantityPerProduct: 20,
      unit: 'g',
    });

    await services.productStockService.setStock('MINI-HEART', 30);
    await services.productStockService.setStock('MINI-STAR', 20);
    await services.productStockService.setStock('MINI-FLOWER', 40);

    await services.productComponentService.createComponent({
      id: 'COMP-EVENT-GLASS',
      parentProductId: 'EVENT-SET',
      sourceType: 'material',
      sourceId: 'MAT-GLASS',
      role: 'vessel',
      quantityPerParent: 1,
    });
    await services.productComponentService.createComponent({
      id: 'COMP-EVENT-HEART',
      parentProductId: 'EVENT-SET',
      sourceType: 'product',
      sourceId: 'MINI-HEART',
      role: 'molded-component',
      quantityPerParent: 3,
    });
    await services.productComponentService.createComponent({
      id: 'COMP-EVENT-STAR',
      parentProductId: 'EVENT-SET',
      sourceType: 'product',
      sourceId: 'MINI-STAR',
      role: 'molded-component',
      quantityPerParent: 2,
    });
    await services.productComponentService.createComponent({
      id: 'COMP-EVENT-FLOWER',
      parentProductId: 'EVENT-SET',
      sourceType: 'product',
      sourceId: 'MINI-FLOWER',
      role: 'molded-component',
      quantityPerParent: 4,
    });

    const cost = await services.componentAwareProductCostService.costProduct('EVENT-SET');
    expect(cost.status).toBe('partial');
    expect(cost.directMaterialCostSubtotal).toBe(0);
    expect(cost.componentCostSubtotal).toBeCloseTo(24, 10);
    expect(cost.totalComponentAwareCost).toBeCloseTo(24, 10);
    expect(cost.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DIRECT_MATERIAL_COST_NOT_READY' }),
      ]),
    );

    const trace = await services.assemblyCapacityTraceService.trace('EVENT-SET');
    expect(trace.status).toBe('ready');
    expect(trace.capacitySynthesis.directMaterialApplicable).toBe(false);
    expect(trace.overallAssemblyCapacity).toBe(10);

    const componentCapacityBySource = new Map(
      trace.capacitySynthesis.componentCapacities.map((entry) => [entry.sourceId, entry.capacityPieces]),
    );
    expect(componentCapacityBySource.get('MAT-GLASS')).toBe(50);
    expect(componentCapacityBySource.get('MINI-HEART')).toBe(10);
    expect(componentCapacityBySource.get('MINI-STAR')).toBe(10);
    expect(componentCapacityBySource.get('MINI-FLOWER')).toBe(10);

    expect(trace.limitingResources).toHaveLength(3);
    expect(trace.limitingResources.every((resource) => resource.resourceType === 'product-backed-component')).toBe(true);
    const tiedProductIds = trace.limitingResources
      .filter((resource) => resource.resourceType === 'product-backed-component')
      .map((resource) => resource.productId)
      .sort();
    expect(tiedProductIds).toEqual(['MINI-FLOWER', 'MINI-HEART', 'MINI-STAR']);
    expect(trace.limitingResources.map((resource) => resource.capacityPieces)).toEqual([10, 10, 10]);
  });

  it('Scenario D — recursively rolls Gift Set cost through Candle to Handmade Pot with finite deterministic paths', async () => {
    const services = workflow();
    await seedCandleMaterials(services);
    await addMaterial(services, {
      id: 'MAT-PLASTER',
      name: 'Casting Plaster',
      group: 'plaster',
      baseUnit: 'g',
      purchaseQuantity: 1000,
      purchaseUnit: 'g',
      packageCost: 100,
      onHandQuantity: 5000,
      onHandUnit: 'g',
    });
    await addMaterial(services, {
      id: 'MAT-GIFT-BOX',
      name: 'Gift Box Packaging',
      group: 'packaging',
      baseUnit: 'pc',
      purchaseQuantity: 10,
      purchaseUnit: 'pc',
      packageCost: 50,
      onHandQuantity: 50,
      onHandUnit: 'pc',
    });

    await addProduct(services, 'NESTED-POT', 'Nested Handmade Pot', 'candle-pot');
    await addFixedItem(services, {
      id: 'RI-NESTED-POT-PLASTER',
      productId: 'NESTED-POT',
      materialId: 'MAT-PLASTER',
      quantityPerProduct: 200,
      unit: 'g',
    });

    await addProduct(services, 'NESTED-CANDLE', 'Nested Candle');
    await addBasicCandleRecipe(services, 'NESTED-CANDLE', 'RI-NESTED-CANDLE');
    await services.productComponentService.createComponent({
      id: 'COMP-NESTED-CANDLE-POT',
      parentProductId: 'NESTED-CANDLE',
      sourceType: 'product',
      sourceId: 'NESTED-POT',
      role: 'vessel',
      quantityPerParent: 1,
    });

    await addProduct(services, 'GIFT-SET', 'Gift Set');
    await addFixedItem(services, {
      id: 'RI-GIFT-BOX',
      productId: 'GIFT-SET',
      materialId: 'MAT-GIFT-BOX',
      quantityPerProduct: 1,
      unit: 'pc',
      role: 'packaging',
    });
    await services.productComponentService.createComponent({
      id: 'COMP-GIFT-CANDLES',
      parentProductId: 'GIFT-SET',
      sourceType: 'product',
      sourceId: 'NESTED-CANDLE',
      role: 'other',
      quantityPerParent: 2,
    });

    const cost = await services.componentAwareProductCostService.costProduct('GIFT-SET');
    expect(cost.status).toBe('ready');
    expect(cost.directMaterialCostSubtotal).toBeCloseTo(5, 10);
    expect(cost.componentCostSubtotal).toBeCloseTo(82, 10);
    expect(cost.totalComponentAwareCost).toBeCloseTo(87, 10);
    expect(cost.componentLines).toHaveLength(1);

    const candleEntry = cost.componentLines[0];
    expect(candleEntry.sourceType).toBe('product');
    if (candleEntry.sourceType !== 'product') throw new Error('Expected Product-backed Candle cost line.');

    expect(candleEntry.line).toMatchObject({
      componentId: 'COMP-GIFT-CANDLES',
      childProductId: 'NESTED-CANDLE',
      childProductName: 'Nested Candle',
      quantityPerParent: 2,
      path: ['gift-set', 'nested-candle'],
      status: 'ready',
      childDirectMaterialCost: expect.objectContaining({ totalMaterialCostPerProduct: 21 }),
      childComponentCostSubtotal: 20,
      childComponentAwareUnitCost: 41,
      componentCostContribution: 82,
    });
    expect(candleEntry.line.breakdown).toHaveLength(1);
    expect(candleEntry.line.breakdown[0]).toMatchObject({
      sourceType: 'product',
      line: expect.objectContaining({
        componentId: 'COMP-NESTED-CANDLE-POT',
        childProductId: 'NESTED-POT',
        childProductName: 'Nested Handmade Pot',
        path: ['gift-set', 'nested-candle', 'nested-pot'],
        status: 'ready',
        childComponentAwareUnitCost: 20,
        componentCostContribution: 20,
        breakdown: [],
      }),
    });
  });

  it('Scenario E — rejects a transitive Product cycle before persistence', async () => {
    const services = workflow();
    await addProduct(services, 'A', 'Cycle Product A');
    await addProduct(services, 'B', 'Cycle Product B');
    await addProduct(services, 'C', 'Cycle Product C');

    await services.productComponentService.createComponent({
      id: 'COMP-A-B',
      parentProductId: 'A',
      sourceType: 'product',
      sourceId: 'B',
      role: 'other',
      quantityPerParent: 1,
    });
    await services.productComponentService.createComponent({
      id: 'COMP-B-C',
      parentProductId: 'B',
      sourceType: 'product',
      sourceId: 'C',
      role: 'other',
      quantityPerParent: 1,
    });

    await expect(
      services.productComponentService.createComponent({
        id: 'COMP-C-A',
        parentProductId: 'C',
        sourceType: 'product',
        sourceId: 'A',
        role: 'other',
        quantityPerParent: 1,
      }),
    ).rejects.toMatchObject({
      code: 'CYCLE_DETECTED',
      cyclePath: ['a', 'b', 'c', 'a'],
    } satisfies Partial<ProductCompositionGraphError>);

    expect(await services.productComponentService.listComponents()).toEqual([
      expect.objectContaining({ id: 'COMP-A-B', parentProductId: 'A', sourceId: 'B' }),
      expect.objectContaining({ id: 'COMP-B-C', parentProductId: 'B', sourceId: 'C' }),
    ]);
    expect(await services.productComponentService.getComponent('COMP-C-A')).toBeNull();
  });
});
