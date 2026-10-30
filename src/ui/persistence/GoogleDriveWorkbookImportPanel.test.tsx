// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { GoogleDriveImportError, type PendingGoogleDriveWorkbook } from '../../application/persistence/GoogleDriveWorkbookImportCommand';
import { getGoogleDriveApiKey } from '../../application/persistence/googleDriveImportPreferences';
import type { PersistenceWorkbookApplyResult } from '../../application/persistence/PersistenceCoordinator';
import { GoogleDriveWorkbookImportPanel, type GoogleDriveWorkbookImportPort } from './GoogleDriveWorkbookImportPanel';

const selection: PendingGoogleDriveWorkbook = { name: 'My Craft Data.xlsx', byteLength: 2048,
  fileId: 'excel_file_123456789', sourceUrl: 'https://drive.google.com/file/d/excel_file_123456789/view' };
const hydrated: PersistenceWorkbookApplyResult = { status: 'hydrated', metadata: {
  formatId: 'craft-business-manager', workbookFormatVersion: 5, datasetSchemaVersion: 5,
  exportedAt: '2026-10-30T00:00:00.000Z',
} };
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  window.localStorage.clear();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function command(result: PersistenceWorkbookApplyResult = hydrated) {
  let pending: PendingGoogleDriveWorkbook | null = null;
  return {
    getPendingSelection: () => pending,
    clearSelection: vi.fn(() => { pending = null; }),
    loadWorkbook: vi.fn(async () => { pending = selection; return selection; }),
    applyPendingSelection: vi.fn(async () => result),
  } satisfies GoogleDriveWorkbookImportPort;
}

async function fill(selector: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(selector)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function click(label: string) {
  const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === label);
  if (!button) throw new Error(`Missing button ${label}`);
  await act(async () => button.click());
}

async function mount(port = command(), onHydrated = vi.fn()) {
  await act(async () => root.render(<GoogleDriveWorkbookImportPanel command={port} onHydrated={onHydrated} />));
  return { port, onHydrated };
}

async function fetchWorkbook() {
  await fill('.google-drive-import-panel input[type="url"]', selection.sourceUrl);
  await click('Fetch Excel from Drive');
}

describe('Google Drive Excel import UI', () => {
  it('keeps fetch non-destructive, confirms apply, and refreshes only after success', async () => {
    const { port, onHydrated } = await mount();
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    await fetchWorkbook();
    expect(container.querySelector('[aria-label="Fetched Drive Excel file"]')?.textContent).toContain(selection.name);
    expect(port.applyPendingSelection).not.toHaveBeenCalled();
    await click('Apply Drive import');
    expect(port.applyPendingSelection).not.toHaveBeenCalled();
    await click('Apply Drive import');
    expect(onHydrated).toHaveBeenCalledWith({ selection: { name: selection.name, byteLength: selection.byteLength }, result: hydrated });
    expect(port.getPendingSelection()).toBeNull();
  });

  it('clears fetched evidence when the URL changes', async () => {
    const { port } = await mount();
    await fetchWorkbook();
    await fill('input[type="url"]', 'https://drive.google.com/file/d/another-file/view');
    expect(port.getPendingSelection()).toBeNull();
    expect(container.querySelector('[aria-label="Fetched Drive Excel file"]')).toBeNull();
    expect(Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Apply Drive import')!.disabled).toBe(true);
  });

  it('shows fetch failure guidance without hydrating', async () => {
    const port = command();
    port.loadWorkbook.mockRejectedValueOnce(new GoogleDriveImportError('DRIVE_FILE_NOT_ACCESSIBLE', 'Allow Anyone with the link to view and download.'));
    const { onHydrated } = await mount(port);
    await fetchWorkbook();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('DRIVE_FILE_NOT_ACCESSIBLE');
    expect(port.applyPendingSelection).not.toHaveBeenCalled();
    expect(onHydrated).not.toHaveBeenCalled();
  });

  it('preserves the workspace and pending file when normal workbook validation rejects it', async () => {
    const result: PersistenceWorkbookApplyResult = { status: 'rejected', stage: 'import', issues: [{
      stage: 'schema', code: 'MISSING_SHEET', message: 'Missing Materials sheet.', sheetName: 'Materials',
    }] };
    const { port, onHydrated } = await mount(command(result));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await fetchWorkbook();
    await click('Apply Drive import');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('current workspace was not refreshed');
    expect(container.textContent).toContain('MISSING_SHEET');
    expect(container.querySelector('[aria-label="Raw workbook validation issues"]')).not.toBeNull();
    expect(port.getPendingSelection()?.name).toBe(selection.name);
    expect(onHydrated).not.toHaveBeenCalled();
  });

  it('saves the one-time key and remembers only the last URL, with no automatic import on remount', async () => {
    await mount();
    await fill('input[type="password"]', 'browser-key-for-testing-123456');
    await click('Save Drive setup');
    expect(getGoogleDriveApiKey()).toBe('browser-key-for-testing-123456');
    await fetchWorkbook();
    await act(async () => root.render(null));
    const fresh = command();
    await mount(fresh);
    expect(container.querySelector<HTMLInputElement>('input[type="url"]')!.value).toBe(selection.sourceUrl);
    expect(fresh.loadWorkbook).not.toHaveBeenCalled();
    expect(fresh.applyPendingSelection).not.toHaveBeenCalled();
  });

  it('integrates with App workbook identity and refreshes the workspace once', async () => {
    const port = command();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await act(async () => root.render(<App googleDriveWorkbookImportCommand={port} />));
    expect(container.querySelector<HTMLElement>('.workbook-tools-overlay')?.hidden).toBe(true);
    await fetchWorkbook();
    expect(container.querySelector('.workspace-revision-boundary')?.getAttribute('data-workspace-revision')).toBe('0');
    await click('Apply Drive import');
    expect(container.querySelector('.workspace-revision-boundary')?.getAttribute('data-workspace-revision')).toBe('1');
    expect(container.querySelector('.workbook-tools-trigger')?.textContent).toContain(selection.name);
    expect(container.querySelector('[aria-label="Active imported workbook"]')?.textContent).toContain(selection.name);
  });
});
