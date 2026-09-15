import { describe, expect, it } from 'vitest';
import type { Material } from '../../domain/materials';
import type { ProductComponent } from '../../domain/productComponents';
import type { ProductStock } from '../../domain/productStock';
import type { Product } from '../../domain/products';
import { InMemoryMaterialRepository } from '../materials/InMemoryMaterialRepository';
import { InMemoryProductRepository } from '../products/InMemoryProductRepository';
import { InMemoryProductStockRepository } from '../productStocks/InMemoryProductStockRepository';
import {
  ComponentCapacityService,
  type ComponentCapacityAvailabilityProvider,
} from './ComponentCapacityService';
import {
  ComponentSourceAvailabilityService,
  type ComponentSourceAvailability,
} from './ComponentSourceAvailabilityService';

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
  sourceType: 'material' | 'product',
  sourceId: string,
  overrides: Partial<ProductComponent> = {},
): ProductComponent {
  return {
    id,
    parentProductId: 'parent-a',
    sourceType,
    sourceId,
    role: sourceType === 'material' ? 'vessel' : 'molded-component',
    quantityPerParent: 1,
    ...overrides,
  };
}

function setup(
  materials: Material[] = [],
  products: Product[] = [],
  stocks: ProductStock[] = [],
) {
  const availability = new ComponentSourceAvailabilityService(
    new InMemoryMaterialRepository(materials),
    new InMemoryProductRepository(products),
    new InMemoryProductStockRepository(stocks),
  );
  return new ComponentCapacityService(availability);
}

