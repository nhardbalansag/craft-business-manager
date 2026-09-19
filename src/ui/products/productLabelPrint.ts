import { renderIdentityCode128Svg, renderIdentityQrSvg } from '../labels/machineReadable';
import type { ProductLabelView } from './productLabelView';

export type ProductLabelPrintErrorCode = 'POPUP_BLOCKED';

export class ProductLabelPrintError extends Error {
  readonly code: ProductLabelPrintErrorCode;

  constructor(code: ProductLabelPrintErrorCode, message: string) {
    super(message);
    this.name = 'ProductLabelPrintError';
    this.code = code;
  }
}

export interface ProductLabelPrintDocument {
  open(): void;
  write(content: string): void;
  close(): void;
}

export interface ProductLabelPrintWindow {
  document: ProductLabelPrintDocument;
  focus(): void;
  print(): void;
}

export type ProductLabelPrintWindowOpener = () => ProductLabelPrintWindow | null;

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderLabel(view: ProductLabelView, copyIndex: number): string {
  const details = [
    view.showCategory ? `<span>${escapeHtml(view.product.categoryLabel)}</span>` : '',
    view.showStatus ? `<span>${view.product.isActive ? 'ACTIVE' : 'ARCHIVED'}</span>` : '',
  ]
    .filter(Boolean)
    .join('<span class="dot">•</span>');
  const qr = view.showQr ? renderIdentityQrSvg('PRODUCT', view.product.id) : '';
  const barcode = view.showBarcode ? renderIdentityCode128Svg(view.product.id) : '';
  const machineReadable = view.showQr || view.showBarcode;

  return `<section class="label${machineReadable ? ' has-codes' : ''}" aria-label="Product label copy ${copyIndex + 1}">
    <div class="brand">Craft Business Manager</div>
    <div class="main-row">
      <div class="identity-copy">
        <div class="product-name">${escapeHtml(view.product.name)}</div>
        <div class="product-id">${escapeHtml(view.product.id)}</div>
        ${details ? `<div class="details">${details}</div>` : ''}
      </div>
      ${view.showQr ? `<div class="qr" aria-label="Product QR code">${qr}</div>` : ''}
    </div>
    ${view.showBarcode ? `<div class="barcode" aria-label="Product Code 128 barcode">${barcode}</div>` : ''}
  </section>`;
}

/** Render a complete browser-print document with one thermal label per printed page. */
export function renderProductLabelPrintHtml(view: ProductLabelView): string {
  const labels = Array.from({ length: view.copies }, (_, index) => renderLabel(view, index)).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(view.product.name)} — Product Labels</title>
  <style>
    @page { size: ${view.size.widthMm}mm ${view.size.heightMm}mm; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; }
    body { font-family: Arial, Helvetica, sans-serif; }
    .label {
      width: ${view.size.widthMm}mm;
      height: ${view.size.heightMm}mm;
      padding: 2.2mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
      overflow: hidden;
      break-after: page;
      page-break-after: always;
    }
    .label:last-child { break-after: auto; page-break-after: auto; }
    .brand {
      margin-bottom: 1mm;
      font-size: 5pt;
      font-weight: 700;
      letter-spacing: .08em;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .main-row { display: flex; gap: 1.5mm; align-items: center; min-height: 0; }
    .identity-copy { flex: 1; min-width: 0; }
    .product-name {
      font-size: ${view.size.widthMm <= 40 ? '9pt' : '11pt'};
      line-height: 1.05;
      font-weight: 800;
      overflow-wrap: anywhere;
      max-height: 2.2em;
      overflow: hidden;
    }
    .product-id {
      margin-top: 1mm;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: ${view.size.widthMm <= 40 ? '7pt' : '8.5pt'};
      font-weight: 800;
      letter-spacing: .03em;
      overflow-wrap: anywhere;
    }
    .details {
      margin-top: .8mm;
      display: flex;
      gap: .8mm;
      align-items: center;
      flex-wrap: wrap;
      font-size: 5.3pt;
      font-weight: 700;
      text-transform: uppercase;
    }
    .dot { font-size: 4.5pt; }
    .qr { flex: 0 0 auto; width: ${view.size.widthMm <= 40 ? '11mm' : '13mm'}; height: ${view.size.widthMm <= 40 ? '11mm' : '13mm'}; }
    .qr svg { width: 100%; height: 100%; display: block; }
    .barcode { margin-top: .8mm; width: 100%; height: ${view.size.heightMm <= 25 ? '5mm' : '6mm'}; overflow: hidden; }
    .barcode svg { width: 100%; height: 100%; display: block; }
    .label:not(.has-codes) .product-id {
      padding: .8mm 1mm;
      border: 1.5px solid #000;
      text-align: center;
    }
    @media print {
      html, body { width: ${view.size.widthMm}mm; }
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>${labels}</body>
</html>`;
}

export function printProductLabels(
  view: ProductLabelView,
  openWindow: ProductLabelPrintWindowOpener = () => window.open('', '_blank', 'noopener,noreferrer'),
): void {
  const printWindow = openWindow();
  if (!printWindow) {
    throw new ProductLabelPrintError(
      'POPUP_BLOCKED',
      'The label print window was blocked. Allow pop-ups for this app and try printing again.',
    );
  }

  printWindow.document.open();
  printWindow.document.write(renderProductLabelPrintHtml(view));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}
