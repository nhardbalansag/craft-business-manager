import {
  extendPhysicalBusinessDatasetV4,
  type PhysicalBusinessDatasetV5,
} from '../../domain/physicalBusinessDatasetV5';
import type { YieldMoldFormulaSourceRepository } from '../yieldMoldFormulaSources/YieldMoldFormulaSourceRepository';
import type { PhysicalSourceSnapshotServiceV4 } from './PhysicalSourceSnapshotServiceV4';

function canonical(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function sortByYieldSampleId<
  T extends { yieldSampleId: string },
>(records: readonly T[]): T[] {
  return [...records].sort(
    (left, right) =>
      canonical(left.yieldSampleId).localeCompare(
        canonical(right.yieldSampleId),
      ) ||
      left.yieldSampleId.localeCompare(right.yieldSampleId),
  );
}

/**
 * Current YRS persistence snapshot: physical dataset v4 plus immutable
 * Yield Sample -> Mold Formula provenance.
 */
export class PhysicalSourceSnapshotServiceV5 {
  readonly physicalIdentification = true as const;
  readonly tieredPricing = true as const;
  readonly plasterMoldYieldProfiles = true as const;
  readonly yieldMoldFormulaSources = true as const;

  constructor(
    private readonly baseSnapshotService: Pick<
      PhysicalSourceSnapshotServiceV4,
      'snapshot'
    >,
    private readonly sources: YieldMoldFormulaSourceRepository,
  ) {}

  async snapshot(): Promise<PhysicalBusinessDatasetV5> {
    const [base, sources] = await Promise.all([
      this.baseSnapshotService.snapshot(),
      this.sources.list(),
    ]);

    return extendPhysicalBusinessDatasetV4(
      base,
      sortByYieldSampleId(sources),
    );
  }
}
