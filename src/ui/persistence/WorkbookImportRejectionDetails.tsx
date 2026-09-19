import type {
  PersistenceDatasetHydrationIssue,
  PersistenceLifecycleRejected,
} from '../../application/persistence/PersistenceLifecycle';
import type {
  BusinessDatasetWorkbookImportIssue,
  BusinessDatasetWorkbookImportIssueStage,
} from '../../storage/businessDatasetWorkbookImport';
import {
  summarizeWorkbookImportRecovery,
  type WorkbookRecoveryActionCode,
  type WorkbookRecoveryCategory,
} from '../../storage/workbookRecoveryDiagnostics';
import './workbookImportRecovery.css';

const CATEGORY_LABELS: Readonly<Record<WorkbookRecoveryCategory, string>> = Object.freeze({
  'resource-limit': 'Workbook resource limit',
  'unreadable-or-corrupt-workbook': 'Unreadable or corrupt workbook',
  'unsupported-or-incompatible-version': 'Unsupported or incompatible workbook version',
  'workbook-structure': 'Workbook structure',
  'invalid-workbook-values': 'Invalid workbook values',
  'invalid-business-data': 'Invalid business data',
  'unexpected-import-failure': 'Unexpected import processing failure',
});

const STAGE_LABELS: Readonly<Record<BusinessDatasetWorkbookImportIssueStage, string>> = Object.freeze({
  'resource-limit': 'Resource limit',
  codec: 'Workbook decoding',
  compatibility: 'Version compatibility',
  migration: 'Version migration',
  schema: 'Workbook structure / values',
  metadata: 'Workbook metadata',
  reconstruction: 'Workbook reconstruction',
  dataset: 'Business data validation',
});

const ACTION_COPY: Readonly<Record<WorkbookRecoveryActionCode, string>> = Object.freeze({
  'select-another-file': 'Choose another workbook file and try the import again.',
  'restore-known-good-backup':
    'Import a known-good workbook copy that you already possess, such as an earlier exported copy.',
  'reduce-workbook-size':
    'Reduce the workbook size or content so it stays within the supported resource limits, then retry.',
  'open-with-compatible-or-newer-app':
    'Open this workbook with a compatible or newer Craft Business Manager version, or choose a workbook supported by this version.',
  'repair-workbook-structure':
    'Repair the workbook structure, including missing or duplicate sheets/columns, then retry.',
  'correct-source-data':
    'Correct the invalid workbook values or referenced business data, then retry the import.',
  'retry-or-report-unexpected-error':
    'Retry the import. If the same unexpected processing failure repeats, keep the workbook and report the error details.',
});

export interface WorkbookImportRejectionDetailsProps {
  readonly result: PersistenceLifecycleRejected;
}

function formatVersion(version: { workbookFormatVersion: number; datasetSchemaVersion: number }): string {
  return `workbook v${version.workbookFormatVersion} / dataset v${version.datasetSchemaVersion}`;
}

function importIssueLocation(issue: Readonly<BusinessDatasetWorkbookImportIssue>): string[] {
  const parts: string[] = [];
  if (issue.sheetName !== undefined) parts.push(`Sheet ${issue.sheetName}`);
  if (issue.excelRow !== undefined) parts.push(`Excel row ${issue.excelRow}`);
  else if (issue.rowIndex !== undefined) parts.push(`Row index ${issue.rowIndex}`);
  if (issue.column !== undefined) parts.push(`Column ${issue.column}`);
  if (issue.path !== undefined) parts.push(`Path ${issue.path}`);
  return parts;
}

function hydrationIssueLocation(issue: Readonly<PersistenceDatasetHydrationIssue>): string[] {
  const parts: string[] = [];
  if (issue.collection !== undefined) parts.push(`Collection ${issue.collection}`);
  if (issue.index !== undefined) parts.push(`Record ${issue.index}`);
  if (issue.field !== undefined) parts.push(`Field ${issue.field}`);
  if (issue.path) parts.push(`Path ${issue.path}`);
  return parts;
}

function RawImportIssue({ issue }: { readonly issue: Readonly<BusinessDatasetWorkbookImportIssue> }) {
  const location = importIssueLocation(issue);
  return (
    <li className="workbook-recovery-issue">
      <div className="workbook-recovery-issue-heading">
        <span className="workbook-recovery-code">{issue.code}</span>
        <span>{STAGE_LABELS[issue.stage]}</span>
      </div>
      <p>{issue.message}</p>
      {location.length > 0 && <small>{location.join(' · ')}</small>}
      {issue.sourceVersion !== undefined && (
        <small>Source version: {formatVersion(issue.sourceVersion)}</small>
      )}
      {issue.targetVersion !== undefined && (
        <small>Supported target: {formatVersion(issue.targetVersion)}</small>
      )}
      {issue.actual !== undefined && issue.maximum !== undefined && (
        <small>
          Resource usage: {issue.actual.toLocaleString()} / {issue.maximum.toLocaleString()} maximum
        </small>
      )}
    </li>
  );
}

