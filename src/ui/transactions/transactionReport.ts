import type { SavedCustomerReceipt } from './models';
import {
  effectiveTransaction,
  transactionDay,
  transactionSummary,
  type TransactionEntry,
} from './transactions';
const money = (value: number | null) =>
  value === null ? 'Not available' : `PHP ${value.toFixed(2)}`;
const htmlText = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
const displayDate = (value: string) =>
  new Date(value).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' }) +
  ' SGT';
export function transactionFinancialHtml(
  receipts: SavedCustomerReceipt[],
  entries: TransactionEntry[],
  period: string
) {
  const summary = transactionSummary(receipts, entries);
  function metric(label: string, value: number | null) {
    return `<div><span>${htmlText(label)}</span><strong>${htmlText(
      money(value)
    )}</strong></div>`;
  }
  const rows = receipts
    .map((receipt) => {
      const movement = effectiveTransaction(receipt, entries);
      const financial = transactionSummary([receipt], entries);
      return `<tr><td>${htmlText(receipt.reference)}<small>${htmlText(
        receipt.customerName
      )}</small><small>Sale ${transactionDay(receipt.createdAt)}</small></td>
<td>${htmlText(money(receipt.total))}</td><td>${htmlText(
        money(financial.cost)
      )}</td><td>${htmlText(money(financial.profit))}</td>
<td>${
        movement.direction === 'credit'
          ? 'Credit / money in'
          : 'Debit / money out'
      }<strong>${htmlText(money(movement.amount))}</strong><small>${
        movement.date
      }</small><small>${htmlText(movement.notes)}</small></td></tr>`;
    })
    .join('');
  const details =
    receipts.length === 1
      ? `<h2>Saved item cost evidence</h2><p>Original subtotal: ${htmlText(money(receipts[0].subtotal))} · Receipt discount: ${htmlText(money(receipts[0].discount))} · Sale total: ${htmlText(money(receipts[0].total))}</p><table><thead><tr><th>Product / code</th><th>Quantity</th><th>Item sales</th><th>Saved cost</th></tr></thead><tbody>${receipts[0].items
          .map(
            (item) =>
              `<tr><td>${htmlText(item.name)}<small>${htmlText(
                item.productId
              )}</small></td><td>${item.quantity}</td><td>${htmlText(
                money(item.amount)
              )}</td><td>${htmlText(
                money(item.totalProductCost ?? null)
              )}</td></tr>`
          )
          .join('')}</tbody></table>`
      : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>Transaction financial report</title><style>
@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{margin:0;font:10pt/1.45 Arial,sans-serif;color:#243d38;overflow-wrap:anywhere}
header{border-bottom:2px solid #254d43;padding-bottom:4mm}h1{font:23pt Georgia,serif;margin:2mm 0}h2{font-size:14pt;margin:6mm 0 2mm}p{margin:2mm 0}
.metrics{display:flex;flex-wrap:wrap;gap:3mm;margin:5mm 0}.metrics div{width:31%;padding:3mm;background:#e4ebdf;break-inside:avoid}.metrics span,.metrics strong{display:block}.metrics strong{font-size:13pt}
table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}th,td{text-align:left;padding:3mm 2mm;border-bottom:1px solid #dde3db;vertical-align:top}th{background:#e4ebdf}tr{break-inside:avoid}th:first-child{width:30%}td strong,small{display:block}small{font-size:8pt;color:#687770}footer{margin-top:5mm;border-top:1px solid #dde3db;padding-top:3mm;font-size:8pt}
@media print{*{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>
<header><small>MY LOVELY CRAFT · PRIVATE OWNER REPORT</small><h1>Transaction financial report</h1><p>${htmlText(
    period
  )}</p><small>Generated ${htmlText(displayDate(new Date().toISOString()))} · ${
    receipts.length
  } receipts · PHP</small></header>
<div class="metrics">${metric('Credit / money in', summary.credit)}${metric(
    'Debit / money out',
    summary.debit
  )}${metric('Net cash movement', summary.net)}${metric(
    'Original sales total',
    summary.sales
  )}${metric('Saved product cost', summary.cost)}${metric(
    'Estimated sale profit',
    summary.profit
  )}${metric('Paid toward sale', summary.received)}${metric(
    'Balance at sale',
    summary.balance
  )}</div>
<p>Debit means money out. Credit means money in. Managed cash movements are separate from original receipts. Quotations are excluded from sales and cash totals.</p>
<p>Profit uses original sale totals after discount and saved costs; it is not net cash flow. ${
    summary.unknownCostCount
      ? `${
          summary.unknownCostCount
        } receipt(s) have incomplete cost evidence; total cost and profit remain unavailable. Known cost subtotal: ${htmlText(
          money(summary.knownCost)
        )}.`
      : 'Costs were captured when each receipt was prepared.'
  } Balances are the amounts saved at sale, not a running customer account.</p>
<table><thead><tr><th>Receipt / customer</th><th>Sale total</th><th>Saved cost</th><th>Sale profit</th><th>Cash movement</th></tr></thead><tbody>${rows}</tbody></table>${details}
${receipts.length === 1 ? '<footer>Private financial information. Original receipt amounts and printed documents remain unchanged.</footer>' : ''}</body></html>`;
}

export function printTransactionFinancialReport(
  receipts: SavedCustomerReceipt[],
  entries: TransactionEntry[],
  period: string
) {
  if (!receipts.length)
    throw new Error('Choose at least one receipt for the financial report.');
  const html = transactionFinancialHtml(receipts, entries, period);
  if (html.length > 2000000)
    throw new Error(
      'This financial report is too large. Narrow the date range.'
    );
  const popup = window.open('', '_blank', 'width=1000,height=900');
  if (!popup)
    throw new Error('Allow pop-ups to print or save the financial report.');
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  popup.print();
}
