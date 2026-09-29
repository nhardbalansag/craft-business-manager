import { describe, expect, it } from 'vitest';
import { createEmptyBusinessDataset } from '../domain/businessDataset';
import { createEmptyBusinessDatasetV2 } from '../domain/businessDatasetV2';
import { extendLegacyBusinessDataset } from '../domain/physicalBusinessDataset';
import { extendBusinessDatasetV2 } from '../domain/physicalBusinessDatasetV3';
import {
  extendPhysicalBusinessDatasetV3,
  PHYSICAL_BUSINESS_DATASET_V4_SCHEMA_VERSION,
} from '../domain/physicalBusinessDatasetV4';
import { createPhysicalBusinessDatasetWorkbookDocument } from './physicalBusinessDatasetWorkbook';
import { createPhysicalBusinessDatasetV3WorkbookDocument } from './physicalBusinessDatasetV3Workbook';
import {
  PHYSICAL_WORKBOOK_V4_CANONICAL_SHEET_NAMES,
  PHYSICAL_WORKBOOK_V4_FORMAT_VERSION,
  PHYSICAL_WORKBOOK_V4_MIGRATION_STEPS,
  PHYSICAL_WORKBOOK_V4_VERSION_KEY,
  PLASTER_MOLD_YIELD_PROFILES_SHEET_NAME,
  createPhysicalBusinessDatasetV4WorkbookDocument,
  exportPhysicalBusinessDatasetV4ToXlsx,
  importPhysicalBusinessDatasetV4FromXlsx,
  physicalWorkbookV4MigrationRegistry,
} from './physicalBusinessDatasetV4Workbook';
import { prepareWorkbookForCurrentImport } from './workbookImportCompatibility';
import { SheetJsWorkbookCodec } from './sheetJsWorkbookCodec';
import type { WorkbookNeutralDocument } from './workbookSchema';

const codec = new SheetJsWorkbookCodec();
const metadata = {
  exportedAt: '2026-09-29T01:30:00.000Z',
  applicationVersion: 'my3',
} as const;

function v3Base() {
  const core = createEmptyBusinessDatasetV2();
  core.materials = [
    {
      id: 'MAT-WATER',
      name: 'Water',
      group: 'liquid',
      baseUnit: 'g',
      purchaseQuantity: 1000,
      purchaseUnit: 'g',
      packageCost: 25,
      onHandQuantity: 1000,
      onHandUnit: 'g',
      isActive: true,
    },
    {
      id: 'MAT-PLASTER',
      name: 'Plaster',
      group: 'plaster',
      baseUnit: 'g',
      purchaseQuantity: 1000,
      purchaseUnit: 'g',
      packageCost: 70,
      onHandQuantity: 1000,
      onHandUnit: 'g',
      isActive: true,
    },
    {
      id: 'MAT-GLUE',
      name: 'Glue',
      group: 'other',
      baseUnit: 'g',
      purchaseQuantity: 500,
      purchaseUnit: 'g',
      packageCost: 90,
      onHandQuantity: 500,
      onHandUnit: 'g',
      isActive: true,
    },
  ];
  core.products = [
    {
      id: 'PROD-A',
      name: 'Paintable Dino',
      category: 'paintable-art',
      safetyWasteRate: 0.05,
      isActive: true,
    },
  ];

  return extendBusinessDatasetV2(
    core,
    [],
    [
      {
        id: 'MOLD-A',
        productId: 'PROD-A',
        name: 'Dino Mold',
        isActive: true,
      },
    ],
  );
}

function v4Dataset() {
  return extendPhysicalBusinessDatasetV3(
    v3Base(),
    [
      {
        id: 'PMYP-0001',
        moldId: 'MOLD-A',
        waterMaterialId: 'MAT-WATER',
        plasterMaterialId: 'MAT-PLASTER',
        glueMaterialId: 'MAT-GLUE',
        waterFillWeightGrams: 50,
        waterAdjustmentRate: 0.3,
        plasterFactor: 0.75,
        glueFactor: 0.05,
        piecesPerPour: 4,
        notes: 'canonical plaster formula',
        isActive: true,
      },
    ],
  );
}

