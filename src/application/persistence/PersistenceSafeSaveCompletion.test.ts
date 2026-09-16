import { describe, expect, it, vi } from 'vitest';
import { createEmptyBusinessDataset } from '../../domain/businessDataset';
import { InMemoryWorkbookTransport } from '../../storage/InMemoryWorkbookTransport';
import { SafeInMemoryWorkbookTransport } from '../../storage/SafeInMemoryWorkbookTransport';
import { SheetJsWorkbookCodec } from '../../storage/sheetJsWorkbookCodec';
import {
  createWorkbookTransportCapabilities,
  WorkbookTransportSaveError,
  type WorkbookSaveOptions,
  type WorkbookSaveReceipt,
  type WorkbookTransport,
} from '../../storage/WorkbookTransport';
import { PersistenceCoordinator } from './PersistenceCoordinator';
import { PersistenceLifecycleOperationalError } from './PersistenceLifecycle';

function snapshotSource() {
  return { snapshot: vi.fn(async () => createEmptyBusinessDataset()) };
}

function acceptingHydration() {
  return { hydrate: vi.fn(async () => ({ status: 'hydrated' as const })) };
}

function coordinatorWith(snapshot = snapshotSource()) {
  return {
    snapshot,
    coordinator: new PersistenceCoordinator(
      snapshot,
      acceptingHydration(),
      new SheetJsWorkbookCodec(),
      { clock: () => new Date('2026-09-16T10:00:00.000Z') },
    ),
  };
}

const atomicCapabilities = createWorkbookTransportCapabilities({
  backup: 'supported',
  stagedReplacement: true,
  replacement: 'atomic',
});

describe('Phase 5.4B3 PersistenceCoordinator safe-save completion gate', () => {
  it('propagates a successful safe-save backup and atomic replacement receipt', async () => {
    const { coordinator, snapshot } = coordinatorWith();
    const transport = new SafeInMemoryWorkbookTransport(new Uint8Array([1, 2, 3]), {
      clock: () => new Date('2026-09-16T10:30:00.000Z'),
    });

    const result = await coordinator.saveCurrentWorkbook(transport, { backup: 'required' });

    expect(result.status).toBe('saved');
    expect(result.receipt).toEqual({
      reference: 'memory://safe-workbook',
      backup: {
        status: 'created',
        reference: 'memory://safe-backup/2026-09-16T10:30:00.000Z/0001',
      },
      replacement: { guarantee: 'atomic' },
    });
    expect(
      Array.from(
        await transport.loadBackup('memory://safe-backup/2026-09-16T10:30:00.000Z/0001'),
      ),
    ).toEqual([1, 2, 3]);
    expect((await transport.loadWorkbook()).byteLength).toBe(result.byteLength);
    expect(snapshot.snapshot).toHaveBeenCalledTimes(1);
  });

  it('passes safe-save options to the transport unchanged and returns its receipt unchanged', async () => {
    const { coordinator, snapshot } = coordinatorWith();
    const options: WorkbookSaveOptions = { backup: 'required' };
    const receipt: WorkbookSaveReceipt = {
      reference: 'test://safe-workbook',
      backup: { status: 'created', reference: 'test://backup/1' },
      replacement: { guarantee: 'atomic' },
    };
    const saveWorkbook = vi.fn(async (_bytes: Uint8Array, received?: WorkbookSaveOptions) => {
      expect(received).toBe(options);
      return receipt;
    });
    const transport: WorkbookTransport = {
      capabilities: atomicCapabilities,
      loadWorkbook: vi.fn(async () => new Uint8Array([1])),
      saveWorkbook,
    };

    const result = await coordinator.saveCurrentWorkbook(transport, options);

    expect(result.receipt).toBe(receipt);
    expect(saveWorkbook).toHaveBeenCalledTimes(1);
    expect(snapshot.snapshot).toHaveBeenCalledTimes(1);
  });

  it('wraps the exact transport safe-save error and does not repeat snapshot/export as rollback', async () => {
    const snapshot = snapshotSource();
    const { coordinator } = coordinatorWith(snapshot);
    const transportError = new WorkbookTransportSaveError(
      'commit',
      'COMMIT_FAILED',
      'not-committed',
      'Synthetic transport commit failure.',
      new Error('commit cause'),
    );
    const saveWorkbook = vi.fn(async () => {
      throw transportError;
    });
    const transport: WorkbookTransport = {
      capabilities: atomicCapabilities,
      loadWorkbook: vi.fn(async () => new Uint8Array([1])),
      saveWorkbook,
    };

    try {
      await coordinator.saveCurrentWorkbook(transport, { backup: 'required' });
      throw new Error('expected transport save failure');
    } catch (error) {
      expect(error).toBeInstanceOf(PersistenceLifecycleOperationalError);
      expect(error).toMatchObject({
        stage: 'transport-save',
        code: 'TRANSPORT_SAVE_FAILED',
        causeValue: transportError,
      });
      expect((error as PersistenceLifecycleOperationalError).causeValue).toBe(transportError);
    }

    expect(saveWorkbook).toHaveBeenCalledTimes(1);
    expect(snapshot.snapshot).toHaveBeenCalledTimes(1);
  });

  it('preserves committed-new-primary context when safe transport cleanup fails after commit', async () => {
    const snapshot = snapshotSource();
    const { coordinator } = coordinatorWith(snapshot);
    const cleanupFailure = new Error('synthetic post-commit cleanup failure');
    const transport = new SafeInMemoryWorkbookTransport(new Uint8Array([9, 9]), {
      clock: () => new Date('2026-09-16T11:00:00.000Z'),
      faultInjector: (stage) => {
        if (stage === 'cleanup') throw cleanupFailure;
      },
    });

    try {
      await coordinator.saveCurrentWorkbook(transport, { backup: 'required' });
      throw new Error('expected transport cleanup failure');
    } catch (error) {
      expect(error).toBeInstanceOf(PersistenceLifecycleOperationalError);
      const transportError = (error as PersistenceLifecycleOperationalError).causeValue;
      expect(transportError).toBeInstanceOf(WorkbookTransportSaveError);
      expect(transportError).toMatchObject({
        stage: 'cleanup',
        code: 'CLEANUP_FAILED',
        commitState: 'committed',
        causeValue: cleanupFailure,
      });
    }

    const primary = await transport.loadWorkbook();
    expect(primary.byteLength).toBeGreaterThan(2);
    expect(Array.from(primary)).not.toEqual([9, 9]);
    expect(
      Array.from(
        await transport.loadBackup('memory://safe-backup/2026-09-16T11:00:00.000Z/0001'),
      ),
    ).toEqual([9, 9]);
    expect(snapshot.snapshot).toHaveBeenCalledTimes(1);
  });

  it('never upgrades a direct non-atomic transport into an atomic coordinator result', async () => {
    const { coordinator } = coordinatorWith();
    const transport = new InMemoryWorkbookTransport(new Uint8Array([1]));

    const result = await coordinator.saveCurrentWorkbook(transport, {
      backup: 'if-supported',
    });

    expect(transport.capabilities.replacement).toBe('direct-non-atomic');
    expect(result.receipt).toMatchObject({
      backup: { status: 'unsupported' },
      replacement: { guarantee: 'direct-non-atomic' },
    });
  });
});
