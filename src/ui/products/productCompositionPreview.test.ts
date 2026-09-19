import { describe, expect, it } from 'vitest';
import type { Material } from '../../domain/materials';
import type { ProductComponent } from '../../domain/productComponents';
import type { Product } from '../../domain/products';
import { buildProductCompositionPreview } from './productCompositionPreview';

function product(id: string, name = id, isActive = true): Product {
  return {
    id,
    name,
    category: 'candle',
    safetyWasteRate: 0,
    isActive,
  };
}

function material(id: string, name = id, isActive = true): Material {
  return {
    id,
    name,
    group: 'accessory',
    baseUnit: 'pc',
    purchaseQuantity: 1,
    purchaseUnit: 'pc',
    packageCost: 1,
    onHandQuantity: 0,
    onHandUnit: 'pc',
    isActive,
  };
}

function component(
  id: string,
  parentProductId: string,
  sourceType: ProductComponent['sourceType'],
  sourceId: string,
  quantityPerParent = 1,
  role: ProductComponent['role'] = 'other',
): ProductComponent {
  return {
    id,
    parentProductId,
    sourceType,
    sourceId,
    quantityPerParent,
    role,
  };
}

describe('buildProductCompositionPreview', () => {
  it('returns an empty preview for a product with no component lines', () => {
    expect(buildProductCompositionPreview('PARENT', [product('PARENT')], [], [])).toEqual([]);
  });

  it('builds a material leaf with readable identity and active state', () => {
    const result = buildProductCompositionPreview(
      'PARENT',
      [product('PARENT')],
      [material('JAR', 'Glass Jar')],
      [component('C1', 'PARENT', 'material', 'JAR', 2, 'vessel')],
    );

    expect(result).toEqual([
      expect.objectContaining({
        componentId: 'C1',
        sourceType: 'material',
        sourceId: 'JAR',
        sourceName: 'Glass Jar',
        quantityPerParent: 2,
        role: 'vessel',
        sourceIsActive: true,
        children: [],
      }),
    ]);
  });

  it('builds nested product children recursively', () => {
    const result = buildProductCompositionPreview(
      'GIFT',
      [product('GIFT', 'Gift Box'), product('CANDLE', 'Candle'), product('POT', 'Handmade Pot')],
      [],
      [
        component('C1', 'GIFT', 'product', 'CANDLE', 1, 'insert'),
        component('C2', 'CANDLE', 'product', 'POT', 1, 'vessel'),
      ],
    );

    expect(result[0]?.sourceName).toBe('Candle');
    expect(result[0]?.children[0]).toEqual(
      expect.objectContaining({
        sourceId: 'POT',
        sourceName: 'Handmade Pot',
        role: 'vessel',
      }),
    );
  });

  it('preserves quantity and role at every nesting level', () => {
    const result = buildProductCompositionPreview(
      'A',
      [product('A'), product('B')],
      [material('M')],
      [
        component('AB', 'A', 'product', 'B', 3, 'molded-component'),
        component('BM', 'B', 'material', 'M', 4, 'accessory'),
      ],
    );

    expect(result[0]?.quantityPerParent).toBe(3);
    expect(result[0]?.role).toBe('molded-component');
    expect(result[0]?.children[0]?.quantityPerParent).toBe(4);
    expect(result[0]?.children[0]?.role).toBe('accessory');
  });

  it('orders lines deterministically by source type, source identity, then component id', () => {
    const result = buildProductCompositionPreview(
      'P',
      [product('P'), product('B'), product('A')],
      [material('Z'), material('A')],
      [
        component('4', 'P', 'product', 'B'),
        component('3', 'P', 'material', 'Z'),
        component('2', 'P', 'product', 'A'),
        component('1', 'P', 'material', 'A'),
      ],
    );

    expect(result.map((node) => `${node.sourceType}:${node.sourceId}`)).toEqual([
      'material:A',
      'material:Z',
      'product:A',
      'product:B',
    ]);
  });

  it('uses source id fallback and marks missing material source', () => {
    const result = buildProductCompositionPreview(
      'P',
      [product('P')],
      [],
      [component('C1', 'P', 'material', 'MISSING')],
    );

    expect(result[0]).toEqual(
      expect.objectContaining({
        sourceName: 'MISSING',
        sourceIsActive: null,
        issue: 'missing-source',
      }),
    );
  });

  it('uses source id fallback and marks missing product source', () => {
    const result = buildProductCompositionPreview(
      'P',
      [product('P')],
      [],
      [component('C1', 'P', 'product', 'MISSING')],
    );

    expect(result[0]).toEqual(
      expect.objectContaining({
        sourceName: 'MISSING',
        sourceIsActive: null,
        issue: 'missing-source',
        children: [],
      }),
    );
  });

  it('preserves archived source visibility for historical inspection', () => {
    const result = buildProductCompositionPreview(
      'P',
      [product('P'), product('OLD', 'Archived Child', false)],
      [material('OLD-M', 'Archived Material', false)],
      [
        component('C1', 'P', 'material', 'OLD-M'),
        component('C2', 'P', 'product', 'OLD'),
      ],
    );

    expect(result.find((node) => node.sourceId === 'OLD-M')?.sourceIsActive).toBe(false);
    expect(result.find((node) => node.sourceId === 'OLD')?.sourceIsActive).toBe(false);
  });

  it('guards corrupted cycles instead of recursing indefinitely', () => {
    const result = buildProductCompositionPreview(
      'A',
      [product('A'), product('B'), product('C')],
      [],
      [
        component('AB', 'A', 'product', 'B'),
        component('BC', 'B', 'product', 'C'),
        component('CA', 'C', 'product', 'A'),
      ],
    );

    const cycleNode = result[0]?.children[0]?.children[0];
    expect(cycleNode).toEqual(
      expect.objectContaining({
        sourceId: 'A',
        sourceName: 'A',
        issue: 'cycle',
        children: [],
      }),
    );
  });
});
