import {
  CURRENT_WORKBOOK_VERSION_KEY,
  classifyWorkbookCompatibility,
  cloneWorkbookNeutralDocument,
  preflightWorkbookVersion,
  productionWorkbookMigrationRegistry,
  type WorkbookMigrationRegistry,
  type WorkbookVersionKey,
  type WorkbookVersionPreflightIssueCode,
} from './workbookCompatibility';
import type { WorkbookNeutralDocument } from './workbookSchema';

export type WorkbookCurrentImportPreparationIssueStage =
  | 'preflight'
  | 'compatibility'
  | 'migration';

export type WorkbookCurrentImportPreparationIssueCode =
  | WorkbookVersionPreflightIssueCode
  | 'INVALID_NEUTRAL_WORKBOOK_DOCUMENT'
  | 'UNSUPPORTED_FUTURE_VERSION'
  | 'MIGRATION_PATH_NOT_FOUND'
  | 'MIGRATION_STEP_FAILED'
  | 'MIGRATION_OUTPUT_INVALID'
  | 'MIGRATION_OUTPUT_FORMAT_ID_MISMATCH'
  | 'MIGRATION_OUTPUT_VERSION_MISMATCH';

export type WorkbookCompatibilityStatus =
  | 'unsupported-older'
  | 'unsupported-future';

export interface WorkbookCurrentImportPreparationIssue {
  readonly stage: WorkbookCurrentImportPreparationIssueStage;
  readonly code: WorkbookCurrentImportPreparationIssueCode;
  readonly message: string;
  readonly input?: unknown;
  readonly compatibilityStatus?: WorkbookCompatibilityStatus;
  readonly sourceVersion?: WorkbookVersionKey;
  readonly targetVersion?: WorkbookVersionKey;
  readonly stepIndex?: number;
  readonly causeValue?: unknown;
}

