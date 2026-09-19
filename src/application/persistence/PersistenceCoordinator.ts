import type { BusinessDatasetV2 } from '../../domain/businessDatasetV2';
import {
  extendBusinessDatasetV2,
  toBusinessDatasetV2,
  type PhysicalBusinessDatasetV3,
} from '../../domain/physicalBusinessDatasetV3';
import type { BusinessDataset } from '../../domain/types';
import {
  toLegacyBusinessDataset,
  type PhysicalBusinessDataset,
} from '../../domain/physicalBusinessDataset';
import {
  exportBusinessDatasetV2ToXlsx,
  importBusinessDatasetV2FromXlsx,
} from '../../storage/businessDatasetV2Workbook';
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
import {
  exportPhysicalBusinessDatasetV3ToXlsx,
  importPhysicalBusinessDatasetV3FromXlsx,
  type PhysicalBusinessDatasetV3WorkbookImportResult,
} from '../../storage/physicalBusinessDatasetV3Workbook';
import type { WorkbookBinaryInput, WorkbookCodec } from '../../storage/workbookCodec';
import {
  cloneWorkbookBytes,
  type WorkbookSaveOptions,
  type WorkbookSaveReceipt,
  type WorkbookTransport,
} from '../../storage/WorkbookTransport';
import {
  PersistenceLifecycleOperationalError,
  type PersistenceDatasetHydrationIssue,
  type PersistenceLifecycleRejected,
} from './PersistenceLifecycle';
import {
  DatasetHydrationError,
} from './ValidatedAtomicDatasetHydrationService';

export type PersistenceClock = () => Date;

