import { describe, expect, it, vi } from 'vitest';
import type { PersistenceWorkbookExported } from './PersistenceCoordinator';
import {
  BrowserWorkbookExportCommand,
  BrowserWorkbookExportWorkflowError,
  XLSX_WORKBOOK_MIME_TYPE,
  createBrowserWorkbookDownloadFilename,
  type BrowserWorkbookDownloadAdapter,
} from './BrowserWorkbookExportCommand';

const fixedNow = new Date('2026-09-16T09:08:20.000Z');

function createExported(bytes = new Uint8Array([10, 20, 30, 40])): PersistenceWorkbookExported {
  return {
    status: 'exported',
    bytes,
    metadata: {
      exportedAt: '2026-09-16T09:08:20.000Z',
    },
  };
}

function createHarness(exported = createExported()) {
  const exportCurrentWorkbook = vi.fn(async () => exported);
  const blob = new Blob([new Uint8Array([1, 2, 3]).buffer], {
    type: XLSX_WORKBOOK_MIME_TYPE,
  });
  const createBlob = vi.fn((_bytes: Uint8Array, _mimeType: string) => blob);
  const createObjectUrl = vi.fn((_blob: Blob) => 'blob:workbook-export');
  const dispatchDownload = vi.fn((_objectUrl: string, _fileName: string) => undefined);
  const revokeObjectUrl = vi.fn((_objectUrl: string) => undefined);
  const downloadAdapter: BrowserWorkbookDownloadAdapter = {
    createBlob,
    createObjectUrl,
    dispatchDownload,
    revokeObjectUrl,
  };

  return {
    command: new BrowserWorkbookExportCommand(
      { exportCurrentWorkbook },
      {
        clock: () => new Date(fixedNow),
        downloadAdapter,
      },
    ),
    exportCurrentWorkbook,
    createBlob,
    createObjectUrl,
    dispatchDownload,
    revokeObjectUrl,
    blob,
  };
}

describe('BrowserWorkbookExportCommand filename guidance', () => {
  it('creates deterministic UTC timestamped .xlsx filename guidance', () => {
    expect(createBrowserWorkbookDownloadFilename(fixedNow)).toBe(
      'craft-business-manager-2026-09-16-090820.xlsx',
    );
  });

  it('rejects an invalid clock date rather than manufacturing a filename', () => {
    expect(() => createBrowserWorkbookDownloadFilename(new Date(Number.NaN))).toThrow(
      RangeError,
    );
  });
});

