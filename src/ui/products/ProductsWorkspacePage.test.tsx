// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as session from '../../application/session';
import type { Product } from '../../domain/products';
import { ProductsWorkspacePage } from './ProductsWorkspacePage';

const product: Product = {
  id: 'PRD-1',
  name: 'Dinosaur Toy',
  category: 'paintable-art',
  safetyWasteRate: 0.05,
  isActive: true,
};

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  await Promise.all([
    session.materialRepository.replaceAll([]),
    session.calibrationRepository.replaceAll([]),
    session.mixPresetRepository.replaceAll([]),
    session.productRepository.replaceAll([product]),
    session.productComponentRepository.replaceAll([]),
    session.productStockRepository.replaceAll([]),
    session.fixedRecipeItemRepository.replaceAll([]),
    session.yieldSampleRepository.replaceAll([]),
    session.productFinancialProfileRepository.replaceAll([]),
    session.storageLocationRepository.replaceAll([]),
    session.moldRepository.replaceAll([]),
    session.plasterMoldYieldProfileRepository.replaceAll([]),
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

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('ProductsWorkspacePage', () => {
  it('puts Back to product catalog beside Save product and preserves an unsaved edit', async () => {
    await act(async () => root.render(<ProductsWorkspacePage />));
    await flush();

    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Edit Dinosaur Toy"]')!.click());
    const actions = container.querySelector<HTMLElement>('.product-editor-savebar-actions')!;
    const bottomBack = actions.querySelector<HTMLButtonElement>('.product-editor-bottom-back')!;
    const save = actions.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(bottomBack.textContent).toContain('Back to product catalog');
    expect(bottomBack.type).toBe('button');
    expect(save.textContent).toContain('Save product');
    expect(bottomBack.nextElementSibling).toBe(save);

    const name = container.querySelector<HTMLInputElement>('input[placeholder="Paintable star"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(name, 'Draft dinosaur');
      name.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => bottomBack.click());
    expect(container.querySelector('.product-catalog.is-editor-shell-open')).toBeNull();
    expect(container.querySelector('.product-resume-draft')?.textContent).toContain('Continue your unsaved draft');
    expect((await session.productService.getProduct('PRD-1'))?.name).toBe('Dinosaur Toy');

    await act(async () => container.querySelector<HTMLButtonElement>('.product-resume-draft button')!.click());
    expect(name.value).toBe('Draft dinosaur');
    expect(container.querySelector('.product-catalog.is-editor-shell-open')).not.toBeNull();
  });

  it('puts Back to product catalog beside Create product without submitting an unfinished new item', async () => {
    await act(async () => root.render(<ProductsWorkspacePage />));
    await flush();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="+ New product"]')!.click());

    const actions = container.querySelector<HTMLElement>('.product-editor-savebar-actions')!;
    const back = actions.querySelector<HTMLButtonElement>('.product-editor-bottom-back')!;
    const create = actions.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(back.type).toBe('button');
    expect(back.textContent).toContain('Back to product catalog');
    expect(create.textContent).toContain('Create product');
    expect(back.nextElementSibling).toBe(create);

    const name = container.querySelector<HTMLInputElement>('input[placeholder="Paintable star"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(name, 'Draft new candle');
      name.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => back.click());
    expect(container.querySelector('.product-catalog.is-editor-shell-open')).toBeNull();
    expect(container.querySelector('.product-resume-draft')?.textContent).toContain('A new product is in progress');
    expect(await session.productService.listProducts()).toHaveLength(1);

    await act(async () => container.querySelector<HTMLButtonElement>('.product-resume-draft button')!.click());
    expect(name.value).toBe('Draft new candle');
  });

  it('preserves the product draft and catalog layout when visiting molds and storage', async () => {
    await act(async () => root.render(<ProductsWorkspacePage />));
    await flush();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Edit Dinosaur Toy"]')!.click());
    const name = container.querySelector<HTMLInputElement>('input[placeholder="Paintable star"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(name, 'Draft dinosaur');
      name.dispatchEvent(new Event('input', { bubbles: true }));
      Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Compact')!.click();
    });
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-controls="products-physical-area"]')!.click());
    await flush();
    expect(container.querySelector('#products-catalog-area')?.hasAttribute('hidden')).toBe(true);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-controls="products-catalog-area"]')!.click());
    expect(name.value).toBe('Draft dinosaur');
    expect(container.querySelector('.product-card-grid.is-compact')).not.toBeNull();
    expect((await session.productService.getProduct('PRD-1'))?.name).toBe('Dinosaur Toy');
  });

  it('places Yield and Pricing inside Products and opens the selected Product', async () => {
    await session.productRepository.replaceAll([product, { ...product, id: 'PRD-2', name: 'Rose Candle' }]);
    await act(async () => root.render(<ProductsWorkspacePage />));
    await flush();

    const outerTabs = container.querySelector('[aria-label="Products workshop areas"]')!;
    expect(outerTabs.textContent).not.toContain('Pricing & quotations');
    const views = container.querySelector('[aria-label="Product workspace views"]')!;
    expect(Array.from(views.querySelectorAll('strong')).map((element) => element.textContent))
      .toEqual(['Products', 'Yield', 'Components', 'Finished stock', 'Pricing']);

    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Edit Rose Candle"]')!.click());
    const name = container.querySelector<HTMLInputElement>('input[placeholder="Paintable star"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(name, 'Draft rose');
      name.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => views.querySelector<HTMLButtonElement>('[aria-controls="products-view-pricing"]')!.click());
    await flush();
    const selected = container.querySelector('[aria-label="Selected pricing Product"]')!;
    expect(selected.querySelector('h2')?.textContent).toBe('Rose Candle');
    expect(selected.textContent).toContain('PRD-2');
    expect(container.querySelector('[aria-label="Financial source summary"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Tier pricing summary"]')).not.toBeNull();
    expect(container.textContent).toContain('Open Order Price Preview');

    await act(async () => views.querySelector<HTMLButtonElement>('[aria-controls="products-view-products"]')!.click());
    expect(container.querySelector('#products-view-pricing')?.hasAttribute('hidden')).toBe(true);
    expect(container.querySelector('[aria-label="Selected pricing Product"]')).not.toBeNull();
    expect(name.value).toBe('Draft rose');

    // Direct Pricing action changes the shared Product without searching in the Pricing catalog.
    await act(async () => container.querySelector<HTMLButtonElement>('.product-editor-back')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Pricing for Dinosaur Toy"]')!.click());
    await flush();
    expect(container.querySelector('[aria-label="Selected pricing Product"] h2')?.textContent).toBe('Dinosaur Toy');
  });

  it('uses the current Products selection in Yield without a second product search', async () => {
    await session.productRepository.replaceAll([product, { ...product, id: 'PRD-2', name: 'Rose Candle' }]);
    await act(async () => root.render(<ProductsWorkspacePage />));
    await flush();

    const tabs = container.querySelector('[aria-label="Product workspace views"]')!;
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Edit Rose Candle"]')!.click());
    await act(async () => tabs.querySelector<HTMLButtonElement>('[aria-controls="products-view-yield"]')!.click());
    await flush();

    const yieldPanel = container.querySelector<HTMLElement>('#products-view-yield')!;
    expect(yieldPanel.hasAttribute('hidden')).toBe(false);
    expect(yieldPanel.querySelector('[aria-label="Selected Yield product"]')?.textContent).toContain('Rose Candle');
    expect(yieldPanel.querySelector('[aria-label="Selected Yield product"]')?.textContent).toContain('PRD-2');
    expect(yieldPanel.querySelector('[aria-label="Search products for yield"]')).toBeNull();
    expect(yieldPanel.querySelector('[aria-label="Yield sample"]')).not.toBeNull();

    await act(async () => yieldPanel.querySelector<HTMLButtonElement>('.yield-change-product')!.click());
    expect(container.querySelector('#products-view-products')?.hasAttribute('hidden')).toBe(false);
    await act(async () => container.querySelector<HTMLButtonElement>('.product-editor-back')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Edit Dinosaur Toy"]')!.click());
    await act(async () => tabs.querySelector<HTMLButtonElement>('[aria-controls="products-view-yield"]')!.click());
    await flush();
    expect(yieldPanel.querySelector('[aria-label="Selected Yield product"]')?.textContent).toContain('Dinosaur Toy');
    expect(yieldPanel.querySelector('[aria-label="Selected Yield product"]')?.textContent).toContain('PRD-1');

    await act(async () => tabs.querySelector<HTMLButtonElement>('[aria-controls="products-view-pricing"]')!.click());
    await flush();
    expect(container.querySelector('[aria-label="Selected pricing Product"]')?.textContent).toContain('Dinosaur Toy');
  });

  it('keeps an unsaved Yield batch until an external Products selection is confirmed', async () => {
    await session.productRepository.replaceAll([product, { ...product, id: 'PRD-2', name: 'Rose Candle' }]);
    await act(async () => root.render(<ProductsWorkspacePage />));
    await flush();

    const tabs = container.querySelector('[aria-label="Product workspace views"]')!;
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Edit Dinosaur Toy"]')!.click());
    await act(async () => tabs.querySelector<HTMLButtonElement>('[aria-controls="products-view-yield"]')!.click());
    await flush();

    const yieldPanel = container.querySelector<HTMLElement>('#products-view-yield')!;
    const pieces = Array.from(yieldPanel.querySelectorAll<HTMLInputElement>('[type="number"]'))
      .find((input) => input.closest('label')?.textContent?.includes('Good pieces'))!;
    expect(pieces).toBeDefined();
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(pieces, '9');
      pieces.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => tabs.querySelector<HTMLButtonElement>('[aria-controls="products-view-products"]')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('.product-editor-back')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Edit Rose Candle"]')!.click());
    await flush();

    await act(async () => tabs.querySelector<HTMLButtonElement>('[aria-controls="products-view-yield"]')!.click());
    await flush();
    expect(yieldPanel.querySelector('[role="alert"]')?.textContent).toContain('Keep your unsaved batch?');
    expect(pieces.value).toBe('9');
    expect(yieldPanel.querySelector('[aria-label="Selected Yield product"]')?.textContent).toContain('Dinosaur Toy');

    const keep = Array.from(yieldPanel.querySelectorAll<HTMLButtonElement>('.yield-draft-confirm button'))
      .find((button) => button.textContent?.includes('Keep editing'))!;
    await act(async () => keep.click());
    await flush();
    expect(yieldPanel.querySelector('.yield-draft-confirm')).toBeNull();
    expect(pieces.value).toBe('9');
    await act(async () => tabs.querySelector<HTMLButtonElement>('[aria-controls="products-view-pricing"]')!.click());
    await flush();
    expect(container.querySelector('[aria-label="Selected pricing Product"]')?.textContent).toContain('Dinosaur Toy');
  });

  it('makes the Mold and Storage workspace reachable from the Products section', async () => {
    await act(async () => root.render(<ProductsWorkspacePage />));
    await flush();

    const physicalButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Molds & storage'),
    );
    expect(physicalButton).toBeTruthy();

    await act(async () => physicalButton!.click());
    await flush();

    expect(container.querySelector('[aria-label="Physical identification and storage"]')).not.toBeNull();
    expect(container.textContent).toContain('Molds & storage');
    expect(container.textContent).toContain('Molds');
    expect(container.textContent).toContain('Storage');
    expect(container.textContent).toContain('MOLD DIRECTORY');
    expect(container.querySelector('[aria-label="Plaster mold formula configuration"]')).toBeNull();
    expect(container.textContent).toContain('Dinosaur Toy');
  });
});
