import type { Product } from '../../domain/products';
import { renderIdentityCode128Svg } from '../labels/machineReadable';
import {
  calculateBarcodeSheetLayout,
  type BarcodeSheetOptions,
  type BarcodeSheetLayout,
} from './barcodeSheetLayout';
import {
  ProductLabelPrintError,
  type ProductLabelPrintWindowOpener,
} from './productLabelPrint';

function escapeHtml(input: string): string {
  return input.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

export function renderBarcodeA4PrintHtml(
  product: Pick<Product, 'id' | 'name'>,
  options: BarcodeSheetOptions,
): string {
  const layout = calculateBarcodeSheetLayout(options);
  // Use the SAME scan payload as existing thermal labels: the raw stable
  // Product ID. Do not embed the current sale price into the barcode.
  const barcode = renderIdentityCode128Svg(product.id);
  const label = `<div class="barcode-sticker${options.showCutGuides ? ' cut-guide' : ''}">
      ${options.showProductName ? `<div class="product-name">${escapeHtml(product.name)}</div>` : ''}
      <div class="bars" aria-label="Code 128 barcode">${barcode}</div>
      ${options.showProductId ? `<div class="product-id">${escapeHtml(product.id)}</div>` : ''}
    </div>`;
  const pageHtml: string[] = [];
  for (let page = 0; page < layout.totalPages; page += 1) {
    const copiesOnPage = Math.min(layout.labelsPerPage, options.copies - page * layout.labelsPerPage);
    pageHtml.push(`<section class="a4-sheet" aria-label="Barcode sheet page ${page + 1}">
      ${label.repeat(copiesOnPage)}
    </section>`);
  }
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(product.name)} — Code 128 A4 Barcode Labels</title>
<style>
  @page { size: A4 ${options.orientation}; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: white; color: black; }
  body { font-family: Arial, Helvetica, sans-serif; }
  .a4-sheet {
    width: ${layout.paperWidthMm}mm;
    height: ${layout.paperHeightMm}mm;
    padding: ${layout.marginMm}mm;
    display: grid;
    grid-template-columns: repeat(${layout.columns}, ${layout.labelWidthMm}mm);
    grid-auto-rows: ${layout.labelHeightMm}mm;
    gap: ${layout.gapYmm}mm ${layout.gapXmm}mm;
    align-content: start;
    justify-content: start;
    overflow: hidden;
    break-after: page;
    page-break-after: always;
  }
  .a4-sheet:last-child { break-after: auto; page-break-after: auto; }
  .barcode-sticker {
    width: ${layout.labelWidthMm}mm;
    height: ${layout.labelHeightMm}mm;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: center;
    padding: .65mm 1mm;
    overflow: hidden;
    background: white;
    color: black;
    break-inside: avoid;
  }
  .barcode-sticker.cut-guide { outline: .2mm dashed #a3a3a3; outline-offset: -.2mm; }
  .product-name {
    min-height: 0;
    text-align: center;
    font-size: 6.5pt;
    line-height: 1.1;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .bars {
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .bars svg { display: block; width: 100%; height: 100%; }
  .product-id {
    text-align: center;
    font: 700 6.5pt/1.1 ui-monospace, Consolas, monospace;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .browser-note { padding: 12px; font: 13px Arial, sans-serif; background: #fff5d8; }
  @media screen { html { background: #ececec; } .a4-sheet { margin: 12px auto; box-shadow: 0 4px 20px #bbb; } }
  @media print {
    .browser-note { display: none; }
    html, body { background: white; }
    .a4-sheet { margin: 0; box-shadow: none; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style></head>
<body>
<p class="browser-note">Print at 100% / Actual Size on A4 ${options.orientation}; disable browser headers and footers. For PDF, choose Save as PDF in the browser print dialog. Verify a sample barcode with your scanner first.</p>
${pageHtml.join('')}
</body></html>`;
}

export function printBarcodeA4Sheets(
  product: Pick<Product, 'id' | 'name'>,
  options: BarcodeSheetOptions,
  opener: ProductLabelPrintWindowOpener = () => window.open('', '_blank'),
): BarcodeSheetLayout {
  // Complete validation + barcode generation before opening the print popup.
  const layout = calculateBarcodeSheetLayout(options);
  const html = renderBarcodeA4PrintHtml(product, options);
  const popup = opener();
  if (!popup) throw new ProductLabelPrintError(
    'POPUP_BLOCKED',
    'The A4 barcode print window was blocked. Allow pop-ups and try again.',
  );
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  popup.print();
  return layout;
}
