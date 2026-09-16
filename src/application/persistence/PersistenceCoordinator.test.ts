import { describe, expect, it, vi } from 'vitest';
import { createEmptyBusinessDataset } from '../../domain/businessDataset';
import type { BusinessDatasetValidationIssue } from '../../domain/businessDatasetValidation';
import type { BusinessDataset } from '../../domain/types';
import {
  BusinessDatasetWorkbookExportError,
  exportBusinessDatasetToXlsx,
} from '../../storage/businessDatasetWorkbookExport';
import { InMemoryWorkbookTransport } from '../../storage/InMemoryWorkbookTransport';
import { SheetJsWorkbookCodec } from '../../storage/sheetJsWorkbookCodec';
import { WorkbookCodecError, type WorkbookCodec } from '../../storage/workbookCodec';
import {
  createWorkbookTransportCapabilities,
  type WorkbookTransport,
} from '../../storage/WorkbookTransport';
import { PersistenceLifecycleOperationalError } from './PersistenceLifecycle';
import { PersistenceCoordinator } from './PersistenceCoordinator';
import { DatasetHydrationError } from './ValidatedAtomicDatasetHydrationService';

function snapshotSource(dataset: BusinessDataset) {
  return { snapshot: vi.fn(async () => dataset) };
}

function acceptingHydration() {
  return { hydrate: vi.fn(async () => ({ status: 'hydrated' as const })) };
}

function throwingCodec(error: Error): WorkbookCodec {
  return {
    encode: vi.fn(() => {
      throw error;
    }),
    decode: vi.fn(() => {
      throw new Error('decode is not used by this export test');
    }),
  };
}

function validWorkbookBytes(
  codec: WorkbookCodec = new SheetJsWorkbookCodec(),
  dataset: BusinessDataset = createEmptyBusinessDataset(),
): Uint8Array {
  return exportBusinessDatasetToXlsx(
    dataset,
    { exportedAt: '2026-09-16T08:00:00.000Z', applicationVersion: 'c3-test' },
    codec,
  );
}

const directTransportCapabilities = createWorkbookTransportCapabilities({
  backup: 'unsupported',
  stagedReplacement: false,
  replacement: 'direct-non-atomic',
});

