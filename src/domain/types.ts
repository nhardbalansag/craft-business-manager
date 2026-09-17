import type { FixedRecipeItem } from './fixedRecipeItems';
import type { MaterialCalibrationEvidence } from './materialCalibration';
import type { Material } from './materials';
import type { MixPreset, RatioBasis } from './mixPresets';
import type { Mold } from './molds';
import type { ProductComponent } from './productComponents';
import type { ProductFinancialProfile } from './productFinancialProfile';
import type { ProductStock } from './productStock';
import type { Product, ProductCategory } from './products';
import type { StorageLocation } from './storageLocations';
import type { YieldSample } from './yieldSamples';

export type { FixedRecipeItem, FixedRecipeItemRole } from './fixedRecipeItems';
export type { MaterialCalibrationEvidence } from './materialCalibration';
export type { Material } from './materials';
export type { MixPreset, RatioBasis } from './mixPresets';
export type { Mold } from './molds';
export type {
  ProductComponent,
  ProductComponentRole,
  ProductComponentSourceType,
  ProductComponentSourceType as ProductComponentSource,
} from './productComponents';
export type { ProductFinancialProfile } from './productFinancialProfile';
export type { ProductStock } from './productStock';
export type { PricingMethod, PricingPolicy } from './pricing';
export type { Product, ProductCategory } from './products';
export type { StorageLocation, StorageLocationType } from './storageLocations';
export type { YieldSample, YieldSampleMaterialInput } from './yieldSamples';
export type { BaseUnit, InputUnit } from './units';

/**
 * Complete authoritative business source snapshot used by the persistence boundary.
 *
 * Derived costing, yield-learning, production, capacity, pricing, and label-rendering
 * results are intentionally excluded and are recalculated from these source collections.
 */
export interface BusinessDataset {
  schemaVersion: number;
  materials: Material[];
  materialCalibrations: MaterialCalibrationEvidence[];
  mixPresets: MixPreset[];
  products: Product[];
  yieldSamples: YieldSample[];
  recipeItems: FixedRecipeItem[];
  productComponents: ProductComponent[];
  productStocks: ProductStock[];
  productFinancialProfiles: ProductFinancialProfile[];
  storageLocations: StorageLocation[];
  molds: Mold[];
}
