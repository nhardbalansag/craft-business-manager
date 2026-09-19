import { describe, expect, it } from 'vitest';
import type { Product } from '../../domain/products';
import type { ProductComponent } from '../../domain/productComponents';
import type { ProductFinancialProfile } from '../../domain/productFinancialProfile';
import { InMemoryProductRepository } from '../products/InMemoryProductRepository';
import { InMemoryProductComponentRepository } from '../productComponents/InMemoryProductComponentRepository';
import type { MaterialBackedComponentCostLine } from '../productComponents/MaterialBackedComponentCostService';
import type { WasteAdjustedDirectMaterialCostResult } from './WasteAdjustedDirectMaterialCostService';
import {
  RecursiveFullyLoadedProductComponentCostService,
  type RecursiveMaterialBackedComponentCostProvider,
  type RecursiveProductFinancialProfileProvider,
  type RecursiveWasteAdjustedDirectMaterialCostProvider,
} from './RecursiveFullyLoadedProductComponentCostService';

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

function productComponent(
  id: string,
  parentProductId: string,
  sourceId: string,
  overrides: Partial<ProductComponent> = {},
): ProductComponent {
  return {
    id,
    parentProductId,
    sourceType: 'product',
    sourceId,
    role: 'molded-component',
    quantityPerParent: 1,
    ...overrides,
  };
}

function materialComponent(
  id: string,
  parentProductId: string,
  sourceId: string,
  overrides: Partial<ProductComponent> = {},
): ProductComponent {
  return {
    id,
    parentProductId,
    sourceType: 'material',
    sourceId,
    role: 'vessel',
    quantityPerParent: 1,
    ...overrides,
  };
}

function directCost(
  productId: string,
  pricingCost: number | null,
  options: {
    status?: WasteAdjustedDirectMaterialCostResult['status'];
    baseCost?: number | null;
    reserveCost?: number | null;
    requirementIssueCode?: 'YIELD_HISTORY_NOT_DERIVABLE' | 'FIXED_ITEM_NOT_DERIVABLE' | 'NO_REQUIREMENTS';
  } = {},
): WasteAdjustedDirectMaterialCostResult {
  const status = options.status ?? (pricingCost === null ? 'not-ready' : 'ready');
  const baseCost = options.baseCost ?? pricingCost;
  const reserveCost = options.reserveCost ?? (pricingCost === null ? null : 0);
  const requirementIssueCode = options.requirementIssueCode;
  const hasLine = pricingCost !== null;

  return {
    productId,
    productIsActive: true,
    status,
    planningBasisQuantity: 1,
    safetyWasteRate: reserveCost && baseCost ? reserveCost / baseCost : 0,
    safetyWastePercentage: reserveCost && baseCost ? (reserveCost / baseCost) * 100 : 0,
    safetyWasteMultiplier: reserveCost && baseCost ? 1 + reserveCost / baseCost : 1,
    observedDefectRateIncluded: false,
    baseDirectMaterialCostSubtotal: baseCost,
    safetyWasteReserveCostSubtotal: reserveCost,
    pricingDirectMaterialCostPerUnit: pricingCost,
    lines: hasLine
      ? [
          {
            materialId: `${productId}-material`,
            baseUnit: 'g',
            source: 'fixed',
            status: 'ready',
            effectiveBaseQuantityPerProduct: 1,
            wasteReserveBaseQuantityPerProduct: 0,
            plannedBaseQuantityPerProduct: 1,
            costPerBaseUnit: pricingCost,
            baseDirectMaterialCostPerUnit: baseCost,
            safetyWasteReserveCostPerUnit: reserveCost,
            pricingDirectMaterialCostPerUnit: pricingCost,
            packageCost: pricingCost,
            packageBaseQuantity: 1,
            packageConversionSource: 'standard',
            costingCalibrationId: null,
            requirementContributions: [],
            costContributions: [],
            issues: [],
          },
        ]
      : [],
    requirementIssues: requirementIssueCode
      ? [{ code: requirementIssueCode, message: `${productId} requirement issue.` }]
      : [],
    costIssues: [],
    issues:
      status === 'ready'
        ? []
        : [
            {
              code: status === 'partial' ? 'REQUIREMENT_PARTIAL' : 'REQUIREMENT_NOT_READY',
              message: `${productId} direct material is ${status}.`,
            },
          ],
  };
}

