import { describe, expect, it, vi } from 'vitest';
import { CURRENT_BUSINESS_DATASET_SCHEMA_VERSION } from '../../domain/businessDataset';
import type { BusinessDataset } from '../../domain/types';
import type { CompleteSourceSnapshotRepositories } from './CompleteSourceSnapshotService';
import { CompleteSourceSnapshotService } from './CompleteSourceSnapshotService';

function createSourceState(): Omit<BusinessDataset, 'schemaVersion'> {
  return {
    materials: [
      {
        id: 'mat-z',
        name: 'Packaging Box',
        group: 'packaging',
        baseUnit: 'pc',
        purchaseQuantity: 1,
        purchaseUnit: 'box',
        packageCost: 36,
        onHandQuantity: 10,
        onHandUnit: 'pc',
        isActive: true,
      },
      {
        id: 'mat-a',
        name: 'Plaster',
        group: 'plaster',
        baseUnit: 'g',
        purchaseQuantity: 1,
        purchaseUnit: 'kg',
        packageCost: 66,
        onHandQuantity: 1,
        onHandUnit: 'kg',
        source: {
          vendorName: 'Craft Supplier',
          purchaseLink: 'https://example.com/plaster',
        },
        isActive: true,
      },
    ],
    materialCalibrations: [
      {
        id: 'cal-z',
        materialId: 'mat-a',
        measuredVolume: 5,
        volumeUnit: 'cup',
        knownWeight: 1,
        weightUnit: 'kg',
        recordedAt: '2026-09-01T00:00:00.000Z',
      },
      {
        id: 'cal-a',
        materialId: 'mat-a',
        measuredVolume: 1,
        volumeUnit: 'cup',
        knownWeight: 200,
        weightUnit: 'g',
        recordedAt: '2026-09-02T00:00:00.000Z',
      },
    ],
    mixPresets: [
      {
        id: 'mix-z',
        name: 'Secondary Mix',
        compatibleCategories: ['candle-pot'],
        basis: 'weight',
        lines: [{ materialId: 'mat-a', role: 'primary', parts: 1 }],
        isActive: true,
      },
      {
        id: 'mix-a',
        name: 'Primary Mix',
        compatibleCategories: ['paintable-art'],
        basis: 'weight',
        lines: [{ materialId: 'mat-a', role: 'primary', parts: 2 }],
        isActive: true,
      },
    ],
    products: [
      {
        id: 'product-z',
        name: 'Large Mold',
        category: 'paintable-art',
        mixPresetId: 'mix-a',
        safetyWasteRate: 0.05,
        isActive: true,
      },
      {
        id: 'product-a',
        name: 'Small Mold',
        category: 'paintable-art',
        mixPresetId: 'mix-a',
        safetyWasteRate: 0,
        isActive: true,
      },
    ],
    yieldSamples: [
      {
        id: 'yield-z',
        productId: 'product-a',
        mixPresetId: 'mix-a',
        materialInputs: [{ materialId: 'mat-a', quantity: 100, unit: 'g' }],
        goodPieces: 2,
        rejectedPieces: 0,
        recordedAt: '2026-09-03T00:00:00.000Z',
      },
      {
        id: 'yield-a',
        productId: 'product-a',
        mixPresetId: 'mix-a',
        materialInputs: [{ materialId: 'mat-a', quantity: 50, unit: 'g' }],
        goodPieces: 1,
        rejectedPieces: 0,
        recordedAt: '2026-09-04T00:00:00.000Z',
      },
    ],
    recipeItems: [
      {
        id: 'recipe-z',
        productId: 'product-a',
        materialId: 'mat-z',
        quantityPerProduct: 1,
        unit: 'pc',
        role: 'packaging',
      },
      {
        id: 'recipe-a',
        productId: 'product-a',
        materialId: 'mat-a',
        quantityPerProduct: 5,
        unit: 'g',
        role: 'additive',
      },
    ],
    productComponents: [
      {
        id: 'component-z',
        parentProductId: 'product-z',
        sourceType: 'product',
        sourceId: 'product-a',
        role: 'molded-component',
        quantityPerParent: 2,
      },
      {
        id: 'component-a',
        parentProductId: 'product-z',
        sourceType: 'material',
        sourceId: 'mat-z',
        role: 'vessel',
        quantityPerParent: 1,
      },
    ],
    productStocks: [
      { productId: 'product-z', onHandQuantity: 3 },
      { productId: 'product-a', onHandQuantity: 0 },
    ],
    productFinancialProfiles: [
      {
        productId: 'product-z',
        laborCostPerUnit: 12,
        overheadCostPerUnit: 5,
        pricingPolicy: null,
      },
      {
        productId: 'product-a',
        laborCostPerUnit: 0,
        overheadCostPerUnit: 0,
        pricingPolicy: { method: 'profit-amount', value: 20 },
      },
    ],
  };
}

