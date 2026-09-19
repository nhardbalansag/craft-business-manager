import { describe, expect, it } from 'vitest';
import type { Product } from '../../domain/products';
import type { ProductComponent } from '../../domain/productComponents';
import type { ProductFinancialProfile } from '../../domain/productFinancialProfile';
import { InMemoryProductRepository } from '../products/InMemoryProductRepository';
import { InMemoryProductComponentRepository } from '../productComponents/InMemoryProductComponentRepository';
import type { MaterialBackedComponentCostLine } from '../productComponents/MaterialBackedComponentCostService';
import type { RecursiveFullyLoadedProductComponentCostLine } from './RecursiveFullyLoadedProductComponentCostService';
import type { WasteAdjustedDirectMaterialCostResult } from './WasteAdjustedDirectMaterialCostService';
import {
  FullyLoadedProductUnitCostService,
  type FullyLoadedDirectMaterialCostProvider,
  type FullyLoadedMaterialComponentCostProvider,
  type FullyLoadedProductComponentCostProvider,
  type FullyLoadedProductFinancialProfileProvider,
} from './FullyLoadedProductUnitCostService';

function product(id: string, overrides: Partial<Product> = {}): Product {
  return {
    id,
    name: `Product ${id}`,
    category: 'candle-pot',
    safetyWasteRate: 0,
    isActive: true,
    ...overrides,
  };
}

function edge(
  id: string,
  parentProductId: string,
  sourceType: 'material' | 'product',
  sourceId: string,
  overrides: Partial<ProductComponent> = {},
): ProductComponent {
  return {
    id,
    parentProductId,
    sourceType,
    sourceId,
    role: sourceType === 'material' ? 'vessel' : 'molded-component',
    quantityPerParent: 1,
    ...overrides,
  };
}

function direct(
  productId: string,
  amount: number | null,
  status: WasteAdjustedDirectMaterialCostResult['status'] = amount === null ? 'not-ready' : 'ready',
  options: { base?: number | null; waste?: number | null; noRequirements?: boolean } = {},
): WasteAdjustedDirectMaterialCostResult {
  const noRequirements = options.noRequirements ?? false;
  const base = options.base ?? amount;
  const waste = options.waste ?? (amount === null || base === null ? null : amount - base);
  return {
    productId,
    productIsActive: true,
    status,
    planningBasisQuantity: 1,
    safetyWasteRate: 0,
    safetyWastePercentage: 0,
    safetyWasteMultiplier: 1,
    observedDefectRateIncluded: false,
    baseDirectMaterialCostSubtotal: base,
    safetyWasteReserveCostSubtotal: waste,
    pricingDirectMaterialCostPerUnit: amount,
    lines:
      amount === null || noRequirements
        ? []
        : [{
            materialId: `${productId}-material`,
            baseUnit: 'g',
            source: 'fixed',
            status: 'ready',
            effectiveBaseQuantityPerProduct: 1,
            wasteReserveBaseQuantityPerProduct: 0,
            plannedBaseQuantityPerProduct: 1,
            costPerBaseUnit: amount,
            baseDirectMaterialCostPerUnit: base,
            safetyWasteReserveCostPerUnit: waste,
            pricingDirectMaterialCostPerUnit: amount,
            packageCost: amount,
            packageBaseQuantity: 1,
            packageConversionSource: 'standard',
            costingCalibrationId: null,
            requirementContributions: [],
            costContributions: [],
            issues: [],
          }],
    requirementIssues: noRequirements
      ? [{ code: 'NO_REQUIREMENTS', message: `${productId} has no direct requirements.` }]
      : [],
    costIssues: [],
    issues: noRequirements
      ? [
          { code: 'REQUIREMENT_NOT_READY', message: `${productId} has no direct requirements.` },
          { code: 'COST_NOT_READY', message: `${productId} has no direct cost.` },
        ]
      : status === 'partial'
        ? [{ code: 'REQUIREMENT_PARTIAL', message: `${productId} direct cost is partial.` }]
        : [],
  };
}

function financial(
  productId: string,
  labor: number,
  overhead: number,
  pricingPolicy: ProductFinancialProfile['pricingPolicy'] = null,
): ProductFinancialProfile {
  return { productId, laborCostPerUnit: labor, overheadCostPerUnit: overhead, pricingPolicy };
}

