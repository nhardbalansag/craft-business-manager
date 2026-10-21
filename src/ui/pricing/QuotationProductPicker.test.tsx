// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../domain/products';
import { QuotationProductPicker, searchQuotationProducts } from './QuotationProductPicker';

const photo = 'data:image/jpeg;base64,/9j/' + 'AAAA'.repeat(25);
const products: Product[] = [
  { id: 'ART-01', name: 'Paintable Sea Turtle', category: 'paintable-art', notes: 'Ocean animals birthday kit', safetyWasteRate: .05, isActive: true, imageDataUrl: photo },
  { id: 'ART-02', name: 'Lion Painting Set', category: 'paintable-art', safetyWasteRate: .05, isActive: true },
  { id: 'CND-01', name: 'Lavender Rose Candle', category: 'candle', safetyWasteRate: .05, isActive: true, imageDataUrl: photo },
  { id: 'POT-01', name: 'Pastel Candle Pot', category: 'candle-pot', safetyWasteRate: .05, isActive: true },
  { id: 'OLD-01', name: 'Archived Candles', category: 'candle', safetyWasteRate: .05, isActive: false },
];
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function mount(overrides: {
  selected?: string;
  unavailable?: Set<string>;
  onSelect?: (id: string) => void;
  data?: Product[];
} = {}) {
  await act(async () => root.render(
    <QuotationProductPicker
      lineNumber={2}
      products={overrides.data ?? products}
      selectedProductId={overrides.selected ?? ''}
      unavailableProductIds={overrides.unavailable ?? new Set()}
      onSelect={overrides.onSelect ?? vi.fn()}
    />,
  ));
}
async function open() {
  await act(async () => container.querySelector<HTMLButtonElement>(
    '[aria-label="Find product for quotation item 2"]',
  )!.click());
}
async function typeKeyword(value: string) {
  const input = container.querySelector<HTMLInputElement>('[aria-label="Search quotation products for item 2"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function filterBy(label: string, value: string) {
  const input = container.querySelector<HTMLSelectElement>('[aria-label="' + label + '"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
function options() {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('[role="option"]'));
}

describe('Quotation product discovery', () => {
  it('matches all keywords in name, ID, category or notes and never offers archived products', () => {
    expect(searchQuotationProducts(products, 'SEA birthday', 'all').map((p) => p.id)).toEqual(['ART-01']);
    expect(searchQuotationProducts(products, 'CND-01 rose', 'all').map((p) => p.id)).toEqual(['CND-01']);
    expect(searchQuotationProducts(products, 'Painting', 'paintable-art').map((p) => p.id)).toEqual(['ART-02']);
    expect(searchQuotationProducts(products, '', 'candle').map((p) => p.id)).toEqual(['CND-01']);
    expect(searchQuotationProducts(products, '', 'all', 'with-image').map((p) => p.id)).toEqual(['CND-01', 'ART-01']);
    expect(searchQuotationProducts(products, '', 'all', 'without-image').map((p) => p.id)).toEqual(['ART-02', 'POT-01']);
  });

  it('filters each line by keywords, category and photo and blocks duplicates without mutating prices', async () => {
    const onSelect = vi.fn();
    await mount({ onSelect, unavailable: new Set(['CND-01']) });
    await open();
    expect(container.querySelector('.quotation-product-picker-results-meta')?.textContent).toContain('already in quotation');
    expect(options().some((item) => item.textContent?.includes('Archived Candles'))).toBe(false);
    await typeKeyword('paintable');
    expect(options()).toHaveLength(2);
    await filterBy('Filter quotation products by category for item 2', 'paintable-art');
    await filterBy('Filter quotation products by image for item 2', 'with-image');
    expect(options()).toHaveLength(1);
    expect(options()[0].textContent).toContain('Paintable Sea Turtle');
    expect(onSelect).not.toHaveBeenCalled();
    await act(async () => options()[0].click());
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('ART-01');
    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });

  it('supports keyboard navigation, Escape and focus restoration', async () => {
    const onSelect = vi.fn();
    await mount({ onSelect });
    await open();
    const input = container.querySelector<HTMLInputElement>('input[role="combobox"]')!;
    expect(document.activeElement).toBe(input);
    await typeKeyword('cnd-01');
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    expect(input.getAttribute('aria-activedescendant')).toContain('CND-01');
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(onSelect).toHaveBeenCalledWith('CND-01');
    await open();
    const reopened = container.querySelector<HTMLInputElement>('input[role="combobox"]')!;
    await act(async () => reopened.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(container.querySelector('[role="listbox"]')).toBeNull();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Find product for quotation item 2');
  });

  it('shows results in manageable batches and resets filters after reopening', async () => {
    const data: Product[] = Array.from({ length: 18 }, (_, index) => ({
      id: 'PRD-' + index,
      name: 'Item ' + String(index).padStart(2, '0'),
      category: 'candle-pot',
      safetyWasteRate: .05,
      isActive: true,
    }));
    await mount({ data });
    await open();
    expect(options()).toHaveLength(8);
    await act(async () => container.querySelector<HTMLButtonElement>('.quotation-product-picker-more')!.click());
    expect(options()).toHaveLength(16);
    await typeKeyword('no matches');
    expect(options()).toHaveLength(0);
    expect(container.textContent).toContain('No matching products');
    await act(async () => container.querySelector<HTMLButtonElement>(
      '[aria-label="Find product for quotation item 2"]',
    )!.click());
    await open();
    expect(options()).toHaveLength(8);
    expect(container.querySelector<HTMLInputElement>('input[role="combobox"]')!.value).toBe('');
  });

  it('allows zooming a search-result photo without selecting or closing the product picker', async () => {
    const highRes = 'data:image/jpeg;base64,' + 'AAAA'.repeat(28_000);
    const onSelect = vi.fn();
    await mount({
      onSelect,
      data: products.map((product) => product.id === 'ART-01'
        ? { ...product, brochureImageDataUrl: highRes } : product),
    });
    await open();
    await typeKeyword('sea turtle');
    const result = container.querySelector<HTMLElement>('.quotation-product-picker-result-row')!;
    expect(result).toBeTruthy();
    expect(result.querySelector('[role="option"]')?.textContent).toContain('Paintable Sea Turtle');
    const zoom = result.querySelector<HTMLButtonElement>('[aria-label="View full-size image of Paintable Sea Turtle"]')!;
    expect(zoom).toBeTruthy();
    expect(zoom.closest('button[role="option"]')).toBeNull();
    zoom.focus();
    await act(async () => zoom.click());
    expect(onSelect).not.toHaveBeenCalled();
    expect(container.querySelector('[role="listbox"]')).not.toBeNull();
    expect(document.body.querySelector<HTMLImageElement>('.product-image-zoom-canvas img')?.src).toBe(highRes);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close enlarged product image');

    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(document.body.querySelector('.product-image-zoom-dialog')).toBeNull();
    expect(container.querySelector('[role="listbox"]')).not.toBeNull();
    expect(document.activeElement).toBe(zoom);
    expect(onSelect).not.toHaveBeenCalled();

    await act(async () => options()[0].click());
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('ART-01');
  });

  it('includes brochure-only photos in image search and makes them zoomable', async () => {
    const brochure = 'data:image/jpeg;base64,' + 'AAAA'.repeat(27_000);
    const data = products.map((product) => product.id === 'ART-02'
      ? { ...product, brochureImageDataUrl: brochure } : product);
    expect(searchQuotationProducts(data, '', 'all', 'with-image').map((product) => product.id))
      .toContain('ART-02');
    expect(searchQuotationProducts(data, '', 'all', 'without-image').map((product) => product.id))
      .not.toContain('ART-02');
    await mount({ data });
    await open();
    await typeKeyword('Lion');
    const zoom = container.querySelector<HTMLButtonElement>('[aria-label="View full-size image of Lion Painting Set"]')!;
    expect(zoom).toBeTruthy();
    await act(async () => zoom.click());
    expect(document.body.querySelector<HTMLImageElement>('.product-image-zoom-canvas img')?.src).toBe(brochure);
  });

  it('keeps selected item visible while excluding other quoted products', async () => {
    const onSelect = vi.fn();
    await mount({ selected: 'CND-01', unavailable: new Set(['CND-01', 'ART-01']), onSelect });
    expect(container.querySelector('.quotation-product-picker-selected')?.textContent).toContain('Lavender Rose Candle');
    await open();
    expect(options().some((option) => option.textContent?.includes('Paintable Sea Turtle'))).toBe(false);
    const selected = options().find((option) => option.textContent?.includes('Lavender Rose Candle'))!;
    await act(async () => selected.click());
    expect(onSelect).not.toHaveBeenCalled();
  });
});
