// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App, { type PersistenceUiClock } from './App';
import {
  XLSX_WORKBOOK_MIME_TYPE,
  type BrowserWorkbookExportResult,
} from './application/persistence/BrowserWorkbookExportCommand';
import { BrowserWorkbookImportCommand } from './application/persistence/BrowserWorkbookImportCommand';
import type { PersistenceWorkbookApplyResult } from './application/persistence/PersistenceCoordinator';
import { CURRENT_BUSINESS_DATASET_SCHEMA_VERSION } from './domain/businessDataset';
import {
  CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
  CURRENT_WORKBOOK_FORMAT_VERSION,
} from './storage/workbookSchema';
import type { WorkbookExportCommandPort } from './ui/persistence/WorkbookExportPanel';

const hydrated: PersistenceWorkbookApplyResult = {
  status: 'hydrated',
  metadata: {
    formatId: CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
    workbookFormatVersion: CURRENT_WORKBOOK_FORMAT_VERSION,
    datasetSchemaVersion: CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
    exportedAt: '2026-09-17T00:15:00.000Z',
  },
};

const rejected: PersistenceWorkbookApplyResult = {
  status: 'rejected',
  stage: 'hydrate',
  issues: [
    {
      code: 'INVALID_RECORD',
      message: 'Synthetic invalid product.',
      path: 'products[0]',
    },
  ],
};

const exported: BrowserWorkbookExportResult = {
  status: 'download-dispatched',
  fileName: 'craft-business-manager-2026-09-17-020000.xlsx',
  byteLength: 2_048,
  mimeType: XLSX_WORKBOOK_MIME_TYPE,
  metadata: { exportedAt: '2026-09-17T02:00:00.000Z' },
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

function exactArrayBuffer(bytes: readonly number[]): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.length);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function workbookFile(name: string, bytes: readonly number[] = [1, 2, 3, 4]): File {
  return {
    name,
    size: bytes.length,
    arrayBuffer: vi.fn(async () => exactArrayBuffer(bytes)),
  } as unknown as File;
}

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

async function choose(file: File) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('Missing workbook file input.');
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
}

function revision(): string | null {
  return container.querySelector('.workspace-revision-boundary')?.getAttribute('data-workspace-revision') ?? null;
}

function activeNavigation(): string | undefined {
  return Array.from(container.querySelectorAll('.nav-item')).find((item) =>
    item.classList.contains('active'),
  )?.textContent ?? undefined;
}

function statusCard(label: string): HTMLElement {
  const found = container.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  if (!found) throw new Error(`Missing status card: ${label}`);
  return found;
}

function sequenceClock(...instants: string[]): PersistenceUiClock & ReturnType<typeof vi.fn> {
  const values = [...instants];
  return vi.fn(() => {
    const next = values.shift();
    if (next === undefined) throw new Error('Unexpected persistence UI clock call.');
    return new Date(next);
  });
}

async function mount(
  importAndApplyWorkbook = vi.fn(async () => hydrated),
  exportAndDownload = vi.fn(async () => exported),
  persistenceUiClock: PersistenceUiClock = () => new Date('2026-09-17T01:00:00.000Z'),
) {
  const importCommand = new BrowserWorkbookImportCommand({ importAndApplyWorkbook });
  const exportCommand: WorkbookExportCommandPort = { exportAndDownload };
  await act(async () =>
    root.render(
      <App
        workbookImportCommand={importCommand}
        workbookExportCommand={exportCommand}
        persistenceUiClock={persistenceUiClock}
      />,
    ),
  );
  return { importCommand, importAndApplyWorkbook, exportAndDownload };
}

