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
    expect(container.textContent).toContain('Dinosaur Toy');
  });
});
