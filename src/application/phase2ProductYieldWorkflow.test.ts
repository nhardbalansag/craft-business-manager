import { describe, expect, it } from 'vitest';
import { CalibrationService } from './calibrations/CalibrationService';
import { InMemoryCalibrationRepository } from './calibrations/InMemoryCalibrationRepository';
import { InMemoryMaterialRepository } from './materials/InMemoryMaterialRepository';
import { MaterialService } from './materials/MaterialService';
import { InMemoryMixPresetRepository } from './mixPresets/InMemoryMixPresetRepository';
import { MixPresetService } from './mixPresets/MixPresetService';
import { ProductionCapacityService } from './production/ProductionCapacityService';
import { ProductionRequirementService } from './production/ProductionRequirementService';
import { InMemoryProductRepository } from './products/InMemoryProductRepository';
import { ProductService } from './products/ProductService';
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
  const yieldSampleRepository = new InMemoryYieldSampleRepository();
  const fixedRecipeItemRepository = new InMemoryFixedRecipeItemRepository();

  const materialService = new MaterialService(materialRepository, async (materialId) => {
    const key = materialId.trim().toLowerCase();
    return (await calibrationRepository.list()).filter(
      (record) => record.materialId.trim().toLowerCase() === key,
    );
  });
  const calibrationService = new CalibrationService(calibrationRepository, materialRepository);
  const productService = new ProductService(productRepository, mixPresetRepository);
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
  const productionCapacityService = new ProductionCapacityService(
    productionRequirementService,
    materialRepository,
    calibrationRepository,
  );

  return {
    materialService,
    calibrationService,
    productService,
    mixPresetService,
    yieldSampleEvidenceService,
    yieldHistoryService,
    fixedRecipeItemService,
    effectiveRecipeRequirementService,
    recipeMaterialCostPreviewService,
    productionRequirementService,
    productionCapacityService,
  };
}

