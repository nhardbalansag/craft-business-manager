// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as session from '../../application/session';
import { ProductsPage } from './ProductsPage';

let container: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  await Promise.all([
    session.materialRepository.replaceAll([]),
    session.productRepository.replaceAll([]),
    session.mixPresetRepository.replaceAll([]),
    session.productComponentRepository.replaceAll([]),
    session.productStockRepository.replaceAll([]),
    session.fixedRecipeItemRepository.replaceAll([]),
    session.yieldSampleRepository.replaceAll([]),
    session.calibrationRepository.replaceAll([]),
    session.productFinancialProfileRepository.replaceAll([]),
  ]);
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
async function mount() {
  await act(async () => root.render(<ProductsPage />));
}
function catalog() {
  return container.querySelector<HTMLElement>('[aria-label="Product catalog"]')!;
}
function form() {
  return container.querySelector<HTMLFormElement>('[aria-label="Product details"]')!;
}
function field(label: string) {
  const parent = Array.from(form().querySelectorAll('label')).find(
    (item) => item.querySelector('span')?.textContent === label,
  );
  if (!parent) throw new Error(`No field: ${label}`);
  return parent.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea')!;
}
async function fill(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}
async function click(text: string, scope: ParentNode = container) {
  const button = Array.from(scope.querySelectorAll('button')).find(
    (item) => item.getAttribute('aria-label') === text || item.textContent?.trim() === text,
  );
  if (!button) throw new Error(`No button: ${text}`);
  await act(async () => button.click());
}
async function navigate(view: string) {
  const button = Array.from(container.querySelectorAll('nav button')).find(
    (item) => item.querySelector('strong')?.textContent === view,
  )!;
  await act(async () => (button as HTMLButtonElement).click());
}
async function submit() {
  await act(async () => form().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
}
async function seed() {
  await session.materialService.createMaterial({
    id: 'WAX',
    name: 'Soy wax',
    group: 'wax',
    baseUnit: 'g',
    purchaseQuantity: 100,
    purchaseUnit: 'g',
    packageCost: 10,
    onHandQuantity: 100,
    onHandUnit: 'g',
    isActive: true,
  });
  await session.mixPresetService.createMixPreset({
    id: 'MIX',
    name: 'Signature blend',
    basis: 'weight',
    compatibleCategories: ['candle', 'paintable-art'],
    lines: [{ materialId: 'WAX', role: 'primary', parts: 100 }],
    isActive: true,
  });
  await session.productService.createProduct({
    id: 'ALPHA',
    name: 'Alpha candle',
    category: 'candle',
    mixPresetId: 'MIX',
    safetyWasteRate: 0.05,
    isActive: true,
  });
  await session.productService.createProduct({
    id: 'BETA',
    name: 'Beta star',
    category: 'paintable-art',
    safetyWasteRate: 0.1,
    isActive: true,
  });
}

describe('product workshop interactions', () => {
  it('creates the first product from the guided form with a correct reserve rate', async () => {
    await mount();
    expect(catalog().textContent).toContain('Make room for your first creation');
    await click('Add your first product');
    expect(document.activeElement).toBe(field('Name'));
    await fill(field('Product ID'), 'STAR');
    await fill(field('Name'), 'Paintable star');
    await fill(field('Safety waste (%)'), '7.5');
    await submit();
    expect(await session.productService.getProduct('STAR')).toMatchObject({
      name: 'Paintable star',
      safetyWasteRate: 0.075,
    });
    expect(catalog().textContent).toContain('Paintable star');
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Product created');
  });

  it('searches mix names, combines category filters, and recovers an empty search', async () => {
    await seed();
    await mount();
    await fill(catalog().querySelector('input')!, 'Signature blend');
    expect(catalog().querySelectorAll('article')).toHaveLength(1);
    expect(catalog().textContent).toContain('Alpha candle');
    await click('Paintable art', catalog());
    expect(catalog().textContent).toContain('No matching products');
    expect(catalog().textContent).not.toContain('Make room for your first creation');
    await click('Clear filters', catalog());
    expect(catalog().querySelectorAll('article')).toHaveLength(2);
  });

  it('edits without changing identity and preserves compatible mix selections', async () => {
    await seed();
    await mount();
    await click('Edit Alpha candle');
    expect((field('Product ID') as HTMLInputElement).disabled).toBe(true);
    await fill(field('Category'), 'paintable-art');
    expect(field('Mix preset').value).toBe('MIX');
    await fill(field('Name'), 'Updated candle');
    await submit();
    expect(await session.productService.getProduct('ALPHA')).toMatchObject({
      name: 'Updated candle',
      mixPresetId: 'MIX',
      category: 'paintable-art',
    });
    expect(await session.productService.listProducts()).toHaveLength(2);
    await fill(field('Category'), 'candle-pot');
    expect(field('Mix preset').value).toBe('');
  });

  it('retains catalog filters and unsaved product fields across workspace views', async () => {
    await seed();
    await mount();
    await click('Edit Beta star');
    await fill(field('Name'), 'Draft name');
    await fill(catalog().querySelector('input')!, 'Beta');
    await navigate('Mix presets');
    await navigate('Products');
    expect(field('Name').value).toBe('Draft name');
    expect(catalog().querySelector('input')?.value).toBe('Beta');
    expect((await session.productService.getProduct('BETA'))?.name).toBe('Beta star');
  });

  it('opens composition for the product selected in the catalog', async () => {
    await seed();
    await mount();
    await click('Components for Beta star');
    expect(container.querySelector<HTMLSelectElement>('.composition-parent-panel select')?.value).toBe('BETA');
    expect(container.querySelector('#products-view-products')?.hasAttribute('hidden')).toBe(true);
  });

  it('archives and restores a product through the catalog', async () => {
    await seed();
    await mount();
    await click('Archive Beta star');
    expect((await session.productService.getProduct('BETA'))?.isActive).toBe(false);
    await fill(catalog().querySelector('select')!, 'archived');
    expect(catalog().querySelectorAll('article')).toHaveLength(1);
    await click('Restore Beta star');
    expect((await session.productService.getProduct('BETA'))?.isActive).toBe(true);
    expect(container.textContent).toContain('Beta star restored.');
  });

  it('shows relationship errors without archiving a component used by an active product', async () => {
    await seed();
    await session.productComponentService.createComponent({
      id: 'COMP',
      parentProductId: 'ALPHA',
      sourceType: 'product',
      sourceId: 'BETA',
      role: 'accessory',
      quantityPerParent: 1,
    });
    await mount();
    await click('Archive Beta star');
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect((await session.productService.getProduct('BETA'))?.isActive).toBe(true);
  });

  it('rejects a blank reserve rather than silently saving zero', async () => {
    await seed();
    await mount();
    await click('Edit Alpha candle');
    await fill(field('Safety waste (%)'), '');
    await submit();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Enter a material reserve percentage');
    expect((await session.productService.getProduct('ALPHA'))?.safetyWasteRate).toBe(0.05);
  });

  it('prevents duplicate saves while the first save is pending', async () => {
    await seed();
    await mount();
    await click('Edit Alpha candle');
    const update = session.productService.updateProduct.bind(session.productService);
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const spy = vi.spyOn(session.productService, 'updateProduct').mockImplementation(async (...args) => {
      await pending;
      return update(...args);
    });
    await act(async () => {
      form().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      form().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(spy).toHaveBeenCalledOnce();
    expect(form().querySelector('fieldset')?.disabled).toBe(true);
    await act(async () => release());
    expect(form().querySelector('fieldset')?.disabled).toBe(false);
  });

  it('recovers from catalog failures without presenting an empty collection as loaded', async () => {
    await seed();
    vi.spyOn(session.productService, 'listProducts').mockRejectedValueOnce(new Error('Read failed'));
    await mount();
    expect(catalog().textContent).toContain('Catalog unavailable');
    expect(form().querySelector('fieldset')?.disabled).toBe(true);
    await click('Retry loading');
    expect(catalog().querySelectorAll('article')).toHaveLength(2);
    expect(form().querySelector('fieldset')?.disabled).toBe(false);
  });

  it('keeps a failed edit available for correction and retry', async () => {
    await seed();
    await mount();
    await click('Edit Alpha candle');
    await fill(field('Name'), 'Beta star');
    await submit();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(field('Name').value).toBe('Beta star');
    await fill(field('Name'), 'New candle');
    await submit();
    expect((await session.productService.getProduct('ALPHA'))?.name).toBe('New candle');
  });

  it('recovers component and stock source loading errors', async () => {
    await seed();
    await mount();
    vi.spyOn(session.productComponentService, 'listComponents').mockRejectedValueOnce(
      new Error('Components unavailable'),
    );
    await navigate('Components');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Components unavailable');
    await click('Retry loading');
    expect(container.querySelector('.composition-parent-panel')).not.toBeNull();
    vi.spyOn(session.productStockService, 'listStocks').mockRejectedValueOnce(new Error('Stock unavailable'));
    await navigate('Finished stock');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Stock unavailable');
    await click('Retry loading');
    expect(container.querySelector('.product-stock-editor')).not.toBeNull();
  });
  it('searches presets by material name and restores an archived mix', async () => {
    await seed();
    await session.productService.updateProduct('ALPHA', { mixPresetId: undefined });
    await mount();
    await navigate('Mix presets');
    const mixes = container.querySelector<HTMLElement>('#products-view-mixes')!;
    await fill(mixes.querySelector<HTMLInputElement>('.search-field input')!, 'Soy wax');
    expect(mixes.querySelectorAll('tbody tr')).toHaveLength(1);
    await click('Archive', mixes);
    expect((await session.mixPresetService.listMixPresets())[0]?.isActive).toBe(false);
    await fill(mixes.querySelector<HTMLSelectElement>('[aria-label="Mix status filter"]')!, 'archived');
    await click('Restore', mixes);
    expect((await session.mixPresetService.listMixPresets())[0]?.isActive).toBe(true);
  });

  it('creates a reusable mix through the ratio editor', async () => {
    await seed();
    await mount();
    await navigate('Mix presets');
    const mixes = container.querySelector<HTMLElement>('#products-view-mixes')!;
    const mixForm = mixes.querySelector('form')!;
    const inputs = mixForm.querySelectorAll<HTMLInputElement>('input:not([type="checkbox"])');
    await fill(inputs[0]!, 'BLEND');
    await fill(inputs[1]!, 'New wax blend');
    await fill(mixForm.querySelector<HTMLSelectElement>('[aria-label="Mix material 1"]')!, 'WAX');
    await act(async () => mixForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect((await session.mixPresetService.listMixPresets()).find((item) => item.id === 'BLEND')).toMatchObject({
      name: 'New wax blend',
      lines: [{ materialId: 'WAX', parts: 100, role: 'primary' }],
    });
    expect(container.textContent).toContain('Mix preset created.');
  });

  it('reports a completed save separately from a failed catalog refresh', async () => {
    await seed();
    await mount();
    await click('Edit Alpha candle');
    await fill(field('Name'), 'Saved candle');
    vi.spyOn(session.productService, 'listProducts').mockRejectedValueOnce(new Error('Refresh failed'));
    await submit();
    expect((await session.productService.getProduct('ALPHA'))?.name).toBe('Saved candle');
    expect(container.textContent).toContain('Product updated.');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Refresh failed');
    await click('Retry loading');
    expect(catalog().textContent).toContain('Saved candle');
  });
});
