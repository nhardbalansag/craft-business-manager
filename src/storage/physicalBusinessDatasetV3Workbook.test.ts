import { describe, expect, it } from 'vitest';
import { createEmptyBusinessDataset } from '../domain/businessDataset';
import { createEmptyBusinessDatasetV2 } from '../domain/businessDatasetV2';
import {
  extendLegacyBusinessDataset,
} from '../domain/physicalBusinessDataset';
import {
  extendBusinessDatasetV2,
  PHYSICAL_BUSINESS_DATASET_V3_SCHEMA_VERSION,
} from '../domain/physicalBusinessDatasetV3';
import {
  createPhysicalBusinessDatasetWorkbookDocument,
} from './physicalBusinessDatasetWorkbook';
import {
  PHYSICAL_WORKBOOK_V3_CANONICAL_SHEET_NAMES,
  PHYSICAL_WORKBOOK_V3_FORMAT_VERSION,
  PHYSICAL_WORKBOOK_V3_MIGRATION_STEPS,
  PHYSICAL_WORKBOOK_V3_VERSION_KEY,
  PHYSICAL_V3_MOLDS_SHEET_NAME,
  PHYSICAL_V3_STORAGE_SHEET_NAME,
  createPhysicalBusinessDatasetV3WorkbookDocument,
  exportPhysicalBusinessDatasetV3ToXlsx,
  importPhysicalBusinessDatasetV3FromXlsx,
  physicalWorkbookV3MigrationRegistry,
} from './physicalBusinessDatasetV3Workbook';
import {
  PRODUCT_PRICE_TIERS_SHEET_NAME,
} from './businessDatasetV2Workbook';
import { prepareWorkbookForCurrentImport } from './workbookImportCompatibility';
import { SheetJsWorkbookCodec } from './sheetJsWorkbookCodec';
import type { WorkbookNeutralDocument } from './workbookSchema';

const codec = new SheetJsWorkbookCodec();
const metadata = {
  exportedAt: '2026-09-20T04:00:00.000Z',
  applicationVersion: '0.1.0',
} as const;

function v3Dataset() {
  const core = createEmptyBusinessDatasetV2();
  core.products = [
    {
      id: 'PROD-A',
      name: 'Physical Product',
      category: 'candle',
      safetyWasteRate: 0.05,
      isActive: true,
    },
  ];
  core.productFinancialProfiles = [
    {
      productId: 'PROD-A',
      laborCostPerUnit: 15,
      overheadCostPerUnit: 5,
      pricingPolicy: { method: 'profit-amount', value: 20 },
      notes: 'Default pricing stays authoritative',
    },
  ];
  core.productPriceTiers = [
    {
      id: 'TIER-0001',
      productId: 'PROD-A',
      name: 'Bulk 20+',
      kind: 'bulk',
      priceBasis: 'per-unit',
      priceAmount: 40.5,
      unitsPerOffer: 1,
      minimumOrderQuantity: 20,
      additionalCostPerOffer: 0,
      isActive: true,
    },
  ];

  return extendBusinessDatasetV2(
    core,
    [
      {
        id: 'LOC-RACK-A',
        name: 'Rack A',
        type: 'rack',
        isActive: true,
      },
      {
        id: 'LOC-SHELF-1',
        name: 'Shelf 1',
        type: 'shelf',
        parentId: 'LOC-RACK-A',
        isActive: true,
      },
      {
        id: 'LOC-BIN-1',
        name: 'Bin 1',
        type: 'bin',
        parentId: 'LOC-SHELF-1',
        notes: 'Mold storage',
        isActive: true,
      },
    ],
    [
      {
        id: 'MOLD-0001',
        productId: 'PROD-A',
        name: 'Primary Mold',
        storageLocationId: 'LOC-BIN-1',
        notes: 'Existing mold',
        isActive: true,
      },
    ],
  );
}

