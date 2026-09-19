// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../domain/products';
import type { ProductLabelPrintWindow } from './productLabelPrint';
import { ProductLabelPrintDialog } from './ProductLabelPrintDialog';

let container: HTMLDivElement;
let root: Root;

const product: Product = {
  id: 'CANDLE-001',
  name: 'Storage Candle',
  category: 'candle',
  safetyWasteRate: 0.05,
  isActive: true,
};

function printWindow(): ProductLabelPrintWindow {
  return {
    document: {
      open: vi.fn(),
      write: vi.fn(),
      close: vi.fn(),
    },
    focus: vi.fn(),
    print: vi.fn(),
  };
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function checkbox(labelText: string): HTMLInputElement {
  const label = Array.from(container.querySelectorAll('label')).find((candidate) =>
    candidate.textContent?.includes(labelText),
  );
  const input = label?.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (!input) throw new Error(`Missing checkbox: ${labelText}`);
  return input;
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

describe('ProductLabelPrintDialog', () => {
  it('previews product QR/barcode identity and prints selected size, copies, and optional details', async () => {
    const target = printWindow();

    await act(async () => {
      root.render(<ProductLabelPrintDialog product={product} onClose={vi.fn()} openPrintWindow={() => target} />);
    });

    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Product label preview"]')?.textContent).toContain('Storage Candle');
    expect(container.querySelector('[aria-label="Product label preview"]')?.textContent).toContain('CANDLE-001');
    expect(container.querySelector('[aria-label="Product QR code preview"] svg')).toBeTruthy();
    expect(container.querySelector('[aria-label="Product barcode preview"] svg')).toBeTruthy();
    expect(container.textContent).toContain('CBM:PRODUCT:CANDLE-001');
    expect(container.textContent).toContain('Printer selection happens in your browser / operating system.');

    const sizeSelect = container.querySelector('select')!;
    const copiesInput = container.querySelector('input[type="number"]') as HTMLInputElement;

    await act(async () => {
      sizeSelect.value = '60x40';
      sizeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {
      setNativeInputValue(copiesInput, '3');
    });
    await act(async () => {
      checkbox('Category').click();
    });

    const printButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Print 3 labels'),
    )!;
    expect(printButton).toBeTruthy();

    await act(async () => printButton.click());

    const written = vi.mocked(target.document.write).mock.calls[0]![0];
    expect(written).toContain('@page { size: 60mm 40mm; margin: 0; }');
    expect(written.match(/class="label has-codes"/g)).toHaveLength(3);
    expect(written).not.toContain('>Candle<');
    expect(written).toContain('ACTIVE');
    expect(written).toContain('class="qr"');
    expect(written).toContain('class="barcode"');
    expect(target.print).toHaveBeenCalledOnce();
  });

  it('can disable QR and barcode independently', async () => {
    const target = printWindow();
    await act(async () => {
      root.render(<ProductLabelPrintDialog product={product} onClose={vi.fn()} openPrintWindow={() => target} />);
    });

    await act(async () => checkbox('QR code').click());
    expect(container.querySelector('[aria-label="Product QR code preview"]')).toBeNull();
    expect(container.querySelector('[aria-label="Product barcode preview"] svg')).toBeTruthy();
  });

  it('closes without printing when the user cancels', async () => {
    const onClose = vi.fn();
    const target = printWindow();

    await act(async () => {
      root.render(<ProductLabelPrintDialog product={product} onClose={onClose} openPrintWindow={() => target} />);
    });

    const cancel = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Cancel')!;
    await act(async () => cancel.click());

    expect(onClose).toHaveBeenCalledOnce();
    expect(target.print).not.toHaveBeenCalled();
  });
});
