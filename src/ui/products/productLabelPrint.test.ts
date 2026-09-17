import { describe, expect, it, vi } from 'vitest';
import type { Product } from '../../domain/products';
import { buildProductLabelView } from './productLabelView';
import {
  ProductLabelPrintError,
  printProductLabels,
  renderProductLabelPrintHtml,
  type ProductLabelPrintWindow,
} from './productLabelPrint';

const product: Product = {
  id: 'POT-<01>',
  name: 'Mini & Pot <Test>',
  category: 'candle-pot',
  safetyWasteRate: 0,
  isActive: false,
};

function view() {
  return buildProductLabelView(product, {
    sizeId: '40x30',
    copies: 3,
    showCategory: true,
    showStatus: true,
  });
}

function targetWindow(): ProductLabelPrintWindow {
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

describe('productLabelPrint', () => {
  it('renders selected millimeter dimensions, one page per copy, and escaped product identity', () => {
    const html = renderProductLabelPrintHtml(view());

    expect(html).toContain('@page { size: 40mm 30mm; margin: 0; }');
    expect(html.match(/class="label"/g)).toHaveLength(3);
    expect(html).toContain('Mini &amp; Pot &lt;Test&gt;');
    expect(html).toContain('POT-&lt;01&gt;');
    expect(html).toContain('Candle pot');
    expect(html).toContain('ARCHIVED');
    expect(html).toContain('page-break-after: always');
  });

  it('writes, focuses, and prints the dedicated label document', () => {
    const target = targetWindow();
    printProductLabels(view(), () => target);

    expect(target.document.open).toHaveBeenCalledOnce();
    expect(target.document.write).toHaveBeenCalledOnce();
    expect(target.document.close).toHaveBeenCalledOnce();
    expect(target.focus).toHaveBeenCalledOnce();
    expect(target.print).toHaveBeenCalledOnce();
  });

  it('fails explicitly when the browser blocks the label print window', () => {
    expect(() => printProductLabels(view(), () => null)).toThrow(ProductLabelPrintError);
    expect(() => printProductLabels(view(), () => null)).toThrow('Allow pop-ups');
  });
});
