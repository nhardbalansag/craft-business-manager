import { describe, expect, it } from 'vitest';
import { BUSINESS_DATASET_SOURCE_COLLECTION_KEYS } from '../domain/businessDataset';
import {
  CANONICAL_WORKBOOK_SHEET_NAMES,
  CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
  CURRENT_WORKBOOK_FORMAT_VERSION,
  WORKBOOK_PRIMARY_SHEET_BY_SOURCE_COLLECTION,
  WORKBOOK_RELATIONSHIPS,
  WORKBOOK_SCHEMA_BY_NAME,
  WORKBOOK_SHEETS,
  assertWorkbookSchema,
  getMappedSourceCollections,
  isCurrentWorkbookSchema,
  validateWorkbookSchema,
  type WorkbookSheetName,
} from './workbookSchema';

type MutableSheet = {
  name: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
};

type MutableWorkbook = {
  sheets: MutableSheet[];
};

function createValidWorkbook(): MutableWorkbook {
  return {
    sheets: WORKBOOK_SHEETS.map((sheet) => ({
      name: sheet.name,
      columns: sheet.columns.map((column) => column.key),
      rows:
        sheet.name === '_Meta'
          ? [
              {
                formatId: CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
                workbookFormatVersion: CURRENT_WORKBOOK_FORMAT_VERSION,
                datasetSchemaVersion: 1,
                exportedAt: '2026-09-16T00:00:00.000Z',
                applicationVersion: null,
              },
            ]
          : [],
    })),
  };
}

function sheet(workbook: MutableWorkbook, name: WorkbookSheetName): MutableSheet {
  const found = workbook.sheets.find((candidate) => candidate.name === name);
  if (!found) {
    throw new Error(`Missing test sheet ${name}.`);
  }
  return found;
}

const EXPECTED_COLUMNS: Record<WorkbookSheetName, readonly string[]> = {
  _Meta: [
    'formatId',
    'workbookFormatVersion',
    'datasetSchemaVersion',
    'exportedAt',
    'applicationVersion',
  ],
  Materials: [
    'id',
    'name',
    'group',
    'baseUnit',
    'purchaseQuantity',
    'purchaseUnit',
    'packageCost',
    'manualBaseUnitsPerPurchaseUnit',
    'onHandQuantity',
    'onHandUnit',
    'sourceVendorName',
    'sourceDetail',
    'sourcePurchaseLink',
    'sourceContactNumber',
    'sourceSocialPage',
    'sourceNotes',
    'notes',
    'isActive',
  ],
  Calibrations: [
    'id',
    'materialId',
    'measuredVolume',
    'volumeUnit',
    'knownWeight',
    'weightUnit',
    'recordedAt',
    'notes',
  ],
  MixPresets: ['id', 'name', 'basis', 'notes', 'isActive'],
  MixPresetCategories: ['mixPresetId', 'categoryOrder', 'category'],
  MixPresetLines: ['mixPresetId', 'lineOrder', 'materialId', 'role', 'parts'],
  Products: ['id', 'name', 'category', 'mixPresetId', 'preferredYieldSampleId', 'safetyWasteRate', 'notes', 'isActive'],
  YieldSamples: [
    'id',
    'productId',
    'mixPresetId',
    'goodPieces',
    'rejectedPieces',
    'recordedAt',
    'notes',
  ],
  YieldSampleInputs: ['yieldSampleId', 'inputOrder', 'materialId', 'quantity', 'unit'],
  RecipeItems: [
    'id',
    'productId',
    'materialId',
    'quantityPerProduct',
    'unit',
    'role',
    'notes',
  ],
  ProductComponents: [
    'id',
    'parentProductId',
    'sourceType',
    'sourceId',
    'role',
    'quantityPerParent',
    'notes',
  ],
  ProductStocks: ['productId', 'onHandQuantity', 'notes'],
  ProductFinancialProfiles: [
    'productId',
    'laborCostPerUnit',
    'overheadCostPerUnit',
    'pricingMethod',
    'pricingValue',
    'notes',
  ],
};

