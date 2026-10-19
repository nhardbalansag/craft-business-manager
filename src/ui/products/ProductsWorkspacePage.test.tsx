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

  it('moves the full Pricing tools into a third Products tab while preserving a catalog draft', async () => {
    await act(async () => root.render(<ProductsWorkspacePage />));
    await flush();

    const areas = container.querySelector<HTMLElement>('[aria-label="Products workshop areas"]')!;
    const pricing = areas.querySelector<HTMLButtonElement>('[aria-controls="products-pricing-area"]')!;
    expect(pricing.textContent).toContain('Pricing & quotations');
    expect(pricing.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector('[aria-label="Selected pricing Product"]')).toBeNull();

    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Edit Dinosaur Toy"]')!.click());
    const name = container.querySelector<HTMLInputElement>('input[placeholder="Paintable star"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(name, 'Draft dinosaur');
      name.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => pricing.click());
    await flush();
    expect(pricing.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('#products-catalog-area')?.hasAttribute('hidden')).toBe(true);
    expect(container.querySelector('#products-pricing-area')?.hasAttribute('hidden')).toBe(false);
    expect(container.querySelector('[aria-label="Selected pricing Product"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Financial source summary"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Tier pricing summary"]')).not.toBeNull();
    expect(container.textContent).toContain('Open Order Price Preview');
    expect((await session.productService.getProduct('PRD-1'))?.name).toBe('Dinosaur Toy');

    await act(async () => areas.querySelector<HTMLButtonElement>('[aria-controls="products-catalog-area"]')!.click());
    expect(pricing.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector('[aria-label="Selected pricing Product"]')).toBeNull();
    expect(name.value).toBe('Draft dinosaur');
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
