import { describe, expect, it } from 'vitest';
import type { Material } from '../../domain/materials';
import type { ProductComponent } from '../../domain/productComponents';
import type { ProductStock } from '../../domain/productStock';
import type { Product } from '../../domain/products';
import { InMemoryMaterialRepository } from '../materials/InMemoryMaterialRepository';
import { InMemoryProductRepository } from '../products/InMemoryProductRepository';
import { InMemoryProductStockRepository } from '../productStocks/InMemoryProductStockRepository';
import { ComponentSourceAvailabilityService } from './ComponentSourceAvailabilityService';
import { InMemoryProductComponentRepository } from './InMemoryProductComponentRepository';
import {
  ProductComponentApplicationError,
  ProductComponentService,
} from './ProductComponentService';

function material(overrides: Partial<Material> = {}): Material {
  return {
    id: 'material-a',
    name: 'Material A',
    group: 'packaging',
    baseUnit: 'pc',
    purchaseQuantity: 1,
    purchaseUnit: 'pc',
    packageCost: 10,
    onHandQuantity: 8,
    onHandUnit: 'pc',
    isActive: true,
    ...overrides,
  };
}

function product(id: string, isActive = true): Product {
  return {
    id,
    name: `Product ${id}`,
    category: 'candle',
    safetyWasteRate: 0,
    isActive,
  };
}

function stock(productId: string, onHandQuantity: number): ProductStock {
  return { productId, onHandQuantity };
}

function component(
  id: string,
  parentProductId: string,
  sourceType: 'material' | 'product',
  sourceId: string,
): ProductComponent {
  return {
    id,
    parentProductId,
    sourceType,
    sourceId,
    role: sourceType === 'material' ? 'vessel' : 'molded-component',
    quantityPerParent: 1,
  };
}

function setup(
  materials: Material[] = [],
  products: Product[] = [],
  stocks: ProductStock[] = [],
) {
  const materialRepository = new InMemoryMaterialRepository(materials);
  const productRepository = new InMemoryProductRepository(products);
  const productStockRepository = new InMemoryProductStockRepository(stocks);
  const service = new ComponentSourceAvailabilityService(
    materialRepository,
    productRepository,
    productStockRepository,
  );

  return {
    materialRepository,
    productRepository,
    productStockRepository,
    service,
  };
}

