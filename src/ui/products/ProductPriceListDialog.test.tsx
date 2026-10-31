// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../domain/products';
import { ProductPriceListDialog, type ProductPriceListDialogProps } from './ProductPriceListDialog';
import { ProductCatalog } from './ProductCatalog';

const photo = 'data:image/jpeg;base64,/9j/' + 'AAAA'.repeat(25);
const products: Product[] = Array.from({ length: 28 }, (_, i) => ({
  id: `P-${i + 1}`, name: `Bear ${i + 1} P (1pcs)`, category: i === 0 ? 'candle' : 'paintable-art',
  safetyWasteRate: 0, isActive: i !== 27, ...(i === 0 ? { imageDataUrl: photo } : {}), notes: 'PRIVATE COSTS',
}));
const prices = [
  { id: 'single', label: 'SINGLE', detail: 'Per piece', quantity: 1, unitPrice: 35 },
  { id: 'bulk', label: '30+ PCS', detail: 'Party package', quantity: 30, unitPrice: 25 },
];
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});
async function mount(overrides: Partial<ProductPriceListDialogProps> = {}) {
  const props = { products, onClose: vi.fn(), onPrint: vi.fn(), loadPrices: vi.fn(async () => prices), ...overrides };
  await act(async () => root.render(<ProductPriceListDialog {...props} />));
  return props;
}
function button(text: string) {
  const found = Array.from(container.querySelectorAll('button')).find((node) => node.textContent === text);
  if (!found) throw Error('Missing button ' + text);
  return found;
}
function check(text: string) {
  const found = Array.from(container.querySelectorAll('label')).find((node) => node.textContent?.startsWith(text))?.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (!found) throw Error('Missing checkbox ' + text);
  return found;
}
async function click(node: HTMLElement) { await act(async () => { node.click(); }); }
async function search(value: string) {
  const input = container.querySelector<HTMLInputElement>('input[type="search"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function choose(label: string, value: string) {
  const input = Array.from(container.querySelectorAll('label')).find((node) => node.textContent?.startsWith(label))!.querySelector('select')!;
  await act(async () => { input.value = value; input.dispatchEvent(new Event('change', { bubbles: true })); });
}

describe('Product price list generator', () => {
  it('searches the sample code, selects all matches across pages and retains individual selections across filters', async () => {
    const props = await mount();
    expect(button('Generate price list (0)').disabled).toBe(true);
    await search('p (1PCS)');
    expect(check('Select all matches').parentElement?.textContent).toContain('(27)');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(25);
    await click(check('Select all matches'));
    expect(button('Generate price list (27)').disabled).toBe(false);
    await search('Bear 1 P (1pcs)');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(container.textContent).toContain('26 outside current filters');
    const individual = container.querySelector<HTMLInputElement>('tbody input')!;
    await click(individual);
    expect(button('Generate price list (26)')).toBeTruthy();
    await search('p (1pcs)');
    expect(check('Select all matches').indeterminate).toBe(true);
    await click(button('Generate price list (26)'));
    for (let attempt = 0; attempt < 100 && !container.querySelector('[aria-label="Price list preview"]'); attempt++) {
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1)); });
    }
    expect(props.loadPrices).toHaveBeenCalledTimes(26);
    expect(props.loadPrices).not.toHaveBeenCalledWith('P-1');
    expect(props.loadPrices).not.toHaveBeenCalledWith('P-28');
    expect(container.querySelectorAll('[aria-label="Price list preview"] tbody tr')).toHaveLength(25);
    await click(button('Preview next'));
    expect(container.querySelectorAll('[aria-label="Price list preview"] tbody tr')).toHaveLength(1);
    await click(button('Print / Save as PDF'));
    expect(props.onPrint).toHaveBeenCalledWith(expect.objectContaining({ rows: expect.arrayContaining([expect.objectContaining({ productId: 'P-27' })]) }));
    expect(props.onPrint).toHaveBeenCalledWith(expect.objectContaining({ rows: expect.objectContaining({ length: 26 }) }));
    expect(container.querySelector('[aria-label="Price list preview"]')?.textContent).not.toContain('PRIVATE COSTS');
  });

  it('combines filters, previews picture and package options and prints exactly the chosen products', async () => {
    const props = await mount();
    await choose('Category', 'candle');
    await choose('Picture availability', 'with');
    await click(check('Select all matches'));
    await click(button('Generate price list (1)'));
    const preview = () => container.querySelector('[aria-label="Price list preview"]')!;
    expect(preview().textContent).toContain('₱35.00');
    expect(preview().textContent).not.toContain('₱25.00');
    expect(preview().querySelector('img')).toBeNull();
    await click(check('Include product pictures'));
    await click(check('Include bulk / package prices'));
    expect(preview().querySelector('img')?.src).toBe(photo);
    expect(preview().textContent).toContain('Party package · Min. 30 pcs');
    await click(button('Print / Save as PDF'));
    expect(props.onPrint).toHaveBeenCalledWith(expect.objectContaining({ includePictures: true, includePackages: true, rows: [expect.objectContaining({ productId: 'P-1', prices })] }));
  });

  it('supports archived products, empty results, clear filters, selected-only and selection invalidation', async () => {
    await mount();
    await choose('Product status', 'archived');
    await click(check('Select all matches'));
    await click(button('Generate price list (1)'));
    await click(button('Clear filters'));
    expect(container.textContent).toContain('1 outside current filters');
    await click(check('Show selected only'));
    expect(container.textContent).toContain('No products match');
    await choose('Product status', 'all');
    expect(container.querySelectorAll('[aria-label="Matching products"] tbody tr')).toHaveLength(1);
    await click(button('Clear selection'));
    expect(container.querySelector('[aria-label="Price list preview"]')).toBeNull();
    expect(button('Generate price list (0)').disabled).toBe(true);
  });

  it('reports a loading failure, permits retry and uses an inquiry for unconfigured prices', async () => {
    const loadPrices = vi.fn().mockRejectedValueOnce(Error('Prices unavailable')).mockResolvedValue([]);
    const onPrint = vi.fn(() => { throw Error('Allow pop-ups'); });
    await mount({ products: [products[0]], loadPrices, onPrint });
    await click(check('Select all matches'));
    await click(button('Generate price list (1)'));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Prices unavailable');
    expect(container.querySelector('[aria-label="Price list preview"]')).toBeNull();
    await click(button('Generate price list (1)'));
    expect(container.textContent).toContain('Contact us for pricing');
    await click(button('Print / Save as PDF'));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Allow pop-ups');
  });

  it('traps keyboard focus, closes with Escape, and restores focus and scrolling', async () => {
    const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
    const props = await mount();
    expect(document.activeElement).toBe(container.querySelector('[aria-label="Close price list"]'));
    expect(document.body.style.overflow).toBe('hidden');
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(check('Include bulk / package prices'));
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(props.onClose).toHaveBeenCalledOnce();
    await act(async () => root.render(null));
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe('');
    trigger.remove();
  });

  it('opens from the catalog using its current search and returns to the catalog on close', async () => {
    await act(async () => root.render(<ProductCatalog products={products} loading={false} loadFailed={false} disabled={false} editingId={null}
      onEdit={vi.fn()} onNew={vi.fn()} onComponents={vi.fn()} onToggleActive={vi.fn()} />));
    await search('P (1pcs)');
    const trigger = button('Price list'); trigger.focus();
    await click(trigger);
    expect(container.querySelector('[aria-labelledby="price-list-title"]')).not.toBeNull();
    expect(container.querySelector<HTMLInputElement>('.price-list-search input')?.value).toBe('P (1pcs)');
    await click(button('Close'));
    expect(container.querySelector('[aria-labelledby="price-list-title"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('discards an in-flight list when the catalog changes and prunes removed selections', async () => {
    let resolve!: (value: typeof prices) => void;
    const loadPrices = vi.fn(() => new Promise<typeof prices>((done) => { resolve = done; }));
    const props = await mount({ products: [products[0]], loadPrices });
    await click(check('Select all matches'));
    await click(button('Generate price list (1)'));
    expect(container.querySelector('fieldset')?.disabled).toBe(true);
    expect(container.textContent).toContain('Preparing prices for 1 products');
    await act(async () => root.render(<ProductPriceListDialog {...props} products={[]} />));
    await act(async () => resolve(prices));
    expect(button('Generate price list (0)').disabled).toBe(true);
    expect(container.querySelector('[aria-label="Price list preview"]')).toBeNull();
    expect(container.querySelector('fieldset')?.disabled).toBe(false);
  });
});
