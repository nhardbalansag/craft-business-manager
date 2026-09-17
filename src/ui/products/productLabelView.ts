import { PRODUCT_CATEGORY_RULES, type Product } from '../../domain/products';
import {
  DEFAULT_THERMAL_LABEL_SIZE_ID,
  getThermalLabelSizePreset,
  normalizeThermalLabelCopies,
  THERMAL_LABEL_MAX_COPIES,
  THERMAL_LABEL_MIN_COPIES,
  THERMAL_LABEL_SIZE_PRESETS,
  type ThermalLabelSizeId,
  type ThermalLabelSizePreset,
} from '../labels/thermalLabel';

export const PRODUCT_LABEL_SIZE_PRESETS = THERMAL_LABEL_SIZE_PRESETS;
export type ProductLabelSizeId = ThermalLabelSizeId;
export type ProductLabelSizePreset = ThermalLabelSizePreset;
export const DEFAULT_PRODUCT_LABEL_SIZE_ID = DEFAULT_THERMAL_LABEL_SIZE_ID;
export const PRODUCT_LABEL_MIN_COPIES = THERMAL_LABEL_MIN_COPIES;
export const PRODUCT_LABEL_MAX_COPIES = THERMAL_LABEL_MAX_COPIES;

export interface ProductLabelOptions {
  sizeId: ProductLabelSizeId;
  copies: number;
  showCategory: boolean;
  showStatus: boolean;
  showQr?: boolean;
  showBarcode?: boolean;
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
  showQr: boolean;
  showBarcode: boolean;
}

export function getProductLabelSizePreset(sizeId: ProductLabelSizeId): ProductLabelSizePreset {
  return getThermalLabelSizePreset(sizeId);
}

export function normalizeProductLabelCopies(value: number): number {
  return normalizeThermalLabelCopies(value);
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
    showQr: options.showQr ?? true,
    showBarcode: options.showBarcode ?? true,
  };
}
