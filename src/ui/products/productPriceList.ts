import type { Product, ProductCategory } from '../../domain/products';
import { PRODUCT_CATEGORY_RULES } from '../../domain/products';
import { getProductPhotos } from '../../domain/productPhotos';
import { loadProductBrochurePrices, type BrochurePriceOption } from './productBrochurePricing';
import { naturalNameCollator } from '../catalogSort';

export interface ProductPriceListFilters {
  query: string;
  category: ProductCategory | 'all';
  status: 'active' | 'archived' | 'all';
  pictures: 'all' | 'with' | 'without';
}

export interface ProductPriceListRow {
  productId: string;
  name: string;
  categoryLabel: string;
  imageDataUrl: string | null;
  prices: BrochurePriceOption[];
}

export interface ProductPriceListView {
  rows: ProductPriceListRow[];
  includePictures: boolean;
  includePackages: boolean;
}

export function priceListPhoto(product: Product): string | null {
  const { thumbnail, brochure } = getProductPhotos(product);
  return brochure ?? thumbnail;
}

function normalized(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function filterPriceListProducts(products: readonly Product[], filters: ProductPriceListFilters): Product[] {
  const query = normalized(filters.query);
  return products.filter((product) =>
    (filters.status === 'all' || product.isActive === (filters.status === 'active')) &&
    (filters.category === 'all' || product.category === filters.category) &&
    (normalized(product.name).includes(query) || normalized(product.id).includes(query)) &&
    (filters.pictures === 'all' || (priceListPhoto(product) !== null) === (filters.pictures === 'with')),
  ).sort(comparePriceListProducts);
}

export function comparePriceListProducts(a: Product, b: Product): number {
  return naturalNameCollator.compare(a.name, b.name) || a.id.localeCompare(b.id);
}

const moneyFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2,
});

export function priceListPrices(row: ProductPriceListRow, includePackages: boolean): BrochurePriceOption[] {
  return row.prices.filter((price) =>
    (includePackages || price.id === 'single') &&
    Number.isFinite(price.unitPrice) && price.unitPrice >= 0 &&
    Number.isSafeInteger(price.quantity) && price.quantity >= 1);
}

export function priceListMoney(value: number): string {
  return moneyFormatter.format(value);
}

export function priceListPriceLabel(price: BrochurePriceOption): string {
  return `${price.id === 'single' ? 'Single / default' : price.detail} · ${price.quantity === 1 ? '1 piece' : `Min. ${price.quantity} pcs`}`;
}

/** Resolve saved selling prices with bounded concurrency, preserving the selected order. */
export async function loadProductPriceList(
  products: readonly Product[],
  loadPrices: (id: string) => Promise<BrochurePriceOption[]> = loadProductBrochurePrices,
  cancelled: () => boolean = () => false,
): Promise<ProductPriceListRow[]> {
  const rows = new Array<ProductPriceListRow>(products.length);
  let nextIndex = 0;
  let completed = 0;
  let failed = false;
  await Promise.all(Array.from({ length: Math.min(4, products.length) }, async () => {
    while (nextIndex < products.length && !failed && !cancelled()) {
      const index = nextIndex++;
      const product = products[index];
      let prices: BrochurePriceOption[];
      try { prices = await loadPrices(product.id); }
      catch (error) { failed = true; throw error; }
      rows[index] = {
        productId: product.id,
        name: product.name,
        categoryLabel: PRODUCT_CATEGORY_RULES[product.category].label,
        imageDataUrl: priceListPhoto(product),
        prices,
      };
      completed++;
      // Let input, painting and Close run between chunks of in-memory calculations.
      if (completed % 16 === 0 && nextIndex < products.length && !cancelled()) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }
  }));
  return rows.filter((row) => row !== undefined);
}
