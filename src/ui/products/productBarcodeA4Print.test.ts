import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_BARCODE_SHEET_OPTIONS,
} from './barcodeSheetLayout';
import { printBarcodeA4Sheets, renderBarcodeA4PrintHtml } from './productBarcodeA4Print';
import type { ProductLabelPrintWindow } from './productLabelPrint';
import { ProductLabelPrintError } from './productLabelPrint';

const product = {
  id: 'PROD-0092',
  name: 'Daisy Candle',
};

function printWindow(): ProductLabelPrintWindow {
  return {
    document: { open: vi.fn(), write: vi.fn(), close: vi.fn() },
    focus: vi.fn(),
    print: vi.fn(),
  };
}

describe('printable A4 Code 128 barcode sheets', () => {
  it('prints 50 correctly sized barcodes on one page with exactly the same Product ID as thermal labels', () => {
    const html = renderBarcodeA4PrintHtml(product, DEFAULT_BARCODE_SHEET_OPTIONS);
    expect(html).toContain('@page { size: A4 portrait; margin: 0; }');
    expect(html).toContain('grid-template-columns: repeat(5, 40mm)');
    expect(html).toContain('grid-auto-rows: 20mm');
    expect(html).toContain('padding: 5mm');
    expect(html).toContain('width: 40mm');
    expect(html).toContain('height: 20mm');
    expect(html.split('class="barcode-sticker"').length - 1).toBe(50);
    expect(html.split('class="a4-sheet"').length - 1).toBe(1);
    expect(html.split('PROD-0092').length - 1).toBeGreaterThanOrEqual(50);
    expect(html).toContain('aria-label="Code 128 barcode"');
    expect(html).toContain('<svg');
    expect(html).toContain('Save as PDF');
    expect(html).toContain('100% / Actual Size');
  });

  it('creates exact-page-count sheets without blank printed pages, even for incomplete final sheet', () => {
    const html = renderBarcodeA4PrintHtml(product, {
      ...DEFAULT_BARCODE_SHEET_OPTIONS, copies: 141,
    });
    expect(html.split('class="barcode-sticker"').length - 1).toBe(141);
    expect(html.split('class="a4-sheet"').length - 1).toBe(3);
    expect(html).toContain('.a4-sheet:last-child { break-after: auto; page-break-after: auto; }');
  });

  it('allows name/caption guides to be switched off without changing barcode payload', () => {
    const html = renderBarcodeA4PrintHtml(product, {
      ...DEFAULT_BARCODE_SHEET_OPTIONS,
      copies: 1,
      showProductName: false,
      showProductId: false,
      showCutGuides: true,
      orientation: 'landscape',
    });
    expect(html).toContain('@page { size: A4 landscape; margin: 0; }');
    expect(html).toContain('class="barcode-sticker cut-guide"');
    expect(html).not.toContain('class="product-name"');
    expect(html).not.toContain('class="product-id"');
    expect(html).toContain('Code 128 barcode');
  });

  it('escapes unsafe product data in printed captions and document title', () => {
    const html = renderBarcodeA4PrintHtml({
      id: 'PROD-A',
      name: '<script>unsafe</script>&Candle',
    }, { ...DEFAULT_BARCODE_SHEET_OPTIONS, copies: 1 });
    expect(html).toContain('&lt;script&gt;unsafe&lt;/script&gt;&amp;Candle');
    expect(html).not.toContain('<script>unsafe</script>');
  });

  it('prints from direct user action and does not print if a popup is blocked', () => {
    const win = printWindow();
    const result = printBarcodeA4Sheets(product, DEFAULT_BARCODE_SHEET_OPTIONS, () => win);
    expect(result).toMatchObject({ copies: 50, labelsPerPage: 70, totalPages: 1 });
    expect(win.document.open).toHaveBeenCalledOnce();
    expect(win.document.write).toHaveBeenCalledWith(expect.stringContaining('Code 128 A4 Barcode Labels'));
    expect(win.document.close).toHaveBeenCalledOnce();
    expect(win.focus).toHaveBeenCalledOnce();
    expect(win.print).toHaveBeenCalledOnce();
    expect(() => printBarcodeA4Sheets(product, DEFAULT_BARCODE_SHEET_OPTIONS, () => null))
      .toThrow(ProductLabelPrintError);
  });

  it('rejects invalid dimensions before opening any print window', () => {
    const opener = vi.fn(() => printWindow());
    expect(() => printBarcodeA4Sheets(product, {
      ...DEFAULT_BARCODE_SHEET_OPTIONS, labelWidthCm: 20, marginCm: 1,
    }, opener)).toThrow('do not fit on A4 paper');
    expect(opener).not.toHaveBeenCalled();
  });
});
