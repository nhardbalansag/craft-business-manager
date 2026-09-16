import { describe, expect, it, vi } from 'vitest';
import type { PersistenceWorkbookApplyResult } from './PersistenceCoordinator';
import {
  BrowserWorkbookImportCommand,
  BrowserWorkbookImportWorkflowError,
  type BrowserWorkbookFileInput,
} from './BrowserWorkbookImportCommand';

const hydratedResult: PersistenceWorkbookApplyResult = {
  status: 'hydrated',
  metadata: {
    formatId: 'craft-business-manager',
    workbookFormatVersion: 1,
    datasetSchemaVersion: 1,
    exportedAt: '2026-09-16T05:30:00.000Z',
  },
};

const rejectedResult: PersistenceWorkbookApplyResult = {
  status: 'rejected',
  stage: 'hydrate',
  issues: [
    {
      code: 'INVALID_RECORD',
      message: 'Synthetic hydration rejection.',
      path: 'products[0]',
    },
  ],
};

function createFile(
  name: string,
  bytes: Uint8Array,
  arrayBufferImpl: () => Promise<ArrayBuffer> = async () => bytes.buffer,
): BrowserWorkbookFileInput & { arrayBuffer: ReturnType<typeof vi.fn> } {
  return {
    name,
    size: bytes.byteLength,
    arrayBuffer: vi.fn(arrayBufferImpl),
  };
}

function createCommand(result: PersistenceWorkbookApplyResult = hydratedResult) {
  const importAndApplyWorkbook = vi.fn(async (_bytes: Uint8Array) => result);
  return {
    command: new BrowserWorkbookImportCommand({ importAndApplyWorkbook }),
    importAndApplyWorkbook,
  };
}

describe('BrowserWorkbookImportCommand selection boundary', () => {
  it('selects a .xlsx file, owns its bytes, and exposes only immutable basic identity', async () => {
    const source = new Uint8Array([10, 20, 30, 40]);
    const file = createFile('craft-business.xlsx', source);
    const { command, importAndApplyWorkbook } = createCommand();

    const result = await command.selectFile(file);
    source[0] = 99;

    expect(result).toEqual({
      status: 'selected',
      selection: { name: 'craft-business.xlsx', byteLength: 4 },
    });
    expect(Object.isFrozen(result.selection)).toBe(true);
    expect(command.getPendingSelection()).toEqual({
      name: 'craft-business.xlsx',
      byteLength: 4,
    });
    expect(importAndApplyWorkbook).not.toHaveBeenCalled();

    await command.applyPendingSelection();
    expect(importAndApplyWorkbook).toHaveBeenCalledWith(new Uint8Array([10, 20, 30, 40]));
  });

  it('accepts the .xlsx extension case-insensitively without treating the filename as content validation', async () => {
    const { command } = createCommand(rejectedResult);

    await expect(command.selectFile(createFile('BUSINESS.XLSX', new Uint8Array([1, 2, 3])))).resolves.toMatchObject({
      status: 'selected',
      selection: { name: 'BUSINESS.XLSX', byteLength: 3 },
    });

    await expect(command.applyPendingSelection()).resolves.toBe(rejectedResult);
  });

  it('treats file chooser cancellation as a non-error no-op and preserves the current pending selection', async () => {
    const { command, importAndApplyWorkbook } = createCommand();
    await command.selectFile(createFile('first.xlsx', new Uint8Array([1, 2])));

    const cancelled = await command.selectFile(null);

    expect(cancelled).toEqual({
      status: 'cancelled',
      selection: { name: 'first.xlsx', byteLength: 2 },
    });
    expect(command.getPendingSelection()).toEqual({ name: 'first.xlsx', byteLength: 2 });
    expect(importAndApplyWorkbook).not.toHaveBeenCalled();
  });

  it('rejects unsupported filename extensions before reading bytes and preserves an existing pending selection', async () => {
    const { command } = createCommand();
    await command.selectFile(createFile('first.xlsx', new Uint8Array([1])));
    const wrongFile = createFile('not-a-workbook.csv', new Uint8Array([2]));

    await expect(command.selectFile(wrongFile)).rejects.toMatchObject({
      name: 'BrowserWorkbookImportWorkflowError',
      code: 'UNSUPPORTED_FILE_EXTENSION',
    });
    expect(wrongFile.arrayBuffer).not.toHaveBeenCalled();
    expect(command.getPendingSelection()).toEqual({ name: 'first.xlsx', byteLength: 1 });
  });

  it('maps browser file-read failure to a controlled workflow error and preserves the prior pending selection', async () => {
    const { command } = createCommand();
    await command.selectFile(createFile('first.xlsx', new Uint8Array([1, 2])));
    const failure = new Error('browser read failed');
    const unreadable = createFile(
      'broken.xlsx',
      new Uint8Array([9]),
      async () => {
        throw failure;
      },
    );

    try {
      await command.selectFile(unreadable);
      throw new Error('expected file-read failure');
    } catch (error) {
      expect(error).toBeInstanceOf(BrowserWorkbookImportWorkflowError);
      expect(error).toMatchObject({ code: 'FILE_READ_FAILED', causeValue: failure });
    }

    expect(command.getPendingSelection()).toEqual({ name: 'first.xlsx', byteLength: 2 });
  });

  it('uses the acquired byte length rather than trusting caller-supplied file size metadata', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const file = createFile('size.xlsx', bytes);
    Object.defineProperty(file, 'size', { value: 999_999 });
    const { command } = createCommand();

    const result = await command.selectFile(file);

    expect(result).toEqual({
      status: 'selected',
      selection: { name: 'size.xlsx', byteLength: 3 },
    });
  });

  it('can explicitly clear a pending selection without invoking persistence', async () => {
    const { command, importAndApplyWorkbook } = createCommand();
    await command.selectFile(createFile('clear-me.xlsx', new Uint8Array([1, 2, 3])));

    command.clearSelection();

    expect(command.getPendingSelection()).toBeNull();
    expect(importAndApplyWorkbook).not.toHaveBeenCalled();
  });
});

