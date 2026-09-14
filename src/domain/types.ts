export type BaseUnit = 'g' | 'mL' | 'pc';
export type InputUnit = BaseUnit | 'kg' | 'L' | 'cup';
export type ProductCategory = 'paintable-art' | 'candle-pot' | 'candle';
export type RatioBasis = 'weight' | 'volume';
export type PricingMethod = 'profit-amount' | 'markup-percent' | 'margin-percent';

export interface Material {
  id: string;
  name: string;
  group: string;
  baseUnit: BaseUnit;
  purchaseQuantity: number;
  purchaseUnit: InputUnit;
  baseUnitsPerPurchaseUnit: number;
  packageCost: number;
  onHandBaseQuantity: number;
  gramsPerCup?: number;
  vendor?: string;
  notes?: string;
}

export interface MixPreset {
  id: string;
  name: string;
  category: ProductCategory;
  basis: RatioBasis;
  primaryMaterialId: string;
  secondaryMaterialId?: string;
  primaryParts: number;
  secondaryParts: number;
}

export interface MoldYieldSample {
  id: string;
  productId: string;
  primaryMaterialId: string;
  primaryBaseQuantityUsed: number;
  goodPieces: number;
  rejectedPieces?: number;
  recordedAt: string;
}

export interface ProductRecipeItem {
  materialId: string;
  baseQuantityPerProduct: number;
  purpose?: string;
}

export type ProductComponentSource = 'material' | 'product';

export interface ProductComponent {
  id: string;
  sourceType: ProductComponentSource;
  sourceId: string;
  quantityPerProduct: number;
  role: 'vessel' | 'molded-component' | 'decoration' | 'packaging' | 'other';
}

export interface PricingPolicy {
  method: PricingMethod;
  value: number;
}

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  mixPresetId?: string;
  safetyWasteRate: number;
  recipeItems: ProductRecipeItem[];
  components: ProductComponent[];
  pricing: PricingPolicy;
}

export interface BusinessDataset {
  schemaVersion: number;
  materials: Material[];
  mixPresets: MixPreset[];
  products: Product[];
  moldYieldSamples: MoldYieldSample[];
}
