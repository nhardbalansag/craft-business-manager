import { describe, expect, it } from 'vitest';
import type { FixedRecipeItem } from '../../domain/fixedRecipeItems';
import type { Material } from '../../domain/materials';
import type { Product } from '../../domain/products';
import { InMemoryCalibrationRepository } from '../calibrations/InMemoryCalibrationRepository';
import { InMemoryMaterialRepository } from '../materials/InMemoryMaterialRepository';
import { InMemoryProductRepository } from '../products/InMemoryProductRepository';
import { FixedRecipeItemApplicationError, FixedRecipeItemService } from './FixedRecipeItemService';
import { InMemoryFixedRecipeItemRepository } from './InMemoryFixedRecipeItemRepository';

const product: Product = {
  id: 'CND-001',
  name: 'Scented Candle',
  category: 'candle',
  safetyWasteRate: 0.05,
  isActive: true,
};

const wax: Material = {
  id: 'MAT-WAX',
  name: 'Soy Wax',
  group: 'wax',
  baseUnit: 'g',
  purchaseQuantity: 1,
  purchaseUnit: 'kg',
  packageCost: 200,
  onHandQuantity: 1,
  onHandUnit: 'kg',
  isActive: true,
};

const wick: Material = {
  id: 'MAT-WICK',
  name: 'Cotton Wick',
  group: 'wick',
  baseUnit: 'pc',
  purchaseQuantity: 100,
  purchaseUnit: 'pc',
  packageCost: 120,
  onHandQuantity: 100,
  onHandUnit: 'pc',
  isActive: true,
};

const baseItem: FixedRecipeItem = {
  id: 'RI-WICK',
  productId: 'CND-001',
  materialId: 'MAT-WICK',
  quantityPerProduct: 1,
  unit: 'pc',
  role: 'finish',
};

function makeService(
  items: FixedRecipeItem[] = [],
  products: Product[] = [product],
  materials: Material[] = [wax, wick],
): FixedRecipeItemService {
  return new FixedRecipeItemService(
    new InMemoryFixedRecipeItemRepository(items),
    new InMemoryProductRepository(products),
    new InMemoryMaterialRepository(materials),
    new InMemoryCalibrationRepository(),
  );
}

describe('FixedRecipeItemService', () => {
  it('creates, lists, updates, derives, and removes fixed recipe lines', async () => {
    const service = makeService();

    const created = await service.createItem(baseItem);
    expect(created).toEqual(baseItem);

    const listed = await service.listItems({ productId: 'cnd-001' });
    expect(listed).toHaveLength(1);

    const updated = await service.updateItem('ri-wick', {
      quantityPerProduct: 2,
      notes: 'Trim to final candle height',
    });
    expect(updated.quantityPerProduct).toBe(2);

    const requirement = await service.deriveItemRequirement('RI-WICK');
    expect(requirement.baseQuantityPerProduct).toBe(2);
    expect(requirement.baseUnit).toBe('pc');

    await service.removeItem('RI-WICK');
    expect(await service.getItem('RI-WICK')).toBeNull();
  });

  it('rejects duplicate IDs case-insensitively', async () => {
    const service = makeService([baseItem]);

    await expect(
      service.createItem({
        ...baseItem,
        id: 'ri-wick',
        materialId: 'MAT-WAX',
        quantityPerProduct: 100,
        unit: 'g',
        role: 'consumable',
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<FixedRecipeItemApplicationError>>({
        code: 'DUPLICATE_ITEM_ID',
      }),
    );
  });

  it('allows only one fixed line per product/material regardless of role', async () => {
    const service = makeService([baseItem]);

    await expect(
      service.createItem({
        id: 'RI-WICK-SECOND',
        productId: 'cnd-001',
        materialId: 'mat-wick',
        quantityPerProduct: 1,
        unit: 'pc',
        role: 'packaging',
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<FixedRecipeItemApplicationError>>({
        code: 'DUPLICATE_PRODUCT_MATERIAL',
      }),
    );
  });

  it('requires active product and active material for recipe changes', async () => {
    const archivedProduct = { ...product, isActive: false };
    const archivedMaterial = { ...wick, isActive: false };

    await expect(makeService([], [archivedProduct]).createItem(baseItem)).rejects.toEqual(
      expect.objectContaining<Partial<FixedRecipeItemApplicationError>>({ code: 'PRODUCT_INACTIVE' }),
    );

    await expect(makeService([], [product], [wax, archivedMaterial]).createItem(baseItem)).rejects.toEqual(
      expect.objectContaining<Partial<FixedRecipeItemApplicationError>>({ code: 'MATERIAL_INACTIVE' }),
    );
  });

  it('preserves repository state from mutations to returned objects', async () => {
    const repository = new InMemoryFixedRecipeItemRepository([baseItem]);
    const service = new FixedRecipeItemService(
      repository,
      new InMemoryProductRepository([product]),
      new InMemoryMaterialRepository([wax, wick]),
      new InMemoryCalibrationRepository(),
    );

    const loaded = await service.getItem('RI-WICK');
    if (!loaded) throw new Error('expected item');
    loaded.notes = 'external mutation';

    expect((await service.getItem('RI-WICK'))?.notes).toBeUndefined();
  });
});