describe('BrowserWorkbookExportCommand explicit download boundary', () => {
  it('does not export merely because the command is constructed', () => {
    const { exportCurrentWorkbook } = createHarness();

    expect(exportCurrentWorkbook).not.toHaveBeenCalled();
  });

  it('calls the coordinator exactly once per explicit export command and dispatches one download', async () => {
    const { command, exportCurrentWorkbook, dispatchDownload } = createHarness();

    const result = await command.exportAndDownload();

    expect(exportCurrentWorkbook).toHaveBeenCalledTimes(1);
    expect(dispatchDownload).toHaveBeenCalledTimes(1);
    expect(dispatchDownload).toHaveBeenCalledWith(
      'blob:workbook-export',
      'craft-business-manager-2026-09-16-090820.xlsx',
    );
    expect(result).toMatchObject({
      status: 'download-dispatched',
      fileName: 'craft-business-manager-2026-09-16-090820.xlsx',
      byteLength: 4,
      mimeType: XLSX_WORKBOOK_MIME_TYPE,
    });
  });

  it('passes owned workbook bytes and the exact XLSX MIME type into browser artifact creation', async () => {
    const sourceBytes = new Uint8Array([3, 6, 9]);
    const exported = createExported(sourceBytes);
    const observed: number[][] = [];
    const harness = createHarness(exported);
    harness.createBlob.mockImplementation((bytes: Uint8Array, mimeType: string) => {
      observed.push(Array.from(bytes));
      expect(mimeType).toBe(XLSX_WORKBOOK_MIME_TYPE);
      bytes[0] = 255;
      return harness.blob;
    });

    await harness.command.exportAndDownload();

    expect(observed).toEqual([[3, 6, 9]]);
    expect(Array.from(sourceBytes)).toEqual([3, 6, 9]);
    expect(harness.createBlob).toHaveBeenCalledTimes(1);
  });

  it('creates the object URL from the created workbook Blob and always revokes it after success', async () => {
    const harness = createHarness();

    await harness.command.exportAndDownload();

    expect(harness.createObjectUrl).toHaveBeenCalledWith(harness.blob);
    expect(harness.revokeObjectUrl).toHaveBeenCalledTimes(1);
    expect(harness.revokeObjectUrl).toHaveBeenCalledWith('blob:workbook-export');
    expect(harness.dispatchDownload.mock.invocationCallOrder[0]!).toBeLessThan(
      harness.revokeObjectUrl.mock.invocationCallOrder[0]!,
    );
  });

  it('revokes the temporary object URL even when download dispatch throws', async () => {
    const harness = createHarness();
    const failure = new Error('synthetic click failure');
    harness.dispatchDownload.mockImplementation(() => {
      throw failure;
    });

    try {
      await harness.command.exportAndDownload();
      throw new Error('expected dispatch failure');
    } catch (error) {
      expect(error).toBeInstanceOf(BrowserWorkbookExportWorkflowError);
      expect(error).toMatchObject({
        code: 'DOWNLOAD_DISPATCH_FAILED',
        causeValue: failure,
      });
    }

    expect(harness.revokeObjectUrl).toHaveBeenCalledWith('blob:workbook-export');
  });

  it('maps browser artifact preparation failure to a controlled workflow error without dispatching', async () => {
    const harness = createHarness();
    const failure = new Error('object URL unavailable');
    harness.createObjectUrl.mockImplementation(() => {
      throw failure;
    });

    await expect(harness.command.exportAndDownload()).rejects.toMatchObject({
      name: 'BrowserWorkbookExportWorkflowError',
      code: 'DOWNLOAD_PREPARATION_FAILED',
      causeValue: failure,
    });

    expect(harness.dispatchDownload).not.toHaveBeenCalled();
    expect(harness.revokeObjectUrl).not.toHaveBeenCalled();
  });

  it('reports cleanup failure separately after a successful dispatch', async () => {
    const harness = createHarness();
    const failure = new Error('revoke failed');
    harness.revokeObjectUrl.mockImplementation(() => {
      throw failure;
    });

    await expect(harness.command.exportAndDownload()).rejects.toMatchObject({
      name: 'BrowserWorkbookExportWorkflowError',
      code: 'DOWNLOAD_CLEANUP_FAILED',
      causeValue: failure,
    });

    expect(harness.dispatchDownload).toHaveBeenCalledTimes(1);
  });

  it('preserves the dispatch failure as primary when dispatch and cleanup both fail', async () => {
    const harness = createHarness();
    const dispatchFailure = new Error('dispatch failed');
    const cleanupFailure = new Error('cleanup failed');
    harness.dispatchDownload.mockImplementation(() => {
      throw dispatchFailure;
    });
    harness.revokeObjectUrl.mockImplementation(() => {
      throw cleanupFailure;
    });

    await expect(harness.command.exportAndDownload()).rejects.toMatchObject({
      name: 'BrowserWorkbookExportWorkflowError',
      code: 'DOWNLOAD_DISPATCH_FAILED',
      causeValue: dispatchFailure,
      cleanupCauseValue: cleanupFailure,
    });
  });

  it('lets coordinator snapshot/export operational errors propagate unchanged and never prepares a browser artifact', async () => {
    const failure = new Error('synthetic coordinator failure');
    const exportCurrentWorkbook = vi.fn(async (): Promise<PersistenceWorkbookExported> => {
      throw failure;
    });
    const harness = createHarness();
    const command = new BrowserWorkbookExportCommand(
      { exportCurrentWorkbook },
      {
        clock: () => new Date(fixedNow),
        downloadAdapter: {
          createBlob: harness.createBlob,
          createObjectUrl: harness.createObjectUrl,
          dispatchDownload: harness.dispatchDownload,
          revokeObjectUrl: harness.revokeObjectUrl,
        },
      },
    );

    await expect(command.exportAndDownload()).rejects.toBe(failure);
    expect(exportCurrentWorkbook).toHaveBeenCalledTimes(1);
    expect(harness.createBlob).not.toHaveBeenCalled();
    expect(harness.createObjectUrl).not.toHaveBeenCalled();
    expect(harness.dispatchDownload).not.toHaveBeenCalled();
  });

  it('returns browser-copy metadata without inventing a transport receipt, native path, backup, or atomicity claim', async () => {
    const { command } = createHarness();

    const result = await command.exportAndDownload();

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.metadata)).toBe(true);
    expect(result).not.toHaveProperty('receipt');
    expect(result).not.toHaveProperty('path');
    expect(result).not.toHaveProperty('backup');
    expect(result).not.toHaveProperty('atomic');
  });

  it('performs a fresh coordinator export and browser dispatch for each sequential explicit command', async () => {
    const harness = createHarness();

    await harness.command.exportAndDownload();
    await harness.command.exportAndDownload();

    expect(harness.exportCurrentWorkbook).toHaveBeenCalledTimes(2);
    expect(harness.dispatchDownload).toHaveBeenCalledTimes(2);
    expect(harness.revokeObjectUrl).toHaveBeenCalledTimes(2);
  });
});
