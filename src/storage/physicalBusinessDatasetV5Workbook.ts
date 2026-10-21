import type { YieldMoldFormulaSource } from '../domain/yieldMoldFormulaSource';
import {
  PHYSICAL_BUSINESS_DATASET_V5_SCHEMA_VERSION,
  extendPhysicalBusinessDatasetV4,
  toPhysicalBusinessDatasetV4,
  validatePhysicalBusinessDatasetV5Integrity,
  type PhysicalBusinessDatasetV5,
} from '../domain/physicalBusinessDatasetV5';
import {
  PHYSICAL_WORKBOOK_V4_CANONICAL_SHEET_NAMES,
  PHYSICAL_WORKBOOK_V4_FORMAT_VERSION,
  PHYSICAL_WORKBOOK_V4_MIGRATION_STEPS,
  PHYSICAL_WORKBOOK_V4_VERSION_KEY,
  createPhysicalBusinessDatasetV4WorkbookDocument,
  reconstructPhysicalBusinessDatasetV4FromWorkbook,
} from './physicalBusinessDatasetV4Workbook';
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

export const PHYSICAL_WORKBOOK_V5_FORMAT_VERSION = 5 as const;
export const PHYSICAL_WORKBOOK_V5_VERSION_KEY: WorkbookVersionKey =
  Object.freeze({
    workbookFormatVersion: PHYSICAL_WORKBOOK_V5_FORMAT_VERSION,
    datasetSchemaVersion: PHYSICAL_BUSINESS_DATASET_V5_SCHEMA_VERSION,
  });

export const YIELD_MOLD_FORMULA_SOURCES_SHEET_NAME =
  'YieldMoldFormulaSources' as const;

export const YIELD_MOLD_FORMULA_SOURCES_WORKBOOK_COLUMNS = [
  'yieldSampleId',
  'moldId',
  'moldYieldProfileId',
] as const;

export const PHYSICAL_WORKBOOK_V5_CANONICAL_SHEET_NAMES = [
  ...PHYSICAL_WORKBOOK_V4_CANONICAL_SHEET_NAMES,
  YIELD_MOLD_FORMULA_SOURCES_SHEET_NAME,
] as const;

export type PhysicalBusinessDatasetV5WorkbookImportResult =
  | {
      ok: true;
      dataset: PhysicalBusinessDatasetV5;
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

function provenanceRows(
  dataset: PhysicalBusinessDatasetV5,
): Readonly<Record<string, unknown>>[] {
  return [...dataset.yieldMoldFormulaSources]
    .sort(
      (left, right) =>
        canonical(left.yieldSampleId).localeCompare(
          canonical(right.yieldSampleId),
        ) ||
        left.yieldSampleId.localeCompare(right.yieldSampleId) ||
        canonical(left.moldId).localeCompare(canonical(right.moldId)) ||
        left.moldId.localeCompare(right.moldId) ||
        canonical(left.moldYieldProfileId).localeCompare(
          canonical(right.moldYieldProfileId),
        ) ||
        left.moldYieldProfileId.localeCompare(right.moldYieldProfileId),
    )
    .map((source) => ({
      yieldSampleId: source.yieldSampleId,
      moldId: source.moldId,
      moldYieldProfileId: source.moldYieldProfileId,
    }));
}

function migratePhysicalWorkbookV4ToV5(
  document: WorkbookNeutralDocument,
): WorkbookNeutralDocument {
  const migrated = cloneWorkbookNeutralDocument(document);

  if (
    migrated.sheets.some(
      (candidate) =>
        candidate.name === YIELD_MOLD_FORMULA_SOURCES_SHEET_NAME,
    )
  ) {
    throw new Error(
      `Physical workbook v4 already contains reserved sheet ${YIELD_MOLD_FORMULA_SOURCES_SHEET_NAME}.`,
    );
  }

  const meta = sheet(migrated, '_Meta');
  if (!meta || meta.rows.length !== 1) {
    throw new Error('Physical workbook v4 migration requires one _Meta row.');
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
                      workbookFormatVersion:
                        PHYSICAL_WORKBOOK_V5_FORMAT_VERSION,
                      datasetSchemaVersion:
                        PHYSICAL_BUSINESS_DATASET_V5_SCHEMA_VERSION,
                    }
                  : row,
              ),
            }
          : candidate,
      ),
      {
        name: YIELD_MOLD_FORMULA_SOURCES_SHEET_NAME,
        columns: [...YIELD_MOLD_FORMULA_SOURCES_WORKBOOK_COLUMNS],
        rows: [],
      },
    ],
  };
}

