import type { FixedRecipeItem } from './fixedRecipeItems';
import type { Material } from './materials';
import type { MixPreset, RatioBasis } from './mixPresets';
import type { ProductComponent } from './productComponents';
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
export type { Product, ProductCategory } from './products';
export type { YieldSample, YieldSampleMaterialInput } from './yieldSamples';
export type { BaseUnit, InputUnit } from './units';
export type PricingMethod = 'profit-amount' | 'markup-percent' | 'margin-percent';

/** Phase 4 scaffold retained for existing costing helpers; not part of the Phase 2 Product contract. */
export interface PricingPolicy {
  method: PricingMethod;
  value: number;
}

export interface BusinessDataset {
  schemaVersion: number;
  materials: Material[];
  mixPresets: MixPreset[];
  products: Product[];
  yieldSamples: YieldSample[];
  recipeItems: FixedRecipeItem[];
  productComponents: ProductComponent[];
}
