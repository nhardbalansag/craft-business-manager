import { describe, expect, it } from 'vitest';
import type { Product } from '../../domain/products';
import type { ProductComponent } from '../../domain/productComponents';
import type { RecipeMaterialCostPreviewResult } from '../recipeCosts/RecipeMaterialCostPreviewService';
import { InMemoryProductRepository } from '../products/InMemoryProductRepository';
import { InMemoryProductComponentRepository } from './InMemoryProductComponentRepository';
import type { MaterialBackedComponentCostLine } from './MaterialBackedComponentCostService';
import {
  ProductBackedComponentCostService,
  type MaterialBackedComponentCostProvider,
  type ProductDirectMaterialCostProvider,
} from './ProductBackedComponentCostService';

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

function directPreview(
  productId: string,
  total: number,
  status: RecipeMaterialCostPreviewResult['status'] = 'ready',
  options: { withLine?: boolean } = {},
): RecipeMaterialCostPreviewResult {
  const withLine = options.withLine ?? status !== 'not-ready';
  return {
    productId,
    productIsActive: true,
    status,
    requirementStatus: status,
    effectiveYieldSampleId: null,
    skippedInvalidYieldSampleIds: [],
    lines: withLine
      ? [
          {
            materialId: `${productId}-material`,
            baseUnit: 'pc',
            baseQuantityPerProduct: 1,
            source: 'fixed',
            costPerBaseUnit: total,
            materialCostPerProduct: total,
            packageCost: total,
            packageBaseQuantity: 1,
            packageConversionSource: 'standard',
            costingCalibrationId: null,
            contributions: [],
          },
        ]
      : [],
    totalMaterialCostPerProduct: total,
    requirementIssues:
      status === 'ready'
        ? []
        : [
            {
              code: status === 'partial' ? 'YIELD_HISTORY_NOT_DERIVABLE' : 'NO_REQUIREMENTS',
              message: `${productId} direct-material cost is ${status}.`,
            },
          ],
    costIssues: [],
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
  directCosts?: Record<string, RecipeMaterialCostPreviewResult>;
  materialCosts?: Record<string, { costPerPc: number | null; status?: MaterialBackedComponentCostLine['status'] }>;
} = {}) {
  const products = new InMemoryProductRepository(options.products ?? []);
  const components = new InMemoryProductComponentRepository(options.components ?? []);
  const directCostsById = new Map(
    Object.entries(options.directCosts ?? {}).map(([id, preview]) => [id.trim().toLowerCase(), preview]),
  );
  const materialCostsById = new Map(
    Object.entries(options.materialCosts ?? {}).map(([id, cost]) => [id.trim().toLowerCase(), cost]),
  );

  const directMaterialCosts: ProductDirectMaterialCostProvider = {
    async previewForProduct(productId: string) {
      return directCostsById.get(productId.trim().toLowerCase()) ?? directPreview(productId, 0, 'not-ready');
    },
  };

  const materialComponentCosts: MaterialBackedComponentCostProvider = {
    async costComponent(component: ProductComponent) {
      const configured = materialCostsById.get(component.sourceId.trim().toLowerCase());
      return materialCostLine(
        component,
        configured?.costPerPc ?? null,
        configured?.status ?? (configured?.costPerPc === null || configured === undefined ? 'not-ready' : 'ready'),
      );
    },
  };

  return {
    service: new ProductBackedComponentCostService(
      products,
      components,
      directMaterialCosts,
      materialComponentCosts,
    ),
    products,
    components,
  };
}

