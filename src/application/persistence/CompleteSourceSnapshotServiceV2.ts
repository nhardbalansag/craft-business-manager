import {
  BUSINESS_DATASET_V2_SCHEMA_VERSION,
  cloneBusinessDatasetV2,
  type BusinessDatasetV2,
} from '../../domain/businessDatasetV2';
import type { ProductPriceTierRepository } from '../productPriceTiers/ProductPriceTierRepository';
import type { CompleteSourceSnapshotService } from './CompleteSourceSnapshotService';

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
 * Tier-aware source snapshot layered over the proven v1 source snapshot.
 *
 * Existing Phase 5 source reads stay unchanged; ProductPriceTiers is added as the
 * tenth authoritative core source collection for BusinessDataset v2.
 */
export class CompleteSourceSnapshotServiceV2 {
  readonly tieredPricing = true as const;

  constructor(
    private readonly baseSnapshotService: Pick<CompleteSourceSnapshotService, 'snapshot'>,
    private readonly productPriceTiers: ProductPriceTierRepository,
  ) {}

  async snapshot(): Promise<BusinessDatasetV2> {
    const [base, tiers] = await Promise.all([
      this.baseSnapshotService.snapshot(),
      this.productPriceTiers.list(),
    ]);

    return cloneBusinessDatasetV2({
      ...base,
      schemaVersion: BUSINESS_DATASET_V2_SCHEMA_VERSION,
      productPriceTiers: sortById(tiers),
    });
  }
}
