import { describe, expect, it } from 'vitest';
import { CURRENT_BUSINESS_DATASET_SCHEMA_VERSION } from '../domain/businessDataset';
import type { BusinessDataset } from '../domain/types';
import {
  createBusinessDatasetWorkbookDocument,
  exportBusinessDatasetToXlsx,
} from './businessDatasetWorkbookExport';
import {
  importBusinessDatasetFromXlsx,
  reconstructBusinessDatasetFromWorkbook,
} from './businessDatasetWorkbookImport';
import { WorkbookCodecError, type WorkbookCodec } from './workbookCodec';
import { SheetJsWorkbookCodec } from './sheetJsWorkbookCodec';
import type { WorkbookNeutralDocument } from './workbookSchema';

const METADATA = {
  exportedAt: '2026-09-16T03:00:00.000Z',
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

type MutableSheet = {
  name: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
};

type MutableWorkbook = {
  sheets: MutableSheet[];
};

function mutableDocument(): MutableWorkbook {
  return structuredClone(
    createBusinessDatasetWorkbookDocument(datasetFixture(), METADATA),
  ) as MutableWorkbook;
}

function mutableSheet(document: MutableWorkbook, name: string): MutableSheet {
  const found = document.sheets.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`Missing test sheet ${name}.`);
  return found;
}

function expectSuccess(
  result: ReturnType<typeof reconstructBusinessDatasetFromWorkbook>,
): Extract<ReturnType<typeof reconstructBusinessDatasetFromWorkbook>, { ok: true }> {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result;
}