export interface PersistenceCoordinatorOptions {
  readonly clock?: PersistenceClock;
  readonly applicationVersion?: string;
  /** Explicit override for physical-identification persistence. */
  readonly physicalIdentification?: boolean;
  /** Explicit override for BusinessDataset-v2 / workbook-v3 tier persistence. */
  readonly tieredPricing?: boolean;
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

type PersistableDataset =
  | BusinessDataset
  | PhysicalBusinessDataset
  | BusinessDatasetV2
  | PhysicalBusinessDatasetV3;

interface SnapshotSource {
  readonly physicalIdentification?: boolean;
  readonly tieredPricing?: boolean;
  snapshot(): Promise<PersistableDataset>;
}

type HydrationResult =
  | { readonly status: 'hydrated' }
  | {
      readonly status: 'rejected';
      readonly issues: readonly PersistenceDatasetHydrationIssue[];
    };

interface HydrationTarget {
  hydrate(candidate: unknown): Promise<HydrationResult>;
}

interface PreparedWorkbookExport {
  readonly bytes: Uint8Array;
  readonly metadata: WorkbookExportMetadata;
}

function systemClock(): Date {
  return new Date();
}

function isPhysicalDataset(
  dataset: PersistableDataset,
): dataset is PhysicalBusinessDataset {
  return (
    'storageLocations' in dataset &&
    'molds' in dataset &&
    !('productPriceTiers' in dataset)
  );
}

function isBusinessDatasetV2(
  dataset: PersistableDataset,
): dataset is BusinessDatasetV2 {
  return (
    'productPriceTiers' in dataset &&
    !('storageLocations' in dataset) &&
    dataset.schemaVersion === 2
  );
}

function isPhysicalDatasetV3(
  dataset: PersistableDataset,
): dataset is PhysicalBusinessDatasetV3 {
  return (
    'productPriceTiers' in dataset &&
    'storageLocations' in dataset &&
    'molds' in dataset &&
    dataset.schemaVersion === 3
  );
}

function hasPhysicalSourceRecords(
  dataset: PhysicalBusinessDataset | PhysicalBusinessDatasetV3,
): boolean {
  return dataset.storageLocations.length > 0 || dataset.molds.length > 0;
}

function sourceVersionFromIssues(
  result:
    | ReturnType<typeof importBusinessDatasetV2FromXlsx>
    | PhysicalBusinessDatasetV3WorkbookImportResult,
): { workbookFormatVersion: number; datasetSchemaVersion: number } | undefined {
  if (result.ok) return undefined;
  return result.issues.find((issue) => issue.sourceVersion !== undefined)
    ?.sourceVersion;
}

function importTieredPhysicalOrCore(
  bytes: WorkbookBinaryInput,
  codec: WorkbookCodec,
): PhysicalBusinessDatasetV3WorkbookImportResult {
  const core = importBusinessDatasetV2FromXlsx(bytes, codec);
  if (core.ok) {
    return {
      ok: true,
      dataset: extendBusinessDatasetV2(core.dataset),
      metadata: core.metadata,
    };
  }

  const physical = importPhysicalBusinessDatasetV3FromXlsx(bytes, codec);
  if (physical.ok) return physical;

  const version =
    sourceVersionFromIssues(physical) ?? sourceVersionFromIssues(core);
  const isPhysicalVersion =
    version !== undefined &&
    ((version.workbookFormatVersion === 2 &&
      version.datasetSchemaVersion === 2) ||
      (version.workbookFormatVersion === 3 &&
        version.datasetSchemaVersion === 3));

  return isPhysicalVersion ? physical : core;
}

function hydrationOperationalError(
  error: unknown,
): PersistenceLifecycleOperationalError {
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
 * Legacy callers retain the proven Phase 5 v1/v2 persistence behavior by default.
 * Tier-aware snapshot services advertise tieredPricing=true and move the live path to
 * core workbook v3 / dataset v2 or physical workbook v3 / dataset v3 while retaining
 * legacy import compatibility.
 */
export class PersistenceCoordinator {
  private readonly clock: PersistenceClock;
  private readonly applicationVersion?: string;
  private readonly physicalIdentification: boolean;
  private readonly tieredPricing: boolean;

  constructor(
    private readonly snapshotService: SnapshotSource,
    private readonly hydrationService: HydrationTarget,
    private readonly codec: WorkbookCodec,
    options: PersistenceCoordinatorOptions = {},
  ) {
    this.clock = options.clock ?? systemClock;
    this.applicationVersion = options.applicationVersion;
    this.physicalIdentification =
      options.physicalIdentification ??
      snapshotService.physicalIdentification ??
      false;
    this.tieredPricing =
      options.tieredPricing ?? snapshotService.tieredPricing ?? false;
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
      receipt = await transport.saveWorkbook(
        cloneWorkbookBytes(prepared.bytes),
        options,
      );
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
      const ownedBytes = cloneWorkbookBytes(bytes);
      if (this.tieredPricing) {
        imported = this.physicalIdentification
          ? importTieredPhysicalOrCore(ownedBytes, this.codec)
          : importBusinessDatasetV2FromXlsx(ownedBytes, this.codec);
      } else {
        imported = this.physicalIdentification
          ? importPhysicalBusinessDatasetFromXlsx(ownedBytes, this.codec)
          : importBusinessDatasetFromXlsx(ownedBytes, this.codec);
      }
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

    let hydration: HydrationResult;
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
    let dataset: PersistableDataset;
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

      let bytes: Uint8Array;

      if (this.tieredPricing) {
        if (this.physicalIdentification) {
          if (!isPhysicalDatasetV3(dataset)) {
            throw new Error(
              'Tiered physical persistence requires a PhysicalBusinessDataset v3 source snapshot.',
            );
          }

          bytes = hasPhysicalSourceRecords(dataset)
            ? exportPhysicalBusinessDatasetV3ToXlsx(
                dataset,
                metadata,
                this.codec,
              )
            : exportBusinessDatasetV2ToXlsx(
                toBusinessDatasetV2(dataset),
                metadata,
                this.codec,
              );
        } else {
          if (!isBusinessDatasetV2(dataset)) {
            throw new Error(
              'Tiered core persistence requires a BusinessDataset v2 source snapshot.',
            );
          }

          bytes = exportBusinessDatasetV2ToXlsx(
            dataset,
            metadata,
            this.codec,
          );
        }
      } else if (this.physicalIdentification) {
        if (!isPhysicalDataset(dataset)) {
          throw new Error(
            'Physical-identification persistence requires a physical source snapshot.',
          );
        }

        bytes = hasPhysicalSourceRecords(dataset)
          ? exportPhysicalBusinessDatasetToXlsx(
              dataset,
              metadata,
              this.codec,
            )
          : exportBusinessDatasetToXlsx(
              toLegacyBusinessDataset(dataset),
              metadata,
              this.codec,
            );
      } else {
        bytes = exportBusinessDatasetToXlsx(
          dataset as BusinessDataset,
          metadata,
          this.codec,
        );
      }

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