describe('BrowserWorkbookImportCommand explicit apply boundary', () => {
  it('requires a pending workbook before apply and never calls the coordinator otherwise', async () => {
    const { command, importAndApplyWorkbook } = createCommand();

    await expect(command.applyPendingSelection()).rejects.toMatchObject({
      name: 'BrowserWorkbookImportWorkflowError',
      code: 'NO_PENDING_WORKBOOK',
    });
    expect(importAndApplyWorkbook).not.toHaveBeenCalled();
  });

  it('calls the coordinator exactly once for each explicit apply command and never during selection', async () => {
    const { command, importAndApplyWorkbook } = createCommand();
    await command.selectFile(createFile('apply.xlsx', new Uint8Array([4, 5, 6])));
    expect(importAndApplyWorkbook).not.toHaveBeenCalled();

    await command.applyPendingSelection();

    expect(importAndApplyWorkbook).toHaveBeenCalledTimes(1);
  });

  it('returns the coordinator rejection object unchanged instead of manufacturing success', async () => {
    const { command } = createCommand(rejectedResult);
    await command.selectFile(createFile('rejected.xlsx', new Uint8Array([1, 2, 3])));

    const result = await command.applyPendingSelection();

    expect(result).toBe(rejectedResult);
    expect(result.status).toBe('rejected');
  });

  it('lets coordinator operational errors propagate unchanged', async () => {
    const failure = new Error('synthetic persistence failure');
    const importAndApplyWorkbook = vi.fn(async (_bytes: Uint8Array): Promise<PersistenceWorkbookApplyResult> => {
      throw failure;
    });
    const command = new BrowserWorkbookImportCommand({ importAndApplyWorkbook });
    await command.selectFile(createFile('failure.xlsx', new Uint8Array([1])));

    await expect(command.applyPendingSelection()).rejects.toBe(failure);
    expect(importAndApplyWorkbook).toHaveBeenCalledTimes(1);
  });

  it('passes a fresh defensive byte copy to every explicit apply call', async () => {
    const observed: number[][] = [];
    const importAndApplyWorkbook = vi.fn(async (bytes: Uint8Array): Promise<PersistenceWorkbookApplyResult> => {
      observed.push(Array.from(bytes));
      bytes[0] = 255;
      return hydratedResult;
    });
    const command = new BrowserWorkbookImportCommand({ importAndApplyWorkbook });
    await command.selectFile(createFile('owned.xlsx', new Uint8Array([7, 8, 9])));

    await command.applyPendingSelection();
    await command.applyPendingSelection();

    expect(observed).toEqual([
      [7, 8, 9],
      [7, 8, 9],
    ]);
    expect(importAndApplyWorkbook).toHaveBeenCalledTimes(2);
  });
});
