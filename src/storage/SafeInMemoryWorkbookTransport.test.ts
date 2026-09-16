import { describe, expect, it } from 'vitest';
import {
  SafeInMemoryWorkbookTransport,
  SafeInMemoryWorkbookTransportError,
  type SafeInMemoryWorkbookTransportFaultStage,
} from './SafeInMemoryWorkbookTransport';
import { WorkbookTransportSaveError } from './WorkbookTransport';

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

describe('SafeInMemoryWorkbookTransport Phase 5.4B2 reference lifecycle', () => {
  it('reports supported backup, staged replacement, and logical atomic commit truthfully', () => {
    const transport = new SafeInMemoryWorkbookTransport();

    expect(transport.capabilities).toEqual({
      backup: 'supported',
      stagedReplacement: true,
      replacement: 'atomic',
    });
    expect(Object.isFrozen(transport.capabilities)).toBe(true);
  });

  it('first save with requested backup reports no existing workbook and creates no fake backup', async () => {
    const transport = new SafeInMemoryWorkbookTransport(undefined, {
      clock: () => new Date('2026-09-16T03:00:00.000Z'),
    });

    const receipt = await transport.saveWorkbook(bytes(1, 2, 3), {
      backup: 'if-supported',
    });

    expect(receipt).toEqual({
      reference: 'memory://safe-workbook',
      backup: { status: 'not-needed', reason: 'no-existing-workbook' },
      replacement: { guarantee: 'atomic' },
    });
    expect(transport.listBackupReferences()).toEqual([]);
    expect(Array.from(await transport.loadWorkbook())).toEqual([1, 2, 3]);
    expect(transport.peekStagedWorkbook()).toBeUndefined();
  });

  it('overwrites without backup while still staging before logical atomic commit', async () => {
    const transport = new SafeInMemoryWorkbookTransport(bytes(1, 2));

    const receipt = await transport.saveWorkbook(bytes(3, 4));

    expect(receipt.backup).toEqual({ status: 'not-requested' });
    expect(receipt.replacement).toEqual({ guarantee: 'atomic' });
    expect(transport.listBackupReferences()).toEqual([]);
    expect(Array.from(await transport.loadWorkbook())).toEqual([3, 4]);
    expect(transport.peekStagedWorkbook()).toBeUndefined();
  });

  it('creates an exact deterministic backup of the pre-save primary for if-supported policy', async () => {
    const transport = new SafeInMemoryWorkbookTransport(bytes(10, 20, 30), {
      clock: () => new Date('2026-09-16T04:00:00.000Z'),
    });

    const receipt = await transport.saveWorkbook(bytes(40, 50), {
      backup: 'if-supported',
    });

    expect(receipt.backup).toEqual({
      status: 'created',
      reference: 'memory://safe-backup/2026-09-16T04:00:00.000Z/0001',
    });
    expect(transport.listBackupReferences()).toEqual([
      'memory://safe-backup/2026-09-16T04:00:00.000Z/0001',
    ]);
    expect(
      Array.from(
        await transport.loadBackup('memory://safe-backup/2026-09-16T04:00:00.000Z/0001'),
      ),
    ).toEqual([10, 20, 30]);
    expect(Array.from(await transport.loadWorkbook())).toEqual([40, 50]);
  });

  it('satisfies required backup using the same pre-save primary evidence before replacement', async () => {
    const transport = new SafeInMemoryWorkbookTransport(bytes(5, 6), {
      clock: () => new Date('2026-09-16T04:30:00.000Z'),
    });

    const receipt = await transport.saveWorkbook(bytes(7, 8), { backup: 'required' });

    expect(receipt.backup).toEqual({
      status: 'created',
      reference: 'memory://safe-backup/2026-09-16T04:30:00.000Z/0001',
    });
    expect(
      Array.from(
        await transport.loadBackup('memory://safe-backup/2026-09-16T04:30:00.000Z/0001'),
      ),
    ).toEqual([5, 6]);
    expect(Array.from(await transport.loadWorkbook())).toEqual([7, 8]);
  });

  it('keeps backup references deterministic and unique when the injected clock repeats', async () => {
    const transport = new SafeInMemoryWorkbookTransport(bytes(1), {
      clock: () => new Date('2026-09-16T05:00:00.000Z'),
    });

    await transport.saveWorkbook(bytes(2), { backup: 'if-supported' });
    await transport.saveWorkbook(bytes(3), { backup: 'if-supported' });

    expect(transport.listBackupReferences()).toEqual([
      'memory://safe-backup/2026-09-16T05:00:00.000Z/0001',
      'memory://safe-backup/2026-09-16T05:00:00.000Z/0002',
    ]);
    expect(
      Array.from(
        await transport.loadBackup('memory://safe-backup/2026-09-16T05:00:00.000Z/0001'),
      ),
    ).toEqual([1]);
    expect(
      Array.from(
        await transport.loadBackup('memory://safe-backup/2026-09-16T05:00:00.000Z/0002'),
      ),
    ).toEqual([2]);
  });

  it('owns caller bytes before the first asynchronous lifecycle checkpoint', async () => {
    let releaseRead!: () => void;
    const readGate = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    const transport = new SafeInMemoryWorkbookTransport(bytes(1), {
      faultInjector: async (stage) => {
        if (stage === 'read-existing') await readGate;
      },
    });
    const replacement = bytes(9, 8, 7);

    const pending = transport.saveWorkbook(replacement);
    replacement.fill(0);
    releaseRead();
    await pending;

    expect(Array.from(await transport.loadWorkbook())).toEqual([9, 8, 7]);
  });

  it('keeps staged replacement separate and leaves the previous primary authoritative until commit', async () => {
    let transport!: SafeInMemoryWorkbookTransport;
    const observations: string[] = [];
    transport = new SafeInMemoryWorkbookTransport(bytes(1, 1), {
      faultInjector: async (stage) => {
        if (stage !== 'commit') return;
        observations.push(`primary:${Array.from(await transport.loadWorkbook()).join(',')}`);
        observations.push(
          `staged:${Array.from(transport.peekStagedWorkbook() ?? []).join(',')}`,
        );
      },
    });

    await transport.saveWorkbook(bytes(2, 2));

    expect(observations).toEqual(['primary:1,1', 'staged:2,2']);
    expect(Array.from(await transport.loadWorkbook())).toEqual([2, 2]);
    expect(transport.peekStagedWorkbook()).toBeUndefined();
  });

  it('executes backup before stage, commit, and cleanup in deterministic order', async () => {
    const observed: SafeInMemoryWorkbookTransportFaultStage[] = [];
    const transport = new SafeInMemoryWorkbookTransport(bytes(1), {
      clock: () => new Date('2026-09-16T06:00:00.000Z'),
      faultInjector: (stage) => {
        observed.push(stage);
      },
    });

    await transport.saveWorkbook(bytes(2), { backup: 'required' });

    expect(observed).toEqual(['read-existing', 'backup', 'stage', 'commit', 'cleanup']);
  });

  it('returns defensively owned primary, staged, and backup byte views', async () => {
    let transport!: SafeInMemoryWorkbookTransport;
    let stagedView: Uint8Array | undefined;
    transport = new SafeInMemoryWorkbookTransport(bytes(3, 3), {
      clock: () => new Date('2026-09-16T06:30:00.000Z'),
      faultInjector: (stage) => {
        if (stage === 'commit') stagedView = transport.peekStagedWorkbook();
      },
    });

    const receipt = await transport.saveWorkbook(bytes(4, 4), { backup: 'if-supported' });
    const primaryView = await transport.loadWorkbook();
    if (receipt.backup.status !== 'created') throw new Error('expected created backup');
    const backupView = await transport.loadBackup(receipt.backup.reference);

    primaryView[0] = 99;
    backupView[0] = 88;
    stagedView?.fill(77);

    expect(Array.from(await transport.loadWorkbook())).toEqual([4, 4]);
    expect(Array.from(await transport.loadBackup(receipt.backup.reference))).toEqual([3, 3]);
  });

  it('preserves retained backup bytes independently from later primary saves', async () => {
    const transport = new SafeInMemoryWorkbookTransport(bytes(7, 7), {
      clock: () => new Date('2026-09-16T07:00:00.000Z'),
    });

    const first = await transport.saveWorkbook(bytes(8, 8), { backup: 'required' });
    if (first.backup.status !== 'created') throw new Error('expected created backup');
    await transport.saveWorkbook(bytes(9, 9));

    expect(Array.from(await transport.loadBackup(first.backup.reference))).toEqual([7, 7]);
    expect(Array.from(await transport.loadWorkbook())).toEqual([9, 9]);
  });

  it('provides deterministic commit fault injection while preserving the previous primary and cleaning staging', async () => {
    const failure = new Error('synthetic commit failure');
    const transport = new SafeInMemoryWorkbookTransport(bytes(1, 2), {
      faultInjector: (stage) => {
        if (stage === 'commit') throw failure;
      },
    });

    await expect(transport.saveWorkbook(bytes(3, 4))).rejects.toMatchObject({
      name: 'WorkbookTransportSaveError',
      stage: 'commit',
      code: 'COMMIT_FAILED',
      commitState: 'not-committed',
      causeValue: failure,
    } satisfies Partial<WorkbookTransportSaveError>);
    expect(Array.from(await transport.loadWorkbook())).toEqual([1, 2]);
    expect(transport.peekStagedWorkbook()).toBeUndefined();
  });

  it('fails deterministically when primary or requested backup evidence does not exist', async () => {
    const transport = new SafeInMemoryWorkbookTransport();

    await expect(transport.loadWorkbook()).rejects.toMatchObject({
      name: 'SafeInMemoryWorkbookTransportError',
      code: 'NO_WORKBOOK_AVAILABLE',
    } satisfies Partial<SafeInMemoryWorkbookTransportError>);
    await expect(transport.loadBackup('memory://safe-backup/missing')).rejects.toMatchObject({
      name: 'SafeInMemoryWorkbookTransportError',
      code: 'BACKUP_NOT_FOUND',
    } satisfies Partial<SafeInMemoryWorkbookTransportError>);
  });
});
