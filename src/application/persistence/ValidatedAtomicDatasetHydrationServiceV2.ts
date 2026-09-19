import {
  cloneBusinessDatasetV2,
  type BusinessDatasetV2,
} from '../../domain/businessDatasetV2';
import {
  validateBusinessDatasetV2Integrity,
  type BusinessDatasetV2ValidationIssue,
} from '../../domain/businessDatasetV2Validation';
import type { ProductPriceTierRepository } from '../productPriceTiers/ProductPriceTierRepository';
import type { CollectionReplacementPort } from './CollectionReplacementPort';
import type { CompleteSourceSnapshotServiceV2 } from './CompleteSourceSnapshotServiceV2';
import {
  DatasetHydrationError,
  type CompleteSourceHydrationRepositories,
} from './ValidatedAtomicDatasetHydrationService';

type ReplaceableTierRepository = ProductPriceTierRepository &
  CollectionReplacementPort<BusinessDatasetV2['productPriceTiers'][number]>;

export interface CompleteSourceHydrationRepositoriesV2
  extends CompleteSourceHydrationRepositories {
  productPriceTiers: ReplaceableTierRepository;
}

export type BusinessDatasetV2HydrationResult =
  | { readonly status: 'hydrated' }
  | {
      readonly status: 'rejected';
      readonly issues: readonly BusinessDatasetV2ValidationIssue[];
    };

/**
 * Atomic replacement boundary for all ten BusinessDataset v2 source collections.
 *
 * Both forward apply and rollback use the same dependency-aware replacement order.
 */
export class ValidatedAtomicDatasetHydrationServiceV2 {
  constructor(
    private readonly repositories: CompleteSourceHydrationRepositoriesV2,
    private readonly snapshotService: Pick<CompleteSourceSnapshotServiceV2, 'snapshot'>,
  ) {}

  async hydrate(candidate: unknown): Promise<BusinessDatasetV2HydrationResult> {
    const validation = validateBusinessDatasetV2Integrity(candidate);
    if (!validation.valid) {
      return {
        status: 'rejected',
        issues: validation.issues,
      };
    }

    const next = cloneBusinessDatasetV2(candidate as BusinessDatasetV2);

    let previous: BusinessDatasetV2;
    try {
      previous = await this.snapshotService.snapshot();
    } catch (error) {
      throw new DatasetHydrationError(
        'SNAPSHOT_FAILED',
        'The current live business dataset v2 could not be snapshotted before hydration.',
        error,
      );
    }

    try {
      await this.replaceDataset(next);
      return { status: 'hydrated' };
    } catch (applyError) {
      try {
        await this.replaceDataset(previous);
      } catch (rollbackError) {
        throw new DatasetHydrationError(
          'ROLLBACK_FAILED',
          'Business dataset v2 hydration failed and the previous live dataset could not be fully restored.',
          applyError,
          rollbackError,
        );
      }

      throw new DatasetHydrationError(
        'APPLY_FAILED_RESTORED',
        'Business dataset v2 hydration failed; the previous live dataset was restored.',
        applyError,
      );
    }
  }

  private async replaceDataset(dataset: BusinessDatasetV2): Promise<void> {
    await this.repositories.materials.replaceAll(dataset.materials);
    await this.repositories.calibrations.replaceAll(dataset.materialCalibrations);
    await this.repositories.mixPresets.replaceAll(dataset.mixPresets);
    await this.repositories.products.replaceAll(dataset.products);
    await this.repositories.yieldSamples.replaceAll(dataset.yieldSamples);
    await this.repositories.recipeItems.replaceAll(dataset.recipeItems);
    await this.repositories.productComponents.replaceAll(dataset.productComponents);
    await this.repositories.productStocks.replaceAll(dataset.productStocks);
    await this.repositories.productFinancialProfiles.replaceAll(
      dataset.productFinancialProfiles,
    );
    await this.repositories.productPriceTiers.replaceAll(
      dataset.productPriceTiers,
    );
  }
}
