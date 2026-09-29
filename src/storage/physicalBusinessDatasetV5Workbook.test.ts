import { describe, expect, it } from 'vitest';
import { createEmptyBusinessDatasetV2 } from '../domain/businessDatasetV2';
import { extendBusinessDatasetV2 } from '../domain/physicalBusinessDatasetV3';
import { extendPhysicalBusinessDatasetV3 } from '../domain/physicalBusinessDatasetV4';
import {
  PHYSICAL_BUSINESS_DATASET_V5_SCHEMA_VERSION,
  extendPhysicalBusinessDatasetV4,
} from '../domain/physicalBusinessDatasetV5';
import {
  PHYSICAL_WORKBOOK_V4_CANONICAL_SHEET_NAMES,
  createPhysicalBusinessDatasetV4WorkbookDocument,
} from './physicalBusinessDatasetV4Workbook';
import {
  PHYSICAL_WORKBOOK_V5_CANONICAL_SHEET_NAMES,
  PHYSICAL_WORKBOOK_V5_FORMAT_VERSION,
  PHYSICAL_WORKBOOK_V5_MIGRATION_STEPS,
  PHYSICAL_WORKBOOK_V5_VERSION_KEY,
  YIELD_MOLD_FORMULA_SOURCES_SHEET_NAME,
  YIELD_MOLD_FORMULA_SOURCES_WORKBOOK_COLUMNS,
  createPhysicalBusinessDatasetV5WorkbookDocument,
  exportPhysicalBusinessDatasetV5ToXlsx,
  importPhysicalBusinessDatasetV5FromXlsx,
  physicalWorkbookV5MigrationRegistry,
} from './physicalBusinessDatasetV5Workbook';
import { SheetJsWorkbookCodec } from './sheetJsWorkbookCodec';
import { prepareWorkbookForCurrentImport } from './workbookImportCompatibility';
import type { WorkbookNeutralDocument } from './workbookSchema';

const metadata = {
  exportedAt: '2026-09-29T12:30:00.000Z',
  applicationVersion: '0.1.0',
} as const;

const codec = new SheetJsWorkbookCodec();

function v4Dataset() {
  const core = createEmptyBusinessDatasetV2();

  core.materials = [
    {
      id: 'WATER',
      name: 'Water',
      group: 'liquid',
      baseUnit: 'g',
      purchaseQuantity: 1000,
      purchaseUnit: 'g',
      packageCost: 10,
      onHandQuantity: 1000,
      onHandUnit: 'g',
      isActive: true,
    },
    {
      id: 'PLASTER',
      name: 'Plaster',
      group: 'plaster',
      baseUnit: 'g',
      purchaseQuantity: 1000,
      purchaseUnit: 'g',
      packageCost: 100,
      onHandQuantity: 1000,
      onHandUnit: 'g',
      isActive: true,
    },
    {
      id: 'GLUE',
      name: 'Glue',
      group: 'other',
      baseUnit: 'g',
      purchaseQuantity: 1000,
      purchaseUnit: 'g',
      packageCost: 50,
      onHandQuantity: 1000,
      onHandUnit: 'g',
      isActive: true,
    },
  ];

  core.products = [
    {
      id: 'PROD-001',
      name: 'Paintable Dino',
      category: 'paintable-art',
      safetyWasteRate: 0.05,
      isActive: true,
    },
  ];

  core.yieldSamples = [
    {
      id: 'YLD-001',
      productId: 'PROD-001',
      materialInputs: [
        {
          materialId: 'PLASTER',
          quantity: 100,
          unit: 'g',
        },
      ],
      goodPieces: 4,
      rejectedPieces: 0,
      recordedAt: '2026-09-29T11:00:00.000Z',
    },
  ];

  const v3 = extendBusinessDatasetV2(
    core,
    [],
    [
      {
        id: 'MOLD-001',
        productId: 'PROD-001',
        name: 'Dino Mold',
        isActive: true,
      },
    ],
  );

  return extendPhysicalBusinessDatasetV3(v3, [
    {
      id: 'PMYP-001',
      moldId: 'MOLD-001',
      waterMaterialId: 'WATER',
      plasterMaterialId: 'PLASTER',
      glueMaterialId: 'GLUE',
      waterFillWeightGrams: 50,
      waterAdjustmentRate: 0.3,
      plasterFactor: 0.75,
      glueFactor: 0.05,
      piecesPerPour: 4,
      isActive: true,
    },
  ]);
}

function v5Dataset() {
  return extendPhysicalBusinessDatasetV4(v4Dataset(), [
    {
      yieldSampleId: 'YLD-001',
      moldId: 'MOLD-001',
      moldYieldProfileId: 'PMYP-001',
    },
  ]);
}

function getSheet(document: WorkbookNeutralDocument, name: string) {
  const found = document.sheets.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`Missing sheet ${name}`);
  return found;
}

