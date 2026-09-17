import { PRODUCT_CATEGORY_RULES, type Product } from '../../domain/products';

export const PRODUCT_LABEL_SIZE_PRESETS = [
  { id: '40x30', label: '40 × 30 mm', widthMm: 40, heightMm: 30 },
  { id: '50x30', label: '50 × 30 mm', widthMm: 50, heightMm: 30 },
  { id: '50x25', label: '50 × 25 mm', widthMm: 50, heightMm: 25 },
  { id: '60x40', label: '60 × 40 mm', widthMm: 60, heightMm: 40 },
] as const;

export type ProductLabelSizeId = (typeof PRODUCT_LABEL_SIZE_PRESETS)[number]['id'];
export type ProductLabelSizePreset = (typeof PRODUCT_LABEL_SIZE_PRESETS)[number];

export const DEFAULT_PRODUCT_LABEL_SIZE_ID: ProductLabelSizeId = '40x30';
export const PRODUCT_LABEL_MIN_COPIES = 1;
export const PRODUCT_LABEL_MAX_COPIES = 50;

export interface ProductLabelOptions {
  sizeId: ProductLabelSizeId;
  copies: number;
  showCategory: boolean;
  showStatus: boolean;
}

export interface ProductLabelView {
  product: {
    id: string;
    name: string;
    categoryLabel: string;
    isActive: boolean;
  };
  size: ProductLabelSizePreset;
  copies: number;
  showCategory: boolean;
  showStatus: boolean;
}

export function getProductLabelSizePreset(sizeId: ProductLabelSizeId): ProductLabelSizePreset {
  return PRODUCT_LABEL_SIZE_PRESETS.find((preset) => preset.id === sizeId) ?? PRODUCT_LABEL_SIZE_PRESETS[0];
}

export function normalizeProductLabelCopies(value: number): number {
  if (!Number.isFinite(value)) return PRODUCT_LABEL_MIN_COPIES;
  return Math.min(PRODUCT_LABEL_MAX_COPIES, Math.max(PRODUCT_LABEL_MIN_COPIES, Math.trunc(value)));
}

export function buildProductLabelView(product: Product, options: ProductLabelOptions): ProductLabelView {
  return {
    product: {
      id: product.id,
      name: product.name,
      categoryLabel: PRODUCT_CATEGORY_RULES[product.category].label,
      isActive: product.isActive,
    },
    size: getProductLabelSizePreset(options.sizeId),
    copies: normalizeProductLabelCopies(options.copies),
    showCategory: options.showCategory,
    showStatus: options.showStatus,
  };
}