export const PHYSICAL_WORKBOOK_V5_MIGRATION_STEPS: readonly WorkbookMigrationStep[] =
  [
    ...PHYSICAL_WORKBOOK_V4_MIGRATION_STEPS,
    {
      from: PHYSICAL_WORKBOOK_V4_VERSION_KEY,
      to: PHYSICAL_WORKBOOK_V5_VERSION_KEY,
      migrate: migratePhysicalWorkbookV4ToV5,
    },
  ];

export const physicalWorkbookV5MigrationRegistry =
  new WorkbookMigrationRegistry(PHYSICAL_WORKBOOK_V5_MIGRATION_STEPS);

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

function validateProvenanceSheet(
  value: WorkbookNeutralSheet,
): BusinessDatasetWorkbookImportIssue[] {
  if (
    !sameColumns(
      value.columns,
      YIELD_MOLD_FORMULA_SOURCES_WORKBOOK_COLUMNS,
    )
  ) {
    return [
      {
        stage: 'schema',
        code: 'INVALID_COLUMNS',
        message:
          `${YIELD_MOLD_FORMULA_SOURCES_SHEET_NAME} columns must exactly match ` +
          YIELD_MOLD_FORMULA_SOURCES_WORKBOOK_COLUMNS.join(', ') +
          '.',
        sheetName: YIELD_MOLD_FORMULA_SOURCES_SHEET_NAME,
      },
    ];
  }

  const issues: BusinessDatasetWorkbookImportIssue[] = [];

  value.rows.forEach((row, rowIndex) => {
    for (const column of YIELD_MOLD_FORMULA_SOURCES_WORKBOOK_COLUMNS) {
      const cell = row[column];
      if (typeof cell !== 'string' || !cell.trim()) {
        issues.push({
          stage: 'schema',
          code: 'INVALID_REQUIRED_TEXT',
          message:
            `${YIELD_MOLD_FORMULA_SOURCES_SHEET_NAME}.${column} must be nonblank text.`,
          sheetName: YIELD_MOLD_FORMULA_SOURCES_SHEET_NAME,
          rowIndex,
          excelRow: rowIndex + 2,
          column,
        });
      }
    }
  });

  return issues;
}

function reconstructProvenance(
  value: WorkbookNeutralSheet,
): YieldMoldFormulaSource[] {
  return value.rows.map((row) => ({
    yieldSampleId: row.yieldSampleId as string,
    moldId: row.moldId as string,
    moldYieldProfileId: row.moldYieldProfileId as string,
  }));
}

function projectPhysicalV5ToV4(
  document: WorkbookNeutralDocument,
): WorkbookNeutralDocument {
  return {
    sheets: document.sheets
      .filter(
        (candidate) =>
          candidate.name !== YIELD_MOLD_FORMULA_SOURCES_SHEET_NAME,
      )
      .map((candidate) =>
        candidate.name === '_Meta'
          ? {
              ...candidate,
              rows: candidate.rows.map((row, index) =>
                index === 0
                  ? {
                      ...row,
                      workbookFormatVersion:
                        PHYSICAL_WORKBOOK_V4_FORMAT_VERSION,
                      datasetSchemaVersion: 4,
                    }
                  : row,
              ),
            }
          : candidate,
      ),
  };
}

export function createPhysicalBusinessDatasetV5WorkbookDocument(
  dataset: PhysicalBusinessDatasetV5,
  metadata: WorkbookExportMetadata,
): WorkbookNeutralDocument {
  const validation = validatePhysicalBusinessDatasetV5Integrity(dataset);
  if (!validation.valid) {
    throw new Error(
      `Physical business dataset v5 export rejected with ${validation.issues.length} validation issue(s): ${validation.issues[0]?.message ?? 'unknown issue'}`,
    );
  }

  const base = createPhysicalBusinessDatasetV4WorkbookDocument(
    toPhysicalBusinessDatasetV4(dataset),
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
                      workbookFormatVersion:
                        PHYSICAL_WORKBOOK_V5_FORMAT_VERSION,
                      datasetSchemaVersion:
                        PHYSICAL_BUSINESS_DATASET_V5_SCHEMA_VERSION,
                    }
                  : row,
              ),
            }
          : candidate,
      ),
      {
        name: YIELD_MOLD_FORMULA_SOURCES_SHEET_NAME,
        columns: [...YIELD_MOLD_FORMULA_SOURCES_WORKBOOK_COLUMNS],
        rows: provenanceRows(dataset),
      },
    ],
  };
}

