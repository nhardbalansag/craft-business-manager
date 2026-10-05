import type { CustomerQuotationView } from './customerQuotation';

export type CustomerQuotationPrintWindow = Pick<
  Window,
  'document' | 'focus' | 'print'
>;

export type CustomerQuotationPrintWindowOpener = () =>
  | CustomerQuotationPrintWindow
  | null;

export class CustomerQuotationPrintError extends Error {
  readonly code = 'POPUP_BLOCKED';

  constructor(message: string) {
    super(message);
    this.name = 'CustomerQuotationPrintError';
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function renderCustomerQuotationHtml(view: CustomerQuotationView): string {
  const contact = view.customer.contact
    ? `<div><span>Contact</span><strong>${escapeHtml(view.customer.contact)}</strong></div>`
    : '';
  const address = view.customer.address
    ? `<div class="wide"><span>Address</span><strong>${escapeHtml(view.customer.address)}</strong></div>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Quotation ${escapeHtml(view.quotationReference)}</title>
  <style>
    @page { size: A4 portrait; margin: 14mm; }
    * { box-sizing: border-box; }
    html { background: #ececec; }
    body {
      width: 182mm;
      min-height: 269mm;
      margin: 10mm auto;
      padding: 12mm;
      background: #fff;
      color: #292622;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10pt;
      line-height: 1.45;
      box-shadow: 0 2mm 8mm rgba(0,0,0,.08);
    }
    header { display: flex; justify-content: space-between; gap: 12mm; padding-bottom: 7mm; border-bottom: 2px solid #292622; }
    .brand { font-size: 19pt; font-weight: 800; letter-spacing: -.02em; }
    .brand small { display: block; margin-top: 1.5mm; color: #716a61; font-size: 8pt; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }
    .quote-meta { text-align: right; }
    .quote-meta h1 { margin: 0 0 2mm; font-size: 18pt; letter-spacing: .08em; }
    .quote-meta div { color: #5e5850; font-size: 8.5pt; }
    section { margin-top: 8mm; }
    h2 { margin: 0 0 3mm; font-size: 9pt; letter-spacing: .08em; text-transform: uppercase; }
    .customer-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 3mm 8mm; padding: 5mm; background: #f7f5f1; border: 1px solid #ddd7ce; }
    .customer-grid div { display: grid; gap: .8mm; }
    .customer-grid .wide { grid-column: 1 / -1; }
    .customer-grid span { color: #777067; font-size: 7.5pt; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
    .customer-grid strong { overflow-wrap: anywhere; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { padding: 3mm; border-bottom: 1px solid #d8d3cc; vertical-align: top; }
    th { background: #f2efe9; color: #625c54; font-size: 7.5pt; letter-spacing: .05em; text-align: left; text-transform: uppercase; }
    th:nth-child(2), th:nth-child(3), th:nth-child(4),
    td:nth-child(2), td:nth-child(3), td:nth-child(4) { text-align: right; }
    td strong { display: block; }
    td small { color: #777067; }
    .totals { width: 72mm; margin: 7mm 0 0 auto; }
    .total-row { display: flex; justify-content: space-between; gap: 8mm; padding: 2.5mm 0; border-bottom: 1px solid #ddd7ce; }
    .total-row.grand { padding-top: 4mm; border-bottom: 0; font-size: 13pt; font-weight: 800; }
    .text-box { min-height: 14mm; padding: 4mm; border: 1px solid #ddd7ce; white-space: pre-wrap; overflow-wrap: anywhere; }
    .footer-note { margin-top: 10mm; padding-top: 4mm; border-top: 1px solid #ddd7ce; color: #777067; font-size: 8pt; }
    .screen-note { margin-bottom: 6mm; padding: 3mm; background: #fff6df; border: 1px solid #ead7a5; color: #6e5b31; font-size: 8.5pt; }
    @media print {
      html { background: #fff; }
      body { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
      .screen-note { display: none; }
      * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <aside class="screen-note">Use the browser print dialog to print this quotation or choose Save as PDF. Turn off browser headers and footers for a clean copy.</aside>
  <header>
    <div class="brand">
      ${escapeHtml(view.businessName)}
      <small>Customer Quotation</small>
    </div>
    <div class="quote-meta">
      <h1>QUOTATION</h1>
      <div><strong>${escapeHtml(view.quotationReference)}</strong></div>
      <div>Quotation date: ${escapeHtml(formatDate(view.generatedAtIso))}</div>
      ${view.validUntil ? `<div>Valid until: ${escapeHtml(formatDate(view.validUntil))}</div>` : ''}
    </div>
  </header>

  <section>
    <h2>Prepared for</h2>
    <div class="customer-grid">
      <div><span>Customer</span><strong>${escapeHtml(view.customer.name)}</strong></div>
      ${contact}
      ${address}
    </div>
  </section>

  <section>
    <h2>Quotation details</h2>
    <table>
      <thead>
        <tr>
          <th>Product</th>
          <th>Quantity</th>
          <th>Unit price</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>${escapeHtml(view.product.name)}</strong>
            <small>${escapeHtml(view.product.id)} · ${escapeHtml(view.pricing.sourceLabel)}</small>
          </td>
          <td>${escapeHtml(view.product.quantity.toLocaleString('en-PH'))}</td>
          <td>${escapeHtml(formatMoney(view.pricing.unitSellingPrice))}</td>
          <td><strong>${escapeHtml(formatMoney(view.pricing.totalSellingPrice))}</strong></td>
        </tr>
      </tbody>
    </table>

    <div class="totals">
      <div class="total-row"><span>Subtotal</span><strong>${escapeHtml(formatMoney(view.pricing.totalSellingPrice))}</strong></div>
      <div class="total-row grand"><span>Total</span><strong>${escapeHtml(formatMoney(view.pricing.totalSellingPrice))}</strong></div>
    </div>
  </section>

  ${view.notes ? `<section><h2>Notes</h2><div class="text-box">${escapeHtml(view.notes)}</div></section>` : ''}
  ${view.terms ? `<section><h2>Terms & conditions</h2><div class="text-box">${escapeHtml(view.terms)}</div></section>` : ''}

  <footer class="footer-note">
    This quotation is based on the selected saved selling price for the stated quantity. Internal cost, profit, margin, and production data are intentionally excluded.
  </footer>
</body>
</html>`;
}

export function printCustomerQuotation(
  view: CustomerQuotationView,
  openWindow: CustomerQuotationPrintWindowOpener = () =>
    window.open('', '_blank') as unknown as CustomerQuotationPrintWindow | null,
): void {
  const printWindow = openWindow();
  if (!printWindow) {
    throw new CustomerQuotationPrintError(
      'The quotation could not be opened. Allow pop-ups for this app, then try again.',
    );
  }

  printWindow.document.open();
  printWindow.document.write(renderCustomerQuotationHtml(view));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}
