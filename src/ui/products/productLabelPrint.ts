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

  return `<section class="label" aria-label="Product label copy ${copyIndex + 1}">
    <div class="brand">Craft Business Manager</div>
    <div class="product-name">${escapeHtml(view.product.name)}</div>
    <div class="product-id">${escapeHtml(view.product.id)}</div>
    ${details ? `<div class="details">${details}</div>` : ''}
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
      padding: 2.4mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
      overflow: hidden;
      break-after: page;
      page-break-after: always;
    }
    .label:last-child { break-after: auto; page-break-after: auto; }
    .brand {
      margin-bottom: 1.2mm;
      font-size: 5.5pt;
      font-weight: 700;
      letter-spacing: .09em;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .product-name {
      font-size: ${view.size.widthMm <= 40 ? '11pt' : '13pt'};
      line-height: 1.05;
      font-weight: 800;
      overflow-wrap: anywhere;
      max-height: 2.2em;
      overflow: hidden;
    }
    .product-id {
      margin-top: 1.6mm;
      padding: .8mm 1mm;
      border: 1.5px solid #000;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: ${view.size.widthMm <= 40 ? '9pt' : '10.5pt'};
      font-weight: 800;
      letter-spacing: .04em;
      text-align: center;
      overflow-wrap: anywhere;
    }
    .details {
      margin-top: 1.3mm;
      display: flex;
      gap: 1mm;
      align-items: center;
      flex-wrap: wrap;
      font-size: 6.2pt;
      font-weight: 700;
      text-transform: uppercase;
    }
    .dot { font-size: 5pt; }
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