export function exportPhysicalBusinessDatasetV5ToXlsx(
  dataset: PhysicalBusinessDatasetV5,
  metadata: WorkbookExportMetadata,
  codec: WorkbookCodec,
): Uint8Array {
  return codec.encode(
    createPhysicalBusinessDatasetV5WorkbookDocument(dataset, metadata),
  );
}

export function reconstructPhysicalBusinessDatasetV5FromWorkbook(
  document: WorkbookNeutralDocument,
): PhysicalBusinessDatasetV5WorkbookImportResult {
  const actualNames = document.sheets.map((candidate) => candidate.name);
  const expectedNames = [...PHYSICAL_WORKBOOK_V5_CANONICAL_SHEET_NAMES];

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
            'Physical workbook v5 must contain the canonical physical v4 sheets followed by YieldMoldFormulaSources.',
        },
      ],
    };
  }

  const meta = sheet(document, '_Meta')!;
  const metaRow = meta.rows[0];
  if (
    metaRow?.formatId !== CRAFT_BUSINESS_WORKBOOK_FORMAT_ID ||
    metaRow?.workbookFormatVersion !==
      PHYSICAL_WORKBOOK_V5_FORMAT_VERSION ||
    metaRow?.datasetSchemaVersion !==
      PHYSICAL_BUSINESS_DATASET_V5_SCHEMA_VERSION
  ) {
    return {
      ok: false,
      issues: [
        {
          stage: 'compatibility',
          code: 'INVALID_PHYSICAL_V5_METADATA',
          message:
            'Physical workbook v5 metadata must identify workbook 5 / dataset 5.',
          sheetName: '_Meta',
          rowIndex: 0,
          excelRow: 2,
        },
      ],
    };
  }

  const provenance = sheet(
    document,
    YIELD_MOLD_FORMULA_SOURCES_SHEET_NAME,
  )!;
  const provenanceSchemaIssues = validateProvenanceSheet(provenance);
  if (provenanceSchemaIssues.length > 0) {
    return { ok: false, issues: provenanceSchemaIssues };
  }

  const base = reconstructPhysicalBusinessDatasetV4FromWorkbook(
    projectPhysicalV5ToV4(document),
  );
  if (!base.ok) return base;

  const dataset = extendPhysicalBusinessDatasetV4(
    base.dataset,
    reconstructProvenance(provenance),
  );

  const validation = validatePhysicalBusinessDatasetV5Integrity(dataset);
  if (!validation.valid) {
    return {
      ok: false,
      issues: validation.issues.map((issue) => ({
        stage: 'dataset',
        code: issue.code,
        message: issue.message,
        path: issue.path,
        sheetName: issue.path.startsWith('yieldMoldFormulaSources')
          ? YIELD_MOLD_FORMULA_SOURCES_SHEET_NAME
          : undefined,
      })),
    };
  }

  return {
    ok: true,
    dataset,
    metadata: {
      ...base.metadata,
      workbookFormatVersion: PHYSICAL_WORKBOOK_V5_FORMAT_VERSION,
      datasetSchemaVersion: PHYSICAL_BUSINESS_DATASET_V5_SCHEMA_VERSION,
    },
  };
}

export function importPhysicalBusinessDatasetV5FromXlsx(
  bytes: WorkbookBinaryInput,
  codec: WorkbookCodec,
  resourceLimitOverrides: Partial<WorkbookResourceLimits> = {},
): PhysicalBusinessDatasetV5WorkbookImportResult {
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
    physicalWorkbookV5MigrationRegistry,
    PHYSICAL_WORKBOOK_V5_VERSION_KEY,
  );
  if (!prepared.ok) {
    return { ok: false, issues: mapPreparationIssues(prepared.issues) };
  }

  return reconstructPhysicalBusinessDatasetV5FromWorkbook(prepared.document);
}
