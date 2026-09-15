import type { FixedRecipeItem } from './fixedRecipeItems';
import type { Material } from './materials';
import type { MixPreset, RatioBasis } from './mixPresets';
import type { ProductComponent } from './productComponents';
import type { ProductFinancialProfile } from './productFinancialProfile';
import type { ProductStock } from './productStock';
import type { Product, ProductCategory } from './products';
import type { YieldSample } from './yieldSamples';

export type { FixedRecipeItem, FixedRecipeItemRole } from './fixedRecipeItems';
export type { Material } from './materials';
export type { MixPreset, RatioBasis } from './mixPresets';
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
export type { YieldSample, YieldSampleMaterialInput } from './yieldSamples';
export type { BaseUnit, InputUnit } from './units';

export interface BusinessDataset {
  schemaVersion: number;
  materials: Material[];
  mixPresets: MixPreset[];
  products: Product[];
  yieldSamples: YieldSample[];
  recipeItems: FixedRecipeItem[];
  productComponents: ProductComponent[];
  productStocks: ProductStock[];
  productFinancialProfiles: ProductFinancialProfile[];
}
