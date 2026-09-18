import {
  BUSINESS_DATASET_SOURCE_COLLECTION_KEYS,
  CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
  type BusinessDatasetSourceCollectionKey,
} from '../domain/businessDataset';
import { FIXED_RECIPE_ITEM_ROLES } from '../domain/fixedRecipeItems';
import { MATERIAL_GROUPS, MATERIAL_PACKAGE_UNITS } from '../domain/materials';
import { MIX_PRESET_LINE_ROLES, MIX_RATIO_BASES } from '../domain/mixPresets';
import { PRICING_METHODS } from '../domain/pricing';
import {
  PRODUCT_COMPONENT_ROLES,
  PRODUCT_COMPONENT_SOURCE_TYPES,
} from '../domain/productComponents';
import { PRODUCT_CATEGORIES } from '../domain/products';
import { SUPPORTED_UNITS, UNIT_CATALOG } from '../domain/units';

export const CRAFT_BUSINESS_WORKBOOK_FORMAT_ID = 'craft-business-manager' as const;
export const CURRENT_WORKBOOK_FORMAT_VERSION = 1 as const;

export const CANONICAL_WORKBOOK_SHEET_NAMES = [
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
] as const;

export type WorkbookSheetName = (typeof CANONICAL_WORKBOOK_SHEET_NAMES)[number];
export type WorkbookCellKind = 'text' | 'number' | 'boolean';
export type WorkbookFormulaPolicy = 'literal-only' | 'reject';
export type WorkbookTokenKind = 'enum' | 'unit';
export type WorkbookRowOrderMode = 'text-ci-exact' | 'text' | 'number' | 'timestamp';

export interface WorkbookColumnContract {
  key: string;
  kind: WorkbookCellKind;
  required: boolean;
  sourcePath: string | null;
  allowedValues?: readonly string[];
  tokenKind?: WorkbookTokenKind;
  formulaPolicy: WorkbookFormulaPolicy;
  positiveInteger?: boolean;
  workbookOnly?: boolean;
}

export interface WorkbookRowOrderKey {
  key: string;
  mode: WorkbookRowOrderMode;
}

export interface WorkbookSheetContract {
  name: WorkbookSheetName;
  required: true;
  sourceCollection?: BusinessDatasetSourceCollectionKey;
  columns: readonly WorkbookColumnContract[];
  rowOrder?: readonly WorkbookRowOrderKey[];
}

export interface WorkbookRelationshipContract {
  parentSheet: WorkbookSheetName;
  parentKey: string;
  childSheet: WorkbookSheetName;
  childForeignKey: string;
  orderColumn: string;
  sourceArrayPath: string;
}

const BASE_UNIT_VALUES = ['g', 'mL', 'pc'] as const;
const MATERIAL_PURCHASE_UNIT_VALUES = [...SUPPORTED_UNITS, ...MATERIAL_PACKAGE_UNITS] as const;
const WEIGHT_UNIT_VALUES = SUPPORTED_UNITS.filter(
  (unit) => UNIT_CATALOG[unit].dimension === 'weight',
);
const VOLUME_UNIT_VALUES = SUPPORTED_UNITS.filter(
  (unit) => UNIT_CATALOG[unit].dimension === 'volume',
);

function column(
  key: string,
  kind: WorkbookCellKind,
  required: boolean,
  sourcePath: string | null,
  options: Omit<
    WorkbookColumnContract,
    'key' | 'kind' | 'required' | 'sourcePath' | 'formulaPolicy'
  > = {},
): WorkbookColumnContract {
  return {
    key,
    kind,
    required,
    sourcePath,
    formulaPolicy: kind === 'text' ? 'literal-only' : 'reject',
    ...options,
  };
}

