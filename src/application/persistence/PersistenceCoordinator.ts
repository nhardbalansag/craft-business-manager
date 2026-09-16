import type { CompleteSourceSnapshotService } from './CompleteSourceSnapshotService';
import {
  PersistenceLifecycleOperationalError,
  type PersistenceLifecycleRejected,
} from './PersistenceLifecycle';
import {
  DatasetHydrationError,
  type ValidatedAtomicDatasetHydrationService,
} from './ValidatedAtomicDatasetHydrationService';
import {
  exportBusinessDatasetToXlsx,
  type WorkbookExportMetadata,
} from '../../storage/businessDatasetWorkbookExport';
import {
  importBusinessDatasetFromXlsx,
  type ImportedWorkbookMetadata,
} from '../../storage/businessDatasetWorkbookImport';
import type { WorkbookBinaryInput, WorkbookCodec } from '../../storage/workbookCodec';
import {
  cloneWorkbookBytes,
  type WorkbookSaveOptions,
  type WorkbookSaveReceipt,
  type WorkbookTransport,
} from '../../storage/WorkbookTransport';

export type PersistenceClock = () => Date;

export interface PersistenceCoordinatorOptions {
  readonly clock?: PersistenceClock;
  readonly applicationVersion?: string;
}

export interface PersistenceWorkbookExported {
  readonly status: 'exported';
  readonly bytes: Uint8Array;
  readonly metadata: WorkbookExportMetadata;
}

export interface PersistenceWorkbookSaved {
  readonly status: 'saved';
  readonly byteLength: number;
  readonly metadata: WorkbookExportMetadata;
  readonly receipt: WorkbookSaveReceipt;
}

export interface PersistenceWorkbookHydrated {
  readonly status: 'hydrated';
  readonly metadata: ImportedWorkbookMetadata;
}

export type PersistenceWorkbookApplyResult =
  | PersistenceWorkbookHydrated
  | PersistenceLifecycleRejected;

type SnapshotSource = Pick<CompleteSourceSnapshotService, 'snapshot'>;
type HydrationTarget = Pick<ValidatedAtomicDatasetHydrationService, 'hydrate'>;

interface PreparedWorkbookExport {
  readonly bytes: Uint8Array;
  readonly metadata: WorkbookExportMetadata;
}

function systemClock(): Date {
  return new Date();
}

function hydrationOperationalError(error: unknown): PersistenceLifecycleOperationalError {
  if (error instanceof DatasetHydrationError) {
    if (error.code === 'SNAPSHOT_FAILED') {
      return new PersistenceLifecycleOperationalError(
        'hydrate',
        'HYDRATION_SNAPSHOT_FAILED',
        'Workbook import succeeded but the live dataset could not be snapshotted before hydration.',
        error,
      );
    }

    if (error.code === 'APPLY_FAILED_RESTORED') {
      return new PersistenceLifecycleOperationalError(
        'hydrate',
        'HYDRATION_APPLY_FAILED_RESTORED',
        'Workbook hydration failed and the previous live dataset was restored.',
        error,
      );
    }

    return new PersistenceLifecycleOperationalError(
      'hydrate',
      'HYDRATION_ROLLBACK_FAILED',
      'Workbook hydration failed and rollback of the previous live dataset also failed.',
      error,
    );
  }

  return new PersistenceLifecycleOperationalError(
    'hydrate',
    'HYDRATION_FAILED',
    'Workbook hydration failed unexpectedly.',
    error,
  );
}

/**
 * Application-level persistence lifecycle coordinator.
 *
 * This is the single Phase 5.3C orchestration boundary for:
 * - complete live source snapshot -> canonical XLSX export -> optional byte transport save; and
 * - workbook bytes / transport load -> strict current-version import -> validated atomic hydration.
 *
 * It never owns repository lists, workbook sheet mappings, or hydration replacement mechanics.
 */
export class PersistenceCoordinator {
  private readonly clock: PersistenceClock;
  private readonly applicationVersion?: string;

  constructor(
    private readonly snapshotService: SnapshotSource,
    private readonly hydrationService: HydrationTarget,
    private readonly codec: WorkbookCodec,
    options: PersistenceCoordinatorOptions = {},
  ) {
    this.clock = options.clock ?? systemClock;
    this.applicationVersion = options.applicationVersion;
  }

