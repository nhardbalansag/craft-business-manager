import { describe, expect, it } from 'vitest';
import type { MaterialCalibrationEvidence } from '../../domain/materialCalibration';
import type { Material } from '../../domain/materials';
import type { MixPreset } from '../../domain/mixPresets';
import type { ProductComponent } from '../../domain/productComponents';
import type { ProductFinancialProfile } from '../../domain/productFinancialProfile';
import type { ProductStock } from '../../domain/productStock';
import type { Product } from '../../domain/products';
import type { FixedRecipeItem } from '../../domain/fixedRecipeItems';
import type { YieldSample } from '../../domain/yieldSamples';
import { InMemoryCalibrationRepository } from '../calibrations/InMemoryCalibrationRepository';
import { InMemoryMaterialRepository } from '../materials/InMemoryMaterialRepository';
import { InMemoryMixPresetRepository } from '../mixPresets/InMemoryMixPresetRepository';
import { InMemoryProductComponentRepository } from '../productComponents/InMemoryProductComponentRepository';
import { InMemoryProductFinancialProfileRepository } from '../productFinancialProfiles/InMemoryProductFinancialProfileRepository';
import { InMemoryProductStockRepository } from '../productStocks/InMemoryProductStockRepository';
import { InMemoryProductRepository } from '../products/InMemoryProductRepository';
import { InMemoryFixedRecipeItemRepository } from '../recipeItems/InMemoryFixedRecipeItemRepository';
import { InMemoryYieldSampleRepository } from '../yieldSamples/InMemoryYieldSampleRepository';
import type { CollectionReplacementPort } from './CollectionReplacementPort';

type ReplaceableListRepository<T> = CollectionReplacementPort<T> & {
  list(): Promise<T[]>;
};

function throwOnRead<T extends object>(record: T, field: keyof T): T {
  return new Proxy(record, {
    get(target, property, receiver) {
      if (property === field) throw new Error('replacement preparation failed');
      return Reflect.get(target, property, receiver);
    },
  });
}

async function exerciseReplacement<T extends object>(options: {
  repository: ReplaceableListRepository<T>;
  next: T;
  keyField: keyof T;
  mutateCallerOwnedRecord: (record: T) => void;
  findNext: () => Promise<T | null>;
  findStale: () => Promise<T | null>;
}): Promise<void> {
  const { repository, next, keyField, mutateCallerOwnedRecord, findNext, findStale } = options;
  const repositoryIdentity = repository;

  await repository.replaceAll([next]);

  expect(repository).toBe(repositoryIdentity);
  expect(await findStale()).toBeNull();

  const installed = await repository.list();
  expect(installed).toHaveLength(1);
  expect(await findNext()).toEqual(installed[0]);

  mutateCallerOwnedRecord(next);
  expect(await repository.list()).toEqual(installed);

  const exploding = throwOnRead(installed[0], keyField);
  await expect(repository.replaceAll([exploding])).rejects.toThrow('replacement preparation failed');
  expect(await repository.list()).toEqual(installed);

  await repository.replaceAll([]);
  expect(await repository.list()).toEqual([]);
}

