import { describe, expect, it } from 'vitest';
import { InMemoryWorkbookTransport } from './InMemoryWorkbookTransport';
import {
  SafeInMemoryWorkbookTransport,
  type SafeInMemoryWorkbookTransportCleanupFailureContext,
  type SafeInMemoryWorkbookTransportFaultStage,
} from './SafeInMemoryWorkbookTransport';
import { WorkbookTransportSaveError } from './WorkbookTransport';

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

describe('Phase 5.4B3 safe-save failure recovery completion gate', () => {
  it('allows unsupported optional backup but truthfully reports direct non-atomic replacement', async () => {
    const transport = new InMemoryWorkbookTransport(bytes(1, 2));

    const receipt = await transport.saveWorkbook(bytes(3, 4), {
      backup: 'if-supported',
    });

    expect(receipt).toEqual({
      reference: 'memory://workbook',
      backup: { status: 'unsupported' },
      replacement: { guarantee: 'direct-non-atomic' },
    });
    expect(Array.from(await transport.loadWorkbook())).toEqual([3, 4]);
  });

  it('rejects unsupported required backup before replacement commit', async () => {
    const transport = new InMemoryWorkbookTransport(bytes(1, 2));

    await expect(
      transport.saveWorkbook(bytes(3, 4), { backup: 'required' }),
    ).rejects.toMatchObject({
      stage: 'capability',
      code: 'REQUIRED_BACKUP_UNSUPPORTED',
      commitState: 'not-committed',
    } satisfies Partial<WorkbookTransportSaveError>);

    expect(Array.from(await transport.loadWorkbook())).toEqual([1, 2]);
  });

  it('preserves the previous primary when reading existing state fails', async () => {
    const failure = new Error('synthetic read-existing failure');
    const transport = new SafeInMemoryWorkbookTransport(bytes(5, 6), {
      faultInjector: (stage) => {
        if (stage === 'read-existing') throw failure;
      },
    });

    await expect(
      transport.saveWorkbook(bytes(7, 8), { backup: 'required' }),
    ).rejects.toMatchObject({
      stage: 'read-existing',
      code: 'READ_EXISTING_FAILED',
      commitState: 'not-committed',
      causeValue: failure,
    } satisfies Partial<WorkbookTransportSaveError>);

    expect(Array.from(await transport.loadWorkbook())).toEqual([5, 6]);
    expect(transport.listBackupReferences()).toEqual([]);
    expect(transport.peekStagedWorkbook()).toBeUndefined();
  });

  it('fails closed on backup creation failure without creating fake backup evidence', async () => {
    const failure = new Error('synthetic backup failure');
    const transport = new SafeInMemoryWorkbookTransport(bytes(10, 11), {
      faultInjector: (stage) => {
        if (stage === 'backup') throw failure;
      },
    });

    await expect(
      transport.saveWorkbook(bytes(12, 13), { backup: 'required' }),
    ).rejects.toMatchObject({
      stage: 'backup',
      code: 'BACKUP_FAILED',
      commitState: 'not-committed',
      causeValue: failure,
    } satisfies Partial<WorkbookTransportSaveError>);

    expect(Array.from(await transport.loadWorkbook())).toEqual([10, 11]);
    expect(transport.listBackupReferences()).toEqual([]);
    expect(transport.peekStagedWorkbook()).toBeUndefined();
  });

  it('retains a valid pre-save backup and old primary when staging fails, then cleans staging', async () => {
    const observed: SafeInMemoryWorkbookTransportFaultStage[] = [];
    const failure = new Error('synthetic stage failure');
    const transport = new SafeInMemoryWorkbookTransport(bytes(20, 21), {
      clock: () => new Date('2026-09-16T08:00:00.000Z'),
      faultInjector: (stage) => {
        observed.push(stage);
        if (stage === 'stage') throw failure;
      },
    });

    await expect(
      transport.saveWorkbook(bytes(22, 23), { backup: 'required' }),
    ).rejects.toMatchObject({
      stage: 'stage',
      code: 'STAGE_FAILED',
      commitState: 'not-committed',
      causeValue: failure,
    } satisfies Partial<WorkbookTransportSaveError>);

    const [backupReference] = transport.listBackupReferences();
    expect(backupReference).toBe('memory://safe-backup/2026-09-16T08:00:00.000Z/0001');
    expect(Array.from(await transport.loadBackup(backupReference))).toEqual([20, 21]);
    expect(Array.from(await transport.loadWorkbook())).toEqual([20, 21]);
    expect(transport.peekStagedWorkbook()).toBeUndefined();
    expect(observed).toEqual(['read-existing', 'backup', 'stage', 'cleanup']);
  });

  it('retains a valid backup and old primary when commit fails, then cleans staging', async () => {
    const observed: SafeInMemoryWorkbookTransportFaultStage[] = [];
    const failure = new Error('synthetic commit failure');
    const transport = new SafeInMemoryWorkbookTransport(bytes(30, 31), {
      clock: () => new Date('2026-09-16T08:30:00.000Z'),
      faultInjector: (stage) => {
        observed.push(stage);
        if (stage === 'commit') throw failure;
      },
    });

    await expect(
      transport.saveWorkbook(bytes(32, 33), { backup: 'required' }),
    ).rejects.toMatchObject({
      stage: 'commit',
      code: 'COMMIT_FAILED',
      commitState: 'not-committed',
      causeValue: failure,
    } satisfies Partial<WorkbookTransportSaveError>);

    const [backupReference] = transport.listBackupReferences();
    expect(Array.from(await transport.loadBackup(backupReference))).toEqual([30, 31]);
    expect(Array.from(await transport.loadWorkbook())).toEqual([30, 31]);
    expect(transport.peekStagedWorkbook()).toBeUndefined();
    expect(observed).toEqual(['read-existing', 'backup', 'stage', 'commit', 'cleanup']);
  });

  it('distinguishes cleanup failure after a pre-commit operation failure and preserves old primary', async () => {
    const stageFailure = new Error('synthetic stage failure');
    const cleanupFailure = new Error('synthetic cleanup failure');
    const transport = new SafeInMemoryWorkbookTransport(bytes(40, 41), {
      clock: () => new Date('2026-09-16T09:00:00.000Z'),
      faultInjector: (stage) => {
        if (stage === 'stage') throw stageFailure;
        if (stage === 'cleanup') throw cleanupFailure;
      },
    });

    try {
      await transport.saveWorkbook(bytes(42, 43), { backup: 'required' });
      throw new Error('expected cleanup failure');
    } catch (error) {
      expect(error).toBeInstanceOf(WorkbookTransportSaveError);
      expect(error).toMatchObject({
        stage: 'cleanup',
        code: 'CLEANUP_FAILED',
        commitState: 'not-committed',
      });

      const context = (error as WorkbookTransportSaveError)
        .causeValue as SafeInMemoryWorkbookTransportCleanupFailureContext;
      expect(context.operationError).toMatchObject({
        stage: 'stage',
        code: 'STAGE_FAILED',
        commitState: 'not-committed',
        causeValue: stageFailure,
      });
      expect(context.cleanupCause).toBe(cleanupFailure);
    }

    const [backupReference] = transport.listBackupReferences();
    expect(Array.from(await transport.loadBackup(backupReference))).toEqual([40, 41]);
    expect(Array.from(await transport.loadWorkbook())).toEqual([40, 41]);
    expect(Array.from(transport.peekStagedWorkbook() ?? [])).toEqual([42, 43]);
  });

  it('distinguishes post-commit cleanup failure and keeps the new primary authoritative', async () => {
    const cleanupFailure = new Error('synthetic post-commit cleanup failure');
    const transport = new SafeInMemoryWorkbookTransport(bytes(50, 51), {
      clock: () => new Date('2026-09-16T09:30:00.000Z'),
      faultInjector: (stage) => {
        if (stage === 'cleanup') throw cleanupFailure;
      },
    });

    await expect(
      transport.saveWorkbook(bytes(52, 53), { backup: 'required' }),
    ).rejects.toMatchObject({
      stage: 'cleanup',
      code: 'CLEANUP_FAILED',
      commitState: 'committed',
      causeValue: cleanupFailure,
    } satisfies Partial<WorkbookTransportSaveError>);

    const [backupReference] = transport.listBackupReferences();
    expect(Array.from(await transport.loadBackup(backupReference))).toEqual([50, 51]);
    expect(Array.from(await transport.loadWorkbook())).toEqual([52, 53]);
    expect(Array.from(transport.peekStagedWorkbook() ?? [])).toEqual([52, 53]);
  });
});
