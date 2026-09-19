import { describe, expect, it } from 'vitest';
import type { Material } from '../../domain/materials';
import type { ProductComponent } from '../../domain/productComponents';
import { ProductComponentError } from '../../domain/productComponents';
import { ProductCompositionGraphError } from '../../domain/productCompositionGraph';
import type { Product } from '../../domain/products';
import { InMemoryMaterialRepository } from '../materials/InMemoryMaterialRepository';
import { MaterialService } from '../materials/MaterialService';
import { InMemoryMixPresetRepository } from '../mixPresets/InMemoryMixPresetRepository';
import { InMemoryProductRepository } from '../products/InMemoryProductRepository';
import { ProductService } from '../products/ProductService';
import { InMemoryProductComponentRepository } from './InMemoryProductComponentRepository';
import {
  ProductComponentApplicationError,
  ProductComponentService,
} from './ProductComponentService';

function product(id: string, isActive = true): Product {
  return {
    id,
    name: `Product ${id}`,
    category: 'candle',
    safetyWasteRate: 0,
    isActive,
  };
}

function material(id: string, isActive = true, baseUnit: Material['baseUnit'] = 'pc'): Material {
  return {
    id,
    name: `Material ${id}`,
    group: 'container',
    baseUnit,
    purchaseQuantity: 1,
    purchaseUnit: baseUnit,
    packageCost: 10,
    onHandQuantity: 10,
    onHandUnit: baseUnit,
    isActive,
  };
}

function component(
  id: string,
  parentProductId: string,
  sourceType: ProductComponent['sourceType'],
  sourceId: string,
  quantityPerParent = 1,
): ProductComponent {
  return {
    id,
    parentProductId,
    sourceType,
    sourceId,
    role: sourceType === 'material' ? 'vessel' : 'molded-component',
    quantityPerParent,
  };
}

function setup(
  products: Product[] = [],
  materials: Material[] = [],
  components: ProductComponent[] = [],
) {
  const productRepository = new InMemoryProductRepository(products);
  const materialRepository = new InMemoryMaterialRepository(materials);
  const componentRepository = new InMemoryProductComponentRepository(components);
  const componentService = new ProductComponentService(
    componentRepository,
    productRepository,
    materialRepository,
  );

  return {
    productRepository,
    materialRepository,
    componentRepository,
    componentService,
  };
}

