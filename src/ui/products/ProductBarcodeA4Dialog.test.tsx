// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../domain/products';
import type { ProductLabelPrintWindow } from './productLabelPrint';
import { ProductBarcodeA4Dialog } from './ProductBarcodeA4Dialog';

const product: Product = {
  id: 'PROD-0042', name: 'Lavender Candle',
  category: 'candle', safetyWasteRate: 0, isActive: true,
};
let root: Root;
let container: HTMLDivElement;

function printWindow(): ProductLabelPrintWindow {
  return {
    document: { open: vi.fn(), write: vi.fn(), close: vi.fn() },
    focus: vi.fn(), print: vi.fn(),
  };
}
function field(label: string): HTMLInputElement {
  const input = Array.from(container.querySelectorAll<HTMLInputElement>('input'))
    .find((node) => node.getAttribute('aria-label') === label);
  if (!input) throw new Error(`Missing field ${label}`);
  return input;
}
async function change(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  await act(async () => {
    setter!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function mount(openPrintWindow?: () => ProductLabelPrintWindow | null) {
  await act(async () => {
    root.render(<ProductBarcodeA4Dialog product={product} onClose={vi.fn()} openPrintWindow={openPrintWindow} />);
  });
}
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

describe('A4 barcode generator modal', () => {
  it('shows 4 × 2 cm and 50 labels as defaults, with a real preview and print action', async () => {
    const win = printWindow();
    await mount(() => win);
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(field('Barcode label width (cm)').value).toBe('4');
    expect(field('Barcode label height (cm)').value).toBe('2');
    expect(field('Number of barcodes').value).toBe('50');
    const summary = container.querySelector('[aria-label="A4 barcode layout summary"]')!.textContent!;
    expect(summary).toContain('5 columns × 14 rows');
    expect(summary).toContain('70 labels per full page');
    expect(summary).toContain('50 barcode copies · 1 A4 page');
    expect(container.querySelectorAll('.barcode-a4-preview-sticker')).toHaveLength(50);
    expect(container.querySelector('.barcode-a4-preview-bars svg')).not.toBeNull();
    expect(container.textContent).toContain('POS must look up the Product ID');

    const printButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('Print A4 barcodes'))!;
    await act(async () => printButton.click());
    expect(win.print).toHaveBeenCalledOnce();
    expect(win.document.write).toHaveBeenCalledWith(expect.stringContaining('PROD-0042'));
    expect(win.document.write).toHaveBeenCalledWith(expect.stringContaining('grid-template-columns: repeat(5, 40mm)'));
  });

  it('updates capacity and sheet count immediately when dimensions and copies change', async () => {
    await mount(() => printWindow());
    await change(field('Barcode label width (cm)'), '10');
    await change(field('Number of barcodes'), '40');
    const summary = container.querySelector('[aria-label="A4 barcode layout summary"]')!.textContent!;
    expect(summary).toContain('2 columns × 14 rows');
    expect(summary).toContain('28 labels per full page');
    expect(summary).toContain('40 barcode copies · 2 A4 pages');
    expect(container.querySelectorAll('.barcode-a4-preview-sticker')).toHaveLength(28);
  });

  it('blocks impossible label sizes and does not print an invalid sheet', async () => {
    const win = printWindow();
    await mount(() => win);
    await change(field('Barcode label width (cm)'), '20');
    await change(field('Paper margin (cm)'), '1');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('do not fit on A4 paper');
    const printButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('Print A4 barcodes'))!;
    expect(printButton.disabled).toBe(true);
    expect(win.print).not.toHaveBeenCalled();
  });

  it('shows blocked popup feedback instead of claiming a PDF was generated', async () => {
    await mount(() => null);
    const printButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('Print A4 barcodes'))!;
    await act(async () => printButton.click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('blocked');
  });
});
