import { useRef, useState } from 'react';
import {
  BrowserWorkbookExportWorkflowError,
  type BrowserWorkbookExportResult,
} from '../../application/persistence/BrowserWorkbookExportCommand';
import { PersistenceLifecycleOperationalError } from '../../application/persistence/PersistenceLifecycle';
import './workbookExport.css';

interface WorkbookExportFeedback {
  readonly kind: 'success' | 'error';
  readonly message: string;
}

export interface WorkbookExportCommandPort {
  exportAndDownload(): Promise<BrowserWorkbookExportResult>;
}

export interface WorkbookExportPanelProps {
  readonly command: WorkbookExportCommandPort;
}

function workflowErrorMessage(error: unknown): string {
  if (
    error instanceof BrowserWorkbookExportWorkflowError ||
    error instanceof PersistenceLifecycleOperationalError
  ) {
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'The workbook export failed unexpectedly.';
}

/**
 * Phase 5.5B2 React surface over the B1 browser export command.
 *
 * This component deliberately treats browser export as creation of a new downloaded copy. It does
 * not construct workbook bytes, mutate repositories, advance the import workspace revision, invoke
 * WorkbookTransport, or imply native overwrite/backup/atomic-replacement semantics.
 */
export function WorkbookExportPanel({ command }: WorkbookExportPanelProps) {
  const exportInFlightRef = useRef(false);
  const [exporting, setExporting] = useState(false);
  const [feedback, setFeedback] = useState<WorkbookExportFeedback | null>(null);

  async function exportWorkbook() {
    if (exportInFlightRef.current) return;

    exportInFlightRef.current = true;
    setExporting(true);
    setFeedback(null);

    try {
      const result = await command.exportAndDownload();
      setFeedback({
        kind: 'success',
        message: `Downloaded ${result.fileName} as a new workbook copy. The current workspace was not replaced or refreshed.`,
      });
    } catch (error) {
      setFeedback({ kind: 'error', message: workflowErrorMessage(error) });
    } finally {
      exportInFlightRef.current = false;
      setExporting(false);
    }
  }

  return (
    <section className="workbook-export-panel" aria-labelledby="workbook-export-heading" aria-busy={exporting}>
      <div className="workbook-export-copy">
        <p className="panel-kicker">SAVE A COPY</p>
        <h2 id="workbook-export-heading">Download workbook</h2>
        <p>
          Download the current Craft Business Manager data as a new <strong>.xlsx</strong> copy.
          Browser export does not overwrite a workbook you previously imported and does not create a
          pre-save backup of an existing file. Native Save / Save As and managed filesystem backups
          remain desktop capabilities.
        </p>
      </div>

      <div className="workbook-export-actions">
        <button
          className="button button-primary"
          type="button"
          disabled={exporting}
          onClick={() => void exportWorkbook()}
        >
          {exporting ? 'Preparing download…' : 'Download workbook'}
        </button>
      </div>

      {feedback !== null && (
        <p
          className={`workbook-export-feedback ${
            feedback.kind === 'success' ? 'workbook-export-feedback-success' : 'workbook-export-feedback-error'
          }`}
          role={feedback.kind === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {feedback.message}
        </p>
      )}
    </section>
  );
}
