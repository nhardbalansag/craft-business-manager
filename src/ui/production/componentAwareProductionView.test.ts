import { describe, expect, it } from 'vitest';
import type { ComponentAwareProductCostResult } from '../../application/productComponents/ComponentAwareProductCostService';
import type { ProductBackedComponentCostLine } from '../../application/productComponents/ProductBackedComponentCostService';
import type { AssemblyCapacityTraceResult } from '../../application/production/AssemblyCapacityTraceService';
import type { ProductionRequirementPlanResult } from '../../application/production/ProductionRequirementService';
import type { Material } from '../../domain/materials';
import type { Product } from '../../domain/products';
import {
  buildComponentCostBreakdownRows,
  buildComponentRequirementRows,
  buildLimitingResourceRows,
  buildProductionIssueRows,
} from './componentAwareProductionView';

const products: Product[] = [
  { id: 'PARENT', name: 'Gift Box', category: 'candle', safetyWasteRate: 0.1, isActive: true },
  { id: 'CANDLE', name: 'Candle', category: 'candle', safetyWasteRate: 0, isActive: true },
  { id: 'POT', name: 'Handmade Pot', category: 'candle-pot', safetyWasteRate: 0, isActive: true },
];

const materials: Material[] = [
  {
    id: 'CUP', name: 'Glass Cup', group: 'container', baseUnit: 'pc', purchaseQuantity: 1, purchaseUnit: 'pc',
    packageCost: 12, onHandQuantity: 10, onHandUnit: 'pc', isActive: true,
  },
  {
    id: 'INSERT', name: 'Box Insert', group: 'accessory', baseUnit: 'pc', purchaseQuantity: 1, purchaseUnit: 'pc',
    packageCost: 3, onHandQuantity: 10, onHandUnit: 'pc', isActive: true,
  },
];

function materialCost(componentId = 'MAT-COMP', sourceName: string | null = 'Glass Cup') {
  return {
    sourceType: 'material' as const,
    line: {
      componentId,
      parentProductId: 'PARENT',
      role: 'vessel' as const,
      sourceMaterialId: 'CUP',
      sourceMaterialName: sourceName,
      quantityPerParent: 2,
      status: 'ready' as const,
      costPerPc: 12,
      componentCostContribution: 24,
      costingTrace: null,
      sourceAvailability: null,
      issues: [],
    },
  };
}

function productCost(componentId = 'PROD-COMP', childName: string | null = 'Candle'): ProductBackedComponentCostLine {
  return {
    componentId,
    parentProductId: 'PARENT',
    role: 'molded-component',
    childProductId: 'CANDLE',
    childProductName: childName,
    quantityPerParent: 1,
    path: ['PARENT', 'CANDLE'],
    status: 'ready',
    childDirectMaterialCost: null,
    childComponentCostSubtotal: 0,
    childComponentAwareUnitCost: 30,
    componentCostContribution: 30,
    breakdown: [],
    issues: [],
  };
}

function costResult(lines = [materialCost(), { sourceType: 'product' as const, line: productCost() }]): ComponentAwareProductCostResult {
  return {
    productId: 'PARENT',
    productName: 'Gift Box',
    productIsActive: true,
    status: 'ready',
    directMaterialCost: {
      productId: 'PARENT', productIsActive: true, status: 'ready', requirementStatus: 'ready', effectiveYieldSampleId: null,
      skippedInvalidYieldSampleIds: [], lines: [], totalMaterialCostPerProduct: 0, requirementIssues: [], costIssues: [],
    },
    directMaterialCostSubtotal: 0,
    componentCostSubtotal: 54,
    totalComponentAwareCost: 54,
    componentLines: lines,
    issues: [],
  };
}