describe('YRS2D physical workbook v5 / v4-to-v5 migration', () => {
  it('defines workbook/dataset v5 with provenance appended after physical v4', () => {
    const document = createPhysicalBusinessDatasetV5WorkbookDocument(
      v5Dataset(),
      metadata,
    );

    expect(PHYSICAL_WORKBOOK_V5_FORMAT_VERSION).toBe(5);
    expect(PHYSICAL_BUSINESS_DATASET_V5_SCHEMA_VERSION).toBe(5);
    expect(PHYSICAL_WORKBOOK_V5_VERSION_KEY).toEqual({
      workbookFormatVersion: 5,
      datasetSchemaVersion: 5,
    });
    expect(PHYSICAL_WORKBOOK_V5_CANONICAL_SHEET_NAMES).toEqual([
      ...PHYSICAL_WORKBOOK_V4_CANONICAL_SHEET_NAMES,
      YIELD_MOLD_FORMULA_SOURCES_SHEET_NAME,
    ]);

    expect(getSheet(document, YIELD_MOLD_FORMULA_SOURCES_SHEET_NAME)).toEqual({
      name: YIELD_MOLD_FORMULA_SOURCES_SHEET_NAME,
      columns: [...YIELD_MOLD_FORMULA_SOURCES_WORKBOOK_COLUMNS],
      rows: [
        {
          yieldSampleId: 'YLD-001',
          moldId: 'MOLD-001',
          moldYieldProfileId: 'PMYP-001',
        },
      ],
    });
  });

  it('round-trips Mold Formula provenance through real XLSX bytes', () => {
    const source = v5Dataset();
    const bytes = exportPhysicalBusinessDatasetV5ToXlsx(
      source,
      metadata,
      codec,
    );
    const result = importPhysicalBusinessDatasetV5FromXlsx(bytes, codec);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));

    expect(result.metadata).toMatchObject({
      workbookFormatVersion: 5,
      datasetSchemaVersion: 5,
    });
    expect(result.dataset.yieldMoldFormulaSources).toEqual(
      source.yieldMoldFormulaSources,
    );
    expect(
      createPhysicalBusinessDatasetV5WorkbookDocument(
        result.dataset,
        metadata,
      ),
    ).toEqual(
      createPhysicalBusinessDatasetV5WorkbookDocument(source, metadata),
    );
  });

  it('registers the physical 2/2 -> 3/3 -> 4/4 -> 5/5 migration chain', () => {
    expect(PHYSICAL_WORKBOOK_V5_MIGRATION_STEPS).toHaveLength(3);
    expect(PHYSICAL_WORKBOOK_V5_MIGRATION_STEPS[0]).toMatchObject({
      from: { workbookFormatVersion: 2, datasetSchemaVersion: 2 },
      to: { workbookFormatVersion: 3, datasetSchemaVersion: 3 },
    });
    expect(PHYSICAL_WORKBOOK_V5_MIGRATION_STEPS[1]).toMatchObject({
      from: { workbookFormatVersion: 3, datasetSchemaVersion: 3 },
      to: { workbookFormatVersion: 4, datasetSchemaVersion: 4 },
    });
    expect(PHYSICAL_WORKBOOK_V5_MIGRATION_STEPS[2]).toMatchObject({
      from: { workbookFormatVersion: 4, datasetSchemaVersion: 4 },
      to: { workbookFormatVersion: 5, datasetSchemaVersion: 5 },
    });
  });

  it('migrates physical v4 to v5 without mutating old sheets and adds empty provenance', () => {
    const source = createPhysicalBusinessDatasetV4WorkbookDocument(
      v4Dataset(),
      metadata,
    );
    const sourceClone = structuredClone(source);

    const prepared = prepareWorkbookForCurrentImport(
      source,
      physicalWorkbookV5MigrationRegistry,
      PHYSICAL_WORKBOOK_V5_VERSION_KEY,
    );

    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error(JSON.stringify(prepared.issues));

    expect(source).toEqual(sourceClone);
    expect(prepared.migrated).toBe(true);
    expect(prepared.sourceVersion).toEqual({
      workbookFormatVersion: 4,
      datasetSchemaVersion: 4,
    });
    expect(prepared.targetVersion).toEqual({
      workbookFormatVersion: 5,
      datasetSchemaVersion: 5,
    });

    expect(getSheet(prepared.document, '_Meta').rows[0]).toMatchObject({
      workbookFormatVersion: 5,
      datasetSchemaVersion: 5,
    });
    expect(
      getSheet(prepared.document, YIELD_MOLD_FORMULA_SOURCES_SHEET_NAME),
    ).toEqual({
      name: YIELD_MOLD_FORMULA_SOURCES_SHEET_NAME,
      columns: [...YIELD_MOLD_FORMULA_SOURCES_WORKBOOK_COLUMNS],
      rows: [],
    });

    for (const sourceSheet of source.sheets.filter(
      (candidate) => candidate.name !== '_Meta',
    )) {
      expect(getSheet(prepared.document, sourceSheet.name)).toEqual(
        sourceSheet,
      );
    }
  });

  it('imports a real physical v4 XLSX as v5 with no invented provenance', () => {
    const source = createPhysicalBusinessDatasetV4WorkbookDocument(
      v4Dataset(),
      metadata,
    );
    const result = importPhysicalBusinessDatasetV5FromXlsx(
      codec.encode(source),
      codec,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));

    expect(result.metadata).toMatchObject({
      workbookFormatVersion: 5,
      datasetSchemaVersion: 5,
    });
    expect(result.dataset.yieldMoldFormulaSources).toEqual([]);
    expect(result.dataset.molds).toEqual(v4Dataset().molds);
    expect(result.dataset.plasterMoldYieldProfiles).toEqual(
      v4Dataset().plasterMoldYieldProfiles,
    );
  });

  it('leaves a current v5 document unmigrated', () => {
    const source = createPhysicalBusinessDatasetV5WorkbookDocument(
      v5Dataset(),
      metadata,
    );
    const prepared = prepareWorkbookForCurrentImport(
      source,
      physicalWorkbookV5MigrationRegistry,
      PHYSICAL_WORKBOOK_V5_VERSION_KEY,
    );

    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error(JSON.stringify(prepared.issues));

    expect(prepared.migrated).toBe(false);
    expect(prepared.document).toEqual(source);
  });

  it('requires exact provenance columns and nonblank identifier cells', () => {
    const wrongColumns = structuredClone(
      createPhysicalBusinessDatasetV5WorkbookDocument(v5Dataset(), metadata),
    );
    getSheet(
      wrongColumns,
      YIELD_MOLD_FORMULA_SOURCES_SHEET_NAME,
    ).columns = ['yieldSampleId', 'moldId'];

    const wrongColumnsResult = importPhysicalBusinessDatasetV5FromXlsx(
      codec.encode(wrongColumns),
      codec,
    );
    expect(wrongColumnsResult.ok).toBe(false);
    if (wrongColumnsResult.ok) throw new Error('Expected invalid columns.');
    expect(wrongColumnsResult.issues[0]).toMatchObject({
      stage: 'schema',
      code: 'INVALID_COLUMNS',
      sheetName: YIELD_MOLD_FORMULA_SOURCES_SHEET_NAME,
    });

    const blankIdentifier = structuredClone(
      createPhysicalBusinessDatasetV5WorkbookDocument(v5Dataset(), metadata),
    );
    getSheet(
      blankIdentifier,
      YIELD_MOLD_FORMULA_SOURCES_SHEET_NAME,
    ).rows[0].moldYieldProfileId = '   ';

    const blankResult = importPhysicalBusinessDatasetV5FromXlsx(
      codec.encode(blankIdentifier),
      codec,
    );
    expect(blankResult.ok).toBe(false);
    if (blankResult.ok) throw new Error('Expected invalid identifier.');
    expect(blankResult.issues[0]).toMatchObject({
      stage: 'schema',
      code: 'INVALID_REQUIRED_TEXT',
      sheetName: YIELD_MOLD_FORMULA_SOURCES_SHEET_NAME,
      column: 'moldYieldProfileId',
      rowIndex: 0,
      excelRow: 2,
    });
  });

  it('maps provenance referential failures back to the provenance sheet', () => {
    const document = structuredClone(
      createPhysicalBusinessDatasetV5WorkbookDocument(v5Dataset(), metadata),
    );
    getSheet(
      document,
      YIELD_MOLD_FORMULA_SOURCES_SHEET_NAME,
    ).rows[0].moldId = 'MOLD-MISSING';

    const result = importPhysicalBusinessDatasetV5FromXlsx(
      codec.encode(document),
      codec,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected missing Mold reference.');

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: 'dataset',
          code: 'MISSING_MOLD_REFERENCE',
          path: 'yieldMoldFormulaSources[0].moldId',
          sheetName: YIELD_MOLD_FORMULA_SOURCES_SHEET_NAME,
        }),
      ]),
    );
  });

  it('exports provenance rows deterministically by Yield Sample identity', () => {
    const base = v4Dataset();
    base.yieldSamples.push({
      id: 'YLD-002',
      productId: 'PROD-001',
      materialInputs: [
        {
          materialId: 'PLASTER',
          quantity: 105,
          unit: 'g',
        },
      ],
      goodPieces: 4,
      rejectedPieces: 0,
      recordedAt: '2026-09-29T11:30:00.000Z',
    });

    const dataset = extendPhysicalBusinessDatasetV4(base, [
      {
        yieldSampleId: 'YLD-002',
        moldId: 'MOLD-001',
        moldYieldProfileId: 'PMYP-001',
      },
      {
        yieldSampleId: 'YLD-001',
        moldId: 'MOLD-001',
        moldYieldProfileId: 'PMYP-001',
      },
    ]);

    const rows = getSheet(
      createPhysicalBusinessDatasetV5WorkbookDocument(dataset, metadata),
      YIELD_MOLD_FORMULA_SOURCES_SHEET_NAME,
    ).rows;

    expect(rows.map((row) => row.yieldSampleId)).toEqual([
      'YLD-001',
      'YLD-002',
    ]);
  });
});
