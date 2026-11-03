import { type ReactNode, useEffect, useState, useSyncExternalStore } from 'react';
import { workspaceAutosave } from '../../application/session';
import type { WorkspaceAutosave } from '../../application/persistence/WorkspaceAutosave';
import './browserWorkspace.css';
import { SqliteBackupPanel } from './SqliteBackupPanel';

/** Block editing until recovery finishes, so an empty startup cannot overwrite saved data. */
export function BrowserWorkspace({ children, autosave = workspaceAutosave }: {
  readonly children: ReactNode;
  readonly autosave?: WorkspaceAutosave;
}) {
  const status = useSyncExternalStore(autosave.subscribe, autosave.getStatus);
  const [opened, setOpened] = useState(false);

  function start() {
    void autosave.start().then(() => setOpened(true), () => {});
  }

  useEffect(() => {
    let mounted = true;
    void autosave.start().then(() => { if (mounted) setOpened(true); }, () => {});
    return () => { mounted = false; };
  }, [autosave]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (autosave.hasUnsavedChanges()) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    const onHidden = () => { if (document.visibilityState === 'hidden') void autosave.flush(); };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [autosave]);

  if (!opened) {
    return (
      <main className="workspace-recovery-start" aria-label="Local workspace recovery">
        <h1>{status.state === 'error' ? 'Local recovery needs attention' : 'Restoring your workspace…'}</h1>
        {status.state === 'error' ? <>
          <p role="alert">{status.message} Your existing local copy has not been overwritten.</p>
          <button type="button" className="button button-primary" onClick={start}>Retry local recovery</button>
          {autosave === workspaceAutosave && <SqliteBackupPanel recovery onRestored={() => setOpened(true)} />}
        </> : <p role="status">Checking the saved workspace on this browser before opening the editor.</p>}
      </main>
    );
  }

  return <>
    <aside className={`workspace-autosave-bar ${status.state === 'error' ? 'has-error' : ''}`}
      aria-label="Refresh protection">
      <span role={status.state === 'error' ? 'alert' : 'status'}>
        {status.state === 'error' ? status.message
          : status.state === 'saving' ? 'Saving workspace on this browser… Keep this tab open.'
          : status.state === 'saved' ? `${status.restored ? 'Workspace restored. ' : ''}Workspace saved on this browser. SQLite is the main database.`
          : 'Refresh protection is on. SQLite saves your records and imported Excel data automatically.'}
      </span>
      {status.state === 'error' &&
        <button type="button" className="button button-quiet" onClick={() => void autosave.flush()}>Retry local save</button>}
      <small>Save form edits before refreshing. Use Database → Download SQLite backup for a portable copy, including mobile import.</small>
    </aside>
    {children}
  </>;
}
