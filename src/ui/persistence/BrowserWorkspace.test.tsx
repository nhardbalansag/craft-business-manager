// @vitest-environment jsdom
import { StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyBusinessDatasetV2 } from '../../domain/businessDatasetV2';
import { extendBusinessDatasetV2 } from '../../domain/physicalBusinessDatasetV3';
import { extendPhysicalBusinessDatasetV3 } from '../../domain/physicalBusinessDatasetV4';
import { extendPhysicalBusinessDatasetV4 } from '../../domain/physicalBusinessDatasetV5';
import { WorkspaceAutosave } from '../../application/persistence/WorkspaceAutosave';
import { WorkspaceChangeTracker } from '../../application/persistence/WorkspaceChangeTracker';
import type { WorkspaceRecoveryStore } from '../../storage/BrowserWorkspaceStore';
import { BrowserWorkspace } from './BrowserWorkspace';
import { useRefreshDraftWarning } from './useRefreshDraftWarning';

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function setup(store: WorkspaceRecoveryStore) {
  const dataset = extendPhysicalBusinessDatasetV4(extendPhysicalBusinessDatasetV3(
    extendBusinessDatasetV2(createEmptyBusinessDatasetV2()),
  ));
  const changes = new WorkspaceChangeTracker();
  const hydrate = vi.fn(async () => ({ status: 'hydrated' as const }));
  const autosave = new WorkspaceAutosave({ snapshot: async () => dataset }, { hydrate }, store, changes);
  return { autosave, changes, hydrate };
}

describe('BrowserWorkspace recovery gate', () => {
  it('blocks editing until startup storage is read, including StrictMode startup', async () => {
    let resolve!: (value: undefined) => void;
    const load = vi.fn(() => new Promise<undefined>((done) => { resolve = done; }));
    const { autosave } = setup({ load, save: vi.fn() });
    await act(async () => root.render(<StrictMode><BrowserWorkspace autosave={autosave}><p>Editor</p></BrowserWorkspace></StrictMode>));
    expect(container.textContent).toContain('Restoring your workspace');
    expect(container.textContent).not.toContain('Editor');
    await act(async () => resolve(undefined));
    expect(container.textContent).toContain('Editor');
    expect(container.textContent).toContain('Refresh protection is on');
    expect(load).toHaveBeenCalledOnce();
  });

  it('keeps the editor gated on restore failure and can retry safely', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('Storage blocked')).mockResolvedValue(undefined);
    const save = vi.fn();
    const { autosave } = setup({ load, save });
    await act(async () => root.render(<BrowserWorkspace autosave={autosave}><p>Editor</p></BrowserWorkspace>));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Storage blocked');
    expect(container.textContent).not.toContain('Editor');
    await act(async () => Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Retry local recovery')!.click());
    expect(container.textContent).toContain('Editor');
    expect(save).not.toHaveBeenCalled();
  });

  it('warns before refresh while a change is uncommitted, then removes the warning after save', async () => {
    let finish!: () => void;
    const save = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const { autosave, changes } = setup({ load: async () => undefined, save });
    await act(async () => root.render(<BrowserWorkspace autosave={autosave}><p>Editor</p></BrowserWorkspace>));
    await act(async () => changes.batch(async () => {}, true));
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    let saving!: Promise<void>;
    await act(async () => { saving = autosave.flush(); await Promise.resolve(); });
    expect(container.textContent).toContain('Saving workspace');
    await act(async () => { finish(); await saving; });
    expect(container.textContent).toContain('Workspace saved');
    const savedEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(savedEvent);
    expect(savedEvent.defaultPrevented).toBe(false);
  });

  it('warns for an unfinished form draft and removes the warning once it is saved or discarded', async () => {
    function Draft({ dirty }: { dirty: boolean }) { useRefreshDraftWarning(dirty); return null; }
    await act(async () => root.render(<Draft dirty />));
    const pending = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(pending);
    expect(pending.defaultPrevented).toBe(true);
    await act(async () => root.render(<Draft dirty={false} />));
    const saved = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(saved);
    expect(saved.defaultPrevented).toBe(false);
  });
});
