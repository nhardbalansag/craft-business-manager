import { describe, expect, it } from 'vitest';
import { CURRENT_BUSINESS_DATASET_SCHEMA_VERSION } from '../domain/businessDataset';
import type { BusinessDataset } from '../domain/types';
import {
  BusinessDatasetWorkbookExportError,
  createBusinessDatasetWorkbookDocument,
  exportBusinessDatasetToXlsx,
} from './businessDatasetWorkbookExport';
import { SheetJsWorkbookCodec } from './sheetJsWorkbookCodec';
import {
  CANONICAL_WORKBOOK_SHEET_NAMES,
  CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
  CURRENT_WORKBOOK_FORMAT_VERSION,
  WORKBOOK_SCHEMA_BY_NAME,
  validateWorkbookSchema,
  type WorkbookNeutralDocument,
} from './workbookSchema';
import type { WorkbookCodec } from './workbookCodec';

const METADATA = {
  exportedAt: '2026-09-16T02:00:00.000Z',
  applicationVersion: '0.1.0',
} as const;

function datasetFixture(): BusinessDataset {
  return {
    schemaVersion: CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
    materials: [
      {
        id: 'mat-z-vessel',
        name: 'Glass vessel',
        group: 'container',
        baseUnit: 'pc',
        purchaseQuantity: 12,
        purchaseUnit: 'pc',
        packageCost: 240,
        onHandQuantity: 0,
        onHandUnit: 'pc',
        notes: '@literal-vessel-note',
        isActive: false,
      },
      {
        id: 'MAT-A-PLASTER',
        name: 'Fine plaster',
        group: 'plaster',
        baseUnit: 'g',
        purchaseQuantity: 1,
        purchaseUnit: 'kg',
        packageCost: 66.123456789,
        onHandQuantity: 1.25,
        onHandUnit: 'kg',
        source: {
          vendorName: 'Supplier A',
          source: '=literal source detail',
          purchaseLink: 'https://example.com/plaster',
          contactNumber: '+63 900 000 0000',
          socialPage: '@supplier-a',
          notes: '-literal source note',
        },
        notes: '=SUM(A1:A2)',
        isActive: true,
      },
    ],
    materialCalibrations: [
      {
        id: 'cal-2',
        materialId: 'MAT-A-PLASTER',
        measuredVolume: 2,
        volumeUnit: 'cup',
        knownWeight: 830.125,
        weightUnit: 'g',
        recordedAt: '2026-02-01T10:00:00.000Z',
      },
      {
        id: 'cal-1',
        materialId: 'MAT-A-PLASTER',
        measuredVolume: 1,
        volumeUnit: 'cup',
        knownWeight: 415.0625,
        weightUnit: 'g',
        recordedAt: '2026-01-01T10:00:00.000Z',
        notes: '+literal calibration note',
      },
    ],
    mixPresets: [
      {
        id: 'mix-z',
        name: 'Plaster mix',
        compatibleCategories: ['candle-pot', 'paintable-art'],
        basis: 'weight',
        lines: [
          { materialId: 'MAT-A-PLASTER', role: 'primary', parts: 3 },
          { materialId: 'mat-z-vessel', role: 'additive', parts: 1 },
        ],
        notes: '@literal mix note',
        isActive: false,
      },
    ],
    products: [
      {
        id: 'product-z',
        name: 'Finished candle',
        category: 'candle',
        safetyWasteRate: 0,
        notes: '-literal product note',
        isActive: true,
      },
      {
        id: 'Product-A',
        name: 'Paintable figure',
        category: 'paintable-art',
        mixPresetId: 'mix-z',
        safetyWasteRate: 0.075123456789,
        isActive: false,
      },
    ],
    yieldSamples: [
      {
        id: 'yield-2',
        productId: 'Product-A',
        mixPresetId: 'mix-z',
        materialInputs: [
          { materialId: 'MAT-A-PLASTER', quantity: 200.125, unit: 'g' },
          { materialId: 'mat-z-vessel', quantity: 1, unit: 'pc' },
        ],
        goodPieces: 4,
        rejectedPieces: 0,
        recordedAt: '2026-03-02T08:00:00.000Z',
      },
      {
        id: 'yield-1',
        productId: 'Product-A',
        mixPresetId: 'mix-z',
        materialInputs: [{ materialId: 'MAT-A-PLASTER', quantity: 100.0625, unit: 'g' }],
        goodPieces: 2,
        rejectedPieces: 1,
        recordedAt: '2026-03-01T08:00:00.000Z',
        notes: '=literal yield note',
      },
    ],
    recipeItems: [
      {
        id: 'recipe-z',
        productId: 'product-z',
        materialId: 'MAT-A-PLASTER',
        quantityPerProduct: 12.345678901,
        unit: 'g',
        role: 'additive',
        notes: '+literal recipe note',
      },
    ],
    productComponents: [
      {
        id: 'component-z',
        parentProductId: 'product-z',
        sourceType: 'material',
        sourceId: 'mat-z-vessel',
        role: 'vessel',
        quantityPerParent: 1,
        notes: '@literal component note',
      },
    ],
    productStocks: [{ productId: 'Product-A', onHandQuantity: 0, notes: '=literal stock note' }],
    productFinancialProfiles: [
      {
        productId: 'product-z',
        laborCostPerUnit: 0,
        overheadCostPerUnit: 0,
        pricingPolicy: null,
      },
      {
        productId: 'Product-A',
        laborCostPerUnit: 12.3456789,
        overheadCostPerUnit: 3.2109876,
        pricingPolicy: { method: 'profit-amount', value: 0 },
        notes: '+literal finance note',
      },
    ],
  };
}

