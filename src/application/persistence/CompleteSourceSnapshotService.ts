import {
  cloneBusinessDataset,
  CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
} from '../../domain/businessDataset';
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

export interface CompleteSourceSnapshotRepositories {
  materials: MaterialRepository;
  calibrations: CalibrationRepository;
  mixPresets: MixPresetRepository;
  products: ProductRepository;
  yieldSamples: YieldSampleRepository;
  recipeItems: FixedRecipeItemRepository;
  productComponents: ProductComponentRepository;
  productStocks: ProductStockRepository;
  productFinancialProfiles: ProductFinancialProfileRepository;
  storageLocations: StorageLocationRepository;
  molds: MoldRepository;
}

function canonicalText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function compareIdentity(left: string, right: string): number {
  const canonicalComparison = canonicalText(left).localeCompare(canonicalText(right));
  return canonicalComparison !== 0 ? canonicalComparison : left.localeCompare(right);
}

function sortByIdentity<T>(items: readonly T[], identity: (item: T) => string): T[] {
  return [...items].sort((left, right) => compareIdentity(identity(left), identity(right)));
}

/** Captures all authoritative source state; any failed repository read rejects the whole snapshot. */
export class CompleteSourceSnapshotService {
  constructor(private readonly repositories: CompleteSourceSnapshotRepositories) {}

  async snapshot(): Promise<BusinessDataset> {
    const [
      materials,
      materialCalibrations,
      mixPresets,
      products,
      yieldSamples,
      recipeItems,
      productComponents,
      productStocks,
      productFinancialProfiles,
      storageLocations,
      molds,
    ] = await Promise.all([
      this.repositories.materials.list(),
      this.repositories.calibrations.list(),
      this.repositories.mixPresets.list(),
      this.repositories.products.list(),
      this.repositories.yieldSamples.list(),
      this.repositories.recipeItems.list(),
      this.repositories.productComponents.list(),
      this.repositories.productStocks.list(),
      this.repositories.productFinancialProfiles.list(),
      this.repositories.storageLocations.list(),
      this.repositories.molds.list(),
    ]);

    const dataset: BusinessDataset = {
      schemaVersion: CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
      materials: sortByIdentity(materials, (material) => material.id),
      materialCalibrations: sortByIdentity(materialCalibrations, (evidence) => evidence.id),
      mixPresets: sortByIdentity(mixPresets, (preset) => preset.id),
      products: sortByIdentity(products, (product) => product.id),
      yieldSamples: sortByIdentity(yieldSamples, (sample) => sample.id),
      recipeItems: sortByIdentity(recipeItems, (item) => item.id),
      productComponents: sortByIdentity(productComponents, (component) => component.id),
      productStocks: sortByIdentity(productStocks, (stock) => stock.productId),
      productFinancialProfiles: sortByIdentity(
        productFinancialProfiles,
        (profile) => profile.productId,
      ),
      storageLocations: sortByIdentity(storageLocations, (location) => location.id),
      molds: sortByIdentity(molds, (mold) => mold.id),
    };

    return cloneBusinessDataset(dataset);
  }
}
