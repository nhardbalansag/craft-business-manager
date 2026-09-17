// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../domain/products';
import { ProductCatalog } from './ProductCatalog';

let container: HTMLDivElement;
let root: Root;

const product: Product = {
  id: 'ART-STAR-01',
  name: 'Paintable Star',
  category: 'paintable-art',
  safetyWasteRate: 0.05,
  notes: 'Five-point mold',
  isActive: true,
};

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

function button(text: string) {
  const match = Array.from(container.querySelectorAll('button')).find((item) => item.textContent?.trim() === text);
  if (!match) throw new Error(`Missing button: ${text}`);
  return match as HTMLButtonElement;
}

async function renderCatalog(overrides: Partial<React.ComponentProps<typeof ProductCatalog>> = {}) {
  const props: React.ComponentProps<typeof ProductCatalog> = {
    products: [product],
    mixPresets: [],
    loading: false,
    loadFailed: false,
    disabled: false,
    editingId: null,
    onEdit: vi.fn(),
    onNew: vi.fn(),
    onComponents: vi.fn(),
    onToggleActive: vi.fn(),
    ...overrides,
  };

  await act(async () => root.render(<ProductCatalog {...props} />));
  return props;
}

describe('Product catalog / editor separation', () => {
  it('keeps the collection as a catalog-only view until Add product is requested', async () => {
    const props = await renderCatalog();

    expect(container.querySelector('[aria-label="Product catalog"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Product editor navigation"]')).toBeNull();
    expect(container.textContent).toContain('Browse, search, organize, and manage your collection');
    expect(container.textContent).not.toContain('Storage & molds');

    await act(async () => button('+ Add product').click());

    expect(props.onNew).toHaveBeenCalledTimes(1);
    const editorShell = container.querySelector('[aria-label="Product editor navigation"]');
    expect(editorShell).not.toBeNull();
    expect(editorShell?.classList.contains('is-editor-shell-open')).toBe(true);
    expect(editorShell?.textContent).toContain('Add a new product');
    expect(editorShell?.textContent).toContain('Products/Product catalog/Add product');
    expect(container.querySelector('[aria-label="Product catalog"]')).toBeNull();
    expect(container.querySelector('input[type="search"]')).toBeNull();
  });

  it('opens Edit product as a focused editor context instead of leaving the collection beside it', async () => {
    const onEdit = vi.fn();
    await renderCatalog({ onEdit });

    const edit = container.querySelector<HTMLButtonElement>('button[aria-label="Edit Paintable Star"]');
    expect(edit).not.toBeNull();
    await act(async () => edit!.click());

    expect(onEdit).toHaveBeenCalledWith(product);
    const editorShell = container.querySelector('[aria-label="Product editor navigation"]');
    expect(editorShell?.textContent).toContain('Edit Paintable Star');
    expect(editorShell?.textContent).toContain('ART-STAR-01');
    expect(container.querySelector('[aria-label="Paintable Star"]')).toBeNull();
  });

  it('returns to the product catalog without discarding the parent-owned draft', async () => {
    const props = await renderCatalog();

    await act(async () => button('+ Add product').click());
    expect(container.querySelector('[aria-label="Product editor navigation"]')).not.toBeNull();

    await act(async () => button('←Back to product catalog').click());

    expect(container.querySelector('[aria-label="Product catalog"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Product editor navigation"]')).toBeNull();
    expect(props.onNew).toHaveBeenCalledTimes(1);
    expect(props.onEdit).not.toHaveBeenCalled();
  });
});
