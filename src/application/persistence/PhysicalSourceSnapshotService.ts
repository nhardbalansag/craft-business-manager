import {
  extendLegacyBusinessDataset,
  type PhysicalBusinessDataset,
} from '../../domain/physicalBusinessDataset';
import type { MoldRepository } from '../molds/MoldRepository';
import type { StorageLocationRepository } from '../storageLocations/StorageLocationRepository';
import type { CompleteSourceSnapshotService } from './CompleteSourceSnapshotService';

function canonical(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function sortById<T>(items: readonly T[], id: (item: T) => string): T[] {
  return [...items].sort((left, right) => {
    const a = id(left);
    const b = id(right);
    return canonical(a).localeCompare(canonical(b)) || a.localeCompare(b);
  });
}

export class PhysicalSourceSnapshotService {
  readonly physicalIdentification = true as const;

  constructor(
    private readonly baseSnapshotService: Pick<CompleteSourceSnapshotService, 'snapshot'>,
    private readonly storageLocations: StorageLocationRepository,
    private readonly molds: MoldRepository,
  ) {}

  async snapshot(): Promise<PhysicalBusinessDataset> {
    const [base, locations, molds] = await Promise.all([
      this.baseSnapshotService.snapshot(),
      this.storageLocations.list(),
      this.molds.list(),
    ]);

    return extendLegacyBusinessDataset(
      base,
      sortById(locations, (location) => location.id),
      sortById(molds, (mold) => mold.id),
    );
  }
}
