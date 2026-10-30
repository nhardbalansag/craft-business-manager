import { useState } from 'react';
import type { PendingGoogleDriveWorkbook } from '../../application/persistence/GoogleDriveWorkbookImportCommand';
import { GoogleDriveImportError } from '../../application/persistence/GoogleDriveWorkbookImportCommand';
import { getGoogleDriveApiKey, getLastGoogleDriveUrl, rememberGoogleDriveUrl,
  saveGoogleDriveApiKey } from '../../application/persistence/googleDriveImportPreferences';
import type { PersistenceWorkbookApplyResult } from '../../application/persistence/PersistenceCoordinator';
import type { PersistenceLifecycleRejected } from '../../application/persistence/PersistenceLifecycle';
import { WorkbookImportRejectionDetails } from './WorkbookImportRejectionDetails';
import type { WorkbookImportHydratedEvent } from './WorkbookImportPanel';
import './googleDriveWorkbookImport.css';

export interface GoogleDriveWorkbookImportPort {
  getPendingSelection(): PendingGoogleDriveWorkbook | null;
  clearSelection(): void;
  loadWorkbook(url: string): Promise<PendingGoogleDriveWorkbook>;
  applyPendingSelection(): Promise<PersistenceWorkbookApplyResult>;
}

export function GoogleDriveWorkbookImportPanel({ command, onHydrated }: {
  readonly command: GoogleDriveWorkbookImportPort;
  readonly onHydrated: (event: WorkbookImportHydratedEvent) => void;
}) {
  const [url, setUrl] = useState(getLastGoogleDriveUrl);
  const [selection, setSelection] = useState(() => command.getPendingSelection());
  const [busy, setBusy] = useState<'fetch' | 'import' | null>(null);
  const [feedback, setFeedback] = useState<{ error: boolean; message: string } | null>(null);
  const [rejection, setRejection] = useState<PersistenceLifecycleRejected | null>(null);
  const [savedKey, setSavedKey] = useState(getGoogleDriveApiKey);
  const [keyDraft, setKeyDraft] = useState(savedKey);
  const [setupFeedback, setSetupFeedback] = useState<{ error: boolean; message: string } | null>(null);

  function resetSelection() {
    command.clearSelection();
    setSelection(null);
    setFeedback(null);
    setRejection(null);
  }

  function showError(error: unknown) {
    setFeedback({ error: true, message: error instanceof GoogleDriveImportError
      ? `[${error.code}] ${error.message}`
      : error instanceof Error ? error.message : 'The Google Drive import failed. Try again.' });
  }

  async function loadWorkbook() {
    if (busy || !url.trim()) return;
    resetSelection();
    setBusy('fetch');
    try {
      const loaded = await command.loadWorkbook(url);
      setSelection(loaded);
      rememberGoogleDriveUrl(loaded.sourceUrl);
      setFeedback({ error: false, message: 'Excel file fetched from Google Drive. Review the file below, then apply the import.' });
    } catch (error) { setSelection(command.getPendingSelection()); showError(error); }
    finally { setBusy(null); }
  }

  async function applyImport() {
    if (busy || !selection) return;
    if (!window.confirm(`Import ${selection.name} from Google Drive? A successful import replaces the currently loaded business data.`)) return;
    setBusy('import');
    setFeedback(null);
    setRejection(null);
    try {
      const result = await command.applyPendingSelection();
      if (result.status === 'hydrated') {
        command.clearSelection();
        setSelection(null);
        setFeedback({ error: false, message: `Imported ${selection.name} from Google Drive. The workspace was refreshed from the Excel file.` });
        onHydrated({ selection: { name: selection.name, byteLength: selection.byteLength }, result });
      } else {
        setRejection(result);
        const first = result.issues[0];
        setFeedback({ error: true, message: `Google Drive import rejected during ${result.stage === 'import' ? 'workbook' : 'dataset'} validation. The current workspace was not refreshed.${first ? ` First issue [${first.code}]: ${first.message}` : ''}` });
      }
    } catch (error) { showError(error); }
    finally { setBusy(null); }
  }

  function saveSetup(value: string) {
    try {
      saveGoogleDriveApiKey(value);
      const active = getGoogleDriveApiKey();
      setSavedKey(active);
      setKeyDraft(active);
      setSetupFeedback({ error: false, message: active ? 'Drive setup saved. You can fetch your Excel file link now.' : 'Browser key cleared. Configure a key before fetching from Drive.' });
    } catch (error) {
      setSetupFeedback({ error: true, message: error instanceof Error ? error.message : 'Drive setup could not be saved. Allow local browser storage and try again.' });
    }
  }

  return <section className="google-drive-import-panel" aria-labelledby="google-drive-import-heading">
    <div>
      <p className="panel-kicker">GOOGLE DRIVE · EXCEL FILE</p>
      <h2 id="google-drive-import-heading">Import Excel from Google Drive</h2>
      <p>Upload your workbook to Google Drive as an <strong>.xlsx file</strong>, copy its sharing link,
        and paste it here. All workbook data is validated before it replaces your workspace.</p>
    </div>

    <label className="google-drive-url-field">
      <span>Google Drive Excel file link</span>
      <input type="url" inputMode="url" value={url} disabled={!!busy}
        placeholder="https://drive.google.com/file/d/.../view?usp=sharing"
        onChange={(event) => { setUrl(event.target.value); resetSelection(); }} />
      <small>Use Anyone with the link → Viewer and allow downloads. Anyone with this link can read the file.</small>
    </label>
    <div className="google-drive-import-actions">
      <button type="button" className="button button-quiet" disabled={!!busy || !url.trim()}
        onClick={() => void loadWorkbook()}>{busy === 'fetch' ? 'Fetching Excel…' : selection ? 'Fetch Excel again' : 'Fetch Excel from Drive'}</button>
      {selection && <button type="button" className="button button-quiet" disabled={!!busy} onClick={resetSelection}>Clear fetched Excel</button>}
      <button type="button" className="button button-primary" disabled={!!busy || !selection}
        onClick={() => void applyImport()}>{busy === 'import' ? 'Importing Excel…' : 'Apply Drive import'}</button>
    </div>

    <details className="google-drive-import-help">
      <summary>How to use an uploaded Excel file</summary>
      <ol>
        <li>Upload the exported Craft Business Manager .xlsx workbook to Google Drive. Keep its Excel format.</li>
        <li>Choose Share → General access → Anyone with the link → Viewer. Make sure downloading is allowed.</li>
        <li>Copy the file link, paste it above, then choose Fetch Excel from Drive and Apply Drive import.</li>
      </ol>
      <p>To fetch updated data later, upload a new version of the same Drive file and fetch again.
        This reads a snapshot; edits in the app are saved locally and are not written back to Drive.</p>
    </details>

    <details className="google-drive-import-help" open={!savedKey}>
      <summary>One-time Google Drive API setup{savedKey ? ' · key configured' : ' · required'}</summary>
      <p>The website owner can configure a browser API key once for everyone. You can also save your
        own key here on this browser; it is used only with Google’s Drive API.</p>
      <ol>
        <li>Enable the Google Drive API in a Google Cloud project and create a browser API key.</li>
        <li>Restrict the key to the Google Drive API and your website’s allowed HTTP referrers.</li>
        <li>Paste that browser key below and save. Do not paste a service-account private key or OAuth client secret.</li>
      </ol>
      <a href="https://developers.google.com/workspace/guides/create-credentials#api-key-credentials" target="_blank" rel="noreferrer">Google’s API key setup guide</a>
      <label className="google-drive-url-field">
        <span>Google Drive browser API key</span>
        <input type="password" autoComplete="off" spellCheck={false} value={keyDraft} disabled={!!busy}
          onChange={(event) => { setKeyDraft(event.target.value); setSetupFeedback(null); }} />
      </label>
      <div className="google-drive-import-actions">
        <button type="button" className="button button-quiet" disabled={!!busy} onClick={() => saveSetup(keyDraft)}>Save Drive setup</button>
        <button type="button" className="button button-quiet" disabled={!!busy} onClick={() => saveSetup('')}>Clear browser key</button>
      </div>
      {setupFeedback && <p role={setupFeedback.error ? 'alert' : 'status'}>{setupFeedback.message}</p>}
    </details>

    {selection && <div className="google-drive-fetched-file" aria-label="Fetched Drive Excel file">
      <strong>{selection.name}</strong><span>{(selection.byteLength / (1024 * 1024)).toFixed(2)} MiB</span>
      <a href={selection.sourceUrl} target="_blank" rel="noreferrer">Open source in Google Drive</a>
      <small>Fetching leaves your current workspace unchanged. Apply the import when ready.</small>
    </div>}
    {feedback && <p className={`google-drive-feedback ${feedback.error ? 'has-error' : ''}`}
      role={feedback.error ? 'alert' : 'status'}>{feedback.message}</p>}
    {rejection?.stage === 'import' && rejection.issues.some((issue) => issue.code === 'WORKBOOK_BYTES_EXCEEDED') &&
      <p>Increase Maximum workbook size in Workbook tools, then click Apply Drive import again.
        The fetched Excel file is still selected.</p>}
    {rejection && <WorkbookImportRejectionDetails result={rejection} />}
  </section>;
}