export const WORKBOOK_SHEETS: readonly WorkbookSheetContract[] = [
  {
    name: '_Meta',
    required: true,
    columns: [
      column('formatId', 'text', true, null),
      column('workbookFormatVersion', 'number', true, null, { positiveInteger: true }),
      column('datasetSchemaVersion', 'number', true, 'schemaVersion', { positiveInteger: true }),
      column('exportedAt', 'text', true, null),
      column('applicationVersion', 'text', false, null),
    ],
  },
  {
    name: 'Materials',
    required: true,
    sourceCollection: 'materials',
    columns: [
      column('id', 'text', true, 'id'),
      column('name', 'text', true, 'name'),
      column('group', 'text', true, 'group', { allowedValues: MATERIAL_GROUPS, tokenKind: 'enum' }),
      column('baseUnit', 'text', true, 'baseUnit', { allowedValues: BASE_UNIT_VALUES, tokenKind: 'unit' }),
      column('purchaseQuantity', 'number', true, 'purchaseQuantity'),
      column('purchaseUnit', 'text', true, 'purchaseUnit', {
        allowedValues: MATERIAL_PURCHASE_UNIT_VALUES,
        tokenKind: 'unit',
      }),
      column('packageCost', 'number', true, 'packageCost'),
      column('manualBaseUnitsPerPurchaseUnit', 'number', false, 'manualBaseUnitsPerPurchaseUnit'),
      column('onHandQuantity', 'number', true, 'onHandQuantity'),
      column('onHandUnit', 'text', true, 'onHandUnit', {
        allowedValues: MATERIAL_PURCHASE_UNIT_VALUES,
        tokenKind: 'unit',
      }),
      column('sourceVendorName', 'text', false, 'source.vendorName'),
      column('sourceDetail', 'text', false, 'source.source'),
      column('sourcePurchaseLink', 'text', false, 'source.purchaseLink'),
      column('sourceContactNumber', 'text', false, 'source.contactNumber'),
      column('sourceSocialPage', 'text', false, 'source.socialPage'),
      column('sourceNotes', 'text', false, 'source.notes'),
      column('notes', 'text', false, 'notes'),
      column('isActive', 'boolean', true, 'isActive'),
    ],
    rowOrder: [{ key: 'id', mode: 'text-ci-exact' }],
  },
  {
    name: 'Calibrations',
    required: true,
    sourceCollection: 'materialCalibrations',
    columns: [
      column('id', 'text', true, 'id'),
      column('materialId', 'text', true, 'materialId'),
      column('measuredVolume', 'number', true, 'measuredVolume'),
      column('volumeUnit', 'text', true, 'volumeUnit', { allowedValues: VOLUME_UNIT_VALUES, tokenKind: 'unit' }),
      column('knownWeight', 'number', true, 'knownWeight'),
      column('weightUnit', 'text', true, 'weightUnit', { allowedValues: WEIGHT_UNIT_VALUES, tokenKind: 'unit' }),
      column('recordedAt', 'text', true, 'recordedAt'),
      column('notes', 'text', false, 'notes'),
    ],
    rowOrder: [
      { key: 'materialId', mode: 'text-ci-exact' },
      { key: 'recordedAt', mode: 'timestamp' },
      { key: 'id', mode: 'text-ci-exact' },
    ],
  },
  {
    name: 'MixPresets',
    required: true,
    sourceCollection: 'mixPresets',
    columns: [
      column('id', 'text', true, 'id'),
      column('name', 'text', true, 'name'),
      column('basis', 'text', true, 'basis', { allowedValues: MIX_RATIO_BASES, tokenKind: 'enum' }),
      column('notes', 'text', false, 'notes'),
      column('isActive', 'boolean', true, 'isActive'),
    ],
    rowOrder: [{ key: 'id', mode: 'text-ci-exact' }],
  },
  {
    name: 'MixPresetCategories',
    required: true,
    columns: [
      column('mixPresetId', 'text', true, 'parent.id'),
      column('categoryOrder', 'number', true, null, { positiveInteger: true, workbookOnly: true }),
      column('category', 'text', true, 'compatibleCategories[]', {
        allowedValues: PRODUCT_CATEGORIES,
        tokenKind: 'enum',
      }),
    ],
    rowOrder: [
      { key: 'mixPresetId', mode: 'text-ci-exact' },
      { key: 'categoryOrder', mode: 'number' },
    ],
  },
  {
    name: 'MixPresetLines',
    required: true,
    columns: [
      column('mixPresetId', 'text', true, 'parent.id'),
      column('lineOrder', 'number', true, null, { positiveInteger: true, workbookOnly: true }),
      column('materialId', 'text', true, 'lines[].materialId'),
      column('role', 'text', true, 'lines[].role', {
        allowedValues: MIX_PRESET_LINE_ROLES,
        tokenKind: 'enum',
      }),
      column('parts', 'number', true, 'lines[].parts'),
    ],
    rowOrder: [
      { key: 'mixPresetId', mode: 'text-ci-exact' },
      { key: 'lineOrder', mode: 'number' },
    ],
  },
  {
    name: 'Products',
    required: true,
    sourceCollection: 'products',
    columns: [
      column('id', 'text', true, 'id'),
      column('name', 'text', true, 'name'),
      column('category', 'text', true, 'category', { allowedValues: PRODUCT_CATEGORIES, tokenKind: 'enum' }),
      column('mixPresetId', 'text', false, 'mixPresetId'),
      column('preferredYieldSampleId', 'text', false, 'preferredYieldSampleId'),
      column('safetyWasteRate', 'number', true, 'safetyWasteRate'),
      column('notes', 'text', false, 'notes'),
      column('isActive', 'boolean', true, 'isActive'),
    ],
    rowOrder: [{ key: 'id', mode: 'text-ci-exact' }],
  },
  {
    name: 'YieldSamples',
    required: true,
    sourceCollection: 'yieldSamples',
    columns: [
      column('id', 'text', true, 'id'),
      column('productId', 'text', true, 'productId'),
      column('mixPresetId', 'text', false, 'mixPresetId'),
      column('goodPieces', 'number', true, 'goodPieces'),
      column('rejectedPieces', 'number', true, 'rejectedPieces'),
      column('recordedAt', 'text', true, 'recordedAt'),
      column('notes', 'text', false, 'notes'),
    ],
    rowOrder: [
      { key: 'productId', mode: 'text-ci-exact' },
      { key: 'recordedAt', mode: 'timestamp' },
      { key: 'id', mode: 'text-ci-exact' },
    ],
  },
  {
    name: 'YieldSampleInputs',
    required: true,
    columns: [
      column('yieldSampleId', 'text', true, 'parent.id'),
      column('inputOrder', 'number', true, null, { positiveInteger: true, workbookOnly: true }),
      column('materialId', 'text', true, 'materialInputs[].materialId'),
      column('quantity', 'number', true, 'materialInputs[].quantity'),
      column('unit', 'text', true, 'materialInputs[].unit', { allowedValues: SUPPORTED_UNITS, tokenKind: 'unit' }),
    ],
    rowOrder: [
      { key: 'yieldSampleId', mode: 'text-ci-exact' },
      { key: 'inputOrder', mode: 'number' },
    ],
  },
  {
    name: 'RecipeItems',
    required: true,
    sourceCollection: 'recipeItems',
    columns: [
      column('id', 'text', true, 'id'),
      column('productId', 'text', true, 'productId'),
      column('materialId', 'text', true, 'materialId'),
      column('quantityPerProduct', 'number', true, 'quantityPerProduct'),
      column('unit', 'text', true, 'unit', { allowedValues: SUPPORTED_UNITS, tokenKind: 'unit' }),
      column('role', 'text', true, 'role', { allowedValues: FIXED_RECIPE_ITEM_ROLES, tokenKind: 'enum' }),
      column('notes', 'text', false, 'notes'),
    ],
    rowOrder: [
      { key: 'productId', mode: 'text-ci-exact' },
      { key: 'id', mode: 'text-ci-exact' },
    ],
  },
  {
    name: 'ProductComponents',
    required: true,
    sourceCollection: 'productComponents',
    columns: [
      column('id', 'text', true, 'id'),
      column('parentProductId', 'text', true, 'parentProductId'),
      column('sourceType', 'text', true, 'sourceType', {
        allowedValues: PRODUCT_COMPONENT_SOURCE_TYPES,
        tokenKind: 'enum',
      }),
      column('sourceId', 'text', true, 'sourceId'),
      column('role', 'text', true, 'role', { allowedValues: PRODUCT_COMPONENT_ROLES, tokenKind: 'enum' }),
      column('quantityPerParent', 'number', true, 'quantityPerParent'),
      column('notes', 'text', false, 'notes'),
    ],
    rowOrder: [
      { key: 'parentProductId', mode: 'text-ci-exact' },
      { key: 'id', mode: 'text-ci-exact' },
    ],
  },
  {
    name: 'ProductStocks',
    required: true,
    sourceCollection: 'productStocks',
    columns: [
      column('productId', 'text', true, 'productId'),
      column('onHandQuantity', 'number', true, 'onHandQuantity'),
      column('notes', 'text', false, 'notes'),
    ],
    rowOrder: [{ key: 'productId', mode: 'text-ci-exact' }],
  },
  {
    name: 'ProductFinancialProfiles',
    required: true,
    sourceCollection: 'productFinancialProfiles',
    columns: [
      column('productId', 'text', true, 'productId'),
      column('laborCostPerUnit', 'number', true, 'laborCostPerUnit'),
      column('overheadCostPerUnit', 'number', true, 'overheadCostPerUnit'),
      column('pricingMethod', 'text', false, 'pricingPolicy.method', {
        allowedValues: PRICING_METHODS,
        tokenKind: 'enum',
      }),
      column('pricingValue', 'number', false, 'pricingPolicy.value'),
      column('notes', 'text', false, 'notes'),
    ],
    rowOrder: [{ key: 'productId', mode: 'text-ci-exact' }],
  },
];