function physicalV2Document(): WorkbookNeutralDocument {
  const core = createEmptyBusinessDataset();
  core.products = [
    {
      id: 'PROD-A',
      name: 'Physical Product',
      category: 'candle',
      safetyWasteRate: 0.05,
      preferredYieldSampleId: undefined,
      isActive: true,
    },
  ];
  core.productFinancialProfiles = [
    {
      productId: 'PROD-A',
      laborCostPerUnit: 15,
      overheadCostPerUnit: 5,
      pricingPolicy: { method: 'profit-amount', value: 20 },
      notes: 'Default pricing stays authoritative',
    },
  ];

  const physical = extendLegacyBusinessDataset(
    core,
    [
      {
        id: 'LOC-RACK-A',
        name: 'Rack A',
        type: 'rack',
        isActive: true,
      },
      {
        id: 'LOC-SHELF-1',
        name: 'Shelf 1',
        type: 'shelf',
        parentId: 'LOC-RACK-A',
        isActive: true,
      },
      {
        id: 'LOC-BIN-1',
        name: 'Bin 1',
        type: 'bin',
        parentId: 'LOC-SHELF-1',
        notes: 'Mold storage',
        isActive: true,
      },
    ],
    [
      {
        id: 'MOLD-0001',
        productId: 'PROD-A',
        name: 'Primary Mold',
        storageLocationId: 'LOC-BIN-1',
        notes: 'Existing mold',
        isActive: true,
      },
    ],
  );

  return createPhysicalBusinessDatasetWorkbookDocument(physical, metadata);
}

function getSheet(document: WorkbookNeutralDocument, name: string) {
  const found = document.sheets.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`Missing sheet ${name}`);
  return found;
}

