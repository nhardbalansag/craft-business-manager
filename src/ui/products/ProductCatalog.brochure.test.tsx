// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../domain/products';
import { ProductCatalog } from './ProductCatalog';

const product: Product = {
  id: 'BRO-01', name: 'Pink Wedding Candle', category: 'candle',
  safetyWasteRate: .05, notes: 'PRIVATE PRODUCTION INSTRUCTIONS',
  isActive: true,
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

async function mount(onEdit = vi.fn()) {
  await act(async () => root.render(
    <ProductCatalog
      products={[product]} loading={false} loadFailed={false}
      disabled={false} editingId={null}
      onEdit={onEdit} onNew={vi.fn()}
      onComponents={vi.fn()} onToggleActive={vi.fn()}
    />,
  ));
  return onEdit;
}
function queryButton(label: string): HTMLButtonElement {
  const btn = container.querySelector<HTMLButtonElement>('button[aria-label="' + label + '"]');
  if (!btn) throw Error('Missing button: ' + label);
  return btn;
}
function brochureDialog() {
  return container.querySelector<HTMLElement>('[role="dialog"][aria-labelledby="product-brochure-title"]');
}
async function click(button: HTMLElement) {
  await act(async () => {
    button.click();
    await Promise.resolve();
  });
}

describe('Product Catalog brochure entry points', () => {
  it('opens A4 brochure builder from the product card, without opening Edit or exposing notes', async () => {
    const onEdit = await mount();
    const trigger = queryButton('Print brochure for Pink Wedding Candle');
    expect(trigger.textContent).toContain('Brochure / PDF');
    await click(trigger);
    expect(brochureDialog()).not.toBeNull();
    expect(brochureDialog()?.textContent).toContain('Pink Wedding Candle');
    expect(brochureDialog()?.textContent).toContain('Brochure preview');
    expect(brochureDialog()?.textContent).not.toContain('PRIVATE PRODUCTION INSTRUCTIONS');
    expect(onEdit).not.toHaveBeenCalled();
    expect(container.querySelector('[aria-label="Product editor navigation"]')).toBeNull();
    await click(queryButton('Close product brochure'));
    expect(brochureDialog()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('offers brochure generation in Compact and Table layouts', async () => {
    const onEdit = await mount();
    const layouts = Array.from(container.querySelectorAll<HTMLButtonElement>('[aria-label="Catalog layout"] button'));
    const compact = layouts.find((button) => button.textContent === 'Compact')!;
    const table = layouts.find((button) => button.textContent === 'Table')!;
    await click(compact);
    expect(queryButton('Print brochure for Pink Wedding Candle')).toBeTruthy();
    await click(table);
    await click(queryButton('Print brochure for Pink Wedding Candle'));
    expect(brochureDialog()).not.toBeNull();
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('opens brochure from read-only Product view and returns focus to View when closed', async () => {
    await mount();
    const viewTrigger = queryButton('View Pink Wedding Candle');
    await click(viewTrigger);
    expect(container.querySelector('[aria-labelledby="product-view-title"]')).not.toBeNull();
    const brochure = Array.from(container.querySelectorAll<HTMLButtonElement>('.product-view-actions button')).find(
      (button) => button.textContent === 'Print brochure / PDF',
    )!;
    await click(brochure);
    expect(container.querySelector('[aria-labelledby="product-view-title"]')).toBeNull();
    expect(brochureDialog()).not.toBeNull();
    await click(queryButton('Close product brochure'));
    expect(document.activeElement).toBe(viewTrigger);
  });
});