function noDirectCost(productId: string): WasteAdjustedDirectMaterialCostResult {
  const result = directCost(productId, null, {
    status: 'not-ready',
    baseCost: null,
    reserveCost: null,
    requirementIssueCode: 'NO_REQUIREMENTS',
  });
  result.issues.push({
    code: 'COST_NOT_READY',
    message: `${productId} has no direct material cost.`,
  });
  return result;
}

function profile(
  productId: string,
  laborCostPerUnit: number,
  overheadCostPerUnit: number,
  pricingPolicy: ProductFinancialProfile['pricingPolicy'] = null,
): ProductFinancialProfile {
  return {
    productId,
    laborCostPerUnit,
    overheadCostPerUnit,
    pricingPolicy,
  };
}

function materialCostLine(
  component: ProductComponent,
  costPerPc: number | null,
  status: MaterialBackedComponentCostLine['status'] = costPerPc === null ? 'not-ready' : 'ready',
): MaterialBackedComponentCostLine {
  return {
    componentId: component.id,
    parentProductId: component.parentProductId,
    role: component.role,
    sourceMaterialId: component.sourceId,
    sourceMaterialName: `Material ${component.sourceId}`,
    quantityPerParent: component.quantityPerParent,
    status,
    costPerPc,
    componentCostContribution: costPerPc === null ? null : costPerPc * component.quantityPerParent,
    costingTrace: null,
    sourceAvailability: null,
    issues:
      status === 'ready'
        ? []
        : [
            {
              code: 'MATERIAL_COST_NOT_DERIVABLE',
              message: `Material ${component.sourceId} cannot be costed.`,
            },
          ],
  };
}

function setup(options: {
  products?: Product[];
  components?: ProductComponent[];
  directCosts?: Record<string, WasteAdjustedDirectMaterialCostResult>;
  profiles?: Record<string, ProductFinancialProfile | null>;
  materialCosts?: Record<string, { costPerPc: number | null; status?: MaterialBackedComponentCostLine['status'] }>;
} = {}) {
  const products = new InMemoryProductRepository(options.products ?? []);
  const components = new InMemoryProductComponentRepository(options.components ?? []);
  const directById = new Map(
    Object.entries(options.directCosts ?? {}).map(([id, value]) => [id.trim().toLowerCase(), value]),
  );
  const profileById = new Map(
    Object.entries(options.profiles ?? {}).map(([id, value]) => [id.trim().toLowerCase(), value]),
  );
  const materialById = new Map(
    Object.entries(options.materialCosts ?? {}).map(([id, value]) => [id.trim().toLowerCase(), value]),
  );

  const directProvider: RecursiveWasteAdjustedDirectMaterialCostProvider = {
    async costProduct(productId: string) {
      return directById.get(productId.trim().toLowerCase()) ?? noDirectCost(productId);
    },
  };

  const profileProvider: RecursiveProductFinancialProfileProvider = {
    async getProfile(productId: string) {
      return profileById.get(productId.trim().toLowerCase()) ?? null;
    },
  };

  const materialProvider: RecursiveMaterialBackedComponentCostProvider = {
    async costComponent(component: ProductComponent) {
      const configured = materialById.get(component.sourceId.trim().toLowerCase());
      return materialCostLine(
        component,
        configured?.costPerPc ?? null,
        configured?.status ?? (configured?.costPerPc === null || configured === undefined ? 'not-ready' : 'ready'),
      );
    },
  };

  return {
    service: new RecursiveFullyLoadedProductComponentCostService(
      products,
      components,
      directProvider,
      materialProvider,
      profileProvider,
    ),
    products,
    components,
  };
}