function createRepositories(
  sourceState: Omit<BusinessDataset, 'schemaVersion'>,
): CompleteSourceSnapshotRepositories {
  return {
    materials: {
      list: vi.fn(async () => sourceState.materials),
      findById: vi.fn(async () => null),
      insert: vi.fn(async () => undefined),
      replace: vi.fn(async () => undefined),
    },
    calibrations: {
      list: vi.fn(async () => sourceState.materialCalibrations),
      findById: vi.fn(async () => null),
      insert: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
    },
    mixPresets: {
      list: vi.fn(async () => sourceState.mixPresets),
      findById: vi.fn(async () => null),
      insert: vi.fn(async () => undefined),
      replace: vi.fn(async () => undefined),
    },
    products: {
      list: vi.fn(async () => sourceState.products),
      findById: vi.fn(async () => null),
      insert: vi.fn(async () => undefined),
      replace: vi.fn(async () => undefined),
    },
    yieldSamples: {
      list: vi.fn(async () => sourceState.yieldSamples),
      findById: vi.fn(async () => null),
      insert: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
    },
    recipeItems: {
      list: vi.fn(async () => sourceState.recipeItems),
      findById: vi.fn(async () => null),
      insert: vi.fn(async () => undefined),
      replace: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
    },
    productComponents: {
      list: vi.fn(async () => sourceState.productComponents),
      findById: vi.fn(async () => null),
      insert: vi.fn(async () => undefined),
      replace: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
    },
    productStocks: {
      list: vi.fn(async () => sourceState.productStocks),
      findByProductId: vi.fn(async () => null),
      upsert: vi.fn(async () => undefined),
    },
    productFinancialProfiles: {
      list: vi.fn(async () => sourceState.productFinancialProfiles),
      findByProductId: vi.fn(async () => null),
      upsert: vi.fn(async () => undefined),
    },
  };
}