const schemaByName = {} as Record<WorkbookSheetName, WorkbookSheetContract>;
for (const sheet of WORKBOOK_SHEETS) {
  schemaByName[sheet.name] = sheet;
}
export const WORKBOOK_SCHEMA_BY_NAME: Readonly<
  Record<WorkbookSheetName, WorkbookSheetContract>
> = schemaByName;

export const WORKBOOK_PRIMARY_SHEET_BY_SOURCE_COLLECTION = {
  materials: 'Materials',
  materialCalibrations: 'Calibrations',
  mixPresets: 'MixPresets',
  products: 'Products',
  yieldSamples: 'YieldSamples',
  recipeItems: 'RecipeItems',
  productComponents: 'ProductComponents',
  productStocks: 'ProductStocks',
  productFinancialProfiles: 'ProductFinancialProfiles',
} as const satisfies Record<BusinessDatasetSourceCollectionKey, WorkbookSheetName>;

export const WORKBOOK_RELATIONSHIPS: readonly WorkbookRelationshipContract[] = [
  {
    parentSheet: 'MixPresets',
    parentKey: 'id',
    childSheet: 'MixPresetCategories',
    childForeignKey: 'mixPresetId',
    orderColumn: 'categoryOrder',
    sourceArrayPath: 'compatibleCategories',
  },
  {
    parentSheet: 'MixPresets',
    parentKey: 'id',
    childSheet: 'MixPresetLines',
    childForeignKey: 'mixPresetId',
    orderColumn: 'lineOrder',
    sourceArrayPath: 'lines',
  },
  {
    parentSheet: 'YieldSamples',
    parentKey: 'id',
    childSheet: 'YieldSampleInputs',
    childForeignKey: 'yieldSampleId',
    orderColumn: 'inputOrder',
    sourceArrayPath: 'materialInputs',
  },
];