describe('ComponentCapacityService', () => {
  it('derives Material-backed parent capacity from ready 3.2C availability', async () => {
    const service = setup([material({ id: 'jar', onHandQuantity: 12 })]);

    const result = await service.capacityForComponent(
      component('jar-line', 'material', 'jar', { quantityPerParent: 2 }),
    );

    expect(result).toMatchObject({
      componentId: 'jar-line',
      parentProductId: 'parent-a',
      sourceType: 'material',
      sourceId: 'jar',
      role: 'vessel',
      quantityPerParent: 2,
      status: 'ready',
      availableQuantity: 12,
      unit: 'pc',
      capacityPieces: 6,
      issues: [],
    });
    expect(result.sourceAvailability?.materialInventoryNormalization).toMatchObject({
      normalizedBaseQuantity: 12,
      baseUnit: 'pc',
      conversionSource: 'standard',
    });
  });

  it('preserves Material package/on-hand normalization evidence before capacity math', async () => {
    const service = setup([
      material({
        id: 'boxed-jars',
        purchaseUnit: 'box',
        manualBaseUnitsPerPurchaseUnit: 50,
        onHandQuantity: 2,
        onHandUnit: 'box',
      }),
    ]);

    const result = await service.capacityForComponent(
      component('boxed-line', 'material', 'boxed-jars', { quantityPerParent: 5 }),
    );

    expect(result).toMatchObject({
      status: 'ready',
      availableQuantity: 100,
      capacityPieces: 20,
    });
    expect(result.sourceAvailability?.materialInventoryNormalization).toMatchObject({
      normalizedBaseQuantity: 100,
      baseUnitsPerOnHandUnit: 50,
      conversionSource: 'purchase-package',
      purchasePackageConversionSource: 'manual',
    });
  });

  it('derives Product-backed parent capacity from explicit ProductStock only', async () => {
    const service = setup([], [product('mini-heart')], [stock('mini-heart', 11)]);

    const result = await service.capacityForComponent(
      component('heart-line', 'product', 'mini-heart', { quantityPerParent: 3 }),
    );

    expect(result).toMatchObject({
      sourceType: 'product',
      sourceId: 'mini-heart',
      status: 'ready',
      availableQuantity: 11,
      capacityPieces: 3,
    });
    expect(result.sourceAvailability?.productStock).toEqual({
      productId: 'mini-heart',
      onHandQuantity: 11,
    });
  });

  it('floors capacity when current availability has a remainder', async () => {
    const service = setup([], [product('star')], [stock('star', 10)]);
    const result = await service.capacityForComponent(
      component('star-line', 'product', 'star', { quantityPerParent: 4 }),
    );
    expect(result.capacityPieces).toBe(2);
  });

  it('returns ready zero capacity when availability is below one parent requirement', async () => {
    const service = setup([], [product('flower')], [stock('flower', 2)]);
    const result = await service.capacityForComponent(
      component('flower-line', 'product', 'flower', { quantityPerParent: 3 }),
    );
    expect(result).toMatchObject({ status: 'ready', availableQuantity: 2, capacityPieces: 0 });
  });

  it('treats explicit zero Material stock as ready zero capacity', async () => {
    const service = setup([material({ id: 'empty-jar', onHandQuantity: 0 })]);
    const result = await service.capacityForComponent(
      component('empty-jar-line', 'material', 'empty-jar', { quantityPerParent: 2 }),
    );
    expect(result).toMatchObject({ status: 'ready', availableQuantity: 0, capacityPieces: 0 });
  });

  it('treats explicit zero ProductStock as ready zero capacity', async () => {
    const service = setup([], [product('empty-child')], [stock('empty-child', 0)]);
    const result = await service.capacityForComponent(
      component('empty-child-line', 'product', 'empty-child'),
    );
    expect(result).toMatchObject({ status: 'ready', availableQuantity: 0, capacityPieces: 0 });
  });

  it('keeps missing ProductStock partial instead of silently treating it as zero', async () => {
    const service = setup([], [product('child')]);
    const result = await service.capacityForComponent(component('child-line', 'product', 'child'));
    expect(result).toMatchObject({
      status: 'partial',
      availableQuantity: null,
      capacityPieces: null,
      issues: [
        {
          code: 'SOURCE_AVAILABILITY_PARTIAL',
          underlyingCode: 'SOURCE_PRODUCT_STOCK_MISSING',
        },
      ],
    });
  });

  it('keeps invalid ProductStock partial with no numeric capacity', async () => {
    const service = setup([], [product('child')], [stock('child', -1)]);
    const result = await service.capacityForComponent(component('child-line', 'product', 'child'));
    expect(result).toMatchObject({
      status: 'partial',
      availableQuantity: null,
      capacityPieces: null,
      issues: [{ underlyingCode: 'SOURCE_PRODUCT_STOCK_INVALID' }],
    });
  });

  it('keeps unresolved Material inventory conversion partial with traceable issue', async () => {
    const service = setup([
      material({
        id: 'boxed',
        purchaseUnit: 'box',
        manualBaseUnitsPerPurchaseUnit: undefined,
        onHandQuantity: 2,
        onHandUnit: 'box',
      }),
    ]);
    const result = await service.capacityForComponent(component('boxed-line', 'material', 'boxed'));
    expect(result).toMatchObject({
      status: 'partial',
      availableQuantity: null,
      capacityPieces: null,
      issues: [{ underlyingCode: 'SOURCE_MATERIAL_INVENTORY_UNRESOLVED' }],
    });
  });

  it('keeps negative normalized Material inventory partial with no capacity', async () => {
    const service = setup([material({ id: 'negative', onHandQuantity: -2 })]);
    const result = await service.capacityForComponent(component('negative-line', 'material', 'negative'));
    expect(result).toMatchObject({
      status: 'partial',
      availableQuantity: null,
      capacityPieces: null,
      issues: [{ underlyingCode: 'SOURCE_MATERIAL_NEGATIVE_ON_HAND' }],
    });
  });

  it('returns not-ready for a missing Material source', async () => {
    const result = await setup().capacityForComponent(component('missing-line', 'material', 'missing'));
    expect(result).toMatchObject({
      status: 'not-ready',
      capacityPieces: null,
      issues: [{ underlyingCode: 'SOURCE_MATERIAL_NOT_FOUND' }],
    });
  });

  it('returns not-ready for an inactive Material source', async () => {
    const service = setup([material({ id: 'archived', isActive: false })]);
    const result = await service.capacityForComponent(component('archived-line', 'material', 'archived'));
    expect(result).toMatchObject({
      status: 'not-ready',
      capacityPieces: null,
      issues: [{ underlyingCode: 'SOURCE_MATERIAL_INACTIVE' }],
    });
  });

  it('returns not-ready for a non-count Material source', async () => {
    const service = setup([
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
    const result = await service.capacityForComponent(component('wax-line', 'material', 'wax'));
    expect(result).toMatchObject({
      status: 'not-ready',
      capacityPieces: null,
      issues: [{ underlyingCode: 'SOURCE_MATERIAL_NOT_COUNT_BASED' }],
    });
  });

  it('returns not-ready for a missing Product source', async () => {
    const result = await setup().capacityForComponent(component('missing-line', 'product', 'missing'));
    expect(result).toMatchObject({
      status: 'not-ready',
      capacityPieces: null,
      issues: [{ underlyingCode: 'SOURCE_PRODUCT_NOT_FOUND' }],
    });
  });

  it('returns not-ready for an inactive Product source', async () => {
    const service = setup([], [product('archived-child', false)], [stock('archived-child', 10)]);
    const result = await service.capacityForComponent(
      component('archived-child-line', 'product', 'archived-child'),
    );
    expect(result).toMatchObject({
      status: 'not-ready',
      capacityPieces: null,
      issues: [{ underlyingCode: 'SOURCE_PRODUCT_INACTIVE' }],
    });
  });

  it('returns a controlled not-ready result for an invalid ProductComponent contract', async () => {
    let availabilityCalls = 0;
    const availability: ComponentCapacityAvailabilityProvider = {
      async resolveComponent() {
        availabilityCalls += 1;
        throw new Error('should not be called');
      },
    };
    const service = new ComponentCapacityService(availability);
    const invalid = component('invalid-line', 'product', 'child', { quantityPerParent: 0 });

    const result = await service.capacityForComponent(invalid);

    expect(result).toMatchObject({
      status: 'not-ready',
      capacityPieces: null,
      sourceAvailability: null,
      issues: [{ code: 'INVALID_COMPONENT' }],
    });
    expect(availabilityCalls).toBe(0);
  });

  it('preserves exact component/source identity, role, quantity, and pc unit', async () => {
    const service = setup([material({ id: 'Canonical-Jar', onHandQuantity: 9 })]);
    const result = await service.capacityForComponent(
      component(' line-1 ', 'material', ' canonical-jar ', {
        parentProductId: ' parent-x ',
        role: 'accessory',
        quantityPerParent: 2,
      }),
    );

    expect(result).toMatchObject({
      componentId: 'line-1',
      parentProductId: 'parent-x',
      role: 'accessory',
      sourceType: 'material',
      sourceId: 'Canonical-Jar',
      quantityPerParent: 2,
      unit: 'pc',
      capacityPieces: 4,
    });
  });

  it('defensively rejects a corrupted ready availability with no quantity', async () => {
    const availability: ComponentCapacityAvailabilityProvider = {
      async resolveComponent(candidate) {
        return {
          sourceType: candidate.sourceType,
          sourceId: candidate.sourceId,
          status: 'ready',
          availableQuantity: null,
          unit: 'pc',
          issues: [],
        };
      },
    };
    const result = await new ComponentCapacityService(availability).capacityForComponent(
      component('line', 'product', 'child'),
    );
    expect(result).toMatchObject({
      status: 'partial',
      availableQuantity: null,
      capacityPieces: null,
      issues: [{ code: 'AVAILABLE_QUANTITY_INVALID' }],
    });
  });

  it('defensively rejects non-finite ready availability instead of publishing capacity', async () => {
    const availability: ComponentCapacityAvailabilityProvider = {
      async resolveComponent(candidate) {
        return {
          sourceType: candidate.sourceType,
          sourceId: candidate.sourceId,
          status: 'ready',
          availableQuantity: Number.NaN,
          unit: 'pc',
          issues: [],
        };
      },
    };
    const result = await new ComponentCapacityService(availability).capacityForComponent(
      component('line', 'material', 'jar'),
    );
    expect(result).toMatchObject({
      status: 'partial',
      availableQuantity: null,
      capacityPieces: null,
      issues: [
        {
          code: 'AVAILABLE_QUANTITY_INVALID',
          underlyingCode: 'INVALID_AVAILABLE_QUANTITY',
        },
      ],
    });
  });

  it('returns a defensive availability snapshot instead of mutating provider evidence', async () => {
    const source: ComponentSourceAvailability = {
      sourceType: 'product',
      sourceId: 'child',
      status: 'ready',
      availableQuantity: 6,
      unit: 'pc',
      issues: [],
      productStock: { productId: 'child', onHandQuantity: 6, notes: 'original' },
    };
    const availability: ComponentCapacityAvailabilityProvider = {
      async resolveComponent() {
        return source;
      },
    };
    const result = await new ComponentCapacityService(availability).capacityForComponent(
      component('line', 'product', 'child', { quantityPerParent: 2 }),
    );

    result.sourceAvailability!.productStock!.notes = 'changed';
    result.sourceAvailability!.issues.push({ code: 'SOURCE_PRODUCT_STOCK_MISSING', message: 'changed' });

    expect(source.productStock?.notes).toBe('original');
    expect(source.issues).toEqual([]);
    expect(result.capacityPieces).toBe(3);
  });

  it('does not mutate the source ProductComponent', async () => {
    const service = setup([], [product('child')], [stock('child', 8)]);
    const input = component('line', 'product', 'child', { quantityPerParent: 2, notes: 'keep' });
    const before = structuredClone(input);

    await service.capacityForComponent(input);

    expect(input).toEqual(before);
  });

  it('does not leak Product-level capacity or limiting-resource semantics into 3.4A', async () => {
    const service = setup([], [product('child')], [stock('child', 8)]);
    const result = await service.capacityForComponent(
      component('line', 'product', 'child', { quantityPerParent: 2 }),
    );
    expect(result).not.toHaveProperty('overallCapacity');
    expect(result).not.toHaveProperty('produciblePieces');
    expect(result).not.toHaveProperty('isLimiting');
    expect(result).not.toHaveProperty('limitingResources');
  });
});
