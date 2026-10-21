import type { OwnerQuotationView } from './ownerQuotation';
import { groupOwnerQuotationMaterialLines } from './ownerQuotationMaterials';
import type { CustomerQuotationPrintWindow, CustomerQuotationPrintWindowOpener } from './customerQuotationPrint';
import { CustomerQuotationPrintError } from './customerQuotationPrint';

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function money(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'Not available';
  return new Intl.NumberFormat('en-PH', {
    style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value);
}

function margin(value: number | null): string {
  return value === null || !Number.isFinite(value) ? 'Not available'
    : new Intl.NumberFormat('en-PH', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function quantity(value: number): string {
  return Number.isFinite(value) ? new Intl.NumberFormat('en-PH', {
    maximumFractionDigits: 6,
  }).format(value) : 'Not available';
}

function unitMoney(value: number | null): string {
  return value === null || !Number.isFinite(value) ? 'Not available'
    : new Intl.NumberFormat('en-PH', {
        style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 6,
      }).format(value);
}

function date(value: string): string {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? parsed.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
    : value;
}

/** Private print document only. CustomerQuotationView/renderer never receive owner financial values. */
export function renderOwnerQuotationHtml(view: OwnerQuotationView): string {
  const rows = view.items.map((item) => `
    <tr>
      <td class="product-cell"><strong>${escapeHtml(item.productName)}</strong><small>${escapeHtml(item.productId)} · ${escapeHtml(item.sourceLabel)}</small></td>
      <td>${item.quantity.toLocaleString('en-PH')}</td>
      <td>${escapeHtml(money(item.unitSellingPrice))}</td>
      <td><strong>${escapeHtml(money(item.totalSellingPrice))}</strong></td>
      <td>${escapeHtml(money(item.unitProductCost))}</td>
      <td>${escapeHtml(money(item.totalProductCost))}</td>
      <td>${escapeHtml(money(item.profitPerUnit))}</td>
      <td><strong>${escapeHtml(money(item.totalProfit))}</strong></td>
      <td>${escapeHtml(margin(item.grossMargin))}</td>
    </tr>`).join('');

  const materialSections = view.items.map((item, index) => {
    const lines = groupOwnerQuotationMaterialLines(item.materialLines ?? []);
    const rows = lines.map((line) => `
      <tr>
        <td><strong>${escapeHtml(line.materialName)}</strong><small>${escapeHtml(line.materialId)} · ${escapeHtml(line.sources.join(' · '))}</small></td>
        <td>${escapeHtml(quantity(line.quantityPerProduct))} ${escapeHtml(line.unit)}</td>
        <td>${escapeHtml(quantity(line.totalQuantity))} ${escapeHtml(line.unit)}</td>
        <td>${escapeHtml(unitMoney(line.unitCost))} / ${escapeHtml(line.unit)}</td>
        <td><strong>${escapeHtml(money(line.totalCost))}</strong></td>
      </tr>`).join('');
    const known = item.materialBreakdownComplete === true;
    const otherCost = known && item.materialCostTotal !== null && item.materialCostTotal !== undefined &&
      item.totalProductCost !== null
      ? item.totalProductCost - item.materialCostTotal : null;
    const other = otherCost !== null && Number.isFinite(otherCost) && otherCost >= -1e-7
      ? Math.max(0, otherCost) : null;
    return `
      <section class="material-product-section">
        <h3>Item ${index + 1}: ${escapeHtml(item.productName)} · ${quantity(item.quantity)} pcs</h3>
        ${lines.length > 0
          ? `<table class="material-table"><thead><tr><th>Material / source</th><th>Per product</th><th>Quoted quantity</th><th>Cost / base unit</th><th>Total material cost</th></tr></thead><tbody>${rows}</tbody></table>`
          : `<p class="info">${known ? 'No direct or component materials are used in the saved cost breakdown.' : 'Saved detailed material costing is unavailable for this Product.'}</p>`}
        <p class="material-subtotal"><span>Item material subtotal</span><strong>${escapeHtml(money(known ? item.materialCostTotal ?? null : null))}</strong></p>
        <p class="material-other"><span>Other saved costs (labor, overhead, non-material components and package extras)</span><strong>${escapeHtml(money(other))}</strong></p>
        ${!known ? '<p class="warning">Material breakdown is incomplete. Missing material costs are not counted as zero.</p>' : ''}
      </section>`;
  }).join('');

  const consolidatedRows = (view.materials ?? []).map((material) => `
    <tr>
      <td><strong>${escapeHtml(material.materialName)}</strong><small>${escapeHtml(material.materialId)}</small></td>
      <td>${escapeHtml(quantity(material.totalQuantity))} ${escapeHtml(material.unit)}</td>
      <td>${escapeHtml(unitMoney(material.unitCost))} / ${escapeHtml(material.unit)}</td>
      <td>${material.contributingProducts.toLocaleString('en-PH')}</td>
      <td><strong>${escapeHtml(money(material.totalCost))}</strong></td>
    </tr>`).join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(view.quotationReference)} — Owner Financial Copy</title>
<style>
@page { size: A4 landscape; margin: 12mm; }
* { box-sizing: border-box; }
body { max-width: 273mm; margin: 10mm auto; padding: 12mm; background: #fff; color: #302a25; font: 9pt/1.4 Arial, sans-serif; }
html { background: #eee; }
header { display: flex; justify-content: space-between; align-items: start; gap: 12mm; border-bottom: 2px solid #596f4a; padding-bottom: 5mm; }
.brand { font-size: 18pt; font-weight: 800; color: #553327; }
.brand small { display: block; font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: #596f4a; margin-top: 2mm; }
.meta { text-align: right; font-size: 8pt; }
.meta h1 { font-size: 15pt; margin: 0 0 2mm; color: #553327; }
.private { margin: 5mm 0; padding: 3mm 4mm; border-left: 3px solid #9e512f; background: #f9efeb; color: #763923; font-weight: 700; }
.customer { display: flex; gap: 12mm; flex-wrap: wrap; padding: 4mm; background: #f7f6f3; border: 1px solid #e2dbd0; }
.customer > div { min-width: 34mm; max-width: 120mm; overflow-wrap: anywhere; }
.customer span { display: block; color: #776d62; font-size: 7pt; text-transform: uppercase; letter-spacing: .06em; }
h2 { font-size: 10pt; margin: 7mm 0 3mm; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th, td { padding: 2.7mm 1.6mm; border-bottom: 1px solid #ddd6ce; vertical-align: top; text-align: right; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
th { color: #53493e; background: #e8eee0; font-size: 7pt; line-height: 1.35; }
td { font-size: 8pt; }
th:first-child, td:first-child { text-align: left; width: 20%; }
th:nth-child(2) { width: 7%; }
td small { display: block; color: #756e65; margin-top: 1mm; font-size: 7pt; }
tr { break-inside: avoid; }
.summary { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 3mm; margin-top: 6mm; }
.summary > div { padding: 4mm; border: 1px solid #e2d9cb; border-radius: 2mm; background: #faf8f5; min-width: 0; }
.summary span { display: block; font-size: 7pt; color: #6e675f; text-transform: uppercase; letter-spacing: .05em; }
.summary strong { display: block; margin-top: 2mm; font-size: 13pt; overflow-wrap: anywhere; color: #553327; }
.summary .profit { border-color: #adbea0; background: #eef4e9; }
.summary .profit strong { color: #496b3f; }
.warning { padding: 3mm; margin-top: 4mm; border: 1px solid #d5a87d; background: #fff4e8; color: #7b4d23; font-weight: 700; }
.info { color: #6c645b; line-height: 1.5; font-size: 8pt; margin-top: 4mm; }
.notes { white-space: pre-wrap; overflow-wrap: anywhere; }
.material-breakdown { margin-top: 8mm; }
.material-product-section { margin-top: 5mm; break-inside: auto; }
.material-product-section h3 { margin: 4mm 0 2mm; color: #496b3f; font-size: 9pt; }
.material-table th:first-child, .material-table td:first-child { width: 37%; text-align: left; }
.material-table th, .material-table td { text-align: right; }
.material-table th:nth-child(2), .material-table th:nth-child(3) { width: 16%; }
.material-subtotal, .material-other { display: flex; align-items: center; justify-content: flex-end; gap: 10mm; margin: 2mm 0 0; font-size: 8.5pt; }
.material-subtotal strong { color: #496b3f; font-size: 10pt; }
.material-other { color: #71675e; font-size: 7.5pt; }
.material-consolidated { margin-top: 8mm; }
.material-overview { display: flex; justify-content: space-between; gap: 8mm; margin: 3mm 0 4mm; padding: 4mm; background: #eef4e9; border: 1px solid #adbea0; border-radius: 2mm; }
.material-overview span { display: block; font-size: 8pt; color: #566d4b; }
.material-overview strong { display: block; margin-top: 1mm; font-size: 13pt; color: #385332; }
.material-overview .material-count { text-align: right; }
.material-table small { font-size: 7pt; overflow-wrap: anywhere; }
.material-consolidated th:first-child, .material-consolidated td:first-child { width: 40%; }
.material-total { padding: 3mm 2mm; margin-top: 3mm; text-align: right; border-top: 2px solid #596f4a; font-size: 10pt; }
.material-total strong { margin-left: 7mm; color: #496b3f; }
.material-breakdown-note { margin-top: 3mm; color: #756b61; font-size: 7.5pt; }
@media print { .material-breakdown, .material-consolidated { break-before: auto; } }
footer { color: #756b61; font-size: 7.5pt; border-top: 1px solid #ded6cc; padding-top: 4mm; margin-top: 7mm; }
.screen-note { padding: 3mm; margin-bottom: 5mm; background: #fff5df; }
@media print {
 html { background: #fff; } body { max-width: none; margin: 0; padding: 0; }
 .screen-note { display: none; }
 * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
</style></head>
<body>
<div class="screen-note">Print or Save as PDF · A4 landscape · turn off browser headers and footers. Private document — do not send to customer.</div>
<header>
 <div class="brand">${escapeHtml(view.businessName)}<small>Business Owner Copy · Internal Only</small></div>
 <div class="meta"><h1>QUOTATION FINANCIAL REPORT</h1><strong>${escapeHtml(view.quotationReference)}</strong><div>Prepared: ${escapeHtml(date(view.generatedAtIso))}</div>
 ${view.validUntil ? `<div>Valid until: ${escapeHtml(date(view.validUntil))}</div>` : ''}</div>
</header>
<div class="private">CONFIDENTIAL — BUSINESS OWNER COPY. Contains internal production costs and estimated gross profit. Do not distribute to customers.</div>
<section class="customer">
 <div><span>Customer</span><strong>${escapeHtml(view.customer.name)}</strong></div>
 ${view.customer.contact ? `<div><span>Contact</span><strong>${escapeHtml(view.customer.contact)}</strong></div>` : ''}
 ${view.customer.address ? `<div><span>Address</span><strong>${escapeHtml(view.customer.address)}</strong></div>` : ''}
</section>
<section><h2>Quoted Products — Cost, Sales and Profit</h2>
<table><thead><tr><th>Product / price source</th><th>Qty</th><th>Sale / unit</th><th>Sales amount</th><th>Cost / unit</th><th>Total product cost</th><th>Profit / unit</th><th>Total profit</th><th>Margin</th></tr></thead>
<tbody>${rows}</tbody></table>
<div class="summary">
<div><span>Total quoted sales</span><strong>${escapeHtml(money(view.totalSales))}</strong></div>
<div><span>Total product cost</span><strong>${escapeHtml(money(view.totalProductCost))}</strong></div>
<div class="profit"><span>Estimated gross profit</span><strong>${escapeHtml(money(view.totalProfit))}</strong></div>
<div><span>Estimated gross margin</span><strong>${escapeHtml(margin(view.grossMargin))}</strong></div>
</div>
${view.unresolvedCostCount > 0 ? `<p class="warning">${view.unresolvedCostCount} product(s) do not have complete saved cost evidence. Missing cost, gross profit and margin fields are unavailable, not zero. Configure the relevant Yield, Components, Materials or Financial Source before relying on profitability figures.</p>` : ''}
<p class="info">Calculations use the saved fully loaded unit cost at quotation time, the chosen quantity, and any selected package/tier additional cost per offer. Gross profit = quoted sales minus product cost. These are <strong>quotation estimates, not realized sales or net profit</strong>; taxes, payment processing, delivery and other charges not included in saved Product cost are not automatically deducted.</p>
</section>

<section class="material-consolidated">
<h2>Combined Material Costs — Entire Quotation</h2>
<p class="info">Each saved material appears once per base unit, even when it is used by several quoted Products or appears in both Yield and Components. Quantities and costs are totaled automatically.</p>
<div class="material-overview">
  <div><span>Total cost of all materials used</span><strong>${escapeHtml(money(view.materialBreakdownComplete ? view.totalMaterialCost ?? null : null))}</strong></div>
  <div class="material-count"><span>Distinct materials / units</span><strong>${(view.materials ?? []).length.toLocaleString('en-PH')}</strong></div>
</div>
${(view.materials ?? []).length > 0
  ? `<table class="material-table"><thead><tr><th>Grouped material</th><th>Total quantity</th><th>Weighted cost / unit</th><th>Quoted products</th><th>Combined material cost</th></tr></thead><tbody>${consolidatedRows}</tbody></table>`
  : '<p class="info">No resolved material lines found in this quotation.</p>'}
<p class="material-total"><span>All materials — total cost</span><strong>${escapeHtml(money(view.materialBreakdownComplete ? view.totalMaterialCost ?? null : null))}</strong></p>
${view.materialBreakdownComplete !== true ? '<p class="warning">At least one item has missing detailed material evidence. The overall material cost is unavailable; known lines are shown for reference only.</p>' : ''}
<p class="material-breakdown-note">Quantities are costed planning estimates for this quotation, including the recipe safety-waste allowance, not actual inventory deductions or recorded material consumption. Other product costs are reported separately and remain included in the total product cost above.</p>
</section>

<section class="material-breakdown">
<h2>Material Cost Breakdown — Per Quoted Product</h2>
<p class="info">Repeated materials within each Product are also combined into a single row. Source details are retained under the material name.</p>
${materialSections}
</section>
${view.notes ? `<section><h2>Quotation notes</h2><div class="notes">${escapeHtml(view.notes)}</div></section>` : ''}
${view.terms ? `<section><h2>Terms &amp; conditions</h2><div class="notes">${escapeHtml(view.terms)}</div></section>` : ''}
<footer>Internal reference: ${escapeHtml(view.quotationReference)} · ${escapeHtml(view.businessName)} · For business owner review only</footer>
</body></html>`;
}

/** Only invoked by the dedicated owner-copy button; never auto-opens from customer printing. */
export function printOwnerQuotation(
  view: OwnerQuotationView,
  openWindow: CustomerQuotationPrintWindowOpener = () =>
    window.open('', '_blank') as CustomerQuotationPrintWindow | null,
): void {
  const popup = openWindow();
  if (!popup) throw new CustomerQuotationPrintError(
    'The owner copy could not be opened. Allow pop-ups and try again.',
  );
  popup.document.open();
  popup.document.write(renderOwnerQuotationHtml(view));
  popup.document.close();
  popup.focus();
  popup.print();
}