export function getPrimaryWorkbookSheetForSourceCollection(
  collection: BusinessDatasetSourceCollectionKey,
): WorkbookSheetName {
  return WORKBOOK_PRIMARY_SHEET_BY_SOURCE_COLLECTION[collection];
}

export type WorkbookSchemaIssueCode =
  | 'INVALID_WORKBOOK_SCHEMA'
  | 'DUPLICATE_SHEET'
  | 'MISSING_META_SHEET'
  | 'INVALID_META_ROW_COUNT'
  | 'INVALID_FORMAT_ID'
  | 'INVALID_WORKBOOK_FORMAT_VERSION'
  | 'INVALID_DATASET_SCHEMA_VERSION_SHAPE'
  | 'UNSUPPORTED_DATASET_SCHEMA_VERSION'
  | 'MISSING_REQUIRED_SHEET'
  | 'MISSING_REQUIRED_COLUMN'
  | 'DUPLICATE_COLUMN'
  | 'INVALID_COLUMN_ORDER'
  | 'MISSING_REQUIRED_CELL'
  | 'INVALID_CELL_TYPE'
  | 'INVALID_ENUM_TOKEN'
  | 'INVALID_UNIT_TOKEN'
  | 'INVALID_CHILD_ORDER'
  | 'INVALID_PAIRED_FIELDS'
  | 'FORMULA_CELL_NOT_ALLOWED';

