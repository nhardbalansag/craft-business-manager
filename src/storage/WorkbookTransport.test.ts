import { describe, expect, it } from 'vitest';
import {
  InMemoryWorkbookTransport,
  InMemoryWorkbookTransportError,
} from './InMemoryWorkbookTransport';
import {
  cloneWorkbookBytes,
  createWorkbookTransportCapabilities,
  WorkbookTransportSaveError,
  type WorkbookBackupReceipt,
} from './WorkbookTransport';

describe('WorkbookTransport', () => {
  it('defensively clones Uint8Array input', () => {
    const source = new Uint8Array([1, 2, 3]);
    const cloned = cloneWorkbookBytes(source);

    source[0] = 99;

    expect(Array.from(cloned)).toEqual([1, 2, 3]);
  });

  it('defensively clones ArrayBuffer input', () => {
    const source = new Uint8Array([4, 5, 6]);
    const cloned = cloneWorkbookBytes(source.buffer);

    source[1] = 99;

    expect(Array.from(cloned)).toEqual([4, 5, 6]);
  });

  it('creates explicit immutable capability values', () => {
    const capabilities = createWorkbookTransportCapabilities({
      backup: 'supported',
      stagedReplacement: true,
      replacement: 'atomic',
    });

    expect(capabilities).toEqual({
      backup: 'supported',
      stagedReplacement: true,
      replacement: 'atomic',
    });
    expect(Object.isFrozen(capabilities)).toBe(true);
  });

  it('reports the simple in-memory transport truthfully as non-atomic and without backup/staging support', () => {
    const transport = new InMemoryWorkbookTransport();

    expect(transport.capabilities).toEqual({
      backup: 'unsupported',
      stagedReplacement: false,
      replacement: 'direct-non-atomic',
    });
    expect(Object.isFrozen(transport.capabilities)).toBe(true);
  });

  it('owns saved bytes independently from the caller', async () => {
    const transport = new InMemoryWorkbookTransport();
    const bytes = new Uint8Array([10, 20, 30]);

    await transport.saveWorkbook(bytes);
    bytes[0] = 200;

    expect(Array.from(await transport.loadWorkbook())).toEqual([10, 20, 30]);
  });

  it('returns defensive copies from load', async () => {
    const transport = new InMemoryWorkbookTransport(new Uint8Array([7, 8, 9]));

    const first = await transport.loadWorkbook();
    first[2] = 100;

    expect(Array.from(await transport.loadWorkbook())).toEqual([7, 8, 9]);
  });

  it('reports no backup and the actual direct/non-atomic replacement guarantee by default', async () => {
    const transport = new InMemoryWorkbookTransport();

    const receipt = await transport.saveWorkbook(new Uint8Array([1]));

    expect(receipt).toEqual({
      reference: 'memory://workbook',
      backup: { status: 'not-requested' },
      replacement: { guarantee: 'direct-non-atomic' },
    });
  });

  it('allows unsupported optional backup while preserving an explicit unsupported receipt', async () => {
    const transport = new InMemoryWorkbookTransport(new Uint8Array([1, 2]));

    const receipt = await transport.saveWorkbook(new Uint8Array([3, 4]), {
      backup: 'if-supported',
    });

    expect(receipt).toEqual({
      reference: 'memory://workbook',
      backup: { status: 'unsupported' },
      replacement: { guarantee: 'direct-non-atomic' },
    });
    expect(Array.from(await transport.loadWorkbook())).toEqual([3, 4]);
  });

  it('rejects unsupported required backup before replacing existing bytes', async () => {
    const transport = new InMemoryWorkbookTransport(new Uint8Array([1, 2]));

    await expect(
      transport.saveWorkbook(new Uint8Array([3, 4]), { backup: 'required' }),
    ).rejects.toMatchObject({
      name: 'WorkbookTransportSaveError',
      stage: 'capability',
      code: 'REQUIRED_BACKUP_UNSUPPORTED',
      commitState: 'not-committed',
    } satisfies Partial<WorkbookTransportSaveError>);

    expect(Array.from(await transport.loadWorkbook())).toEqual([1, 2]);
  });

  it('represents requested backup with no previous primary as distinct from backup failure', () => {
    const receipt: WorkbookBackupReceipt = {
      status: 'not-needed',
      reason: 'no-existing-workbook',
    };

    expect(receipt).toEqual({
      status: 'not-needed',
      reason: 'no-existing-workbook',
    });
  });

  it('retains safe-save stage, code, commit state, and original cause', () => {
    const cause = new Error('temporary cleanup failed');
    const error = new WorkbookTransportSaveError(
      'cleanup',
      'CLEANUP_FAILED',
      'committed',
      'Replacement committed but staging cleanup failed.',
      cause,
    );

    expect(error).toMatchObject({
      name: 'WorkbookTransportSaveError',
      stage: 'cleanup',
      code: 'CLEANUP_FAILED',
      commitState: 'committed',
      causeValue: cause,
    });
  });

  it('fails deterministically when no workbook is available to load', async () => {
    const transport = new InMemoryWorkbookTransport();

    await expect(transport.loadWorkbook()).rejects.toMatchObject({
      name: 'InMemoryWorkbookTransportError',
      code: 'NO_WORKBOOK_AVAILABLE',
    } satisfies Partial<InMemoryWorkbookTransportError>);
  });

  it('treats arbitrary bytes as transport data rather than validating workbook or business semantics', async () => {
    const transport = new InMemoryWorkbookTransport();
    const arbitraryBytes = new Uint8Array([0, 255, 17, 42]);

    await transport.saveWorkbook(arbitraryBytes);

    expect(Array.from(await transport.loadWorkbook())).toEqual([0, 255, 17, 42]);
  });
});
