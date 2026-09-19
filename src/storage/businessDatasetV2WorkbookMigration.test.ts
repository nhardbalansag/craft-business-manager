import { describe, expect, it } from 'vitest';
import type { BusinessDataset } from '../domain/types';
import { createBusinessDatasetWorkbookDocument } from './businessDatasetWorkbookExport';
import {
  CORE_WORKBOOK_V3_MIGRATION_STEPS,
  CORE_WORKBOOK_V3_VERSION_KEY,
  PRODUCT_PRICE_TIERS_SHEET_NAME,
  PRODUCT_PRICE_TIERS_WORKBOOK_COLUMNS,
  coreWorkbookV3MigrationRegistry,
  importBusinessDatasetV2FromXlsx,
} from './businessDatasetV2Workbook';
import { prepareWorkbookForCurrentImport } from './workbookImportCompatibility';
import { SheetJsWorkbookCodec } from './sheetJsWorkbookCodec';
import type { WorkbookNeutralDocument } from './workbookSchema';

const METADATA = {
  exportedAt: '2026-09-20T03:00:00.000Z',
  applicationVersion: '0.1.0',
} as const;

function legacyDataset(): BusinessDataset {
  return {
    schemaVersion: 1,
    materials: [],
    materialCalibrations: [],
    mixPresets: [],
    products: [
      {
        id: 'PROD-A',
        name: 'Existing Product',
        category: 'candle',
        safetyWasteRate: 0.05,
        isActive: true,
      },
    ],
    yieldSamples: [],
    recipeItems: [],
    productComponents: [],
    productStocks: [{ productId: 'PROD-A', onHandQuantity: 12 }],
    productFinancialProfiles: [
      {
        productId: 'PROD-A',
        laborCostPerUnit: 15.25,
        overheadCostPerUnit: 7.75,
        pricingPolicy: { method: 'profit-amount', value: 30.5 },
        notes: 'Existing Default / Single pricing profile',
      },
    ],
  };
}

function v2Document(): WorkbookNeutralDocument {
  return createBusinessDatasetWorkbookDocument(legacyDataset(), METADATA);
}

function v1Document(): WorkbookNeutralDocument {
  const document = structuredClone(v2Document()) as WorkbookNeutralDocument;

  return {
    sheets: document.sheets.map((sheet) => {
      if (sheet.name === '_Meta') {
        return {
          ...sheet,
          rows: sheet.rows.map((row, index) =>
            index === 0 ? { ...row, workbookFormatVersion: 1 } : row,
          ),
        };
      }

      if (sheet.name !== 'Products') return sheet;

      return {
        ...sheet,
        columns: sheet.columns.filter(
          (column) => column !== 'preferredYieldSampleId',
        ),
        rows: sheet.rows.map((row) => {
          const { preferredYieldSampleId: _ignored, ...rest } = row;
          return rest;
        }),
      };
    }),
  };
}

function sheet(document: WorkbookNeutralDocument, name: string) {
  const found = document.sheets.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`Missing sheet ${name}`);
  return found;
}

