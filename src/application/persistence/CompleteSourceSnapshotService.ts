import {
  cloneBusinessDataset,
  CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
} from '../../domain/businessDataset';
import type { BusinessDataset } from '../../domain/types';
import type { CalibrationRepository } from '../calibrations/CalibrationRepository';
import type { MaterialRepository } from '../materials/MaterialRepository';
import type { MixPresetRepository } from '../mixPresets/MixPresetRepository';
import type { ProductComponentRepository } from '../productComponents/ProductComponentRepository';
import type { ProductFinancialProfileRepository } from '../productFinancialProfiles/ProductFinancialProfileRepository';
import type { ProductRepository } from '../products/ProductRepository';
import type { ProductStockRepository } from '../productStocks/ProductStockRepository';
import type { FixedRecipeItemRepository } from '../recipeItems/FixedRecipeItemRepository';
import type { YieldSampleRepository } from '../yieldSamples/YieldSampleRepository';

/**
 * Complete authoritative repository set required to snapshot the persisted business source state.
 *
 * The service depends only on repository interfaces so callers do not need to know whether the
 * live source data is currently in memory, Excel-backed, SQLite-backed, or another transport.
 */
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

/**
 * Read-only application boundary that captures all authoritative Phase 1-4 source state.
 *
 * Derived costing, yield-learning, production, capacity, and pricing outputs are intentionally
 * excluded. Any failed repository read rejects the whole operation; no partial dataset is returned.
 */
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
    };

    return cloneBusinessDataset(dataset);
  }
}
