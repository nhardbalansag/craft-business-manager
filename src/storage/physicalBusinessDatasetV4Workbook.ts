import type { PlasterMoldYieldProfile } from '../domain/plasterMoldYieldProfiles';
import {
  PHYSICAL_BUSINESS_DATASET_V4_SCHEMA_VERSION,
  extendPhysicalBusinessDatasetV3,
  toPhysicalBusinessDatasetV3,
  validatePhysicalBusinessDatasetV4Integrity,
  type PhysicalBusinessDatasetV4,
} from '../domain/physicalBusinessDatasetV4';
import {
  PHYSICAL_WORKBOOK_V3_CANONICAL_SHEET_NAMES,
  PHYSICAL_WORKBOOK_V3_FORMAT_VERSION,
  PHYSICAL_WORKBOOK_V3_MIGRATION_STEPS,
  PHYSICAL_WORKBOOK_V3_VERSION_KEY,
  createPhysicalBusinessDatasetV3WorkbookDocument,
  reconstructPhysicalBusinessDatasetV3FromWorkbook,
} from './physicalBusinessDatasetV3Workbook';
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

export const PHYSICAL_WORKBOOK_V4_FORMAT_VERSION = 4 as const;
export const PHYSICAL_WORKBOOK_V4_VERSION_KEY: WorkbookVersionKey =
  Object.freeze({
    workbookFormatVersion: PHYSICAL_WORKBOOK_V4_FORMAT_VERSION,
    datasetSchemaVersion: PHYSICAL_BUSINESS_DATASET_V4_SCHEMA_VERSION,
  });

export const PLASTER_MOLD_YIELD_PROFILES_SHEET_NAME =
  'PlasterMoldYieldProfiles' as const;

export const PLASTER_MOLD_YIELD_PROFILES_WORKBOOK_COLUMNS = [
  'id',
  'moldId',
  'waterMaterialId',
  'plasterMaterialId',
  'glueMaterialId',
  'waterFillWeightGrams',
  'waterAdjustmentRate',
  'plasterFactor',
  'glueFactor',
  'piecesPerPour',
  'notes',
  'isActive',
] as const;

export const PHYSICAL_WORKBOOK_V4_CANONICAL_SHEET_NAMES = [
  ...PHYSICAL_WORKBOOK_V3_CANONICAL_SHEET_NAMES,
  PLASTER_MOLD_YIELD_PROFILES_SHEET_NAME,
] as const;

export type PhysicalBusinessDatasetV4WorkbookImportResult =
  | {
      ok: true;
      dataset: PhysicalBusinessDatasetV4;
      metadata: ImportedWorkbookMetadata;
    }
  | {
      ok: false;
      issues: readonly BusinessDatasetWorkbookImportIssue[];
    };

