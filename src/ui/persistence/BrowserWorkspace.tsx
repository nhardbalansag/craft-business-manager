import { type ReactNode, useEffect, useState, useSyncExternalStore } from 'react';
import { workspaceAutosave } from '../../application/session';
import type { WorkspaceAutosave } from '../../application/persistence/WorkspaceAutosave';
import './browserWorkspace.css';

/** Block editing until recovery finishes, so an empty startup cannot overwrite saved data. */
export function BrowserWorkspace({ children, autosave = workspaceAutosave }: {
  readonly children: ReactNode;
  readonly autosave?: WorkspaceAutosave;
}) {
  const status = useSyncExternalStore(autosave.subscribe, autosave.getStatus);
  const [opened, setOpened] = useState(false);
  const [withoutRecovery, setWithoutRecovery] = useState(false);

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

  if (!opened && !withoutRecovery) {
    return (
      <main className="workspace-recovery-start" aria-label="Local workspace recovery">
        <h1>{status.state === 'error' ? 'Local recovery needs attention' : 'Restoring your workspace…'}</h1>
        {status.state === 'error' ? <>
          <p role="alert">{status.message} Your existing local copy has not been overwritten.</p>
          <button type="button" className="button button-primary" onClick={start}>Retry local recovery</button>
          <button type="button" className="button button-quiet" onClick={() => setWithoutRecovery(true)}>
            Continue without refresh protection
          </button>
        </> : <p role="status">Checking the saved workspace on this browser before opening the editor.</p>}
      </main>
    );
  }

  return <>
    <aside className={`workspace-autosave-bar ${status.state === 'error' ? 'has-error' : ''}`}
      aria-label="Refresh protection">
      <span role={status.state === 'error' ? 'alert' : 'status'}>
        {withoutRecovery ? 'Refresh protection is unavailable. Download a workbook before leaving this page.'
          : status.state === 'error' ? status.message
          : status.state === 'saving' ? 'Saving workspace on this browser… Keep this tab open.'
          : status.state === 'saved' ? `${status.restored ? 'Workspace restored. ' : ''}Workspace saved on this browser.`
          : 'Refresh protection is on. Saved records and workbook imports recover automatically.'}
      </span>
      {status.state === 'error' && !withoutRecovery &&
        <button type="button" className="button button-quiet" onClick={() => void autosave.flush()}>Retry local save</button>}
      <small>Save form edits before refreshing. Download workbook copies for backups outside this browser.</small>
    </aside>
    {children}
  </>;
}
