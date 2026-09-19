import {
  PHYSICAL_BUSINESS_DATASET_V3_SCHEMA_VERSION,
  extendBusinessDatasetV2,
  toBusinessDatasetV2,
  validatePhysicalBusinessDatasetV3Integrity,
  type PhysicalBusinessDatasetV3,
} from '../domain/physicalBusinessDatasetV3';
import type { Mold } from '../domain/molds';
import type { StorageLocation } from '../domain/storageLocations';
import {
  CORE_WORKBOOK_V3_CANONICAL_SHEET_NAMES,
  CORE_WORKBOOK_V3_FORMAT_VERSION,
  PRODUCT_PRICE_TIERS_SHEET_NAME,
  PRODUCT_PRICE_TIERS_WORKBOOK_COLUMNS,
  createBusinessDatasetV2WorkbookDocument,
  reconstructBusinessDatasetV2FromWorkbook,
} from './businessDatasetV2Workbook';
import type { WorkbookExportMetadata } from './businessDatasetWorkbookExport';
import type {
  BusinessDatasetWorkbookImportIssue,
  ImportedWorkbookMetadata,
} from './businessDatasetWorkbookImport';
import {
  WorkbookCodecError,
  type WorkbookBinaryInput,
  type WorkbookCodec,
} from './workbookCodec';
import {
  WorkbookMigrationRegistry,
  cloneWorkbookNeutralDocument,
  type WorkbookMigrationStep,
  type WorkbookVersionKey,
} from './workbookCompatibility';
import {
  prepareWorkbookForCurrentImport,
  type WorkbookCurrentImportPreparationIssue,
} from './workbookImportCompatibility';
import {
  createWorkbookResourceLimits,
  validateNeutralWorkbookResourceLimits,
  validateWorkbookBinaryResourceLimit,
  type WorkbookResourceLimitIssue,
  type WorkbookResourceLimits,
} from './workbookResourceLimits';
import {
  CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
  type WorkbookNeutralDocument,
  type WorkbookNeutralSheet,
} from './workbookSchema';

export const PHYSICAL_WORKBOOK_V3_FORMAT_VERSION = 3 as const;
export const PHYSICAL_WORKBOOK_V3_VERSION_KEY: WorkbookVersionKey =
  Object.freeze({
    workbookFormatVersion: PHYSICAL_WORKBOOK_V3_FORMAT_VERSION,
    datasetSchemaVersion: PHYSICAL_BUSINESS_DATASET_V3_SCHEMA_VERSION,
  });

export const PHYSICAL_V3_STORAGE_SHEET_NAME = 'StorageLocations' as const;
export const PHYSICAL_V3_MOLDS_SHEET_NAME = 'Molds' as const;

export const PHYSICAL_V3_STORAGE_COLUMNS = [
  'id',
  'name',
  'type',
  'parentId',
  'notes',
  'isActive',
] as const;

export const PHYSICAL_V3_MOLD_COLUMNS = [
  'id',
  'productId',
  'name',
  'storageLocationId',
  'notes',
  'isActive',
] as const;

export const PHYSICAL_WORKBOOK_V3_CANONICAL_SHEET_NAMES = [
  ...CORE_WORKBOOK_V3_CANONICAL_SHEET_NAMES,
  PHYSICAL_V3_STORAGE_SHEET_NAME,
  PHYSICAL_V3_MOLDS_SHEET_NAME,
] as const;

export type PhysicalBusinessDatasetV3WorkbookImportResult =
  | {
      ok: true;
      dataset: PhysicalBusinessDatasetV3;
      metadata: ImportedWorkbookMetadata;
    }
  | {
      ok: false;
      issues: readonly BusinessDatasetWorkbookImportIssue[];
    };

