import { describe, expect, it } from 'vitest';
import type { FixedRecipeItem } from '../../domain/fixedRecipeItems';
import type { Material } from '../../domain/materials';
import type { Product } from '../../domain/products';
import type { YieldSample } from '../../domain/yieldSamples';
import { InMemoryCalibrationRepository } from '../calibrations/InMemoryCalibrationRepository';
import { InMemoryMaterialRepository } from '../materials/InMemoryMaterialRepository';
import { InMemoryProductRepository } from '../products/InMemoryProductRepository';
import { FixedRecipeItemService } from '../recipeItems/FixedRecipeItemService';
import { InMemoryFixedRecipeItemRepository } from '../recipeItems/InMemoryFixedRecipeItemRepository';
import { InMemoryYieldSampleRepository } from '../yieldSamples/InMemoryYieldSampleRepository';
import { YieldHistoryService } from '../yieldSamples/YieldHistoryService';
import {
  EffectiveRecipeRequirementService,
  EffectiveRecipeRequirementServiceError,
} from './EffectiveRecipeRequirementService';

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

const yieldSample: YieldSample = {
  id: 'YS-CND-001',
  productId: 'CND-001',
  materialInputs: [{ materialId: 'MAT-WAX', quantity: 500, unit: 'g' }],
  goodPieces: 10,
  rejectedPieces: 0,
  recordedAt: '2026-09-14T10:00:00.000Z',
};

const wickItem: FixedRecipeItem = {
  id: 'RI-WICK',
  productId: 'CND-001',
  materialId: 'MAT-WICK',
  quantityPerProduct: 1,
  unit: 'pc',
  role: 'finish',
};

function makeService(options: {
  product?: Product;
  materials?: Material[];
  samples?: YieldSample[];
  items?: FixedRecipeItem[];
} = {}) {
  const products = new InMemoryProductRepository(options.product ? [options.product] : [product]);
  const materials = new InMemoryMaterialRepository(options.materials ?? [wax, wick]);
  const calibrations = new InMemoryCalibrationRepository();
  const samples = new InMemoryYieldSampleRepository(options.samples ?? [yieldSample]);
  const recipeRepository = new InMemoryFixedRecipeItemRepository(options.items ?? [wickItem]);

  const history = new YieldHistoryService(samples, products, materials, calibrations);
  const fixedRecipes = new FixedRecipeItemService(
    recipeRepository,
    products,
    materials,
    calibrations,
  );

  return new EffectiveRecipeRequirementService(products, history, fixedRecipes);
}

