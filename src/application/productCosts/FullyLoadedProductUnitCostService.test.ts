import { describe, expect, it } from 'vitest';
import type { Product } from '../../domain/products';
import type { ProductComponent } from '../../domain/productComponents';
import type { ProductFinancialProfile } from '../../domain/productFinancialProfile';
import { InMemoryProductRepository } from '../products/InMemoryProductRepository';
import { InMemoryProductComponentRepository } from '../productComponents/InMemoryProductComponentRepository';
import type { MaterialBackedComponentCostLine } from '../productComponents/MaterialBackedComponentCostService';
import type {
  RecursiveFullyLoadedProductComponentCostLine,
} from './RecursiveFullyLoadedProductComponentCostService';
import type { WasteAdjustedDirectMaterialCostResult } from './WasteAdjustedDirectMaterialCostService';
import {
  FullyLoadedProductUnitCostService,
  FullyLoadedProductUnitCostServiceError,
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

function component(
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

function directCost(
  productId: string,
  cost: number | null,
  status: WasteAdjustedDirectMaterialCostResult['status'] = cost === null ? 'not-ready' : 'ready',
  options: {
    baseCost?: number | null;
    wasteCost?: number | null;
    noRequirements?: boolean;
    issueCode?: 'REQUIREMENT_PARTIAL' | 'REQUIREMENT_NOT_READY' | 'COST_PARTIAL' | 'COST_NOT_READY';
  } = {},
): WasteAdjustedDirectMaterialCostResult {
  const noRequirements = options.noRequirements ?? false;
  const baseCost = options.baseCost ?? cost;
  const wasteCost = options.wasteCost ?? (cost === null || baseCost === null ? null : cost - baseCost);
  return {
    productId,
    productIsActive: true,
    status,
    planningBasisQuantity: 1,
    safetyWasteRate: 0,
    safetyWastePercentage: 0,
    safetyWasteMultiplier: 1,
    observedDefectRateIncluded: false,
    baseDirectMaterialCostSubtotal: baseCost,
    safetyWasteReserveCostSubtotal: wasteCost,
    pricingDirectMaterialCostPerUnit: cost,
    lines:
      cost === null || noRequirements
        ? []
        : [
            {
              materialId: `${productId}-material`,
              baseUnit: 'g',
              source: 'fixed',
              status: 'ready',
              effectiveBaseQuantityPerProduct: 1,
              wasteReserveBaseQuantityPerProduct: 0,
              plannedBaseQuantityPerProduct: 1,
              costPerBaseUnit: cost,
              baseDirectMaterialCostPerUnit: baseCost,
              safetyWasteReserveCostPerUnit: wasteCost,
              pricingDirectMaterialCostPerUnit: cost,
              packageCost: cost,
              packageBaseQuantity: 1,
              packageConversionSource: 'standard',
              costingCalibrationId: null,
              requirementContributions: [],
              costContributions: [],
              issues: [],
            },
          ],
    requirementIssues: noRequirements
      ? [{ code: 'NO_REQUIREMENTS', message: `${productId} has no direct requirements.` }]
      : [],
    costIssues: [],
    issues: options.issueCode
      ? [{ code: options.issueCode, message: `${productId} direct cost is ${status}.` }]
      : noRequirements
        ? [
            { code: 'REQUIREMENT_NOT_READY', message: `${productId} has no direct requirements.` },
            { code: 'COST_NOT_READY', message: `${productId} has no direct cost.` },
          ]
        : status === 'partial'
          ? [{ code: 'REQUIREMENT_PARTIAL', message: `${productId} direct cost is partial.` }]
          : [],
  };
}

function profile(
  productId: string,
  laborCostPerUnit: number,
  overheadCostPerUnit: number,
  pricingPolicy: ProductFinancialProfile['pricingPolicy'] = null,
): ProductFinancialProfile {
  return { productId, laborCostPerUnit, overheadCostPerUnit, pricingPolicy };
}

function materialLine(
  edge: ProductComponent,
  contribution: number | null,
  status: MaterialBackedComponentCostLine['status'] = contribution === null ? 'not-ready' : 'ready',
): MaterialBackedComponentCostLine {
  return {
    componentId: edge.id,
    parentProductId: edge.parentProductId,
    role: edge.role,
    sourceMaterialId: edge.sourceId,
    sourceMaterialName: `Material ${edge.sourceId}`,
    quantityPerParent: edge.quantityPerParent,
    status,
    costPerPc: contribution === null ? null : contribution / edge.quantityPerParent,
    componentCostContribution: contribution,
    costingTrace: null,
    sourceAvailability: null,
    issues:
      status === 'ready'
        ? []
        : [{ code: 'MATERIAL_COST_NOT_DERIVABLE', message: `${edge.sourceId} is not ready.` }],
  };
}

function productLine(
  edge: ProductComponent,
  contribution: number | null,
  status: RecursiveFullyLoadedProductComponentCostLine['status'] = contribution === null
    ? 'not-ready'
    : 'ready',
  knownContribution: number | null = contribution,
): RecursiveFullyLoadedProductComponentCostLine {
  const unitCost = contribution === null ? null : contribution / edge.quantityPerParent;
  const knownUnitCost = knownContribution === null ? null : knownContribution / edge.quantityPerParent;
  return {
    componentId: edge.id,
    parentProductId: edge.parentProductId,
    role: edge.role,
    childProductId: edge.sourceId,
    childProductName: `Product ${edge.sourceId}`,
    quantityPerParent: edge.quantityPerParent,
    path: [edge.parentProductId.toLowerCase(), edge.sourceId.toLowerCase()],
    status,
    childDirectMaterialCost: null,
    childDirectMaterialMode: 'costed',
    childMaterialComponentCostSubtotal: 0,
    childProductComponentCostSubtotal: 0,
    childLaborCostPerUnit: 0,
    childOverheadCostPerUnit: 0,
    knownChildProductionCostSubtotal: knownUnitCost,
    childFullyLoadedUnitCost: status === 'ready' ? unitCost : null,
    knownComponentCostContribution: knownContribution,
    componentCostContribution: status === 'ready' ? contribution : null,
    breakdown: [],
    issues:
      status === 'ready'
        ? []
        : [
            {
              code:
                status === 'partial'
                  ? 'DIRECT_MATERIAL_COST_PARTIAL'
                  : 'DIRECT_MATERIAL_COST_NOT_READY',
              message: `${edge.sourceId} recursive cost is ${status}.`,
              componentId: edge.id,
              productId: edge.sourceId,
              path: [edge.parentProductId.toLowerCase(), edge.sourceId.toLowerCase()],
            },
          ],
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
  const directById = new Map(
    Object.entries(options.directCosts ?? {}).map(([id, value]) => [id.trim().toLowerCase(), value]),
  );
  const profilesById = new Map(
    Object.entries(options.profiles ?? {}).map(([id, value]) => [id.trim().toLowerCase(), value]),
  );
  const materialById = new Map(
    Object.entries(options.materialLines ?? {}).map(([id, value]) => [id.trim().toLowerCase(), value]),
  );
  const productById = new Map(
    Object.entries(options.productLines ?? {}).map(([id, value]) => [id.trim().toLowerCase(), value]),
  );

  const directProvider: FullyLoadedDirectMaterialCostProvider = {
    async costProduct(productId: string) {
      return (
        directById.get(productId.trim().toLowerCase()) ??
        directCost(productId, null, 'not-ready', { noRequirements: true })
      );
    },
  };

  const materialProvider: FullyLoadedMaterialComponentCostProvider = {
    async costComponent(edge: ProductComponent) {
      return materialById.get(edge.id.trim().toLowerCase()) ?? materialLine(edge, null);
    },
  };

  const productProvider: FullyLoadedProductComponentCostProvider = {
    async costComponent(edge: ProductComponent) {
      return productById.get(edge.id.trim().toLowerCase()) ?? productLine(edge, null);
    },
  };

  const financialProvider: FullyLoadedProductFinancialProfileProvider = {
    async getProfile(productId: string) {
      return profilesById.get(productId.trim().toLowerCase()) ?? null;
    },
  };

  return {
    service: new FullyLoadedProductUnitCostService(
      products,
      components,
      directProvider,
      materialProvider,
      productProvider,
      financialProvider,
    ),
    products,
    components,
  };
}

describe('FullyLoadedProductUnitCostService', () => {
  it('synthesizes ready direct material + labor + overhead cost', async () => {
    const { service } = setup({
      directCosts: { P: directCost('P', 20) },
      profiles: { P: profile('P', 5, 3) },
    });

    const result = await service.costProduct('P');

    expect(result).toMatchObject({
      status: 'ready',
      directMaterialMode: 'costed',
      directMaterialCostSubtotal: 20,
      materialComponentCostSubtotal: 0,
      productComponentCostSubtotal: 0,
      inputMaterialComponentSubtotal: 20,
      laborCostPerUnit: 5,
      overheadCostPerUnit: 3,
      knownFullyLoadedUnitCostSubtotal: 28,
      totalFullyLoadedUnitCost: 28,
      issues: [],
    });
  });

  it('accepts explicit zero labor and overhead as known cost evidence', async () => {
    const { service } = setup({
      directCosts: { P: directCost('P', 12) },
      profiles: { P: profile('P', 0, 0) },
    });

    const result = await service.costProduct('P');
    expect(result.status).toBe('ready');
    expect(result.totalFullyLoadedUnitCost).toBe(12);
  });

  it('includes the 4.2A safety-waste-adjusted direct cost exactly once', async () => {
    const { service } = setup({
      directCosts: { P: directCost('P', 12, 'ready', { baseCost: 10, wasteCost: 2 }) },
      profiles: { P: profile('P', 0, 0) },
    });

    const result = await service.costProduct('P');
    expect(result.directMaterialCost?.baseDirectMaterialCostSubtotal).toBe(10);
    expect(result.directMaterialCost?.safetyWasteReserveCostSubtotal).toBe(2);
    expect(result.totalFullyLoadedUnitCost).toBe(12);
  });

  it('adds ready Material-backed component contribution', async () => {
    const cup = component('cup-edge', 'P', 'material', 'cup', { quantityPerParent: 2 });
    const { service } = setup({
      components: [cup],
      directCosts: { P: directCost('P', 10) },
      profiles: { P: profile('P', 2, 1) },
      materialLines: { 'cup-edge': materialLine(cup, 8) },
    });

    const result = await service.costProduct('P');
    expect(result).toMatchObject({
      status: 'ready',
      directMaterialCostSubtotal: 10,
      materialComponentCostSubtotal: 8,
      inputMaterialComponentSubtotal: 18,
      totalFullyLoadedUnitCost: 21,
    });
  });

  it('adds ready Product-backed 4.2B fully loaded contribution', async () => {
    const child = component('child-edge', 'P', 'product', 'Child', { quantityPerParent: 3 });
    const { service } = setup({
      components: [child],
      directCosts: { P: directCost('P', 10) },
      profiles: { P: profile('P', 2, 1) },
      productLines: { 'child-edge': productLine(child, 18) },
    });

    const result = await service.costProduct('P');
    expect(result.productComponentCostSubtotal).toBe(18);
    expect(result.inputMaterialComponentSubtotal).toBe(28);
    expect(result.totalFullyLoadedUnitCost).toBe(31);
  });

  it('synthesizes mixed direct, Material-backed, Product-backed, labor, and overhead cost', async () => {
    const cup = component('cup-edge', 'P', 'material', 'cup');
    const child = component('child-edge', 'P', 'product', 'Child', { quantityPerParent: 2 });
    const { service } = setup({
      components: [child, cup],
      directCosts: { P: directCost('P', 25) },
      profiles: { P: profile('P', 7, 4) },
      materialLines: { 'cup-edge': materialLine(cup, 9) },
      productLines: { 'child-edge': productLine(child, 16) },
    });

    const result = await service.costProduct('P');
    expect(result).toMatchObject({
      directMaterialCostSubtotal: 25,
      materialComponentCostSubtotal: 9,
      productComponentCostSubtotal: 16,
      inputMaterialComponentSubtotal: 50,
      laborCostPerUnit: 7,
      overheadCostPerUnit: 4,
      totalFullyLoadedUnitCost: 61,
      status: 'ready',
    });
  });

  it('treats genuine component-only root Products as neutral direct-material zero', async () => {
    const child = component('child-edge', 'P', 'product', 'Child');
    const { service } = setup({
      components: [child],
      directCosts: { P: directCost('P', null, 'not-ready', { noRequirements: true }) },
      profiles: { P: profile('P', 2, 1) },
      productLines: { 'child-edge': productLine(child, 10) },
    });

    const result = await service.costProduct('P');
    expect(result).toMatchObject({
      status: 'ready',
      directMaterialMode: 'neutral-component-only',
      directMaterialCostSubtotal: 0,
      productComponentCostSubtotal: 10,
      totalFullyLoadedUnitCost: 13,
    });
  });

  it('does not neutralize a Product with no direct materials and no components', async () => {
    const { service } = setup({
      directCosts: { P: directCost('P', null, 'not-ready', { noRequirements: true }) },
      profiles: { P: profile('P', 2, 1) },
    });

    const result = await service.costProduct('P');
    expect(result.status).toBe('partial');
    expect(result.directMaterialMode).toBe('unresolved');
    expect(result.knownFullyLoadedUnitCostSubtotal).toBe(3);
    expect(result.totalFullyLoadedUnitCost).toBeNull();
    expect(result.issues.map((issue) => issue.code)).toContain('DIRECT_MATERIAL_COST_NOT_READY');
  });

  it('preserves known production-input subtotal when the financial profile is missing', async () => {
    const { service } = setup({ directCosts: { P: directCost('P', 20) } });

    const result = await service.costProduct('P');
    expect(result.status).toBe('partial');
    expect(result.knownFullyLoadedUnitCostSubtotal).toBe(20);
    expect(result.totalFullyLoadedUnitCost).toBeNull();
    expect(result.issues.map((issue) => issue.code)).toContain('FINANCIAL_PROFILE_MISSING');
  });

  it('fails closed for a mismatched financial profile while preserving known material cost', async () => {
    const { service } = setup({
      directCosts: { P: directCost('P', 20) },
      profiles: { P: profile('Other', 5, 3) },
    });

    const result = await service.costProduct('P');
    expect(result.status).toBe('partial');
    expect(result.knownFullyLoadedUnitCostSubtotal).toBe(20);
    expect(result.totalFullyLoadedUnitCost).toBeNull();
    expect(result.issues.map((issue) => issue.code)).toContain('FINANCIAL_PROFILE_PRODUCT_MISMATCH');
  });

  it('fails closed for invalid labor or overhead cost', async () => {
    const { service } = setup({
      directCosts: { P: directCost('P', 20) },
      profiles: { P: profile('P', -1, 3) },
    });

    const result = await service.costProduct('P');
    expect(result.status).toBe('partial');
    expect(result.totalFullyLoadedUnitCost).toBeNull();
    expect(result.issues.map((issue) => issue.code)).toContain('FINANCIAL_PROFILE_COST_INVALID');
  });

  it('allows pricingPolicy null without blocking cost readiness', async () => {
    const { service } = setup({
      directCosts: { P: directCost('P', 10) },
      profiles: { P: profile('P', 2, 1, null) },
    });

    const result = await service.costProduct('P');
    expect(result.status).toBe('ready');
    expect(result.totalFullyLoadedUnitCost).toBe(13);
  });

  it('does not change fully loaded cost when only pricing policy changes', async () => {
    const base = {
      directCosts: { P: directCost('P', 10) },
    };
    const first = setup({
      ...base,
      profiles: { P: profile('P', 2, 1, { method: 'markup-percent', value: 0.5 }) },
    });
    const second = setup({
      ...base,
      profiles: { P: profile('P', 2, 1, { method: 'profit-amount', value: 999 }) },
    });

    expect((await first.service.costProduct('P')).totalFullyLoadedUnitCost).toBe(13);
    expect((await second.service.costProduct('P')).totalFullyLoadedUnitCost).toBe(13);
  });

  it('preserves partial direct-material evidence but blocks authoritative total', async () => {
    const { service } = setup({
      directCosts: { P: directCost('P', 8, 'partial') },
      profiles: { P: profile('P', 2, 1) },
    });

    const result = await service.costProduct('P');
    expect(result.status).toBe('partial');
    expect(result.knownFullyLoadedUnitCostSubtotal).toBe(11);
    expect(result.totalFullyLoadedUnitCost).toBeNull();
    expect(result.issues.map((issue) => issue.code)).toContain('DIRECT_MATERIAL_COST_PARTIAL');
  });

  it('propagates unresolved Material-backed component cost', async () => {
    const cup = component('cup-edge', 'P', 'material', 'cup');
    const { service } = setup({
      components: [cup],
      directCosts: { P: directCost('P', 10) },
      profiles: { P: profile('P', 2, 1) },
      materialLines: { 'cup-edge': materialLine(cup, null) },
    });

    const result = await service.costProduct('P');
    expect(result.status).toBe('partial');
    expect(result.knownFullyLoadedUnitCostSubtotal).toBe(13);
    expect(result.totalFullyLoadedUnitCost).toBeNull();
    expect(result.issues.map((issue) => issue.code)).toContain('MATERIAL_COMPONENT_NOT_READY');
  });

  it('propagates partial Product-backed cost while retaining its known subtotal', async () => {
    const child = component('child-edge', 'P', 'product', 'Child');
    const { service } = setup({
      components: [child],
      directCosts: { P: directCost('P', 10) },
      profiles: { P: profile('P', 2, 1) },
      productLines: { 'child-edge': productLine(child, null, 'partial', 7) },
    });

    const result = await service.costProduct('P');
    expect(result.status).toBe('partial');
    expect(result.productComponentCostSubtotal).toBe(7);
    expect(result.knownFullyLoadedUnitCostSubtotal).toBe(20);
    expect(result.totalFullyLoadedUnitCost).toBeNull();
    expect(result.issues.map((issue) => issue.code)).toContain('PRODUCT_COMPONENT_PARTIAL');
  });

  it('propagates not-ready Product-backed cost', async () => {
    const child = component('child-edge', 'P', 'product', 'Child');
    const { service } = setup({
      components: [child],
      directCosts: { P: directCost('P', 10) },
      profiles: { P: profile('P', 2, 1) },
      productLines: { 'child-edge': productLine(child, null, 'not-ready', null) },
    });

    const result = await service.costProduct('P');
    expect(result.status).toBe('partial');
    expect(result.totalFullyLoadedUnitCost).toBeNull();
    expect(result.issues.map((issue) => issue.code)).toContain('PRODUCT_COMPONENT_NOT_READY');
  });

  it('fails closed on duplicate immediate component source corruption', async () => {
    const a = component('a', 'P', 'material', 'cup');
    const b = component('b', 'P', 'material', 'cup');
    const { service } = setup({
      components: [a, b],
      directCosts: { P: directCost('P', 10) },
      profiles: { P: profile('P', 2, 1) },
      materialLines: { a: materialLine(a, 3), b: materialLine(b, 3) },
    });

    const result = await service.costProduct('P');
    expect(result.status).toBe('partial');
    expect(result.componentLines).toHaveLength(0);
    expect(result.totalFullyLoadedUnitCost).toBeNull();
    expect(result.issues.map((issue) => issue.code)).toContain('COMPONENT_GRAPH_INVALID');
  });

  it('orders component trace deterministically by source type, source ID, then component ID', async () => {
    const zProduct = component('z-edge', 'P', 'product', 'Z');
    const bMaterial = component('b-edge', 'P', 'material', 'B');
    const aMaterial2 = component('z-a', 'P', 'material', 'A');
    const aMaterial1 = component('a-a', 'P', 'material', 'A');
    const { service } = setup({
      components: [zProduct, bMaterial, aMaterial2, aMaterial1],
      directCosts: { P: directCost('P', 1) },
      profiles: { P: profile('P', 0, 0) },
      materialLines: {
        'b-edge': materialLine(bMaterial, 1),
        'z-a': materialLine(aMaterial2, 1),
        'a-a': materialLine(aMaterial1, 1),
      },
      productLines: { 'z-edge': productLine(zProduct, 1) },
    });

    const result = await service.costProduct('P');
    expect(result.componentLines.map((entry) => entry.line.componentId)).toEqual([
      'a-a',
      'z-a',
      'b-edge',
      'z-edge',
    ]);
  });

  it('throws a typed error when root Product does not exist', async () => {
    const { service } = setup({ products: [] });

    await expect(service.costProduct('missing')).rejects.toMatchObject({
      name: 'FullyLoadedProductUnitCostServiceError',
      code: 'PRODUCT_NOT_FOUND',
      productId: 'missing',
    } satisfies Partial<FullyLoadedProductUnitCostServiceError>);
  });

  it('keeps archived root Products inspectable', async () => {
    const { service } = setup({
      products: [product('P', { isActive: false })],
      directCosts: { P: directCost('P', 10) },
      profiles: { P: profile('P', 2, 1) },
    });

    const result = await service.costProduct('P');
    expect(result.productIsActive).toBe(false);
    expect(result.status).toBe('ready');
    expect(result.totalFullyLoadedUnitCost).toBe(13);
  });

  it('returns not-ready when no meaningful cost evidence exists', async () => {
    const { service } = setup({
      directCosts: { P: directCost('P', null, 'not-ready', { noRequirements: true }) },
    });

    const result = await service.costProduct('P');
    expect(result.status).toBe('not-ready');
    expect(result.knownFullyLoadedUnitCostSubtotal).toBeNull();
    expect(result.totalFullyLoadedUnitCost).toBeNull();
  });

  it('fails closed on invalid Product-backed known contribution', async () => {
    const child = component('child-edge', 'P', 'product', 'Child');
    const invalid = productLine(child, null, 'partial', -5);
    const { service } = setup({
      components: [child],
      directCosts: { P: directCost('P', 10) },
      profiles: { P: profile('P', 2, 1) },
      productLines: { 'child-edge': invalid },
    });

    const result = await service.costProduct('P');
    expect(result.status).toBe('partial');
    expect(result.totalFullyLoadedUnitCost).toBeNull();
    expect(result.issues.map((issue) => issue.code)).toContain('DERIVED_COST_INVALID');
  });

  it('defensively clones returned direct and recursive evidence', async () => {
    const child = component('child-edge', 'P', 'product', 'Child');
    const direct = directCost('P', 10);
    const recursive = productLine(child, 5);
    recursive.path = ['p', 'child'];
    const { service } = setup({
      components: [child],
      directCosts: { P: direct },
      profiles: { P: profile('P', 0, 0) },
      productLines: { 'child-edge': recursive },
    });

    const result = await service.costProduct('P');
    result.directMaterialCost!.lines[0].issues.push({
      code: 'DERIVED_COST_INVALID',
      message: 'mutated',
    });
    const productEntry = result.componentLines.find((entry) => entry.sourceType === 'product');
    if (!productEntry || productEntry.sourceType !== 'product') throw new Error('missing Product line');
    (productEntry.line.path as string[]).push('mutated');

    expect(direct.lines[0].issues).toEqual([]);
    expect(recursive.path).toEqual(['p', 'child']);
  });
});