describe('ProductBackedComponentCostService', () => {
  it('derives a Product-backed child from ready Phase 2 direct-material cost', async () => {
    const edge = productComponent('a-b', 'A', 'B');
    const { service } = setup({
      products: [product('B', { name: 'Child B' })],
      directCosts: { B: directPreview('B', 12) },
    });

    const result = await service.costComponent(edge);

    expect(result).toMatchObject({
      status: 'ready',
      childProductId: 'B',
      childProductName: 'Child B',
      quantityPerParent: 1,
      path: ['a', 'b'],
      childComponentCostSubtotal: 0,
      childComponentAwareUnitCost: 12,
      componentCostContribution: 12,
      issues: [],
    });
    expect(result.childDirectMaterialCost?.totalMaterialCostPerProduct).toBe(12);
  });

  it('multiplies the recursively derived child unit cost by the parent edge quantity', async () => {
    const { service } = setup({
      products: [product('B')],
      directCosts: { B: directPreview('B', 7) },
    });

    const result = await service.costComponent(
      productComponent('a-b', 'A', 'B', { quantityPerParent: 4 }),
    );

    expect(result.childComponentAwareUnitCost).toBe(7);
    expect(result.componentCostContribution).toBe(28);
  });

  it('preserves canonical child Product identity, name, and canonical path', async () => {
    const { service } = setup({
      products: [product('Child-B', { name: 'Handmade Insert' })],
      directCosts: { 'Child-B': directPreview('Child-B', 5) },
    });

    const result = await service.costComponent(productComponent('edge', ' Parent-A ', ' child-b '));

    expect(result).toMatchObject({
      childProductId: 'Child-B',
      childProductName: 'Handmade Insert',
      path: ['parent-a', 'child-b'],
    });
  });

  it('adds a 3.3A material-backed child component to the child Product unit cost', async () => {
    const materialEdge = materialComponent('b-cup', 'B', 'cup', { quantityPerParent: 2 });
    const { service } = setup({
      products: [product('B')],
      components: [materialEdge],
      directCosts: { B: directPreview('B', 10) },
      materialCosts: { cup: { costPerPc: 3 } },
    });

    const result = await service.costComponent(productComponent('a-b', 'A', 'B'));

    expect(result).toMatchObject({
      status: 'ready',
      childComponentCostSubtotal: 6,
      childComponentAwareUnitCost: 16,
      componentCostContribution: 16,
    });
    expect(result.breakdown[0]).toMatchObject({
      sourceType: 'material',
      line: {
        componentId: 'b-cup',
        quantityPerParent: 2,
        componentCostContribution: 6,
      },
    });
  });

  it('recursively derives two-level Product-backed component cost', async () => {
    const bToC = productComponent('b-c', 'B', 'C', { quantityPerParent: 2 });
    const { service } = setup({
      products: [product('B'), product('C')],
      components: [bToC],
      directCosts: {
        B: directPreview('B', 10),
        C: directPreview('C', 3),
      },
    });

    const result = await service.costComponent(productComponent('a-b', 'A', 'B'));

    expect(result).toMatchObject({
      status: 'ready',
      childComponentCostSubtotal: 6,
      childComponentAwareUnitCost: 16,
    });
    expect(result.breakdown[0]).toMatchObject({
      sourceType: 'product',
      line: {
        childProductId: 'C',
        path: ['a', 'b', 'c'],
        childComponentAwareUnitCost: 3,
        componentCostContribution: 6,
      },
    });
  });

  it('supports deep finite acyclic Product nesting', async () => {
    const components = [
      productComponent('b-c', 'B', 'C'),
      productComponent('c-d', 'C', 'D', { quantityPerParent: 3 }),
    ];
    const { service } = setup({
      products: [product('B'), product('C'), product('D')],
      components,
      directCosts: {
        B: directPreview('B', 1),
        C: directPreview('C', 2),
        D: directPreview('D', 4),
      },
    });

    const result = await service.costComponent(productComponent('a-b', 'A', 'B', { quantityPerParent: 2 }));
    const c = result.breakdown[0]?.sourceType === 'product' ? result.breakdown[0].line : null;
    const d = c?.breakdown[0]?.sourceType === 'product' ? c.breakdown[0].line : null;

    expect(d).toMatchObject({
      childProductId: 'D',
      path: ['a', 'b', 'c', 'd'],
      childComponentAwareUnitCost: 4,
      componentCostContribution: 12,
    });
    expect(c).toMatchObject({ childComponentAwareUnitCost: 14, componentCostContribution: 14 });
    expect(result).toMatchObject({ childComponentAwareUnitCost: 15, componentCostContribution: 30 });
  });

  it('combines direct materials, material-backed components, and nested Products', async () => {
    const components = [
      materialComponent('b-cup', 'B', 'cup', { quantityPerParent: 2 }),
      productComponent('b-c', 'B', 'C', { quantityPerParent: 2 }),
      materialComponent('c-insert', 'C', 'insert'),
    ];
    const { service } = setup({
      products: [product('B'), product('C')],
      components,
      directCosts: {
        B: directPreview('B', 10),
        C: directPreview('C', 3),
      },
      materialCosts: {
        cup: { costPerPc: 2 },
        insert: { costPerPc: 1 },
      },
    });

    const result = await service.costComponent(productComponent('a-b', 'A', 'B', { quantityPerParent: 3 }));

    // C = 3 direct + 1 insert = 4; B gets 2 C = 8 plus 4 cups plus 10 direct = 22.
    expect(result).toMatchObject({
      status: 'ready',
      childComponentCostSubtotal: 12,
      childComponentAwareUnitCost: 22,
      componentCostContribution: 66,
    });
    expect(result.breakdown).toHaveLength(2);
  });

  it('preserves the full recursive breakdown tree and edge quantity multipliers', async () => {
    const components = [
      materialComponent('b-cup', 'B', 'cup', { quantityPerParent: 4 }),
      productComponent('b-c', 'B', 'C', { quantityPerParent: 2 }),
      materialComponent('c-label', 'C', 'label', { quantityPerParent: 3 }),
    ];
    const { service } = setup({
      products: [product('B'), product('C')],
      components,
      directCosts: { B: directPreview('B', 1), C: directPreview('C', 2) },
      materialCosts: { cup: { costPerPc: 5 }, label: { costPerPc: 0.5 } },
    });

    const result = await service.costComponent(productComponent('a-b', 'A', 'B', { quantityPerParent: 6 }));
    const productEntry = result.breakdown.find((entry) => entry.sourceType === 'product');

    expect(result.quantityPerParent).toBe(6);
    expect(result.breakdown.find((entry) => entry.sourceType === 'material')).toMatchObject({
      line: { quantityPerParent: 4, componentCostContribution: 20 },
    });
    expect(productEntry).toMatchObject({
      sourceType: 'product',
      line: {
        quantityPerParent: 2,
        breakdown: [
          {
            sourceType: 'material',
            line: { quantityPerParent: 3, componentCostContribution: 1.5 },
          },
        ],
      },
    });
  });

  it('treats a ready zero direct-material cost as reliable numeric zero evidence', async () => {
    const { service } = setup({
      products: [product('B')],
      directCosts: { B: directPreview('B', 0, 'ready', { withLine: true }) },
    });

    expect(await service.costComponent(productComponent('a-b', 'A', 'B'))).toMatchObject({
      status: 'ready',
      childComponentAwareUnitCost: 0,
      componentCostContribution: 0,
    });
  });

  it('returns partial known cost when Phase 2 direct-material cost is partial', async () => {
    const { service } = setup({
      products: [product('B')],
      directCosts: { B: directPreview('B', 7, 'partial') },
    });

    expect(await service.costComponent(productComponent('a-b', 'A', 'B', { quantityPerParent: 2 }))).toMatchObject({
      status: 'partial',
      childComponentAwareUnitCost: 7,
      componentCostContribution: 14,
      issues: [{ code: 'DIRECT_MATERIAL_COST_PARTIAL' }],
    });
  });

  it('returns partial component-derived cost when Phase 2 has no direct cost lines', async () => {
    const { service } = setup({
      products: [product('B')],
      components: [materialComponent('b-cup', 'B', 'cup')],
      directCosts: { B: directPreview('B', 0, 'not-ready', { withLine: false }) },
      materialCosts: { cup: { costPerPc: 5 } },
    });

    expect(await service.costComponent(productComponent('a-b', 'A', 'B'))).toMatchObject({
      status: 'partial',
      childDirectMaterialCost: { status: 'not-ready', lines: [] },
      childComponentCostSubtotal: 5,
      childComponentAwareUnitCost: 5,
      componentCostContribution: 5,
    });
  });

  it('returns not-ready when neither direct materials nor components provide cost evidence', async () => {
    const { service } = setup({
      products: [product('B')],
      directCosts: { B: directPreview('B', 0, 'not-ready', { withLine: false }) },
    });

    expect(await service.costComponent(productComponent('a-b', 'A', 'B'))).toMatchObject({
      status: 'not-ready',
      childComponentAwareUnitCost: null,
      componentCostContribution: null,
      issues: [{ code: 'DIRECT_MATERIAL_COST_NOT_READY' }],
    });
  });

  it('preserves zero component cost as evidence even when direct cost is unresolved', async () => {
    const { service } = setup({
      products: [product('B')],
      components: [materialComponent('b-free', 'B', 'free')],
      directCosts: { B: directPreview('B', 0, 'not-ready', { withLine: false }) },
      materialCosts: { free: { costPerPc: 0 } },
    });

    expect(await service.costComponent(productComponent('a-b', 'A', 'B'))).toMatchObject({
      status: 'partial',
      childComponentCostSubtotal: 0,
      childComponentAwareUnitCost: 0,
      componentCostContribution: 0,
    });
  });

  it('propagates a not-ready material-backed component while preserving ready direct cost', async () => {
    const { service } = setup({
      products: [product('B')],
      components: [materialComponent('b-cup', 'B', 'cup')],
      directCosts: { B: directPreview('B', 10) },
      materialCosts: { cup: { costPerPc: null, status: 'not-ready' } },
    });

    expect(await service.costComponent(productComponent('a-b', 'A', 'B'))).toMatchObject({
      status: 'partial',
      childComponentAwareUnitCost: 10,
      componentCostContribution: 10,
      issues: [{ code: 'NESTED_COMPONENT_NOT_READY' }],
    });
  });

  it('propagates partial nested Product cost to its parent', async () => {
    const { service } = setup({
      products: [product('B'), product('C')],
      components: [productComponent('b-c', 'B', 'C')],
      directCosts: {
        B: directPreview('B', 10),
        C: directPreview('C', 3, 'partial'),
      },
    });

    const result = await service.costComponent(productComponent('a-b', 'A', 'B'));

    expect(result).toMatchObject({
      status: 'partial',
      childComponentAwareUnitCost: 13,
      issues: [{ code: 'NESTED_COMPONENT_PARTIAL' }],
    });
    expect(result.breakdown[0]).toMatchObject({ sourceType: 'product', line: { status: 'partial' } });
  });

  it('returns controlled not-ready output for a missing child Product', async () => {
    const { service } = setup();

    expect(await service.costComponent(productComponent('a-missing', 'A', 'missing'))).toMatchObject({
      status: 'not-ready',
      childProductId: 'missing',
      childProductName: null,
      issues: [{ code: 'SOURCE_PRODUCT_NOT_FOUND' }],
    });
  });

  it('returns controlled not-ready output for an inactive child Product', async () => {
    const { service } = setup({ products: [product('B', { isActive: false })] });

    expect(await service.costComponent(productComponent('a-b', 'A', 'B'))).toMatchObject({
      status: 'not-ready',
      childProductId: 'B',
      childProductName: 'Product B',
      issues: [{ code: 'SOURCE_PRODUCT_INACTIVE' }],
    });
  });

  it('rejects a material-backed top-level input from the Product-backed service', async () => {
    const { service } = setup();

    expect(await service.costComponent(materialComponent('a-cup', 'A', 'cup'))).toMatchObject({
      status: 'not-ready',
      issues: [{ code: 'NOT_PRODUCT_BACKED_COMPONENT' }],
    });
  });

  it('returns controlled not-ready output for invalid ProductComponent input', async () => {
    const { service } = setup();

    expect(
      await service.costComponent(productComponent('a-b', 'A', 'B', { quantityPerParent: 1.5 })),
    ).toMatchObject({
      status: 'not-ready',
      issues: [{ code: 'INVALID_COMPONENT', underlyingCode: 'NON_INTEGER_QUANTITY' }],
    });
  });

  it('guards direct self-cycle corruption without recursing', async () => {
    const { service } = setup({ products: [product('A')] });

    expect(await service.costComponent(productComponent('a-a', 'A', 'A'))).toMatchObject({
      status: 'not-ready',
      path: ['a', 'a'],
      issues: [
        {
          code: 'CYCLE_DETECTED',
          cyclePath: ['a', 'a'],
        },
      ],
    });
  });

  it('guards a deep reachable cycle with a closed canonical path', async () => {
    const { service } = setup({
      products: [product('A'), product('B'), product('C')],
      components: [
        productComponent('b-c', 'B', 'C'),
        productComponent('c-a', 'C', 'A'),
      ],
      directCosts: {
        B: directPreview('B', 1),
        C: directPreview('C', 2),
        A: directPreview('A', 3),
      },
    });

    const result = await service.costComponent(productComponent('a-b', 'A', 'B'));
    const c = result.breakdown[0]?.sourceType === 'product' ? result.breakdown[0].line : null;
    const cycle = c?.breakdown[0]?.sourceType === 'product' ? c.breakdown[0].line : null;

    expect(cycle).toMatchObject({
      status: 'not-ready',
      issues: [{ code: 'CYCLE_DETECTED', cyclePath: ['a', 'b', 'c', 'a'] }],
    });
    expect(result.status).toBe('partial');
  });

  it('keeps unaffected sibling cost evidence when another reachable branch cycles', async () => {
    const { service } = setup({
      products: [product('A'), product('B'), product('C')],
      components: [
        materialComponent('b-cup', 'B', 'cup'),
        productComponent('b-c', 'B', 'C'),
        productComponent('c-a', 'C', 'A'),
      ],
      directCosts: {
        B: directPreview('B', 0, 'not-ready', { withLine: false }),
        C: directPreview('C', 0, 'not-ready', { withLine: false }),
        A: directPreview('A', 0, 'not-ready', { withLine: false }),
      },
      materialCosts: { cup: { costPerPc: 5 } },
    });

    const result = await service.costComponent(productComponent('a-b', 'A', 'B'));

    expect(result).toMatchObject({
      status: 'partial',
      childComponentCostSubtotal: 5,
      childComponentAwareUnitCost: 5,
      componentCostContribution: 5,
    });
    expect(result.breakdown.find((entry) => entry.sourceType === 'material')).toMatchObject({
      line: { componentCostContribution: 5 },
    });
  });

  it('does not double-count reachable duplicate component sources', async () => {
    const { service } = setup({
      products: [product('B')],
      components: [
        materialComponent('b-cup-1', 'B', 'cup'),
        materialComponent('b-cup-2', 'B', 'cup'),
      ],
      directCosts: { B: directPreview('B', 10) },
      materialCosts: { cup: { costPerPc: 5 } },
    });

    const result = await service.costComponent(productComponent('a-b', 'A', 'B'));

    expect(result).toMatchObject({
      status: 'partial',
      childComponentAwareUnitCost: 10,
      childComponentCostSubtotal: 0,
      breakdown: [],
    });
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'COMPONENT_GRAPH_INVALID',
          underlyingCode: 'DUPLICATE_COMPONENT_SOURCE',
        }),
      ]),
    );
  });

  it('does not let unrelated duplicate corruption block a safe requested tree', async () => {
    const { service } = setup({
      products: [product('B'), product('X')],
      components: [
        materialComponent('x-cup-1', 'X', 'cup'),
        materialComponent('x-cup-2', 'X', 'cup'),
      ],
      directCosts: { B: directPreview('B', 8), X: directPreview('X', 3) },
      materialCosts: { cup: { costPerPc: 5 } },
    });

    expect(await service.costComponent(productComponent('a-b', 'A', 'B'))).toMatchObject({
      status: 'ready',
      childComponentAwareUnitCost: 8,
      issues: [],
    });
  });

  it('returns deterministic breakdown ordering independent of repository insertion order', async () => {
    const components = [
      materialComponent('b-z', 'B', 'z-material'),
      productComponent('b-c', 'B', 'C'),
      materialComponent('b-a', 'B', 'a-material'),
    ];
    const { service } = setup({
      products: [product('B'), product('C')],
      components,
      directCosts: { B: directPreview('B', 1), C: directPreview('C', 2) },
      materialCosts: {
        'z-material': { costPerPc: 1 },
        'a-material': { costPerPc: 1 },
      },
    });

    const result = await service.costComponent(productComponent('a-b', 'A', 'B'));

    expect(result.breakdown.map((entry) => entry.line.componentId)).toEqual(['b-a', 'b-z', 'b-c']);
  });

  it('does not mutate Product or ProductComponent source records', async () => {
    const child = product('B', { name: ' Keep Product ' });
    const nested = materialComponent('b-cup', 'B', 'cup', { notes: ' keep nested ' });
    const top = productComponent('a-b', 'A', 'B', { notes: ' keep top ' });
    const originalChild = { ...child };
    const originalNested = { ...nested };
    const originalTop = { ...top };
    const { service } = setup({
      products: [child],
      components: [nested],
      directCosts: { B: directPreview('B', 2) },
      materialCosts: { cup: { costPerPc: 3 } },
    });

    await service.costComponent(top);

    expect(child).toEqual(originalChild);
    expect(nested).toEqual(originalNested);
    expect(top).toEqual(originalTop);
  });
});
