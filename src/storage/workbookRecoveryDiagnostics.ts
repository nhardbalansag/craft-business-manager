import type {
  BusinessDatasetWorkbookImportIssue,
  BusinessDatasetWorkbookImportIssueStage,
} from './businessDatasetWorkbookImport';

export const WORKBOOK_RECOVERY_CATEGORIES = [
  'resource-limit',
  'unreadable-or-corrupt-workbook',
  'unsupported-or-incompatible-version',
  'workbook-structure',
  'invalid-workbook-values',
  'invalid-business-data',
  'unexpected-import-failure',
] as const;

export type WorkbookRecoveryCategory = (typeof WORKBOOK_RECOVERY_CATEGORIES)[number];

export const WORKBOOK_RECOVERY_ACTION_CODES = [
  'select-another-file',
  'restore-known-good-backup',
  'reduce-workbook-size',
  'open-with-compatible-or-newer-app',
  'repair-workbook-structure',
  'correct-source-data',
  'retry-or-report-unexpected-error',
] as const;

export type WorkbookRecoveryActionCode = (typeof WORKBOOK_RECOVERY_ACTION_CODES)[number];

export const WORKBOOK_IMPORT_ISSUE_STAGES = [
  'resource-limit',
  'codec',
  'compatibility',
  'migration',
  'schema',
  'metadata',
  'reconstruction',
  'dataset',
] as const satisfies readonly BusinessDatasetWorkbookImportIssueStage[];

export interface WorkbookImportRecoverySummary {
  readonly primaryCategory: WorkbookRecoveryCategory;
  readonly recommendedActions: readonly WorkbookRecoveryActionCode[];
  readonly issueCount: number;
  readonly stageCounts: Readonly<Record<BusinessDatasetWorkbookImportIssueStage, number>>;
  readonly categoryCounts: Readonly<Record<WorkbookRecoveryCategory, number>>;
  readonly backupRestoreRecommended: boolean;
  readonly liveStateChanged: false;
}

const CATEGORY_PRECEDENCE = new Map<WorkbookRecoveryCategory, number>(
  WORKBOOK_RECOVERY_CATEGORIES.map((category, index) => [category, index]),
);

const VERSION_OR_COMPATIBILITY_CODES = new Set<string>([
  'INVALID_FORMAT_ID',
  'INVALID_WORKBOOK_FORMAT_VERSION',
  'INVALID_DATASET_SCHEMA_VERSION',
  'INVALID_DATASET_SCHEMA_VERSION_SHAPE',
  'UNSUPPORTED_DATASET_SCHEMA_VERSION',
  'UNSUPPORTED_CURRENT_VERSION',
  'UNSUPPORTED_FUTURE_VERSION',
  'MIGRATION_PATH_NOT_FOUND',
]);

const STRUCTURE_CODES = new Set<string>([
  'INVALID_DOCUMENT',
  'INVALID_NEUTRAL_WORKBOOK_DOCUMENT',
  'INVALID_WORKBOOK_SCHEMA',
  'MISSING_META_SHEET',
  'DUPLICATE_META_SHEET',
  'INVALID_META_ROW_COUNT',
  'INVALID_META_ROW',
  'DUPLICATE_SHEET',
  'MISSING_REQUIRED_SHEET',
  'MISSING_REQUIRED_COLUMN',
  'DUPLICATE_COLUMN',
  'INVALID_COLUMN_ORDER',
]);

const UNEXPECTED_OPERATIONAL_CODES = new Set<string>([
  'MIGRATION_STEP_FAILED',
  'MIGRATION_OUTPUT_INVALID',
  'MIGRATION_OUTPUT_FORMAT_ID_MISMATCH',
  'MIGRATION_OUTPUT_VERSION_MISMATCH',
  'RECONSTRUCTION_FAILED',
]);

const ACTIONS_BY_CATEGORY: Readonly<
  Record<WorkbookRecoveryCategory, readonly WorkbookRecoveryActionCode[]>
> = Object.freeze({
  'resource-limit': Object.freeze(['reduce-workbook-size', 'select-another-file']),
  'unreadable-or-corrupt-workbook': Object.freeze([
    'select-another-file',
    'restore-known-good-backup',
  ]),
  'unsupported-or-incompatible-version': Object.freeze([
    'open-with-compatible-or-newer-app',
    'select-another-file',
  ]),
  'workbook-structure': Object.freeze([
    'repair-workbook-structure',
    'restore-known-good-backup',
    'select-another-file',
  ]),
  'invalid-workbook-values': Object.freeze([
    'correct-source-data',
    'restore-known-good-backup',
  ]),
  'invalid-business-data': Object.freeze(['correct-source-data']),
  'unexpected-import-failure': Object.freeze(['retry-or-report-unexpected-error']),
});