function capacityEntry(
  componentId: string,
  sourceType: 'material' | 'product',
  sourceId: string,
  quantityPerParent: number,
  availableQuantity: number | null,
  status: 'ready' | 'partial' | 'not-ready' = 'ready',
  missingStock = false,
) {
  return {
    componentId,
    parentProductId: 'PARENT',
    role: sourceType === 'material' ? 'vessel' as const : 'molded-component' as const,
    sourceType,
    sourceId,
    quantityPerParent,
    status,
    availableQuantity,
    unit: 'pc' as const,
    capacityPieces: status === 'ready' && availableQuantity !== null ? Math.floor(availableQuantity / quantityPerParent) : null,
    sourceAvailability: {
      sourceType,
      sourceId,
      status: missingStock ? 'partial' as const : status,
      availableQuantity,
      unit: 'pc' as const,
      issues: missingStock ? [{ code: 'SOURCE_PRODUCT_STOCK_MISSING' as const, message: 'Current ProductStock is unresolved.' }] : [],
      ...(sourceType === 'product' ? { productStock: missingStock ? null : { productId: sourceId, onHandQuantity: availableQuantity ?? 0 } } : {}),
    },
    issues: status === 'ready' ? [] : [{ code: 'SOURCE_AVAILABILITY_PARTIAL' as const, message: 'Availability unresolved.' }],
  };
}

function traceResult(componentCapacities = [
  capacityEntry('MAT-COMP', 'material', 'CUP', 2, 20),
  capacityEntry('PROD-COMP', 'product', 'CANDLE', 1, 8),
]): AssemblyCapacityTraceResult {
  return {
    productId: 'PARENT',
    productName: 'Gift Box',
    productIsActive: true,
    status: 'ready',
    overallAssemblyCapacity: 8,
    capacitySynthesis: {
      productId: 'PARENT', productIsActive: true, status: 'ready', directMaterialApplicable: false,
      directMaterialCapacity: {
        productId: 'PARENT', productIsActive: true, status: 'not-ready', requirementStatus: 'not-ready', effectiveYieldSampleId: null,
        skippedInvalidYieldSampleIds: [], safetyWasteRate: 0, safetyWastePercentage: 0, safetyWasteMultiplier: 1,
        observedDefectRateIncluded: false, produciblePieces: null, limitingMaterialIds: [], materials: [], issues: [],
      },
      componentCapacities,
      overallAssemblyCapacity: 8,
      issues: [],
    },
    limitingResources: [],
    issues: [],
  };
}