function materialLine(
  component: ProductComponent,
  contribution: number | null,
): MaterialBackedComponentCostLine {
  const ready = contribution !== null;
  return {
    componentId: component.id,
    parentProductId: component.parentProductId,
    role: component.role,
    sourceMaterialId: component.sourceId,
    sourceMaterialName: `Material ${component.sourceId}`,
    quantityPerParent: component.quantityPerParent,
    status: ready ? 'ready' : 'not-ready',
    costPerPc: ready ? contribution / component.quantityPerParent : null,
    componentCostContribution: contribution,
    costingTrace: null,
    sourceAvailability: null,
    issues: ready
      ? []
      : [{ code: 'MATERIAL_COST_NOT_DERIVABLE', message: `${component.sourceId} is not ready.` }],
  };
}

function productLine(
  component: ProductComponent,
  contribution: number | null,
  status: RecursiveFullyLoadedProductComponentCostLine['status'] = contribution === null
    ? 'not-ready'
    : 'ready',
  knownContribution: number | null = contribution,
): RecursiveFullyLoadedProductComponentCostLine {
  const unit = contribution === null ? null : contribution / component.quantityPerParent;
  const knownUnit = knownContribution === null ? null : knownContribution / component.quantityPerParent;
  return {
    componentId: component.id,
    parentProductId: component.parentProductId,
    role: component.role,
    childProductId: component.sourceId,
    childProductName: `Product ${component.sourceId}`,
    quantityPerParent: component.quantityPerParent,
    path: [component.parentProductId.toLowerCase(), component.sourceId.toLowerCase()],
    status,
    childDirectMaterialCost: null,
    childDirectMaterialMode: 'costed',
    childMaterialComponentCostSubtotal: 0,
    childProductComponentCostSubtotal: 0,
    childLaborCostPerUnit: 0,
    childOverheadCostPerUnit: 0,
    knownChildProductionCostSubtotal: knownUnit,
    childFullyLoadedUnitCost: status === 'ready' ? unit : null,
    knownComponentCostContribution: knownContribution,
    componentCostContribution: status === 'ready' ? contribution : null,
    breakdown: [],
    issues: status === 'ready'
      ? []
      : [{
          code: status === 'partial' ? 'DIRECT_MATERIAL_COST_PARTIAL' : 'DIRECT_MATERIAL_COST_NOT_READY',
          message: `${component.sourceId} recursive cost is ${status}.`,
          componentId: component.id,
          productId: component.sourceId,
          path: [component.parentProductId.toLowerCase(), component.sourceId.toLowerCase()],
        }],
  };
}

