import { describe, expect, it } from 'vitest';
import type { ProductComponent } from '../../domain/productComponents';
import type { ProductStock } from '../../domain/productStock';
import type { Product } from '../../domain/products';
import { buildProductStockRows } from './productStockRows';

function product(id: string, name = id, isActive = true): Product {
  return {
    id,
    name,
    category: 'candle',
    safetyWasteRate: 0,
    isActive,
  };
}

function productComponent(
  id: string,
  parentProductId: string,
  sourceId: string,
): ProductComponent {
  return {
    id,
    parentProductId,
    sourceType: 'product',
    sourceId,
    role: 'molded-component',
    quantityPerParent: 1,
  };
}

function materialComponent(id: string, parentProductId: string, sourceId: string): ProductComponent {
  return {
    id,
    parentProductId,
    sourceType: 'material',
    sourceId,
    role: 'vessel',
    quantityPerParent: 1,
  };
}

function stock(productId: string, onHandQuantity: number, notes?: string): ProductStock {
  return { productId, onHandQuantity, notes };
}

describe('buildProductStockRows', () => {
  it('represents a current child Product with missing ProductStock as missing with null quantity', () => {
    const rows = buildProductStockRows(
      [product('PARENT', 'Parent'), product('CHILD', 'Child')],
      [productComponent('C1', 'PARENT', 'CHILD')],
      [],
    );

    expect(rows).toEqual([
      expect.objectContaining({
        productId: 'CHILD',
        stockState: 'missing',
        onHandQuantity: null,
        stockRecordExists: false,
        usedAsChild: true,
      }),
    ]);
  });

  it('keeps explicit zero distinguishable from missing stock', () => {
    const rows = buildProductStockRows(
      [product('PARENT'), product('CHILD')],
      [productComponent('C1', 'PARENT', 'CHILD')],
      [stock('CHILD', 0)],
    );

    expect(rows[0]).toMatchObject({
      stockState: 'zero',
      onHandQuantity: 0,
      stockRecordExists: true,
    });
  });

  it('marks positive ProductStock as available', () => {
    const rows = buildProductStockRows(
      [product('PARENT'), product('CHILD')],
      [productComponent('C1', 'PARENT', 'CHILD')],
      [stock('CHILD', 12)],
    );

    expect(rows[0]).toMatchObject({ stockState: 'available', onHandQuantity: 12 });
  });

  it('ignores material-backed component lines when deriving Product stock rows', () => {
    const rows = buildProductStockRows(
      [product('PARENT')],
      [materialComponent('C1', 'PARENT', 'JAR')],
      [],
    );

    expect(rows).toEqual([]);
  });

  it('deduplicates multiple parent relationships while preserving readable parent context', () => {
    const rows = buildProductStockRows(
      [
        product('A', 'Alpha Parent'),
        product('B', 'Beta Parent'),
        product('CHILD', 'Child'),
      ],
      [
        productComponent('C1', 'B', 'CHILD'),
        productComponent('C2', 'A', 'CHILD'),
        productComponent('C3', 'A', 'CHILD'),
      ],
      [],
    );

    expect(rows[0]?.parentProductIds).toEqual(['A', 'B']);
    expect(rows[0]?.parentProductNames).toEqual(['Alpha Parent', 'Beta Parent']);
  });

  it('keeps archived Products visible when they are current child components', () => {
    const rows = buildProductStockRows(
      [product('PARENT'), product('CHILD', 'Archived Child', false)],
      [productComponent('C1', 'PARENT', 'CHILD')],
      [],
    );

    expect(rows[0]).toMatchObject({ productId: 'CHILD', productIsActive: false });
  });

  it('keeps existing ProductStock visible even when the Product is no longer referenced as a child', () => {
    const rows = buildProductStockRows(
      [product('STOCKED', 'Stocked Product')],
      [],
      [stock('STOCKED', 4, 'historical count')],
    );

    expect(rows[0]).toMatchObject({
      productId: 'STOCKED',
      usedAsChild: false,
      stockState: 'available',
      notes: 'historical count',
    });
  });

  it('excludes Products with neither child-component usage nor an existing stock record', () => {
    const rows = buildProductStockRows([product('UNUSED')], [], []);
    expect(rows).toEqual([]);
  });

  it('sorts rows deterministically by Product name then ID', () => {
    const rows = buildProductStockRows(
      [
        product('Z', 'Bravo'),
        product('B', 'alpha'),
        product('A', 'Alpha'),
      ],
      [],
      [stock('Z', 1), stock('B', 1), stock('A', 1)],
    );

    expect(rows.map((row) => row.productId)).toEqual(['A', 'B', 'Z']);
  });

  it('preserves stock notes in the derived row', () => {
    const rows = buildProductStockRows(
      [product('CHILD')],
      [],
      [stock('CHILD', 2, 'top shelf')],
    );

    expect(rows[0]?.notes).toBe('top shelf');
  });

  it('does not invent an editable row for a Product-backed component whose source Product is missing', () => {
    const rows = buildProductStockRows(
      [product('PARENT')],
      [productComponent('C1', 'PARENT', 'MISSING')],
      [],
    );

    expect(rows).toEqual([]);
  });
});
