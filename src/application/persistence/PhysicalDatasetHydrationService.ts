import type { BusinessDatasetValidationIssue } from '../../domain/businessDatasetValidation';
import {
  clonePhysicalBusinessDataset,
  toLegacyBusinessDataset,
  validatePhysicalIdentificationSources,
  type PhysicalBusinessDataset,
} from '../../domain/physicalBusinessDataset';
import type { MoldRepository } from '../molds/MoldRepository';
import type { StorageLocationRepository } from '../storageLocations/StorageLocationRepository';
import type { CollectionReplacementPort } from './CollectionReplacementPort';
import {
  DatasetHydrationError,
  type DatasetHydrationResult,
  type ValidatedAtomicDatasetHydrationService,
} from './ValidatedAtomicDatasetHydrationService';
import type { PhysicalSourceSnapshotService } from './PhysicalSourceSnapshotService';

type ReplaceableStorageRepository = StorageLocationRepository &
  CollectionReplacementPort<PhysicalBusinessDataset['storageLocations'][number]>;
type ReplaceableMoldRepository = MoldRepository &
  CollectionReplacementPort<PhysicalBusinessDataset['molds'][number]>;

function mapPhysicalIssue(
  issue: ReturnType<typeof validatePhysicalIdentificationSources>[number],
): BusinessDatasetValidationIssue {
  const code =
    issue.code === 'DUPLICATE_IDENTITY'
      ? 'DUPLICATE_IDENTITY'
      : issue.code === 'MISSING_REFERENCE'
        ? 'MISSING_REFERENCE'
        : 'INVALID_RECORD';
  return {
    code,
    path: issue.path,
    message: issue.message,
  };
}

export class PhysicalDatasetHydrationService {
  constructor(
    private readonly baseHydrationService: Pick<ValidatedAtomicDatasetHydrationService, 'hydrate'>,
    private readonly snapshotService: Pick<PhysicalSourceSnapshotService, 'snapshot'>,
    private readonly storageLocations: ReplaceableStorageRepository,
    private readonly molds: ReplaceableMoldRepository,
  ) {}

  async hydrate(candidate: unknown): Promise<DatasetHydrationResult> {
    if (
      typeof candidate !== 'object' ||
      candidate === null ||
      !Array.isArray((candidate as Partial<PhysicalBusinessDataset>).storageLocations) ||
      !Array.isArray((candidate as Partial<PhysicalBusinessDataset>).molds)
    ) {
      return {
        status: 'rejected',
        issues: [
          {
            code: 'INVALID_DATASET',
            path: '$',
            message: 'Physical business dataset must include storageLocations and molds arrays.',
          },
        ],
      };
    }

    const next = clonePhysicalBusinessDataset(candidate as PhysicalBusinessDataset);
    const physicalIssues = validatePhysicalIdentificationSources(next);
    if (physicalIssues.length > 0) {
      return { status: 'rejected', issues: physicalIssues.map(mapPhysicalIssue) };
    }

    let previous: PhysicalBusinessDataset;
    try {
      previous = await this.snapshotService.snapshot();
    } catch (error) {
      throw new DatasetHydrationError(
        'SNAPSHOT_FAILED',
        'The current physical business dataset could not be snapshotted before hydration.',
        error,
      );
    }

    const baseResult = await this.baseHydrationService.hydrate(toLegacyBusinessDataset(next));
    if (baseResult.status === 'rejected') return baseResult;

    try {
      await this.storageLocations.replaceAll(next.storageLocations);
      await this.molds.replaceAll(next.molds);
      return { status: 'hydrated' };
    } catch (applyError) {
      try {
        const restoredBase = await this.baseHydrationService.hydrate(toLegacyBusinessDataset(previous));
        if (restoredBase.status === 'rejected') {
          throw new Error('Previous base dataset was rejected during rollback.');
        }
        await this.storageLocations.replaceAll(previous.storageLocations);
        await this.molds.replaceAll(previous.molds);
      } catch (rollbackError) {
        throw new DatasetHydrationError(
          'ROLLBACK_FAILED',
          'Physical dataset hydration failed and rollback could not fully restore the previous state.',
          applyError,
          rollbackError,
        );
      }

      throw new DatasetHydrationError(
        'APPLY_FAILED_RESTORED',
        'Physical dataset hydration failed; the previous live dataset was restored.',
        applyError,
      );
    }
  }
}