export interface WorkbookSchemaIssue {
  code: WorkbookSchemaIssueCode;
  message: string;
  sheetName?: string;
  column?: string;
  rowIndex?: number;
  input?: unknown;
}

export interface WorkbookFormulaCell {
  formula: string;
  cachedValue?: unknown;
}

export interface WorkbookNeutralSheet {
  name: string;
  columns: readonly string[];
  rows: readonly Readonly<Record<string, unknown>>[];
}

export interface WorkbookNeutralDocument {
  sheets: readonly WorkbookNeutralSheet[];
}

export class WorkbookSchemaError extends Error {
  readonly issues: readonly WorkbookSchemaIssue[];

  constructor(issues: readonly WorkbookSchemaIssue[]) {
    super(`Workbook schema validation failed with ${issues.length} issue(s).`);
    this.name = 'WorkbookSchemaError';
    this.issues = issues;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFormulaCell(value: unknown): value is WorkbookFormulaCell {
  return isRecord(value) && typeof value.formula === 'string';
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

function addIssue(
  issues: WorkbookSchemaIssue[],
  code: WorkbookSchemaIssueCode,
  message: string,
  context: Omit<WorkbookSchemaIssue, 'code' | 'message'> = {},
): void {
  issues.push({ code, message, ...context });
}

function parseNeutralSheets(
  input: unknown,
  issues: WorkbookSchemaIssue[],
): WorkbookNeutralSheet[] | null {
  if (!isRecord(input) || !Array.isArray(input.sheets)) {
    addIssue(issues, 'INVALID_WORKBOOK_SCHEMA', 'Workbook schema input must be an object with a sheets array.', { input });
    return null;
  }

  const sheets: WorkbookNeutralSheet[] = [];
  for (const rawSheet of input.sheets) {
    if (
      !isRecord(rawSheet) ||
      typeof rawSheet.name !== 'string' ||
      !Array.isArray(rawSheet.columns) ||
      !rawSheet.columns.every((name) => typeof name === 'string') ||
      !Array.isArray(rawSheet.rows) ||
      !rawSheet.rows.every(isRecord)
    ) {
      addIssue(
        issues,
        'INVALID_WORKBOOK_SCHEMA',
        'Each workbook sheet must provide a string name, string column list, and object rows.',
        { input: rawSheet },
      );
      continue;
    }

    sheets.push({
      name: rawSheet.name,
      columns: [...rawSheet.columns] as string[],
      rows: [...rawSheet.rows] as Record<string, unknown>[],
    });
  }
  return sheets;
}

function validateCell(
  sheet: WorkbookNeutralSheet,
  row: Readonly<Record<string, unknown>>,
  rowIndex: number,
  contract: WorkbookColumnContract,
  issues: WorkbookSchemaIssue[],
): void {
  const value = row[contract.key];
  if (isBlank(value)) {
    if (contract.required) {
      addIssue(issues, 'MISSING_REQUIRED_CELL', `Required cell ${sheet.name}.${contract.key} is blank.`, {
        sheetName: sheet.name,
        column: contract.key,
        rowIndex,
        input: value,
      });
    }
    return;
  }

  if (isFormulaCell(value)) {
    addIssue(issues, 'FORMULA_CELL_NOT_ALLOWED', `Formula cells are not allowed in authoritative column ${sheet.name}.${contract.key}.`, {
      sheetName: sheet.name,
      column: contract.key,
      rowIndex,
      input: value,
    });
    return;
  }

  const validPrimitive =
    (contract.kind === 'text' && typeof value === 'string') ||
    (contract.kind === 'boolean' && typeof value === 'boolean') ||
    (contract.kind === 'number' && typeof value === 'number' && Number.isFinite(value));

  if (!validPrimitive) {
    addIssue(issues, 'INVALID_CELL_TYPE', `Cell ${sheet.name}.${contract.key} must be ${contract.kind}.`, {
      sheetName: sheet.name,
      column: contract.key,
      rowIndex,
      input: value,
    });
    return;
  }

  if (
    contract.kind === 'number' &&
    contract.positiveInteger &&
    (typeof value !== 'number' || !Number.isInteger(value) || value < 1)
  ) {
    addIssue(
      issues,
      contract.workbookOnly ? 'INVALID_CHILD_ORDER' : 'INVALID_CELL_TYPE',
      `Cell ${sheet.name}.${contract.key} must be a positive integer.`,
      { sheetName: sheet.name, column: contract.key, rowIndex, input: value },
    );
    return;
  }

  if (
    contract.kind === 'text' &&
    contract.allowedValues &&
    typeof value === 'string' &&
    !contract.allowedValues.includes(value)
  ) {
    addIssue(
      issues,
      contract.tokenKind === 'unit' ? 'INVALID_UNIT_TOKEN' : 'INVALID_ENUM_TOKEN',
      `Unsupported token ${value} for ${sheet.name}.${contract.key}.`,
      { sheetName: sheet.name, column: contract.key, rowIndex, input: value },
    );
  }
}

function validateMeta(sheet: WorkbookNeutralSheet, issues: WorkbookSchemaIssue[]): void {
  if (sheet.rows.length !== 1) {
    addIssue(issues, 'INVALID_META_ROW_COUNT', '_Meta must contain exactly one authoritative metadata row.', {
      sheetName: sheet.name,
      input: sheet.rows.length,
    });
    return;
  }

  const row = sheet.rows[0];
  const formatId = row.formatId;
  const workbookFormatVersion = row.workbookFormatVersion;
  const datasetSchemaVersion = row.datasetSchemaVersion;

  if (typeof formatId === 'string' && formatId !== CRAFT_BUSINESS_WORKBOOK_FORMAT_ID) {
    addIssue(issues, 'INVALID_FORMAT_ID', `Workbook formatId must be ${CRAFT_BUSINESS_WORKBOOK_FORMAT_ID}.`, {
      sheetName: sheet.name,
      column: 'formatId',
      rowIndex: 0,
      input: formatId,
    });
  }

  if (
    typeof workbookFormatVersion === 'number' &&
    Number.isInteger(workbookFormatVersion) &&
    workbookFormatVersion >= 1 &&
    workbookFormatVersion !== CURRENT_WORKBOOK_FORMAT_VERSION
  ) {
    addIssue(
      issues,
      'INVALID_WORKBOOK_FORMAT_VERSION',
      `Unsupported workbook format version ${workbookFormatVersion}. Expected ${CURRENT_WORKBOOK_FORMAT_VERSION}.`,
      { sheetName: sheet.name, column: 'workbookFormatVersion', rowIndex: 0, input: workbookFormatVersion },
    );
  }

  if (
    !isBlank(datasetSchemaVersion) &&
    (typeof datasetSchemaVersion !== 'number' || !Number.isInteger(datasetSchemaVersion) || datasetSchemaVersion < 1)
  ) {
    addIssue(issues, 'INVALID_DATASET_SCHEMA_VERSION_SHAPE', 'Dataset schema version must be a positive integer.', {
      sheetName: sheet.name,
      column: 'datasetSchemaVersion',
      rowIndex: 0,
      input: datasetSchemaVersion,
    });
  } else if (
    typeof datasetSchemaVersion === 'number' &&
    datasetSchemaVersion !== CURRENT_BUSINESS_DATASET_SCHEMA_VERSION
  ) {
    addIssue(
      issues,
      'UNSUPPORTED_DATASET_SCHEMA_VERSION',
      `Unsupported dataset schema version ${datasetSchemaVersion}. Expected ${CURRENT_BUSINESS_DATASET_SCHEMA_VERSION}.`,
      { sheetName: sheet.name, column: 'datasetSchemaVersion', rowIndex: 0, input: datasetSchemaVersion },
    );
  }
}

/**
 * Validates workbook shape only. Identity/reference/cycle semantics remain Phase 5.1C.
 */
export function validateWorkbookSchema(input: unknown): WorkbookSchemaIssue[] {
  const issues: WorkbookSchemaIssue[] = [];
  const sheets = parseNeutralSheets(input, issues);
  if (!sheets) return issues;

  const sheetCounts = new Map<string, number>();
  for (const sheet of sheets) {
    sheetCounts.set(sheet.name, (sheetCounts.get(sheet.name) ?? 0) + 1);
  }
  for (const [sheetName, count] of sheetCounts) {
    if (count > 1) {
      addIssue(issues, 'DUPLICATE_SHEET', `Workbook contains duplicate sheet ${sheetName}.`, {
        sheetName,
        input: count,
      });
    }
  }

  for (const contract of WORKBOOK_SHEETS) {
    const matchingSheets = sheets.filter((candidate) => candidate.name === contract.name);
    if (matchingSheets.length === 0) {
      addIssue(
        issues,
        contract.name === '_Meta' ? 'MISSING_META_SHEET' : 'MISSING_REQUIRED_SHEET',
        `Workbook is missing required sheet ${contract.name}.`,
        { sheetName: contract.name },
      );
      continue;
    }

    const sheet = matchingSheets[0];
    const seenColumns = new Set<string>();
    for (const columnName of sheet.columns) {
      if (seenColumns.has(columnName)) {
        addIssue(issues, 'DUPLICATE_COLUMN', `Sheet ${sheet.name} contains duplicate column ${columnName}.`, {
          sheetName: sheet.name,
          column: columnName,
        });
      }
      seenColumns.add(columnName);
    }

    for (const expected of contract.columns) {
      if (!sheet.columns.includes(expected.key)) {
        addIssue(issues, 'MISSING_REQUIRED_COLUMN', `Sheet ${sheet.name} is missing canonical column ${expected.key}.`, {
          sheetName: sheet.name,
          column: expected.key,
        });
      }
    }

    const indexes = contract.columns.map((expected) => sheet.columns.indexOf(expected.key));
    if (
      indexes.every((index) => index >= 0) &&
      indexes.some((index, position) => position > 0 && index <= indexes[position - 1])
    ) {
      addIssue(issues, 'INVALID_COLUMN_ORDER', `Canonical columns in ${sheet.name} are not in the required relative order.`, {
        sheetName: sheet.name,
        input: sheet.columns,
      });
    }

    for (let rowIndex = 0; rowIndex < sheet.rows.length; rowIndex += 1) {
      const row = sheet.rows[rowIndex];
      for (const columnContract of contract.columns) {
        validateCell(sheet, row, rowIndex, columnContract, issues);
      }

      if (sheet.name === 'ProductFinancialProfiles') {
        const methodBlank = isBlank(row.pricingMethod);
        const valueBlank = isBlank(row.pricingValue);
        if (methodBlank !== valueBlank) {
          addIssue(issues, 'INVALID_PAIRED_FIELDS', 'pricingMethod and pricingValue must both be blank or both be populated.', {
            sheetName: sheet.name,
            rowIndex,
          });
        }
      }
    }

    if (sheet.name === '_Meta') validateMeta(sheet, issues);
  }

  return issues;
}

export function assertWorkbookSchema(input: unknown): asserts input is WorkbookNeutralDocument {
  const issues = validateWorkbookSchema(input);
  if (issues.length > 0) throw new WorkbookSchemaError(issues);
}

export function isCurrentWorkbookSchema(input: unknown): input is WorkbookNeutralDocument {
  return validateWorkbookSchema(input).length === 0;
}

export function getMappedSourceCollections(): readonly BusinessDatasetSourceCollectionKey[] {
  return BUSINESS_DATASET_SOURCE_COLLECTION_KEYS.filter(
    (collection) => WORKBOOK_PRIMARY_SHEET_BY_SOURCE_COLLECTION[collection] !== undefined,
  );
}
