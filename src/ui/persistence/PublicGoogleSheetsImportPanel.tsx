import { useState } from 'react';
import {
  PublicGoogleSheetsImportWorkflowError,
  type PendingPublicGoogleSheetSelection,
  type PublicGoogleSheetsImportCommand,
} from '../../application/persistence/PublicGoogleSheetsImportCommand';
import {
  PersistenceLifecycleOperationalError,
  type PersistenceLifecycleRejected,
} from '../../application/persistence/PersistenceLifecycle';
import type { PersistenceWorkbookApplyResult } from '../../application/persistence/PersistenceCoordinator';
import type { WorkbookImportHydratedEvent } from './WorkbookImportPanel';
import { WorkbookImportRejectionDetails } from './WorkbookImportRejectionDetails';
import './publicGoogleSheetsImport.css';

interface GoogleSheetsFeedback {
  readonly kind: 'success' | 'error';
  readonly message: string;
}

export interface PublicGoogleSheetsImportCommandPort {
  getPendingSelection(): PendingPublicGoogleSheetSelection | null;
  clearSelection(): void;
  loadPublishedSheet(url: string): Promise<PendingPublicGoogleSheetSelection>;
  applyPendingSelection(): Promise<PersistenceWorkbookApplyResult>;
}

export interface PublicGoogleSheetsImportPanelProps {
  readonly command: PublicGoogleSheetsImportCommand | PublicGoogleSheetsImportCommandPort;
  readonly onHydrated: (event: WorkbookImportHydratedEvent) => void;
}

function formatBytes(byteLength: number): string {
  if (byteLength < 1_024) return `${byteLength} B`;
  if (byteLength < 1_024 * 1_024) return `${(byteLength / 1_024).toFixed(1)} KB`;
  return `${(byteLength / (1_024 * 1_024)).toFixed(1)} MB`;
}

