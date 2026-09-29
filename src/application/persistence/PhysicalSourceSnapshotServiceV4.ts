import {
  extendPhysicalBusinessDatasetV3,
  type PhysicalBusinessDatasetV4,
} from '../../domain/physicalBusinessDatasetV4';
import type { PlasterMoldYieldProfileRepository } from '../plasterMoldYieldProfiles/PlasterMoldYieldProfileRepository';
import type { PhysicalSourceSnapshotServiceV3 } from './PhysicalSourceSnapshotServiceV3';

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
 * Current plaster-mold persistence snapshot: physical dataset v3 plus formula profiles.
 */
export class PhysicalSourceSnapshotServiceV4 {
  readonly physicalIdentification = true as const;
  readonly tieredPricing = true as const;
  readonly plasterMoldYieldProfiles = true as const;

  constructor(
    private readonly baseSnapshotService: Pick<PhysicalSourceSnapshotServiceV3, 'snapshot'>,
    private readonly profiles: PlasterMoldYieldProfileRepository,
  ) {}

  async snapshot(): Promise<PhysicalBusinessDatasetV4> {
    const [base, profiles] = await Promise.all([
      this.baseSnapshotService.snapshot(),
      this.profiles.list(),
    ]);

    return extendPhysicalBusinessDatasetV3(
      base,
      sortById(profiles),
    );
  }
}
