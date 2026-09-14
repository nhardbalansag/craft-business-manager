import type { Material } from './materials';
import type { MixPreset, RatioBasis } from './mixPresets';
import type { Product, ProductCategory } from './products';

export type { Material } from './materials';
export type { MixPreset, RatioBasis } from './mixPresets';
export type { Product, ProductCategory } from './products';
export type { BaseUnit, InputUnit } from './units';
export type PricingMethod = 'profit-amount' | 'markup-percent' | 'margin-percent';

/** Prototype Phase 2.2 scaffold; replaced/refined by the yield evidence domain in 2.2A. */
export interface MoldYieldSample {
  id: string;
  productId: string;
  primaryMaterialId: string;
  primaryBaseQuantityUsed: number;
  goodPieces: number;
  rejectedPieces?: number;
  recordedAt: string;
}

/** Prototype Phase 2.3 scaffold; replaced/refined by the fixed recipe domain in 2.3A. */
export interface ProductRecipeItem {
  materialId: string;
  baseQuantityPerProduct: number;
  purpose?: string;
}

/** Phase 3 scaffold only. Product composition is not part of the Phase 2 Product contract. */
export type ProductComponentSource = 'material' | 'product';

export interface ProductComponent {
  id: string;
  sourceType: ProductComponentSource;
  sourceId: string;
  quantityPerProduct: number;
  role: 'vessel' | 'molded-component' | 'decoration' | 'packaging' | 'other';
}

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
  moldYieldSamples: MoldYieldSample[];
}