function sheet(document: WorkbookNeutralDocument, name: string) {
  const found = document.sheets.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`Missing test sheet ${name}`);
  return found;
}

function withoutUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutUndefined);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, withoutUndefined(entry)]),
    );
  }
  return value;
}

describe('BusinessDataset workbook export', () => {
  it('emits the exact 13 canonical sheets and canonical columns', () => {
    const document = createBusinessDatasetWorkbookDocument(datasetFixture(), METADATA);
    expect(document.sheets.map((candidate) => candidate.name)).toEqual(CANONICAL_WORKBOOK_SHEET_NAMES);

    for (const candidate of document.sheets) {
      const contract = WORKBOOK_SCHEMA_BY_NAME[candidate.name as keyof typeof WORKBOOK_SCHEMA_BY_NAME];
      expect(candidate.columns).toEqual(contract.columns.map((column) => column.key));
    }
    expect(validateWorkbookSchema(document)).toEqual([]);
  });

  it('writes exact explicit metadata without a hidden clock', () => {
    const document = createBusinessDatasetWorkbookDocument(datasetFixture(), METADATA);
    expect(sheet(document, '_Meta').rows).toEqual([
      {
        formatId: CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
        workbookFormatVersion: CURRENT_WORKBOOK_FORMAT_VERSION,
        datasetSchemaVersion: CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
        exportedAt: METADATA.exportedAt,
        applicationVersion: METADATA.applicationVersion,
      },
    ]);

    const withoutVersion = createBusinessDatasetWorkbookDocument(datasetFixture(), {
      exportedAt: METADATA.exportedAt,
    });
    expect(sheet(withoutVersion, '_Meta').rows[0].applicationVersion).toBeUndefined();
  });

  it('rejects invalid export metadata with a controlled error', () => {
    expect(() =>
      createBusinessDatasetWorkbookDocument(datasetFixture(), { exportedAt: 'not-a-date' }),
    ).toThrowError(BusinessDatasetWorkbookExportError);
    try {
      createBusinessDatasetWorkbookDocument(datasetFixture(), { exportedAt: 'not-a-date' });
    } catch (error) {
      expect(error).toMatchObject({ code: 'INVALID_EXPORT_METADATA' });
    }
  });

  it('rejects invalid datasets before codec invocation and preserves structured issues', () => {
    const dataset = datasetFixture();
    dataset.materials.push({ ...dataset.materials[0], id: ' MAT-Z-VESSEL ' });
    let calls = 0;
    const codec: WorkbookCodec = {
      encode: () => {
        calls += 1;
        return new Uint8Array();
      },
      decode: () => ({ sheets: [] }),
    };

    expect(() => exportBusinessDatasetToXlsx(dataset, METADATA, codec)).toThrowError(
      BusinessDatasetWorkbookExportError,
    );
    expect(calls).toBe(0);
    try {
      exportBusinessDatasetToXlsx(dataset, METADATA, codec);
    } catch (error) {
      expect(error).toMatchObject({ code: 'INVALID_DATASET' });
      expect((error as BusinessDatasetWorkbookExportError).datasetIssues?.length).toBeGreaterThan(0);
    }
  });

  it('flattens authoritative source data without derived fields', () => {
    const document = createBusinessDatasetWorkbookDocument(datasetFixture(), METADATA);
    const materials = sheet(document, 'Materials');
    const plaster = materials.rows.find((row) => row.id === 'MAT-A-PLASTER');
    expect(plaster).toMatchObject({
      sourceVendorName: 'Supplier A',
      sourceDetail: '=literal source detail',
      sourcePurchaseLink: 'https://example.com/plaster',
      sourceContactNumber: '+63 900 000 0000',
      sourceSocialPage: '@supplier-a',
      sourceNotes: '-literal source note',
      packageCost: 66.123456789,
    });
    expect(materials.columns).not.toContain('costPerBaseUnit');
    expect(sheet(document, 'Calibrations').columns).not.toContain('gramsPerCup');
    expect(sheet(document, 'ProductComponents').columns).not.toContain('cost');
  });

  it('normalizes MixPreset and YieldSample arrays into ordered child rows', () => {
    const document = createBusinessDatasetWorkbookDocument(datasetFixture(), METADATA);
    expect(sheet(document, 'MixPresetCategories').rows).toEqual([
      { mixPresetId: 'mix-z', categoryOrder: 1, category: 'candle-pot' },
      { mixPresetId: 'mix-z', categoryOrder: 2, category: 'paintable-art' },
    ]);
    expect(sheet(document, 'MixPresetLines').rows.map((row) => row.lineOrder)).toEqual([1, 2]);
    expect(sheet(document, 'YieldSampleInputs').rows.filter((row) => row.yieldSampleId === 'yield-2')).toEqual([
      { yieldSampleId: 'yield-2', inputOrder: 1, materialId: 'MAT-A-PLASTER', quantity: 200.125, unit: 'g' },
      { yieldSampleId: 'yield-2', inputOrder: 2, materialId: 'mat-z-vessel', quantity: 1, unit: 'pc' },
    ]);
  });

  it('preserves missing, explicit zero, null policy, and false semantics', () => {
    const document = createBusinessDatasetWorkbookDocument(datasetFixture(), METADATA);
    const products = sheet(document, 'Products').rows;
    expect(products.find((row) => row.id === 'product-z')?.mixPresetId).toBeUndefined();
    expect(products.find((row) => row.id === 'Product-A')?.isActive).toBe(false);

    expect(sheet(document, 'ProductStocks').rows).toEqual([
      { productId: 'Product-A', onHandQuantity: 0, notes: '=literal stock note' },
    ]);

    const profiles = sheet(document, 'ProductFinancialProfiles').rows;
    expect(profiles.find((row) => row.productId === 'product-z')).toMatchObject({
      laborCostPerUnit: 0,
      overheadCostPerUnit: 0,
    });
    expect(profiles.find((row) => row.productId === 'product-z')?.pricingMethod).toBeUndefined();
    expect(profiles.find((row) => row.productId === 'Product-A')).toMatchObject({
      pricingMethod: 'profit-amount',
      pricingValue: 0,
    });
  });

  it('canonicalizes top-level source order while preserving child array order', () => {
    const source = datasetFixture();
    const shuffled: BusinessDataset = {
      ...source,
      materials: [...source.materials].reverse(),
      materialCalibrations: [...source.materialCalibrations].reverse(),
      products: [...source.products].reverse(),
      yieldSamples: [...source.yieldSamples].reverse(),
      productFinancialProfiles: [...source.productFinancialProfiles].reverse(),
    };

    const first = createBusinessDatasetWorkbookDocument(source, METADATA);
    const second = createBusinessDatasetWorkbookDocument(shuffled, METADATA);
    expect(second).toEqual(first);
    expect(sheet(first, 'Calibrations').rows.map((row) => row.id)).toEqual(['cal-1', 'cal-2']);
    expect(sheet(first, 'YieldSamples').rows.map((row) => row.id)).toEqual(['yield-1', 'yield-2']);
  });

  it('preserves high-precision numbers and ISO timestamp text without business rounding', () => {
    const document = createBusinessDatasetWorkbookDocument(datasetFixture(), METADATA);
    expect(sheet(document, 'Materials').rows.find((row) => row.id === 'MAT-A-PLASTER')?.packageCost).toBe(
      66.123456789,
    );
    expect(sheet(document, 'RecipeItems').rows[0].quantityPerProduct).toBe(12.345678901);
    expect(sheet(document, 'Products').rows.find((row) => row.id === 'Product-A')?.safetyWasteRate).toBe(
      0.075123456789,
    );
    expect(sheet(document, 'Calibrations').rows[0].recordedAt).toBe('2026-01-01T10:00:00.000Z');
  });

  it('exports complete real XLSX bytes and decodes to equivalent canonical workbook semantics', () => {
    const codec = new SheetJsWorkbookCodec();
    const document = createBusinessDatasetWorkbookDocument(datasetFixture(), METADATA);
    const bytes = exportBusinessDatasetToXlsx(datasetFixture(), METADATA, codec);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.byteLength).toBeGreaterThan(0);

    const decoded = codec.decode(bytes);
    expect(withoutUndefined(decoded)).toEqual(withoutUndefined(document));
    expect(validateWorkbookSchema(decoded)).toEqual([]);
  });

  it('preserves formula-looking source text as literal text through real XLSX bytes', () => {
    const codec = new SheetJsWorkbookCodec();
    const decoded = codec.decode(exportBusinessDatasetToXlsx(datasetFixture(), METADATA, codec));
    const values = decoded.sheets.flatMap((candidate) =>
      candidate.rows.flatMap((row) => Object.values(row)),
    );

    expect(values).toContain('=SUM(A1:A2)');
    expect(values).toContain('+literal recipe note');
    expect(values).toContain('-literal product note');
    expect(values).toContain('@literal component note');
    expect(values.some((value) => value && typeof value === 'object' && 'formula' in value)).toBe(false);
  });

  it('emits all canonical sheets with header columns even for an empty valid dataset', () => {
    const empty: BusinessDataset = {
      schemaVersion: CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
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
    const document = createBusinessDatasetWorkbookDocument(empty, METADATA);
    expect(document.sheets).toHaveLength(13);
    expect(document.sheets.every((candidate) => candidate.columns.length > 0)).toBe(true);
    expect(document.sheets.slice(1).every((candidate) => candidate.rows.length === 0)).toBe(true);
    expect(validateWorkbookSchema(document)).toEqual([]);
  });

  it('does not mutate source arrays or nested source evidence', () => {
    const dataset = datasetFixture();
    const snapshot = structuredClone(dataset);
    createBusinessDatasetWorkbookDocument(dataset, METADATA);
    expect(dataset).toEqual(snapshot);
  });
});