function physicalV2Document(): WorkbookNeutralDocument {
  const core = createEmptyBusinessDataset();
  core.materials = v3Base().materials;
  core.products = v3Base().products;

  const physical = extendLegacyBusinessDataset(
    core,
    [],
    [
      {
        id: 'MOLD-A',
        productId: 'PROD-A',
        name: 'Dino Mold',
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

describe('MY3 physical workbook v4 / dataset v4 migration', () => {
  it('defines workbook/dataset v4 with the profile sheet appended to physical v3', () => {
    const document = createPhysicalBusinessDatasetV4WorkbookDocument(
      v4Dataset(),
      metadata,
    );

    expect(PHYSICAL_WORKBOOK_V4_FORMAT_VERSION).toBe(4);
    expect(PHYSICAL_BUSINESS_DATASET_V4_SCHEMA_VERSION).toBe(4);
    expect(PHYSICAL_WORKBOOK_V4_VERSION_KEY).toEqual({
      workbookFormatVersion: 4,
      datasetSchemaVersion: 4,
    });
    expect(document.sheets.map((item) => item.name)).toEqual(
      PHYSICAL_WORKBOOK_V4_CANONICAL_SHEET_NAMES,
    );
    expect(getSheet(document, PLASTER_MOLD_YIELD_PROFILES_SHEET_NAME).rows)
      .toEqual([
        expect.objectContaining({
          id: 'PMYP-0001',
          waterFillWeightGrams: 50,
          piecesPerPour: 4,
          isActive: true,
        }),
      ]);
  });

  it('round-trips authoritative profile sources through real XLSX bytes', () => {
    const source = v4Dataset();
    const bytes = exportPhysicalBusinessDatasetV4ToXlsx(source, metadata, codec);
    const result = importPhysicalBusinessDatasetV4FromXlsx(bytes, codec);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));

    expect(result.metadata).toMatchObject({
      workbookFormatVersion: 4,
      datasetSchemaVersion: 4,
    });
    expect(
      createPhysicalBusinessDatasetV4WorkbookDocument(result.dataset, metadata),
    ).toEqual(
      createPhysicalBusinessDatasetV4WorkbookDocument(source, metadata),
    );
    expect(result.dataset.plasterMoldYieldProfiles).toEqual(
      source.plasterMoldYieldProfiles,
    );
  });

  it('registers the physical 2/2 -> 3/3 -> 4/4 migration chain', () => {
    expect(PHYSICAL_WORKBOOK_V4_MIGRATION_STEPS).toHaveLength(2);
    expect(PHYSICAL_WORKBOOK_V4_MIGRATION_STEPS[0]).toMatchObject({
      from: { workbookFormatVersion: 2, datasetSchemaVersion: 2 },
      to: { workbookFormatVersion: 3, datasetSchemaVersion: 3 },
    });
    expect(PHYSICAL_WORKBOOK_V4_MIGRATION_STEPS[1]).toMatchObject({
      from: { workbookFormatVersion: 3, datasetSchemaVersion: 3 },
      to: { workbookFormatVersion: 4, datasetSchemaVersion: 4 },
    });
  });

  it('migrates physical v3 to v4 by preserving all old sheets and adding empty profiles', () => {
    const source = createPhysicalBusinessDatasetV3WorkbookDocument(
      v3Base(),
      metadata,
    );
    const prepared = prepareWorkbookForCurrentImport(
      source,
      physicalWorkbookV4MigrationRegistry,
      PHYSICAL_WORKBOOK_V4_VERSION_KEY,
    );

    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error(JSON.stringify(prepared.issues));
    expect(prepared.migrated).toBe(true);
    expect(prepared.sourceVersion).toEqual({
      workbookFormatVersion: 3,
      datasetSchemaVersion: 3,
    });
    expect(prepared.targetVersion).toEqual({
      workbookFormatVersion: 4,
      datasetSchemaVersion: 4,
    });
    expect(
      getSheet(prepared.document, PLASTER_MOLD_YIELD_PROFILES_SHEET_NAME).rows,
    ).toEqual([]);

    const result = importPhysicalBusinessDatasetV4FromXlsx(
      codec.encode(source),
      codec,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    expect(result.dataset.plasterMoldYieldProfiles).toEqual([]);
    expect(result.dataset.molds).toEqual(v3Base().molds);
  });

  it('migrates physical v2 through both edges and creates empty tier/profile collections', () => {
    const source = physicalV2Document();
    const result = importPhysicalBusinessDatasetV4FromXlsx(
      codec.encode(source),
      codec,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    expect(result.metadata).toMatchObject({
      workbookFormatVersion: 4,
      datasetSchemaVersion: 4,
    });
    expect(result.dataset.productPriceTiers).toEqual([]);
    expect(result.dataset.plasterMoldYieldProfiles).toEqual([]);
    expect(result.dataset.molds).toEqual([
      expect.objectContaining({ id: 'MOLD-A', productId: 'PROD-A' }),
    ]);
  });

  it('rejects profile rows that violate domain/referential integrity', () => {
    const document = createPhysicalBusinessDatasetV4WorkbookDocument(
      v4Dataset(),
      metadata,
    );
    const profileSheet = getSheet(
      document,
      PLASTER_MOLD_YIELD_PROFILES_SHEET_NAME,
    );
    profileSheet.rows[0] = {
      ...profileSheet.rows[0],
      waterMaterialId: 'MISSING-WATER',
    };

    const result = importPhysicalBusinessDatasetV4FromXlsx(
      codec.encode(document),
      codec,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected invalid profile reference.');
    expect(result.issues).toEqual([
      expect.objectContaining({
        stage: 'dataset',
        code: 'MISSING_WATER_MATERIAL_REFERENCE',
        sheetName: PLASTER_MOLD_YIELD_PROFILES_SHEET_NAME,
      }),
    ]);
  });
});