describe('PersistenceCoordinator export/save orchestration', () => {
  it('exports the current complete snapshot with deterministic injected metadata', async () => {
    const snapshots = snapshotSource(createEmptyBusinessDataset());
    const hydration = acceptingHydration();
    const codec = new SheetJsWorkbookCodec();
    const clock = vi.fn(() => new Date('2026-09-16T01:23:45.000Z'));
    const coordinator = new PersistenceCoordinator(snapshots, hydration, codec, {
      clock,
      applicationVersion: '0.1.0-test',
    });

    const result = await coordinator.exportCurrentWorkbook();

    expect(result.status).toBe('exported');
    expect(result.bytes.byteLength).toBeGreaterThan(0);
    expect(result.metadata).toEqual({
      exportedAt: '2026-09-16T01:23:45.000Z',
      applicationVersion: '0.1.0-test',
    });
    expect(snapshots.snapshot).toHaveBeenCalledTimes(1);
    expect(clock).toHaveBeenCalledTimes(1);
    expect(hydration.hydrate).not.toHaveBeenCalled();
    expect(codec.decode(result.bytes).sheets.find((sheet) => sheet.name === '_Meta')?.rows[0]).toMatchObject({
      exportedAt: '2026-09-16T01:23:45.000Z',
      applicationVersion: '0.1.0-test',
      datasetSchemaVersion: 1,
    });
  });

  it('returns caller-owned workbook bytes even when codec output is mutable', async () => {
    const sharedCodecBytes = new Uint8Array([10, 20, 30]);
    const codec: WorkbookCodec = {
      encode: vi.fn(() => sharedCodecBytes),
      decode: vi.fn(() => ({ sheets: [] })),
    };
    const coordinator = new PersistenceCoordinator(
      snapshotSource(createEmptyBusinessDataset()),
      acceptingHydration(),
      codec,
      { clock: () => new Date('2026-09-16T02:00:00.000Z') },
    );

    const result = await coordinator.exportCurrentWorkbook();
    result.bytes[0] = 99;

    expect(sharedCodecBytes).toEqual(new Uint8Array([10, 20, 30]));
  });

  it('saves through WorkbookTransport and forwards backup intent', async () => {
    const snapshots = snapshotSource(createEmptyBusinessDataset());
    const codec = new SheetJsWorkbookCodec();
    const transport = new InMemoryWorkbookTransport();
    const coordinator = new PersistenceCoordinator(snapshots, acceptingHydration(), codec, {
      clock: () => new Date('2026-09-16T03:00:00.000Z'),
    });

    const result = await coordinator.saveCurrentWorkbook(transport, { backup: 'if-supported' });

    expect(result.status).toBe('saved');
    expect(result.receipt).toEqual({
      reference: 'memory://workbook',
      backup: { status: 'unsupported' },
      replacement: { guarantee: 'direct-non-atomic' },
    });
    expect(snapshots.snapshot).toHaveBeenCalledTimes(1);
  });

  it('maps snapshot failure before export', async () => {
    const failure = new Error('repository read failed');
    const snapshots = { snapshot: vi.fn(async () => { throw failure; }) };
    const codec: WorkbookCodec = {
      encode: vi.fn(() => new Uint8Array([1])),
      decode: vi.fn(() => ({ sheets: [] })),
    };
    const coordinator = new PersistenceCoordinator(snapshots, acceptingHydration(), codec);

    await expect(coordinator.exportCurrentWorkbook()).rejects.toMatchObject({
      stage: 'snapshot',
      code: 'SNAPSHOT_FAILED',
      causeValue: failure,
    });
    expect(codec.encode).not.toHaveBeenCalled();
  });

  it('retains structured invalid-dataset export cause', async () => {
    const invalid = { ...createEmptyBusinessDataset(), schemaVersion: 999 } as unknown as BusinessDataset;
    const coordinator = new PersistenceCoordinator(
      snapshotSource(invalid),
      acceptingHydration(),
      new SheetJsWorkbookCodec(),
    );

    try {
      await coordinator.exportCurrentWorkbook();
      throw new Error('expected export failure');
    } catch (error) {
      expect(error).toBeInstanceOf(PersistenceLifecycleOperationalError);
      const cause = (error as PersistenceLifecycleOperationalError).causeValue;
      expect(cause).toBeInstanceOf(BusinessDatasetWorkbookExportError);
      expect(cause).toMatchObject({
        code: 'INVALID_DATASET',
        datasetIssues: expect.arrayContaining([
          expect.objectContaining({ code: 'UNSUPPORTED_SCHEMA_VERSION' }),
        ]),
      });
    }
  });

  it('maps codec encode failure at export stage', async () => {
    const failure = new WorkbookCodecError('XLSX_ENCODE_FAILED', 'synthetic encode failure');
    const coordinator = new PersistenceCoordinator(
      snapshotSource(createEmptyBusinessDataset()),
      acceptingHydration(),
      throwingCodec(failure),
    );

    await expect(coordinator.exportCurrentWorkbook()).rejects.toMatchObject({
      stage: 'export',
      code: 'EXPORT_FAILED',
      causeValue: failure,
    });
  });

  it('maps transport save failure without mutating source state', async () => {
    const dataset = createEmptyBusinessDataset();
    const before = structuredClone(dataset);
    const failure = new Error('transport unavailable');
    const transport: WorkbookTransport = {
      capabilities: directTransportCapabilities,
      loadWorkbook: vi.fn(async () => new Uint8Array([1])),
      saveWorkbook: vi.fn(async () => { throw failure; }),
    };
    const coordinator = new PersistenceCoordinator(
      snapshotSource(dataset),
      acceptingHydration(),
      new SheetJsWorkbookCodec(),
    );

    await expect(coordinator.saveCurrentWorkbook(transport)).rejects.toMatchObject({
      stage: 'transport-save',
      code: 'TRANSPORT_SAVE_FAILED',
      causeValue: failure,
    });
    expect(dataset).toEqual(before);
  });
});

