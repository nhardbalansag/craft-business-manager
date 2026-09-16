import { type ChangeEvent, useRef, useState } from 'react';
import {
  BrowserWorkbookImportCommand,
  BrowserWorkbookImportWorkflowError,
  type PendingBrowserWorkbookSelection,
} from '../../application/persistence/BrowserWorkbookImportCommand';
import { PersistenceLifecycleOperationalError } from '../../application/persistence/PersistenceLifecycle';
import type {
  PersistenceWorkbookApplyResult,
  PersistenceWorkbookHydrated,
} from '../../application/persistence/PersistenceCoordinator';
import './workbookImport.css';

interface WorkbookImportFeedback {
  readonly kind: 'success' | 'error';
  readonly message: string;
}

export interface WorkbookImportHydratedEvent {
  readonly selection: PendingBrowserWorkbookSelection;
  readonly result: PersistenceWorkbookHydrated;
}

export interface WorkbookImportPanelProps {
  readonly command: BrowserWorkbookImportCommand;
  readonly onHydrated: (event: WorkbookImportHydratedEvent) => void;
}

function formatBytes(byteLength: number): string {
  if (byteLength < 1_024) return `${byteLength} B`;
  if (byteLength < 1_024 * 1_024) return `${(byteLength / 1_024).toFixed(1)} KB`;
  return `${(byteLength / (1_024 * 1_024)).toFixed(1)} MB`;
}

function rejectionMessage(result: Extract<PersistenceWorkbookApplyResult, { status: 'rejected' }>): string {
  const count = result.issues.length;
  const issueLabel = count === 1 ? 'issue' : 'issues';
  const stageLabel = result.stage === 'import' ? 'workbook validation' : 'dataset validation';
  return `Import rejected during ${stageLabel}: ${count} ${issueLabel}. The current workspace was not refreshed.`;
}

function workflowErrorMessage(error: unknown): string {
  if (
    error instanceof BrowserWorkbookImportWorkflowError ||
    error instanceof PersistenceLifecycleOperationalError
  ) {
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'The workbook operation failed unexpectedly.';
}

function confirmationMessage(selection: PendingBrowserWorkbookSelection): string {
  return `Import ${selection.name}? A successful import replaces the currently loaded authoritative business data.`;
}

/**
 * Phase 5.5A2 browser UI over the A1 import command.
 *
 * This component never parses XLSX, enumerates repositories, or hydrates data directly. A selected
 * workbook remains pending until the user explicitly confirms Apply import. Only a successful
 * hydrated result notifies the application shell to refresh the visible repository-backed workspace
 * and update browser-session persistence status.
 */
export function WorkbookImportPanel({ command, onHydrated }: WorkbookImportPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selection, setSelection] = useState<PendingBrowserWorkbookSelection | null>(() =>
    command.getPendingSelection(),
  );
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [feedback, setFeedback] = useState<WorkbookImportFeedback | null>(null);
  const busy = reading || importing;

  function openFileChooser() {
    if (!busy) inputRef.current?.click();
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0] ?? null;
    setReading(true);
    setFeedback(null);

    try {
      const result = await command.selectFile(file);
      setSelection(result.selection);
    } catch (error) {
      setSelection(command.getPendingSelection());
      setFeedback({ kind: 'error', message: workflowErrorMessage(error) });
    } finally {
      input.value = '';
      setReading(false);
    }
  }

  function clearSelection() {
    if (busy) return;
    command.clearSelection();
    setSelection(null);
    setFeedback(null);
  }

  async function applyImport() {
    if (busy || selection === null) return;
    if (!window.confirm(confirmationMessage(selection))) return;

    setImporting(true);
    setFeedback(null);

    try {
      const result = await command.applyPendingSelection();
      if (result.status === 'hydrated') {
        const hydratedEvent: WorkbookImportHydratedEvent = Object.freeze({
          selection: Object.freeze({ ...selection }),
          result,
        });
        command.clearSelection();
        setSelection(null);
        setFeedback({
          kind: 'success',
          message: `Imported ${selection.name}. The visible workspace was refreshed from the imported data.`,
        });
        onHydrated(hydratedEvent);
        return;
      }

      setFeedback({ kind: 'error', message: rejectionMessage(result) });
    } catch (error) {
      setFeedback({ kind: 'error', message: workflowErrorMessage(error) });
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="workbook-import-panel" aria-labelledby="workbook-import-heading">
      <div className="workbook-import-copy">
        <p className="panel-kicker">DATA FILE</p>
        <h2 id="workbook-import-heading">Open / Import workbook</h2>
        <p>
          Select a Craft Business Manager <strong>.xlsx</strong> workbook. Selection is safe and
          non-destructive; data is replaced only after you explicitly confirm the import.
        </p>
      </div>

      <div className="workbook-import-actions">
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          aria-label="Workbook file"
          disabled={busy}
          onChange={(event) => void handleFileChange(event)}
        />

        <button className="button button-quiet" type="button" disabled={busy} onClick={openFileChooser}>
          {selection === null ? 'Choose workbook' : 'Choose another workbook'}
        </button>

        {selection !== null && (
          <button className="button button-quiet" type="button" disabled={busy} onClick={clearSelection}>
            Cancel selection
          </button>
        )}

        <button
          className="button button-primary"
          type="button"
          disabled={busy || selection === null}
          onClick={() => void applyImport()}
        >
          {reading ? 'Reading workbook…' : importing ? 'Importing…' : 'Apply import'}
        </button>
      </div>

      {selection !== null && (
        <div className="workbook-selection" aria-label="Selected workbook">
          <strong>{selection.name}</strong>
          <span>{formatBytes(selection.byteLength)}</span>
          <small>A successful import replaces the currently loaded authoritative source data.</small>
        </div>
      )}

      {feedback !== null && (
        <p
          className={`workbook-import-feedback ${
            feedback.kind === 'success' ? 'workbook-import-feedback-success' : 'workbook-import-feedback-error'
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