describe('BusinessDataset workbook import', () => {
  it('round-trips a complete dataset through real XLSX bytes with equivalent canonical workbook semantics', () => {
    const codec = new SheetJsWorkbookCodec();
    const source = datasetFixture();
    const bytes = exportBusinessDatasetToXlsx(source, METADATA, codec);
    const result = importBusinessDatasetFromXlsx(bytes, codec);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    expect(result.metadata).toEqual({
      formatId: 'craft-business-manager',
      workbookFormatVersion: 1,
      datasetSchemaVersion: CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
      exportedAt: METADATA.exportedAt,
      applicationVersion: METADATA.applicationVersion,
    });
    expect(createBusinessDatasetWorkbookDocument(result.dataset, METADATA)).toEqual(
      createBusinessDatasetWorkbookDocument(source, METADATA),
    );
  });

  it('accepts ArrayBuffer input through the real codec boundary', () => {
    const codec = new SheetJsWorkbookCodec();
    const bytes = exportBusinessDatasetToXlsx(datasetFixture(), METADATA, codec);
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    const result = importBusinessDatasetFromXlsx(buffer, codec);
    expect(result.ok).toBe(true);
  });

  it('wraps codec failures as controlled codec-stage issues', () => {
    const codec: WorkbookCodec = {
      encode: () => new Uint8Array(),
      decode: () => {
        throw new WorkbookCodecError('XLSX_DECODE_FAILED', 'broken workbook');
      },
    };

    const result = importBusinessDatasetFromXlsx(new Uint8Array([1, 2, 3]), codec);
    expect(result).toEqual({
      ok: false,
      issues: [
        expect.objectContaining({
          stage: 'codec',
          code: 'XLSX_DECODE_FAILED',
          message: expect.stringContaining('broken workbook'),
        }),
      ],
    });
  });

  it('rejects a real XLSX missing a required canonical sheet at the schema stage', () => {
    const codec = new SheetJsWorkbookCodec();
    const document = mutableDocument();
    document.sheets = document.sheets.filter((candidate) => candidate.name !== 'Products');
    const bytes = codec.encode(document as WorkbookNeutralDocument);
    const result = importBusinessDatasetFromXlsx(bytes, codec);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        stage: 'schema',
        code: 'MISSING_REQUIRED_SHEET',
        sheetName: 'Products',
      }),
    );
  });

  it('rejects formula metadata before reconstruction and never uses cached formula values', () => {
    const document = mutableDocument();
    mutableSheet(document, 'Materials').rows[0].notes = {
      formula: '1+1',
      cachedValue: 'unsafe',
    };
    const result = reconstructBusinessDatasetFromWorkbook(document as WorkbookNeutralDocument);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        stage: 'schema',
        code: 'FORMULA_CELL_NOT_ALLOWED',
        sheetName: 'Materials',
        column: 'notes',
      }),
    );
  });

  it('rejects invalid exportedAt as a metadata-stage issue', () => {
    const document = mutableDocument();
    mutableSheet(document, '_Meta').rows[0].exportedAt = 'not-a-date';
    const result = reconstructBusinessDatasetFromWorkbook(document as WorkbookNeutralDocument);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toEqual([
      expect.objectContaining({
        stage: 'metadata',
        code: 'INVALID_EXPORTED_AT',
        sheetName: '_Meta',
        excelRow: 2,
      }),
    ]);
  });

  it('reconstructs Material source metadata only when source evidence exists', () => {
    const result = expectSuccess(
      reconstructBusinessDatasetFromWorkbook(mutableDocument() as WorkbookNeutralDocument),
    );
    expect(result.dataset.materials.find((material) => material.id === 'mat-z-vessel')?.source).toBeUndefined();
    expect(result.dataset.materials.find((material) => material.id === 'MAT-A-PLASTER')?.source).toEqual({
      vendorName: 'Supplier A',
      source: '=literal source detail',
      purchaseLink: 'https://example.com/plaster',
      contactNumber: '+63 900 000 0000',
      socialPage: '@supplier-a',
      notes: '-literal source note',
    });
  });

  it('preserves explicit zero and null pricing policy semantics', () => {
    const result = expectSuccess(
      reconstructBusinessDatasetFromWorkbook(mutableDocument() as WorkbookNeutralDocument),
    );
    expect(result.dataset.productStocks).toContainEqual(
      expect.objectContaining({ productId: 'Product-A', onHandQuantity: 0 }),
    );
    expect(result.dataset.productFinancialProfiles.find((profile) => profile.productId === 'product-z')?.pricingPolicy).toBeNull();
    expect(result.dataset.productFinancialProfiles.find((profile) => profile.productId === 'Product-A')?.pricingPolicy).toEqual({
      method: 'profit-amount',
      value: 0,
    });
  });

  it('reconstructs child arrays by explicit order even when worksheet rows are physically shuffled', () => {
    const document = mutableDocument();
    mutableSheet(document, 'MixPresetCategories').rows.reverse();
    mutableSheet(document, 'MixPresetLines').rows.reverse();
    mutableSheet(document, 'YieldSampleInputs').rows.reverse();

    const result = expectSuccess(
      reconstructBusinessDatasetFromWorkbook(document as WorkbookNeutralDocument),
    );
    expect(result.dataset.mixPresets[0].compatibleCategories).toEqual([
      'candle-pot',
      'paintable-art',
    ]);
    expect(result.dataset.mixPresets[0].lines.map((line) => line.materialId)).toEqual([
      'MAT-A-PLASTER',
      'mat-z-vessel',
    ]);
    expect(
      result.dataset.yieldSamples.find((sample) => sample.id === 'yield-2')?.materialInputs.map(
        (input) => input.materialId,
      ),
    ).toEqual(['MAT-A-PLASTER', 'mat-z-vessel']);
  });

  it('matches child parents using trim-aware case-insensitive identity without rewriting the parent ID', () => {
    const document = mutableDocument();
    mutableSheet(document, 'MixPresetCategories').rows[0].mixPresetId = ' MIX-Z ';
    const result = expectSuccess(
      reconstructBusinessDatasetFromWorkbook(document as WorkbookNeutralDocument),
    );
    expect(result.dataset.mixPresets[0].id).toBe('mix-z');
    expect(result.dataset.mixPresets[0].compatibleCategories[0]).toBe('candle-pot');
  });

  it('rejects orphan child rows instead of silently dropping them', () => {
    const document = mutableDocument();
    mutableSheet(document, 'YieldSampleInputs').rows[0].yieldSampleId = 'missing-sample';
    const result = reconstructBusinessDatasetFromWorkbook(document as WorkbookNeutralDocument);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        stage: 'reconstruction',
        code: 'ORPHAN_CHILD_ROW',
        sheetName: 'YieldSampleInputs',
        column: 'yieldSampleId',
      }),
    );
  });

  it('rejects duplicate child order values', () => {
    const document = mutableDocument();
    const rows = mutableSheet(document, 'MixPresetCategories').rows;
    rows[1].categoryOrder = 1;
    const result = reconstructBusinessDatasetFromWorkbook(document as WorkbookNeutralDocument);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        stage: 'reconstruction',
        code: 'DUPLICATE_CHILD_ORDER',
        sheetName: 'MixPresetCategories',
        column: 'categoryOrder',
      }),
    );
  });

  it('rejects gapped child order sequences', () => {
    const document = mutableDocument();
    mutableSheet(document, 'MixPresetLines').rows[1].lineOrder = 3;
    const result = reconstructBusinessDatasetFromWorkbook(document as WorkbookNeutralDocument);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        stage: 'reconstruction',
        code: 'INVALID_CHILD_ORDER_SEQUENCE',
        sheetName: 'MixPresetLines',
        column: 'lineOrder',
      }),
    );
  });

  it('rejects child order sequences that do not start at one', () => {
    const document = mutableDocument();
    const yieldOneInputs = mutableSheet(document, 'YieldSampleInputs').rows.filter(
      (row) => row.yieldSampleId === 'yield-1',
    );
    expect(yieldOneInputs).toHaveLength(1);
    yieldOneInputs[0].inputOrder = 2;
    const result = reconstructBusinessDatasetFromWorkbook(document as WorkbookNeutralDocument);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        stage: 'reconstruction',
        code: 'INVALID_CHILD_ORDER_SEQUENCE',
        sheetName: 'YieldSampleInputs',
      }),
    );
  });

  it('passes reconstructed candidates through 5.1C and surfaces semantic reference issues', () => {
    const document = mutableDocument();
    mutableSheet(document, 'RecipeItems').rows[0].materialId = 'missing-material';
    const result = reconstructBusinessDatasetFromWorkbook(document as WorkbookNeutralDocument);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        stage: 'dataset',
        code: 'MISSING_REFERENCE',
        sheetName: 'RecipeItems',
        column: 'materialId',
        path: 'recipeItems[0].materialId',
      }),
    );
  });

  it('keeps one-sided pricing fields in the schema stage rather than inventing a policy', () => {
    const document = mutableDocument();
    const row = mutableSheet(document, 'ProductFinancialProfiles').rows.find(
      (candidate) => candidate.productId === 'Product-A',
    );
    if (!row) throw new Error('Missing Product-A finance fixture.');
    row.pricingValue = undefined;
    const result = reconstructBusinessDatasetFromWorkbook(document as WorkbookNeutralDocument);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        stage: 'schema',
        code: 'INVALID_PAIRED_FIELDS',
        sheetName: 'ProductFinancialProfiles',
      }),
    );
  });

  it('preserves literal formula-looking text through real XLSX import', () => {
    const codec = new SheetJsWorkbookCodec();
    const result = importBusinessDatasetFromXlsx(
      exportBusinessDatasetToXlsx(datasetFixture(), METADATA, codec),
      codec,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dataset.materials.find((material) => material.id === 'MAT-A-PLASTER')?.notes).toBe(
      '=SUM(A1:A2)',
    );
    expect(result.dataset.yieldSamples.find((sample) => sample.id === 'yield-1')?.notes).toBe(
      '=literal yield note',
    );
  });

  it('does not mutate the neutral workbook during reconstruction', () => {
    const document = mutableDocument();
    const before = structuredClone(document);
    const result = reconstructBusinessDatasetFromWorkbook(document as WorkbookNeutralDocument);
    expect(result.ok).toBe(true);
    expect(document).toEqual(before);
  });
});