async function seedPlasterArt() {
  const services = workflow();
  const { materialService, calibrationService, mixPresetService, productService } = services;

  await materialService.createMaterial({
    id: 'MAT-PLASTER',
    name: 'Plaster of Paris',
    group: 'plaster',
    baseUnit: 'g',
    purchaseQuantity: 1,
    purchaseUnit: 'kg',
    packageCost: 66,
    onHandQuantity: 700,
    onHandUnit: 'g',
    isActive: true,
  });
  await materialService.createMaterial({
    id: 'MAT-WATER',
    name: 'Production Water',
    group: 'liquid',
    baseUnit: 'mL',
    purchaseQuantity: 1,
    purchaseUnit: 'L',
    packageCost: 20,
    onHandQuantity: 1000,
    onHandUnit: 'mL',
    isActive: true,
  });
  await materialService.createMaterial({
    id: 'MAT-PAINT',
    name: 'Paint',
    group: 'paint',
    baseUnit: 'mL',
    purchaseQuantity: 100,
    purchaseUnit: 'mL',
    packageCost: 50,
    onHandQuantity: 100,
    onHandUnit: 'mL',
    isActive: true,
  });
  await materialService.createMaterial({
    id: 'MAT-BRUSH',
    name: 'Mini Brush',
    group: 'accessory',
    baseUnit: 'pc',
    purchaseQuantity: 10,
    purchaseUnit: 'pc',
    packageCost: 30,
    onHandQuantity: 10,
    onHandUnit: 'pc',
    isActive: true,
  });

  await calibrationService.createCalibration({
    id: 'CAL-PLASTER-001',
    materialId: 'MAT-PLASTER',
    measuredVolume: 5,
    volumeUnit: 'cup',
    knownWeight: 1,
    weightUnit: 'kg',
    recordedAt: '2026-09-14T08:00:00.000Z',
  });

  await mixPresetService.createMixPreset({
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

  await productService.createProduct({
    id: 'ART-STAR',
    name: 'Small Paintable Star',
    category: 'paintable-art',
    mixPresetId: 'MIX-PLASTER-2-1',
    safetyWasteRate: 0.05,
    isActive: true,
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
    recordedAt: '2026-09-14T09:00:00.000Z',
    notes: 'Initial real casting sample',
  });

  await services.fixedRecipeItemService.createItem({
    id: 'RI-STAR-PAINT',
    productId: 'ART-STAR',
    materialId: 'MAT-PAINT',
    quantityPerProduct: 2,
    unit: 'mL',
    role: 'finish',
  });
  await services.fixedRecipeItemService.createItem({
    id: 'RI-STAR-BRUSH',
    productId: 'ART-STAR',
    materialId: 'MAT-BRUSH',
    quantityPerProduct: 1,
    unit: 'pc',
    role: 'finish',
  });

  return services;
}

function byMaterial<T extends { materialId: string }>(records: readonly T[], id: string): T {
  const record = records.find((entry) => entry.materialId === id);
  if (!record) throw new Error(`Expected material result ${id}.`);
  return record;
}

describe('Phase 2 integrated product / yield / production workflow', () => {
  it('runs the plaster-art example from real yield evidence through requirements, costing and capacity', async () => {
    const services = await seedPlasterArt();

    const effective = await services.effectiveRecipeRequirementService.deriveForProduct('ART-STAR');
    expect(effective.status).toBe('ready');
    expect(effective.effectiveYieldSampleId).toBe('YS-STAR-001');
    expect(effective.skippedInvalidYieldSampleIds).toEqual([]);
    expect(effective.requirements).toHaveLength(4);
    expect(byMaterial(effective.requirements, 'MAT-PLASTER').baseQuantityPerProduct).toBeCloseTo(75, 10);
    expect(byMaterial(effective.requirements, 'MAT-WATER').baseQuantityPerProduct).toBeCloseTo(45, 10);
    expect(byMaterial(effective.requirements, 'MAT-PAINT').baseQuantityPerProduct).toBeCloseTo(2, 10);
    expect(byMaterial(effective.requirements, 'MAT-BRUSH').baseQuantityPerProduct).toBeCloseTo(1, 10);

    const cost = await services.recipeMaterialCostPreviewService.previewForProduct('ART-STAR');
    expect(cost.status).toBe('ready');
    expect(cost.totalMaterialCostPerProduct).toBeCloseTo(9.85, 10);

    const plan = await services.productionRequirementService.plan('ART-STAR', 8);
    expect(plan.status).toBe('ready');
    expect(plan.safetyWastePercentage).toBe(5);
    expect(byMaterial(plan.requirements, 'MAT-PLASTER').plannedBatchBaseQuantity).toBeCloseTo(630, 10);
    expect(byMaterial(plan.requirements, 'MAT-WATER').plannedBatchBaseQuantity).toBeCloseTo(378, 10);
    expect(byMaterial(plan.requirements, 'MAT-PAINT').plannedBatchBaseQuantity).toBeCloseTo(16.8, 10);

    const brushPlan = byMaterial(plan.requirements, 'MAT-BRUSH');
    expect(brushPlan.plannedBaseQuantityPerProduct).toBeCloseTo(1.05, 10);
    expect(brushPlan.contributions[0].plannedBatchBaseQuantity).toBeCloseTo(8.4, 10);
    expect(brushPlan.plannedBatchBaseQuantity).toBe(9);

    const capacity = await services.productionCapacityService.estimate('ART-STAR');
    expect(capacity.status).toBe('ready');
    expect(capacity.produciblePieces).toBe(8);
    expect(capacity.limitingMaterialIds).toEqual(['MAT-PLASTER']);
    expect(byMaterial(capacity.materials, 'MAT-PLASTER').capacityPieces).toBe(8);
    expect(byMaterial(capacity.materials, 'MAT-BRUSH').capacityPieces).toBe(9);

    const costById = new Map(cost.lines.map((line) => [line.materialId, line]));
    const physicalBatchCost = plan.requirements.reduce((total, requirement) => {
      const line = costById.get(requirement.materialId);
      if (!line) throw new Error(`Expected cost line ${requirement.materialId}.`);
      return total + line.costPerBaseUnit * requirement.plannedBatchBaseQuantity;
    }, 0);
    expect(physicalBatchCost).toBeCloseTo(84.54, 10);
  });

  it('falls back to the latest older derivable sample when a newer calibration-dependent sample becomes invalid', async () => {
    const services = await seedPlasterArt();

    await services.yieldSampleEvidenceService.recordSample({
      id: 'YS-STAR-002',
      productId: 'ART-STAR',
      mixPresetId: 'MIX-PLASTER-2-1',
      materialInputs: [
        { materialId: 'MAT-PLASTER', quantity: 560, unit: 'g' },
        { materialId: 'MAT-WATER', quantity: 336, unit: 'mL' },
      ],
      goodPieces: 8,
      rejectedPieces: 0,
      recordedAt: '2026-09-14T10:00:00.000Z',
    });
    await services.yieldSampleEvidenceService.recordSample({
      id: 'YS-STAR-003',
      productId: 'ART-STAR',
      mixPresetId: 'MIX-PLASTER-2-1',
      materialInputs: [
        { materialId: 'MAT-PLASTER', quantity: 3, unit: 'cup' },
        { materialId: 'MAT-WATER', quantity: 1.5, unit: 'cup' },
      ],
      goodPieces: 8,
      rejectedPieces: 0,
      recordedAt: '2026-09-14T11:00:00.000Z',
    });

    await services.calibrationService.deleteCalibration('CAL-PLASTER-001');

    const selection = await services.yieldHistoryService.getEffective('ART-STAR');
    expect(selection.sample.id).toBe('YS-STAR-002');
    expect(selection.skippedInvalidSampleIds).toEqual(['YS-STAR-003']);

    const effective = await services.effectiveRecipeRequirementService.deriveForProduct('ART-STAR');
    expect(effective.status).toBe('ready');
    expect(effective.effectiveYieldSampleId).toBe('YS-STAR-002');
    expect(effective.skippedInvalidYieldSampleIds).toEqual(['YS-STAR-003']);
    expect(byMaterial(effective.requirements, 'MAT-PLASTER').baseQuantityPerProduct).toBeCloseTo(70, 10);
    expect(byMaterial(effective.requirements, 'MAT-WATER').baseQuantityPerProduct).toBeCloseTo(42, 10);

    const plan = await services.productionRequirementService.plan('ART-STAR', 8);
    expect(plan.status).toBe('ready');
    expect(plan.effectiveYieldSampleId).toBe('YS-STAR-002');
    expect(plan.skippedInvalidYieldSampleIds).toEqual(['YS-STAR-003']);

    const capacity = await services.productionCapacityService.estimate('ART-STAR');
    expect(capacity.status).toBe('ready');
    expect(capacity.produciblePieces).toBe(9);
    expect(capacity.limitingMaterialIds).toEqual(['MAT-BRUSH', 'MAT-PLASTER']);

    const cost = await services.recipeMaterialCostPreviewService.previewForProduct('ART-STAR');
    expect(cost.status).toBe('ready');
    expect(cost.effectiveYieldSampleId).toBe('YS-STAR-002');
    expect(cost.skippedInvalidYieldSampleIds).toEqual(['YS-STAR-003']);
  });
});