describe('App Phase 5.5C1 persistence session status', () => {
  it('starts with current contract versions and no invented import/export identity', async () => {
    const { importAndApplyWorkbook, exportAndDownload } = await mount();

    const text = container.textContent ?? '';
    expect(text).toContain(CRAFT_BUSINESS_WORKBOOK_FORMAT_ID);
    expect(text).toContain(`Workbook v${CURRENT_WORKBOOK_FORMAT_VERSION}`);
    expect(text).toContain(`Dataset schema v${CURRENT_BUSINESS_DATASET_SCHEMA_VERSION}`);
    expect(statusCard('Active imported workbook').textContent).toContain(
      'No imported workbook identity is known',
    );
    expect(statusCard('Last downloaded workbook copy').textContent).toContain(
      'No workbook copy has been downloaded successfully',
    );
    expect(importAndApplyWorkbook).not.toHaveBeenCalled();
    expect(exportAndDownload).not.toHaveBeenCalled();
  });

  it('records successful import identity and metadata while refreshing the workspace exactly once', async () => {
    const clock = sequenceClock('2026-09-17T01:30:00.000Z');
    await mount(vi.fn(async () => hydrated), vi.fn(async () => exported), clock);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await click('Products');
    await choose(workbookFile('owner-data.xlsx'));
    await click('Apply import');

    const importedCard = statusCard('Active imported workbook').textContent ?? '';
    expect(importedCard).toContain('owner-data.xlsx');
    expect(importedCard).toContain('4 B');
    expect(importedCard).toContain('Imported into this session 2026-09-17 01:30:00 UTC');
    expect(importedCard).toContain('Workbook metadata exported 2026-09-17 00:15:00 UTC');
    expect(revision()).toBe('1');
    expect(activeNavigation()).toBe('Products');
    expect(clock).toHaveBeenCalledTimes(1);
  });

  it('does not replace the last successful import status after a later rejection or operational failure', async () => {
    const operationalFailure = new Error('synthetic import operation failure');
    const importAndApplyWorkbook = vi
      .fn<(bytes: Uint8Array) => Promise<PersistenceWorkbookApplyResult>>()
      .mockResolvedValueOnce(hydrated)
      .mockResolvedValueOnce(rejected)
      .mockRejectedValueOnce(operationalFailure);
    const clock = sequenceClock('2026-09-17T01:30:00.000Z');
    await mount(importAndApplyWorkbook, vi.fn(async () => exported), clock);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await choose(workbookFile('known-good.xlsx'));
    await click('Apply import');
    expect(revision()).toBe('1');

    await choose(workbookFile('rejected.xlsx'));
    await click('Apply import');
    expect(statusCard('Active imported workbook').textContent).toContain('known-good.xlsx');
    expect(statusCard('Active imported workbook').textContent).not.toContain('rejected.xlsx');
    expect(revision()).toBe('1');

    await choose(workbookFile('failed.xlsx'));
    await click('Apply import');
    expect(statusCard('Active imported workbook').textContent).toContain('known-good.xlsx');
    expect(statusCard('Active imported workbook').textContent).not.toContain('failed.xlsx');
    expect(revision()).toBe('1');
    expect(clock).toHaveBeenCalledTimes(1);
  });

  it('records a successful downloaded copy without replacing imported identity, remounting, or changing navigation', async () => {
    const clock = sequenceClock(
      '2026-09-17T01:30:00.000Z',
      '2026-09-17T02:05:00.000Z',
    );
    await mount(vi.fn(async () => hydrated), vi.fn(async () => exported), clock);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await choose(workbookFile('active-import.xlsx'));
    await click('Apply import');
    await click('Pricing');
    await click('Download workbook');

    expect(statusCard('Active imported workbook').textContent).toContain('active-import.xlsx');
    const exportCard = statusCard('Last downloaded workbook copy').textContent ?? '';
    expect(exportCard).toContain(exported.fileName);
    expect(exportCard).toContain('Download dispatched 2026-09-17 02:05:00 UTC');
    expect(revision()).toBe('1');
    expect(activeNavigation()).toBe('Pricing');
    expect(clock).toHaveBeenCalledTimes(2);
  });

  it('keeps the last successful export status after a later failed export', async () => {
    const exportAndDownload = vi
      .fn<WorkbookExportCommandPort['exportAndDownload']>()
      .mockResolvedValueOnce(exported)
      .mockRejectedValueOnce(new Error('synthetic download failure'));
    const clock = sequenceClock('2026-09-17T02:05:00.000Z');
    await mount(vi.fn(async () => hydrated), exportAndDownload, clock);

    await click('Download workbook');
    expect(statusCard('Last downloaded workbook copy').textContent).toContain(exported.fileName);

    await click('Download workbook');

    expect(container.querySelector('.workbook-export-panel [role="alert"]')?.textContent).toContain(
      'synthetic download failure',
    );
    expect(statusCard('Last downloaded workbook copy').textContent).toContain(exported.fileName);
    expect(clock).toHaveBeenCalledTimes(1);
    expect(revision()).toBe('0');
  });
});