  /** Export the current complete authoritative source state without requiring a transport. */
  async exportCurrentWorkbook(): Promise<PersistenceWorkbookExported> {
    const prepared = await this.prepareCurrentWorkbookExport();

    return {
      status: 'exported',
      bytes: cloneWorkbookBytes(prepared.bytes),
      metadata: { ...prepared.metadata },
    };
  }

  /** Export the current source state and save the resulting XLSX bytes through a byte transport. */
  async saveCurrentWorkbook(
    transport: WorkbookTransport,
    options: WorkbookSaveOptions = {},
  ): Promise<PersistenceWorkbookSaved> {
    const prepared = await this.prepareCurrentWorkbookExport();

    let receipt: WorkbookSaveReceipt;
    try {
      receipt = await transport.saveWorkbook(cloneWorkbookBytes(prepared.bytes), options);
    } catch (error) {
      throw new PersistenceLifecycleOperationalError(
        'transport-save',
        'TRANSPORT_SAVE_FAILED',
        'Workbook transport save failed.',
        error,
      );
    }

    return {
      status: 'saved',
      byteLength: prepared.bytes.byteLength,
      metadata: { ...prepared.metadata },
      receipt,
    };
  }

  /**
   * Strictly import caller-provided workbook bytes and atomically apply the reconstructed dataset.
   * Expected invalid-workbook diagnostics are returned as a rejection and never reach hydration.
   */
  async importAndApplyWorkbook(
    bytes: WorkbookBinaryInput,
  ): Promise<PersistenceWorkbookApplyResult> {
    let imported;
    try {
      imported = importBusinessDatasetFromXlsx(cloneWorkbookBytes(bytes), this.codec);
    } catch (error) {
      throw new PersistenceLifecycleOperationalError(
        'import',
        'IMPORT_FAILED',
        'Workbook import failed unexpectedly.',
        error,
      );
    }

    if (!imported.ok) {
      return {
        status: 'rejected',
        stage: 'import',
        issues: imported.issues,
      };
    }

    let hydration;
    try {
      hydration = await this.hydrationService.hydrate(imported.dataset);
    } catch (error) {
      throw hydrationOperationalError(error);
    }

    if (hydration.status === 'rejected') {
      return {
        status: 'rejected',
        stage: 'hydrate',
        issues: hydration.issues,
      };
    }

    return {
      status: 'hydrated',
      metadata: { ...imported.metadata },
    };
  }

  /** Load workbook bytes through a transport and execute the exact same import/apply path. */
  async loadCurrentWorkbook(
    transport: WorkbookTransport,
  ): Promise<PersistenceWorkbookApplyResult> {
    let bytes: Uint8Array;
    try {
      bytes = await transport.loadWorkbook();
    } catch (error) {
      throw new PersistenceLifecycleOperationalError(
        'transport-load',
        'TRANSPORT_LOAD_FAILED',
        'Workbook transport load failed.',
        error,
      );
    }

    return this.importAndApplyWorkbook(cloneWorkbookBytes(bytes));
  }

  private async prepareCurrentWorkbookExport(): Promise<PreparedWorkbookExport> {
    let dataset;
    try {
      dataset = await this.snapshotService.snapshot();
    } catch (error) {
      throw new PersistenceLifecycleOperationalError(
        'snapshot',
        'SNAPSHOT_FAILED',
        'Complete source snapshot failed before workbook export.',
        error,
      );
    }

    try {
      const metadata: WorkbookExportMetadata = {
        exportedAt: this.clock().toISOString(),
        ...(this.applicationVersion === undefined
          ? {}
          : { applicationVersion: this.applicationVersion }),
      };
      const bytes = exportBusinessDatasetToXlsx(dataset, metadata, this.codec);

      return {
        bytes: cloneWorkbookBytes(bytes),
        metadata,
      };
    } catch (error) {
      throw new PersistenceLifecycleOperationalError(
        'export',
        'EXPORT_FAILED',
        'Current business source state could not be exported to XLSX.',
        error,
      );
    }
  }
}