function workflowErrorMessage(error: unknown): string {
  if (
    error instanceof PublicGoogleSheetsImportWorkflowError ||
    error instanceof PersistenceLifecycleOperationalError
  ) {
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'The public Google Sheets operation failed unexpectedly.';
}

function rejectionMessage(
  result: Extract<PersistenceWorkbookApplyResult, { status: 'rejected' }>,
): string {
  const count = result.issues.length;
  const issueLabel = count === 1 ? 'issue' : 'issues';
  const stageLabel = result.stage === 'import' ? 'workbook validation' : 'dataset validation';
  return `Google Sheets import rejected during ${stageLabel}: ${count} ${issueLabel}. The current workspace was not refreshed.`;
}

function confirmationMessage(selection: PendingPublicGoogleSheetSelection): string {
  return `Import the fetched public Google Sheet (${selection.name})? A successful import replaces the currently loaded authoritative business data.`;
}

export function PublicGoogleSheetsImportPanel({
  command,
  onHydrated,
}: PublicGoogleSheetsImportPanelProps) {
  const [url, setUrl] = useState('');
  const [selection, setSelection] = useState<PendingPublicGoogleSheetSelection | null>(() =>
    command.getPendingSelection(),
  );
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [feedback, setFeedback] = useState<GoogleSheetsFeedback | null>(null);
  const [rejection, setRejection] = useState<PersistenceLifecycleRejected | null>(null);
  const busy = loading || importing;

  function handleUrlChange(value: string) {
    setUrl(value);
    if (selection !== null) {
      command.clearSelection();
      setSelection(null);
    }
    setFeedback(null);
    setRejection(null);
  }

  async function loadPublishedSheet() {
    if (busy || url.trim() === '') return;
    setLoading(true);
    setFeedback(null);
    setRejection(null);

    try {
      const loaded = await command.loadPublishedSheet(url);
      setSelection(loaded);
      setFeedback({
        kind: 'success',
        message: 'Public Google Sheet fetched as an XLSX snapshot. Review the source below, then apply the import when ready.',
      });
    } catch (error) {
      setSelection(command.getPendingSelection());
      setFeedback({ kind: 'error', message: workflowErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }

  function clearFetchedSheet() {
    if (busy) return;
    command.clearSelection();
    setSelection(null);
    setFeedback(null);
    setRejection(null);
  }

  async function applyImport() {
    if (busy || selection === null) return;
    if (!window.confirm(confirmationMessage(selection))) return;

    setImporting(true);
    setFeedback(null);
    setRejection(null);

    try {
      const result = await command.applyPendingSelection();
      if (result.status === 'hydrated') {
        const event: WorkbookImportHydratedEvent = Object.freeze({
          selection: Object.freeze({
            name: selection.name,
            byteLength: selection.byteLength,
          }),
          result,
        });
        command.clearSelection();
        setSelection(null);
        setFeedback({
          kind: 'success',
          message: 'Imported the public Google Sheet snapshot. The visible workspace was refreshed from the imported data.',
        });
        onHydrated(event);
        return;
      }

      setRejection(result);
      setFeedback({ kind: 'error', message: rejectionMessage(result) });
    } catch (error) {
      setFeedback({ kind: 'error', message: workflowErrorMessage(error) });
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="public-google-sheets-panel" aria-labelledby="public-google-sheets-heading">
      <div className="public-google-sheets-copy">
        <p className="panel-kicker">GOOGLE SHEETS · PUBLIC</p>
        <h2 id="public-google-sheets-heading">Import a published Google Sheet</h2>
        <p>
          Paste a Google Sheets <strong>Published to the web</strong> link. Craft Business Manager
          fetches a read-only XLSX snapshot and validates it with the same workbook contract as a
          local file before any data is replaced.
        </p>
      </div>

      <div className="public-google-sheets-form">
        <label className="public-google-sheets-url-field">
          <span>Published Google Sheets URL</span>
          <input
            type="url"
            inputMode="url"
            value={url}
            disabled={busy}
            placeholder="https://docs.google.com/spreadsheets/d/e/.../pubhtml"
            onChange={(event) => handleUrlChange(event.currentTarget.value)}
          />
          <small>
            This first version intentionally does not accept private sheets or normal signed-in
            sharing links.
          </small>
        </label>

        <div className="public-google-sheets-actions">
          <button
            className="button button-quiet"
            type="button"
            disabled={busy || url.trim() === ''}
            onClick={() => void loadPublishedSheet()}
          >
            {loading ? 'Fetching sheet…' : selection === null ? 'Fetch public sheet' : 'Fetch again'}
          </button>
          {selection !== null && (
            <button
              className="button button-quiet"
              type="button"
              disabled={busy}
              onClick={clearFetchedSheet}
            >
              Clear fetched sheet
            </button>
          )}
          <button
            className="button button-primary"
            type="button"
            disabled={busy || selection === null}
            onClick={() => void applyImport()}
          >
            {importing ? 'Importing…' : 'Apply Google Sheets import'}
          </button>
        </div>
      </div>

      <details className="public-google-sheets-help">
        <summary>How to make the workbook public</summary>
        <ol>
          <li>Open the Google Sheet.</li>
          <li>Choose File → Share → Publish to web.</li>
          <li>Publish the entire spreadsheet, not only one tab.</li>
          <li>Copy the published link ending in <code>/pubhtml</code> and paste it above.</li>
        </ol>
        <p>
          Publishing exposes the selected spreadsheet content publicly. Do not publish sensitive or
          confidential business data. You can stop publishing later from Google Sheets.
        </p>
      </details>

      {selection !== null && (
        <div className="public-google-sheets-selection" aria-label="Fetched public Google Sheet">
          <div>
            <span>Fetched snapshot</span>
            <strong>{selection.name}</strong>
          </div>
          <div>
            <span>Size</span>
            <strong>{formatBytes(selection.byteLength)}</strong>
          </div>
          <div className="public-google-sheets-selection-wide">
            <span>Published source</span>
            <strong title={selection.sourceUrl}>{selection.sourceUrl}</strong>
          </div>
          <small>
            Fetching is non-destructive. Live app data changes only after Apply Google Sheets import
            succeeds.
          </small>
        </div>
      )}

      {feedback !== null && (
        <p
          className={`public-google-sheets-feedback ${
            feedback.kind === 'success'
              ? 'public-google-sheets-feedback-success'
              : 'public-google-sheets-feedback-error'
          }`}
          role={feedback.kind === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {feedback.message}
        </p>
      )}

      {rejection !== null && <WorkbookImportRejectionDetails result={rejection} />}
    </section>
  );
}
