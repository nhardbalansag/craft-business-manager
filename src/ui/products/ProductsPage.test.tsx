// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as session from '../../application/session';
import { ProductsPage } from './ProductsPage';
import * as productImageUpload from './productImageUpload';

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
  it('uploads, saves, reloads and removes a Product image without losing other fields', async () => {
    const photo = `data:image/jpeg;base64,/9j/${'AAAA'.repeat(25)}`;
    const highRes = 'data:image/jpeg;base64,' + 'AAAA'.repeat(20_000);
    const optimizer = vi.spyOn(productImageUpload, 'optimizeProductImages').mockResolvedValue({
      imageDataUrl: photo, brochureImageDataUrl: highRes,
    });
    await seed();
    await mount();
    await click('Edit Alpha candle');
    const input = form().querySelector<HTMLInputElement>('[aria-label="Upload product image"]')!;
    expect(input).not.toBeNull();
    expect(form().querySelector('.product-image-preview')?.textContent).toContain('No product image');
    const file = new File(['photo'], 'candle.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });
    expect(optimizer).toHaveBeenCalledWith(file);
    expect(form().querySelector<HTMLImageElement>('.product-image-preview img')?.src).toBe(photo);
    await submit();
    expect((await session.productService.getProduct('ALPHA'))?.imageDataUrl).toBe(photo);
    expect((await session.productService.getProduct('ALPHA'))?.brochureImageDataUrl).toBe(highRes);
    await click('Back to product catalog');
    expect(catalog().querySelector<HTMLImageElement>('[aria-label="Alpha candle"] img.product-catalog-thumbnail')?.src).toBe(photo);
    await click('Edit Alpha candle');
    expect(form().querySelector<HTMLImageElement>('.product-image-preview img')?.src).toBe(photo);
    await click('Remove image');
    await submit();
    expect((await session.productService.getProduct('ALPHA'))?.imageDataUrl).toBeUndefined();
    expect((await session.productService.getProduct('ALPHA'))?.brochureImageDataUrl).toBeUndefined();
    expect((await session.productService.getProduct('ALPHA'))?.name).toBe('Alpha candle');
  });

  it('shows an upload error and keeps the existing image when the new file cannot be processed', async () => {
    const photo = `data:image/jpeg;base64,/9j/${'AAAA'.repeat(25)}`;
    await seed();
    await session.productService.updateProduct('BETA', { imageDataUrl: photo });
    vi.spyOn(productImageUpload, 'optimizeProductImages').mockRejectedValue(new Error('Image is too large'));
    await mount();
    await click('Edit Beta star');
    const input = form().querySelector<HTMLInputElement>('[aria-label="Upload product image"]')!;
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['bad'], 'bad.png', { type: 'image/png' })] });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });
    expect(form().querySelector('[role="alert"]')?.textContent).toContain('Image is too large');
    expect(form().querySelector<HTMLImageElement>('.product-image-preview img')?.src).toBe(photo);
    expect((await session.productService.getProduct('BETA'))?.imageDataUrl).toBe(photo);
  });

  it('saves selected candle wax and essential oil links used by Production and Pricing', async () => {
    await seed();
    await session.materialService.updateMaterial('WAX', { essentialOilPercent: 6 });
    await session.materialService.createMaterial({
      id: 'OIL', name: 'Lavender oil', group: 'fragrance', baseUnit: 'g',
      purchaseQuantity: 1, purchaseUnit: 'kg', packageCost: 500,
      onHandQuantity: 1, onHandUnit: 'kg', isActive: true,
    });
    await mount();
    await click('Edit Alpha candle');
    expect(form().textContent).toContain('Wax for essential oil calculation');
    await fill(field('Wax for essential oil calculation'), 'WAX');
    await fill(field('Essential oil for production costs'), 'OIL');
    await submit();
    expect(await session.productService.getProduct('ALPHA')).toMatchObject({
      candleWaxMaterialId: 'WAX', candleEssentialOilMaterialId: 'OIL',
    });
    await click('Edit Alpha candle');
    expect(field('Wax for essential oil calculation').value).toBe('WAX');
    expect(field('Essential oil for production costs').value).toBe('OIL');
    await fill(field('Category'), 'candle-pot');
    await submit();
    expect((await session.productService.getProduct('ALPHA'))?.candleWaxMaterialId).toBeUndefined();
    expect((await session.productService.getProduct('ALPHA'))?.candleEssentialOilMaterialId).toBeUndefined();
  });

  it('does not allow only one candle material to be configured', async () => {
    await seed();
    await mount();
    await click('Edit Alpha candle');
    await fill(field('Wax for essential oil calculation'), 'WAX');
    await submit();
    expect(container.textContent).toContain('Select both wax and essential oil');
    expect((await session.productService.getProduct('ALPHA'))?.candleWaxMaterialId).toBeUndefined();
  });
  it('keeps editor context tied to the current draft until a switch is accepted', async () => {
    await seed();
    await mount();
    await click('Edit Alpha candle');
    await fill(field('Name'), 'Unsaved candle');
    await click('Edit Beta star');
    expect(catalog().querySelector('.product-editor-context h2')?.textContent).toBe('Edit Alpha candle');
    await click('Keep editing');
    expect(catalog().querySelector('.product-editor-context h2')?.textContent).toBe('Edit Alpha candle');
    await click('Edit Beta star');
    await click('Discard changes');
    expect(catalog().querySelector('.product-editor-context h2')?.textContent).toBe('Edit Beta star');
    await click('Clear');
    expect(catalog().querySelector('.product-editor-context h2')?.textContent).toBe('Add a new product');
  });

  it('resumes a new product draft from the catalog without resetting its fields', async () => {
    await mount();
    await click('+ New product');
    await fill(field('Name'), 'Unfinished star');
    await act(async () => catalog().querySelector<HTMLButtonElement>('.product-editor-back')!.click());
    expect(catalog().querySelector<HTMLElement>('.product-catalog-collection')?.hidden).toBe(false);
    await click('Resume draft');
    expect(field('Name').value).toBe('Unfinished star');
    expect(catalog().querySelector<HTMLElement>('.product-catalog-collection')?.hidden).toBe(true);
    expect(document.activeElement).toBe(field('Name'));
  });

  it('assigns a stable Product ID automatically and previews fractional material reserves', async () => {
    await seed();
    await mount();
    await click('+ New product');
    expect(field('Product ID').value).toBe('PROD-0001');
    expect((field('Product ID') as HTMLInputElement).readOnly).toBe(true);
    await fill(field('Name'), 'New star');
    await fill(field('Safety waste (%)'), '7.25');
    expect(form().querySelector('[aria-label="Material reserve preview"]')?.textContent).toContain('107.25 g planned');
    await submit();
    expect((await session.productService.getProduct('PROD-0001'))?.safetyWasteRate).toBe(0.0725);
  });

  it('retains normalized saved details without a false unsaved warning', async () => {
    await mount();
    await click('+ New product');
    await fill(field('Name'), ' New star ');
    await submit();
    expect(field('Product ID').value).toBe('PROD-0001');
    expect((field('Product ID') as HTMLInputElement).readOnly).toBe(true);
    expect(field('Name').value).toBe('New star');
    expect(form().querySelector('.product-editor-state')?.textContent).toContain('All changes saved');
    await fill(field('Name'), ' Updated star ');
    await submit();
    expect(field('Name').value).toBe('Updated star');
    expect(form().querySelector('.product-editor-state')?.textContent).toContain('All changes saved');
    expect(catalog().querySelector('.product-editor-context h2')?.textContent).toBe('Edit Updated star');
  });

  it('clears incompatible legacy preset references and preserves a draft when saving fails', async () => {
    await seed();
    await mount();
    await click('Edit Alpha candle');
    await fill(field('Category'), 'candle-pot');
    expect(form().querySelector('.product-mix-notice')).toBeNull();
    vi.spyOn(session.productService, 'updateProduct').mockRejectedValueOnce(new Error('Could not save'));
    await fill(field('Name'), 'Changed pot');
    await submit();
    expect(field('Name').value).toBe('Changed pot');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Could not save');
    await submit();
    expect(await session.productService.getProduct('ALPHA')).toMatchObject({ name: 'Changed pot', category: 'candle-pot' });
    expect((await session.productService.getProduct('ALPHA'))?.mixPresetId).toBeUndefined();
  });

  it('keeps drafts when reselecting a product and asks before replacing them', async () => {
    await seed();
    await mount();
    await click('Edit Alpha candle');
    await fill(field('Name'), 'Unsaved candle');
    await click('Edit Alpha candle');
    expect(field('Name').value).toBe('Unsaved candle');
    await click('Edit Beta star');
    expect(field('Product ID').value).toBe('ALPHA');
    expect(container.querySelector('.product-draft-warning')?.textContent).toContain('Opening Beta star');
    expect(document.activeElement).toBe(container.querySelector('.product-draft-warning'));
    await click('Keep editing');
    expect(field('Name').value).toBe('Unsaved candle');
    expect(document.activeElement).toBe(field('Name'));
    await click('Edit Beta star');
    await click('Discard changes');
    expect(field('Product ID').value).toBe('BETA');
    expect(field('Name').value).toBe('Beta star');
    expect((await session.productService.getProduct('ALPHA'))?.name).toBe('Alpha candle');
  });

  it('guards starting a new product and clears draft status after saving', async () => {
    await seed();
    await mount();
    await click('Edit Alpha candle');
    await fill(field('Name'), 'Updated candle');
    await click('+ New product');
    expect(container.querySelector('.product-draft-warning')).not.toBeNull();
    await click('Keep editing');
    await submit();
    expect(container.querySelector('.product-editor-state')?.textContent).toContain('All changes saved');
    await click('+ New product');
    expect(container.querySelector('.product-draft-warning')).toBeNull();
    expect(field('Product ID').value).toBe('PROD-0001');
  });

  it('keeps filters and actions when switching catalog layout and shows matching category counts', async () => {
    await seed();
    await mount();
    await click('Compact');
    expect(catalog().querySelector('.product-card-grid.is-compact')).not.toBeNull();
    await fill(catalog().querySelector('input')!, 'Alpha');
    expect(catalog().querySelector('[aria-label="Candle"] .product-filter-count')?.textContent).toBe('1');
    expect(catalog().querySelector('[aria-label="Paintable art"] .product-filter-count')?.textContent).toBe('0');
    await click('Cards');
    expect(catalog().querySelectorAll('article')).toHaveLength(1);
    expect(catalog().querySelector('input')?.value).toBe('Alpha');
    await click('Edit Alpha candle');
    expect(field('Product ID').value).toBe('ALPHA');
  });

  it('shows the Product Catalog as a table without losing filters or catalog actions', async () => {
    await seed();
    await mount();

    await click('Table');

    const tableWrap = catalog().querySelector<HTMLElement>(
      '[aria-label="Product catalog table"]',
    );
    expect(tableWrap).not.toBeNull();

    const table = tableWrap!.querySelector('table')!;
    expect(
      Array.from(table.querySelectorAll('thead th')).map((cell) =>
        cell.textContent?.trim(),
      ),
    ).toEqual([
      'Product',
      'Category',
      'Material reserve',
      'Status',
      'Notes',
      'Actions',
    ]);
    expect(table.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(table.textContent).toContain('Alpha candle');
    expect(table.textContent).toContain('5%');
    expect(table.textContent).toContain('Beta star');

    await fill(catalog().querySelector<HTMLInputElement>('input[type="search"]')!, 'Alpha');
    expect(table.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(table.textContent).toContain('Alpha candle');
    expect(table.textContent).not.toContain('Beta star');

    await click('Components for Alpha candle', table);
    expect(container.querySelector<HTMLSelectElement>('.composition-parent-panel select')?.value).toBe('ALPHA');
  });

  it('paginates the Product Catalog consistently across Cards, Compact, and Table layouts', async () => {
    await seed();

    for (let index = 3; index <= 13; index += 1) {
      await session.productService.createProduct({
        id: `PROD-${String(index).padStart(4, '0')}`,
        name: `Catalog product ${String(index).padStart(2, '0')}`,
        category: index % 2 === 0 ? 'candle' : 'paintable-art',
        safetyWasteRate: index / 100,
        isActive: true,
      });
    }

    await mount();

    expect(catalog().querySelectorAll('.product-catalog-card')).toHaveLength(10);
    expect(
      catalog().querySelector('[aria-label="Product catalog pagination"]')?.textContent,
    ).toContain('Showing 1–10 of 13 products');
    expect(
      catalog().querySelector<HTMLButtonElement>('[aria-label="Previous product page"]')?.disabled,
    ).toBe(true);
    expect(
      catalog().querySelector<HTMLButtonElement>('[aria-label="Next product page"]')?.disabled,
    ).toBe(false);

    await click('Next', catalog());

    expect(catalog().querySelectorAll('.product-catalog-card')).toHaveLength(3);
    expect(
      catalog().querySelector('[aria-label="Product catalog pagination"]')?.textContent,
    ).toContain('Showing 11–13 of 13 products');
    expect(
      catalog().querySelector('[aria-label="Product page 2"]')?.getAttribute('aria-current'),
    ).toBe('page');

    await click('Compact', catalog());
    expect(catalog().querySelector('.product-card-grid.is-compact')).not.toBeNull();
    expect(catalog().querySelectorAll('.product-catalog-card')).toHaveLength(3);

    await click('Table', catalog());
    expect(
      catalog().querySelectorAll('[aria-label="Product catalog table"] tbody tr'),
    ).toHaveLength(3);
    expect(
      catalog().querySelector('[aria-label="Product catalog pagination"]')?.textContent,
    ).toContain('Showing 11–13 of 13 products');

    await fill(
      catalog().querySelector<HTMLSelectElement>('[aria-label="Products per page"]')!,
      '25',
    );

    expect(
      catalog().querySelectorAll('[aria-label="Product catalog table"] tbody tr'),
    ).toHaveLength(13);
    expect(
      catalog().querySelector('[aria-label="Product catalog pagination"]')?.textContent,
    ).toContain('Showing 1–13 of 13 products');
    expect(
      catalog().querySelector('[aria-label="Product page 1"]')?.getAttribute('aria-current'),
    ).toBe('page');

    await fill(
      catalog().querySelector<HTMLInputElement>('input[type="search"]')!,
      'Alpha candle',
    );

    expect(
      catalog().querySelectorAll('[aria-label="Product catalog table"] tbody tr'),
    ).toHaveLength(1);
    expect(
      catalog().querySelector('[aria-label="Product catalog pagination"]')?.textContent,
    ).toContain('Showing 1–1 of 1 products');
  });

  it('creates the first product from the guided form with a correct reserve rate', async () => {
    await mount();
    expect(catalog().textContent).toContain('Make room for your first creation');
    await click('Add your first product');
    expect(document.activeElement).toBe(field('Name'));
    await fill(field('Name'), 'Paintable star');
    await fill(field('Safety waste (%)'), '7.5');
    await submit();
    expect(await session.productService.getProduct('PROD-0001')).toMatchObject({
      name: 'Paintable star',
      safetyWasteRate: 0.075,
    });
    expect(catalog().textContent).toContain('Paintable star');
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Product created');
  });

  it('searches product names, combines category filters, and recovers an empty search', async () => {
    await seed();
    await mount();
    await fill(catalog().querySelector('input')!, 'Alpha');
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
    expect((field('Product ID') as HTMLInputElement).readOnly).toBe(true);
    await fill(field('Category'), 'paintable-art');
    expect(form().querySelector('[name="mixPresetId"]')).toBeNull();
    await fill(field('Name'), 'Updated candle');
    await submit();
    expect(await session.productService.getProduct('ALPHA')).toMatchObject({
      name: 'Updated candle',
      mixPresetId: 'MIX',
      category: 'paintable-art',
    });
    expect(await session.productService.listProducts()).toHaveLength(2);
    await fill(field('Category'), 'candle-pot');
    await submit();
    expect((await session.productService.getProduct('ALPHA'))?.mixPresetId).toBeUndefined();
  });

  it('retains catalog filters and unsaved product fields across workspace views', async () => {
    await seed();
    await mount();
    await click('Edit Beta star');
    await fill(field('Name'), 'Draft name');
    await fill(catalog().querySelector('input')!, 'Beta');
    await navigate('Components');
    await navigate('Products');
    expect(field('Name').value).toBe('Draft name');
    expect(catalog().querySelector('input')?.value).toBe('Beta');
    expect((await session.productService.getProduct('BETA'))?.name).toBe('Beta star');
  });

  it('opens Components for the currently edited Product without manually changing Product to compose', async () => {
    await seed();
    await session.productComponentRepository.replaceAll([{
      id: 'COMP-BETA',
      parentProductId: 'BETA',
      sourceType: 'material',
      sourceId: 'WAX',
      role: 'accessory',
      quantityPerParent: 2,
    }]);
    await mount();
    await click('Edit Beta star');
    expect(field('Product ID').value).toBe('BETA');
    await navigate('Components');
    expect(container.querySelector<HTMLSelectElement>('.composition-parent-panel select')?.value).toBe('BETA');
    expect(container.querySelector('.component-summary-panel h2')?.textContent).toBe('Beta star');
    expect(container.querySelector('.component-card-list')?.textContent).toContain('COMP-BETA');
    expect(container.querySelector('.component-card-list')?.textContent).toContain('Soy wax');
    // Component editing remains available for the automatically selected parent.
    await click('Edit', container.querySelector('.component-card-list')!);
    expect(container.querySelector('.component-editor-form')?.textContent).toContain('Save component');
  });

  it('follows the latest edited Product when returning to Components while keeping manual parent selection usable', async () => {
    await seed();
    await mount();
    await click('Edit Beta star');
    await navigate('Components');
    const parent = () => container.querySelector<HTMLSelectElement>('.composition-parent-panel select')!;
    expect(parent().value).toBe('BETA');
    await fill(parent(), 'ALPHA');
    expect(parent().value).toBe('ALPHA');
    await navigate('Products');
    // Returning from the editor shell to the catalog keeps the draft and lets us edit another product.
    await click('Back to product catalog');
    await click('Edit Alpha candle');
    expect(field('Product ID').value).toBe('ALPHA');
    await navigate('Components');
    expect(parent().value).toBe('ALPHA');
    expect(container.querySelector('.component-summary-panel h2')?.textContent).toBe('Alpha candle');
    await navigate('Products');
    await click('Back to product catalog');
    await click('Edit Beta star');
    await navigate('Components');
    expect(parent().value).toBe('BETA');
  });

  it('makes components available for a newly saved Product immediately after creation', async () => {
    await seed();
    await mount();
    await click('+ New product');
    await fill(field('Name'), 'New gift set');
    await fill(field('Safety waste (%)'), '5');
    await submit();
    const newId = field('Product ID').value;
    expect(newId).not.toBe('');
    expect((await session.productService.getProduct(newId))?.name).toBe('New gift set');
    await navigate('Components');
    expect(container.querySelector<HTMLSelectElement>('.composition-parent-panel select')?.value).toBe(newId);
    expect(container.querySelector('.component-summary-panel h2')?.textContent).toBe('New gift set');
    expect(container.querySelector('.component-summary-panel')?.textContent).toContain('No component lines yet');
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
  it('hides Mix Presets UI but preserves legacy preset references on product edits', async () => {
    await seed();
    await mount();
    const views = Array.from(container.querySelectorAll('nav[aria-label="Product workspace views"] button'));
    expect(views.some((button) => button.textContent?.includes('Mix presets'))).toBe(false);
    expect(container.querySelector('#products-view-mixes')).toBeNull();
    expect(container.querySelector('[aria-label="Workshop summary"]')?.textContent).not.toContain('Mix presets');
    expect(catalog().textContent).not.toContain('Signature blend');
    await click('Table');
    expect(catalog().querySelector('.product-catalog-table')?.textContent).not.toContain('Mix preset');
    await click('Cards');
    await click('Edit Alpha candle');
    expect(form().querySelector('[name="mixPresetId"]')).toBeNull();
    await fill(field('Name'), 'Renamed legacy candle');
    await submit();
    expect(await session.productService.getProduct('ALPHA')).toMatchObject({
      name: 'Renamed legacy candle',
      mixPresetId: 'MIX',
    });
    expect((await session.mixPresetService.listMixPresets()).map((preset) => preset.id)).toContain('MIX');
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
