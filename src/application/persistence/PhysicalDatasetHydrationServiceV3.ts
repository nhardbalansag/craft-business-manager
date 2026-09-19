import {
  clonePhysicalBusinessDatasetV3,
  toBusinessDatasetV2,
  validatePhysicalBusinessDatasetV3Integrity,
  type PhysicalBusinessDatasetV3,
  type PhysicalBusinessDatasetV3ValidationIssue,
} from '../../domain/physicalBusinessDatasetV3';
import type { MoldRepository } from '../molds/MoldRepository';
import type { StorageLocationRepository } from '../storageLocations/StorageLocationRepository';
import type { CollectionReplacementPort } from './CollectionReplacementPort';
import type { PhysicalSourceSnapshotServiceV3 } from './PhysicalSourceSnapshotServiceV3';
import {
  DatasetHydrationError,
} from './ValidatedAtomicDatasetHydrationService';
import type {
  BusinessDatasetV2HydrationResult,
  ValidatedAtomicDatasetHydrationServiceV2,
} from './ValidatedAtomicDatasetHydrationServiceV2';

type ReplaceableStorageRepository = StorageLocationRepository &
  CollectionReplacementPort<PhysicalBusinessDatasetV3['storageLocations'][number]>;
type ReplaceableMoldRepository = MoldRepository &
  CollectionReplacementPort<PhysicalBusinessDatasetV3['molds'][number]>;

export type PhysicalBusinessDatasetV3HydrationResult =
  | { readonly status: 'hydrated' }
  | {
      readonly status: 'rejected';
      readonly issues: readonly PhysicalBusinessDatasetV3ValidationIssue[];
    };

type CoreHydration = Pick<ValidatedAtomicDatasetHydrationServiceV2, 'hydrate'>;

/**
 * Atomic physical-v3 boundary composed over the atomic BusinessDataset-v2 boundary.
 *
 * If StorageLocations or Molds fail after core+tier replacement, the complete prior
 * core+tier snapshot is restored before physical collections are restored.
 */
export class PhysicalDatasetHydrationServiceV3 {
  constructor(
    private readonly baseHydrationService: CoreHydration,
    private readonly snapshotService: Pick<PhysicalSourceSnapshotServiceV3, 'snapshot'>,
    private readonly storageLocations: ReplaceableStorageRepository,
    private readonly molds: ReplaceableMoldRepository,
  ) {}

  async hydrate(
    candidate: unknown,
  ): Promise<PhysicalBusinessDatasetV3HydrationResult | BusinessDatasetV2HydrationResult> {
    const validation = validatePhysicalBusinessDatasetV3Integrity(candidate);
    if (!validation.valid) {
      return {
        status: 'rejected',
        issues: validation.issues,
      };
    }

    const next = clonePhysicalBusinessDatasetV3(
      candidate as PhysicalBusinessDatasetV3,
    );

    let previous: PhysicalBusinessDatasetV3;
    try {
      previous = await this.snapshotService.snapshot();
    } catch (error) {
      throw new DatasetHydrationError(
        'SNAPSHOT_FAILED',
        'The current physical business dataset v3 could not be snapshotted before hydration.',
        error,
      );
    }

    const coreResult = await this.baseHydrationService.hydrate(
      toBusinessDatasetV2(next),
    );
    if (coreResult.status === 'rejected') return coreResult;

    try {
      await this.storageLocations.replaceAll(next.storageLocations);
      await this.molds.replaceAll(next.molds);
      return { status: 'hydrated' };
    } catch (applyError) {
      try {
        const restoredCore = await this.baseHydrationService.hydrate(
          toBusinessDatasetV2(previous),
        );
        if (restoredCore.status === 'rejected') {
          throw new Error(
            'Previous BusinessDataset v2 was rejected during physical rollback.',
          );
        }

        await this.storageLocations.replaceAll(previous.storageLocations);
        await this.molds.replaceAll(previous.molds);
      } catch (rollbackError) {
        throw new DatasetHydrationError(
          'ROLLBACK_FAILED',
          'Physical dataset v3 hydration failed and rollback could not fully restore the previous state.',
          applyError,
          rollbackError,
        );
      }

      throw new DatasetHydrationError(
        'APPLY_FAILED_RESTORED',
        'Physical dataset v3 hydration failed; the previous live dataset was restored.',
        applyError,
      );
    }
  }
}