describe('Phase 5.1B workbook schema contract', () => {
  it('locks workbook identity/version independently from the dataset version', () => {
    expect(CRAFT_BUSINESS_WORKBOOK_FORMAT_ID).toBe('craft-business-manager');
    expect(CURRENT_WORKBOOK_FORMAT_VERSION).toBe(2);
    expect(WORKBOOK_SCHEMA_BY_NAME._Meta.columns.map((column) => column.key)).toContain(
      'datasetSchemaVersion',
    );
  });

  it('locks the exact 13-sheet canonical order', () => {
    expect(CANONICAL_WORKBOOK_SHEET_NAMES).toEqual([
      '_Meta',
      'Materials',
      'Calibrations',
      'MixPresets',
      'MixPresetCategories',
      'MixPresetLines',
      'Products',
      'YieldSamples',
      'YieldSampleInputs',
      'RecipeItems',
      'ProductComponents',
      'ProductStocks',
      'ProductFinancialProfiles',
    ]);
    expect(WORKBOOK_SHEETS.map((candidate) => candidate.name)).toEqual(
      CANONICAL_WORKBOOK_SHEET_NAMES,
    );
  });

  it('maps every authoritative BusinessDataset source collection to a primary sheet', () => {
    expect(getMappedSourceCollections()).toEqual(BUSINESS_DATASET_SOURCE_COLLECTION_KEYS);
    expect(Object.keys(WORKBOOK_PRIMARY_SHEET_BY_SOURCE_COLLECTION).sort()).toEqual(
      [...BUSINESS_DATASET_SOURCE_COLLECTION_KEYS].sort(),
    );
  });

  it('normalizes MixPreset compatible categories, lines, and YieldSample inputs as child sheets', () => {
    expect(WORKBOOK_RELATIONSHIPS).toEqual([
      expect.objectContaining({
        parentSheet: 'MixPresets',
        childSheet: 'MixPresetCategories',
        orderColumn: 'categoryOrder',
        sourceArrayPath: 'compatibleCategories',
      }),
      expect.objectContaining({
        parentSheet: 'MixPresets',
        childSheet: 'MixPresetLines',
        orderColumn: 'lineOrder',
        sourceArrayPath: 'lines',
      }),
      expect.objectContaining({
        parentSheet: 'YieldSamples',
        childSheet: 'YieldSampleInputs',
        orderColumn: 'inputOrder',
        sourceArrayPath: 'materialInputs',
      }),
    ]);
  });

  it('locks exact ordered columns for every canonical sheet', () => {
    for (const name of CANONICAL_WORKBOOK_SHEET_NAMES) {
      expect(WORKBOOK_SCHEMA_BY_NAME[name].columns.map((column) => column.key)).toEqual(
        EXPECTED_COLUMNS[name],
      );
    }
  });

  it('maps flattened Material source metadata explicitly', () => {
    const materialColumns = WORKBOOK_SCHEMA_BY_NAME.Materials.columns;
    const sourceMappings = Object.fromEntries(
      materialColumns
        .filter((column) => column.key.startsWith('source'))
        .map((column) => [column.key, column.sourcePath]),
    );

    expect(sourceMappings).toEqual({
      sourceVendorName: 'source.vendorName',
      sourceDetail: 'source.source',
      sourcePurchaseLink: 'source.purchaseLink',
      sourceContactNumber: 'source.contactNumber',
      sourceSocialPage: 'source.socialPage',
      sourceNotes: 'source.notes',
    });
  });

  it('preserves pricingPolicy null-vs-zero semantics through paired columns', () => {
    const financialColumns = WORKBOOK_SCHEMA_BY_NAME.ProductFinancialProfiles.columns;
    expect(financialColumns.find((column) => column.key === 'pricingMethod')?.sourcePath).toBe(
      'pricingPolicy.method',
    );
    expect(financialColumns.find((column) => column.key === 'pricingValue')?.sourcePath).toBe(
      'pricingPolicy.value',
    );

    const nullPolicyWorkbook = createValidWorkbook();
    sheet(nullPolicyWorkbook, 'ProductFinancialProfiles').rows.push({
      productId: 'product-1',
      laborCostPerUnit: 0,
      overheadCostPerUnit: 0,
      pricingMethod: null,
      pricingValue: null,
      notes: null,
    });
    expect(validateWorkbookSchema(nullPolicyWorkbook)).toEqual([]);

    const explicitZeroWorkbook = createValidWorkbook();
    sheet(explicitZeroWorkbook, 'ProductFinancialProfiles').rows.push({
      productId: 'product-1',
      laborCostPerUnit: 0,
      overheadCostPerUnit: 0,
      pricingMethod: 'markup-percent',
      pricingValue: 0,
      notes: null,
    });
    expect(validateWorkbookSchema(explicitZeroWorkbook)).toEqual([]);

    const invalidPairWorkbook = createValidWorkbook();
    sheet(invalidPairWorkbook, 'ProductFinancialProfiles').rows.push({
      productId: 'product-1',
      laborCostPerUnit: 0,
      overheadCostPerUnit: 0,
      pricingMethod: 'markup-percent',
      pricingValue: null,
      notes: null,
    });
    expect(validateWorkbookSchema(invalidPairWorkbook)).toContainEqual(
      expect.objectContaining({ code: 'INVALID_PAIRED_FIELDS' }),
    );
  });

  it('marks workbook-only child order columns as positive 1-based integers', () => {
    for (const [name, key] of [
      ['MixPresetCategories', 'categoryOrder'],
      ['MixPresetLines', 'lineOrder'],
      ['YieldSampleInputs', 'inputOrder'],
    ] as const) {
      const contract = WORKBOOK_SCHEMA_BY_NAME[name].columns.find((column) => column.key === key);
      expect(contract).toMatchObject({
        kind: 'number',
        required: true,
        positiveInteger: true,
        workbookOnly: true,
      });
    }
  });

  it('exposes canonical enum and unit tokens instead of display labels', () => {
    const category = WORKBOOK_SCHEMA_BY_NAME.Products.columns.find(
      (column) => column.key === 'category',
    );
    const purchaseUnit = WORKBOOK_SCHEMA_BY_NAME.Materials.columns.find(
      (column) => column.key === 'purchaseUnit',
    );
    const pricingMethod = WORKBOOK_SCHEMA_BY_NAME.ProductFinancialProfiles.columns.find(
      (column) => column.key === 'pricingMethod',
    );

    expect(category?.allowedValues).toEqual(['paintable-art', 'candle-pot', 'candle']);
    expect(purchaseUnit?.allowedValues).toContain('kg');
    expect(purchaseUnit?.allowedValues).toContain('bag');
    expect(pricingMethod?.allowedValues).toEqual([
      'profit-amount',
      'markup-percent',
      'margin-percent',
    ]);
  });

  it('defines timestamps as literal text rather than numeric serial dates', () => {
    expect(
      WORKBOOK_SCHEMA_BY_NAME.Calibrations.columns.find((column) => column.key === 'recordedAt'),
    ).toMatchObject({ kind: 'text', formulaPolicy: 'literal-only' });
    expect(
      WORKBOOK_SCHEMA_BY_NAME.YieldSamples.columns.find((column) => column.key === 'recordedAt'),
    ).toMatchObject({ kind: 'text', formulaPolicy: 'literal-only' });
    expect(
      WORKBOOK_SCHEMA_BY_NAME._Meta.columns.find((column) => column.key === 'exportedAt'),
    ).toMatchObject({ kind: 'text', formulaPolicy: 'literal-only' });
  });

  it('marks all authoritative text columns literal-only and all non-text cells formula-rejecting', () => {
    for (const candidate of WORKBOOK_SHEETS) {
      for (const column of candidate.columns) {
        expect(column.formulaPolicy).toBe(column.kind === 'text' ? 'literal-only' : 'reject');
      }
    }
  });

  it('provides deterministic row-order metadata for every data sheet', () => {
    for (const candidate of WORKBOOK_SHEETS.filter((candidate) => candidate.name !== '_Meta')) {
      expect(candidate.rowOrder?.length).toBeGreaterThan(0);
    }
  });

  it('accepts all canonical sheets when source collections are empty', () => {
    const workbook = createValidWorkbook();
    expect(validateWorkbookSchema(workbook)).toEqual([]);
    expect(isCurrentWorkbookSchema(workbook)).toBe(true);
    expect(() => assertWorkbookSchema(workbook)).not.toThrow();
  });

  it('fails closed on missing canonical sheets and columns', () => {
    const missingSheet = createValidWorkbook();
    missingSheet.sheets = missingSheet.sheets.filter((candidate) => candidate.name !== 'Products');
    expect(validateWorkbookSchema(missingSheet)).toContainEqual(
      expect.objectContaining({ code: 'MISSING_REQUIRED_SHEET', sheetName: 'Products' }),
    );

    const missingColumn = createValidWorkbook();
    sheet(missingColumn, 'Materials').columns = sheet(missingColumn, 'Materials').columns.filter(
      (column) => column !== 'packageCost',
    );
    expect(validateWorkbookSchema(missingColumn)).toContainEqual(
      expect.objectContaining({
        code: 'MISSING_REQUIRED_COLUMN',
        sheetName: 'Materials',
        column: 'packageCost',
      }),
    );
  });

  it('fails closed when canonical columns are duplicated or out of order', () => {
    const duplicate = createValidWorkbook();
    sheet(duplicate, 'ProductStocks').columns.push('productId');
    expect(validateWorkbookSchema(duplicate)).toContainEqual(
      expect.objectContaining({ code: 'DUPLICATE_COLUMN', column: 'productId' }),
    );

    const reordered = createValidWorkbook();
    sheet(reordered, 'ProductStocks').columns = ['onHandQuantity', 'productId', 'notes'];
    expect(validateWorkbookSchema(reordered)).toContainEqual(
      expect.objectContaining({ code: 'INVALID_COLUMN_ORDER', sheetName: 'ProductStocks' }),
    );
  });

  it('distinguishes missing required cells from explicit numeric zero and false', () => {
    const validZero = createValidWorkbook();
    sheet(validZero, 'ProductStocks').rows.push({
      productId: 'product-1',
      onHandQuantity: 0,
      notes: null,
    });
    expect(validateWorkbookSchema(validZero)).toEqual([]);

    const validFalse = createValidWorkbook();
    sheet(validFalse, 'Products').rows.push({
      id: 'product-1',
      name: 'Archived product',
      category: 'candle',
      mixPresetId: null,
      safetyWasteRate: 0,
      notes: null,
      isActive: false,
    });
    expect(validateWorkbookSchema(validFalse)).toEqual([]);

    const missing = createValidWorkbook();
    sheet(missing, 'ProductStocks').rows.push({
      productId: '',
      onHandQuantity: 0,
    });
    expect(validateWorkbookSchema(missing)).toContainEqual(
      expect.objectContaining({ code: 'MISSING_REQUIRED_CELL', column: 'productId' }),
    );
  });

  it('reports controlled primitive, enum, and unit-token diagnostics', () => {
    const wrongPrimitive = createValidWorkbook();
    sheet(wrongPrimitive, 'ProductStocks').rows.push({
      productId: 'product-1',
      onHandQuantity: '5',
    });
    expect(validateWorkbookSchema(wrongPrimitive)).toContainEqual(
      expect.objectContaining({ code: 'INVALID_CELL_TYPE', column: 'onHandQuantity' }),
    );

    const invalidEnum = createValidWorkbook();
    sheet(invalidEnum, 'Products').rows.push({
      id: 'product-1',
      name: 'Test',
      category: 'unknown-category',
      safetyWasteRate: 0,
      isActive: true,
    });
    expect(validateWorkbookSchema(invalidEnum)).toContainEqual(
      expect.objectContaining({ code: 'INVALID_ENUM_TOKEN', column: 'category' }),
    );

    const invalidUnit = createValidWorkbook();
    sheet(invalidUnit, 'YieldSampleInputs').rows.push({
      yieldSampleId: 'sample-1',
      inputOrder: 1,
      materialId: 'material-1',
      quantity: 1,
      unit: 'bucket',
    });
    expect(validateWorkbookSchema(invalidUnit)).toContainEqual(
      expect.objectContaining({ code: 'INVALID_UNIT_TOKEN', column: 'unit' }),
    );
  });

  it('rejects invalid workbook-only child order values', () => {
    const workbook = createValidWorkbook();
    sheet(workbook, 'MixPresetLines').rows.push({
      mixPresetId: 'preset-1',
      lineOrder: 0,
      materialId: 'material-1',
      role: 'primary',
      parts: 1,
    });

    expect(validateWorkbookSchema(workbook)).toContainEqual(
      expect.objectContaining({ code: 'INVALID_CHILD_ORDER', column: 'lineOrder' }),
    );
  });

  it('allows formula-looking text as literal source data but rejects formula-typed cells', () => {
    const literalText = createValidWorkbook();
    sheet(literalText, 'Products').rows.push({
      id: 'product-1',
      name: '=SUM(A1:A2)',
      category: 'candle',
      safetyWasteRate: 0,
      isActive: true,
    });
    expect(validateWorkbookSchema(literalText)).toEqual([]);

    const formulaCell = createValidWorkbook();
    sheet(formulaCell, '_Meta').rows[0].exportedAt = {
      formula: '=NOW()',
      cachedValue: '2026-09-16T00:00:00.000Z',
    };
    expect(validateWorkbookSchema(formulaCell)).toContainEqual(
      expect.objectContaining({ code: 'FORMULA_CELL_NOT_ALLOWED', column: 'exportedAt' }),
    );
  });

  it('validates workbook and dataset version metadata without guessing future layouts', () => {
    const wrongFormat = createValidWorkbook();
    sheet(wrongFormat, '_Meta').rows[0].formatId = 'another-app';
    expect(validateWorkbookSchema(wrongFormat)).toContainEqual(
      expect.objectContaining({ code: 'INVALID_FORMAT_ID' }),
    );

    const futureWorkbook = createValidWorkbook();
    sheet(futureWorkbook, '_Meta').rows[0].workbookFormatVersion = 3;
    expect(validateWorkbookSchema(futureWorkbook)).toContainEqual(
      expect.objectContaining({ code: 'INVALID_WORKBOOK_FORMAT_VERSION' }),
    );

    const futureDataset = createValidWorkbook();
    sheet(futureDataset, '_Meta').rows[0].datasetSchemaVersion = 2;
    expect(validateWorkbookSchema(futureDataset)).toContainEqual(
      expect.objectContaining({ code: 'UNSUPPORTED_DATASET_SCHEMA_VERSION' }),
    );
  });

  it('permits unknown extra worksheets and columns as non-authoritative content', () => {
    const workbook = createValidWorkbook();
    sheet(workbook, 'Materials').columns.push('operatorComment');
    workbook.sheets.push({
      name: 'My Notes',
      columns: ['note'],
      rows: [{ note: 'Not application state.' }],
    });

    expect(validateWorkbookSchema(workbook)).toEqual([]);
  });

  it('rejects duplicate canonical sheets and malformed neutral workbook shapes', () => {
    const duplicateSheet = createValidWorkbook();
    duplicateSheet.sheets.push({
      name: 'Products',
      columns: [...EXPECTED_COLUMNS.Products],
      rows: [],
    });
    expect(validateWorkbookSchema(duplicateSheet)).toContainEqual(
      expect.objectContaining({ code: 'DUPLICATE_SHEET', sheetName: 'Products' }),
    );

    expect(validateWorkbookSchema({ sheets: [{ name: 'Bad', columns: 'not-an-array' }] })).toContainEqual(
      expect.objectContaining({ code: 'INVALID_WORKBOOK_SCHEMA' }),
    );
  });
});