describe('component-aware Production presentation helpers', () => {
  it('joins material-backed capacity and cost evidence', () => {
    const rows = buildComponentRequirementRows(costResult(), traceResult(), 3, materials, products);
    const row = rows.find((item) => item.componentId === 'MAT-COMP')!;
    expect(row.sourceName).toBe('Glass Cup');
    expect(row.availableQuantity).toBe(20);
    expect(row.capacityPieces).toBe(10);
    expect(row.unitCost).toBe(12);
    expect(row.costContributionPerParent).toBe(24);
  });

  it('joins Product-backed capacity and cost evidence', () => {
    const rows = buildComponentRequirementRows(costResult(), traceResult(), 2, materials, products);
    const row = rows.find((item) => item.componentId === 'PROD-COMP')!;
    expect(row.sourceName).toBe('Candle');
    expect(row.availableQuantity).toBe(8);
    expect(row.capacityPieces).toBe(8);
    expect(row.unitCost).toBe(30);
  });

  it('scales planned discrete components without applying parent safety waste', () => {
    const row = buildComponentRequirementRows(costResult(), traceResult(), 5, materials, products)
      .find((item) => item.componentId === 'MAT-COMP')!;
    expect(row.quantityPerParent).toBe(2);
    expect(row.plannedQuantity).toBe(10);
  });

  it('preserves missing ProductStock as unresolved rather than zero', () => {
    const trace = traceResult([capacityEntry('PROD-COMP', 'product', 'CANDLE', 1, null, 'partial', true)]);
    const row = buildComponentRequirementRows(costResult([{ sourceType: 'product', line: productCost() }]), trace, 1, materials, products)[0];
    expect(row.availableQuantity).toBeNull();
    expect(row.availabilityState).toBe('missing');
  });

  it('preserves explicit zero ProductStock as numeric zero', () => {
    const trace = traceResult([capacityEntry('PROD-COMP', 'product', 'CANDLE', 1, 0)]);
    const row = buildComponentRequirementRows(costResult([{ sourceType: 'product', line: productCost() }]), trace, 1, materials, products)[0];
    expect(row.availableQuantity).toBe(0);
    expect(row.availabilityState).toBe('zero');
    expect(row.capacityPieces).toBe(0);
  });

  it('preserves the authoritative per-component capacity result', () => {
    const trace = traceResult([capacityEntry('MAT-COMP', 'material', 'CUP', 2, 20)]);
    trace.capacitySynthesis.componentCapacities[0]!.capacityPieces = 7;
    const row = buildComponentRequirementRows(costResult([materialCost()]), trace, 1, materials, products)[0];
    expect(row.capacityPieces).toBe(7);
  });

  it('uses authoritative source name, then catalog name, then source ID', () => {
    const authoritative = buildComponentRequirementRows(costResult([materialCost('MAT-COMP', 'Authoritative Cup')]), traceResult([capacityEntry('MAT-COMP', 'material', 'CUP', 2, 20)]), 1, materials, products)[0];
    expect(authoritative.sourceName).toBe('Authoritative Cup');

    const catalog = buildComponentRequirementRows(costResult([materialCost('MAT-COMP', null)]), traceResult([capacityEntry('MAT-COMP', 'material', 'CUP', 2, 20)]), 1, materials, products)[0];
    expect(catalog.sourceName).toBe('Glass Cup');

    const unknownCost = materialCost('UNKNOWN-COMP', null);
    unknownCost.line.sourceMaterialId = 'UNKNOWN';
    const raw = buildComponentRequirementRows(costResult([unknownCost]), traceResult([capacityEntry('UNKNOWN-COMP', 'material', 'UNKNOWN', 2, 20)]), 1, materials, products)[0];
    expect(raw.sourceName).toBe('UNKNOWN');
  });

  it('orders component rows deterministically by source type, source ID, then component ID', () => {
    const trace = traceResult([
      capacityEntry('P2', 'product', 'POT', 1, 5),
      capacityEntry('M2', 'material', 'INSERT', 1, 5),
      capacityEntry('M1', 'material', 'CUP', 1, 5),
    ]);
    const rows = buildComponentRequirementRows(null, trace, 1, materials, products);
    expect(rows.map((row) => row.componentId)).toEqual(['M1', 'M2', 'P2']);
  });

  it('calculates planned component cost from authoritative per-parent contribution', () => {
    const row = buildComponentRequirementRows(costResult([materialCost()]), traceResult([capacityEntry('MAT-COMP', 'material', 'CUP', 2, 20)]), 4, materials, products)[0];
    expect(row.plannedCostContribution).toBe(96);
  });

  it('retains numeric contribution while preserving partial cost status', () => {
    const entry = materialCost();
    const partial = costResult([entry]);
    partial.status = 'partial';
    partial.componentLines[0]!.line.status = 'not-ready';
    partial.componentLines[0]!.line.componentCostContribution = 24;
    const row = buildComponentRequirementRows(partial, traceResult([capacityEntry('MAT-COMP', 'material', 'CUP', 2, 20)]), 2, materials, products)[0];
    expect(row.costStatus).toBe('not-ready');
    expect(row.plannedCostContribution).toBe(48);
  });

  it('flattens nested Product and Material cost paths with readable depth', () => {
    const nestedMaterial = materialCost('INSERT-COMP');
    nestedMaterial.line.parentProductId = 'CANDLE';
    nestedMaterial.line.sourceMaterialId = 'INSERT';
    nestedMaterial.line.sourceMaterialName = 'Box Insert';
    const candle = productCost();
    candle.breakdown = [{ sourceType: 'material', line: nestedMaterial.line }];
    const cost = costResult([{ sourceType: 'product', line: candle }]);
    const rows = buildComponentCostBreakdownRows(cost, materials, products);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.pathLabel).toBe('Gift Box > Candle');
    expect(rows[0]!.depth).toBe(0);
    expect(rows[1]!.pathLabel).toBe('Gift Box > Candle > Box Insert');
    expect(rows[1]!.depth).toBe(1);
  });

  it('stops malformed circular display data rather than recursing forever', () => {
    const candle = productCost();
    candle.breakdown = [{ sourceType: 'product', line: candle }];
    const rows = buildComponentCostBreakdownRows(costResult([{ sourceType: 'product', line: candle }]), materials, products);
    expect(rows).toHaveLength(2);
    expect(rows[1]!.status).toBe('not-ready');
    expect(rows[1]!.issues.join(' ')).toContain('display cycle stopped');
  });

  it('preserves every typed limiting-resource tie', () => {
    const trace = traceResult();
    trace.limitingResources = [
      {
        resourceType: 'material-requirement', capacityPieces: 8, materialId: 'WAX', materialName: 'Wax', baseUnit: 'g',
        normalizedOnHandBaseQuantity: 800, plannedBaseQuantityPerProduct: 100,
        path: [{ kind: 'product', id: 'PARENT', name: 'Gift Box' }, { kind: 'material', id: 'WAX', name: 'Wax' }],
      },
      {
        resourceType: 'material-backed-component', capacityPieces: 8, componentId: 'MAT-COMP', parentProductId: 'PARENT', parentProductName: 'Gift Box', role: 'vessel',
        materialId: 'CUP', materialName: 'Glass Cup', availableQuantity: 16, quantityPerParent: 2,
        path: [{ kind: 'product', id: 'PARENT', name: 'Gift Box' }, { kind: 'material', id: 'CUP', name: 'Glass Cup' }],
      },
      {
        resourceType: 'product-backed-component', capacityPieces: 8, componentId: 'PROD-COMP', parentProductId: 'PARENT', parentProductName: 'Gift Box', role: 'molded-component',
        productId: 'CANDLE', productName: 'Candle', availableQuantity: 8, quantityPerParent: 1,
        path: [{ kind: 'product', id: 'PARENT', name: 'Gift Box' }, { kind: 'product', id: 'CANDLE', name: 'Candle' }],
      },
    ];
    const rows = buildLimitingResourceRows(trace);
    expect(rows.map((row) => row.typeLabel)).toEqual(['Direct material', 'Material component', 'Product component']);
    expect(rows.every((row) => row.capacityPieces === 8)).toBe(true);
  });

  it('does not invent limiter rows for partial traces', () => {
    const trace = traceResult();
    trace.status = 'partial';
    trace.limitingResources = [{
      resourceType: 'product-backed-component', capacityPieces: 8, componentId: 'PROD-COMP', parentProductId: 'PARENT', parentProductName: 'Gift Box', role: 'molded-component',
      productId: 'CANDLE', productName: 'Candle', availableQuantity: 8, quantityPerParent: 1,
      path: [],
    }];
    expect(buildLimitingResourceRows(trace)).toEqual([]);
  });

  it('deduplicates issue messages deterministically within each source label', () => {
    const plan = {
      issues: [{ message: 'Need yield evidence.' }, { message: 'Need yield evidence.' }],
    } as unknown as ProductionRequirementPlanResult;
    const cost = costResult();
    cost.issues = [{ code: 'COMPONENT_COST_PARTIAL', message: 'Cost unresolved.', productId: 'PARENT' }];
    const trace = traceResult();
    trace.issues = [{ code: 'UPSTREAM_CAPACITY_PARTIAL', message: 'Capacity unresolved.', productId: 'PARENT' }];
    const rows = buildProductionIssueRows(plan, cost, trace);
    expect(rows.filter((row) => row.message === 'Need yield evidence.')).toHaveLength(1);
    expect(rows.map((row) => row.source)).toContain('Cost');
    expect(rows.map((row) => row.source)).toContain('Assembly capacity');
  });
});