describe('RecursiveFullyLoadedProductComponentCostService', () => {
  it('adds child direct material, labor, and overhead into fully loaded production cost', async () => {
    const { service } = setup({
      products: [product('B', { name: 'Handmade Pot' })],
      directCosts: { B: directCost('B', 12) },
      profiles: { B: profile('B', 3, 2) },
    });

    const result = await service.costComponent(productComponent('a-b', 'A', 'B'));

    expect(result).toMatchObject({
      status: 'ready',
      childProductId: 'B',
      childProductName: 'Handmade Pot',
      childDirectMaterialMode: 'costed',
      childMaterialComponentCostSubtotal: 0,
      childProductComponentCostSubtotal: 0,
      childLaborCostPerUnit: 3,
      childOverheadCostPerUnit: 2,
      knownChildProductionCostSubtotal: 17,
      childFullyLoadedUnitCost: 17,
      knownComponentCostContribution: 17,
      componentCostContribution: 17,
      path: ['a', 'b'],
      issues: [],
    });
  });

  it('accepts explicit zero labor/overhead and does not require pricing policy', async () => {
    const { service } = setup({
      products: [product('B')],
      directCosts: { B: directCost('B', 8) },
      profiles: { B: profile('B', 0, 0, null) },
    });

    const result = await service.costComponent(productComponent('a-b', 'A', 'B'));

    expect(result.status).toBe('ready');
    expect(result.childFullyLoadedUnitCost).toBe(8);
    expect(result.childLaborCostPerUnit).toBe(0);
    expect(result.childOverheadCostPerUnit).toBe(0);
  });

  it('multiplies the child fully loaded unit cost by the parent edge quantity', async () => {
    const { service } = setup({
      products: [product('B')],
      directCosts: { B: directCost('B', 7) },
      profiles: { B: profile('B', 2, 1) },
    });

    const result = await service.costComponent(
      productComponent('a-b', 'A', 'B', { quantityPerParent: 4 }),
    );

    expect(result.childFullyLoadedUnitCost).toBe(10);
    expect(result.componentCostContribution).toBe(40);
  });

  it('uses the 4.2A waste-adjusted direct cost exactly once', async () => {
    const wasteAdjusted = directCost('B', 11, { baseCost: 10, reserveCost: 1 });
    const { service } = setup({
      products: [product('B')],
      directCosts: { B: wasteAdjusted },
      profiles: { B: profile('B', 0, 0) },
    });

    const result = await service.costComponent(productComponent('a-b', 'A', 'B'));

    expect(result.childDirectMaterialCost?.baseDirectMaterialCostSubtotal).toBe(10);
    expect(result.childDirectMaterialCost?.safetyWasteReserveCostSubtotal).toBe(1);
    expect(result.childFullyLoadedUnitCost).toBe(11);
  });

  it('adds Material-backed child component cost without applying parent safety waste', async () => {
    const cup = materialComponent('b-cup', 'B', 'cup', { quantityPerParent: 2 });
    const { service } = setup({
      products: [product('B')],
      components: [cup],
      directCosts: { B: directCost('B', 10) },
      profiles: { B: profile('B', 2, 3) },
      materialCosts: { cup: { costPerPc: 3 } },
    });

    const result = await service.costComponent(productComponent('a-b', 'A', 'B'));

    expect(result).toMatchObject({
      status: 'ready',
      childMaterialComponentCostSubtotal: 6,
      childFullyLoadedUnitCost: 21,
      componentCostContribution: 21,
    });
    expect(result.breakdown[0]).toMatchObject({
      sourceType: 'material',
      line: { componentId: 'b-cup', quantityPerParent: 2, componentCostContribution: 6 },
    });
  });

  it('recurses through nested Products with quantity multipliers and each child financial adders', async () => {
    const bToC = productComponent('b-c', 'B', 'C', { quantityPerParent: 2 });
    const { service } = setup({
      products: [product('B'), product('C')],
      components: [bToC],
      directCosts: {
        B: directCost('B', 10),
        C: directCost('C', 4),
      },
      profiles: {
        B: profile('B', 2, 3),
        C: profile('C', 1, 0),
      },
    });

    const result = await service.costComponent(
      productComponent('a-b', 'A', 'B', { quantityPerParent: 3 }),
    );

    expect(result.status).toBe('ready');
    expect(result.childProductComponentCostSubtotal).toBe(10);
    expect(result.childFullyLoadedUnitCost).toBe(25);
    expect(result.componentCostContribution).toBe(75);
    expect(result.breakdown[0]).toMatchObject({
      sourceType: 'product',
      line: {
        childProductId: 'C',
        quantityPerParent: 2,
        childFullyLoadedUnitCost: 5,
        componentCostContribution: 10,
        path: ['a', 'b', 'c'],
      },
    });
  });

  it('ignores child pricing policy when deriving production cost', async () => {
    const base = {
      products: [product('B')],
      directCosts: { B: directCost('B', 10) },
    };
    const withoutPolicy = setup({ ...base, profiles: { B: profile('B', 2, 3, null) } });
    const withPolicy = setup({
      ...base,
      profiles: { B: profile('B', 2, 3, { method: 'profit-amount', value: 9999 }) },
    });

    const edge = productComponent('a-b', 'A', 'B');
    const first = await withoutPolicy.service.costComponent(edge);
    const second = await withPolicy.service.costComponent(edge);

    expect(first.childFullyLoadedUnitCost).toBe(15);
    expect(second.childFullyLoadedUnitCost).toBe(15);
    expect(second.componentCostContribution).toBe(first.componentCostContribution);
  });

  it('fails closed on a missing financial profile while preserving known material subtotal', async () => {
    const { service } = setup({
      products: [product('B')],
      directCosts: { B: directCost('B', 10) },
    });

    const result = await service.costComponent(productComponent('a-b', 'A', 'B'));

    expect(result).toMatchObject({
      status: 'partial',
      knownChildProductionCostSubtotal: 10,
      childFullyLoadedUnitCost: null,
      knownComponentCostContribution: 10,
      componentCostContribution: null,
    });
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'FINANCIAL_PROFILE_MISSING' }),
    );
  });

  it('fails closed on invalid financial cost evidence', async () => {
    const { service } = setup({
      products: [product('B')],
      directCosts: { B: directCost('B', 10) },
      profiles: { B: profile('B', -1, 2) },
    });

    const result = await service.costComponent(productComponent('a-b', 'A', 'B'));

    expect(result.status).toBe('partial');
    expect(result.childFullyLoadedUnitCost).toBeNull();
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'FINANCIAL_PROFILE_COST_INVALID' }),
    );
  });

  it('fails closed when profile Product identity does not match the child', async () => {
    const { service } = setup({
      products: [product('B')],
      directCosts: { B: directCost('B', 10) },
      profiles: { B: profile('OTHER', 1, 1) },
    });

    const result = await service.costComponent(productComponent('a-b', 'A', 'B'));

    expect(result.status).toBe('partial');
    expect(result.childFullyLoadedUnitCost).toBeNull();
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'FINANCIAL_PROFILE_PRODUCT_MISMATCH' }),
    );
  });

  it('treats a true component-only child as neutral zero direct material when components are ready', async () => {
    const cup = materialComponent('b-cup', 'B', 'cup', { quantityPerParent: 2 });
    const { service } = setup({
      products: [product('B')],
      components: [cup],
      directCosts: { B: noDirectCost('B') },
      profiles: { B: profile('B', 1, 2) },
      materialCosts: { cup: { costPerPc: 3 } },
    });

    const result = await service.costComponent(productComponent('a-b', 'A', 'B'));

    expect(result).toMatchObject({
      status: 'ready',
      childDirectMaterialMode: 'neutral-component-only',
      childMaterialComponentCostSubtotal: 6,
      childFullyLoadedUnitCost: 9,
      componentCostContribution: 9,
    });
  });

  it('does not neutralize NO_REQUIREMENTS when the child has no components', async () => {
    const { service } = setup({
      products: [product('B')],
      directCosts: { B: noDirectCost('B') },
      profiles: { B: profile('B', 1, 2) },
    });

    const result = await service.costComponent(productComponent('a-b', 'A', 'B'));

    expect(result.status).toBe('partial');
    expect(result.childDirectMaterialMode).toBe('unresolved');
    expect(result.knownChildProductionCostSubtotal).toBe(3);
    expect(result.childFullyLoadedUnitCost).toBeNull();
  });

  it('does not neutralize broken partial direct-material evidence', async () => {
    const cup = materialComponent('b-cup', 'B', 'cup');
    const broken = directCost('B', 5, {
      status: 'partial',
      requirementIssueCode: 'FIXED_ITEM_NOT_DERIVABLE',
    });
    const { service } = setup({
      products: [product('B')],
      components: [cup],
      directCosts: { B: broken },
      profiles: { B: profile('B', 1, 1) },
      materialCosts: { cup: { costPerPc: 2 } },
    });

    const result = await service.costComponent(productComponent('a-b', 'A', 'B'));

    expect(result.status).toBe('partial');
    expect(result.childDirectMaterialMode).toBe('costed');
    expect(result.knownChildProductionCostSubtotal).toBe(9);
    expect(result.childFullyLoadedUnitCost).toBeNull();
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'DIRECT_MATERIAL_COST_PARTIAL' }),
    );
  });

  it('propagates an unresolved Material-backed component without publishing a fully loaded total', async () => {
    const cup = materialComponent('b-cup', 'B', 'cup');
    const { service } = setup({
      products: [product('B')],
      components: [cup],
      directCosts: { B: directCost('B', 10) },
      profiles: { B: profile('B', 1, 1) },
      materialCosts: { cup: { costPerPc: null } },
    });

    const result = await service.costComponent(productComponent('a-b', 'A', 'B'));

    expect(result.status).toBe('partial');
    expect(result.knownChildProductionCostSubtotal).toBe(12);
    expect(result.childFullyLoadedUnitCost).toBeNull();
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'MATERIAL_COMPONENT_NOT_READY' }),
    );
  });

  it('propagates a nested Product child with a missing profile as partial', async () => {
    const bToC = productComponent('b-c', 'B', 'C');
    const { service } = setup({
      products: [product('B'), product('C')],
      components: [bToC],
      directCosts: { B: directCost('B', 10), C: directCost('C', 4) },
      profiles: { B: profile('B', 1, 1), C: null },
    });

    const result = await service.costComponent(productComponent('a-b', 'A', 'B'));

    expect(result.status).toBe('partial');
    expect(result.childProductComponentCostSubtotal).toBe(4);
    expect(result.knownChildProductionCostSubtotal).toBe(16);
    expect(result.childFullyLoadedUnitCost).toBeNull();
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'NESTED_PRODUCT_COMPONENT_PARTIAL' }),
    );
  });

  it('returns not-ready when the child Product is missing', async () => {
    const { service } = setup();
    const result = await service.costComponent(productComponent('a-b', 'A', 'B'));

    expect(result.status).toBe('not-ready');
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'SOURCE_PRODUCT_NOT_FOUND' }),
    );
  });

  it('returns not-ready when the child Product is inactive', async () => {
    const { service } = setup({ products: [product('B', { isActive: false })] });
    const result = await service.costComponent(productComponent('a-b', 'A', 'B'));

    expect(result.status).toBe('not-ready');
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'SOURCE_PRODUCT_INACTIVE' }),
    );
  });

  it('rejects a non-Product-backed root component', async () => {
    const { service } = setup();
    const result = await service.costComponent(materialComponent('a-cup', 'A', 'cup'));

    expect(result.status).toBe('not-ready');
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'NOT_PRODUCT_BACKED_COMPONENT' }),
    );
  });

  it('detects a direct self-cycle deterministically', async () => {
    const { service } = setup({ products: [product('A')] });
    const result = await service.costComponent(productComponent('a-a', 'A', 'A'));

    expect(result.status).toBe('not-ready');
    expect(result.path).toEqual(['a', 'a']);
    expect(result.issues[0]).toMatchObject({
      code: 'CYCLE_DETECTED',
      cyclePath: ['a', 'a'],
    });
  });

  it('detects a transitive cycle and preserves a deterministic nested cycle path', async () => {
    const bToC = productComponent('b-c', 'B', 'C');
    const cToB = productComponent('c-b', 'C', 'B');
    const { service } = setup({
      products: [product('B'), product('C')],
      components: [cToB, bToC],
      directCosts: { B: directCost('B', 2), C: directCost('C', 3) },
      profiles: { B: profile('B', 0, 0), C: profile('C', 0, 0) },
    });

    const result = await service.costComponent(productComponent('a-b', 'A', 'B'));

    expect(result.status).toBe('partial');
    const bToCLine = result.breakdown[0];
    expect(bToCLine?.sourceType).toBe('product');
    if (bToCLine?.sourceType !== 'product') throw new Error('Expected nested Product line.');
    const cycleLine = bToCLine.line.breakdown[0];
    expect(cycleLine?.sourceType).toBe('product');
    if (cycleLine?.sourceType !== 'product') throw new Error('Expected cycle Product line.');
    expect(cycleLine.line.issues[0]).toMatchObject({
      code: 'CYCLE_DETECTED',
      cyclePath: ['b', 'c', 'b'],
    });
  });

  it('fails the child graph closed when duplicate immediate component sources are present', async () => {
    const first = materialComponent('b-cup-1', 'B', 'cup');
    const second = materialComponent('b-cup-2', 'B', 'cup');
    const { service } = setup({
      products: [product('B')],
      components: [first, second],
      directCosts: { B: directCost('B', 10) },
      profiles: { B: profile('B', 1, 1) },
      materialCosts: { cup: { costPerPc: 2 } },
    });

    const result = await service.costComponent(productComponent('a-b', 'A', 'B'));

    expect(result.status).toBe('partial');
    expect(result.breakdown).toEqual([]);
    expect(result.childFullyLoadedUnitCost).toBeNull();
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'COMPONENT_GRAPH_INVALID' }),
    );
  });

  it('traverses immediate child components deterministically by source type and source ID', async () => {
    const z = materialComponent('b-z', 'B', 'z-material');
    const a = materialComponent('b-a', 'B', 'a-material');
    const { service } = setup({
      products: [product('B')],
      components: [z, a],
      directCosts: { B: noDirectCost('B') },
      profiles: { B: profile('B', 0, 0) },
      materialCosts: {
        'z-material': { costPerPc: 1 },
        'a-material': { costPerPc: 1 },
      },
    });

    const result = await service.costComponent(productComponent('a-b', 'A', 'B'));

    expect(result.status).toBe('ready');
    expect(result.breakdown.map((entry) => entry.line.componentId)).toEqual(['b-a', 'b-z']);
  });

  it('preserves known partial direct cost without publishing an authoritative child total', async () => {
    const partial = directCost('B', 8, {
      status: 'partial',
      requirementIssueCode: 'YIELD_HISTORY_NOT_DERIVABLE',
    });
    const { service } = setup({
      products: [product('B')],
      directCosts: { B: partial },
      profiles: { B: profile('B', 2, 1) },
    });

    const result = await service.costComponent(productComponent('a-b', 'A', 'B'));

    expect(result.status).toBe('partial');
    expect(result.knownChildProductionCostSubtotal).toBe(11);
    expect(result.knownComponentCostContribution).toBe(11);
    expect(result.childFullyLoadedUnitCost).toBeNull();
    expect(result.componentCostContribution).toBeNull();
  });
});
