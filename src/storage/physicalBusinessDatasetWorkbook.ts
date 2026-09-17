import {
  extendLegacyBusinessDataset,
  toLegacyBusinessDataset,
  validatePhysicalIdentificationSources,
  type PhysicalBusinessDataset,
} from '../domain/physicalBusinessDataset';
import type { Mold } from '../domain/molds';
import type { StorageLocation } from '../domain/storageLocations';
import {
  createBusinessDatasetWorkbookDocument,
  type WorkbookExportMetadata,
} from './businessDatasetWorkbookExport';
import {
  importBusinessDatasetFromXlsx,
  type BusinessDatasetWorkbookImportIssue,
  type ImportedWorkbookMetadata,
} from './businessDatasetWorkbookImport';
import { WorkbookCodecError, type WorkbookBinaryInput, type WorkbookCodec } from './workbookCodec';
import {
  validateNeutralWorkbookResourceLimits,
  validateWorkbookBinaryResourceLimit,
  createWorkbookResourceLimits,
  type WorkbookResourceLimits,
} from './workbookResourceLimits';
import {
  CANONICAL_WORKBOOK_SHEET_NAMES,
  CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
  type WorkbookNeutralDocument,
  type WorkbookNeutralSheet,
} from './workbookSchema';

export const CURRENT_PHYSICAL_WORKBOOK_FORMAT_VERSION = 2 as const;
export const PHYSICAL_STORAGE_SHEET_NAME = 'StorageLocations' as const;
export const PHYSICAL_MOLDS_SHEET_NAME = 'Molds' as const;

const STORAGE_COLUMNS = ['id', 'name', 'type', 'parentId', 'notes', 'isActive'] as const;
const MOLD_COLUMNS = ['id', 'productId', 'name', 'storageLocationId', 'notes', 'isActive'] as const;

export type PhysicalBusinessDatasetWorkbookImportResult =
  | { ok: true; dataset: PhysicalBusinessDataset; metadata: ImportedWorkbookMetadata }
  | { ok: false; issues: readonly BusinessDatasetWorkbookImportIssue[] };

function optional(value: string | undefined): string | undefined {
  return value;
}

function physicalSheet(
  name: string,
  columns: readonly string[],
  rows: readonly Readonly<Record<string, unknown>>[],
): WorkbookNeutralSheet {
  return { name, columns: [...columns], rows: [...rows] };
}

function storageRows(dataset: PhysicalBusinessDataset): Readonly<Record<string, unknown>>[] {
  return [...dataset.storageLocations]
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { sensitivity: 'base' }) || a.id.localeCompare(b.id))
    .map((location) => ({
      id: location.id,
      name: location.name,
      type: location.type,
      parentId: optional(location.parentId),
      notes: optional(location.notes),
      isActive: location.isActive,
    }));
}

function moldRows(dataset: PhysicalBusinessDataset): Readonly<Record<string, unknown>>[] {
  return [...dataset.molds]
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { sensitivity: 'base' }) || a.id.localeCompare(b.id))
    .map((mold) => ({
      id: mold.id,
      productId: mold.productId,
      name: mold.name,
      storageLocationId: optional(mold.storageLocationId),
      notes: optional(mold.notes),
      isActive: mold.isActive,
    }));
}

function physicalIssues(dataset: PhysicalBusinessDataset): BusinessDatasetWorkbookImportIssue[] {
  return validatePhysicalIdentificationSources(dataset).map((issue) => ({
    stage: 'dataset' as const,
    code: issue.code,
    message: issue.message,
    path: issue.path,
    sheetName: issue.path.startsWith('molds') ? PHYSICAL_MOLDS_SHEET_NAME : PHYSICAL_STORAGE_SHEET_NAME,
  }));
}

export function createPhysicalBusinessDatasetWorkbookDocument(
  dataset: PhysicalBusinessDataset,
  metadata: WorkbookExportMetadata,
): WorkbookNeutralDocument {
  const issues = physicalIssues(dataset);
  if (issues.length > 0) {
    throw new Error(`Physical business dataset export rejected with ${issues.length} validation issue(s): ${issues[0].message}`);
  }

  const base = createBusinessDatasetWorkbookDocument(toLegacyBusinessDataset(dataset), metadata);
  const meta = base.sheets.find((sheet) => sheet.name === '_Meta');
  if (!meta || meta.rows.length !== 1) throw new Error('Base workbook is missing its canonical _Meta row.');

  const currentMeta: WorkbookNeutralSheet = {
    ...meta,
    rows: [
      {
        ...meta.rows[0],
        workbookFormatVersion: CURRENT_PHYSICAL_WORKBOOK_FORMAT_VERSION,
        datasetSchemaVersion: 2,
      },
    ],
  };

  return {
    sheets: [
      currentMeta,
      ...base.sheets.filter((sheet) => sheet.name !== '_Meta'),
      physicalSheet(PHYSICAL_STORAGE_SHEET_NAME, STORAGE_COLUMNS, storageRows(dataset)),
      physicalSheet(PHYSICAL_MOLDS_SHEET_NAME, MOLD_COLUMNS, moldRows(dataset)),
    ],
  };
}