export type WorkbookCurrentImportPreparationResult =
  | {
      readonly ok: true;
      readonly document: WorkbookNeutralDocument;
      readonly migrated: boolean;
      readonly sourceVersion: WorkbookVersionKey;
      readonly targetVersion: WorkbookVersionKey;
    }
  | {
      readonly ok: false;
      readonly issues: readonly WorkbookCurrentImportPreparationIssue[];
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasNeutralWorkbookShape(value: unknown): value is WorkbookNeutralDocument {
  if (!isRecord(value) || !Array.isArray(value.sheets)) return false;

  return value.sheets.every(
    (sheet) =>
      isRecord(sheet) &&
      typeof sheet.name === 'string' &&
      Array.isArray(sheet.columns) &&
      sheet.columns.every((column) => typeof column === 'string') &&
      Array.isArray(sheet.rows) &&
      sheet.rows.every(isRecord),
  );
}

function cloneVersion(key: WorkbookVersionKey): WorkbookVersionKey {
  return {
    workbookFormatVersion: key.workbookFormatVersion,
    datasetSchemaVersion: key.datasetSchemaVersion,
  };
}

function sameVersion(left: WorkbookVersionKey, right: WorkbookVersionKey): boolean {
  return (
    left.workbookFormatVersion === right.workbookFormatVersion &&
    left.datasetSchemaVersion === right.datasetSchemaVersion
  );
}

function versionLabel(key: WorkbookVersionKey): string {
  return `workbook v${key.workbookFormatVersion} / dataset v${key.datasetSchemaVersion}`;
}

function structuralFailure(
  input: unknown,
  sourceVersion?: WorkbookVersionKey,
  targetVersion?: WorkbookVersionKey,
  stepIndex?: number,
): WorkbookCurrentImportPreparationResult {
  return {
    ok: false,
    issues: [
      {
        stage: stepIndex === undefined ? 'preflight' : 'migration',
        code: stepIndex === undefined
          ? 'INVALID_NEUTRAL_WORKBOOK_DOCUMENT'
          : 'MIGRATION_OUTPUT_INVALID',
        message:
          stepIndex === undefined
            ? 'Decoded workbook is not a structurally valid neutral workbook document.'
            : `Migration step ${stepIndex + 1} returned an invalid neutral workbook document.`,
        input,
        sourceVersion,
        targetVersion,
        stepIndex,
      },
    ],
  };
}

/**
 * Prepares a decoded neutral workbook for the existing strict current-form importer.
 *
 * Production defaults target the public current version pair and the production registry.
 * Tests may supply isolated synthetic targets/registries without changing product constants.
 */
export function prepareWorkbookForCurrentImport(
  input: unknown,
  registry: WorkbookMigrationRegistry = productionWorkbookMigrationRegistry,
  target: WorkbookVersionKey = CURRENT_WORKBOOK_VERSION_KEY,
): WorkbookCurrentImportPreparationResult {
  const classification = classifyWorkbookCompatibility(input, registry, target);
  const ownedTarget = cloneVersion(target);

  if (classification.status === 'invalid') {
    return {
      ok: false,
      issues: classification.issues.map((issue) => ({
        stage: 'preflight' as const,
        code: issue.code,
        message: issue.message,
        input: issue.input,
        targetVersion: ownedTarget,
      })),
    };
  }

  if (classification.status === 'unsupported-future') {
    return {
      ok: false,
      issues: [
        {
          stage: 'compatibility',
          code: 'UNSUPPORTED_FUTURE_VERSION',
          message: `${versionLabel(classification.version)} is newer than supported target ${versionLabel(classification.target)}.`,
          compatibilityStatus: 'unsupported-future',
          sourceVersion: cloneVersion(classification.version),
          targetVersion: cloneVersion(classification.target),
        },
      ],
    };
  }

  if (classification.status === 'unsupported-older') {
    return {
      ok: false,
      issues: [
        {
          stage: 'compatibility',
          code: 'MIGRATION_PATH_NOT_FOUND',
          message: `${versionLabel(classification.version)} is non-current and has no registered migration path to ${versionLabel(classification.target)}.`,
          compatibilityStatus: 'unsupported-older',
          sourceVersion: cloneVersion(classification.version),
          targetVersion: cloneVersion(classification.target),
        },
      ],
    };
  }

  if (!hasNeutralWorkbookShape(input)) {
    return structuralFailure(input, classification.version, ownedTarget);
  }

  if (classification.status === 'current') {
    return {
      ok: true,
      document: cloneWorkbookNeutralDocument(input),
      migrated: false,
      sourceVersion: cloneVersion(classification.version),
      targetVersion: ownedTarget,
    };
  }

  const sourceVersion = cloneVersion(classification.version);
  let currentDocument = cloneWorkbookNeutralDocument(input);

  for (const [stepIndex, step] of classification.path.entries()) {
    const ownedStepInput = cloneWorkbookNeutralDocument(currentDocument);
    let output: unknown;

    try {
      output = step.migrate(ownedStepInput);
    } catch (error) {
      return {
        ok: false,
        issues: [
          {
            stage: 'migration',
            code: 'MIGRATION_STEP_FAILED',
            message: `Migration step ${stepIndex + 1} (${versionLabel(step.from)} -> ${versionLabel(step.to)}) failed.`,
            sourceVersion: cloneVersion(step.from),
            targetVersion: cloneVersion(step.to),
            stepIndex,
            causeValue: error,
          },
        ],
      };
    }

    if (!hasNeutralWorkbookShape(output)) {
      return structuralFailure(output, step.from, step.to, stepIndex);
    }

    const outputPreflight = preflightWorkbookVersion(output);
    if (!outputPreflight.ok) {
      const formatMismatch = outputPreflight.issues.some(
        (issue) => issue.code === 'INVALID_FORMAT_ID',
      );
      return {
        ok: false,
        issues: [
          {
            stage: 'migration',
            code: formatMismatch
              ? 'MIGRATION_OUTPUT_FORMAT_ID_MISMATCH'
              : 'MIGRATION_OUTPUT_INVALID',
            message: formatMismatch
              ? `Migration step ${stepIndex + 1} changed the workbook format identity.`
              : `Migration step ${stepIndex + 1} returned invalid version metadata.`,
            input: outputPreflight.issues,
            sourceVersion: cloneVersion(step.from),
            targetVersion: cloneVersion(step.to),
            stepIndex,
          },
        ],
      };
    }

    const outputVersion: WorkbookVersionKey = {
      workbookFormatVersion: outputPreflight.metadata.workbookFormatVersion,
      datasetSchemaVersion: outputPreflight.metadata.datasetSchemaVersion,
    };

    if (!sameVersion(outputVersion, step.to)) {
      return {
        ok: false,
        issues: [
          {
            stage: 'migration',
            code: 'MIGRATION_OUTPUT_VERSION_MISMATCH',
            message: `Migration step ${stepIndex + 1} declared target ${versionLabel(step.to)} but returned ${versionLabel(outputVersion)}.`,
            input: outputVersion,
            sourceVersion: cloneVersion(step.from),
            targetVersion: cloneVersion(step.to),
            stepIndex,
          },
        ],
      };
    }

    currentDocument = cloneWorkbookNeutralDocument(output);
  }

  const finalPreflight = preflightWorkbookVersion(currentDocument);
  if (!finalPreflight.ok) {
    return {
      ok: false,
      issues: [
        {
          stage: 'migration',
          code: 'MIGRATION_OUTPUT_INVALID',
          message: 'Completed migration chain did not produce valid authoritative version metadata.',
          input: finalPreflight.issues,
          sourceVersion,
          targetVersion: ownedTarget,
        },
      ],
    };
  }

  const finalVersion: WorkbookVersionKey = {
    workbookFormatVersion: finalPreflight.metadata.workbookFormatVersion,
    datasetSchemaVersion: finalPreflight.metadata.datasetSchemaVersion,
  };

  if (!sameVersion(finalVersion, ownedTarget)) {
    return {
      ok: false,
      issues: [
        {
          stage: 'migration',
          code: 'MIGRATION_OUTPUT_VERSION_MISMATCH',
          message: `Migration chain finished at ${versionLabel(finalVersion)} instead of ${versionLabel(ownedTarget)}.`,
          input: finalVersion,
          sourceVersion,
          targetVersion: ownedTarget,
        },
      ],
    };
  }

  return {
    ok: true,
    document: cloneWorkbookNeutralDocument(currentDocument),
    migrated: true,
    sourceVersion,
    targetVersion: ownedTarget,
  };
}
