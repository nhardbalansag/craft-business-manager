// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BrowserWorkbookExportWorkflowError,
  XLSX_WORKBOOK_MIME_TYPE,
  type BrowserWorkbookExportResult,
} from '../../application/persistence/BrowserWorkbookExportCommand';
import { WorkbookExportPanel, type WorkbookExportCommandPort } from './WorkbookExportPanel';

const successResult: BrowserWorkbookExportResult = {
  status: 'download-dispatched',
  fileName: 'craft-business-manager-2026-09-17-000000.xlsx',
  byteLength: 512,
  mimeType: XLSX_WORKBOOK_MIME_TYPE,
  metadata: {
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

function button(): HTMLButtonElement {
  const found = container.querySelector<HTMLButtonElement>('button');
  if (!found) throw new Error('Missing export button.');
  return found;
}

async function mount(command: WorkbookExportCommandPort) {
  await act(async () => root.render(<WorkbookExportPanel command={command} />));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('WorkbookExportPanel Phase 5.5B2 workflow', () => {
  it('does not export merely because the panel renders', async () => {
    const exportAndDownload = vi.fn(async () => successResult);

    await mount({ exportAndDownload });

    expect(exportAndDownload).not.toHaveBeenCalled();
    expect(button().textContent).toContain('Download workbook');
  });

  it('dispatches one explicit export and shows copy-oriented success feedback', async () => {
    const exportAndDownload = vi.fn(async () => successResult);
    await mount({ exportAndDownload });

    await act(async () => button().click());

    expect(exportAndDownload).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="status"]')?.textContent).toContain(successResult.fileName);
    expect(container.querySelector('[role="status"]')?.textContent).toContain('new workbook copy');
  });

  it('prevents duplicate export submission while one export is active', async () => {
    const pending = deferred<BrowserWorkbookExportResult>();
    const exportAndDownload = vi.fn(() => pending.promise);
    await mount({ exportAndDownload });

    const exportButton = button();
    await act(async () => {
      exportButton.click();
      exportButton.click();
      await Promise.resolve();
    });

    expect(exportAndDownload).toHaveBeenCalledTimes(1);
    expect(button().disabled).toBe(true);
    expect(button().textContent).toContain('Preparing download');

    await act(async () => pending.resolve(successResult));

    expect(button().disabled).toBe(false);
  });

  it('shows controlled browser download failure feedback without success', async () => {
    const failure = new BrowserWorkbookExportWorkflowError(
      'DOWNLOAD_DISPATCH_FAILED',
      'The workbook was exported, but the browser download could not be started.',
      new Error('synthetic dispatch failure'),
    );
    const exportAndDownload = vi.fn(async (): Promise<BrowserWorkbookExportResult> => {
      throw failure;
    });
    await mount({ exportAndDownload });

    await act(async () => button().click());

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'browser download could not be started',
    );
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('allows a retry to succeed after a prior export failure', async () => {
    const failure = new Error('synthetic export failure');
    const exportAndDownload = vi
      .fn<WorkbookExportCommandPort['exportAndDownload']>()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(successResult);
    await mount({ exportAndDownload });

    await act(async () => button().click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('synthetic export failure');

    await act(async () => button().click());

    expect(exportAndDownload).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[role="status"]')?.textContent).toContain(successResult.fileName);
  });

  it('states browser save and backup capabilities truthfully', async () => {
    await mount({ exportAndDownload: vi.fn(async () => successResult) });

    const text = container.textContent ?? '';
    expect(text).toContain('new .xlsx copy');
    expect(text).toContain('does not overwrite');
    expect(text).toContain('does not create a pre-save backup');
    expect(text).toContain('Native Save / Save As');
    expect(text).not.toContain('atomic replacement complete');
    expect(text).not.toContain('backup created');
  });
});
