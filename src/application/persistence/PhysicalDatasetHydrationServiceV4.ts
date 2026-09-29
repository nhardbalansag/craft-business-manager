import {
  clonePhysicalBusinessDatasetV4,
  toPhysicalBusinessDatasetV3,
  validatePhysicalBusinessDatasetV4Integrity,
  type PhysicalBusinessDatasetV4,
  type PhysicalBusinessDatasetV4ValidationIssue,
} from '../../domain/physicalBusinessDatasetV4';
import type { PlasterMoldYieldProfileRepository } from '../plasterMoldYieldProfiles/PlasterMoldYieldProfileRepository';
import type { CollectionReplacementPort } from './CollectionReplacementPort';
import {
  DatasetHydrationError,
} from './ValidatedAtomicDatasetHydrationService';
import type {
  PhysicalBusinessDatasetV3HydrationResult,
  PhysicalDatasetHydrationServiceV3,
} from './PhysicalDatasetHydrationServiceV3';
import type { PhysicalSourceSnapshotServiceV4 } from './PhysicalSourceSnapshotServiceV4';

type ReplaceableProfileRepository = PlasterMoldYieldProfileRepository &
  CollectionReplacementPort<
    PhysicalBusinessDatasetV4['plasterMoldYieldProfiles'][number]
  >;

export type PhysicalBusinessDatasetV4HydrationResult =
  | { readonly status: 'hydrated' }
  | {
      readonly status: 'rejected';
      readonly issues: readonly PhysicalBusinessDatasetV4ValidationIssue[];
    };

type PhysicalV3Hydration = Pick<PhysicalDatasetHydrationServiceV3, 'hydrate'>;

/**
 * Atomic v4 boundary composed over the proven physical-v3 hydration boundary.
 *
 * Profile replacement is the last apply step. If it fails, physical-v3/core state
 * and the previous profile collection are restored before an operational error is raised.
 */
export class PhysicalDatasetHydrationServiceV4 {
  constructor(
    private readonly baseHydrationService: PhysicalV3Hydration,
    private readonly snapshotService: Pick<PhysicalSourceSnapshotServiceV4, 'snapshot'>,
    private readonly profiles: ReplaceableProfileRepository,
  ) {}

  async hydrate(
    candidate: unknown,
  ): Promise<
    PhysicalBusinessDatasetV4HydrationResult | PhysicalBusinessDatasetV3HydrationResult
  > {
    const validation = validatePhysicalBusinessDatasetV4Integrity(candidate);
    if (!validation.valid) {
      return {
        status: 'rejected',
        issues: validation.issues,
      };
    }

    const next = clonePhysicalBusinessDatasetV4(
      candidate as PhysicalBusinessDatasetV4,
    );

    let previous: PhysicalBusinessDatasetV4;
    try {
      previous = await this.snapshotService.snapshot();
    } catch (error) {
      throw new DatasetHydrationError(
        'SNAPSHOT_FAILED',
        'The current physical business dataset v4 could not be snapshotted before hydration.',
        error,
      );
    }

    const baseResult = await this.baseHydrationService.hydrate(
      toPhysicalBusinessDatasetV3(next),
    );
    if (baseResult.status === 'rejected') return baseResult;

    try {
      await this.profiles.replaceAll(next.plasterMoldYieldProfiles);
      return { status: 'hydrated' };
    } catch (applyError) {
      try {
        const restoredBase = await this.baseHydrationService.hydrate(
          toPhysicalBusinessDatasetV3(previous),
        );
        if (restoredBase.status === 'rejected') {
          throw new Error(
            'Previous PhysicalBusinessDataset v3 was rejected during v4 rollback.',
          );
        }
        await this.profiles.replaceAll(previous.plasterMoldYieldProfiles);
      } catch (rollbackError) {
        throw new DatasetHydrationError(
          'ROLLBACK_FAILED',
          'Physical dataset v4 hydration failed and rollback could not fully restore the previous state.',
          applyError,
          rollbackError,
        );
      }

      throw new DatasetHydrationError(
        'APPLY_FAILED_RESTORED',
        'Physical dataset v4 hydration failed; the previous live dataset was restored.',
        applyError,
      );
    }
  }
}
