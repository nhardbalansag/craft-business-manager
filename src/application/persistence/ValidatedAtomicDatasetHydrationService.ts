import { cloneBusinessDataset } from '../../domain/businessDataset';
import {
  validateBusinessDatasetIntegrity,
  type BusinessDatasetValidationIssue,
} from '../../domain/businessDatasetValidation';
import type { BusinessDataset } from '../../domain/types';
import type { CalibrationRepository } from '../calibrations/CalibrationRepository';
import type { MaterialRepository } from '../materials/MaterialRepository';
import type { MixPresetRepository } from '../mixPresets/MixPresetRepository';
import type { MoldRepository } from '../molds/MoldRepository';
import type { ProductComponentRepository } from '../productComponents/ProductComponentRepository';
import type { ProductFinancialProfileRepository } from '../productFinancialProfiles/ProductFinancialProfileRepository';
import type { ProductRepository } from '../products/ProductRepository';
import type { ProductStockRepository } from '../productStocks/ProductStockRepository';
import type { FixedRecipeItemRepository } from '../recipeItems/FixedRecipeItemRepository';
import type { StorageLocationRepository } from '../storageLocations/StorageLocationRepository';
import type { YieldSampleRepository } from '../yieldSamples/YieldSampleRepository';
import type { CollectionReplacementPort } from './CollectionReplacementPort';
import type { CompleteSourceSnapshotService } from './CompleteSourceSnapshotService';

type HydratableRepository<Repository, RecordType> = Repository &
  CollectionReplacementPort<RecordType>;

export interface CompleteSourceHydrationRepositories {
  materials: HydratableRepository<MaterialRepository, BusinessDataset['materials'][number]>;
  calibrations: HydratableRepository<
    CalibrationRepository,
    BusinessDataset['materialCalibrations'][number]
  >;
  mixPresets: HydratableRepository<MixPresetRepository, BusinessDataset['mixPresets'][number]>;
  products: HydratableRepository<ProductRepository, BusinessDataset['products'][number]>;
  yieldSamples: HydratableRepository<
    YieldSampleRepository,
    BusinessDataset['yieldSamples'][number]
  >;
  recipeItems: HydratableRepository<
    FixedRecipeItemRepository,
    BusinessDataset['recipeItems'][number]
  >;
  productComponents: HydratableRepository<
    ProductComponentRepository,
    BusinessDataset['productComponents'][number]
  >;
  productStocks: HydratableRepository<
    ProductStockRepository,
    BusinessDataset['productStocks'][number]
  >;
  productFinancialProfiles: HydratableRepository<
    ProductFinancialProfileRepository,
    BusinessDataset['productFinancialProfiles'][number]
  >;
  storageLocations: HydratableRepository<
    StorageLocationRepository,
    BusinessDataset['storageLocations'][number]
  >;
  molds: HydratableRepository<MoldRepository, BusinessDataset['molds'][number]>;
}

export type DatasetHydrationResult =
  | { readonly status: 'hydrated' }
  | {
      readonly status: 'rejected';
      readonly issues: readonly BusinessDatasetValidationIssue[];
    };

export type DatasetHydrationErrorCode =
  | 'SNAPSHOT_FAILED'
  | 'APPLY_FAILED_RESTORED'
  | 'ROLLBACK_FAILED';

export class DatasetHydrationError extends Error {
  readonly code: DatasetHydrationErrorCode;
  readonly operationCause: unknown;
  readonly rollbackCause?: unknown;

  constructor(
    code: DatasetHydrationErrorCode,
    message: string,
    operationCause: unknown,
    rollbackCause?: unknown,
  ) {
    super(message);
    this.name = 'DatasetHydrationError';
    this.code = code;
    this.operationCause = operationCause;
    this.rollbackCause = rollbackCause;
  }
}

export class ValidatedAtomicDatasetHydrationService {
  constructor(
    private readonly repositories: CompleteSourceHydrationRepositories,
    private readonly snapshotService: CompleteSourceSnapshotService,
  ) {}

  async hydrate(candidate: unknown): Promise<DatasetHydrationResult> {
    const validation = validateBusinessDatasetIntegrity(candidate);
    if (!validation.valid) {
      return {
        status: 'rejected',
        issues: validation.issues,
      };
    }

    const next = cloneBusinessDataset(candidate as BusinessDataset);

    let previous: BusinessDataset;
    try {
      previous = await this.snapshotService.snapshot();
    } catch (error) {
      throw new DatasetHydrationError(
        'SNAPSHOT_FAILED',
        'The current live business dataset could not be snapshotted before hydration.',
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
          'Dataset hydration failed and the previous live dataset could not be fully restored.',
          applyError,
          rollbackError,
        );
      }

      throw new DatasetHydrationError(
        'APPLY_FAILED_RESTORED',
        'Dataset hydration failed; the previous live dataset was restored.',
        applyError,
      );
    }
  }

  private async replaceDataset(dataset: BusinessDataset): Promise<void> {
    await this.repositories.materials.replaceAll(dataset.materials);
    await this.repositories.calibrations.replaceAll(dataset.materialCalibrations);
    await this.repositories.mixPresets.replaceAll(dataset.mixPresets);
    await this.repositories.products.replaceAll(dataset.products);
    await this.repositories.yieldSamples.replaceAll(dataset.yieldSamples);
    await this.repositories.recipeItems.replaceAll(dataset.recipeItems);
    await this.repositories.productComponents.replaceAll(dataset.productComponents);
    await this.repositories.productStocks.replaceAll(dataset.productStocks);
    await this.repositories.productFinancialProfiles.replaceAll(dataset.productFinancialProfiles);
    await this.repositories.storageLocations.replaceAll(dataset.storageLocations);
    await this.repositories.molds.replaceAll(dataset.molds);
  }
}
