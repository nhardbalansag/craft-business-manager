import type { BusinessDataset } from '../../domain/types';
import type { PhysicalBusinessDataset } from '../../domain/physicalBusinessDataset';
import {
  exportBusinessDatasetToXlsx,
  type WorkbookExportMetadata,
} from '../../storage/businessDatasetWorkbookExport';
import {
  importBusinessDatasetFromXlsx,
  type ImportedWorkbookMetadata,
} from '../../storage/businessDatasetWorkbookImport';
import {
  exportPhysicalBusinessDatasetToXlsx,
  importPhysicalBusinessDatasetFromXlsx,
} from '../../storage/physicalBusinessDatasetWorkbook';
import type { WorkbookBinaryInput, WorkbookCodec } from '../../storage/workbookCodec';
import {
  cloneWorkbookBytes,
  type WorkbookSaveOptions,
  type WorkbookSaveReceipt,
  type WorkbookTransport,
} from '../../storage/WorkbookTransport';
import {
  PersistenceLifecycleOperationalError,
  type PersistenceLifecycleRejected,
} from './PersistenceLifecycle';
import {
  DatasetHydrationError,
  type DatasetHydrationResult,
} from './ValidatedAtomicDatasetHydrationService';

export type PersistenceClock = () => Date;

export interface PersistenceCoordinatorOptions {
  readonly clock?: PersistenceClock;
  readonly applicationVersion?: string;
  /** Enables workbook v2 with persisted StorageLocations and Molds. Defaults to legacy v1 behavior. */
  readonly physicalIdentification?: boolean;
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

interface SnapshotSource {
  snapshot(): Promise<BusinessDataset | PhysicalBusinessDataset>;
}

interface HydrationTarget {
  hydrate(candidate: unknown): Promise<DatasetHydrationResult>;
}

interface PreparedWorkbookExport {
  readonly bytes: Uint8Array;
  readonly metadata: WorkbookExportMetadata;
}

function systemClock(): Date {
  return new Date();
}

function isPhysicalDataset(dataset: BusinessDataset | PhysicalBusinessDataset): dataset is PhysicalBusinessDataset {
  return 'storageLocations' in dataset && 'molds' in dataset;
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
 * Legacy callers remain on the proven Phase 5 workbook-v1 contract by default.
 * The real application session opts into physicalIdentification, which layers the
 * v2 Molds/StorageLocations sheets over that same v1 business-source engine.
 */
export class PersistenceCoordinator {
  private readonly clock: PersistenceClock;
  private readonly applicationVersion?: string;
  private readonly physicalIdentification: boolean;

  constructor(
    private readonly snapshotService: SnapshotSource,
    private readonly hydrationService: HydrationTarget,
    private readonly codec: WorkbookCodec,
    options: PersistenceCoordinatorOptions = {},
  ) {
    this.clock = options.clock ?? systemClock;
    this.applicationVersion = options.applicationVersion;
    this.physicalIdentification = options.physicalIdentification ?? false;
  }

  async exportCurrentWorkbook(): Promise<PersistenceWorkbookExported> {
    const prepared = await this.prepareCurrentWorkbookExport();
    return {
      status: 'exported',
      bytes: cloneWorkbookBytes(prepared.bytes),
      metadata: { ...prepared.metadata },
    };
  }

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

  async importAndApplyWorkbook(
    bytes: WorkbookBinaryInput,
  ): Promise<PersistenceWorkbookApplyResult> {
    let imported;
    try {
      imported = this.physicalIdentification
        ? importPhysicalBusinessDatasetFromXlsx(cloneWorkbookBytes(bytes), this.codec)
        : importBusinessDatasetFromXlsx(cloneWorkbookBytes(bytes), this.codec);
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
    let dataset: BusinessDataset | PhysicalBusinessDataset;
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

      if (this.physicalIdentification && !isPhysicalDataset(dataset)) {
        throw new Error('Physical-identification persistence requires a physical source snapshot.');
      }

      const bytes =
        this.physicalIdentification && isPhysicalDataset(dataset)
          ? exportPhysicalBusinessDatasetToXlsx(dataset, metadata, this.codec)
          : exportBusinessDatasetToXlsx(dataset as BusinessDataset, metadata, this.codec);

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
