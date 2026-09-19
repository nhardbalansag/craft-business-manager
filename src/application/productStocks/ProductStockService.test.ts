import { describe, expect, it } from 'vitest';
import { ProductStockError, type ProductStock } from '../../domain/productStock';
import type { Product } from '../../domain/products';
import { InMemoryMixPresetRepository } from '../mixPresets/InMemoryMixPresetRepository';
import { InMemoryProductRepository } from '../products/InMemoryProductRepository';
import { ProductService } from '../products/ProductService';
import { InMemoryProductStockRepository } from './InMemoryProductStockRepository';
import {
  ProductStockApplicationError,
  ProductStockService,
} from './ProductStockService';

function product(id: string, isActive = true): Product {
  return {
    id,
    name: `Product ${id}`,
    category: 'candle',
    safetyWasteRate: 0,
    isActive,
  };
}

function stock(
  productId: string,
  onHandQuantity: number,
  notes?: string,
): ProductStock {
  return { productId, onHandQuantity, notes };
}

function setup(products: Product[] = [], stocks: ProductStock[] = []) {
  const productRepository = new InMemoryProductRepository(products);
  const stockRepository = new InMemoryProductStockRepository(stocks);
  const stockService = new ProductStockService(stockRepository, productRepository);
  return { productRepository, stockRepository, stockService };
}

describe('ProductStockService', () => {
  it('sets stock and replaces the same Product identity instead of duplicating records', async () => {
    const { stockService, stockRepository } = setup([product('candle-a')]);

    await stockService.setStock('candle-a', 4, 'first count');
    const updated = await stockService.setStock('CANDLE-A', 7, 'updated count');

    expect(updated).toEqual({
      productId: 'candle-a',
      onHandQuantity: 7,
      notes: 'updated count',
    });
    expect(await stockRepository.list()).toHaveLength(1);
  });

  it('canonicalizes Product identity from ProductRepository and supports trimmed lookup', async () => {
    const { stockService } = setup([product('Candle-A')]);

    const saved = await stockService.setStock('  candle-a  ', 3);

    expect(saved.productId).toBe('Candle-A');
    expect(await stockService.getStock(' CANDLE-A ')).toEqual({
      productId: 'Candle-A',
      onHandQuantity: 3,
      notes: undefined,
    });
  });

  it('keeps explicit zero distinguishable from missing stock', async () => {
    const { stockService } = setup([product('known-zero'), product('missing-stock')]);

    await stockService.setStock('known-zero', 0);

    expect((await stockService.getStock('known-zero'))?.onHandQuantity).toBe(0);
    expect(await stockService.getStock('missing-stock')).toBeNull();
  });

  it('rejects stock writes for a missing Product', async () => {
    const { stockService } = setup();

    await expect(stockService.setStock('missing', 1)).rejects.toBeInstanceOf(
      ProductStockApplicationError,
    );
    await expect(stockService.setStock('missing', 1)).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      productId: 'missing',
    });
  });

  it('preserves and permits correction of stock for an archived Product', async () => {
    const { stockService } = setup(
      [product('archived', false)],
      [stock('archived', 6, 'before archive review')],
    );

    expect((await stockService.getStock('archived'))?.onHandQuantity).toBe(6);

    const corrected = await stockService.setStock('archived', 5, 'physical recount');
    expect(corrected).toEqual({
      productId: 'archived',
      onHandQuantity: 5,
      notes: 'physical recount',
    });
  });

  it('lists, filters, searches, and sorts stock records deterministically', async () => {
    const { stockService } = setup(
      [product('beta'), product('Alpha'), product('charlie')],
      [
        stock('beta', 2, 'back shelf'),
        stock('Alpha', 1, 'front shelf'),
        stock('charlie', 3, 'overflow'),
      ],
    );

    expect((await stockService.listStocks()).map((item) => item.productId)).toEqual([
      'Alpha',
      'beta',
      'charlie',
    ]);
    expect(await stockService.listStocks({ productId: ' BETA ' })).toEqual([
      stock('beta', 2, 'back shelf'),
    ]);
    expect((await stockService.listStocks({ query: 'front' })).map((item) => item.productId)).toEqual([
      'Alpha',
    ]);
  });

  it('defensively clones repository seed/write/read values', async () => {
    const seeded = stock('item', 2, 'seeded');
    const repository = new InMemoryProductStockRepository([seeded]);

    seeded.onHandQuantity = 99;
    expect((await repository.findByProductId('item'))?.onHandQuantity).toBe(2);

    const replacement = stock('item', 4, 'replacement');
    await repository.upsert(replacement);
    replacement.onHandQuantity = 100;

    const firstRead = await repository.findByProductId('item');
    expect(firstRead?.onHandQuantity).toBe(4);
    if (firstRead) firstRead.onHandQuantity = 200;
    expect((await repository.findByProductId('item'))?.onHandQuantity).toBe(4);
  });

  it('defensively clones service results', async () => {
    const { stockService } = setup([product('item')]);
    const saved = await stockService.setStock('item', 4, 'counted');

    saved.onHandQuantity = 100;
    saved.notes = 'mutated outside';

    expect(await stockService.getStock('item')).toEqual({
      productId: 'item',
      onHandQuantity: 4,
      notes: 'counted',
    });

    const listed = await stockService.listStocks();
    listed[0]!.onHandQuantity = 300;
    expect((await stockService.getStock('item'))?.onHandQuantity).toBe(4);
  });

  it('enforces the Phase 3.2A quantity contract through service writes', async () => {
    const { stockService } = setup([product('item')]);

    await expect(stockService.setStock('item', -1)).rejects.toBeInstanceOf(ProductStockError);
    await expect(stockService.setStock('item', 1.5)).rejects.toBeInstanceOf(ProductStockError);
    await expect(stockService.setStock('item', Number.NaN)).rejects.toBeInstanceOf(ProductStockError);
  });

  it('does not delete ProductStock when ProductService archives the Product', async () => {
    const { stockService, stockRepository, productRepository } = setup([product('item')]);
    await stockService.setStock('item', 8, 'finished stock');

    const productService = new ProductService(
      productRepository,
      new InMemoryMixPresetRepository(),
    );
    await productService.archiveProduct('item');

    expect((await productRepository.findById('item'))?.isActive).toBe(false);
    expect(await stockRepository.findByProductId('item')).toEqual({
      productId: 'item',
      onHandQuantity: 8,
      notes: 'finished stock',
    });
  });
});
