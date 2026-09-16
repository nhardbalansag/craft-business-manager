import { describe, expect, it } from 'vitest';
import type { BusinessDataset } from '../domain/types';
import {
  createBusinessDatasetWorkbookDocument,
} from './businessDatasetWorkbookExport';
import { reconstructBusinessDatasetFromWorkbook } from './businessDatasetWorkbookImport';
import {
  CURRENT_WORKBOOK_VERSION_KEY,
  PRODUCTION_WORKBOOK_MIGRATION_STEPS,
  WorkbookMigrationRegistry,
  cloneWorkbookNeutralDocument,
  type WorkbookMigrationStep,
  type WorkbookVersionKey,
} from './workbookCompatibility';
import { prepareWorkbookForCurrentImport } from './workbookImportCompatibility';
import {
  CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
  type WorkbookNeutralDocument,
} from './workbookSchema';

type MutableSheet = {
  name: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
};

type MutableWorkbook = {
  sheets: MutableSheet[];
};

function version(
  workbookFormatVersion: number,
  datasetSchemaVersion: number,
): WorkbookVersionKey {
  return { workbookFormatVersion, datasetSchemaVersion };
}

function metaDocument(
  row: Record<string, unknown>,
): WorkbookNeutralDocument {
  return {
    sheets: [
      {
        name: '_Meta',
        columns: [
          'formatId',
          'workbookFormatVersion',
          'datasetSchemaVersion',
          'exportedAt',
          'applicationVersion',
        ],
        rows: [row],
      },
    ],
  };
}

function versionDocument(
  workbookFormatVersion: number,
  datasetSchemaVersion: number,
  formatId: unknown = CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
): WorkbookNeutralDocument {
  return metaDocument({
    formatId,
    workbookFormatVersion,
    datasetSchemaVersion,
    exportedAt: '2026-09-16T02:00:00.000Z',
    applicationVersion: '5.4a3-test',
  });
}

function rewriteVersion(
  document: WorkbookNeutralDocument,
  target: WorkbookVersionKey,
): WorkbookNeutralDocument {
  const output = cloneWorkbookNeutralDocument(document);
  const meta = output.sheets.find((candidate) => candidate.name === '_Meta');
  if (!meta) throw new Error('Synthetic migration fixture is missing _Meta.');
  const row = meta.rows[0] as Record<string, unknown>;
  row.workbookFormatVersion = target.workbookFormatVersion;
  row.datasetSchemaVersion = target.datasetSchemaVersion;
  return output;
}

function migrationStep(
  from: WorkbookVersionKey,
  to: WorkbookVersionKey,
  label: string,
  calls: string[],
): WorkbookMigrationStep {
  return {
    from,
    to,
    migrate(document) {
      calls.push(label);
      return rewriteVersion(document, to);
    },
  };
}

function datasetFixture(): BusinessDataset {
  return {
    schemaVersion: 1,
    materials: [
      {
        id: 'material-a',
        name: 'Plaster',
        group: 'plaster',
        baseUnit: 'g',
        purchaseQuantity: 1,
        purchaseUnit: 'kg',
        packageCost: 100,
        onHandQuantity: 1,
        onHandUnit: 'kg',
        isActive: true,
      },
    ],
    materialCalibrations: [],
    mixPresets: [],
    products: [
      {
        id: 'product-a',
        name: 'Paintable figure',
        category: 'paintable-art',
        safetyWasteRate: 0,
        isActive: true,
      },
      {
        id: 'product-b',
        name: 'Candle display',
        category: 'candle',
        safetyWasteRate: 0,
        isActive: true,
      },
    ],
    yieldSamples: [],
    recipeItems: [],
    productComponents: [],
    productStocks: [],
    productFinancialProfiles: [],
  };
}

function currentDocument(): MutableWorkbook {
  return structuredClone(
    createBusinessDatasetWorkbookDocument(datasetFixture(), {
      exportedAt: '2026-09-16T02:05:00.000Z',
      applicationVersion: '5.4a3-test',
    }),
  ) as MutableWorkbook;
}

function sheet(document: MutableWorkbook, name: string): MutableSheet {
  const found = document.sheets.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`Missing test sheet ${name}.`);
  return found;
}

