import {
  BUSINESS_DATASET_V2_SCHEMA_VERSION,
  type BusinessDatasetV2,
} from '../domain/businessDatasetV2';
import {
  validateBusinessDatasetV2Integrity,
  type BusinessDatasetV2ValidationIssue,
} from '../domain/businessDatasetV2Validation';
import {
  PRODUCT_PRICE_TIER_KINDS,
  PRODUCT_PRICE_TIER_PRICE_BASES,
  type ProductPriceTier,
} from '../domain/productPriceTiers';
import type { BusinessDataset } from '../domain/types';
import {
  createBusinessDatasetWorkbookDocument,
  type WorkbookExportMetadata,
} from './businessDatasetWorkbookExport';
import {
  reconstructBusinessDatasetFromWorkbook,
  type BusinessDatasetWorkbookImportIssue,
  type ImportedWorkbookMetadata,
} from './businessDatasetWorkbookImport';
import {
  WorkbookCodecError,
  type WorkbookBinaryInput,
  type WorkbookCodec,
} from './workbookCodec';
import {
  createWorkbookResourceLimits,
  validateNeutralWorkbookResourceLimits,
  validateWorkbookBinaryResourceLimit,
  type WorkbookResourceLimitIssue,
  type WorkbookResourceLimits,
} from './workbookResourceLimits';
import {
  CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
  CURRENT_WORKBOOK_FORMAT_VERSION,
  validateWorkbookSchema,
  type WorkbookFormulaCell,
  type WorkbookNeutralDocument,
  type WorkbookNeutralSheet,
} from './workbookSchema';

export const CORE_WORKBOOK_V3_FORMAT_VERSION = 3 as const;
export const PRODUCT_PRICE_TIERS_SHEET_NAME = 'ProductPriceTiers' as const;

export const PRODUCT_PRICE_TIERS_WORKBOOK_COLUMNS = [
  'id',
  'productId',
  'name',
  'kind',
  'priceBasis',
  'priceAmount',
  'unitsPerOffer',
  'minimumOrderQuantity',
  'additionalCostPerOffer',
  'notes',
  'isActive',
] as const;

export const CORE_WORKBOOK_V3_CANONICAL_SHEET_NAMES = [
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
  PRODUCT_PRICE_TIERS_SHEET_NAME,
] as const;

export type BusinessDatasetV2WorkbookImportResult =
  | {
      ok: true;
      dataset: BusinessDatasetV2;
      metadata: ImportedWorkbookMetadata;
    }
  | {
      ok: false;
      issues: readonly BusinessDatasetWorkbookImportIssue[];
    };

export type BusinessDatasetV2WorkbookExportErrorCode =
  | 'INVALID_DATASET'
  | 'INVALID_EXPORT_METADATA'
  | 'INVALID_GENERATED_WORKBOOK';

export class BusinessDatasetV2WorkbookExportError extends Error {
  readonly code: BusinessDatasetV2WorkbookExportErrorCode;
  readonly datasetIssues?: readonly BusinessDatasetV2ValidationIssue[];
  readonly workbookIssues?: readonly BusinessDatasetWorkbookImportIssue[];
  readonly causeValue?: unknown;

  constructor(
    code: BusinessDatasetV2WorkbookExportErrorCode,
    message: string,
    context: {
      datasetIssues?: readonly BusinessDatasetV2ValidationIssue[];
      workbookIssues?: readonly BusinessDatasetWorkbookImportIssue[];
      causeValue?: unknown;
    } = {},
  ) {
    super(message);
    this.name = 'BusinessDatasetV2WorkbookExportError';
    this.code = code;
    this.datasetIssues = context.datasetIssues;
    this.workbookIssues = context.workbookIssues;
    this.causeValue = context.causeValue;
  }
}

function baseDatasetV1(dataset: BusinessDatasetV2): BusinessDataset {
  return {
    schemaVersion: 1,
    materials: dataset.materials,
    materialCalibrations: dataset.materialCalibrations,
    mixPresets: dataset.mixPresets,
    products: dataset.products,
    yieldSamples: dataset.yieldSamples,
    recipeItems: dataset.recipeItems,
    productComponents: dataset.productComponents,
    productStocks: dataset.productStocks,
    productFinancialProfiles: dataset.productFinancialProfiles,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFormulaCell(value: unknown): value is WorkbookFormulaCell {
  return (
    isRecord(value) &&
    typeof value.formula === 'string'
  );
}

function isBlank(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '')
  );
}

