import { describe, expect, it } from 'vitest';
import type { Product } from '../../domain/products';
import type { ProductComponent } from '../../domain/productComponents';
import type { RecipeMaterialCostPreviewResult } from '../recipeCosts/RecipeMaterialCostPreviewService';
import { InMemoryProductRepository } from '../products/InMemoryProductRepository';
import { InMemoryProductComponentRepository } from './InMemoryProductComponentRepository';
import type { MaterialBackedComponentCostLine } from './MaterialBackedComponentCostService';
import type { ProductBackedComponentCostLine } from './ProductBackedComponentCostService';
import {
  ComponentAwareProductCostService,
  ComponentAwareProductCostServiceError,
  type ComponentAwareDirectMaterialCostProvider,
  type ComponentAwareMaterialComponentCostProvider,
  type ComponentAwareProductComponentCostProvider,
} from './ComponentAwareProductCostService';

function product(id: string, overrides: Partial<Product> = {}): Product {
  return {
    id,
    name: `Product ${id}`,
    category: 'candle',
    safetyWasteRate: 0,
    isActive: true,
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

function directPreview(
  productId: string,
  total: number,
  status: RecipeMaterialCostPreviewResult['status'] = 'ready',
  withLine = status !== 'not-ready',
): RecipeMaterialCostPreviewResult {
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
            materialId: `${productId}-direct`,
            baseUnit: 'g',
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
              message: `${productId} direct cost is ${status}.`,
            },
          ],
    costIssues: [],
  };
}

