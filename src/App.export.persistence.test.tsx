// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import {
  XLSX_WORKBOOK_MIME_TYPE,
  type BrowserWorkbookExportResult,
} from './application/persistence/BrowserWorkbookExportCommand';
import { BrowserWorkbookImportCommand } from './application/persistence/BrowserWorkbookImportCommand';
import type { PersistenceWorkbookApplyResult } from './application/persistence/PersistenceCoordinator';
import type { WorkbookExportCommandPort } from './ui/persistence/WorkbookExportPanel';

const exportResult: BrowserWorkbookExportResult = {
  status: 'download-dispatched',
  fileName: 'craft-business-manager-2026-09-17-000000.xlsx',
  byteLength: 1_024,
  mimeType: XLSX_WORKBOOK_MIME_TYPE,
  metadata: {
    exportedAt: '2026-09-17T00:00:00.000Z',
  },
};

const hydratedResult: PersistenceWorkbookApplyResult = {
  status: 'hydrated',
  metadata: {
    formatId: 'craft-business-manager',
    workbookFormatVersion: 1,
    datasetSchemaVersion: 1,
    exportedAt: '2026-09-17T00:00:00.000Z',
  },
};

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

function button(text: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll('button')).find((item) =>
    item.textContent?.includes(text),
  );
  if (!found) throw new Error(`Missing button: ${text}`);
  return found;
}

async function click(text: string) {
  await act(async () => button(text).click());
}

function workspaceRevision(): string | null {
  return container.querySelector('.workspace-revision-boundary')?.getAttribute('data-workspace-revision') ?? null;
}

function activeNavigation(): string | undefined {
  return Array.from(container.querySelectorAll('.nav-item')).find((item) =>
    item.classList.contains('active'),
  )?.textContent ?? undefined;
}

function workbookFile(): File {
  return {
    name: 'replacement.xlsx',
    size: 3,
    arrayBuffer: vi.fn(async () => new Uint8Array([1, 2, 3]).buffer),
  } as unknown as File;
}

async function chooseWorkbook() {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('Missing workbook file input.');
  Object.defineProperty(input, 'files', { configurable: true, value: [workbookFile()] });
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
}

function exportCommand(exportAndDownload = vi.fn(async () => exportResult)): WorkbookExportCommandPort {
  return { exportAndDownload };
}

describe('App Phase 5.5B2 export/save-copy integration', () => {
  it('keeps workspace revision and active navigation stable after a successful export', async () => {
    const exportAndDownload = vi.fn(async () => exportResult);
    const importCommand = new BrowserWorkbookImportCommand({
      importAndApplyWorkbook: vi.fn(async () => hydratedResult),
    });

    await act(async () =>
      root.render(
        <App workbookImportCommand={importCommand} workbookExportCommand={exportCommand(exportAndDownload)} />,
      ),
    );

    expect(exportAndDownload).not.toHaveBeenCalled();
    expect(workspaceRevision()).toBe('0');

    await click('Products');
    expect(activeNavigation()).toBe('Products');

    await click('Download workbook');

    expect(exportAndDownload).toHaveBeenCalledTimes(1);
    expect(workspaceRevision()).toBe('0');
    expect(activeNavigation()).toBe('Products');
    expect(container.querySelector('[role="status"]')?.textContent).toContain('new workbook copy');
  });

  it('keeps the import/replace workflow functional beside the export surface', async () => {
    const exportAndDownload = vi.fn(async () => exportResult);
    const importAndApplyWorkbook = vi.fn(async () => hydratedResult);
    const importCommand = new BrowserWorkbookImportCommand({ importAndApplyWorkbook });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await act(async () =>
      root.render(
        <App workbookImportCommand={importCommand} workbookExportCommand={exportCommand(exportAndDownload)} />,
      ),
    );

    expect(container.textContent).toContain('Open / Import workbook');
    expect(container.textContent).toContain('Download workbook');

    await chooseWorkbook();
    await click('Apply import');

    expect(importAndApplyWorkbook).toHaveBeenCalledTimes(1);
    expect(exportAndDownload).not.toHaveBeenCalled();
    expect(workspaceRevision()).toBe('1');
  });
});