function canonical(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function tierRows(
  dataset: BusinessDatasetV2,
): Readonly<Record<string, unknown>>[] {
  return [...dataset.productPriceTiers]
    .sort(
      (left, right) =>
        canonical(left.id).localeCompare(canonical(right.id)) ||
        left.id.localeCompare(right.id),
    )
    .map((tier) => ({
      id: tier.id,
      productId: tier.productId,
      name: tier.name,
      kind: tier.kind,
      priceBasis: tier.priceBasis,
      priceAmount: tier.priceAmount,
      unitsPerOffer: tier.unitsPerOffer,
      minimumOrderQuantity: tier.minimumOrderQuantity,
      additionalCostPerOffer: tier.additionalCostPerOffer,
      notes: tier.notes,
      isActive: tier.isActive,
    }));
}

function tierSheet(dataset: BusinessDatasetV2): WorkbookNeutralSheet {
  return {
    name: PRODUCT_PRICE_TIERS_SHEET_NAME,
    columns: [...PRODUCT_PRICE_TIERS_WORKBOOK_COLUMNS],
    rows: tierRows(dataset),
  };
}

function validateExportMetadata(metadata: WorkbookExportMetadata): void {
  if (
    !metadata ||
    typeof metadata.exportedAt !== 'string' ||
    !metadata.exportedAt.trim() ||
    Number.isNaN(Date.parse(metadata.exportedAt))
  ) {
    throw new BusinessDatasetV2WorkbookExportError(
      'INVALID_EXPORT_METADATA',
      'exportedAt must be explicit, nonblank ISO-compatible text.',
      { causeValue: metadata?.exportedAt },
    );
  }

  if (
    metadata.applicationVersion !== undefined &&
    (typeof metadata.applicationVersion !== 'string' ||
      !metadata.applicationVersion.trim())
  ) {
    throw new BusinessDatasetV2WorkbookExportError(
      'INVALID_EXPORT_METADATA',
      'applicationVersion must be nonblank text when supplied.',
      { causeValue: metadata.applicationVersion },
    );
  }
}

function v3Meta(
  metadata: WorkbookExportMetadata,
): WorkbookNeutralSheet {
  return {
    name: '_Meta',
    columns: [
      'formatId',
      'workbookFormatVersion',
      'datasetSchemaVersion',
      'exportedAt',
      'applicationVersion',
    ],
    rows: [
      {
        formatId: CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
        workbookFormatVersion: CORE_WORKBOOK_V3_FORMAT_VERSION,
        datasetSchemaVersion: BUSINESS_DATASET_V2_SCHEMA_VERSION,
        exportedAt: metadata.exportedAt,
        applicationVersion: metadata.applicationVersion,
      },
    ],
  };
}

function projectV3ToLegacyV2(
  document: WorkbookNeutralDocument,
): WorkbookNeutralDocument {
  return {
    sheets: document.sheets
      .filter((sheet) => sheet.name !== PRODUCT_PRICE_TIERS_SHEET_NAME)
      .map((sheet) =>
        sheet.name === '_Meta'
          ? {
              ...sheet,
              rows: sheet.rows.map((row, index) =>
                index === 0
                  ? {
                      ...row,
                      workbookFormatVersion: CURRENT_WORKBOOK_FORMAT_VERSION,
                      datasetSchemaVersion: 1,
                    }
                  : row,
              ),
            }
          : sheet,
      ),
  };
}

function schemaIssue(
  code: string,
  message: string,
  context: Partial<BusinessDatasetWorkbookImportIssue> = {},
): BusinessDatasetWorkbookImportIssue {
  return {
    stage: 'schema',
    code,
    message,
    ...context,
  };
}

function validateTierSheet(
  sheet: WorkbookNeutralSheet | undefined,
): BusinessDatasetWorkbookImportIssue[] {
  if (!sheet) {
    return [
      schemaIssue(
        'MISSING_REQUIRED_SHEET',
        `Workbook is missing required sheet ${PRODUCT_PRICE_TIERS_SHEET_NAME}.`,
        { sheetName: PRODUCT_PRICE_TIERS_SHEET_NAME },
      ),
    ];
  }

  const issues: BusinessDatasetWorkbookImportIssue[] = [];

  if (
    sheet.columns.length !== PRODUCT_PRICE_TIERS_WORKBOOK_COLUMNS.length ||
    !sheet.columns.every(
      (column, index) => column === PRODUCT_PRICE_TIERS_WORKBOOK_COLUMNS[index],
    )
  ) {
    issues.push(
      schemaIssue(
        'INVALID_COLUMN_ORDER',
        `${PRODUCT_PRICE_TIERS_SHEET_NAME} columns must exactly match the canonical v3 order.`,
        {
          sheetName: PRODUCT_PRICE_TIERS_SHEET_NAME,
          input: sheet.columns,
        },
      ),
    );
  }

  const requiredText = ['id', 'productId', 'name', 'kind', 'priceBasis'] as const;
  const requiredNumbers = [
    'priceAmount',
    'unitsPerOffer',
    'minimumOrderQuantity',
    'additionalCostPerOffer',
  ] as const;

  sheet.rows.forEach((row, rowIndex) => {
    for (const column of requiredText) {
      const value = row[column];
      if (isBlank(value)) {
        issues.push(
          schemaIssue(
            'MISSING_REQUIRED_CELL',
            `Required cell ${PRODUCT_PRICE_TIERS_SHEET_NAME}.${column} is blank.`,
            { sheetName: PRODUCT_PRICE_TIERS_SHEET_NAME, rowIndex, column, input: value },
          ),
        );
      } else if (isFormulaCell(value)) {
        issues.push(
          schemaIssue(
            'FORMULA_CELL_NOT_ALLOWED',
            `Formula cells are not allowed in authoritative column ${PRODUCT_PRICE_TIERS_SHEET_NAME}.${column}.`,
            { sheetName: PRODUCT_PRICE_TIERS_SHEET_NAME, rowIndex, column, input: value },
          ),
        );
      } else if (typeof value !== 'string') {
        issues.push(
          schemaIssue(
            'INVALID_CELL_TYPE',
            `Cell ${PRODUCT_PRICE_TIERS_SHEET_NAME}.${column} must be text.`,
            { sheetName: PRODUCT_PRICE_TIERS_SHEET_NAME, rowIndex, column, input: value },
          ),
        );
      }
    }

    for (const column of requiredNumbers) {
      const value = row[column];
      if (isBlank(value)) {
        issues.push(
          schemaIssue(
            'MISSING_REQUIRED_CELL',
            `Required cell ${PRODUCT_PRICE_TIERS_SHEET_NAME}.${column} is blank.`,
            { sheetName: PRODUCT_PRICE_TIERS_SHEET_NAME, rowIndex, column, input: value },
          ),
        );
      } else if (isFormulaCell(value)) {
        issues.push(
          schemaIssue(
            'FORMULA_CELL_NOT_ALLOWED',
            `Formula cells are not allowed in authoritative column ${PRODUCT_PRICE_TIERS_SHEET_NAME}.${column}.`,
            { sheetName: PRODUCT_PRICE_TIERS_SHEET_NAME, rowIndex, column, input: value },
          ),
        );
      } else if (typeof value !== 'number' || !Number.isFinite(value)) {
        issues.push(
          schemaIssue(
            'INVALID_CELL_TYPE',
            `Cell ${PRODUCT_PRICE_TIERS_SHEET_NAME}.${column} must be number.`,
            { sheetName: PRODUCT_PRICE_TIERS_SHEET_NAME, rowIndex, column, input: value },
          ),
        );
      }
    }

    const notes = row.notes;
    if (!isBlank(notes) && isFormulaCell(notes)) {
      issues.push(
        schemaIssue(
          'FORMULA_CELL_NOT_ALLOWED',
          `Formula cells are not allowed in authoritative column ${PRODUCT_PRICE_TIERS_SHEET_NAME}.notes.`,
          { sheetName: PRODUCT_PRICE_TIERS_SHEET_NAME, rowIndex, column: 'notes', input: notes },
        ),
      );
    } else if (!isBlank(notes) && typeof notes !== 'string') {
      issues.push(
        schemaIssue(
          'INVALID_CELL_TYPE',
          `Cell ${PRODUCT_PRICE_TIERS_SHEET_NAME}.notes must be text when present.`,
          { sheetName: PRODUCT_PRICE_TIERS_SHEET_NAME, rowIndex, column: 'notes', input: notes },
        ),
      );
    }

    const isActive = row.isActive;
    if (isBlank(isActive)) {
      issues.push(
        schemaIssue(
          'MISSING_REQUIRED_CELL',
          `Required cell ${PRODUCT_PRICE_TIERS_SHEET_NAME}.isActive is blank.`,
          { sheetName: PRODUCT_PRICE_TIERS_SHEET_NAME, rowIndex, column: 'isActive', input: isActive },
        ),
      );
    } else if (isFormulaCell(isActive)) {
      issues.push(
        schemaIssue(
          'FORMULA_CELL_NOT_ALLOWED',
          `Formula cells are not allowed in authoritative column ${PRODUCT_PRICE_TIERS_SHEET_NAME}.isActive.`,
          { sheetName: PRODUCT_PRICE_TIERS_SHEET_NAME, rowIndex, column: 'isActive', input: isActive },
        ),
      );
    } else if (typeof isActive !== 'boolean') {
      issues.push(
        schemaIssue(
          'INVALID_CELL_TYPE',
          `Cell ${PRODUCT_PRICE_TIERS_SHEET_NAME}.isActive must be boolean.`,
          { sheetName: PRODUCT_PRICE_TIERS_SHEET_NAME, rowIndex, column: 'isActive', input: isActive },
        ),
      );
    }

    if (
      typeof row.kind === 'string' &&
      !PRODUCT_PRICE_TIER_KINDS.includes(
        row.kind as (typeof PRODUCT_PRICE_TIER_KINDS)[number],
      )
    ) {
      issues.push(
        schemaIssue(
          'INVALID_ENUM_TOKEN',
          `Unsupported token ${row.kind} for ${PRODUCT_PRICE_TIERS_SHEET_NAME}.kind.`,
          { sheetName: PRODUCT_PRICE_TIERS_SHEET_NAME, rowIndex, column: 'kind', input: row.kind },
        ),
      );
    }

    if (
      typeof row.priceBasis === 'string' &&
      !PRODUCT_PRICE_TIER_PRICE_BASES.includes(
        row.priceBasis as (typeof PRODUCT_PRICE_TIER_PRICE_BASES)[number],
      )
    ) {
      issues.push(
        schemaIssue(
          'INVALID_ENUM_TOKEN',
          `Unsupported token ${row.priceBasis} for ${PRODUCT_PRICE_TIERS_SHEET_NAME}.priceBasis.`,
          {
            sheetName: PRODUCT_PRICE_TIERS_SHEET_NAME,
            rowIndex,
            column: 'priceBasis',
            input: row.priceBasis,
          },
        ),
      );
    }
  });

  return issues;
}

export function validateBusinessDatasetV2WorkbookSchema(
  input: unknown,
): BusinessDatasetWorkbookImportIssue[] {
  if (!isRecord(input) || !Array.isArray(input.sheets)) {
    return [
      schemaIssue(
        'INVALID_WORKBOOK_SCHEMA',
        'Workbook schema input must be an object with a sheets array.',
        { input },
      ),
    ];
  }

  const document = input as WorkbookNeutralDocument;
  const issues: BusinessDatasetWorkbookImportIssue[] = [];

  const names = document.sheets.map((sheet) => sheet.name);
  for (const expected of CORE_WORKBOOK_V3_CANONICAL_SHEET_NAMES) {
    const count = names.filter((name) => name === expected).length;
    if (count === 0) {
      issues.push(
        schemaIssue(
          'MISSING_REQUIRED_SHEET',
          `Workbook is missing required sheet ${expected}.`,
          { sheetName: expected },
        ),
      );
    } else if (count > 1) {
      issues.push(
        schemaIssue(
          'DUPLICATE_SHEET',
          `Workbook contains duplicate sheet ${expected}.`,
          { sheetName: expected, input: count },
        ),
      );
    }
  }

  const meta = document.sheets.find((sheet) => sheet.name === '_Meta');
  if (meta?.rows.length === 1) {
    const row = meta.rows[0];
    if (row.formatId !== CRAFT_BUSINESS_WORKBOOK_FORMAT_ID) {
      issues.push(
        schemaIssue(
          'INVALID_FORMAT_ID',
          `Workbook formatId must be ${CRAFT_BUSINESS_WORKBOOK_FORMAT_ID}.`,
          { sheetName: '_Meta', rowIndex: 0, column: 'formatId', input: row.formatId },
        ),
      );
    }
    if (row.workbookFormatVersion !== CORE_WORKBOOK_V3_FORMAT_VERSION) {
      issues.push(
        schemaIssue(
          'INVALID_WORKBOOK_FORMAT_VERSION',
          `Workbook format version must be ${CORE_WORKBOOK_V3_FORMAT_VERSION}.`,
          {
            sheetName: '_Meta',
            rowIndex: 0,
            column: 'workbookFormatVersion',
            input: row.workbookFormatVersion,
          },
        ),
      );
    }
    if (row.datasetSchemaVersion !== BUSINESS_DATASET_V2_SCHEMA_VERSION) {
      issues.push(
        schemaIssue(
          'UNSUPPORTED_DATASET_SCHEMA_VERSION',
          `Dataset schema version must be ${BUSINESS_DATASET_V2_SCHEMA_VERSION}.`,
          {
            sheetName: '_Meta',
            rowIndex: 0,
            column: 'datasetSchemaVersion',
            input: row.datasetSchemaVersion,
          },
        ),
      );
    }
  } else if (meta) {
    issues.push(
      schemaIssue(
        'INVALID_META_ROW_COUNT',
        '_Meta must contain exactly one authoritative metadata row.',
        { sheetName: '_Meta', input: meta.rows.length },
      ),
    );
  }

  const tier = document.sheets.find(
    (sheet) => sheet.name === PRODUCT_PRICE_TIERS_SHEET_NAME,
  );
  issues.push(...validateTierSheet(tier));

  const projected = projectV3ToLegacyV2(document);
  for (const issue of validateWorkbookSchema(projected)) {
    if (
      issue.code === 'INVALID_WORKBOOK_FORMAT_VERSION' ||
      issue.code === 'UNSUPPORTED_DATASET_SCHEMA_VERSION'
    ) {
      continue;
    }
    issues.push({
      stage: 'schema',
      code: issue.code,
      message: issue.message,
      sheetName: issue.sheetName,
      rowIndex: issue.rowIndex,
      column: issue.column,
      input: issue.input,
    });
  }

  return issues;
}

export function createBusinessDatasetV2WorkbookDocument(
  dataset: BusinessDatasetV2,
  metadata: WorkbookExportMetadata,
): WorkbookNeutralDocument {
  const validation = validateBusinessDatasetV2Integrity(dataset);
  if (!validation.valid) {
    throw new BusinessDatasetV2WorkbookExportError(
      'INVALID_DATASET',
      `Business dataset v2 export rejected with ${validation.issues.length} validation issue(s).`,
      { datasetIssues: validation.issues },
    );
  }

  validateExportMetadata(metadata);

  const legacy = createBusinessDatasetWorkbookDocument(
    baseDatasetV1(dataset),
    metadata,
  );

  const document: WorkbookNeutralDocument = {
    sheets: [
      v3Meta(metadata),
      ...legacy.sheets.filter((sheet) => sheet.name !== '_Meta'),
      tierSheet(dataset),
    ],
  };

  const issues = validateBusinessDatasetV2WorkbookSchema(document);
  if (issues.length > 0) {
    throw new BusinessDatasetV2WorkbookExportError(
      'INVALID_GENERATED_WORKBOOK',
      `Generated workbook v3 failed schema self-validation with ${issues.length} issue(s).`,
      { workbookIssues: issues },
    );
  }

  return document;
}

export function exportBusinessDatasetV2ToXlsx(
  dataset: BusinessDatasetV2,
  metadata: WorkbookExportMetadata,
  codec: WorkbookCodec,
): Uint8Array {
  return codec.encode(createBusinessDatasetV2WorkbookDocument(dataset, metadata));
}

function textValue(
  row: Readonly<Record<string, unknown>>,
  key: string,
): string {
  const value = row[key];
  if (typeof value !== 'string') {
    throw new TypeError(`${key} must be text.`);
  }
  return value;
}

function numberValue(
  row: Readonly<Record<string, unknown>>,
  key: string,
): number {
  const value = row[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${key} must be a finite number.`);
  }
  return value;
}

function reconstructTiers(
  document: WorkbookNeutralDocument,
): ProductPriceTier[] {
  const sheet = document.sheets.find(
    (candidate) => candidate.name === PRODUCT_PRICE_TIERS_SHEET_NAME,
  );
  if (!sheet) return [];

  return sheet.rows.map((row) => {
    const notes =
      typeof row.notes === 'string' && row.notes.trim()
        ? row.notes
        : undefined;

    return {
      id: textValue(row, 'id'),
      productId: textValue(row, 'productId'),
      name: textValue(row, 'name'),
      kind: textValue(row, 'kind') as ProductPriceTier['kind'],
      priceBasis: textValue(row, 'priceBasis') as ProductPriceTier['priceBasis'],
      priceAmount: numberValue(row, 'priceAmount'),
      unitsPerOffer: numberValue(row, 'unitsPerOffer'),
      minimumOrderQuantity: numberValue(row, 'minimumOrderQuantity'),
      additionalCostPerOffer: numberValue(row, 'additionalCostPerOffer'),
      ...(notes === undefined ? {} : { notes }),
      isActive: row.isActive as boolean,
    };
  });
}

function resourceIssues(
  issues: readonly WorkbookResourceLimitIssue[],
): BusinessDatasetWorkbookImportIssue[] {
  return issues.map((issue) => ({
    stage: 'resource-limit',
    code: issue.code,
    message: issue.message,
    sheetName: issue.sheetName,
    limitKind: issue.kind,
    actual: issue.actual,
    maximum: issue.maximum,
  }));
}

function datasetIssues(
  issues: readonly BusinessDatasetV2ValidationIssue[],
): BusinessDatasetWorkbookImportIssue[] {
  return issues.map((issue) => ({
    stage: 'dataset',
    code: issue.code,
    message: issue.message,
    path: issue.path,
  }));
}

export function reconstructBusinessDatasetV2FromWorkbook(
  document: WorkbookNeutralDocument,
): BusinessDatasetV2WorkbookImportResult {
  const schemaIssues = validateBusinessDatasetV2WorkbookSchema(document);
  if (schemaIssues.length > 0) {
    return { ok: false, issues: schemaIssues };
  }

  const meta = document.sheets.find((sheet) => sheet.name === '_Meta')!;
  const row = meta.rows[0];

  const legacy = reconstructBusinessDatasetFromWorkbook(
    projectV3ToLegacyV2(document),
  );
  if (!legacy.ok) return legacy;

  let tiers: ProductPriceTier[];
  try {
    tiers = reconstructTiers(document);
  } catch (error) {
    return {
      ok: false,
      issues: [
        {
          stage: 'reconstruction',
          code: 'RECONSTRUCTION_FAILED',
          message:
            error instanceof Error
              ? `ProductPriceTiers reconstruction failed: ${error.message}`
              : 'ProductPriceTiers reconstruction failed unexpectedly.',
          sheetName: PRODUCT_PRICE_TIERS_SHEET_NAME,
        },
      ],
    };
  }

  const dataset: BusinessDatasetV2 = {
    ...legacy.dataset,
    schemaVersion: BUSINESS_DATASET_V2_SCHEMA_VERSION,
    productPriceTiers: tiers,
  };

  const validation = validateBusinessDatasetV2Integrity(dataset);
  if (!validation.valid) {
    return { ok: false, issues: datasetIssues(validation.issues) };
  }

  return {
    ok: true,
    dataset,
    metadata: {
      formatId: CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
      workbookFormatVersion: CORE_WORKBOOK_V3_FORMAT_VERSION,
      datasetSchemaVersion: BUSINESS_DATASET_V2_SCHEMA_VERSION,
      exportedAt: String(row.exportedAt),
      ...(typeof row.applicationVersion === 'string'
        ? { applicationVersion: row.applicationVersion }
        : {}),
    },
  };
}

export function importBusinessDatasetV2FromXlsx(
  bytes: WorkbookBinaryInput,
  codec: WorkbookCodec,
  resourceLimitOverrides: Partial<WorkbookResourceLimits> = {},
): BusinessDatasetV2WorkbookImportResult {
  const limits = createWorkbookResourceLimits(resourceLimitOverrides);
  const binaryIssues = validateWorkbookBinaryResourceLimit(bytes, limits);
  if (binaryIssues.length > 0) {
    return { ok: false, issues: resourceIssues(binaryIssues) };
  }

  let document: WorkbookNeutralDocument;
  try {
    document = codec.decode(bytes);
  } catch (error) {
    const code =
      error instanceof WorkbookCodecError
        ? error.code
        : 'WORKBOOK_DECODE_FAILED';
    return {
      ok: false,
      issues: [
        {
          stage: 'codec',
          code,
          message:
            error instanceof Error
              ? `Workbook decode failed: ${error.message}`
              : 'Workbook decode failed unexpectedly.',
        },
      ],
    };
  }

  const neutralIssues = validateNeutralWorkbookResourceLimits(document, limits);
  if (neutralIssues.length > 0) {
    return { ok: false, issues: resourceIssues(neutralIssues) };
  }

  return reconstructBusinessDatasetV2FromWorkbook(document);
}
