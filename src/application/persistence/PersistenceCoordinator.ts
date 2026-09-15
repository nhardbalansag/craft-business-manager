import type { CompleteSourceSnapshotService } from './CompleteSourceSnapshotService';
import { PersistenceLifecycleOperationalError } from './PersistenceLifecycle';
import {
  exportBusinessDatasetToXlsx,
  type WorkbookExportMetadata,
} from '../../storage/businessDatasetWorkbookExport';
import type { WorkbookCodec } from '../../storage/workbookCodec';
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

type SnapshotSource = Pick<CompleteSourceSnapshotService, 'snapshot'>;

interface PreparedWorkbookExport {
  readonly bytes: Uint8Array;
  readonly metadata: WorkbookExportMetadata;
}

function systemClock(): Date {
  return new Date();
}

/**
 * Application-level persistence lifecycle coordinator.
 *
 * Phase 5.3C2 implements only the non-destructive half of the lifecycle:
 * complete source snapshot -> canonical XLSX export -> optional byte transport save.
 * Import/hydration is intentionally added in 5.3C3.
 */
export class PersistenceCoordinator {
  private readonly clock: PersistenceClock;
  private readonly applicationVersion?: string;

  constructor(
    private readonly snapshotService: SnapshotSource,
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