function materialCostLine(
  component: ProductComponent,
  contribution: number | null,
  status: MaterialBackedComponentCostLine['status'] = contribution === null ? 'not-ready' : 'ready',
): MaterialBackedComponentCostLine {
  return {
    componentId: component.id,
    parentProductId: component.parentProductId,
    role: component.role,
    sourceMaterialId: component.sourceId,
    sourceMaterialName: `Material ${component.sourceId}`,
    quantityPerParent: component.quantityPerParent,
    status,
    costPerPc:
      contribution === null ? null : contribution / component.quantityPerParent,
    componentCostContribution: contribution,
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

function productCostLine(
  component: ProductComponent,
  contribution: number | null,
  status: ProductBackedComponentCostLine['status'] = contribution === null ? 'not-ready' : 'ready',
): ProductBackedComponentCostLine {
  const unitCost = contribution === null ? null : contribution / component.quantityPerParent;
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
    childComponentCostSubtotal: 0,
    childComponentAwareUnitCost: unitCost,
    componentCostContribution: contribution,
    breakdown: [],
    issues:
      status === 'ready'
        ? []
        : [
            {
              code: status === 'partial' ? 'DIRECT_MATERIAL_COST_PARTIAL' : 'DIRECT_MATERIAL_COST_NOT_READY',
              message: `Product component ${component.sourceId} is ${status}.`,
            },
          ],
  };
}

function setup(options: {
  products?: Product[];
  components?: ProductComponent[];
  directCosts?: Record<string, RecipeMaterialCostPreviewResult>;
  materialContributions?: Record<string, { contribution: number | null; status?: MaterialBackedComponentCostLine['status'] }>;
  productContributions?: Record<string, { contribution: number | null; status?: ProductBackedComponentCostLine['status']; line?: ProductBackedComponentCostLine }>;
} = {}) {
  const products = new InMemoryProductRepository(options.products ?? []);
  const components = new InMemoryProductComponentRepository(options.components ?? []);
  const directCosts = new Map(
    Object.entries(options.directCosts ?? {}).map(([id, value]) => [id.trim().toLowerCase(), value]),
  );
  const materialContributions = new Map(
    Object.entries(options.materialContributions ?? {}).map(([id, value]) => [id.trim().toLowerCase(), value]),
  );
  const productContributions = new Map(
    Object.entries(options.productContributions ?? {}).map(([id, value]) => [id.trim().toLowerCase(), value]),
  );

  const directProvider: ComponentAwareDirectMaterialCostProvider = {
    async previewForProduct(productId: string) {
      return directCosts.get(productId.trim().toLowerCase()) ?? directPreview(productId, 0, 'not-ready', false);
    },
  };

  const materialProvider: ComponentAwareMaterialComponentCostProvider = {
    async costComponent(component: ProductComponent) {
      const configured = materialContributions.get(component.sourceId.trim().toLowerCase());
      return materialCostLine(
        component,
        configured?.contribution ?? null,
        configured?.status ?? (configured?.contribution === null || configured === undefined ? 'not-ready' : 'ready'),
      );
    },
  };

  const productProvider: ComponentAwareProductComponentCostProvider = {
    async costComponent(component: ProductComponent) {
      const configured = productContributions.get(component.sourceId.trim().toLowerCase());
      if (configured?.line) return configured.line;
      return productCostLine(
        component,
        configured?.contribution ?? null,
        configured?.status ?? (configured?.contribution === null || configured === undefined ? 'not-ready' : 'ready'),
      );
    },
  };

  return {
    service: new ComponentAwareProductCostService(
      products,
      components,
      directProvider,
      materialProvider,
      productProvider,
    ),
    products,
    components,
  };
}

describe('ComponentAwareProductCostService', () => {
  it('returns a ready direct-material-only Product cost', async () => {
    const { service } = setup({
      products: [product('P')],
      directCosts: { P: directPreview('P', 12) },
    });

    const result = await service.costProduct('P');

    expect(result).toMatchObject({
      productId: 'P',
      productName: 'Product P',
      productIsActive: true,
      status: 'ready',
      directMaterialCostSubtotal: 12,
      componentCostSubtotal: 0,
      totalComponentAwareCost: 12,
      componentLines: [],
      issues: [],
    });
  });

  it('adds a ready Material-backed component contribution to direct material cost', async () => {
    const component = materialComponent('glass', 'P', 'GLASS', { quantityPerParent: 2 });
    const { service } = setup({
      products: [product('P')],
      components: [component],
      directCosts: { P: directPreview('P', 10) },
      materialContributions: { GLASS: { contribution: 6 } },
    });

    const result = await service.costProduct('P');

    expect(result.status).toBe('ready');
    expect(result.componentCostSubtotal).toBe(6);
    expect(result.totalComponentAwareCost).toBe(16);
    expect(result.componentLines[0]).toMatchObject({ sourceType: 'material', line: { quantityPerParent: 2 } });
  });

  it('adds a ready Product-backed recursive contribution to direct material cost', async () => {
    const component = productComponent('child', 'P', 'CHILD', { quantityPerParent: 3 });
    const { service } = setup({
      products: [product('P')],
      components: [component],
      directCosts: { P: directPreview('P', 4) },
      productContributions: { CHILD: { contribution: 15 } },
    });

    const result = await service.costProduct('P');

    expect(result.status).toBe('ready');
    expect(result.componentCostSubtotal).toBe(15);
    expect(result.totalComponentAwareCost).toBe(19);
    expect(result.componentLines[0]).toMatchObject({ sourceType: 'product', line: { quantityPerParent: 3 } });
  });

  it('combines mixed Material-backed and Product-backed root components', async () => {
    const { service } = setup({
      products: [product('P')],
      components: [
        materialComponent('vessel', 'P', 'GLASS'),
        productComponent('insert', 'P', 'HEART'),
      ],
      directCosts: { P: directPreview('P', 20) },
      materialContributions: { GLASS: { contribution: 5 } },
      productContributions: { HEART: { contribution: 8 } },
    });

    const result = await service.costProduct('P');

    expect(result).toMatchObject({
      status: 'ready',
      directMaterialCostSubtotal: 20,
      componentCostSubtotal: 13,
      totalComponentAwareCost: 33,
    });
    expect(result.componentLines.map((entry) => entry.sourceType)).toEqual(['material', 'product']);
  });

  it('does not multiply an already-computed component contribution again', async () => {
    const component = materialComponent('vessel', 'P', 'GLASS', { quantityPerParent: 4 });
    const { service } = setup({
      products: [product('P')],
      components: [component],
      directCosts: { P: directPreview('P', 1) },
      materialContributions: { GLASS: { contribution: 12 } },
    });

    const result = await service.costProduct('P');
    expect(result.componentCostSubtotal).toBe(12);
    expect(result.totalComponentAwareCost).toBe(13);
  });

  it('preserves a Product-backed recursive breakdown tree without flattening it', async () => {
    const component = productComponent('child', 'P', 'CHILD');
    const nested = materialCostLine(materialComponent('nested-mat', 'CHILD', 'WICK'), 2);
    const recursiveLine: ProductBackedComponentCostLine = {
      ...productCostLine(component, 9),
      breakdown: [{ sourceType: 'material', line: nested }],
    };
    const { service } = setup({
      products: [product('P')],
      components: [component],
      directCosts: { P: directPreview('P', 3) },
      productContributions: { CHILD: { contribution: 9, line: recursiveLine } },
    });

    const result = await service.costProduct('P');
    expect(result.componentLines).toHaveLength(1);
    expect(result.componentLines[0].sourceType).toBe('product');
    if (result.componentLines[0].sourceType === 'product') {
      expect(result.componentLines[0].line.breakdown).toHaveLength(1);
      expect(result.componentLines[0].line.breakdown[0].sourceType).toBe('material');
    }
  });

  it('orders immediate root components deterministically', async () => {
    const { service } = setup({
      products: [product('P')],
      components: [
        productComponent('z', 'P', 'Z'),
        materialComponent('m2', 'P', 'B'),
        materialComponent('m1', 'P', 'A'),
        productComponent('a', 'P', 'A'),
      ],
      directCosts: { P: directPreview('P', 1) },
      materialContributions: { A: { contribution: 1 }, B: { contribution: 1 } },
      productContributions: { A: { contribution: 1 }, Z: { contribution: 1 } },
    });

    const result = await service.costProduct('P');
    expect(result.componentLines.map((entry) => `${entry.sourceType}:${entry.line.componentId}`)).toEqual([
      'material:m1',
      'material:m2',
      'product:a',
      'product:z',
    ]);
  });

  it('treats ready zero direct-material cost as valid numeric evidence', async () => {
    const { service } = setup({
      products: [product('P')],
      directCosts: { P: directPreview('P', 0, 'ready', true) },
    });

    const result = await service.costProduct('P');
    expect(result).toMatchObject({ status: 'ready', directMaterialCostSubtotal: 0, totalComponentAwareCost: 0 });
  });

  it('treats ready zero component contribution as valid numeric evidence', async () => {
    const { service } = setup({
      products: [product('P')],
      components: [materialComponent('free', 'P', 'FREE')],
      directCosts: { P: directPreview('P', 2) },
      materialContributions: { FREE: { contribution: 0 } },
    });

    const result = await service.costProduct('P');
    expect(result).toMatchObject({ status: 'ready', componentCostSubtotal: 0, totalComponentAwareCost: 2 });
  });

  it('returns partial known total when Phase 2 direct cost is partial', async () => {
    const { service } = setup({
      products: [product('P')],
      components: [materialComponent('vessel', 'P', 'GLASS')],
      directCosts: { P: directPreview('P', 7, 'partial', true) },
      materialContributions: { GLASS: { contribution: 3 } },
    });

    const result = await service.costProduct('P');
    expect(result).toMatchObject({ status: 'partial', directMaterialCostSubtotal: 7, componentCostSubtotal: 3, totalComponentAwareCost: 10 });
    expect(result.issues.map((issue) => issue.code)).toContain('DIRECT_MATERIAL_COST_PARTIAL');
  });

  it('returns partial component-only known subtotal when Phase 2 has no cost evidence', async () => {
    const { service } = setup({
      products: [product('P')],
      components: [materialComponent('vessel', 'P', 'GLASS')],
      directCosts: { P: directPreview('P', 0, 'not-ready', false) },
      materialContributions: { GLASS: { contribution: 5 } },
    });

    const result = await service.costProduct('P');
    expect(result).toMatchObject({ status: 'partial', directMaterialCostSubtotal: 0, componentCostSubtotal: 5, totalComponentAwareCost: 5 });
    expect(result.issues.map((issue) => issue.code)).toContain('DIRECT_MATERIAL_COST_NOT_READY');
  });

  it('returns not-ready/null when neither direct nor component cost evidence exists', async () => {
    const { service } = setup({
      products: [product('P')],
      directCosts: { P: directPreview('P', 0, 'not-ready', false) },
    });

    const result = await service.costProduct('P');
    expect(result).toMatchObject({ status: 'not-ready', directMaterialCostSubtotal: 0, componentCostSubtotal: 0, totalComponentAwareCost: null });
  });

  it('returns partial known direct subtotal when a Material-backed component is not ready', async () => {
    const { service } = setup({
      products: [product('P')],
      components: [materialComponent('vessel', 'P', 'GLASS')],
      directCosts: { P: directPreview('P', 9) },
      materialContributions: { GLASS: { contribution: null, status: 'not-ready' } },
    });

    const result = await service.costProduct('P');
    expect(result).toMatchObject({ status: 'partial', componentCostSubtotal: 0, totalComponentAwareCost: 9 });
    expect(result.issues.map((issue) => issue.code)).toContain('COMPONENT_COST_NOT_READY');
  });

  it('returns partial known subtotal when a Product-backed component is partial', async () => {
    const { service } = setup({
      products: [product('P')],
      components: [productComponent('child', 'P', 'CHILD')],
      directCosts: { P: directPreview('P', 10) },
      productContributions: { CHILD: { contribution: 4, status: 'partial' } },
    });

    const result = await service.costProduct('P');
    expect(result).toMatchObject({ status: 'partial', componentCostSubtotal: 4, totalComponentAwareCost: 14 });
    expect(result.issues.map((issue) => issue.code)).toContain('COMPONENT_COST_PARTIAL');
  });

  it('returns partial known direct subtotal when a Product-backed component is not ready', async () => {
    const { service } = setup({
      products: [product('P')],
      components: [productComponent('child', 'P', 'CHILD')],
      directCosts: { P: directPreview('P', 10) },
      productContributions: { CHILD: { contribution: null, status: 'not-ready' } },
    });

    const result = await service.costProduct('P');
    expect(result).toMatchObject({ status: 'partial', componentCostSubtotal: 0, totalComponentAwareCost: 10 });
  });

  it('returns not-ready when all component evidence is unresolved and there is no direct evidence', async () => {
    const { service } = setup({
      products: [product('P')],
      components: [materialComponent('vessel', 'P', 'GLASS')],
      directCosts: { P: directPreview('P', 0, 'not-ready', false) },
      materialContributions: { GLASS: { contribution: null, status: 'not-ready' } },
    });

    const result = await service.costProduct('P');
    expect(result.status).toBe('not-ready');
    expect(result.totalComponentAwareCost).toBeNull();
  });

  it('rejects duplicate immediate root sources without double-counting', async () => {
    const duplicateA = materialComponent('a', 'P', 'GLASS');
    const duplicateB = materialComponent('b', 'P', 'glass', { quantityPerParent: 3 });
    const { service } = setup({
      products: [product('P')],
      components: [duplicateA, duplicateB],
      directCosts: { P: directPreview('P', 10) },
      materialContributions: { GLASS: { contribution: 5 } },
    });

    const result = await service.costProduct('P');
    expect(result).toMatchObject({ status: 'partial', componentCostSubtotal: 0, totalComponentAwareCost: 10, componentLines: [] });
    expect(result.issues.map((issue) => issue.code)).toContain('COMPONENT_GRAPH_INVALID');
  });

  it('returns not-ready for duplicate root sources when no independent direct evidence exists', async () => {
    const { service } = setup({
      products: [product('P')],
      components: [materialComponent('a', 'P', 'GLASS'), materialComponent('b', 'P', 'glass')],
      directCosts: { P: directPreview('P', 0, 'not-ready', false) },
    });

    const result = await service.costProduct('P');
    expect(result.status).toBe('not-ready');
    expect(result.totalComponentAwareCost).toBeNull();
  });

  it('preserves nested corruption/readiness reported by 3.3B without recursing itself', async () => {
    const component = productComponent('child', 'P', 'CHILD');
    const line = productCostLine(component, 6, 'partial');
    line.issues = [{
      code: 'CYCLE_DETECTED',
      message: 'child -> grandchild -> child',
      cyclePath: ['child', 'grandchild', 'child'],
    }];
    const { service } = setup({
      products: [product('P')],
      components: [component],
      directCosts: { P: directPreview('P', 4) },
      productContributions: { CHILD: { contribution: 6, status: 'partial', line } },
    });

    const result = await service.costProduct('P');
    expect(result.status).toBe('partial');
    if (result.componentLines[0].sourceType === 'product') {
      expect(result.componentLines[0].line.issues[0]).toMatchObject({ code: 'CYCLE_DETECTED', cyclePath: ['child', 'grandchild', 'child'] });
    }
  });

  it('throws typed PRODUCT_NOT_FOUND for a missing root Product', async () => {
    const { service } = setup();

    await expect(service.costProduct('missing')).rejects.toMatchObject({
      name: 'ComponentAwareProductCostServiceError',
      code: 'PRODUCT_NOT_FOUND',
      productId: 'missing',
    });
    await expect(service.costProduct('missing')).rejects.toBeInstanceOf(ComponentAwareProductCostServiceError);
  });

  it('preserves inactive root Product identity while deriving historical cost evidence', async () => {
    const { service } = setup({
      products: [product('P', { name: 'Archived Product', isActive: false })],
      directCosts: { P: directPreview('P', 8) },
    });

    const result = await service.costProduct('P');
    expect(result).toMatchObject({ productId: 'P', productName: 'Archived Product', productIsActive: false, status: 'ready', totalComponentAwareCost: 8 });
  });

  it('has no ProductStock dependency and therefore derives cost independently of finished stock', async () => {
    const { service } = setup({
      products: [product('P')],
      directCosts: { P: directPreview('P', 11) },
    });

    const result = await service.costProduct('P');
    expect(result.totalComponentAwareCost).toBe(11);
  });

  it('skips an invalid non-finite component contribution and reports a partial safe subtotal', async () => {
    const component = materialComponent('broken', 'P', 'BROKEN');
    const { service } = setup({
      products: [product('P')],
      components: [component],
      directCosts: { P: directPreview('P', 5) },
      materialContributions: { BROKEN: { contribution: Number.POSITIVE_INFINITY, status: 'ready' } },
    });

    const result = await service.costProduct('P');
    expect(result).toMatchObject({ status: 'partial', componentCostSubtotal: 0, totalComponentAwareCost: 5 });
    expect(result.issues.map((issue) => issue.code)).toContain('DERIVED_COST_INVALID');
  });

  it('returns not-ready when the only available component contribution is invalid', async () => {
    const { service } = setup({
      products: [product('P')],
      components: [materialComponent('broken', 'P', 'BROKEN')],
      directCosts: { P: directPreview('P', 0, 'not-ready', false) },
      materialContributions: { BROKEN: { contribution: -1, status: 'ready' } },
    });

    const result = await service.costProduct('P');
    expect(result.status).toBe('not-ready');
    expect(result.totalComponentAwareCost).toBeNull();
    expect(result.issues.map((issue) => issue.code)).toContain('DERIVED_COST_INVALID');
  });

  it('does not mutate Product or ProductComponent source records', async () => {
    const sourceProduct = product('P');
    const sourceComponent = materialComponent('vessel', 'P', 'GLASS');
    const productSnapshot = structuredClone(sourceProduct);
    const componentSnapshot = structuredClone(sourceComponent);
    const { service, products, components } = setup({
      products: [sourceProduct],
      components: [sourceComponent],
      directCosts: { P: directPreview('P', 2) },
      materialContributions: { GLASS: { contribution: 3 } },
    });

    await service.costProduct('P');

    expect(await products.findById('P')).toEqual(productSnapshot);
    expect(await components.findById('vessel')).toEqual(componentSnapshot);
  });
});