describe('PersistenceCoordinator Phase 5.3C3 import/load/hydrate orchestration', () => {
  it('imports valid bytes, hydrates once, and preserves metadata', async () => {
    const codec = new SheetJsWorkbookCodec();
    const hydration = acceptingHydration();
    const coordinator = new PersistenceCoordinator(
      snapshotSource(createEmptyBusinessDataset()),
      hydration,
      codec,
    );

    const result = await coordinator.importAndApplyWorkbook(validWorkbookBytes(codec));

    expect(result).toEqual({
      status: 'hydrated',
      metadata: {
        formatId: 'craft-business-manager',
        workbookFormatVersion: 1,
        datasetSchemaVersion: 1,
        exportedAt: '2026-09-16T08:00:00.000Z',
        applicationVersion: 'c3-test',
      },
    });
    expect(hydration.hydrate).toHaveBeenCalledTimes(1);
    expect(hydration.hydrate).toHaveBeenCalledWith(createEmptyBusinessDataset());
  });

  it('returns structured import rejection and never hydrates invalid workbook bytes', async () => {
    const hydration = acceptingHydration();
    const coordinator = new PersistenceCoordinator(
      snapshotSource(createEmptyBusinessDataset()),
      hydration,
      new SheetJsWorkbookCodec(),
    );

    const result = await coordinator.importAndApplyWorkbook(new Uint8Array([1, 2, 3, 4]));

    expect(result).toMatchObject({ status: 'rejected', stage: 'import' });
    if (result.status === 'rejected' && result.stage === 'import') {
      expect(result.issues.length).toBeGreaterThan(0);
      expect(['codec', 'compatibility', 'migration', 'schema']).toContain(result.issues[0].stage);
    }
    expect(hydration.hydrate).not.toHaveBeenCalled();
  });

  it('maps transport load failure before hydration', async () => {
    const hydration = acceptingHydration();
    const failure = new Error('cannot read workbook');
    const transport: WorkbookTransport = {
      capabilities: directTransportCapabilities,
      loadWorkbook: vi.fn(async () => { throw failure; }),
      saveWorkbook: vi.fn(async () => ({
        backup: { status: 'not-requested' as const },
        replacement: { guarantee: 'direct-non-atomic' as const },
      })),
    };
    const coordinator = new PersistenceCoordinator(
      snapshotSource(createEmptyBusinessDataset()),
      hydration,
      new SheetJsWorkbookCodec(),
    );

    await expect(coordinator.loadCurrentWorkbook(transport)).rejects.toMatchObject({
      stage: 'transport-load',
      code: 'TRANSPORT_LOAD_FAILED',
      causeValue: failure,
    });
    expect(hydration.hydrate).not.toHaveBeenCalled();
  });

  it('routes transport load through the same import-and-apply path', async () => {
    const codec = new SheetJsWorkbookCodec();
    const hydration = acceptingHydration();
    const coordinator = new PersistenceCoordinator(
      snapshotSource(createEmptyBusinessDataset()),
      hydration,
      codec,
    );

    const result = await coordinator.loadCurrentWorkbook(
      new InMemoryWorkbookTransport(validWorkbookBytes(codec)),
    );

    expect(result.status).toBe('hydrated');
    expect(hydration.hydrate).toHaveBeenCalledTimes(1);
  });

  it('preserves defensive hydration rejection as a controlled result', async () => {
    const issue: BusinessDatasetValidationIssue = {
      code: 'INVALID_RECORD',
      message: 'synthetic rejection',
      path: 'products[0]',
    };
    const hydration = {
      hydrate: vi.fn(async () => ({ status: 'rejected' as const, issues: [issue] })),
    };
    const codec = new SheetJsWorkbookCodec();
    const coordinator = new PersistenceCoordinator(
      snapshotSource(createEmptyBusinessDataset()),
      hydration,
      codec,
    );

    expect(await coordinator.importAndApplyWorkbook(validWorkbookBytes(codec))).toEqual({
      status: 'rejected',
      stage: 'hydrate',
      issues: [issue],
    });
  });

  it.each([
    ['SNAPSHOT_FAILED', 'HYDRATION_SNAPSHOT_FAILED'],
    ['APPLY_FAILED_RESTORED', 'HYDRATION_APPLY_FAILED_RESTORED'],
    ['ROLLBACK_FAILED', 'HYDRATION_ROLLBACK_FAILED'],
  ] as const)(
    'maps DatasetHydrationError %s without flattening context',
    async (hydrationCode, coordinatorCode) => {
      const codec = new SheetJsWorkbookCodec();
      const hydrationError = new DatasetHydrationError(
        hydrationCode,
        'synthetic hydration failure',
        new Error('operation cause'),
        hydrationCode === 'ROLLBACK_FAILED' ? new Error('rollback cause') : undefined,
      );
      const hydration = { hydrate: vi.fn(async () => { throw hydrationError; }) };
      const coordinator = new PersistenceCoordinator(
        snapshotSource(createEmptyBusinessDataset()),
        hydration,
        codec,
      );

      try {
        await coordinator.importAndApplyWorkbook(validWorkbookBytes(codec));
        throw new Error('expected hydration failure');
      } catch (error) {
        expect(error).toBeInstanceOf(PersistenceLifecycleOperationalError);
        expect(error).toMatchObject({ stage: 'hydrate', code: coordinatorCode });
        expect((error as PersistenceLifecycleOperationalError).causeValue).toBe(hydrationError);
      }
    },
  );

  it('clones caller-owned input bytes before hydration', async () => {
    const codec = new SheetJsWorkbookCodec();
    const bytes = validWorkbookBytes(codec);
    const hydration = acceptingHydration();
    const coordinator = new PersistenceCoordinator(
      snapshotSource(createEmptyBusinessDataset()),
      hydration,
      codec,
    );

    const pending = coordinator.importAndApplyWorkbook(bytes);
    bytes.fill(0);

    expect((await pending).status).toBe('hydrated');
    expect(hydration.hydrate).toHaveBeenCalledTimes(1);
  });
});
