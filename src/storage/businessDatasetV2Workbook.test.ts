import { describe, expect, it } from 'vitest';
import {
  BUSINESS_DATASET_V2_SCHEMA_VERSION,
  createEmptyBusinessDatasetV2,
  type BusinessDatasetV2,
} from '../domain/businessDatasetV2';
import {
  BusinessDatasetV2WorkbookExportError,
  CORE_WORKBOOK_V3_CANONICAL_SHEET_NAMES,
  CORE_WORKBOOK_V3_FORMAT_VERSION,
  PRODUCT_PRICE_TIERS_SHEET_NAME,
  PRODUCT_PRICE_TIERS_WORKBOOK_COLUMNS,
  createBusinessDatasetV2WorkbookDocument,
  exportBusinessDatasetV2ToXlsx,
  importBusinessDatasetV2FromXlsx,
  reconstructBusinessDatasetV2FromWorkbook,
  validateBusinessDatasetV2WorkbookSchema,
} from './businessDatasetV2Workbook';
import { SheetJsWorkbookCodec } from './sheetJsWorkbookCodec';
import type { WorkbookCodec } from './workbookCodec';
import type { WorkbookNeutralDocument } from './workbookSchema';

const METADATA = {
  exportedAt: '2026-09-20T02:00:00.000Z',
  applicationVersion: '0.1.0',
} as const;

function datasetFixture(): BusinessDatasetV2 {
  const dataset = createEmptyBusinessDatasetV2();

  dataset.products = [
    {
      id: 'PROD-B',
      name: 'Product B',
      category: 'candle',
      safetyWasteRate: 0,
      isActive: true,
    },
    {
      id: 'PROD-A',
      name: 'Product A',
      category: 'paintable-art',
      safetyWasteRate: 0.05,
      isActive: true,
    },
  ];

  dataset.productFinancialProfiles = [
    {
      productId: 'PROD-A',
      laborCostPerUnit: 10,
      overheadCostPerUnit: 5,
      pricingPolicy: { method: 'profit-amount', value: 20 },
    },
  ];

  dataset.productPriceTiers = [
    {
      id: 'TIER-Z',
      productId: 'PROD-B',
      name: 'Custom Event',
      kind: 'custom',
      priceBasis: 'per-offer',
      priceAmount: 500.125,
      unitsPerOffer: 10,
      minimumOrderQuantity: 20,
      additionalCostPerOffer: 25.5,
      notes: '=literal tier note',
      isActive: false,
    },
    {
      id: 'TIER-A',
      productId: 'PROD-A',
      name: 'Bulk 20+',
      kind: 'bulk',
      priceBasis: 'per-unit',
      priceAmount: 40.75,
      unitsPerOffer: 1,
      minimumOrderQuantity: 20,
      additionalCostPerOffer: 0,
      isActive: true,
    },
  ];

  return dataset;
}

function sheet(document: WorkbookNeutralDocument, name: string) {
  const found = document.sheets.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`Missing test sheet ${name}`);
  return found;
}

function mutableDocument(): {
  sheets: Array<{
    name: string;
    columns: string[];
    rows: Array<Record<string, unknown>>;
  }>;
} {
  return structuredClone(
    createBusinessDatasetV2WorkbookDocument(datasetFixture(), METADATA),
  );
}