function RawHydrationIssue({ issue }: { readonly issue: Readonly<PersistenceDatasetHydrationIssue> }) {
  const location = hydrationIssueLocation(issue);
  return (
    <li className="workbook-recovery-issue">
      <div className="workbook-recovery-issue-heading">
        <span className="workbook-recovery-code">{issue.code}</span>
        <span>Dataset validation</span>
      </div>
      <p>{issue.message}</p>
      {location.length > 0 && <small>{location.join(' · ')}</small>}
    </li>
  );
}

function ImportRecoveryDetails({ result }: { readonly result: Extract<PersistenceLifecycleRejected, { stage: 'import' }> }) {
  const summary = summarizeWorkbookImportRecovery(result.issues);
  const stageEntries = Object.entries(summary.stageCounts).filter(([, count]) => count > 0) as Array<
    [BusinessDatasetWorkbookImportIssueStage, number]
  >;

  return (
    <div className="workbook-recovery-content">
      <div className="workbook-recovery-summary" aria-label="Workbook recovery summary">
        <div>
          <span className="workbook-recovery-label">Primary recovery category</span>
          <strong>{CATEGORY_LABELS[summary.primaryCategory]}</strong>
        </div>
        <div>
          <span className="workbook-recovery-label">Issues found</span>
          <strong>{summary.issueCount}</strong>
        </div>
      </div>

      <div className="workbook-recovery-stage-summary" aria-label="Workbook issue stage summary">
        {stageEntries.map(([stage, count]) => (
          <span key={stage}>
            {STAGE_LABELS[stage]}: <strong>{count}</strong>
          </span>
        ))}
      </div>

      <div className="workbook-recovery-actions" aria-label="Recommended recovery actions">
        <h4>Recommended recovery</h4>
        <ol>
          {summary.recommendedActions.map((action) => (
            <li key={action} data-recovery-action={action}>
              {ACTION_COPY[action]}
            </li>
          ))}
        </ol>
      </div>

      {summary.backupRestoreRecommended && (
        <p className="workbook-recovery-browser-note">
          <strong>Browser restore note:</strong> a known-good copy means a workbook file you already own.
          Browser import does not create, discover, or manage a Phase 5.4B pre-save transport backup or a
          native filesystem backup location.
        </p>
      )}

      <div className="workbook-recovery-raw" aria-label="Raw workbook validation issues">
        <h4>Validation details</h4>
        <p>
          These issue records are the technical source of truth. Recovery guidance above is derived from
          them and does not replace the original diagnostics.
        </p>
        <ol>
          {result.issues.map((issue, index) => (
            <RawImportIssue key={`${issue.stage}-${issue.code}-${index}`} issue={issue} />
          ))}
        </ol>
      </div>
    </div>
  );
}

function HydrationRejectionDetails({ result }: { readonly result: Extract<PersistenceLifecycleRejected, { stage: 'hydrate' }> }) {
  return (
    <div className="workbook-recovery-content">
      <div className="workbook-recovery-summary" aria-label="Dataset rejection summary">
        <div>
          <span className="workbook-recovery-label">Rejection category</span>
          <strong>Dataset validation</strong>
        </div>
        <div>
          <span className="workbook-recovery-label">Issues found</span>
          <strong>{result.issues.length}</strong>
        </div>
      </div>
      <div className="workbook-recovery-actions" aria-label="Recommended recovery actions">
        <h4>Recommended recovery</h4>
        <ol>
          <li>Correct the invalid source data or choose another known-good workbook copy, then retry.</li>
        </ol>
      </div>
      <div className="workbook-recovery-raw" aria-label="Raw dataset validation issues">
        <h4>Validation details</h4>
        <ol>
          {result.issues.map((issue, index) => (
            <RawHydrationIssue key={`${issue.code}-${issue.path}-${index}`} issue={issue} />
          ))}
        </ol>
      </div>
    </div>
  );
}

/**
 * Phase 5.5C2 presentation for expected persistence rejection only.
 *
 * Import-stage recovery guidance is derived from the existing storage recovery classifier while the
 * raw issue array remains visible and unchanged. Operational exceptions are deliberately rendered by
 * WorkbookImportPanel's separate error path and never enter this component.
 */
export function WorkbookImportRejectionDetails({ result }: WorkbookImportRejectionDetailsProps) {
  return (
    <section className="workbook-recovery-panel" aria-labelledby="workbook-recovery-heading">
      <div className="workbook-recovery-heading-row">
        <div>
          <p className="panel-kicker">VALIDATION &amp; RECOVERY</p>
          <h3 id="workbook-recovery-heading">Why this workbook was not imported</h3>
        </div>
        <span className="workbook-recovery-safe-state">Current workspace preserved</span>
      </div>
      {result.stage === 'import' ? (
        <ImportRecoveryDetails result={result} />
      ) : (
        <HydrationRejectionDetails result={result} />
      )}
    </section>
  );
}