describe('TP5C core v1/v2 -> v3 migration chain', () => {
  it('registers the exact two-step core path ending at workbook v3 / dataset v2', () => {
    expect(CORE_WORKBOOK_V3_MIGRATION_STEPS).toHaveLength(2);
    expect(
      CORE_WORKBOOK_V3_MIGRATION_STEPS.map((step) => ({
        from: step.from,
        to: step.to,
      })),
    ).toEqual([
      {
        from: { workbookFormatVersion: 1, datasetSchemaVersion: 1 },
        to: { workbookFormatVersion: 2, datasetSchemaVersion: 1 },
      },
      {
        from: { workbookFormatVersion: 2, datasetSchemaVersion: 1 },
        to: { workbookFormatVersion: 3, datasetSchemaVersion: 2 },
      },
    ]);
    expect(CORE_WORKBOOK_V3_VERSION_KEY).toEqual({
      workbookFormatVersion: 3,
      datasetSchemaVersion: 2,
    });
  });

  it('migrates core v2 to v3 by retaining existing sheets/rows and adding only an empty tier source', () => {
    const source = v2Document();
    const prepared = prepareWorkbookForCurrentImport(
      source,
      coreWorkbookV3MigrationRegistry,
      CORE_WORKBOOK_V3_VERSION_KEY,
    );

    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error(JSON.stringify(prepared.issues));

    expect(prepared.migrated).toBe(true);
    expect(prepared.sourceVersion).toEqual({
      workbookFormatVersion: 2,
      datasetSchemaVersion: 1,
    });
    expect(prepared.targetVersion).toEqual({
      workbookFormatVersion: 3,
      datasetSchemaVersion: 2,
    });

    expect(sheet(prepared.document, '_Meta').rows[0]).toEqual({
      ...sheet(source, '_Meta').rows[0],
      workbookFormatVersion: 3,
      datasetSchemaVersion: 2,
    });
    expect(sheet(prepared.document, PRODUCT_PRICE_TIERS_SHEET_NAME)).toEqual({
      name: PRODUCT_PRICE_TIERS_SHEET_NAME,
      columns: PRODUCT_PRICE_TIERS_WORKBOOK_COLUMNS,
      rows: [],
    });

    for (const sourceSheet of source.sheets.filter(
      (candidate) => candidate.name !== '_Meta',
    )) {
      expect(sheet(prepared.document, sourceSheet.name)).toEqual(sourceSheet);
    }
  });

  it('migrates core v1 through Preferred Yield first, then appends the empty tier collection', () => {
    const source = v1Document();
    const path = coreWorkbookV3MigrationRegistry.resolvePath(
      { workbookFormatVersion: 1, datasetSchemaVersion: 1 },
      CORE_WORKBOOK_V3_VERSION_KEY,
    );

    expect(path).toHaveLength(2);

    const prepared = prepareWorkbookForCurrentImport(
      source,
      coreWorkbookV3MigrationRegistry,
      CORE_WORKBOOK_V3_VERSION_KEY,
    );

    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error(JSON.stringify(prepared.issues));

    const products = sheet(prepared.document, 'Products');
    expect(products.columns).toContain('preferredYieldSampleId');
    expect(products.rows[0]?.preferredYieldSampleId).toBeUndefined();
    expect(sheet(prepared.document, PRODUCT_PRICE_TIERS_SHEET_NAME).rows).toEqual([]);
    expect(sheet(prepared.document, '_Meta').rows[0]).toMatchObject({
      workbookFormatVersion: 3,
      datasetSchemaVersion: 2,
    });
  });

  it('imports a real legacy core v2 XLSX into BusinessDataset v2 with zero tiers and unchanged Default / Single profile', () => {
    const codec = new SheetJsWorkbookCodec();
    const source = v2Document();
    const bytes = codec.encode(source);

    const result = importBusinessDatasetV2FromXlsx(bytes, codec);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));

    expect(result.metadata).toMatchObject({
      workbookFormatVersion: 3,
      datasetSchemaVersion: 2,
    });
    expect(result.dataset.productPriceTiers).toEqual([]);
    expect(result.dataset.productFinancialProfiles).toEqual(
      legacyDataset().productFinancialProfiles,
    );
    expect(result.dataset.products[0]).toMatchObject({
      id: 'PROD-A',
      name: 'Existing Product',
      safetyWasteRate: 0.05,
    });
  });

  it('imports a real core v1 XLSX through both migrations without synthesizing price tiers', () => {
    const codec = new SheetJsWorkbookCodec();
    const bytes = codec.encode(v1Document());

    const result = importBusinessDatasetV2FromXlsx(bytes, codec);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));

    expect(result.dataset.productPriceTiers).toEqual([]);
    expect(result.dataset.productFinancialProfiles).toEqual(
      legacyDataset().productFinancialProfiles,
    );
    expect(result.dataset.products[0]?.preferredYieldSampleId).toBeUndefined();
  });

  it('leaves an already-current v3 workbook unmigrated and preserves existing tier rows', () => {
    const codec = new SheetJsWorkbookCodec();
    const sourceV2 = v2Document();
    const prepared = prepareWorkbookForCurrentImport(
      sourceV2,
      coreWorkbookV3MigrationRegistry,
      CORE_WORKBOOK_V3_VERSION_KEY,
    );
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error(JSON.stringify(prepared.issues));

    const current = structuredClone(prepared.document) as WorkbookNeutralDocument;
    const tiers = sheet(current, PRODUCT_PRICE_TIERS_SHEET_NAME);
    (tiers.rows as Array<Record<string, unknown>>).push({
      id: 'TIER-0001',
      productId: 'PROD-A',
      name: 'Bulk 20+',
      kind: 'bulk',
      priceBasis: 'per-unit',
      priceAmount: 45,
      unitsPerOffer: 1,
      minimumOrderQuantity: 20,
      additionalCostPerOffer: 0,
      isActive: true,
    });

    const bytes = codec.encode(current);
    const result = importBusinessDatasetV2FromXlsx(bytes, codec);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    expect(result.dataset.productPriceTiers).toEqual([
      expect.objectContaining({
        id: 'TIER-0001',
        productId: 'PROD-A',
        priceAmount: 45,
      }),
    ]);
  });
});