export function exportPhysicalBusinessDatasetToXlsx(
  dataset: PhysicalBusinessDataset,
  metadata: WorkbookExportMetadata,
  codec: WorkbookCodec,
): Uint8Array {
  return codec.encode(createPhysicalBusinessDatasetWorkbookDocument(dataset, metadata));
}

function failure(...issues: BusinessDatasetWorkbookImportIssue[]): PhysicalBusinessDatasetWorkbookImportResult {
  return { ok: false, issues };
}

function resourceFailures(
  issues: ReturnType<typeof validateNeutralWorkbookResourceLimits>,
): PhysicalBusinessDatasetWorkbookImportResult {
  return {
    ok: false,
    issues: issues.map((issue) => ({
      stage: 'resource-limit' as const,
      code: issue.code,
      message: issue.message,
      sheetName: issue.sheetName,
      limitKind: issue.kind,
      actual: issue.actual,
      maximum: issue.maximum,
    })),
  };
}

function sheet(document: WorkbookNeutralDocument, name: string): WorkbookNeutralSheet | undefined {
  return document.sheets.find((candidate) => candidate.name === name);
}

function sameColumns(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && actual.every((column, index) => column === expected[index]);
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
      const optionalText = column === 'parentId' || column === 'storageLocationId' || column === 'notes';
      if (column === 'isActive') {
        if (typeof value !== 'boolean') {
          issues.push({ stage: 'schema', code: 'INVALID_CELL_TYPE', message: `${sheetValue.name}.${column} must be boolean.`, sheetName: sheetValue.name, rowIndex, excelRow: rowIndex + 2, column });
        }
      } else if (optionalText) {
        if (value !== undefined && value !== null && typeof value !== 'string') {
          issues.push({ stage: 'schema', code: 'INVALID_CELL_TYPE', message: `${sheetValue.name}.${column} must be text when provided.`, sheetName: sheetValue.name, rowIndex, excelRow: rowIndex + 2, column });
        }
      } else if (typeof value !== 'string' || !value.trim()) {
        issues.push({ stage: 'schema', code: 'INVALID_REQUIRED_TEXT', message: `${sheetValue.name}.${column} must be nonblank text.`, sheetName: sheetValue.name, rowIndex, excelRow: rowIndex + 2, column });
      }
    }

    if (sheetValue.name === PHYSICAL_STORAGE_SHEET_NAME) {
      const type = row.type;
      if (type !== 'rack' && type !== 'shelf' && type !== 'bin') {
        issues.push({ stage: 'schema', code: 'INVALID_STORAGE_TYPE', message: 'StorageLocations.type must be rack, shelf, or bin.', sheetName: sheetValue.name, rowIndex, excelRow: rowIndex + 2, column: 'type' });
      }
    }
  });

  return issues;
}

function optionalText(row: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = row[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function reconstructStorage(sheetValue: WorkbookNeutralSheet): StorageLocation[] {
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
    if (storageLocationId !== undefined) mold.storageLocationId = storageLocationId;
    if (notes !== undefined) mold.notes = notes;
    return mold;
  });
}

function legacyDocumentFromV2(document: WorkbookNeutralDocument): WorkbookNeutralDocument {
  return {
    sheets: document.sheets
      .filter((candidate) => candidate.name !== PHYSICAL_STORAGE_SHEET_NAME && candidate.name !== PHYSICAL_MOLDS_SHEET_NAME)
      .map((candidate) =>
        candidate.name !== '_Meta'
          ? { ...candidate, columns: [...candidate.columns], rows: candidate.rows.map((row) => ({ ...row })) }
          : {
              ...candidate,
              columns: [...candidate.columns],
              rows: candidate.rows.map((row) => ({
                ...row,
                workbookFormatVersion: 1,
                datasetSchemaVersion: 1,
              })),
            },
      ),
  };
}

