// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../domain/products';
import { ProductionProductSearchPicker } from './ProductionProductSearchPicker';

const products: Product[] = [
  { id: 'CANDLE-001', name: 'Lavender Candle', category: 'candle', safetyWasteRate: 0, isActive: true },
  { id: 'POT-001', name: 'Round Candle Pot', category: 'candle-pot', safetyWasteRate: 0, isActive: true },
  { id: 'ART-001', name: 'Dinosaur Paint Kit', category: 'paintable-art', safetyWasteRate: 0, isActive: false },
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
  vi.unstubAllGlobals();
});

async function mount(onSelect = vi.fn(), selectedProductId = 'CANDLE-001') {
  await act(async () => root.render(
    <ProductionProductSearchPicker
      products={products}
      selectedProductId={selectedProductId}
      onSelect={onSelect}
    />,
  ));
  return onSelect;
}

function searchInput() {
  return container.querySelector<HTMLInputElement>('[aria-label="Search product to make"]')!;
}

async function typeQuery(value: string) {
  const input = searchInput();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('ProductionProductSearchPicker', () => {
  it('searches by product name, ID, and category instead of exposing a long native select', async () => {
    await mount();

    expect(container.querySelector('select')).toBeNull();
    await typeQuery('POT-001');
    expect(container.textContent).toContain('Round Candle Pot');
    expect(container.textContent).not.toContain('Dinosaur Paint Kit');

    await typeQuery('paintable art');
    expect(container.textContent).toContain('Dinosaur Paint Kit');
    expect(container.textContent).toContain('Archived');
  });

  it('selects a matching product and reports the selected identity', async () => {
    const onSelect = await mount(vi.fn(), 'CANDLE-001');

    await typeQuery('Round Candle');
    const option = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="option"]'))
      .find((item) => item.textContent?.includes('Round Candle Pot'))!;

    await act(async () => option.click());
    expect(onSelect).toHaveBeenCalledWith('POT-001');
  });

  it('supports keyboard navigation and selection', async () => {
    const onSelect = await mount(vi.fn(), 'CANDLE-001');
    const input = searchInput();

    await typeQuery('candle');
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(onSelect).toHaveBeenCalledWith('POT-001');
  });

  it('limits the initial result list and tells the user to narrow large catalogs', async () => {
    const manyProducts: Product[] = Array.from({ length: 10 }, (_, index) => ({
      id: `PRODUCT-${index + 1}`,
      name: `Product ${index + 1}`,
      category: 'candle' as const,
      safetyWasteRate: 0,
      isActive: true,
    }));

    await act(async () => root.render(
      <ProductionProductSearchPicker
        products={manyProducts}
        selectedProductId="PRODUCT-1"
        onSelect={vi.fn()}
      />,
    ));

    await act(async () => searchInput().focus());
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(8);
    expect(container.textContent).toContain('Showing 8 of 10');
  });
});
