import {
  clonePhysicalBusinessDatasetV5,
  toPhysicalBusinessDatasetV4,
  validatePhysicalBusinessDatasetV5Integrity,
  type PhysicalBusinessDatasetV5,
  type PhysicalBusinessDatasetV5ValidationIssue,
} from '../../domain/physicalBusinessDatasetV5';
import type { YieldMoldFormulaSourceRepository } from '../yieldMoldFormulaSources/YieldMoldFormulaSourceRepository';
import type { CollectionReplacementPort } from './CollectionReplacementPort';
import { DatasetHydrationError } from './ValidatedAtomicDatasetHydrationService';
import type {
  PhysicalBusinessDatasetV4HydrationResult,
  PhysicalDatasetHydrationServiceV4,
} from './PhysicalDatasetHydrationServiceV4';
import type { PhysicalSourceSnapshotServiceV5 } from './PhysicalSourceSnapshotServiceV5';

type ReplaceableYieldMoldFormulaSourceRepository =
  YieldMoldFormulaSourceRepository &
    CollectionReplacementPort<
      PhysicalBusinessDatasetV5['yieldMoldFormulaSources'][number]
    >;

export type PhysicalBusinessDatasetV5HydrationResult =
  | { readonly status: 'hydrated' }
  | {
      readonly status: 'rejected';
      readonly issues: readonly PhysicalBusinessDatasetV5ValidationIssue[];
    };

type PhysicalV4Hydration = Pick<PhysicalDatasetHydrationServiceV4, 'hydrate'>;

/**
 * Atomic physical-v5 boundary composed over the proven physical-v4 hydration
 * boundary. Provenance replacement is the final apply step because every
 * provenance row depends on already-hydrated Yield, Mold and profile records.
 *
 * If provenance replacement fails, the complete previous physical-v4 graph and
 * previous provenance collection are restored before an operational error is
 * surfaced.
 */
export class PhysicalDatasetHydrationServiceV5 {
  constructor(
    private readonly baseHydrationService: PhysicalV4Hydration,
    private readonly snapshotService: Pick<PhysicalSourceSnapshotServiceV5, 'snapshot'>,
    private readonly sources: ReplaceableYieldMoldFormulaSourceRepository,
  ) {}

  async hydrate(
    candidate: unknown,
  ): Promise<
    PhysicalBusinessDatasetV5HydrationResult | PhysicalBusinessDatasetV4HydrationResult
  > {
    const validation = validatePhysicalBusinessDatasetV5Integrity(candidate);
    if (!validation.valid) {
      return {
        status: 'rejected',
        issues: validation.issues,
      };
    }

    const next = clonePhysicalBusinessDatasetV5(
      candidate as PhysicalBusinessDatasetV5,
    );

    let previous: PhysicalBusinessDatasetV5;
    try {
      previous = await this.snapshotService.snapshot();
    } catch (error) {
      throw new DatasetHydrationError(
        'SNAPSHOT_FAILED',
        'The current physical business dataset v5 could not be snapshotted before hydration.',
        error,
      );
    }

    const baseResult = await this.baseHydrationService.hydrate(
      toPhysicalBusinessDatasetV4(next),
    );
    if (baseResult.status === 'rejected') return baseResult;

    try {
      await this.sources.replaceAll(next.yieldMoldFormulaSources);
      return { status: 'hydrated' };
    } catch (applyError) {
      try {
        const restoredBase = await this.baseHydrationService.hydrate(
          toPhysicalBusinessDatasetV4(previous),
        );
        if (restoredBase.status === 'rejected') {
          throw new Error(
            'Previous PhysicalBusinessDataset v4 was rejected during v5 rollback.',
          );
        }
        await this.sources.replaceAll(previous.yieldMoldFormulaSources);
      } catch (rollbackError) {
        throw new DatasetHydrationError(
          'ROLLBACK_FAILED',
          'Physical dataset v5 hydration failed and rollback could not fully restore the previous state.',
          applyError,
          rollbackError,
        );
      }

      throw new DatasetHydrationError(
        'APPLY_FAILED_RESTORED',
        'Physical dataset v5 hydration failed; the previous live dataset was restored.',
        applyError,
      );
    }
  }
}
