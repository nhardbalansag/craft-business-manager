// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../domain/products';
import { ProductCatalog } from './ProductCatalog';

let container: HTMLDivElement;
let root: Root;

const product: Product = {
  id: 'ART-BEAR-01',
  name: 'Paintable Bear',
  category: 'paintable-art',
  safetyWasteRate: 0.05,
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

describe('ProductCatalog label printing', () => {
  it('opens the label workflow for the selected product and closes it without mutating catalog actions', async () => {
    const onEdit = vi.fn();
    const onNew = vi.fn();
    const onComponents = vi.fn();
    const onToggleActive = vi.fn();

    await act(async () => {
      root.render(
        <ProductCatalog
          products={[product]}
          mixPresets={[]}
          loading={false}
          loadFailed={false}
          disabled={false}
          editingId={null}
          onEdit={onEdit}
          onNew={onNew}
          onComponents={onComponents}
          onToggleActive={onToggleActive}
        />,
      );
    });

    const printButton = container.querySelector('button[aria-label="Print label for Paintable Bear"]') as HTMLButtonElement;
    expect(printButton).toBeTruthy();

    await act(async () => printButton.click());

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.textContent).toContain('Paintable Bear');
    expect(dialog?.textContent).toContain('ART-BEAR-01');
    expect(onEdit).not.toHaveBeenCalled();
    expect(onComponents).not.toHaveBeenCalled();
    expect(onToggleActive).not.toHaveBeenCalled();

    const close = container.querySelector('button[aria-label="Close product label dialog"]') as HTMLButtonElement;
    await act(async () => close.click());

    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