function setup(options: {
  products?: Product[];
  components?: ProductComponent[];
  directCosts?: Record<string, WasteAdjustedDirectMaterialCostResult>;
  profiles?: Record<string, ProductFinancialProfile | null>;
  materialLines?: Record<string, MaterialBackedComponentCostLine>;
  productLines?: Record<string, RecursiveFullyLoadedProductComponentCostLine>;
} = {}) {
  const products = new InMemoryProductRepository(options.products ?? [product('P')]);
  const components = new InMemoryProductComponentRepository(options.components ?? []);
  const directs = new Map(Object.entries(options.directCosts ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  const profiles = new Map(Object.entries(options.profiles ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  const materials = new Map(Object.entries(options.materialLines ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  const childProducts = new Map(Object.entries(options.productLines ?? {}).map(([k, v]) => [k.toLowerCase(), v]));

  const directProvider: FullyLoadedDirectMaterialCostProvider = {
    async costProduct(id) {
      return directs.get(id.trim().toLowerCase()) ?? direct(id, null, 'not-ready', { noRequirements: true });
    },
  };
  const materialProvider: FullyLoadedMaterialComponentCostProvider = {
    async costComponent(component) {
      return materials.get(component.id.toLowerCase()) ?? materialLine(component, null);
    },
  };
  const productProvider: FullyLoadedProductComponentCostProvider = {
    async costComponent(component) {
      return childProducts.get(component.id.toLowerCase()) ?? productLine(component, null);
    },
  };
  const profileProvider: FullyLoadedProductFinancialProfileProvider = {
    async getProfile(id) {
      return profiles.get(id.trim().toLowerCase()) ?? null;
    },
  };

  return new FullyLoadedProductUnitCostService(
    products,
    components,
    directProvider,
    materialProvider,
    productProvider,
    profileProvider,
  );
}

describe('FullyLoadedProductUnitCostService', () => {
  it('synthesizes ready direct material + labor + overhead cost', async () => {
    const result = await setup({
      directCosts: { P: direct('P', 20) },
      profiles: { P: financial('P', 5, 3) },
    }).costProduct('P');
    expect(result).toMatchObject({
      status: 'ready',
      directMaterialMode: 'costed',
      directMaterialCostSubtotal: 20,
      inputMaterialComponentSubtotal: 20,
      laborCostPerUnit: 5,
      overheadCostPerUnit: 3,
      knownFullyLoadedUnitCostSubtotal: 28,
      totalFullyLoadedUnitCost: 28,
      issues: [],
    });
  });

  it('accepts explicit zero labor and overhead', async () => {
    const result = await setup({ directCosts: { P: direct('P', 12) }, profiles: { P: financial('P', 0, 0) } }).costProduct('P');
    expect(result.status).toBe('ready');
    expect(result.totalFullyLoadedUnitCost).toBe(12);
  });

  it('includes 4.2A safety-waste direct cost exactly once', async () => {
    const result = await setup({
      directCosts: { P: direct('P', 12, 'ready', { base: 10, waste: 2 }) },
      profiles: { P: financial('P', 0, 0) },
    }).costProduct('P');
    expect(result.directMaterialCost?.baseDirectMaterialCostSubtotal).toBe(10);
    expect(result.directMaterialCost?.safetyWasteReserveCostSubtotal).toBe(2);
    expect(result.totalFullyLoadedUnitCost).toBe(12);
  });

  it('adds Material-backed component cost', async () => {
    const cup = edge('cup-edge', 'P', 'material', 'cup', { quantityPerParent: 2 });
    const result = await setup({
      components: [cup], directCosts: { P: direct('P', 10) }, profiles: { P: financial('P', 2, 1) },
      materialLines: { 'cup-edge': materialLine(cup, 8) },
    }).costProduct('P');
    expect(result.materialComponentCostSubtotal).toBe(8);
    expect(result.totalFullyLoadedUnitCost).toBe(21);
  });

  it('adds Product-backed 4.2B fully loaded cost', async () => {
    const child = edge('child-edge', 'P', 'product', 'Child', { quantityPerParent: 3 });
    const result = await setup({
      components: [child], directCosts: { P: direct('P', 10) }, profiles: { P: financial('P', 2, 1) },
      productLines: { 'child-edge': productLine(child, 18) },
    }).costProduct('P');
    expect(result.productComponentCostSubtotal).toBe(18);
    expect(result.totalFullyLoadedUnitCost).toBe(31);
  });

  it('synthesizes mixed direct, purchased, handmade, labor, and overhead cost', async () => {
    const cup = edge('cup-edge', 'P', 'material', 'cup');
    const child = edge('child-edge', 'P', 'product', 'Child', { quantityPerParent: 2 });
    const result = await setup({
      components: [child, cup], directCosts: { P: direct('P', 25) }, profiles: { P: financial('P', 7, 4) },
      materialLines: { 'cup-edge': materialLine(cup, 9) },
      productLines: { 'child-edge': productLine(child, 16) },
    }).costProduct('P');
    expect(result).toMatchObject({
      directMaterialCostSubtotal: 25,
      materialComponentCostSubtotal: 9,
      productComponentCostSubtotal: 16,
      inputMaterialComponentSubtotal: 50,
      totalFullyLoadedUnitCost: 61,
      status: 'ready',
    });
  });

  it('treats a genuine component-only root as neutral direct zero', async () => {
    const child = edge('child-edge', 'P', 'product', 'Child');
    const result = await setup({
      components: [child],
      directCosts: { P: direct('P', null, 'not-ready', { noRequirements: true }) },
      profiles: { P: financial('P', 2, 1) },
      productLines: { 'child-edge': productLine(child, 10) },
    }).costProduct('P');
    expect(result).toMatchObject({ status: 'ready', directMaterialMode: 'neutral-component-only', totalFullyLoadedUnitCost: 13 });
  });

  it('does not neutralize a root with no direct materials and no components', async () => {
    const result = await setup({
      directCosts: { P: direct('P', null, 'not-ready', { noRequirements: true }) },
      profiles: { P: financial('P', 2, 1) },
    }).costProduct('P');
    expect(result.status).toBe('partial');
    expect(result.knownFullyLoadedUnitCostSubtotal).toBe(3);
    expect(result.totalFullyLoadedUnitCost).toBeNull();
  });

  it('preserves known cost when the financial profile is missing', async () => {
    const result = await setup({ directCosts: { P: direct('P', 20) } }).costProduct('P');
    expect(result.status).toBe('partial');
    expect(result.knownFullyLoadedUnitCostSubtotal).toBe(20);
    expect(result.totalFullyLoadedUnitCost).toBeNull();
    expect(result.issues.map((x) => x.code)).toContain('FINANCIAL_PROFILE_MISSING');
  });

  it('fails closed for mismatched financial profile identity', async () => {
    const result = await setup({
      directCosts: { P: direct('P', 20) }, profiles: { P: financial('Other', 5, 3) },
    }).costProduct('P');
    expect(result.status).toBe('partial');
    expect(result.knownFullyLoadedUnitCostSubtotal).toBe(20);
    expect(result.issues.map((x) => x.code)).toContain('FINANCIAL_PROFILE_PRODUCT_MISMATCH');
  });

  it('fails closed for invalid financial adders', async () => {
    const result = await setup({
      directCosts: { P: direct('P', 20) }, profiles: { P: financial('P', -1, 3) },
    }).costProduct('P');
    expect(result.status).toBe('partial');
    expect(result.totalFullyLoadedUnitCost).toBeNull();
    expect(result.issues.map((x) => x.code)).toContain('FINANCIAL_PROFILE_COST_INVALID');
  });

  it('allows null pricing policy', async () => {
    const result = await setup({ directCosts: { P: direct('P', 10) }, profiles: { P: financial('P', 2, 1, null) } }).costProduct('P');
    expect(result.status).toBe('ready');
    expect(result.totalFullyLoadedUnitCost).toBe(13);
  });

  it('ignores pricing policy when deriving cost', async () => {
    const first = await setup({
      directCosts: { P: direct('P', 10) }, profiles: { P: financial('P', 2, 1, { method: 'markup-percent', value: 0.5 }) },
    }).costProduct('P');
    const second = await setup({
      directCosts: { P: direct('P', 10) }, profiles: { P: financial('P', 2, 1, { method: 'profit-amount', value: 999 }) },
    }).costProduct('P');
    expect(first.totalFullyLoadedUnitCost).toBe(13);
    expect(second.totalFullyLoadedUnitCost).toBe(13);
  });

  it('preserves partial direct cost while blocking authoritative total', async () => {
    const result = await setup({
      directCosts: { P: direct('P', 8, 'partial') }, profiles: { P: financial('P', 2, 1) },
    }).costProduct('P');
    expect(result.status).toBe('partial');
    expect(result.knownFullyLoadedUnitCostSubtotal).toBe(11);
    expect(result.totalFullyLoadedUnitCost).toBeNull();
    expect(result.issues.map((x) => x.code)).toContain('DIRECT_MATERIAL_COST_PARTIAL');
  });

  it('propagates not-ready Material-backed cost', async () => {
    const cup = edge('cup-edge', 'P', 'material', 'cup');
    const result = await setup({
      components: [cup], directCosts: { P: direct('P', 10) }, profiles: { P: financial('P', 2, 1) },
      materialLines: { 'cup-edge': materialLine(cup, null) },
    }).costProduct('P');
    expect(result.status).toBe('partial');
    expect(result.knownFullyLoadedUnitCostSubtotal).toBe(13);
    expect(result.issues.map((x) => x.code)).toContain('MATERIAL_COMPONENT_NOT_READY');
  });

  it('propagates partial Product-backed known cost', async () => {
    const child = edge('child-edge', 'P', 'product', 'Child');
    const result = await setup({
      components: [child], directCosts: { P: direct('P', 10) }, profiles: { P: financial('P', 2, 1) },
      productLines: { 'child-edge': productLine(child, null, 'partial', 7) },
    }).costProduct('P');
    expect(result.status).toBe('partial');
    expect(result.productComponentCostSubtotal).toBe(7);
    expect(result.knownFullyLoadedUnitCostSubtotal).toBe(20);
    expect(result.issues.map((x) => x.code)).toContain('PRODUCT_COMPONENT_PARTIAL');
  });

  it('propagates not-ready Product-backed cost', async () => {
    const child = edge('child-edge', 'P', 'product', 'Child');
    const result = await setup({
      components: [child], directCosts: { P: direct('P', 10) }, profiles: { P: financial('P', 2, 1) },
      productLines: { 'child-edge': productLine(child, null) },
    }).costProduct('P');
    expect(result.status).toBe('partial');
    expect(result.issues.map((x) => x.code)).toContain('PRODUCT_COMPONENT_NOT_READY');
  });

  it('fails closed on duplicate immediate component sources', async () => {
    const a = edge('a', 'P', 'material', 'cup');
    const b = edge('b', 'P', 'material', 'cup');
    const result = await setup({
      components: [a, b], directCosts: { P: direct('P', 10) }, profiles: { P: financial('P', 2, 1) },
    }).costProduct('P');
    expect(result.status).toBe('partial');
    expect(result.componentLines).toHaveLength(0);
    expect(result.issues.map((x) => x.code)).toContain('COMPONENT_GRAPH_INVALID');
  });

  it('orders valid component trace deterministically by source type then source ID', async () => {
    const zProduct = edge('z-product', 'P', 'product', 'Z');
    const bMaterial = edge('b-material', 'P', 'material', 'B');
    const aMaterial = edge('a-material', 'P', 'material', 'A');
    const result = await setup({
      components: [zProduct, bMaterial, aMaterial],
      directCosts: { P: direct('P', 1) }, profiles: { P: financial('P', 0, 0) },
      materialLines: {
        'b-material': materialLine(bMaterial, 1),
        'a-material': materialLine(aMaterial, 1),
      },
      productLines: { 'z-product': productLine(zProduct, 1) },
    }).costProduct('P');
    expect(result.componentLines.map((entry) => entry.line.componentId)).toEqual([
      'a-material', 'b-material', 'z-product',
    ]);
  });

  it('throws typed PRODUCT_NOT_FOUND for a missing root', async () => {
    const service = setup({ products: [] });
    await expect(service.costProduct('missing')).rejects.toMatchObject({
      name: 'FullyLoadedProductUnitCostServiceError', code: 'PRODUCT_NOT_FOUND', productId: 'missing',
    });
  });

  it('keeps archived root Products inspectable', async () => {
    const result = await setup({
      products: [product('P', { isActive: false })], directCosts: { P: direct('P', 10) }, profiles: { P: financial('P', 2, 1) },
    }).costProduct('P');
    expect(result.productIsActive).toBe(false);
    expect(result.status).toBe('ready');
    expect(result.totalFullyLoadedUnitCost).toBe(13);
  });

  it('returns not-ready when no meaningful cost evidence exists', async () => {
    const result = await setup({ directCosts: { P: direct('P', null, 'not-ready', { noRequirements: true }) } }).costProduct('P');
    expect(result.status).toBe('not-ready');
    expect(result.knownFullyLoadedUnitCostSubtotal).toBeNull();
    expect(result.totalFullyLoadedUnitCost).toBeNull();
  });

  it('fails closed on invalid Product-backed known contribution', async () => {
    const child = edge('child-edge', 'P', 'product', 'Child');
    const result = await setup({
      components: [child], directCosts: { P: direct('P', 10) }, profiles: { P: financial('P', 2, 1) },
      productLines: { 'child-edge': productLine(child, null, 'partial', -5) },
    }).costProduct('P');
    expect(result.status).toBe('partial');
    expect(result.issues.map((x) => x.code)).toContain('DERIVED_COST_INVALID');
  });

  it('defensively clones direct and recursive evidence', async () => {
    const child = edge('child-edge', 'P', 'product', 'Child');
    const sourceDirect = direct('P', 10);
    const sourceChild = productLine(child, 5);
    const result = await setup({
      components: [child], directCosts: { P: sourceDirect }, profiles: { P: financial('P', 0, 0) },
      productLines: { 'child-edge': sourceChild },
    }).costProduct('P');

    result.directMaterialCost!.lines[0].issues.push({ code: 'DERIVED_COST_INVALID', message: 'mutated' });
    const childEntry = result.componentLines.find((entry) => entry.sourceType === 'product');
    if (!childEntry || childEntry.sourceType !== 'product') throw new Error('missing Product line');
    (childEntry.line.path as string[]).push('mutated');

    expect(sourceDirect.lines[0].issues).toEqual([]);
    expect(sourceChild.path).toEqual(['p', 'child']);
  });
});
