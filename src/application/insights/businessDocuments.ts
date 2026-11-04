import { businessDay, LEDGER_LABELS, validateBusinessDocument, type BusinessDocument, type BusinessProfile, type ForecastScenario } from '../../domain/businessInsights';
import { forecastBusiness } from './businessForecast';
import { addMoney, cents } from './businessReports';

const formatter = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const businessMoney = (n: number | null) => n === null ? 'Not available' : formatter.format(n);
export const REPORT_CAVEATS = 'Sales use saved receipt dates (SGT); quotations are excluded. Cash uses movement dates and paid ledger entries. Balances at sale are historical, not a current receivables ledger. Saved product costs may include allocated labor and overhead; avoid counting these costs again as operating expenses. Missing costs remain unavailable. Expenses and cash records may be incomplete. Indicative results are estimates before tax, not audited net profit.';
export const FORECAST_CAVEATS = 'User assumptions, not recorded results. All projected sales are collected and costs paid in the same month. Monthly capacity caps sales units. Funding and upfront investment occur before month one. Taxes, loan interest, repayment schedules, delayed collections, and owner withdrawals are excluded unless reflected in your inputs. Avoid including the same cost in both unit cost and fixed expenses.';
export function fundingAllocated(profile: BusinessProfile) { return profile.fundingUses.reduce((total, use) => addMoney(total, cents(use.amount)), 0) / 100; }
export function investorReadiness(profile: BusinessProfile, hasSales: boolean, missingCosts: number): string[] {
  return [!profile.description.trim() && 'Add a business description.', !profile.market.trim() && 'Describe your target market and include sources for external claims.',
    !profile.advantage.trim() && 'Explain your competitive advantage.', !profile.team.trim() && 'Add your team or founder background.',
    !profile.milestones.trim() && 'Define measurable milestones.', !profile.risks.trim() && 'Describe risks and how you will address them.',
    !hasSales && 'No saved sales in the selected period. Explain your stage of business.', missingCosts > 0 && `${missingCosts} receipts lack saved product costs.`,
    profile.fundingAmount > 0 && fundingAllocated(profile) !== profile.fundingAmount && 'Allocate the full requested funding amount to uses of funds.',
    !profile.financialNotes.trim() && 'Explain financial record coverage, estimates, and any missing expenses.'].filter((s): s is string => !!s);
}
export function proposalTotal(document: BusinessDocument): number {
  if (!document.proposal) return 0;
  return document.proposal.items.reduce((sum, line) => addMoney(sum, cents(line.unitPrice ?? 0) * line.quantity), 0) / 100;
}
type Block = { kind: 'text'; text: string; heading?: boolean } | { kind: 'table'; headers: string[]; rows: string[][] } | { kind: 'photo'; caption: string; data: string };
const text = (value: string, heading = false): Block => ({ kind: 'text', text: value, heading });
const table = (headers: string[], rows: string[][]): Block => ({ kind: 'table', headers, rows });
function scenarioBlocks(scenario: ForecastScenario, compact = false): Block[] {
  const f = forecastBusiness(scenario);
  return [text(`${scenario.name} · 12-month forecast`, true),
    table(['Projected sales', 'Projected operating result', 'Ending cash', 'Additional cash needed'], [[businessMoney(f.revenue), businessMoney(f.operatingResult), businessMoney(f.endingCash), businessMoney(f.additionalFunding)]]),
    text(`Starts ${scenario.startMonth}; ${scenario.monthlyUnits} initial units/month; ${businessMoney(scenario.averageUnitPrice)}/unit; ${businessMoney(scenario.unitVariableCost)} variable cost/unit; ${businessMoney(scenario.monthlyFixedExpenses)} fixed costs/month; ${scenario.monthlyGrowthPercent}% monthly growth; ${scenario.monthlyCapacity} units/month capacity. Opening cash ${businessMoney(scenario.openingCash)}; funding ${businessMoney(scenario.fundingAmount)}; upfront investment ${businessMoney(scenario.upfrontInvestment)}.`),
    ...(!compact ? [table(['Month', 'Units', 'Sales', 'Operating result', 'Cash'], f.rows.map(r => [r.month, String(r.units), businessMoney(r.revenue), businessMoney(r.operatingResult), businessMoney(r.cash)]))] : []),
    text(`Break-even: ${f.breakEvenUnits === null ? 'Unavailable: unit price must exceed variable cost.' : `${f.breakEvenUnits} units/month${f.breakEvenUnits > scenario.monthlyCapacity ? ' — above entered capacity' : ''}.`} ${f.capacityConstrained ? 'Forecast demand is capped by production capacity.' : ''}`),
    text(FORECAST_CAVEATS)];
}
/** One content model drives both print and editable Word exports. All user content stays plain text. */
export function businessDocumentBlocks(document: BusinessDocument): Block[] {
  validateBusinessDocument(document);
  const p = document.profile, compact = document.kind === 'investor-summary';
  const clip = (value: string, limit = 260) => compact && value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
  if (document.proposal) {
    const q = document.proposal;
    return [text(`Prepared for ${q.recipient || 'Recipient to be confirmed'}`), text(q.introduction),
      table(['Product / code', 'Quantity', 'Unit price (PHP)', 'Amount (PHP)'], q.items.map(i => [
        `${i.name}\n${i.productId}`, String(i.quantity), businessMoney(i.unitPrice), businessMoney(i.unitPrice === null ? null : cents(i.unitPrice) * i.quantity / 100),
      ])), text(`Total: ${businessMoney(proposalTotal(document))}`, true),
      ...(q.includePictures ? q.items.flatMap(i => Object.hasOwn(q.pictures, i.productId) ? [{ kind: 'photo' as const, caption: `${i.name} · ${i.productId}`, data: q.pictures[i.productId] }] : []) : []),
      text('Delivery and terms', true), text(`Production lead time: ${q.leadTime || 'To be agreed'}\nDelivery: ${q.delivery || 'To be agreed'}\nPayment terms: ${q.paymentTerms || 'To be agreed'}\nValid until: ${q.validUntil || 'To be agreed'}`),
      text(q.notes), text(`Prices are PHP. Tax, delivery, customization, and inclusions follow the terms stated above. ${p.contact}`)];
  }
  const r = document.report!, m = r.metrics;
  const blocks: Block[] = [];
  if (document.kind !== 'business-report') {
    blocks.push(text('Business overview', true), text(clip(p.description) || 'Business description to be completed.'),
      text(`Target market: ${clip(p.market) || 'To be completed.'}`), text(`Advantage: ${clip(p.advantage) || 'To be completed.'}`));
    if (p.traction) blocks.push(text(`Founder-reported traction: ${clip(p.traction)}`));
    blocks.push(text(`Team: ${clip(p.team) || 'To be completed.'}`));
  }
  blocks.push(text(`Recorded performance · ${r.from} to ${r.to} (SGT)`, true),
    table(['Sales', 'Orders / units', 'Estimated gross profit', 'Operating expenses'], [[businessMoney(m.sales), `${m.orders} / ${m.units}`, businessMoney(m.grossProfit), businessMoney(m.operatingExpenses)]]),
    text(`Previous equal-length period (${r.previousFrom} to ${r.previousTo}): ${businessMoney(m.previousSales)}. Sales change: ${m.growthPercent === null ? 'No prior sales baseline' : `${m.growthPercent.toFixed(1)}%`}. Average order: ${businessMoney(m.averageOrder)}.`));
  if (!compact) {
    blocks.push(table(['Cash in', 'Cash out', 'Net cash movement', 'Tracked closing cash'], [[businessMoney(m.cashIn), businessMoney(m.cashOut), businessMoney(m.cashNet), businessMoney(m.closingCash)]]),
      text(`Indicative result after recorded operating expenses: ${businessMoney(m.indicativeResult)}. Balances saved at sale: ${businessMoney(m.balanceAtSale)}. Repeat identified customers within period: ${m.repeatCustomers} of ${m.identifiedCustomers}.`),
      text('Monthly trends', true), table(['Month', 'Sales', 'Orders', 'Operating expenses', 'Net cash movement'], r.months.map(row => [row.month, businessMoney(row.sales), String(row.orders), businessMoney(row.expenses), businessMoney(row.cashNet)])),
      text('Products by sales · first 50', true), table(['Product / code', 'Units', 'Sales after discount', 'Estimated gross profit'], r.products.slice(0, 50).map(row => [`${row.name}\n${row.productId}`, String(row.units), businessMoney(row.sales), businessMoney(row.grossProfit)])));
  }
  if (document.kind !== 'business-report') {
    blocks.push(text('Funding and milestones', true), text(`Requested funding: ${businessMoney(p.fundingAmount)}.`),
      table(['Use of funds', 'Amount'], p.fundingUses.map(use => [use.purpose || 'Purpose to be completed', businessMoney(use.amount)])),
      text(`Milestones: ${clip(p.milestones) || 'To be completed.'}`), text(`Risks and mitigation: ${clip(p.risks) || 'To be completed.'}`));
    if (document.scenario) {
      blocks.push(...scenarioBlocks(document.scenario, compact));
      if (document.scenario.fundingAmount !== p.fundingAmount) blocks.push(text('Planning note: forecast funding differs from the business funding request. Review these assumptions before sharing.'));
    }
    const gaps = investorReadiness(p, m.orders > 0, m.unknownCostReceipts);
    if (gaps.length) blocks.push(text(`Preparation gaps: ${gaps.join(' ')}`));
  }
  blocks.push(text(`Record coverage: ${m.orders} receipts; ${m.ledgerEntries} ledger entries; ${m.unknownCostReceipts} receipts with missing cost evidence. ${clip(p.financialNotes)}`),
    text(REPORT_CAVEATS));
  if (!compact) blocks.push(text('Receipt evidence · first 200 references', true), text(r.sources.slice(0, 200).map(s => `${s.reference} (${s.date})`).join(', ') || 'No saved receipts in this period.'));
  if (!compact && r.ledgerSources.length) blocks.push(text('Ledger evidence · first 100 entries', true), table(['Entry date', 'Description / type', 'Amount', 'Cash date'], r.ledgerSources.slice(0, 100).map(e => [e.date, `${e.description}\n${LEDGER_LABELS[e.kind]} · ${e.reference}`, businessMoney(e.amount), e.paid ? e.cashDate : 'Unpaid / not received'])));
  return blocks;
}
const html = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
export function renderBusinessDocument(document: BusinessDocument): string {
  const compact = document.kind === 'investor-summary';
  const content = businessDocumentBlocks(document).map(block => block.kind === 'text' ?
    `<${block.heading ? 'h2' : 'p'}>${html(block.text)}</${block.heading ? 'h2' : 'p'}>` : block.kind === 'photo' ?
      `<figure><img src="${html(block.data)}" alt="${html(block.caption)}"><figcaption>${html(block.caption)}</figcaption></figure>` :
      `<table><thead><tr>${block.headers.map(h => `<th>${html(h)}</th>`).join('')}</tr></thead><tbody>${block.rows.map(row => `<tr>${row.map(cell => `<td>${html(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`).join('');
  const result = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'"><title>${html(document.title)}</title><style>
@page{size:A4;margin:${compact ? '10mm' : '14mm'}}*{box-sizing:border-box}body{font:${compact ? '8' : '10'}pt/1.4 Arial,sans-serif;color:#35251e;margin:0;overflow-wrap:anywhere}header{border-bottom:2px solid #763923;padding-bottom:8px;margin-bottom:10px}header small{letter-spacing:1px;text-transform:uppercase}h1{font:${compact ? '21' : '25'}pt Georgia,serif;margin:4px 0}h2{font-size:${compact ? '10' : '13'}pt;color:#763923;margin:${compact ? '7px' : '18px'} 0 5px}p{margin:${compact ? '4px' : '8px'} 0;white-space:pre-wrap}table{border-collapse:collapse;width:100%;table-layout:fixed;margin:7px 0}th,td{padding:${compact ? '4' : '7'}px;text-align:left;border-bottom:1px solid #dfd5c9;vertical-align:top;white-space:pre-wrap}th{background:#f2e9df;font-size:.9em}thead{display:table-header-group}tr,figure{break-inside:avoid}figure{display:inline-block;vertical-align:top;width:23%;margin:10px 1%}figure img{display:block;max-width:100%;height:70px;object-fit:contain}figcaption{font-size:8pt}footer{margin-top:12px;border-top:1px solid #dfd5c9;padding-top:5px;font-size:7pt;color:#756153}@media screen{body{max-width:900px;padding:24px;margin:auto}}@media print{*{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style></head><body><header><small>${html(document.profile.name)} · ${document.kind === 'proposal' ? 'Business proposal' : 'Private business document'}</small><h1>${html(document.title)}</h1><p>${html(document.profile.contact)}${document.profile.website ? ` · ${html(document.profile.website)}` : ''}</p></header>${content}<footer>Generated ${html(businessDay(document.generatedAt))} (SGT) · Snapshot ${html(document.id)} · Sales revision ${document.historyRevision} · Business revision ${document.businessRevision}. Figures and assumptions are frozen at generation.</footer></body></html>`;
  if (result.length > 4 * 1024 * 1024) throw new Error('The document is too large. Select fewer products or exclude pictures.');
  return result;
}
export function downloadBusinessFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const businessFilename = (document: BusinessDocument) => `${document.title.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 90)}-${businessDay(document.generatedAt)}`;
export function printBusinessDocument(document: BusinessDocument) {
  const content = renderBusinessDocument(document), popup = window.open('', '_blank', 'width=1000,height=950');
  if (!popup) throw new Error('Allow pop-ups to print or save this document as PDF.');
  popup.opener = null; popup.document.open(); popup.document.write(content); popup.document.close();
  const images = Array.from(popup.document.images).filter(image => !image.complete);
  const print = () => { popup.focus(); popup.print(); };
  if (!images.length) { print(); return; }
  void Promise.all(images.map(image => new Promise<void>(resolve => {
    const timer = setTimeout(resolve, 5000);
    const done = () => { clearTimeout(timer); resolve(); };
    image.addEventListener('load', done, { once: true }); image.addEventListener('error', done, { once: true });
    if (image.complete) done();
  }))).then(print);
}
export async function businessDocumentWord(document: BusinessDocument): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, WidthType, HeadingLevel } = await import('docx');
  const blocks = businessDocumentBlocks(document), compact = document.kind === 'investor-summary';
  const paragraph = (value: string, heading = false) => new Paragraph({
    heading: heading ? HeadingLevel.HEADING_2 : undefined,
    children: value.split('\n').map((line, i) => new TextRun({ text: line, break: i ? 1 : undefined })),
    spacing: { after: compact ? 65 : 120 },
  });
  const children = [new Paragraph({ text: document.profile.name, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: document.title, heading: HeadingLevel.TITLE }), paragraph(`${document.profile.contact} ${document.profile.website}`),
    ...blocks.map(block => {
      if (block.kind === 'text') return paragraph(block.text, block.heading);
      if (block.kind === 'photo') {
        const bytes = Uint8Array.from(atob(block.data.split(',')[1]), c => c.charCodeAt(0));
        return new Paragraph({ children: [new ImageRun({ type: 'jpg', data: bytes, transformation: { width: 70, height: 70 } }), new TextRun({ text: block.caption, break: 1 })] });
      }
      return new Table({ width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [block.headers, ...block.rows].map((row, i) => new TableRow({ tableHeader: i === 0, cantSplit: true,
          children: row.map(cell => new TableCell({ children: [paragraph(cell)], shading: i === 0 ? { fill: 'F2E9DF' } : undefined })) })) });
    }), paragraph(`Generated ${businessDay(document.generatedAt)} (SGT). Snapshot ${document.id}; sales revision ${document.historyRevision}; business revision ${document.businessRevision}. Figures and assumptions are frozen at generation.`)];
  return Packer.toBlob(new Document({ title: document.title, creator: document.profile.name,
    styles: { default: { document: { run: { font: 'Arial', size: compact ? 16 : 20 } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 567, bottom: 567, left: 680, right: 680 } } }, children }] }));
}
export function businessDocumentCsv(document: BusinessDocument): string {
  validateBusinessDocument(document);
  const rows: (string | number | null)[][] = [['Document', document.title], ['Generated (SGT)', businessDay(document.generatedAt)], ['Currency', 'PHP']];
  if (document.proposal) {
    rows.push(['Product code', 'Product', 'Quantity', 'Unit price', 'Amount']);
    document.proposal.items.forEach(i => rows.push([i.productId, i.name, i.quantity, i.unitPrice, i.unitPrice === null ? null : cents(i.unitPrice) * i.quantity / 100]));
  } else {
    const report = document.report!;
    rows.push(['From (SGT)', report.from], ['To (SGT)', report.to], ['Metric', 'Value']);
    Object.entries(report.metrics).forEach(([key, value]) => rows.push([key, value]));
    rows.push([], ['Month', 'Sales', 'Orders', 'Operating expenses', 'Net cash movement']);
    report.months.forEach(m => rows.push([m.month, m.sales, m.orders, m.expenses, m.cashNet]));
    rows.push([], ['Product code', 'Product', 'Units', 'Sales after discount', 'Saved cost', 'Estimated gross profit']);
    report.products.forEach(p => rows.push([p.productId, p.name, p.units, p.sales, p.savedCost, p.grossProfit]));
    rows.push([], ['Receipt ID', 'Reference', 'Sale date (SGT)']); report.sources.forEach(s => rows.push([s.id, s.reference, s.date]));
    rows.push([], ['Ledger ID', 'Entry date', 'Type', 'Category', 'Description', 'Amount', 'Cash moved', 'Cash date', 'Reference']);
    report.ledgerSources.forEach(e => rows.push([e.id, e.date, LEDGER_LABELS[e.kind], e.category, e.description, e.amount, e.paid ? 'Yes' : 'No', e.paid ? e.cashDate : '', e.reference]));
    if (document.scenario) {
      rows.push([], ['Forecast assumption', 'Value']);
      Object.entries(document.scenario).forEach(([key, value]) => rows.push([key, value]));
      rows.push([], ['Forecast month', 'Units', 'Sales', 'Variable cost', 'Fixed costs', 'Operating result', 'Cash']);
      forecastBusiness(document.scenario).rows.forEach(r => rows.push([r.month, r.units, r.revenue, r.variableCost, r.fixedCost, r.operatingResult, r.cash]));
    }
    rows.push([], ['Record limitations', REPORT_CAVEATS], ['Forecast assumptions', FORECAST_CAVEATS]);
  }
  return '\uFEFF' + rows.map(row => row.map(value => {
    let cell = value === null ? 'Not available' : String(value);
    if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(cell)) cell = `'${cell}`;
    return `"${cell.replaceAll('"', '""')}"`;
  }).join(',')).join('\r\n');
}

/** A shareable document bundle, separate from a restorable SQLite database backup. */
export async function businessDocumentPack(document: BusinessDocument): Promise<Blob> {
  const [{ zip, strToU8 }, word] = await Promise.all([import('fflate'), businessDocumentWord(document)]);
  const wordBytes = new Uint8Array(await word.arrayBuffer());
  const files = {
    'document.docx': wordBytes,
    'document.html': strToU8(renderBusinessDocument(document)),
    'financial-figures.csv': strToU8(businessDocumentCsv(document)),
    'source-snapshot.json': strToU8(JSON.stringify({ format: 'my-lovely-craft-business-document', version: 1, document }, null, 2)),
    'README.txt': strToU8('My Lovely Craft business document pack\n\nOpen document.html in a browser to print or save as PDF. document.docx is editable in Word. Financial figures and the frozen source snapshot are included for review. This pack is not a database backup; use Database tools to export a restorable, mobile-compatible .sqlite file.\n\n' + REPORT_CAVEATS + '\n\n' + FORECAST_CAVEATS),
  };
  return new Promise((resolve, reject) => zip(files, { level: 1 }, (error, bytes) => error ? reject(error) : resolve(new Blob([new Uint8Array(bytes)], { type: 'application/zip' }))));
}