function canonical(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function sheet(
  document: WorkbookNeutralDocument,
  name: string,
): WorkbookNeutralSheet | undefined {
  return document.sheets.find((candidate) => candidate.name === name);
}

function profileRows(
  dataset: PhysicalBusinessDatasetV4,
): Readonly<Record<string, unknown>>[] {
  return [...dataset.plasterMoldYieldProfiles]
    .sort(
      (left, right) =>
        canonical(left.id).localeCompare(canonical(right.id)) ||
        left.id.localeCompare(right.id),
    )
    .map((profile) => ({
      id: profile.id,
      moldId: profile.moldId,
      waterMaterialId: profile.waterMaterialId,
      plasterMaterialId: profile.plasterMaterialId,
      glueMaterialId: profile.glueMaterialId,
      waterFillWeightGrams: profile.waterFillWeightGrams,
      waterAdjustmentRate: profile.waterAdjustmentRate,
      plasterFactor: profile.plasterFactor,
      glueFactor: profile.glueFactor,
      piecesPerPour: profile.piecesPerPour,
      notes: profile.notes,
      isActive: profile.isActive,
    }));
}

function migratePhysicalWorkbookV3ToV4(
  document: WorkbookNeutralDocument,
): WorkbookNeutralDocument {
  const migrated = cloneWorkbookNeutralDocument(document);

  if (
    migrated.sheets.some(
      (candidate) => candidate.name === PLASTER_MOLD_YIELD_PROFILES_SHEET_NAME,
    )
  ) {
    throw new Error(
      `Physical workbook v3 already contains reserved sheet ${PLASTER_MOLD_YIELD_PROFILES_SHEET_NAME}.`,
    );
  }

  const meta = sheet(migrated, '_Meta');
  if (!meta || meta.rows.length !== 1) {
    throw new Error('Physical workbook v3 migration requires one _Meta row.');
  }

  return {
    sheets: [
      ...migrated.sheets.map((candidate) =>
        candidate.name === '_Meta'
          ? {
              ...candidate,
              rows: candidate.rows.map((row, index) =>
                index === 0
                  ? {
                      ...row,
                      workbookFormatVersion: PHYSICAL_WORKBOOK_V4_FORMAT_VERSION,
                      datasetSchemaVersion:
                        PHYSICAL_BUSINESS_DATASET_V4_SCHEMA_VERSION,
                    }
                  : row,
              ),
            }
          : candidate,
      ),
      {
        name: PLASTER_MOLD_YIELD_PROFILES_SHEET_NAME,
        columns: [...PLASTER_MOLD_YIELD_PROFILES_WORKBOOK_COLUMNS],
        rows: [],
      },
    ],
  };
}

export const PHYSICAL_WORKBOOK_V4_MIGRATION_STEPS: readonly WorkbookMigrationStep[] =
  [
    ...PHYSICAL_WORKBOOK_V3_MIGRATION_STEPS,
    {
      from: PHYSICAL_WORKBOOK_V3_VERSION_KEY,
      to: PHYSICAL_WORKBOOK_V4_VERSION_KEY,
      migrate: migratePhysicalWorkbookV3ToV4,
    },
  ];

export const physicalWorkbookV4MigrationRegistry =
  new WorkbookMigrationRegistry(PHYSICAL_WORKBOOK_V4_MIGRATION_STEPS);

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

function validateProfileSheet(
  value: WorkbookNeutralSheet,
): BusinessDatasetWorkbookImportIssue[] {
  const issues: BusinessDatasetWorkbookImportIssue[] = [];
  if (!sameColumns(value.columns, PLASTER_MOLD_YIELD_PROFILES_WORKBOOK_COLUMNS)) {
    return [
      {
        stage: 'schema',
        code: 'INVALID_COLUMNS',
        message:
          `${PLASTER_MOLD_YIELD_PROFILES_SHEET_NAME} columns must exactly match ` +
          PLASTER_MOLD_YIELD_PROFILES_WORKBOOK_COLUMNS.join(', ') +
          '.',
        sheetName: PLASTER_MOLD_YIELD_PROFILES_SHEET_NAME,
      },
    ];
  }

  const requiredText = new Set([
    'id',
    'moldId',
    'waterMaterialId',
    'plasterMaterialId',
    'glueMaterialId',
  ]);
  const numeric = new Set([
    'waterFillWeightGrams',
    'waterAdjustmentRate',
    'plasterFactor',
    'glueFactor',
    'piecesPerPour',
  ]);

  value.rows.forEach((row, rowIndex) => {
    for (const column of PLASTER_MOLD_YIELD_PROFILES_WORKBOOK_COLUMNS) {
      const cell = row[column];

      if (requiredText.has(column)) {
        if (typeof cell !== 'string' || !cell.trim()) {
          issues.push({
            stage: 'schema',
            code: 'INVALID_REQUIRED_TEXT',
            message: `${PLASTER_MOLD_YIELD_PROFILES_SHEET_NAME}.${column} must be nonblank text.`,
            sheetName: PLASTER_MOLD_YIELD_PROFILES_SHEET_NAME,
            rowIndex,
            excelRow: rowIndex + 2,
            column,
          });
        }
        continue;
      }

      if (numeric.has(column)) {
        if (typeof cell !== 'number' || !Number.isFinite(cell)) {
          issues.push({
            stage: 'schema',
            code: 'INVALID_CELL_TYPE',
            message: `${PLASTER_MOLD_YIELD_PROFILES_SHEET_NAME}.${column} must be a finite number.`,
            sheetName: PLASTER_MOLD_YIELD_PROFILES_SHEET_NAME,
            rowIndex,
            excelRow: rowIndex + 2,
            column,
          });
        }
        continue;
      }

      if (column === 'notes') {
        if (
          cell !== undefined &&
          cell !== null &&
          typeof cell !== 'string'
        ) {
          issues.push({
            stage: 'schema',
            code: 'INVALID_CELL_TYPE',
            message: `${PLASTER_MOLD_YIELD_PROFILES_SHEET_NAME}.notes must be text when provided.`,
            sheetName: PLASTER_MOLD_YIELD_PROFILES_SHEET_NAME,
            rowIndex,
            excelRow: rowIndex + 2,
            column,
          });
        }
        continue;
      }

      if (column === 'isActive' && typeof cell !== 'boolean') {
        issues.push({
          stage: 'schema',
          code: 'INVALID_CELL_TYPE',
          message: `${PLASTER_MOLD_YIELD_PROFILES_SHEET_NAME}.isActive must be boolean.`,
          sheetName: PLASTER_MOLD_YIELD_PROFILES_SHEET_NAME,
          rowIndex,
          excelRow: rowIndex + 2,
          column,
        });
      }
    }
  });

  return issues;
}

function reconstructProfiles(
  value: WorkbookNeutralSheet,
): PlasterMoldYieldProfile[] {
  return value.rows.map((row) => {
    const profile: PlasterMoldYieldProfile = {
      id: row.id as string,
      moldId: row.moldId as string,
      waterMaterialId: row.waterMaterialId as string,
      plasterMaterialId: row.plasterMaterialId as string,
      glueMaterialId: row.glueMaterialId as string,
      waterFillWeightGrams: row.waterFillWeightGrams as number,
      waterAdjustmentRate: row.waterAdjustmentRate as number,
      plasterFactor: row.plasterFactor as number,
      glueFactor: row.glueFactor as number,
      piecesPerPour: row.piecesPerPour as number,
      isActive: row.isActive as boolean,
    };

    if (typeof row.notes === 'string' && row.notes.trim()) {
      profile.notes = row.notes;
    }
    return profile;
  });
}

function projectPhysicalV4ToV3(
  document: WorkbookNeutralDocument,
): WorkbookNeutralDocument {
  return {
    sheets: document.sheets
      .filter(
        (candidate) =>
          candidate.name !== PLASTER_MOLD_YIELD_PROFILES_SHEET_NAME,
      )
      .map((candidate) =>
        candidate.name === '_Meta'
          ? {
              ...candidate,
              rows: candidate.rows.map((row, index) =>
                index === 0
                  ? {
                      ...row,
                      workbookFormatVersion: PHYSICAL_WORKBOOK_V3_FORMAT_VERSION,
                      datasetSchemaVersion: 3,
                    }
                  : row,
              ),
            }
          : candidate,
      ),
  };
}

export function createPhysicalBusinessDatasetV4WorkbookDocument(
  dataset: PhysicalBusinessDatasetV4,
  metadata: WorkbookExportMetadata,
): WorkbookNeutralDocument {
  const validation = validatePhysicalBusinessDatasetV4Integrity(dataset);
  if (!validation.valid) {
    throw new Error(
      `Physical business dataset v4 export rejected with ${validation.issues.length} validation issue(s): ${validation.issues[0]?.message ?? 'unknown issue'}`,
    );
  }

  const base = createPhysicalBusinessDatasetV3WorkbookDocument(
    toPhysicalBusinessDatasetV3(dataset),
    metadata,
  );

  return {
    sheets: [
      ...base.sheets.map((candidate) =>
        candidate.name === '_Meta'
          ? {
              ...candidate,
              rows: candidate.rows.map((row, index) =>
                index === 0
                  ? {
                      ...row,
                      workbookFormatVersion: PHYSICAL_WORKBOOK_V4_FORMAT_VERSION,
                      datasetSchemaVersion:
                        PHYSICAL_BUSINESS_DATASET_V4_SCHEMA_VERSION,
                    }
                  : row,
              ),
            }
          : candidate,
      ),
      {
        name: PLASTER_MOLD_YIELD_PROFILES_SHEET_NAME,
        columns: [...PLASTER_MOLD_YIELD_PROFILES_WORKBOOK_COLUMNS],
        rows: profileRows(dataset),
      },
    ],
  };
}

export function exportPhysicalBusinessDatasetV4ToXlsx(
  dataset: PhysicalBusinessDatasetV4,
  metadata: WorkbookExportMetadata,
  codec: WorkbookCodec,
): Uint8Array {
  return codec.encode(
    createPhysicalBusinessDatasetV4WorkbookDocument(dataset, metadata),
  );
}

export function reconstructPhysicalBusinessDatasetV4FromWorkbook(
  document: WorkbookNeutralDocument,
): PhysicalBusinessDatasetV4WorkbookImportResult {
  const actualNames = document.sheets.map((candidate) => candidate.name);
  const expectedNames = [...PHYSICAL_WORKBOOK_V4_CANONICAL_SHEET_NAMES];

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
            'Physical workbook v4 must contain the canonical physical v3 sheets followed by PlasterMoldYieldProfiles.',
        },
      ],
    };
  }

  const meta = sheet(document, '_Meta')!;
  const metaRow = meta.rows[0];
  if (
    metaRow?.formatId !== CRAFT_BUSINESS_WORKBOOK_FORMAT_ID ||
    metaRow?.workbookFormatVersion !== PHYSICAL_WORKBOOK_V4_FORMAT_VERSION ||
    metaRow?.datasetSchemaVersion !==
      PHYSICAL_BUSINESS_DATASET_V4_SCHEMA_VERSION
  ) {
    return {
      ok: false,
      issues: [
        {
          stage: 'compatibility',
          code: 'INVALID_PHYSICAL_V4_METADATA',
          message:
            'Physical workbook v4 metadata must identify workbook 4 / dataset 4.',
          sheetName: '_Meta',
          rowIndex: 0,
          excelRow: 2,
        },
      ],
    };
  }

  const profiles = sheet(document, PLASTER_MOLD_YIELD_PROFILES_SHEET_NAME)!;
  const profileSchemaIssues = validateProfileSheet(profiles);
  if (profileSchemaIssues.length > 0) {
    return { ok: false, issues: profileSchemaIssues };
  }

  const base = reconstructPhysicalBusinessDatasetV3FromWorkbook(
    projectPhysicalV4ToV3(document),
  );
  if (!base.ok) return base;

  const dataset = extendPhysicalBusinessDatasetV3(
    base.dataset,
    reconstructProfiles(profiles),
  );

  const validation = validatePhysicalBusinessDatasetV4Integrity(dataset);
  if (!validation.valid) {
    return {
      ok: false,
      issues: validation.issues.map((issue) => ({
        stage: 'dataset',
        code: issue.code,
        message: issue.message,
        path: issue.path,
        sheetName: issue.path.startsWith('plasterMoldYieldProfiles')
          ? PLASTER_MOLD_YIELD_PROFILES_SHEET_NAME
          : undefined,
      })),
    };
  }

  return {
    ok: true,
    dataset,
    metadata: {
      ...base.metadata,
      workbookFormatVersion: PHYSICAL_WORKBOOK_V4_FORMAT_VERSION,
      datasetSchemaVersion: PHYSICAL_BUSINESS_DATASET_V4_SCHEMA_VERSION,
    },
  };
}

export function importPhysicalBusinessDatasetV4FromXlsx(
  bytes: WorkbookBinaryInput,
  codec: WorkbookCodec,
  resourceLimitOverrides: Partial<WorkbookResourceLimits> = {},
): PhysicalBusinessDatasetV4WorkbookImportResult {
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
    physicalWorkbookV4MigrationRegistry,
    PHYSICAL_WORKBOOK_V4_VERSION_KEY,
  );
  if (!prepared.ok) {
    return { ok: false, issues: mapPreparationIssues(prepared.issues) };
  }

  return reconstructPhysicalBusinessDatasetV4FromWorkbook(prepared.document);
}
