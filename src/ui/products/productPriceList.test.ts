import { describe, expect, it, vi } from 'vitest';
import type { Product } from '../../domain/products';
import { filterPriceListProducts, loadProductPriceList, priceListPrices, type ProductPriceListFilters } from './productPriceList';

const photo = 'data:image/jpeg;base64,/9j/' + 'AAAA'.repeat(25);
const products: Product[] = [
  { id: 'P-2', name: 'Bear P (1pcs)', category: 'paintable-art', isActive: true, safetyWasteRate: 0, imageDataUrl: photo },
  { id: 'P (1pcs)-01', name: 'Angel', category: 'candle-pot', isActive: true, safetyWasteRate: 0 },
  { id: 'P-3', name: 'Rabbit P (1pcs)', category: 'paintable-art', isActive: false, safetyWasteRate: 0 },
  { id: 'P-4', name: 'P 1pcs without parentheses', category: 'paintable-art', isActive: true, safetyWasteRate: 0 },
];
const filters: ProductPriceListFilters = { query: ' p (1PCS) ', category: 'all', status: 'active', pictures: 'all' };
const single = { id: 'single', label: 'SINGLE', quantity: 1, unitPrice: 35, detail: 'Per piece' };

describe('Price list products and saved prices', () => {
  it('matches literal code substrings in names and IDs, ignoring case and repeated whitespace', () => {
    expect(filterPriceListProducts(products, filters).map((p) => p.id)).toEqual(['P (1pcs)-01', 'P-2']);
    expect(filterPriceListProducts(products, { ...filters, query: ' Bear   P (1pcs) ' }).map((p) => p.id)).toEqual(['P-2']);
  });

  it('combines category, archived status and validated picture availability filters', () => {
    expect(filterPriceListProducts(products, { ...filters, category: 'paintable-art', pictures: 'with' }).map((p) => p.id)).toEqual(['P-2']);
    expect(filterPriceListProducts(products, { ...filters, status: 'archived', pictures: 'without' }).map((p) => p.id)).toEqual(['P-3']);
    const highResOnly = { ...products[0], imageDataUrl: undefined, brochureImageDataUrl: photo };
    expect(filterPriceListProducts([highResOnly], { ...filters, pictures: 'with' })).toHaveLength(1);
    expect(filterPriceListProducts([{ ...products[0], imageDataUrl: 'https://bad.test/photo' }], { ...filters, pictures: 'with' })).toHaveLength(0);
  });

  it('keeps every selected product in order, preserves all package prices and excludes internal notes', async () => {
    const load = vi.fn(async () => [single, { ...single, id: 'bulk', quantity: 30, unitPrice: 25 }]);
    const rows = await loadProductPriceList([{ ...products[0], notes: 'PRIVATE COSTS' }, products[1]], load);
    expect(rows.map((row) => row.productId)).toEqual(['P-2', 'P (1pcs)-01']);
    expect(load.mock.calls).toHaveLength(2);
    expect(rows[0].imageDataUrl).toBe(photo);
    expect(rows[1].imageDataUrl).toBeNull();
    expect(JSON.stringify(rows)).not.toContain('PRIVATE COSTS');
    expect(priceListPrices(rows[0], false)).toEqual([single]);
    expect(priceListPrices(rows[0], true)).toHaveLength(2);
  });

  it('limits concurrent product loads to four and stops queueing after cancellation', async () => {
    const pending: Array<() => void> = [];
    const load = vi.fn(() => new Promise<typeof single[]>((resolve) => pending.push(() => resolve([single]))));
    let cancelled = false;
    const result = loadProductPriceList(Array.from({ length: 20 }, (_, i) => ({ ...products[0], id: String(i) })), load, () => cancelled);
    expect(load).toHaveBeenCalledTimes(4);
    cancelled = true;
    pending.forEach((resolve) => resolve());
    await result;
    expect(load).toHaveBeenCalledTimes(4);
  });

  it('fails on a product load error instead of publishing a partial price list', async () => {
    await expect(loadProductPriceList(products, async (id) => {
      if (id === 'P-2') throw new Error('Pricing unavailable');
      return [single];
    })).rejects.toThrow('Pricing unavailable');
  });
});