describe('ComponentSourceAvailabilityService', () => {
  it('resolves active count Material stock as ready in canonical pc units', async () => {
    const { service } = setup([material({ id: 'jar', onHandQuantity: 12 })]);

    const result = await service.resolveSource('material', ' JAR ');

    expect(result).toMatchObject({
      sourceType: 'material',
      sourceId: 'jar',
      status: 'ready',
      availableQuantity: 12,
      unit: 'pc',
      issues: [],
    });
    expect(result.materialInventoryNormalization).toMatchObject({
      enteredQuantity: 12,
      enteredUnit: 'pc',
      baseUnit: 'pc',
      baseUnitsPerOnHandUnit: 1,
      normalizedBaseQuantity: 12,
      conversionSource: 'standard',
    });
  });

  it('preserves package conversion evidence for count Material availability', async () => {
    const { service } = setup([
      material({
        id: 'boxed-jars',
        purchaseUnit: 'box',
        manualBaseUnitsPerPurchaseUnit: 50,
        onHandQuantity: 2,
        onHandUnit: 'box',
      }),
    ]);

    const result = await service.resolveSource('material', 'boxed-jars');

    expect(result.status).toBe('ready');
    expect(result.availableQuantity).toBe(100);
    expect(result.materialInventoryNormalization).toMatchObject({
      baseUnitsPerOnHandUnit: 50,
      normalizedBaseQuantity: 100,
      conversionSource: 'purchase-package',
      purchasePackageConversionSource: 'manual',
    });
  });

  it('treats explicit zero Material stock as resolved ready availability', async () => {
    const { service } = setup([material({ id: 'empty-jars', onHandQuantity: 0 })]);

    expect(await service.resolveSource('material', 'empty-jars')).toMatchObject({
      status: 'ready',
      availableQuantity: 0,
      issues: [],
    });
  });

  it('returns not-ready for a missing Material source', async () => {
    const { service } = setup();

    expect(await service.resolveSource('material', 'missing')).toMatchObject({
      status: 'not-ready',
      availableQuantity: null,
      issues: [{ code: 'SOURCE_MATERIAL_NOT_FOUND' }],
    });
  });

  it('returns not-ready for an inactive Material source', async () => {
    const { service } = setup([material({ id: 'archived', isActive: false })]);

    expect(await service.resolveSource('material', 'archived')).toMatchObject({
      status: 'not-ready',
      availableQuantity: null,
      issues: [{ code: 'SOURCE_MATERIAL_INACTIVE' }],
    });
  });

  it('returns not-ready when Material inventory is not count based', async () => {
    const { service } = setup([
      material({
        id: 'wax',
        group: 'wax',
        baseUnit: 'g',
        purchaseQuantity: 1000,
        purchaseUnit: 'g',
        onHandQuantity: 500,
        onHandUnit: 'g',
      }),
    ]);

    expect(await service.resolveSource('material', 'wax')).toMatchObject({
      status: 'not-ready',
      availableQuantity: null,
      issues: [{ code: 'SOURCE_MATERIAL_NOT_COUNT_BASED' }],
    });
  });

  it('returns partial when count Material package conversion evidence is unresolved', async () => {
    const { service } = setup([
      material({
        id: 'unresolved-box',
        purchaseUnit: 'box',
        manualBaseUnitsPerPurchaseUnit: undefined,
        onHandQuantity: 1,
        onHandUnit: 'box',
      }),
    ]);

    expect(await service.resolveSource('material', 'unresolved-box')).toMatchObject({
      status: 'partial',
      availableQuantity: null,
      issues: [
        {
          code: 'SOURCE_MATERIAL_INVENTORY_UNRESOLVED',
          underlyingCode: 'MISSING_PACKAGE_CONVERSION',
        },
      ],
    });
  });

  it('returns partial for corrupted negative normalized Material stock', async () => {
    const { service } = setup([material({ id: 'negative', onHandQuantity: -1 })]);

    const result = await service.resolveSource('material', 'negative');
    expect(result).toMatchObject({
      status: 'partial',
      availableQuantity: null,
      issues: [{ code: 'SOURCE_MATERIAL_NEGATIVE_ON_HAND' }],
    });
    expect(result.materialInventoryNormalization?.normalizedBaseQuantity).toBe(-1);
  });

  it('resolves active ProductStock as ready Product-backed availability', async () => {
    const { service } = setup([], [product('child')], [stock('child', 5)]);

    expect(await service.resolveSource('product', ' CHILD ')).toMatchObject({
      sourceType: 'product',
      sourceId: 'child',
      status: 'ready',
      availableQuantity: 5,
      unit: 'pc',
      issues: [],
      productStock: { productId: 'child', onHandQuantity: 5 },
    });
  });

  it('treats explicit zero ProductStock as ready instead of unresolved', async () => {
    const { service } = setup([], [product('child')], [stock('child', 0)]);

    expect(await service.resolveSource('product', 'child')).toMatchObject({
      status: 'ready',
      availableQuantity: 0,
      productStock: { onHandQuantity: 0 },
    });
  });

  it('returns partial when an active Product has no ProductStock record', async () => {
    const { service } = setup([], [product('child')]);

    expect(await service.resolveSource('product', 'child')).toMatchObject({
      status: 'partial',
      availableQuantity: null,
      issues: [{ code: 'SOURCE_PRODUCT_STOCK_MISSING' }],
      productStock: null,
    });
  });

  it('returns not-ready for a missing Product source', async () => {
    const { service } = setup();

    expect(await service.resolveSource('product', 'missing')).toMatchObject({
      status: 'not-ready',
      availableQuantity: null,
      issues: [{ code: 'SOURCE_PRODUCT_NOT_FOUND' }],
    });
  });

  it('returns not-ready for an archived Product even when historical ProductStock exists', async () => {
    const { service } = setup([], [product('archived', false)], [stock('archived', 9)]);

    expect(await service.resolveSource('product', 'archived')).toMatchObject({
      status: 'not-ready',
      availableQuantity: null,
      issues: [{ code: 'SOURCE_PRODUCT_INACTIVE' }],
    });
  });

  it('returns partial with 3.2A evidence when persisted ProductStock is corrupted', async () => {
    const { service } = setup([], [product('child')], [stock('child', 1.5)]);

    expect(await service.resolveSource('product', 'child')).toMatchObject({
      status: 'partial',
      availableQuantity: null,
      issues: [
        {
          code: 'SOURCE_PRODUCT_STOCK_INVALID',
          underlyingCode: 'NON_INTEGER_ON_HAND_QUANTITY',
        },
      ],
      productStock: { productId: 'child', onHandQuantity: 1.5 },
    });
  });

  it('resolves availability through a ProductComponent source reference', async () => {
    const { service } = setup([], [product('child')], [stock('child', 3)]);

    expect(
      await service.resolveComponent(component('line-1', 'parent', 'product', 'child')),
    ).toMatchObject({ status: 'ready', availableQuantity: 3 });
  });
});