describe('Phase 5.3B1 collection replacement capability', () => {
  it('replaces the complete Material collection with deep defensive ownership', async () => {
    const stale: Material = {
      id: 'material-stale',
      name: 'Stale Material',
      group: 'plaster',
      baseUnit: 'g',
      purchaseQuantity: 1,
      purchaseUnit: 'kg',
      packageCost: 50,
      onHandQuantity: 1,
      onHandUnit: 'kg',
      isActive: true,
    };
    const next: Material = {
      id: 'material-next',
      name: 'Next Material',
      group: 'plaster',
      baseUnit: 'g',
      purchaseQuantity: 2,
      purchaseUnit: 'kg',
      packageCost: 120,
      onHandQuantity: 3,
      onHandUnit: 'kg',
      source: { vendorName: 'Original Vendor', notes: 'Nested source evidence' },
      isActive: false,
    };
    const repository = new InMemoryMaterialRepository([stale]);

    await exerciseReplacement({
      repository,
      next,
      keyField: 'id',
      mutateCallerOwnedRecord: (record) => {
        record.name = 'Caller changed';
        record.source!.vendorName = 'Caller vendor changed';
      },
      findNext: () => repository.findById(' MATERIAL-NEXT '),
      findStale: () => repository.findById('material-stale'),
    });
  });

  it('replaces the complete calibration evidence collection', async () => {
    const stale: MaterialCalibrationEvidence = {
      id: 'cal-stale',
      materialId: 'material-a',
      measuredVolume: 1,
      volumeUnit: 'cup',
      knownWeight: 200,
      weightUnit: 'g',
      recordedAt: '2026-09-01T00:00:00.000Z',
    };
    const next: MaterialCalibrationEvidence = {
      id: 'cal-next',
      materialId: 'material-a',
      measuredVolume: 2,
      volumeUnit: 'cup',
      knownWeight: 400,
      weightUnit: 'g',
      recordedAt: '2026-09-02T00:00:00.000Z',
      notes: 'Replacement evidence',
    };
    const repository = new InMemoryCalibrationRepository([stale]);

    await exerciseReplacement({
      repository,
      next,
      keyField: 'id',
      mutateCallerOwnedRecord: (record) => {
        record.notes = 'Caller changed';
      },
      findNext: () => repository.findById('CAL-NEXT'),
      findStale: () => repository.findById('cal-stale'),
    });
  });

  it('replaces the complete MixPreset collection with nested arrays isolated', async () => {
    const stale: MixPreset = {
      id: 'mix-stale',
      name: 'Stale Mix',
      compatibleCategories: ['paintable-art'],
      basis: 'weight',
      lines: [{ materialId: 'material-a', role: 'primary', parts: 1 }],
      isActive: true,
    };
    const next: MixPreset = {
      id: 'mix-next',
      name: 'Next Mix',
      compatibleCategories: ['paintable-art', 'candle-pot'],
      basis: 'weight',
      lines: [
        { materialId: 'material-a', role: 'primary', parts: 2 },
        { materialId: 'material-b', role: 'additive', parts: 1 },
      ],
      isActive: false,
    };
    const repository = new InMemoryMixPresetRepository([stale]);

    await exerciseReplacement({
      repository,
      next,
      keyField: 'id',
      mutateCallerOwnedRecord: (record) => {
        record.compatibleCategories.push('candle');
        record.lines[0].parts = 999;
      },
      findNext: () => repository.findById(' MIX-NEXT '),
      findStale: () => repository.findById('mix-stale'),
    });
  });

  it('replaces the complete Product collection', async () => {
    const stale: Product = {
      id: 'product-stale',
      name: 'Stale Product',
      category: 'paintable-art',
      safetyWasteRate: 0,
      isActive: true,
    };
    const next: Product = {
      id: 'product-next',
      name: 'Next Product',
      category: 'candle-pot',
      mixPresetId: 'mix-next',
      safetyWasteRate: 0.05,
      notes: 'Replacement product',
      isActive: false,
    };
    const repository = new InMemoryProductRepository([stale]);

    await exerciseReplacement({
      repository,
      next,
      keyField: 'id',
      mutateCallerOwnedRecord: (record) => {
        record.name = 'Caller changed';
      },
      findNext: () => repository.findById('PRODUCT-NEXT'),
      findStale: () => repository.findById('product-stale'),
    });
  });

  it('replaces the complete immutable YieldSample evidence collection with nested inputs isolated', async () => {
    const stale: YieldSample = {
      id: 'yield-stale',
      productId: 'product-next',
      materialInputs: [{ materialId: 'material-a', quantity: 50, unit: 'g' }],
      goodPieces: 1,
      rejectedPieces: 0,
      recordedAt: '2026-09-03T00:00:00.000Z',
    };
    const next: YieldSample = {
      id: 'yield-next',
      productId: 'product-next',
      mixPresetId: 'mix-next',
      materialInputs: [
        { materialId: 'material-a', quantity: 100, unit: 'g' },
        { materialId: 'material-b', quantity: 20, unit: 'g' },
      ],
      goodPieces: 2,
      rejectedPieces: 1,
      recordedAt: '2026-09-04T00:00:00.000Z',
      notes: 'Persisted evidence',
    };
    const repository = new InMemoryYieldSampleRepository([stale]);

    await exerciseReplacement({
      repository,
      next,
      keyField: 'id',
      mutateCallerOwnedRecord: (record) => {
        record.materialInputs[0].quantity = 999;
      },
      findNext: () => repository.findById(' YIELD-NEXT '),
      findStale: () => repository.findById('yield-stale'),
    });
  });

  it('replaces the complete FixedRecipeItem collection', async () => {
    const stale: FixedRecipeItem = {
      id: 'recipe-stale',
      productId: 'product-next',
      materialId: 'material-a',
      quantityPerProduct: 1,
      unit: 'g',
      role: 'additive',
    };
    const next: FixedRecipeItem = {
      id: 'recipe-next',
      productId: 'product-next',
      materialId: 'material-b',
      quantityPerProduct: 2,
      unit: 'pc',
      role: 'packaging',
      notes: 'Replacement recipe evidence',
    };
    const repository = new InMemoryFixedRecipeItemRepository([stale]);

    await exerciseReplacement({
      repository,
      next,
      keyField: 'id',
      mutateCallerOwnedRecord: (record) => {
        record.quantityPerProduct = 999;
      },
      findNext: () => repository.findById('RECIPE-NEXT'),
      findStale: () => repository.findById('recipe-stale'),
    });
  });

  it('replaces the complete ProductComponent collection', async () => {
    const stale: ProductComponent = {
      id: 'component-stale',
      parentProductId: 'product-next',
      sourceType: 'material',
      sourceId: 'material-a',
      role: 'vessel',
      quantityPerParent: 1,
    };
    const next: ProductComponent = {
      id: 'component-next',
      parentProductId: 'product-next',
      sourceType: 'product',
      sourceId: 'product-child',
      role: 'molded-component',
      quantityPerParent: 2,
      notes: 'Replacement component',
    };
    const repository = new InMemoryProductComponentRepository([stale]);

    await exerciseReplacement({
      repository,
      next,
      keyField: 'id',
      mutateCallerOwnedRecord: (record) => {
        record.quantityPerParent = 999;
      },
      findNext: () => repository.findById(' COMPONENT-NEXT '),
      findStale: () => repository.findById('component-stale'),
    });
  });

  it('replaces the complete ProductStock collection and preserves explicit zero', async () => {
    const stale: ProductStock = {
      productId: 'product-stale',
      onHandQuantity: 7,
    };
    const next: ProductStock = {
      productId: 'product-next',
      onHandQuantity: 0,
      notes: 'Explicit zero stock',
    };
    const repository = new InMemoryProductStockRepository([stale]);

    await exerciseReplacement({
      repository,
      next,
      keyField: 'productId',
      mutateCallerOwnedRecord: (record) => {
        record.onHandQuantity = 999;
      },
      findNext: () => repository.findByProductId(' PRODUCT-NEXT '),
      findStale: () => repository.findByProductId('product-stale'),
    });
  });

  it('replaces the complete ProductFinancialProfile collection with nested pricing policy isolated', async () => {
    const stale: ProductFinancialProfile = {
      productId: 'product-stale',
      laborCostPerUnit: 1,
      overheadCostPerUnit: 1,
      pricingPolicy: null,
    };
    const next: ProductFinancialProfile = {
      productId: 'product-next',
      laborCostPerUnit: 0,
      overheadCostPerUnit: 0,
      pricingPolicy: { method: 'profit-amount', value: 20 },
      notes: 'Replacement financial source',
    };
    const repository = new InMemoryProductFinancialProfileRepository([stale]);

    await exerciseReplacement({
      repository,
      next,
      keyField: 'productId',
      mutateCallerOwnedRecord: (record) => {
        record.pricingPolicy!.value = 999;
      },
      findNext: () => repository.findByProductId('PRODUCT-NEXT'),
      findStale: () => repository.findByProductId('product-stale'),
    });
  });
});