describe('ProductComponentService', () => {
  it('creates normalized component lines, lists by parent, and clones repository/service results', async () => {
    const { componentService, componentRepository } = setup(
      [product('parent')],
      [material('glass')],
    );

    const created = await componentService.createComponent({
      ...component('  comp-1  ', '  parent  ', 'material', '  glass  '),
      notes: '  purchased vessel  ',
    });

    expect(created).toEqual({
      ...component('comp-1', 'parent', 'material', 'glass'),
      notes: 'purchased vessel',
    });

    created.notes = 'mutated outside';
    const byParent = await componentService.listComponentsByParent(' PARENT ');
    expect(byParent).toHaveLength(1);
    expect(byParent[0]?.notes).toBe('purchased vessel');

    const raw = await componentRepository.findById('comp-1');
    expect(raw?.notes).toBe('purchased vessel');
    if (raw) raw.notes = 'mutated repository read';
    expect((await componentRepository.findById('comp-1'))?.notes).toBe('purchased vessel');
  });

  it('supports update, search/filter, and remove without React', async () => {
    const { componentService } = setup(
      [product('parent'), product('child')],
      [material('glass')],
    );

    await componentService.createComponent(component('c-1', 'parent', 'material', 'glass'));
    const updated = await componentService.updateComponent('c-1', {
      sourceType: 'product',
      sourceId: 'child',
      role: 'molded-component',
      quantityPerParent: 3,
      notes: 'mini mold',
    });

    expect(updated.sourceType).toBe('product');
    expect(updated.quantityPerParent).toBe(3);
    expect(await componentService.listComponents({ sourceType: 'material' })).toHaveLength(0);
    expect(await componentService.listComponents({ query: 'mini mold' })).toHaveLength(1);

    await componentService.removeComponent('c-1');
    expect(await componentService.getComponent('c-1')).toBeNull();
  });

  it('rejects missing or archived parents and invalid material sources', async () => {
    const missingParent = setup([], [material('glass')]);
    await expect(
      missingParent.componentService.createComponent(component('c-1', 'missing', 'material', 'glass')),
    ).rejects.toMatchObject({ code: 'PARENT_PRODUCT_NOT_FOUND' });

    const archivedParent = setup([product('parent', false)], [material('glass')]);
    await expect(
      archivedParent.componentService.createComponent(component('c-1', 'parent', 'material', 'glass')),
    ).rejects.toMatchObject({ code: 'PARENT_PRODUCT_INACTIVE' });

    const archivedMaterial = setup([product('parent')], [material('glass', false)]);
    await expect(
      archivedMaterial.componentService.createComponent(component('c-1', 'parent', 'material', 'glass')),
    ).rejects.toMatchObject({ code: 'SOURCE_MATERIAL_INACTIVE' });

    const nonCountMaterial = setup([product('parent')], [material('wax', true, 'g')]);
    await expect(
      nonCountMaterial.componentService.createComponent(component('c-1', 'parent', 'material', 'wax')),
    ).rejects.toBeInstanceOf(ProductComponentError);
  });

  it('rejects duplicate IDs, duplicate parent/source identities, and transitive cycles', async () => {
    const { componentService } = setup(
      [product('a'), product('b'), product('c')],
      [material('glass')],
    );

    await componentService.createComponent(component('same-id', 'a', 'material', 'glass'));
    await expect(
      componentService.createComponent(component('same-id', 'b', 'product', 'c')),
    ).rejects.toMatchObject({ code: 'DUPLICATE_COMPONENT_ID' });

    await expect(
      componentService.createComponent(component('duplicate-source', 'a', 'material', 'GLASS', 2)),
    ).rejects.toMatchObject({ code: 'DUPLICATE_COMPONENT_SOURCE' });

    await componentService.createComponent(component('a-b', 'a', 'product', 'b'));
    await componentService.createComponent(component('b-c', 'b', 'product', 'c'));
    await expect(
      componentService.createComponent(component('c-a', 'c', 'product', 'a')),
    ).rejects.toBeInstanceOf(ProductCompositionGraphError);
  });

  it('blocks material archive/update while active parents depend on the material', async () => {
    const glass = material('glass');
    const parent = product('parent');
    const { componentService, materialRepository } = setup(
      [parent],
      [glass],
      [component('vessel', 'parent', 'material', 'glass')],
    );
    const materialService = new MaterialService(materialRepository, async () => [], componentService);

    await expect(materialService.archiveMaterial('glass')).rejects.toMatchObject({
      code: 'ACTIVE_PARENT_DEPENDS_ON_MATERIAL',
      dependentParentProductIds: ['parent'],
    });
    await expect(materialService.updateMaterial('glass', { isActive: false })).rejects.toMatchObject({
      code: 'ACTIVE_PARENT_DEPENDS_ON_MATERIAL',
    });
    await expect(
      materialService.updateMaterial('glass', {
        baseUnit: 'g',
        purchaseQuantity: 100,
        purchaseUnit: 'g',
        onHandQuantity: 100,
        onHandUnit: 'g',
      }),
    ).rejects.toMatchObject({ code: 'ACTIVE_PARENT_REQUIRES_COUNT_MATERIAL' });
  });

  it('blocks child Product archive through both archive and generic update paths', async () => {
    const parent = product('parent');
    const child = product('child');
    const { componentService, productRepository } = setup(
      [parent, child],
      [],
      [component('child-line', 'parent', 'product', 'child')],
    );
    const productService = new ProductService(
      productRepository,
      new InMemoryMixPresetRepository(),
      componentService,
    );

    await expect(productService.archiveProduct('child')).rejects.toMatchObject({
      code: 'ACTIVE_PARENT_DEPENDS_ON_PRODUCT',
      dependentParentProductIds: ['parent'],
    });
    await expect(productService.updateProduct('child', { isActive: false })).rejects.toMatchObject({
      code: 'ACTIVE_PARENT_DEPENDS_ON_PRODUCT',
    });
  });

  it('preserves archived-parent composition history and allows sources to archive afterward', async () => {
    const parent = product('parent');
    const glass = material('glass');
    const { componentService, productRepository, materialRepository } = setup(
      [parent],
      [glass],
      [component('vessel', 'parent', 'material', 'glass')],
    );
    const productService = new ProductService(
      productRepository,
      new InMemoryMixPresetRepository(),
      componentService,
    );
    const materialService = new MaterialService(materialRepository, async () => [], componentService);

    await productService.archiveProduct('parent');
    await materialService.archiveMaterial('glass');

    expect((await componentService.getComponent('vessel'))?.sourceId).toBe('glass');
    expect((await productRepository.findById('parent'))?.isActive).toBe(false);
    expect((await materialRepository.findById('glass'))?.isActive).toBe(false);
  });

  it('rejects reactivation when historical component sources are archived', async () => {
    const parent = product('parent', false);
    const glass = material('glass', false);
    const { componentService, productRepository } = setup(
      [parent],
      [glass],
      [component('vessel', 'parent', 'material', 'glass')],
    );
    const productService = new ProductService(
      productRepository,
      new InMemoryMixPresetRepository(),
      componentService,
    );

    await expect(productService.updateProduct('parent', { isActive: true })).rejects.toMatchObject({
      code: 'SOURCE_MATERIAL_INACTIVE',
    });
  });

  it('uses typed application errors for missing component removal', async () => {
    const { componentService } = setup();
    await expect(componentService.removeComponent('missing')).rejects.toBeInstanceOf(
      ProductComponentApplicationError,
    );
  });
});