describe('EffectiveRecipeRequirementService', () => {
  it('combines effective yield learning with fixed recipe lines', async () => {
    const result = await makeService().deriveForProduct('cnd-001');

    expect(result.status).toBe('ready');
    expect(result.effectiveYieldSampleId).toBe('YS-CND-001');
    expect(result.issues).toEqual([]);
    expect(result.requirements).toEqual([
      expect.objectContaining({
        materialId: 'MAT-WAX',
        baseUnit: 'g',
        baseQuantityPerProduct: 50,
        source: 'yield',
      }),
      expect.objectContaining({
        materialId: 'MAT-WICK',
        baseUnit: 'pc',
        baseQuantityPerProduct: 1,
        source: 'fixed',
      }),
    ]);
  });

  it('uses the Product preferred Yield sample in downstream effective requirements', async () => {
    const older: YieldSample = {
      ...yieldSample,
      id: 'YS-OLD',
      materialInputs: [{ materialId: 'MAT-WAX', quantity: 800, unit: 'g' }],
      goodPieces: 10,
      recordedAt: '2026-09-13T10:00:00.000Z',
    };
    const newer: YieldSample = {
      ...yieldSample,
      id: 'YS-NEW',
      materialInputs: [{ materialId: 'MAT-WAX', quantity: 500, unit: 'g' }],
      goodPieces: 10,
      recordedAt: '2026-09-14T10:00:00.000Z',
    };

    const result = await makeService({
      product: { ...product, preferredYieldSampleId: 'YS-OLD' },
      samples: [older, newer],
    }).deriveForProduct('CND-001');

    expect(result.effectiveYieldSampleId).toBe('YS-OLD');
    expect(result.requirements).toContainEqual(
      expect.objectContaining({
        materialId: 'MAT-WAX',
        baseQuantityPerProduct: 80,
        source: 'yield',
      }),
    );
  });

  it('combines fixed and yield contributions for the same material', async () => {
    const waxTopUp: FixedRecipeItem = {
      id: 'RI-WAX-TOPUP',
      productId: 'CND-001',
      materialId: 'MAT-WAX',
      quantityPerProduct: 5,
      unit: 'g',
      role: 'other',
    };

    const result = await makeService({ items: [waxTopUp] }).deriveForProduct('CND-001');
    expect(result.requirements).toEqual([
      expect.objectContaining({
        materialId: 'MAT-WAX',
        baseQuantityPerProduct: 55,
        source: 'combined',
      }),
    ]);
    expect(result.requirements[0].contributions).toHaveLength(2);
  });

  it('treats a fixed-only product as ready when valid requirements exist', async () => {
    const result = await makeService({ samples: [] }).deriveForProduct('CND-001');

    expect(result.status).toBe('ready');
    expect(result.effectiveYieldSampleId).toBeNull();
    expect(result.requirements).toEqual([
      expect.objectContaining({ materialId: 'MAT-WICK', source: 'fixed' }),
    ]);
  });

  it('returns partial readiness when yield history exists but is currently non-derivable', async () => {
    const plaster: Material = {
      id: 'MAT-PLASTER',
      name: 'Plaster',
      group: 'plaster',
      baseUnit: 'g',
      purchaseQuantity: 1,
      purchaseUnit: 'kg',
      packageCost: 66,
      onHandQuantity: 1,
      onHandUnit: 'kg',
      isActive: true,
    };
    const brokenSample: YieldSample = {
      id: 'YS-BROKEN',
      productId: 'CND-001',
      materialInputs: [{ materialId: 'MAT-PLASTER', quantity: 2, unit: 'cup' }],
      goodPieces: 4,
      rejectedPieces: 0,
      recordedAt: '2026-09-14T11:00:00.000Z',
    };

    const result = await makeService({
      materials: [plaster, wick],
      samples: [brokenSample],
    }).deriveForProduct('CND-001');

    expect(result.status).toBe('partial');
    expect(result.requirements).toEqual([
      expect.objectContaining({ materialId: 'MAT-WICK', source: 'fixed' }),
    ]);
    expect(result.issues).toEqual([
      expect.objectContaining({ code: 'YIELD_HISTORY_NOT_DERIVABLE' }),
    ]);
  });

  it('returns partial readiness when a stored fixed line can no longer be derived', async () => {
    const missingMaterialItem: FixedRecipeItem = {
      id: 'RI-MISSING',
      productId: 'CND-001',
      materialId: 'MAT-MISSING',
      quantityPerProduct: 1,
      unit: 'pc',
      role: 'other',
    };

    const result = await makeService({ items: [missingMaterialItem] }).deriveForProduct('CND-001');

    expect(result.status).toBe('partial');
    expect(result.requirements).toEqual([
      expect.objectContaining({ materialId: 'MAT-WAX', source: 'yield' }),
    ]);
    expect(result.issues).toEqual([
      expect.objectContaining({ code: 'FIXED_ITEM_NOT_DERIVABLE', sourceId: 'RI-MISSING' }),
    ]);
  });

  it('returns not-ready when a product has no usable yield or fixed requirement', async () => {
    const result = await makeService({ samples: [], items: [] }).deriveForProduct('CND-001');

    expect(result.status).toBe('not-ready');
    expect(result.requirements).toEqual([]);
    expect(result.issues).toEqual([
      expect.objectContaining({ code: 'NO_REQUIREMENTS' }),
    ]);
  });

  it('supports archived products for historical requirement inspection', async () => {
    const result = await makeService({ product: { ...product, isActive: false } }).deriveForProduct('CND-001');
    expect(result.productIsActive).toBe(false);
    expect(result.status).toBe('ready');
  });

  it('returns a controlled error for a missing product', async () => {
    await expect(makeService().deriveForProduct('MISSING')).rejects.toEqual(
      expect.objectContaining<Partial<EffectiveRecipeRequirementServiceError>>({
        code: 'PRODUCT_NOT_FOUND',
        productId: 'MISSING',
      }),
    );
  });
});
