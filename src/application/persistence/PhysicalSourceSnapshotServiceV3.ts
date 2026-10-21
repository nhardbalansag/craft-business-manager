import {
  extendBusinessDatasetV2,
  type PhysicalBusinessDatasetV3,
} from '../../domain/physicalBusinessDatasetV3';
import type { MoldRepository } from '../molds/MoldRepository';
import type { StorageLocationRepository } from '../storageLocations/StorageLocationRepository';
import type { CompleteSourceSnapshotServiceV2 } from './CompleteSourceSnapshotServiceV2';

function canonical(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function sortById<T extends { id: string }>(records: readonly T[]): T[] {
  return [...records].sort(
    (left, right) =>
      canonical(left.id).localeCompare(canonical(right.id)) ||
      left.id.localeCompare(right.id),
  );
}

/**
 * Current live persistence snapshot: core BusinessDataset v2 plus physical sources.
 */
export class PhysicalSourceSnapshotServiceV3 {
  readonly physicalIdentification = true as const;
  readonly tieredPricing = true as const;

  constructor(
    private readonly baseSnapshotService: Pick<CompleteSourceSnapshotServiceV2, 'snapshot'>,
    private readonly storageLocations: StorageLocationRepository,
    private readonly molds: MoldRepository,
  ) {}

  async snapshot(): Promise<PhysicalBusinessDatasetV3> {
    const [base, storageLocations, molds] = await Promise.all([
      this.baseSnapshotService.snapshot(),
      this.storageLocations.list(),
      this.molds.list(),
    ]);

    return extendBusinessDatasetV2(
      base,
      sortById(storageLocations),
      sortById(molds),
    );
  }
}