describe('BusinessDataset v2 core workbook v3', () => {
  it('emits workbook v3 / dataset v2 with exactly 14 canonical sheets', () => {
    const document = createBusinessDatasetV2WorkbookDocument(
      datasetFixture(),
      METADATA,
    );

    expect(document.sheets.map((candidate) => candidate.name)).toEqual(
      CORE_WORKBOOK_V3_CANONICAL_SHEET_NAMES,
    );
    expect(sheet(document, '_Meta').rows).toEqual([
      {
        formatId: 'craft-business-manager',
        workbookFormatVersion: CORE_WORKBOOK_V3_FORMAT_VERSION,
        datasetSchemaVersion: BUSINESS_DATASET_V2_SCHEMA_VERSION,
        exportedAt: METADATA.exportedAt,
        applicationVersion: METADATA.applicationVersion,
      },
    ]);
    expect(CORE_WORKBOOK_V3_FORMAT_VERSION).toBe(3);
    expect(BUSINESS_DATASET_V2_SCHEMA_VERSION).toBe(2);
    expect(validateBusinessDatasetV2WorkbookSchema(document)).toEqual([]);
  });

  it('exports the canonical ProductPriceTiers columns and deterministic tier ID order', () => {
    const document = createBusinessDatasetV2WorkbookDocument(
      datasetFixture(),
      METADATA,
    );
    const tiers = sheet(document, PRODUCT_PRICE_TIERS_SHEET_NAME);

    expect(tiers.columns).toEqual(PRODUCT_PRICE_TIERS_WORKBOOK_COLUMNS);
    expect(tiers.rows.map((row) => row.id)).toEqual(['TIER-A', 'TIER-Z']);
    expect(tiers.rows[0]).toEqual({
      id: 'TIER-A',
      productId: 'PROD-A',
      name: 'Bulk 20+',
      kind: 'bulk',
      priceBasis: 'per-unit',
      priceAmount: 40.75,
      unitsPerOffer: 1,
      minimumOrderQuantity: 20,
      additionalCostPerOffer: 0,
      notes: undefined,
      isActive: true,
    });
    expect(tiers.rows[1]?.notes).toBe('=literal tier note');
  });

  it('round-trips ProductPriceTiers through real XLSX bytes at full numeric precision', () => {
    const codec = new SheetJsWorkbookCodec();
    const source = datasetFixture();

    const bytes = exportBusinessDatasetV2ToXlsx(source, METADATA, codec);
    const result = importBusinessDatasetV2FromXlsx(bytes, codec);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));

    expect(result.metadata).toEqual({
      formatId: 'craft-business-manager',
      workbookFormatVersion: 3,
      datasetSchemaVersion: 2,
      exportedAt: METADATA.exportedAt,
      applicationVersion: METADATA.applicationVersion,
    });
    expect(result.dataset).toEqual(source);
    expect(result.dataset.productPriceTiers[1]?.priceAmount).toBe(500.125);
    expect(result.dataset.productPriceTiers[1]?.additionalCostPerOffer).toBe(
      25.5,
    );
  });

  it('round-trips an empty ProductPriceTiers collection without synthesizing tiers', () => {
    const codec = new SheetJsWorkbookCodec();
    const source = datasetFixture();
    source.productPriceTiers = [];

    const result = importBusinessDatasetV2FromXlsx(
      exportBusinessDatasetV2ToXlsx(source, METADATA, codec),
      codec,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    expect(result.dataset.productPriceTiers).toEqual([]);
  });

  it('rejects a missing ProductPriceTiers sheet at the schema boundary', () => {
    const document = mutableDocument();
    document.sheets = document.sheets.filter(
      (candidate) => candidate.name !== PRODUCT_PRICE_TIERS_SHEET_NAME,
    );

    const result = reconstructBusinessDatasetV2FromWorkbook(document);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure.');
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: 'schema',
          code: 'MISSING_REQUIRED_SHEET',
          sheetName: PRODUCT_PRICE_TIERS_SHEET_NAME,
        }),
      ]),
    );
  });

  it('rejects noncanonical ProductPriceTiers columns and enum tokens', () => {
    const document = mutableDocument();
    const tiers = document.sheets.find(
      (candidate) => candidate.name === PRODUCT_PRICE_TIERS_SHEET_NAME,
    )!;
    tiers.columns = [...tiers.columns].reverse();
    tiers.rows[0]!.kind = 'wholesale';

    const result = reconstructBusinessDatasetV2FromWorkbook(document);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure.');
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: 'schema',
          code: 'INVALID_COLUMN_ORDER',
          sheetName: PRODUCT_PRICE_TIERS_SHEET_NAME,
        }),
        expect.objectContaining({
          stage: 'schema',
          code: 'INVALID_ENUM_TOKEN',
          sheetName: PRODUCT_PRICE_TIERS_SHEET_NAME,
          column: 'kind',
        }),
      ]),
    );
  });

  it('rejects formulas in authoritative tier cells instead of evaluating them', () => {
    const document = mutableDocument();
    const tiers = document.sheets.find(
      (candidate) => candidate.name === PRODUCT_PRICE_TIERS_SHEET_NAME,
    )!;
    tiers.rows[0]!.priceAmount = {
      formula: '1+1',
      cachedValue: 2,
    };

    const result = reconstructBusinessDatasetV2FromWorkbook(document);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure.');
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: 'schema',
          code: 'FORMULA_CELL_NOT_ALLOWED',
          sheetName: PRODUCT_PRICE_TIERS_SHEET_NAME,
          column: 'priceAmount',
        }),
      ]),
    );
  });

  it('rejects reconstructed tier Product references that do not exist', () => {
    const document = mutableDocument();
    const tiers = document.sheets.find(
      (candidate) => candidate.name === PRODUCT_PRICE_TIERS_SHEET_NAME,
    )!;
    tiers.rows[0]!.productId = 'MISSING';

    const result = reconstructBusinessDatasetV2FromWorkbook(document);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure.');
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: 'dataset',
          code: 'MISSING_REFERENCE',
          path: 'productPriceTiers[0].productId',
        }),
      ]),
    );
  });

  it('rejects invalid v2 datasets before invoking the workbook codec', () => {
    const source = datasetFixture();
    source.productPriceTiers[0]!.priceAmount = -1;

    let encodeCalls = 0;
    const codec: WorkbookCodec = {
      encode() {
        encodeCalls += 1;
        return new Uint8Array();
      },
      decode() {
        return { sheets: [] };
      },
    };

    expect(() =>
      exportBusinessDatasetV2ToXlsx(source, METADATA, codec),
    ).toThrowError(BusinessDatasetV2WorkbookExportError);
    expect(encodeCalls).toBe(0);
  });

  it('applies binary resource limits before decoding v3 workbooks', () => {
    let decodeCalls = 0;
    const codec: WorkbookCodec = {
      encode() {
        return new Uint8Array();
      },
      decode() {
        decodeCalls += 1;
        return { sheets: [] };
      },
    };

    const result = importBusinessDatasetV2FromXlsx(
      new Uint8Array(10),
      codec,
      { maxWorkbookBytes: 5 },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure.');
    expect(result.issues[0]).toMatchObject({
      stage: 'resource-limit',
      code: 'WORKBOOK_BYTES_EXCEEDED',
    });
    expect(decodeCalls).toBe(0);
  });
});