describe('Phase 5.4A3 compatibility regression and completion gate', () => {
  it('keeps production compatibility at public v1/v1 with no fabricated migration steps', () => {
    expect(CURRENT_WORKBOOK_VERSION_KEY).toEqual(version(1, 1));
    expect(PRODUCTION_WORKBOOK_MIGRATION_STEPS).toEqual([]);

    const result = prepareWorkbookForCurrentImport(versionDocument(1, 1));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.migrated).toBe(false);
    expect(result.sourceVersion).toEqual(version(1, 1));
    expect(result.targetVersion).toEqual(version(1, 1));
  });

  it('fails closed for every future-axis combination, including mixed synthetic lower/future pairs', () => {
    const cases = [
      { source: version(2, 1), target: version(1, 1) },
      { source: version(1, 2), target: version(1, 1) },
      { source: version(2, 2), target: version(1, 1) },
      { source: version(2, 4), target: version(3, 3) },
      { source: version(4, 2), target: version(3, 3) },
    ];

    for (const { source, target } of cases) {
      const result = prepareWorkbookForCurrentImport(
        versionDocument(source.workbookFormatVersion, source.datasetSchemaVersion),
        new WorkbookMigrationRegistry([]),
        target,
      );

      expect(result).toEqual({
        ok: false,
        issues: [
          expect.objectContaining({
            stage: 'compatibility',
            code: 'UNSUPPORTED_FUTURE_VERSION',
            compatibilityStatus: 'unsupported-future',
            sourceVersion: source,
            targetVersion: target,
          }),
        ],
      });
    }
  });

  it('rejects missing, malformed, zero, incomplete, and wrong-format metadata without legacy inference', () => {
    const cases: Array<{ document: WorkbookNeutralDocument; code: string }> = [
      { document: { sheets: [] }, code: 'MISSING_META_SHEET' },
      { document: versionDocument(0, 1), code: 'INVALID_WORKBOOK_FORMAT_VERSION' },
      { document: versionDocument(1, 0), code: 'INVALID_DATASET_SCHEMA_VERSION' },
      { document: versionDocument(1.5, 1), code: 'INVALID_WORKBOOK_FORMAT_VERSION' },
      {
        document: metaDocument({
          formatId: CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
          datasetSchemaVersion: 1,
        }),
        code: 'INVALID_WORKBOOK_FORMAT_VERSION',
      },
      {
        document: metaDocument({
          formatId: CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
          workbookFormatVersion: 1,
        }),
        code: 'INVALID_DATASET_SCHEMA_VERSION',
      },
      { document: versionDocument(1, 1, 'other-app'), code: 'INVALID_FORMAT_ID' },
    ];

    for (const candidate of cases) {
      const result = prepareWorkbookForCurrentImport(candidate.document);
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.issues.some((issue) => issue.code === candidate.code)).toBe(true);
    }
  });

  it('keeps synthetic multi-step migration deterministic, isolated, and defensively owned', () => {
    const source = versionDocument(1, 1);
    const before = structuredClone(source);
    const calls: string[] = [];
    const target = version(3, 3);
    const registry = new WorkbookMigrationRegistry([
      migrationStep(version(1, 1), version(2, 1), 'workbook', calls),
      migrationStep(version(2, 1), version(2, 2), 'dataset', calls),
      migrationStep(version(2, 2), target, 'final', calls),
    ]);

    const result = prepareWorkbookForCurrentImport(source, registry, target);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.migrated).toBe(true);
    expect(calls).toEqual(['workbook', 'dataset', 'final']);
    expect(result.sourceVersion).toEqual(version(1, 1));
    expect(result.targetVersion).toEqual(target);
    expect(source).toEqual(before);
    expect(result.document).not.toBe(source);
    expect(result.document.sheets[0].rows[0]).toEqual(
      expect.objectContaining({ workbookFormatVersion: 3, datasetSchemaVersion: 3 }),
    );
  });

  it('keeps strict current workbook sheet, header, and cell validation authoritative after compatibility preparation', () => {
    const missingSheet = currentDocument();
    missingSheet.sheets = missingSheet.sheets.filter((candidate) => candidate.name !== 'Products');
    const missingSheetResult = reconstructBusinessDatasetFromWorkbook(
      missingSheet as WorkbookNeutralDocument,
    );
    expect(missingSheetResult.ok).toBe(false);
    if (!missingSheetResult.ok) {
      expect(missingSheetResult.issues).toContainEqual(
        expect.objectContaining({ stage: 'schema', code: 'MISSING_REQUIRED_SHEET', sheetName: 'Products' }),
      );
    }

    const missingHeader = currentDocument();
    const materialsHeader = sheet(missingHeader, 'Materials');
    materialsHeader.columns = materialsHeader.columns.filter((column) => column !== 'name');
    const missingHeaderResult = reconstructBusinessDatasetFromWorkbook(
      missingHeader as WorkbookNeutralDocument,
    );
    expect(missingHeaderResult.ok).toBe(false);
    if (!missingHeaderResult.ok) {
      expect(missingHeaderResult.issues).toContainEqual(
        expect.objectContaining({ stage: 'schema', code: 'MISSING_REQUIRED_COLUMN', sheetName: 'Materials', column: 'name' }),
      );
    }

    const formulaCell = currentDocument();
    sheet(formulaCell, 'Materials').rows[0].packageCost = {
      formula: '1+1',
      cachedValue: 2,
    };
    const formulaCellResult = reconstructBusinessDatasetFromWorkbook(
      formulaCell as WorkbookNeutralDocument,
    );
    expect(formulaCellResult.ok).toBe(false);
    if (!formulaCellResult.ok) {
      expect(formulaCellResult.issues).toContainEqual(
        expect.objectContaining({ stage: 'schema', code: 'FORMULA_CELL_NOT_ALLOWED', sheetName: 'Materials', column: 'packageCost' }),
      );
    }
  });

  it('keeps strict current dataset duplicate, reference, and component-cycle validation authoritative', () => {
    const duplicate = currentDocument();
    const productRows = sheet(duplicate, 'Products').rows;
    productRows.splice(1, 0, { ...productRows[0] });
    const duplicateResult = reconstructBusinessDatasetFromWorkbook(
      duplicate as WorkbookNeutralDocument,
    );
    expect(duplicateResult.ok).toBe(false);
    if (!duplicateResult.ok) {
      expect(duplicateResult.issues).toContainEqual(
        expect.objectContaining({ stage: 'dataset', code: 'DUPLICATE_IDENTITY' }),
      );
    }

    const missingReference = currentDocument();
    sheet(missingReference, 'RecipeItems').rows.push({
      id: 'recipe-missing-material',
      productId: 'product-a',
      materialId: 'missing-material',
      quantityPerProduct: 1,
      unit: 'g',
      role: 'additive',
      notes: null,
    });
    const missingReferenceResult = reconstructBusinessDatasetFromWorkbook(
      missingReference as WorkbookNeutralDocument,
    );
    expect(missingReferenceResult.ok).toBe(false);
    if (!missingReferenceResult.ok) {
      expect(missingReferenceResult.issues).toContainEqual(
        expect.objectContaining({ stage: 'dataset', code: 'MISSING_REFERENCE' }),
      );
    }

    const cycle = currentDocument();
    sheet(cycle, 'ProductComponents').rows.push(
      {
        id: 'component-a-to-b',
        parentProductId: 'product-a',
        sourceType: 'product',
        sourceId: 'product-b',
        role: 'other',
        quantityPerParent: 1,
        notes: null,
      },
      {
        id: 'component-b-to-a',
        parentProductId: 'product-b',
        sourceType: 'product',
        sourceId: 'product-a',
        role: 'other',
        quantityPerParent: 1,
        notes: null,
      },
    );
    const cycleResult = reconstructBusinessDatasetFromWorkbook(cycle as WorkbookNeutralDocument);
    expect(cycleResult.ok).toBe(false);
    if (!cycleResult.ok) {
      expect(cycleResult.issues).toContainEqual(
        expect.objectContaining({ stage: 'dataset', code: 'INVALID_COMPONENT_GRAPH' }),
      );
    }
  });
});
