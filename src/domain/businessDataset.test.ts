import { describe, expect, it } from 'vitest';
import {
  BUSINESS_DATASET_SOURCE_COLLECTION_KEYS,
  BusinessDatasetCompletenessError,
  cloneBusinessDataset,
  createEmptyBusinessDataset,
  CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
  normalizeBusinessDataset,
  type BusinessDatasetSourceCollectionKey,
} from './businessDataset';
import type { BusinessDataset } from './types';

function makeCompleteDataset(): BusinessDataset {
  return {
    schemaVersion: CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
    materials: [
      {
        id: 'mat-plaster',
        name: 'Plaster',
        group: 'plaster',
        baseUnit: 'g',
        purchaseQuantity: 1000,
        purchaseUnit: 'g',
        packageCost: 66,
        onHandQuantity: 750,
        onHandUnit: 'g',
        source: {
          vendorName: 'Craft Supplier',
          purchaseLink: 'https://example.com/plaster',
        },
        isActive: true,
      },
      {
        id: 'mat-vessel',
        name: 'Glass vessel',
        group: 'container',
        baseUnit: 'pc',
        purchaseQuantity: 12,
        purchaseUnit: 'pc',
        packageCost: 120,
        onHandQuantity: 8,
        onHandUnit: 'pc',
        isActive: true,
      },
    ],
    materialCalibrations: [
      {
        id: 'cal-plaster-1',
        materialId: 'mat-plaster',
        measuredVolume: 5,
        volumeUnit: 'cup',
        knownWeight: 1000,
        weightUnit: 'g',
        recordedAt: '2026-09-15T10:00:00.000Z',
        notes: 'Measured source evidence',
      },
    ],
    mixPresets: [
      {
        id: 'mix-plaster',
        name: 'Plaster mix',
        compatibleCategories: ['candle-pot'],
        basis: 'weight',
        lines: [{ materialId: 'mat-plaster', role: 'primary', parts: 1 }],
        isActive: true,
      },
    ],
    products: [
      {
        id: 'prod-pot',
        name: 'Candle pot',
        category: 'candle-pot',
        mixPresetId: 'mix-plaster',
        safetyWasteRate: 0.05,
        isActive: true,
      },
    ],
    yieldSamples: [
      {
        id: 'yield-pot-1',
        productId: 'prod-pot',
        mixPresetId: 'mix-plaster',
        materialInputs: [{ materialId: 'mat-plaster', quantity: 500, unit: 'g' }],
        goodPieces: 5,
        rejectedPieces: 1,
        recordedAt: '2026-09-15T11:00:00.000Z',
      },
    ],
    recipeItems: [
      {
        id: 'recipe-pot-finish',
        productId: 'prod-pot',
        materialId: 'mat-plaster',
        quantityPerProduct: 5,
        unit: 'g',
        role: 'finish',
      },
    ],
    productComponents: [
      {
        id: 'component-pot-vessel',
        parentProductId: 'prod-pot',
        sourceType: 'material',
        sourceId: 'mat-vessel',
        role: 'vessel',
        quantityPerParent: 1,
      },
    ],
    productStocks: [
      {
        productId: 'prod-pot',
        onHandQuantity: 0,
        notes: 'Explicit zero stock is still source evidence',
      },
    ],
    productFinancialProfiles: [
      {
        productId: 'prod-pot',
        laborCostPerUnit: 0,
        overheadCostPerUnit: 0,
        pricingPolicy: { method: 'markup-percent', value: 0.5 },
        notes: 'Explicit zero cost profile',
      },
    ],
  };
}

