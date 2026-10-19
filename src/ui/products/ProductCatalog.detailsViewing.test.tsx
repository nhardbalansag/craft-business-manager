// @vitest-environment jsdom
import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../domain/products';
import { ProductCatalog } from './ProductCatalog';

const photo = 'data:image/jpeg;base64,/9j/' + 'AAAA'.repeat(25);
const candle: Product = {
  id: 'CND-LAVENDER-01',
  name: 'Custom Lavender Event Candle',
  category: 'candle',
  safetyWasteRate: 0.075,
  candleWaxMaterialId: 'SOY-WAX',
  candleEssentialOilMaterialId: 'LAVENDER-OIL',
  imageDataUrl: photo,
  notes: 'Keep wick centered.\nWrap for weddings.',
  isActive: true,
};
const archived: Product = {
  id: 'ART-ARCHIVE-01',
  name: 'Archived Turtle',
  category: 'paintable-art',
  safetyWasteRate: 0,
  isActive: false,
};

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

async function mount(overrides: Partial<ComponentProps<typeof ProductCatalog>> = {}) {
  const props: ComponentProps<typeof ProductCatalog> = {
    products: [candle, archived],
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
function button(label: string) {
  const found = container.querySelector<HTMLButtonElement>('button[aria-label="' + label + '"]');
  if (!found) throw Error('Button not found: ' + label);
  return found;
}
function dialog() {
  return container.querySelector<HTMLElement>('[role="dialog"][aria-labelledby="product-view-title"]');
}
async function click(el: HTMLElement) {
  await act(async () => el.click());
}

describe('Product catalog read-only View action', () => {
  it('shows saved image, ID, category, reserve, candle references and notes without opening the editor or mutating data', async () => {
    const props = await mount();
    await click(button('View Custom Lavender Event Candle'));
    const view = dialog()!;
    expect(view).not.toBeNull();
    expect(view.getAttribute('aria-modal')).toBe('true');
    expect(view.textContent).toContain('Custom Lavender Event Candle');
    expect(view.textContent).toContain('CND-LAVENDER-01');
    expect(view.textContent).toContain('Candle');
    expect(view.textContent).toContain('Poured');
    expect(view.textContent).toContain('7.5%');
    expect(view.textContent).toContain('SOY-WAX');
    expect(view.textContent).toContain('LAVENDER-OIL');
    expect(view.textContent).toContain('Keep wick centered.');
    expect(view.textContent).toContain('Wrap for weddings.');
    expect(view.querySelector<HTMLImageElement>('.product-view-photo img')?.src).toBe(photo);
    expect(view.querySelectorAll('input, textarea, select')).toHaveLength(0);
    expect(props.onEdit).not.toHaveBeenCalled();
    expect(props.onNew).not.toHaveBeenCalled();
    expect(props.onComponents).not.toHaveBeenCalled();
    expect(props.onToggleActive).not.toHaveBeenCalled();
    expect(container.querySelector('[aria-label="Product editor navigation"]')).toBeNull();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close product view');
  });

  it('closes with Escape and backdrop click and returns focus to the original View button', async () => {
    await mount();
    const trigger = button('View Custom Lavender Event Candle');
    await click(trigger);
    expect(document.body.style.overflow).toBe('hidden');
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe('');
    await click(trigger);
    const backdrop = container.querySelector<HTMLElement>('.product-view-backdrop')!;
    await act(async () => backdrop.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('allows editing from View only on an explicit Edit product action', async () => {
    const props = await mount();
    await click(button('View Custom Lavender Event Candle'));
    expect(props.onEdit).not.toHaveBeenCalled();
    await click(container.querySelector<HTMLElement>('.product-view-actions .button-primary')!);
    expect(props.onEdit).toHaveBeenCalledExactlyOnceWith(candle);
    expect(dialog()).toBeNull();
    expect(container.querySelector('[aria-label="Product editor navigation"]')?.textContent).toContain('Edit Custom Lavender Event Candle');
  });

  it('lets users open Components from the read-only view without entering edit mode', async () => {
    const props = await mount();
    await click(button('View Custom Lavender Event Candle'));
    await click(container.querySelector<HTMLButtonElement>('.product-view-actions .button-quiet')!);
    expect(props.onComponents).toHaveBeenCalledExactlyOnceWith(candle);
    expect(props.onEdit).not.toHaveBeenCalled();
    expect(dialog()).toBeNull();
  });

  it('offers View in cards, compact and table layouts including archived products', async () => {
    await mount();
    expect(button('View Custom Lavender Event Candle').textContent).toContain('View');
    const cardsButton = Array.from(container.querySelectorAll<HTMLButtonElement>('[aria-label="Catalog layout"] button')).find(
      (el) => el.textContent === 'Cards',
    )!;
    await click(cardsButton);
    expect(button('View Custom Lavender Event Candle').textContent).toContain('View product');
    const compactButton = Array.from(container.querySelectorAll<HTMLButtonElement>('[aria-label="Catalog layout"] button')).find(
      (el) => el.textContent === 'Compact',
    )!;
    await click(compactButton);
    expect(button('View Custom Lavender Event Candle')).not.toBeNull();
    const tableButton = Array.from(container.querySelectorAll<HTMLButtonElement>('[aria-label="Catalog layout"] button')).find(
      (el) => el.textContent === 'Table',
    )!;
    await click(tableButton);
    expect(button('View Custom Lavender Event Candle').textContent).toContain('View');
    await click(button('View Custom Lavender Event Candle'));
    expect(dialog()?.textContent).toContain('CND-LAVENDER-01');
    await click(button('Close product view'));

    const status = container.querySelector<HTMLSelectElement>('[aria-label="Product status filter"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(status, 'all');
      status.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await click(button('View Archived Turtle'));
    expect(dialog()?.textContent).toContain('Archived');
    expect(dialog()?.textContent).toContain('No product photo uploaded');
    expect(dialog()?.textContent).toContain('No workshop notes saved');
  });

  it('disables View alongside other catalog actions during loading or mutation', async () => {
    await mount({ disabled: true });
    expect(button('View Custom Lavender Event Candle').disabled).toBe(true);
    await click(button('View Custom Lavender Event Candle'));
    expect(dialog()).toBeNull();
  });
});