describe('CompleteSourceSnapshotService', () => {
  it('returns the canonical empty current-schema dataset when all live repositories are empty', async () => {
    const sourceState: Omit<BusinessDataset, 'schemaVersion'> = {
      materials: [],
      materialCalibrations: [],
      mixPresets: [],
      products: [],
      yieldSamples: [],
      recipeItems: [],
      productComponents: [],
      productStocks: [],
      productFinancialProfiles: [],
    };

    const service = new CompleteSourceSnapshotService(createRepositories(sourceState));

    await expect(service.snapshot()).resolves.toEqual({
      schemaVersion: CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
      ...sourceState,
    });
  });

  it('snapshots all nine authoritative source collections in deterministic identity order', async () => {
    const sourceState = createSourceState();
    const service = new CompleteSourceSnapshotService(createRepositories(sourceState));

    const snapshot = await service.snapshot();

    expect(snapshot.schemaVersion).toBe(CURRENT_BUSINESS_DATASET_SCHEMA_VERSION);
    expect(snapshot.materials.map((item) => item.id)).toEqual(['mat-a', 'mat-z']);
    expect(snapshot.materialCalibrations.map((item) => item.id)).toEqual(['cal-a', 'cal-z']);
    expect(snapshot.mixPresets.map((item) => item.id)).toEqual(['mix-a', 'mix-z']);
    expect(snapshot.products.map((item) => item.id)).toEqual(['product-a', 'product-z']);
    expect(snapshot.yieldSamples.map((item) => item.id)).toEqual(['yield-a', 'yield-z']);
    expect(snapshot.recipeItems.map((item) => item.id)).toEqual(['recipe-a', 'recipe-z']);
    expect(snapshot.productComponents.map((item) => item.id)).toEqual([
      'component-a',
      'component-z',
    ]);
    expect(snapshot.productStocks.map((item) => item.productId)).toEqual([
      'product-a',
      'product-z',
    ]);
    expect(snapshot.productFinancialProfiles.map((item) => item.productId)).toEqual([
      'product-a',
      'product-z',
    ]);

    expect(Object.keys(snapshot).sort()).toEqual(
      [
        'schemaVersion',
        'materials',
        'materialCalibrations',
        'mixPresets',
        'products',
        'yieldSamples',
        'recipeItems',
        'productComponents',
        'productStocks',
        'productFinancialProfiles',
      ].sort(),
    );
  });

  it('deeply isolates returned source data from live repository-owned objects', async () => {
    const sourceState = createSourceState();
    const service = new CompleteSourceSnapshotService(createRepositories(sourceState));

    const snapshot = await service.snapshot();

    snapshot.materials[0].source!.vendorName = 'Changed Vendor';
    snapshot.mixPresets[0].compatibleCategories.push('candle');
    snapshot.mixPresets[0].lines[0].parts = 999;
    snapshot.yieldSamples[0].materialInputs[0].quantity = 999;
    snapshot.productFinancialProfiles[0].pricingPolicy!.value = 999;

    expect(sourceState.materials.find((item) => item.id === 'mat-a')!.source!.vendorName).toBe(
      'Craft Supplier',
    );
    expect(sourceState.mixPresets.find((item) => item.id === 'mix-a')!.compatibleCategories).toEqual([
      'paintable-art',
    ]);
    expect(sourceState.mixPresets.find((item) => item.id === 'mix-a')!.lines[0].parts).toBe(2);
    expect(sourceState.yieldSamples.find((item) => item.id === 'yield-a')!.materialInputs[0].quantity).toBe(
      50,
    );
    expect(
      sourceState.productFinancialProfiles.find((item) => item.productId === 'product-a')!
        .pricingPolicy!.value,
    ).toBe(20);

    sourceState.materials.find((item) => item.id === 'mat-z')!.name = 'Repository changed later';
    expect(snapshot.materials.find((item) => item.id === 'mat-z')!.name).toBe('Packaging Box');
  });

  it('preserves explicit zero and null source evidence without synthesizing missing rows', async () => {
    const sourceState = createSourceState();
    sourceState.productStocks = [{ productId: 'product-a', onHandQuantity: 0 }];
    sourceState.productFinancialProfiles = [
      {
        productId: 'product-a',
        laborCostPerUnit: 0,
        overheadCostPerUnit: 0,
        pricingPolicy: null,
      },
    ];

    const service = new CompleteSourceSnapshotService(createRepositories(sourceState));
    const snapshot = await service.snapshot();

    expect(snapshot.productStocks).toEqual([{ productId: 'product-a', onHandQuantity: 0 }]);
    expect(snapshot.productStocks.some((stock) => stock.productId === 'product-z')).toBe(false);
    expect(snapshot.productFinancialProfiles).toEqual([
      {
        productId: 'product-a',
        laborCostPerUnit: 0,
        overheadCostPerUnit: 0,
        pricingPolicy: null,
      },
    ]);
    expect(snapshot.productFinancialProfiles.some((profile) => profile.productId === 'product-z')).toBe(
      false,
    );
  });

  it('rejects the whole snapshot when any repository read fails and never calls repository writes', async () => {
    const sourceState = createSourceState();
    const repositories = createRepositories(sourceState);
    repositories.products.list = vi.fn(async () => {
      throw new Error('product source read failed');
    });

    const service = new CompleteSourceSnapshotService(repositories);

    await expect(service.snapshot()).rejects.toThrow('product source read failed');

    expect(repositories.materials.insert).not.toHaveBeenCalled();
    expect(repositories.materials.replace).not.toHaveBeenCalled();
    expect(repositories.calibrations.insert).not.toHaveBeenCalled();
    expect(repositories.calibrations.delete).not.toHaveBeenCalled();
    expect(repositories.mixPresets.insert).not.toHaveBeenCalled();
    expect(repositories.mixPresets.replace).not.toHaveBeenCalled();
    expect(repositories.products.insert).not.toHaveBeenCalled();
    expect(repositories.products.replace).not.toHaveBeenCalled();
    expect(repositories.yieldSamples.insert).not.toHaveBeenCalled();
    expect(repositories.yieldSamples.delete).not.toHaveBeenCalled();
    expect(repositories.recipeItems.insert).not.toHaveBeenCalled();
    expect(repositories.recipeItems.replace).not.toHaveBeenCalled();
    expect(repositories.recipeItems.delete).not.toHaveBeenCalled();
    expect(repositories.productComponents.insert).not.toHaveBeenCalled();
    expect(repositories.productComponents.replace).not.toHaveBeenCalled();
    expect(repositories.productComponents.delete).not.toHaveBeenCalled();
    expect(repositories.productStocks.upsert).not.toHaveBeenCalled();
    expect(repositories.productFinancialProfiles.upsert).not.toHaveBeenCalled();
  });
});