function expectCompletenessError(
  operation: () => unknown,
  code: BusinessDatasetCompletenessError['code'],
  collection?: BusinessDatasetSourceCollectionKey,
): void {
  let caught: unknown;

  try {
    operation();
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(BusinessDatasetCompletenessError);
  expect((caught as BusinessDatasetCompletenessError).code).toBe(code);
  if (collection) {
    expect((caught as BusinessDatasetCompletenessError).collection).toBe(collection);
  }
}

describe('BusinessDataset completeness contract', () => {
  it('defines all nine authoritative Phase 1–4 source collections', () => {
    expect(BUSINESS_DATASET_SOURCE_COLLECTION_KEYS).toEqual([
      'materials',
      'materialCalibrations',
      'mixPresets',
      'products',
      'yieldSamples',
      'recipeItems',
      'productComponents',
      'productStocks',
      'productFinancialProfiles',
    ]);
  });

  it('creates a complete empty v1 source dataset without inventing source rows', () => {
    const dataset = createEmptyBusinessDataset();

    expect(dataset.schemaVersion).toBe(CURRENT_BUSINESS_DATASET_SCHEMA_VERSION);
    for (const collection of BUSINESS_DATASET_SOURCE_COLLECTION_KEYS) {
      expect(dataset[collection]).toEqual([]);
    }
  });

  it('accepts a complete dataset including material calibration evidence', () => {
    const dataset = makeCompleteDataset();
    const normalized = normalizeBusinessDataset(dataset);

    expect(normalized.materialCalibrations).toEqual(dataset.materialCalibrations);
    expect(normalized.materialCalibrations).not.toBe(dataset.materialCalibrations);
    expect(normalized.materialCalibrations[0]).not.toBe(dataset.materialCalibrations[0]);
  });

  it('fails closed when calibration evidence collection is omitted', () => {
    const dataset = makeCompleteDataset();
    const { materialCalibrations: _omitted, ...incomplete } = dataset;

    expectCompletenessError(
      () => normalizeBusinessDataset(incomplete),
      'MISSING_SOURCE_COLLECTION',
      'materialCalibrations',
    );
  });

  it('fails closed when a required source collection is not an array', () => {
    const invalid = {
      ...makeCompleteDataset(),
      productStocks: {},
    };

    expectCompletenessError(
      () => normalizeBusinessDataset(invalid),
      'INVALID_SOURCE_COLLECTION',
      'productStocks',
    );
  });

  it('rejects invalid and unsupported dataset schema versions with controlled errors', () => {
    expectCompletenessError(
      () => normalizeBusinessDataset({ ...makeCompleteDataset(), schemaVersion: 1.5 }),
      'INVALID_SCHEMA_VERSION',
    );

    expectCompletenessError(
      () => normalizeBusinessDataset({ ...makeCompleteDataset(), schemaVersion: 2 }),
      'UNSUPPORTED_SCHEMA_VERSION',
    );
  });

  it('defensively clones all mutable top-level and nested source structures', () => {
    const original = makeCompleteDataset();
    const cloned = cloneBusinessDataset(original);

    expect(cloned).not.toBe(original);
    expect(cloned.materials).not.toBe(original.materials);
    expect(cloned.materials[0]).not.toBe(original.materials[0]);
    expect(cloned.materials[0].source).not.toBe(original.materials[0].source);
    expect(cloned.mixPresets[0].compatibleCategories).not.toBe(
      original.mixPresets[0].compatibleCategories,
    );
    expect(cloned.mixPresets[0].lines).not.toBe(original.mixPresets[0].lines);
    expect(cloned.mixPresets[0].lines[0]).not.toBe(original.mixPresets[0].lines[0]);
    expect(cloned.yieldSamples[0].materialInputs).not.toBe(
      original.yieldSamples[0].materialInputs,
    );
    expect(cloned.yieldSamples[0].materialInputs[0]).not.toBe(
      original.yieldSamples[0].materialInputs[0],
    );
    expect(cloned.productFinancialProfiles[0].pricingPolicy).not.toBe(
      original.productFinancialProfiles[0].pricingPolicy,
    );

    cloned.materials[0].name = 'Changed clone';
    if (cloned.materials[0].source) cloned.materials[0].source.vendorName = 'Other vendor';
    cloned.materialCalibrations[0].notes = 'Changed calibration clone';
    cloned.mixPresets[0].lines[0].parts = 99;
    cloned.yieldSamples[0].materialInputs[0].quantity = 999;
    if (cloned.productFinancialProfiles[0].pricingPolicy) {
      cloned.productFinancialProfiles[0].pricingPolicy.value = 0.75;
    }

    expect(original.materials[0].name).toBe('Plaster');
    expect(original.materials[0].source?.vendorName).toBe('Craft Supplier');
    expect(original.materialCalibrations[0].notes).toBe('Measured source evidence');
    expect(original.mixPresets[0].lines[0].parts).toBe(1);
    expect(original.yieldSamples[0].materialInputs[0].quantity).toBe(500);
    expect(original.productFinancialProfiles[0].pricingPolicy?.value).toBe(0.5);
  });

  it('normalizes ownership without silently repairing source-row values', () => {
    const dataset = makeCompleteDataset();
    dataset.materials[0].name = '  Plaster source text  ';
    dataset.materialCalibrations[0].notes = '  calibration source text  ';

    const normalized = normalizeBusinessDataset(dataset);

    expect(normalized.materials[0].name).toBe('  Plaster source text  ');
    expect(normalized.materialCalibrations[0].notes).toBe('  calibration source text  ');
  });

  it('preserves missing source evidence as missing instead of inventing zero records', () => {
    const dataset = createEmptyBusinessDataset();
    const normalized = normalizeBusinessDataset(dataset);

    expect(normalized.productStocks).toEqual([]);
    expect(normalized.productFinancialProfiles).toEqual([]);
  });

  it('preserves explicit zero stock/cost evidence and null pricing policy', () => {
    const dataset = makeCompleteDataset();
    dataset.productFinancialProfiles[0].pricingPolicy = null;

    const normalized = normalizeBusinessDataset(dataset);

    expect(normalized.productStocks).toEqual([
      expect.objectContaining({ productId: 'prod-pot', onHandQuantity: 0 }),
    ]);
    expect(normalized.productFinancialProfiles).toEqual([
      expect.objectContaining({
        productId: 'prod-pot',
        laborCostPerUnit: 0,
        overheadCostPerUnit: 0,
        pricingPolicy: null,
      }),
    ]);
  });
});
