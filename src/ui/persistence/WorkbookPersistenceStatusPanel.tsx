import type { WorkbookPersistenceSessionStatus } from './workbookPersistenceSession';
import './workbookPersistenceStatus.css';

export interface WorkbookPersistenceStatusPanelProps {
  readonly status: WorkbookPersistenceSessionStatus;
}

function formatBytes(byteLength: number): string {
  if (byteLength < 1_024) return `${byteLength} B`;
  if (byteLength < 1_024 * 1_024) return `${(byteLength / 1_024).toFixed(1)} KB`;
  return `${(byteLength / (1_024 * 1_024)).toFixed(1)} MB`;
}

function formatUtc(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const normalized = date.toISOString();
  return `${normalized.slice(0, 10)} ${normalized.slice(11, 19)} UTC`;
}

/**
 * Phase 5.5C1 browser-session persistence status.
 *
 * The panel reports only identities and operation metadata the current browser session actually
 * knows. It never treats a browser filename as a managed native path and never claims dirty/clean,
 * overwrite, backup, atomic replacement, or filesystem durability state.
 */
export function WorkbookPersistenceStatusPanel({
  status,
}: WorkbookPersistenceStatusPanelProps) {
  return (
    <section className="workbook-persistence-status" aria-labelledby="workbook-status-heading">
      <div className="workbook-persistence-status-copy">
        <p className="panel-kicker">PERSISTENCE STATUS</p>
        <h2 id="workbook-status-heading">Workbook session</h2>
        <p>
          Browser-session information for the current app session. This status is not written into
          your business data or workbook.
        </p>
      </div>

      <div className="workbook-persistence-status-grid">
        <article className="workbook-persistence-status-card" aria-label="Current workbook contract">
          <span className="workbook-persistence-status-label">Current contract</span>
          <strong>{status.contract.formatId}</strong>
          <span>
            Workbook v{status.contract.workbookFormatVersion} · Dataset schema v
            {status.contract.datasetSchemaVersion}
          </span>
        </article>

        <article className="workbook-persistence-status-card" aria-label="Active imported workbook">
          <span className="workbook-persistence-status-label">Imported workbook</span>
          {status.activeImportedWorkbook === null ? (
            <p>No imported workbook identity is known in this browser session.</p>
          ) : (
            <>
              <strong>{status.activeImportedWorkbook.fileName}</strong>
              <span>{formatBytes(status.activeImportedWorkbook.byteLength)}</span>
              <span>
                Imported into this session {formatUtc(status.activeImportedWorkbook.importedAt)}
              </span>
              <span>
                Workbook metadata exported {formatUtc(status.activeImportedWorkbook.metadata.exportedAt)}
              </span>
              <span>
                Workbook v{status.activeImportedWorkbook.metadata.workbookFormatVersion} · Dataset
                schema v{status.activeImportedWorkbook.metadata.datasetSchemaVersion}
              </span>
            </>
          )}
        </article>

        <article className="workbook-persistence-status-card" aria-label="Last downloaded workbook copy">
          <span className="workbook-persistence-status-label">Last downloaded copy</span>
          {status.lastSuccessfulExport === null ? (
            <p>No workbook copy has been downloaded successfully in this browser session.</p>
          ) : (
            <>
              <strong>{status.lastSuccessfulExport.fileName}</strong>
              <span>{formatBytes(status.lastSuccessfulExport.byteLength)}</span>
              <span>
                Download dispatched {formatUtc(status.lastSuccessfulExport.downloadedAt)}
              </span>
              <span>
                Workbook metadata exported {formatUtc(status.lastSuccessfulExport.metadata.exportedAt)}
              </span>
            </>
          )}
        </article>
      </div>

      <p className="workbook-persistence-status-note">
        Browser filenames are identity labels, not managed filesystem paths. Downloading a copy does
        not overwrite the imported workbook, and this status does not claim dirty/clean
        synchronization with later edits.
      </p>
    </section>
  );
}