export function importPhysicalBusinessDatasetFromXlsx(
  bytes: WorkbookBinaryInput,
  codec: WorkbookCodec,
  resourceLimitOverrides: Partial<WorkbookResourceLimits> = {},
): PhysicalBusinessDatasetWorkbookImportResult {
  const limits = createWorkbookResourceLimits(resourceLimitOverrides);
  const byteIssues = validateWorkbookBinaryResourceLimit(bytes, limits);
  if (byteIssues.length > 0) return resourceFailures(byteIssues);

  let document: WorkbookNeutralDocument;
  try {
    document = codec.decode(bytes);
  } catch (error) {
    return failure({
      stage: 'codec',
      code: error instanceof WorkbookCodecError ? error.code : 'WORKBOOK_DECODE_FAILED',
      message: error instanceof Error ? error.message : 'Workbook decode failed unexpectedly.',
    });
  }

  const neutralIssues = validateNeutralWorkbookResourceLimits(document, limits);
  if (neutralIssues.length > 0) return resourceFailures(neutralIssues);

  const meta = sheet(document, '_Meta');
  const metaRow = meta?.rows[0];
  const workbookVersion = metaRow?.workbookFormatVersion;
  const datasetVersion = metaRow?.datasetSchemaVersion;
  const formatId = metaRow?.formatId;

  if (formatId !== CRAFT_BUSINESS_WORKBOOK_FORMAT_ID) {
    return failure({ stage: 'compatibility', code: 'INVALID_FORMAT_ID', message: `Workbook formatId must be ${CRAFT_BUSINESS_WORKBOOK_FORMAT_ID}.`, sheetName: '_Meta' });
  }

  const numericVersionPair =
    typeof workbookVersion === 'number' && typeof datasetVersion === 'number';
  const isFutureVersion =
    numericVersionPair &&
    (workbookVersion > CURRENT_PHYSICAL_WORKBOOK_FORMAT_VERSION || datasetVersion > 2);
  const isMixedPhysicalEnvelope = workbookVersion === 2 && datasetVersion === 1;

  if (isFutureVersion || isMixedPhysicalEnvelope) {
    return failure({
      stage: 'compatibility',
      code: 'UNSUPPORTED_FUTURE_VERSION',
      message: `Workbook version ${String(workbookVersion)}/${String(datasetVersion)} is newer than or incompatible with supported physical workbook version ${CURRENT_PHYSICAL_WORKBOOK_FORMAT_VERSION}/2.`,
      sheetName: '_Meta',
      rowIndex: 0,
      excelRow: 2,
      compatibilityStatus: 'unsupported-future',
      ...(numericVersionPair
        ? {
            sourceVersion: {
              workbookFormatVersion: workbookVersion,
              datasetSchemaVersion: datasetVersion,
            },
          }
        : {}),
      targetVersion: {
        workbookFormatVersion: CURRENT_PHYSICAL_WORKBOOK_FORMAT_VERSION,
        datasetSchemaVersion: 2,
      },
    });
  }

  if (workbookVersion === 1 && datasetVersion === 1) {
    const legacy = importBusinessDatasetFromXlsx(bytes, codec, resourceLimitOverrides);
    if (!legacy.ok) return legacy;
    return {
      ok: true,
      dataset: extendLegacyBusinessDataset(legacy.dataset),
      metadata: legacy.metadata,
    };
  }

  if (workbookVersion !== CURRENT_PHYSICAL_WORKBOOK_FORMAT_VERSION || datasetVersion !== 2) {
    return failure({
      stage: 'compatibility',
      code: 'UNSUPPORTED_WORKBOOK_VERSION',
      message: `Workbook version ${String(workbookVersion)}/${String(datasetVersion)} is not supported. Expected 1/1 or 2/2.`,
      sheetName: '_Meta',
    });
  }

  const expectedNames = [...CANONICAL_WORKBOOK_SHEET_NAMES, PHYSICAL_STORAGE_SHEET_NAME, PHYSICAL_MOLDS_SHEET_NAME];
  const actualNames = document.sheets.map((candidate) => candidate.name);
  if (actualNames.length !== expectedNames.length || expectedNames.some((name) => actualNames.filter((actual) => actual === name).length !== 1)) {
    return failure({ stage: 'schema', code: 'INVALID_SHEET_SET', message: 'Workbook v2 must contain exactly the canonical v1 sheets plus StorageLocations and Molds.' });
  }

  const storage = sheet(document, PHYSICAL_STORAGE_SHEET_NAME)!;
  const molds = sheet(document, PHYSICAL_MOLDS_SHEET_NAME)!;
  const schemaIssues = [
    ...validatePhysicalSheetRows(storage, STORAGE_COLUMNS),
    ...validatePhysicalSheetRows(molds, MOLD_COLUMNS),
  ];
  if (schemaIssues.length > 0) return { ok: false, issues: schemaIssues };

  let legacyBytes: Uint8Array;
  try {
    legacyBytes = codec.encode(legacyDocumentFromV2(document));
  } catch (error) {
    return failure({ stage: 'migration', code: 'V2_BASE_REWRITE_FAILED', message: error instanceof Error ? error.message : 'Could not prepare v2 base sheets for legacy reconstruction.' });
  }

  const legacy = importBusinessDatasetFromXlsx(legacyBytes, codec, resourceLimitOverrides);
  if (!legacy.ok) return legacy;

  const dataset = extendLegacyBusinessDataset(
    legacy.dataset,
    reconstructStorage(storage),
    reconstructMolds(molds),
  );
  const issues = physicalIssues(dataset);
  if (issues.length > 0) return { ok: false, issues };

  const metadata: ImportedWorkbookMetadata = {
    ...legacy.metadata,
    workbookFormatVersion: CURRENT_PHYSICAL_WORKBOOK_FORMAT_VERSION,
    datasetSchemaVersion: 2,
  };

  return { ok: true, dataset, metadata };
}
