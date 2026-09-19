import { beforeEach, describe, expect, it } from 'vitest';
import * as session from '../../application/session';
import type { ComponentRequirementRow } from './componentAwareProductionView';
import { buildBatchProductionRequestView } from './batchProductionRequestView';

beforeEach(async () => {
  await Promise.all([
    session.materialRepository.replaceAll([]),
    session.productRepository.replaceAll([]),
    session.calibrationRepository.replaceAll([]),
    session.mixPresetRepository.replaceAll([]),
    session.yieldSampleRepository.replaceAll([]),
    session.fixedRecipeItemRepository.replaceAll([]),
    session.productComponentRepository.replaceAll([]),
    session.productStockRepository.replaceAll([]),
    session.productFinancialProfileRepository.replaceAll([]),
  ]);
});

async function seed() {
  await session.productService.createProduct({
    id: 'CANDLE',
    name: 'Workshop Candle',
    category: 'candle',
    safetyWasteRate: 0.1,
    notes: 'Pour slowly & keep wick centered.',
    isActive: true,
  });
  await session.materialService.createMaterial({
    id: 'WAX',
    name: 'Soy wax',
    group: 'wax',
    baseUnit: 'g',
    purchaseQuantity: 100,
    purchaseUnit: 'g',
    packageCost: 100,
    onHandQuantity: 15,
    onHandUnit: 'g',
    isActive: true,
  });
  await session.fixedRecipeItemService.createItem({
    id: 'RECIPE',
    productId: 'CANDLE',
    materialId: 'WAX',
    quantityPerProduct: 10,
    unit: 'g',
    role: 'consumable',
  });
  await session.productFinancialProfileService.upsertProfile({
    productId: 'CANDLE',
    laborCostPerUnit: 1,
    overheadCostPerUnit: 1,
    pricingPolicy: { method: 'profit-amount', value: 5 },
  });
}

describe('batch production request presentation model', () => {
  it('copies authoritative production and financial evidence into a deterministic printable snapshot', async () => {
    await seed();
    const [products, materials, plan, feasibility] = await Promise.all([
      session.productService.listProducts(),
      session.materialService.listMaterials(),
      session.productionRequirementService.plan('CANDLE', 2),
      session.plannedBatchCapacityFeasibilityService.assessBatch('CANDLE', 2),
    ]);
    const product = products[0]!;
    const requirement = plan.requirements[0]!;
    const directCapacity = feasibility.capacityTrace.capacitySynthesis.directMaterialCapacity.materials[0]!;
    const component: ComponentRequirementRow = {
      componentId: 'VESSEL',
      sourceType: 'product',
      sourceId: 'POT',
      sourceName: 'Handmade pot',
      role: 'vessel',
      quantityPerParent: 1,
      plannedQuantity: 2,
      availableQuantity: 1,
      availabilityState: 'available',
      availabilityStatus: 'ready',
      capacityPieces: 1,
      capacityStatus: 'ready',
      unit: 'pc',
      unitCost: 10,
      costContributionPerParent: 10,
      plannedCostContribution: 20,
      costStatus: 'ready',
      issues: [],
    };

    const view = buildBatchProductionRequestView({
      product,
      materials,
      plan,
      feasibility,
      componentRows: [component],
      limitingRows: [],
      productionIssues: [{ source: 'Availability', message: 'Sample shop-floor note.' }],
      generatedAt: new Date('2026-09-17T01:02:03.000Z'),
    });

    expect(view.requestReference).toBe('PR-20260917-010203Z-CANDLE');
    expect(view.generatedAtIso).toBe('2026-09-17T01:02:03.000Z');
    expect(view.product).toMatchObject({
      id: 'CANDLE',
      name: 'Workshop Candle',
      categoryLabel: 'Candle',
      isActive: true,
    });
    expect(view.plannedQuantity).toBe(feasibility.plannedQuantity);
    expect(view.safetyWastePercentage).toBe(plan.safetyWastePercentage);
    expect(view.effectiveYieldSampleId).toBe(plan.effectiveYieldSampleId);
    expect(view.materials[0]).toMatchObject({
      materialId: 'WAX',
      materialName: 'Soy wax',
      requiredQuantity: requirement.plannedBatchBaseQuantity,
      normalizedOnHandQuantity: directCapacity.normalizedOnHandBaseQuantity,
      shortageQuantity: Math.max(
        requirement.plannedBatchBaseQuantity - directCapacity.normalizedOnHandBaseQuantity,
        0,
      ),
      status: 'shortage',
    });
    expect(view.components[0]).toMatchObject({
      componentId: 'VESSEL',
      sourceName: 'Handmade pot',
      role: 'vessel',
      plannedQuantity: 2,
      availableQuantity: 1,
    });
    expect(view.issues).toContainEqual({
      source: 'Availability',
      message: 'Sample shop-floor note.',
    });
    expect(view.financials).toEqual({
      status: feasibility.financials.status,
      plannedProductionCost: feasibility.financials.plannedProductionCost,
      expectedRevenue: feasibility.financials.expectedRevenue,
      expectedProfit: feasibility.financials.expectedProfit,
      batchMargin: feasibility.financials.batchMargin,
      averageCostPerFinishedUnit: feasibility.financials.plannedAverageCostPerFinishedUnit,
      sellingPrice: feasibility.financials.sellingPrice,
      profitPerUnit: feasibility.financials.profitPerUnit,
    });
  });

  it('marks unknown stock unresolved and preserves archived-product warning truthfully', async () => {
    await seed();
    const [products, materials, plan, feasibility] = await Promise.all([
      session.productService.listProducts(),
      session.materialService.listMaterials(),
      session.productionRequirementService.plan('CANDLE', 2),
      session.plannedBatchCapacityFeasibilityService.assessBatch('CANDLE', 2),
    ]);
    const noCapacityEvidence = {
      ...feasibility,
      capacityTrace: {
        ...feasibility.capacityTrace,
        capacitySynthesis: {
          ...feasibility.capacityTrace.capacitySynthesis,
          directMaterialCapacity: {
            ...feasibility.capacityTrace.capacitySynthesis.directMaterialCapacity,
            materials: [],
          },
        },
      },
    };

    const view = buildBatchProductionRequestView({
      product: { ...products[0]!, isActive: false },
      materials,
      plan,
      feasibility: noCapacityEvidence,
      componentRows: [],
      limitingRows: [],
      productionIssues: [],
      generatedAt: new Date('2026-09-17T01:02:03.000Z'),
    });

    expect(view.materials[0]).toMatchObject({
      normalizedOnHandQuantity: null,
      shortageQuantity: null,
      status: 'unresolved',
    });
    expect(view.warnings).toContain(
      'This product is archived. The sheet is a planning snapshot only.',
    );
  });
});