describe('Phase 3.2C relationship guard regression', () => {
  it('keeps active Material component dependencies protected from archive', async () => {
    const parent = product('parent');
    const materialRepository = new InMemoryMaterialRepository([material({ id: 'jar' })]);
    const productRepository = new InMemoryProductRepository([parent]);
    const componentRepository = new InMemoryProductComponentRepository([
      component('material-line', parent.id, 'material', 'jar'),
    ]);
    const componentService = new ProductComponentService(
      componentRepository,
      productRepository,
      materialRepository,
    );

    await expect(componentService.assertMaterialCanArchive('jar')).rejects.toMatchObject({
      code: 'ACTIVE_PARENT_DEPENDS_ON_MATERIAL',
    } satisfies Partial<ProductComponentApplicationError>);
  });

  it('keeps active child Product component dependencies protected from archive', async () => {
    const parent = product('parent');
    const child = product('child');
    const materialRepository = new InMemoryMaterialRepository();
    const productRepository = new InMemoryProductRepository([parent, child]);
    const componentRepository = new InMemoryProductComponentRepository([
      component('product-line', parent.id, 'product', child.id),
    ]);
    const componentService = new ProductComponentService(
      componentRepository,
      productRepository,
      materialRepository,
    );

    await expect(componentService.assertProductCanArchive('child')).rejects.toMatchObject({
      code: 'ACTIVE_PARENT_DEPENDS_ON_PRODUCT',
    } satisfies Partial<ProductComponentApplicationError>);
  });

  it('does not treat archived-parent history as an active dependency guard', async () => {
    const archivedParent = product('parent', false);
    const child = product('child');
    const materialRepository = new InMemoryMaterialRepository([material({ id: 'jar' })]);
    const productRepository = new InMemoryProductRepository([archivedParent, child]);
    const componentRepository = new InMemoryProductComponentRepository([
      component('material-line', archivedParent.id, 'material', 'jar'),
      component('product-line', archivedParent.id, 'product', child.id),
    ]);
    const componentService = new ProductComponentService(
      componentRepository,
      productRepository,
      materialRepository,
    );

    await expect(componentService.assertMaterialCanArchive('jar')).resolves.toBeUndefined();
    await expect(componentService.assertProductCanArchive('child')).resolves.toBeUndefined();
  });
});
