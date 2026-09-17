// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../domain/products';
import { YieldProductSearchPicker } from './YieldProductSearchPicker';

let container: HTMLDivElement;
let root: Root;

function product(id: string, name: string, category: Product['category'] = 'paintable-art', isActive = true): Product {
  return {
    id,
    name,
    category,
    safetyWasteRate: 0.05,
    isActive,
  };
}

const products: Product[] = [
  product('ART-001', 'Paintable Star'),
  product('ART-002', 'Moon Set'),
  product('CND-001', 'Vanilla Event Candle', 'candle'),
  product('CND-002', 'Rose Event Candle', 'candle'),
  product('POT-001', 'Jewelry Pot', 'vessel'),
  product('ART-003', 'Dinosaur Set'),
  product('ART-004', 'Ocean Set'),
  product('ART-005', 'Space Set'),
  product('ART-006', 'Flower Set'),
  product('ART-007', 'Vehicle Set'),
  product('ART-099', 'Old Archived Star', 'paintable-art', false),
];

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

async function fill(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('YieldProductSearchPicker', () => {
  it('shows a short product list and searches by product name, ID, and category', async () => {
    const onSelect = vi.fn();
    await act(async () => root.render(
      <YieldProductSearchPicker products={products} selectedProductId="ART-001" onSelect={onSelect} />,
    ));

    const search = container.querySelector<HTMLInputElement>('[aria-label="Search products for yield"]')!;
    await act(async () => search.focus());

    expect(search.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(8);
    expect(container.textContent).toContain('Showing 8 of 11');

    await fill(search, 'moon');
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(1);
    expect(container.textContent).toContain('Moon Set');

    await fill(search, 'CND-001');
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(1);
    expect(container.textContent).toContain('Vanilla Event Candle');

    await fill(search, 'candle');
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(2);
    expect(container.textContent).toContain('Rose Event Candle');
  });

  it('selects a result with a click and clearly identifies archived products', async () => {
    const onSelect = vi.fn();
    await act(async () => root.render(
      <YieldProductSearchPicker products={products} selectedProductId="ART-001" onSelect={onSelect} />,
    ));

    const search = container.querySelector<HTMLInputElement>('[aria-label="Search products for yield"]')!;
    await act(async () => search.focus());
    await fill(search, 'archived');

    const option = container.querySelector<HTMLButtonElement>('[role="option"]')!;
    expect(option.textContent).toContain('Old Archived Star');
    expect(option.textContent).toContain('Archived');

    await act(async () => option.click());
    expect(onSelect).toHaveBeenCalledWith('ART-099');
    expect(search.getAttribute('aria-expanded')).toBe('false');
  });

  it('supports keyboard navigation and Enter selection', async () => {
    const onSelect = vi.fn();
    await act(async () => root.render(
      <YieldProductSearchPicker products={products} selectedProductId="ART-001" onSelect={onSelect} />,
    ));

    const search = container.querySelector<HTMLInputElement>('[aria-label="Search products for yield"]')!;
    await act(async () => search.focus());
    await fill(search, 'event candle');
    await act(async () => search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    await act(async () => search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));

    expect(onSelect).toHaveBeenCalledWith('CND-002');
  });
});