function emptyStageCounts(): Record<BusinessDatasetWorkbookImportIssueStage, number> {
  return {
    'resource-limit': 0,
    codec: 0,
    compatibility: 0,
    migration: 0,
    schema: 0,
    metadata: 0,
    reconstruction: 0,
    dataset: 0,
  };
}

function emptyCategoryCounts(): Record<WorkbookRecoveryCategory, number> {
  return {
    'resource-limit': 0,
    'unreadable-or-corrupt-workbook': 0,
    'unsupported-or-incompatible-version': 0,
    'workbook-structure': 0,
    'invalid-workbook-values': 0,
    'invalid-business-data': 0,
    'unexpected-import-failure': 0,
  };
}

function isBackupRestoreRecommended(category: WorkbookRecoveryCategory): boolean {
  return (
    category === 'unreadable-or-corrupt-workbook' ||
    category === 'workbook-structure' ||
    category === 'invalid-workbook-values'
  );
}

/**
 * Classifies one precise importer issue into a stable recovery meaning.
 *
 * The raw issue remains the authoritative technical evidence. This function only
 * derives UI-agnostic recovery guidance and never mutates the supplied issue.
 */
export function classifyWorkbookImportIssueRecovery(
  issue: Readonly<BusinessDatasetWorkbookImportIssue>,
): WorkbookRecoveryCategory {
  if (issue.stage === 'resource-limit') return 'resource-limit';
  if (issue.stage === 'codec') return 'unreadable-or-corrupt-workbook';

  if (UNEXPECTED_OPERATIONAL_CODES.has(issue.code)) {
    return 'unexpected-import-failure';
  }

  if (VERSION_OR_COMPATIBILITY_CODES.has(issue.code)) {
    return 'unsupported-or-incompatible-version';
  }

  if (STRUCTURE_CODES.has(issue.code)) return 'workbook-structure';

  if (issue.stage === 'compatibility') {
    return 'unsupported-or-incompatible-version';
  }

  if (issue.stage === 'migration') return 'unexpected-import-failure';

  if (issue.stage === 'schema' || issue.stage === 'metadata') {
    return 'invalid-workbook-values';
  }

  if (issue.stage === 'reconstruction') return 'invalid-workbook-values';
  if (issue.stage === 'dataset') return 'invalid-business-data';

  return 'unexpected-import-failure';
}

function categoryRank(category: WorkbookRecoveryCategory): number {
  return CATEGORY_PRECEDENCE.get(category) ?? Number.MAX_SAFE_INTEGER;
}

/**
 * Summarizes a rejected import without flattening or replacing its raw issues.
 *
 * The summary is deterministic for any issue ordering. `liveStateChanged` is
 * deliberately `false`: this classifier describes expected import rejection only
 * and performs no hydration, repository, transport, filesystem, or backup action.
 */
export function summarizeWorkbookImportRecovery(
  issues: readonly Readonly<BusinessDatasetWorkbookImportIssue>[],
): WorkbookImportRecoverySummary {
  if (issues.length === 0) {
    throw new TypeError('Workbook recovery summary requires at least one import issue.');
  }

  const stageCounts = emptyStageCounts();
  const categoryCounts = emptyCategoryCounts();

  for (const issue of issues) {
    stageCounts[issue.stage] += 1;
    const category = classifyWorkbookImportIssueRecovery(issue);
    categoryCounts[category] += 1;
  }

  const representedCategories = WORKBOOK_RECOVERY_CATEGORIES.filter(
    (category) => categoryCounts[category] > 0,
  ).sort((left, right) => categoryRank(left) - categoryRank(right));

  const primaryCategory = representedCategories[0] ?? 'unexpected-import-failure';
  const actionSet = new Set<WorkbookRecoveryActionCode>();
  for (const category of representedCategories) {
    for (const action of ACTIONS_BY_CATEGORY[category]) actionSet.add(action);
  }

  return Object.freeze({
    primaryCategory,
    recommendedActions: Object.freeze([...actionSet]),
    issueCount: issues.length,
    stageCounts: Object.freeze(stageCounts),
    categoryCounts: Object.freeze(categoryCounts),
    backupRestoreRecommended: representedCategories.some(isBackupRestoreRecommended),
    liveStateChanged: false as const,
  });
}