function canonical(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function optional(value: string | undefined): string | undefined {
  return value;
}

function sheet(
  document: WorkbookNeutralDocument,
  name: string,
): WorkbookNeutralSheet | undefined {
  return document.sheets.find((candidate) => candidate.name === name);
}

function physicalSheet(
  name: string,
  columns: readonly string[],
  rows: readonly Readonly<Record<string, unknown>>[],
): WorkbookNeutralSheet {
  return { name, columns: [...columns], rows: [...rows] };
}

function storageRows(
  dataset: PhysicalBusinessDatasetV3,
): Readonly<Record<string, unknown>>[] {
  return [...dataset.storageLocations]
    .sort(
      (left, right) =>
        canonical(left.id).localeCompare(canonical(right.id)) ||
        left.id.localeCompare(right.id),
    )
    .map((location) => ({
      id: location.id,
      name: location.name,
      type: location.type,
      parentId: optional(location.parentId),
      notes: optional(location.notes),
      isActive: location.isActive,
    }));
}

function moldRows(
  dataset: PhysicalBusinessDatasetV3,
): Readonly<Record<string, unknown>>[] {
  return [...dataset.molds]
    .sort(
      (left, right) =>
        canonical(left.id).localeCompare(canonical(right.id)) ||
        left.id.localeCompare(right.id),
    )
    .map((mold) => ({
      id: mold.id,
      productId: mold.productId,
      name: mold.name,
      storageLocationId: optional(mold.storageLocationId),
      notes: optional(mold.notes),
      isActive: mold.isActive,
    }));
}

const LEGACY_PRE_PREFERRED_PHYSICAL_PRODUCTS_COLUMNS = [
  'id',
  'name',
  'category',
  'mixPresetId',
  'safetyWasteRate',
  'notes',
  'isActive',
] as const;

function normalizePrePreferredPhysicalProductsSheet(
  candidate: WorkbookNeutralSheet,
): WorkbookNeutralSheet {
  if (candidate.name !== 'Products') return candidate;

  const isRecognizedLegacyShape =
    candidate.columns.length ===
      LEGACY_PRE_PREFERRED_PHYSICAL_PRODUCTS_COLUMNS.length &&
    candidate.columns.every(
      (column, index) =>
        column === LEGACY_PRE_PREFERRED_PHYSICAL_PRODUCTS_COLUMNS[index],
    );

  if (!isRecognizedLegacyShape) return candidate;

  const mixPresetIndex = candidate.columns.indexOf('mixPresetId');
  const insertAt = mixPresetIndex + 1;

  return {
    ...candidate,
    columns: [
      ...candidate.columns.slice(0, insertAt),
      'preferredYieldSampleId',
      ...candidate.columns.slice(insertAt),
    ],
    rows: candidate.rows.map((row) => ({
      ...row,
      preferredYieldSampleId: undefined,
    })),
  };
}

function migratePhysicalWorkbookV2ToV3(
  document: WorkbookNeutralDocument,
): WorkbookNeutralDocument {
  const migrated = cloneWorkbookNeutralDocument(document);

  if (
    migrated.sheets.some(
      (candidate) => candidate.name === PRODUCT_PRICE_TIERS_SHEET_NAME,
    )
  ) {
    throw new Error(
      `Legacy physical workbook already contains reserved sheet ${PRODUCT_PRICE_TIERS_SHEET_NAME}.`,
    );
  }

  const storage = sheet(migrated, PHYSICAL_V3_STORAGE_SHEET_NAME);
  const molds = sheet(migrated, PHYSICAL_V3_MOLDS_SHEET_NAME);
  if (!storage || !molds) {
    throw new Error(
      'Physical workbook v2 migration requires StorageLocations and Molds sheets.',
    );
  }

  const coreSheets = migrated.sheets
    .filter(
      (candidate) =>
        candidate.name !== PHYSICAL_V3_STORAGE_SHEET_NAME &&
        candidate.name !== PHYSICAL_V3_MOLDS_SHEET_NAME,
    )
    .map((candidate) => {
      if (candidate.name === 'Products') {
        return normalizePrePreferredPhysicalProductsSheet(candidate);
      }

      if (candidate.name !== '_Meta') return candidate;

      return {
        ...candidate,
        rows: candidate.rows.map((row, index) =>
          index === 0
            ? {
                ...row,
                workbookFormatVersion: PHYSICAL_WORKBOOK_V3_FORMAT_VERSION,
                datasetSchemaVersion:
                  PHYSICAL_BUSINESS_DATASET_V3_SCHEMA_VERSION,
              }
            : row,
        ),
      };
    });

  return {
    sheets: [
      ...coreSheets,
      {
        name: PRODUCT_PRICE_TIERS_SHEET_NAME,
        columns: [...PRODUCT_PRICE_TIERS_WORKBOOK_COLUMNS],
        rows: [],
      },
      storage,
      molds,
    ],
  };
}

export const PHYSICAL_WORKBOOK_V3_MIGRATION_STEPS: readonly WorkbookMigrationStep[] =
  [
    {
      from: { workbookFormatVersion: 2, datasetSchemaVersion: 2 },
      to: PHYSICAL_WORKBOOK_V3_VERSION_KEY,
      migrate: migratePhysicalWorkbookV2ToV3,
    },
  ];

export const physicalWorkbookV3MigrationRegistry =
  new WorkbookMigrationRegistry(PHYSICAL_WORKBOOK_V3_MIGRATION_STEPS);

function mapResourceIssues(
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

function mapPreparationIssues(
  issues: readonly WorkbookCurrentImportPreparationIssue[],
): BusinessDatasetWorkbookImportIssue[] {
  return issues.map((issue) => ({
    stage: issue.stage === 'migration' ? 'migration' : 'compatibility',
    code: issue.code,
    message: issue.message,
    sheetName:
      issue.stage === 'preflight' &&
      issue.code !== 'INVALID_DOCUMENT' &&
      issue.code !== 'MISSING_META_SHEET'
        ? '_Meta'
        : undefined,
    rowIndex:
      issue.stage === 'preflight' &&
      issue.code !== 'INVALID_DOCUMENT' &&
      issue.code !== 'MISSING_META_SHEET'
        ? 0
        : undefined,
    excelRow:
      issue.stage === 'preflight' &&
      issue.code !== 'INVALID_DOCUMENT' &&
      issue.code !== 'MISSING_META_SHEET'
        ? 2
        : undefined,
    path:
      issue.stepIndex === undefined
        ? undefined
        : `migration[${issue.stepIndex}]`,
    input: issue.input,
    compatibilityStatus: issue.compatibilityStatus,
    sourceVersion: issue.sourceVersion,
    targetVersion: issue.targetVersion,
    stepIndex: issue.stepIndex,
    causeValue: issue.causeValue,
  }));
}

function sameColumns(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  return (
    actual.length === expected.length &&
    actual.every((column, index) => column === expected[index])
  );
}

function validatePhysicalSheetRows(
  sheetValue: WorkbookNeutralSheet,
  columns: readonly string[],
): BusinessDatasetWorkbookImportIssue[] {
  const issues: BusinessDatasetWorkbookImportIssue[] = [];

  if (!sameColumns(sheetValue.columns, columns)) {
    issues.push({
      stage: 'schema',
      code: 'INVALID_COLUMNS',
      message: `${sheetValue.name} columns must exactly match ${columns.join(', ')}.`,
      sheetName: sheetValue.name,
    });
    return issues;
  }

  sheetValue.rows.forEach((row, rowIndex) => {
    for (const column of columns) {
      const value = row[column];
      const optionalText =
        column === 'parentId' ||
        column === 'storageLocationId' ||
        column === 'notes';

      if (column === 'isActive') {
        if (typeof value !== 'boolean') {
          issues.push({
            stage: 'schema',
            code: 'INVALID_CELL_TYPE',
            message: `${sheetValue.name}.${column} must be boolean.`,
            sheetName: sheetValue.name,
            rowIndex,
            excelRow: rowIndex + 2,
            column,
          });
        }
      } else if (optionalText) {
        if (
          value !== undefined &&
          value !== null &&
          typeof value !== 'string'
        ) {
          issues.push({
            stage: 'schema',
            code: 'INVALID_CELL_TYPE',
            message: `${sheetValue.name}.${column} must be text when provided.`,
            sheetName: sheetValue.name,
            rowIndex,
            excelRow: rowIndex + 2,
            column,
          });
        }
      } else if (typeof value !== 'string' || !value.trim()) {
        issues.push({
          stage: 'schema',
          code: 'INVALID_REQUIRED_TEXT',
          message: `${sheetValue.name}.${column} must be nonblank text.`,
          sheetName: sheetValue.name,
          rowIndex,
          excelRow: rowIndex + 2,
          column,
        });
      }
    }

    if (sheetValue.name === PHYSICAL_V3_STORAGE_SHEET_NAME) {
      const type = row.type;
      if (type !== 'rack' && type !== 'shelf' && type !== 'bin') {
        issues.push({
          stage: 'schema',
          code: 'INVALID_STORAGE_TYPE',
          message:
            'StorageLocations.type must be rack, shelf, or bin.',
          sheetName: sheetValue.name,
          rowIndex,
          excelRow: rowIndex + 2,
          column: 'type',
        });
      }
    }
  });

  return issues;
}

function optionalText(
  row: Readonly<Record<string, unknown>>,
  key: string,
): string | undefined {
  const value = row[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function reconstructStorage(
  sheetValue: WorkbookNeutralSheet,
): StorageLocation[] {
  return sheetValue.rows.map((row) => {
    const location: StorageLocation = {
      id: row.id as string,
      name: row.name as string,
      type: row.type as StorageLocation['type'],
      isActive: row.isActive as boolean,
    };
    const parentId = optionalText(row, 'parentId');
    const notes = optionalText(row, 'notes');
    if (parentId !== undefined) location.parentId = parentId;
    if (notes !== undefined) location.notes = notes;
    return location;
  });
}

function reconstructMolds(sheetValue: WorkbookNeutralSheet): Mold[] {
  return sheetValue.rows.map((row) => {
    const mold: Mold = {
      id: row.id as string,
      productId: row.productId as string,
      name: row.name as string,
      isActive: row.isActive as boolean,
    };
    const storageLocationId = optionalText(row, 'storageLocationId');
    const notes = optionalText(row, 'notes');
    if (storageLocationId !== undefined) {
      mold.storageLocationId = storageLocationId;
    }
    if (notes !== undefined) mold.notes = notes;
    return mold;
  });
}

function projectPhysicalV3ToCoreV3(
  document: WorkbookNeutralDocument,
): WorkbookNeutralDocument {
  return {
    sheets: document.sheets
      .filter(
        (candidate) =>
          candidate.name !== PHYSICAL_V3_STORAGE_SHEET_NAME &&
          candidate.name !== PHYSICAL_V3_MOLDS_SHEET_NAME,
      )
      .map((candidate) =>
        candidate.name === '_Meta'
          ? {
              ...candidate,
              rows: candidate.rows.map((row, index) =>
                index === 0
                  ? {
                      ...row,
                      workbookFormatVersion: CORE_WORKBOOK_V3_FORMAT_VERSION,
                      datasetSchemaVersion: 2,
                    }
                  : row,
              ),
            }
          : candidate,
      ),
  };
}

export function createPhysicalBusinessDatasetV3WorkbookDocument(
  dataset: PhysicalBusinessDatasetV3,
  metadata: WorkbookExportMetadata,
): WorkbookNeutralDocument {
  const validation = validatePhysicalBusinessDatasetV3Integrity(dataset);
  if (!validation.valid) {
    throw new Error(
      `Physical business dataset v3 export rejected with ${validation.issues.length} validation issue(s): ${validation.issues[0]?.message ?? 'unknown issue'}`,
    );
  }

  const base = createBusinessDatasetV2WorkbookDocument(
    toBusinessDatasetV2(dataset),
    metadata,
  );

  const currentMeta = base.sheets.find(
    (candidate) => candidate.name === '_Meta',
  );
  if (!currentMeta || currentMeta.rows.length !== 1) {
    throw new Error('Core workbook v3 is missing its canonical _Meta row.');
  }

  return {
    sheets: [
      {
        ...currentMeta,
        rows: [
          {
            ...currentMeta.rows[0],
            workbookFormatVersion: PHYSICAL_WORKBOOK_V3_FORMAT_VERSION,
            datasetSchemaVersion: PHYSICAL_BUSINESS_DATASET_V3_SCHEMA_VERSION,
          },
        ],
      },
      ...base.sheets.filter((candidate) => candidate.name !== '_Meta'),
      physicalSheet(
        PHYSICAL_V3_STORAGE_SHEET_NAME,
        PHYSICAL_V3_STORAGE_COLUMNS,
        storageRows(dataset),
      ),
      physicalSheet(
        PHYSICAL_V3_MOLDS_SHEET_NAME,
        PHYSICAL_V3_MOLD_COLUMNS,
        moldRows(dataset),
      ),
    ],
  };
}

export function exportPhysicalBusinessDatasetV3ToXlsx(
  dataset: PhysicalBusinessDatasetV3,
  metadata: WorkbookExportMetadata,
  codec: WorkbookCodec,
): Uint8Array {
  return codec.encode(
    createPhysicalBusinessDatasetV3WorkbookDocument(dataset, metadata),
  );
}

export function reconstructPhysicalBusinessDatasetV3FromWorkbook(
  document: WorkbookNeutralDocument,
): PhysicalBusinessDatasetV3WorkbookImportResult {
  const actualNames = document.sheets.map((candidate) => candidate.name);
  const expectedNames = [...PHYSICAL_WORKBOOK_V3_CANONICAL_SHEET_NAMES];

  if (
    actualNames.length !== expectedNames.length ||
    !expectedNames.every((name, index) => actualNames[index] === name)
  ) {
    return {
      ok: false,
      issues: [
        {
          stage: 'schema',
          code: 'INVALID_SHEET_SET',
          message:
            'Physical workbook v3 must contain the canonical core v3 sheets followed by StorageLocations and Molds.',
        },
      ],
    };
  }

  const meta = sheet(document, '_Meta')!;
  const metaRow = meta.rows[0];
  if (
    metaRow?.formatId !== CRAFT_BUSINESS_WORKBOOK_FORMAT_ID ||
    metaRow?.workbookFormatVersion !== PHYSICAL_WORKBOOK_V3_FORMAT_VERSION ||
    metaRow?.datasetSchemaVersion !==
      PHYSICAL_BUSINESS_DATASET_V3_SCHEMA_VERSION
  ) {
    return {
      ok: false,
      issues: [
        {
          stage: 'compatibility',
          code: 'INVALID_PHYSICAL_V3_METADATA',
          message:
            'Physical workbook v3 metadata must identify workbook 3 / dataset 3.',
          sheetName: '_Meta',
          rowIndex: 0,
          excelRow: 2,
        },
      ],
    };
  }

  const storage = sheet(document, PHYSICAL_V3_STORAGE_SHEET_NAME)!;
  const molds = sheet(document, PHYSICAL_V3_MOLDS_SHEET_NAME)!;
  const physicalSchemaIssues = [
    ...validatePhysicalSheetRows(storage, PHYSICAL_V3_STORAGE_COLUMNS),
    ...validatePhysicalSheetRows(molds, PHYSICAL_V3_MOLD_COLUMNS),
  ];
  if (physicalSchemaIssues.length > 0) {
    return { ok: false, issues: physicalSchemaIssues };
  }

  const core = reconstructBusinessDatasetV2FromWorkbook(
    projectPhysicalV3ToCoreV3(document),
  );
  if (!core.ok) return core;

  const dataset = extendBusinessDatasetV2(
    core.dataset,
    reconstructStorage(storage),
    reconstructMolds(molds),
  );

  const validation = validatePhysicalBusinessDatasetV3Integrity(dataset);
  if (!validation.valid) {
    return {
      ok: false,
      issues: validation.issues.map((issue) => ({
        stage: 'dataset',
        code: issue.code,
        message: issue.message,
        path: issue.path,
        sheetName: issue.path.startsWith('molds')
          ? PHYSICAL_V3_MOLDS_SHEET_NAME
          : issue.path.startsWith('storageLocations')
            ? PHYSICAL_V3_STORAGE_SHEET_NAME
            : undefined,
      })),
    };
  }

  return {
    ok: true,
    dataset,
    metadata: {
      ...core.metadata,
      workbookFormatVersion: PHYSICAL_WORKBOOK_V3_FORMAT_VERSION,
      datasetSchemaVersion: PHYSICAL_BUSINESS_DATASET_V3_SCHEMA_VERSION,
    },
  };
}

export function importPhysicalBusinessDatasetV3FromXlsx(
  bytes: WorkbookBinaryInput,
  codec: WorkbookCodec,
  resourceLimitOverrides: Partial<WorkbookResourceLimits> = {},
): PhysicalBusinessDatasetV3WorkbookImportResult {
  const limits = createWorkbookResourceLimits(resourceLimitOverrides);
  const binaryIssues = validateWorkbookBinaryResourceLimit(bytes, limits);
  if (binaryIssues.length > 0) {
    return { ok: false, issues: mapResourceIssues(binaryIssues) };
  }

  let document: WorkbookNeutralDocument;
  try {
    document = codec.decode(bytes);
  } catch (error) {
    return {
      ok: false,
      issues: [
        {
          stage: 'codec',
          code:
            error instanceof WorkbookCodecError
              ? error.code
              : 'WORKBOOK_DECODE_FAILED',
          message:
            error instanceof Error
              ? error.message
              : 'Workbook decode failed unexpectedly.',
        },
      ],
    };
  }

  const neutralIssues = validateNeutralWorkbookResourceLimits(document, limits);
  if (neutralIssues.length > 0) {
    return { ok: false, issues: mapResourceIssues(neutralIssues) };
  }

  const prepared = prepareWorkbookForCurrentImport(
    document,
    physicalWorkbookV3MigrationRegistry,
    PHYSICAL_WORKBOOK_V3_VERSION_KEY,
  );
  if (!prepared.ok) {
    return { ok: false, issues: mapPreparationIssues(prepared.issues) };
  }

  return reconstructPhysicalBusinessDatasetV3FromWorkbook(prepared.document);
}
