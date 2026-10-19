// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../domain/products';
import {
  ProductBrochureDialog,
  type ProductBrochureDialogProps,
} from './ProductBrochureDialog';
import type { BrochurePriceOption } from './productBrochurePricing';

const photo = 'data:image/jpeg;base64,/9j/' + 'AAAA'.repeat(25);
const product: Product = {
  id: 'CLC-01', name: 'Blush Round Candle', category: 'candle',
  safetyWasteRate: .05, isActive: true, imageDataUrl: photo,
  notes: 'INTERNAL COSTS: Never show this to customers',
};
const prices: BrochurePriceOption[] = [
  { id: 'single', label: 'SINGLE', quantity: 1, unitPrice: 24, detail: 'Per piece' },
  { id: '30', label: '30+ PCS', quantity: 30, unitPrice: 22, detail: '30-pack' },
  { id: '50', label: '50+ PCS', quantity: 50, unitPrice: 19, detail: '50-pack' },
  { id: '100', label: '100+ PCS', quantity: 100, unitPrice: 16, detail: '100-pack' },
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function mount(overrides: Partial<ProductBrochureDialogProps> = {}) {
  const props: ProductBrochureDialogProps = {
    product,
    onClose: vi.fn(),
    onPrint: vi.fn(),
    loadPrices: vi.fn(async () => prices),
    ...overrides,
  };
  await act(async () => {
    root.render(<ProductBrochureDialog {...props} />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return props;
}
function findButton(text: string): HTMLButtonElement {
  const result = Array.from(container.querySelectorAll('button'))
    .find((button) => button.textContent?.trim() === text);
  if (!result) throw new Error('Button not found: ' + text);
  return result;
}

describe('Product brochure editor and preview', () => {
  it('uses saved product image, product ID, editable public description and up to three ready prices', async () => {
    const props = await mount();
    expect(container.querySelector('.product-brochure-preview')?.textContent).toContain('Blush Round Candle');
    expect(container.querySelector('.product-brochure-preview')?.textContent).toContain('CLC-01');
    expect(container.querySelector<HTMLImageElement>('.product-brochure-hero img')?.src).toBe(photo);
    expect(container.querySelector('.product-brochure-preview')?.textContent).toContain('₱24.00');
    expect(container.querySelector('.product-brochure-preview')?.textContent).toContain('₱22.00');
    expect(container.querySelector('.product-brochure-preview')?.textContent).toContain('₱19.00');
    expect(container.querySelector('.product-brochure-preview')?.textContent).not.toContain('₱16.00');
    expect(container.textContent).not.toContain('INTERNAL COSTS');

    const textarea = container.querySelector<HTMLTextAreaElement>('[aria-label="Brochure description"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Soft coral finish, perfect for weddings.');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.querySelector('.product-brochure-preview')?.textContent).toContain('Soft coral finish');
    await act(async () => findButton('Print / Save as PDF').click());
    expect(props.onPrint).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Blush Round Candle',
      description: 'Soft coral finish, perfect for weddings.',
      prices: prices.slice(0, 3),
    }));
    expect(props.loadPrices).toHaveBeenCalledWith('CLC-01');
  });

  it('lets the user choose three prices and gracefully displays not-ready pricing', async () => {
    await mount();
    const checkboxes = Array.from(container.querySelectorAll<HTMLInputElement>('.product-brochure-prices input[type="checkbox"]'));
    expect(checkboxes).toHaveLength(4);
    expect(checkboxes[3].disabled).toBe(true);
    await act(async () => checkboxes[1].click());
    expect(checkboxes[3].disabled).toBe(false);
    await act(async () => checkboxes[3].click());
    const preview = container.querySelector('.product-brochure-preview')?.textContent ?? '';
    expect(preview).toContain('₱16.00');
    expect(preview).not.toContain('₱22.00');
  });

  it('never invents selling prices and works when a product has no photo', async () => {
    const onPrint = vi.fn();
    await mount({
      product: { ...product, imageDataUrl: undefined },
      onPrint,
      loadPrices: async () => [],
    });
    expect(container.textContent).toContain('No Product photo is uploaded yet');
    expect(container.textContent).toContain('Contact us for pricing');
    await act(async () => findButton('Print / Save as PDF').click());
    expect(onPrint).toHaveBeenCalledWith(expect.objectContaining({
      imageDataUrl: null,
      prices: [],
    }));
  });

  it('closes with Escape without mutating product and restores document scroll', async () => {
    const onClose = vi.fn();
    await mount({ onClose });
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close product brochure');
    expect(document.body.style.overflow).toBe('hidden');
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(onClose).toHaveBeenCalledOnce();
    expect(product.notes).toContain('INTERNAL COSTS');
  });
});