describe('TP5D physical workbook v3 / dataset v3 migration', () => {
  it('defines physical workbook v3 / dataset v3 with the canonical 16-sheet shape', () => {
    const document = createPhysicalBusinessDatasetV3WorkbookDocument(
      v3Dataset(),
      metadata,
    );

    expect(PHYSICAL_WORKBOOK_V3_FORMAT_VERSION).toBe(3);
    expect(PHYSICAL_BUSINESS_DATASET_V3_SCHEMA_VERSION).toBe(3);
    expect(PHYSICAL_WORKBOOK_V3_VERSION_KEY).toEqual({
      workbookFormatVersion: 3,
      datasetSchemaVersion: 3,
    });
    expect(document.sheets.map((sheet) => sheet.name)).toEqual(
      PHYSICAL_WORKBOOK_V3_CANONICAL_SHEET_NAMES,
    );
    expect(document.sheets).toHaveLength(16);
    expect(getSheet(document, '_Meta').rows[0]).toMatchObject({
      workbookFormatVersion: 3,
      datasetSchemaVersion: 3,
    });
  });

  it('round-trips ProductPriceTiers, StorageLocations, and Molds through real XLSX bytes', () => {
    const source = v3Dataset();
    const bytes = exportPhysicalBusinessDatasetV3ToXlsx(
      source,
      metadata,
      codec,
    );
    const result = importPhysicalBusinessDatasetV3FromXlsx(bytes, codec);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));

    expect(result.metadata).toMatchObject({
      workbookFormatVersion: 3,
      datasetSchemaVersion: 3,
    });
    expect(result.dataset.schemaVersion).toBe(3);
    expect(result.dataset.productPriceTiers).toEqual(source.productPriceTiers);
    expect(result.dataset.storageLocations).toEqual(source.storageLocations);
    expect(result.dataset.molds).toEqual(source.molds);
    expect(result.dataset.productFinancialProfiles).toEqual(
      source.productFinancialProfiles,
    );
  });

  it('registers exactly the recognized physical 2/2 -> 3/3 migration edge', () => {
    expect(PHYSICAL_WORKBOOK_V3_MIGRATION_STEPS).toHaveLength(1);
    expect(PHYSICAL_WORKBOOK_V3_MIGRATION_STEPS[0]).toMatchObject({
      from: { workbookFormatVersion: 2, datasetSchemaVersion: 2 },
      to: { workbookFormatVersion: 3, datasetSchemaVersion: 3 },
    });
  });

  it('migrates current physical v2 by preserving core, StorageLocations, and Molds while adding empty tiers', () => {
    const source = physicalV2Document();
    const prepared = prepareWorkbookForCurrentImport(
      source,
      physicalWorkbookV3MigrationRegistry,
      PHYSICAL_WORKBOOK_V3_VERSION_KEY,
    );

    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error(JSON.stringify(prepared.issues));

    expect(prepared.migrated).toBe(true);
    expect(prepared.sourceVersion).toEqual({
      workbookFormatVersion: 2,
      datasetSchemaVersion: 2,
    });
    expect(prepared.targetVersion).toEqual({
      workbookFormatVersion: 3,
      datasetSchemaVersion: 3,
    });

    expect(getSheet(prepared.document, PRODUCT_PRICE_TIERS_SHEET_NAME).rows).toEqual([]);
    expect(getSheet(prepared.document, PHYSICAL_V3_STORAGE_SHEET_NAME)).toEqual(
      getSheet(source, PHYSICAL_V3_STORAGE_SHEET_NAME),
    );
    expect(getSheet(prepared.document, PHYSICAL_V3_MOLDS_SHEET_NAME)).toEqual(
      getSheet(source, PHYSICAL_V3_MOLDS_SHEET_NAME),
    );
    expect(getSheet(prepared.document, 'ProductFinancialProfiles')).toEqual(
      getSheet(source, 'ProductFinancialProfiles'),
    );
    expect(getSheet(prepared.document, '_Meta').rows[0]).toEqual({
      ...getSheet(source, '_Meta').rows[0],
      workbookFormatVersion: 3,
      datasetSchemaVersion: 3,
    });
  });

  it('imports real physical v2 XLSX into physical dataset v3 with empty tiers and preserved physical records', () => {
    const source = physicalV2Document();
    const result = importPhysicalBusinessDatasetV3FromXlsx(
      codec.encode(source),
      codec,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));

    expect(result.dataset.productPriceTiers).toEqual([]);
    expect(result.dataset.productFinancialProfiles).toEqual([
      expect.objectContaining({
        productId: 'PROD-A',
        pricingPolicy: { method: 'profit-amount', value: 20 },
      }),
    ]);
    expect(result.dataset.storageLocations).toEqual([
      expect.objectContaining({ id: 'LOC-BIN-1' }),
      expect.objectContaining({ id: 'LOC-RACK-A' }),
      expect.objectContaining({ id: 'LOC-SHELF-1' }),
    ]);
    expect(result.dataset.molds).toEqual([
      expect.objectContaining({
        id: 'MOLD-0001',
        productId: 'PROD-A',
        storageLocationId: 'LOC-BIN-1',
      }),
    ]);
  });

  it('leaves current physical v3 unmigrated and preserves existing tier rows', () => {
    const source = createPhysicalBusinessDatasetV3WorkbookDocument(
      v3Dataset(),
      metadata,
    );

    const prepared = prepareWorkbookForCurrentImport(
      source,
      physicalWorkbookV3MigrationRegistry,
      PHYSICAL_WORKBOOK_V3_VERSION_KEY,
    );

    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error(JSON.stringify(prepared.issues));
    expect(prepared.migrated).toBe(false);

    const result = importPhysicalBusinessDatasetV3FromXlsx(
      codec.encode(source),
      codec,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    expect(result.dataset.productPriceTiers).toEqual(
      v3Dataset().productPriceTiers,
    );
  });

  it('fails closed when a physical v2 workbook collides with the reserved ProductPriceTiers sheet', () => {
    const source = structuredClone(physicalV2Document()) as WorkbookNeutralDocument;
    source.sheets.push({
      name: PRODUCT_PRICE_TIERS_SHEET_NAME,
      columns: ['unexpected'],
      rows: [],
    });

    const result = importPhysicalBusinessDatasetV3FromXlsx(
      codec.encode(source),
      codec,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected migration failure.');
    expect(result.issues).toEqual([
      expect.objectContaining({
        stage: 'migration',
        code: 'MIGRATION_STEP_FAILED',
        stepIndex: 0,
      }),
    ]);
  });
});
