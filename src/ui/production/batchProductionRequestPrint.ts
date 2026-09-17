import type { BatchProductionRequestView } from './batchProductionRequestView';

export type BatchProductionRequestPrintErrorCode = 'POPUP_BLOCKED';

export class BatchProductionRequestPrintError extends Error {
  readonly code: BatchProductionRequestPrintErrorCode;

  constructor(code: BatchProductionRequestPrintErrorCode, message: string) {
    super(message);
    this.name = 'BatchProductionRequestPrintError';
    this.code = code;
  }
}

export interface BatchPrintDocument {
  open(): void;
  write(content: string): void;
  close(): void;
}

export interface BatchPrintWindow {
  document: BatchPrintDocument;
  focus(): void;
  print(): void;
}

export type BatchPrintWindowOpener = () => BatchPrintWindow | null;

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatNumber(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return 'Unavailable';
  return value.toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function formatMoney(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'Unavailable';
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'Unavailable';
  return `${formatNumber(value * 100, 2)}%`;
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function label(value: string): string {
  return value.replaceAll('-', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function materialRows(view: BatchProductionRequestView): string {
  if (view.materials.length === 0) {
    return '<tr><td colspan="6" class="empty">No direct material requirements are present for this batch.</td></tr>';
  }

  return view.materials
    .map(
      (row) => `
        <tr>
          <td><strong>${escapeHtml(row.materialName)}</strong><br><span class="muted">${escapeHtml(row.materialId)}</span></td>
          <td class="num">${escapeHtml(formatNumber(row.requiredQuantity, 4))} ${escapeHtml(row.baseUnit)}</td>
          <td class="num">${row.normalizedOnHandQuantity === null ? 'Unavailable' : `${escapeHtml(formatNumber(row.normalizedOnHandQuantity, 4))} ${escapeHtml(row.baseUnit)}`}</td>
          <td class="num">${row.shortageQuantity === null ? 'Unavailable' : `${escapeHtml(formatNumber(row.shortageQuantity, 4))} ${escapeHtml(row.baseUnit)}`}</td>
          <td class="num">${escapeHtml(formatNumber(row.capacityPieces, 0))}</td>
          <td>${escapeHtml(label(row.status))}</td>
        </tr>`,
    )
    .join('');
}

function componentRows(view: BatchProductionRequestView): string {
  return view.components
    .map(
      (row) => `
        <tr>
          <td><strong>${escapeHtml(row.sourceName)}</strong><br><span class="muted">${escapeHtml(row.sourceId)}</span></td>
          <td>${escapeHtml(label(row.sourceType))}</td>
          <td>${escapeHtml(label(row.role))}</td>
          <td class="num">${escapeHtml(formatNumber(row.quantityPerParent, 4))} pc</td>
          <td class="num">${escapeHtml(formatNumber(row.plannedQuantity, 4))} pc</td>
          <td class="num">${escapeHtml(formatNumber(row.availableQuantity, 4))}</td>
          <td class="num">${escapeHtml(formatNumber(row.capacityPieces, 0))}</td>
          <td>${escapeHtml(label(row.status))}</td>
        </tr>`,
    )
    .join('');
}

function limiterRows(view: BatchProductionRequestView): string {
  if (view.limitingResources.length === 0) {
    return '<p class="muted">No authoritative limiting-resource list is available for this snapshot.</p>';
  }

  return `<ul class="compact-list">${view.limitingResources
    .map(
      (row) => `<li><strong>${escapeHtml(row.sourceName)}</strong> — ${escapeHtml(row.typeLabel)}, supports ${escapeHtml(formatNumber(row.capacityPieces, 0))} finished pieces.<br><span class="muted">${escapeHtml(row.evidence)} · ${escapeHtml(row.pathLabel)}</span></li>`,
    )
    .join('')}</ul>`;
}

function warningList(view: BatchProductionRequestView): string {
  if (view.warnings.length === 0 && view.issues.length === 0) {
    return '<p>No readiness warnings or issues were reported for this planning snapshot.</p>';
  }

  const warnings = view.warnings
    .map((message) => `<li><strong>Advisory:</strong> ${escapeHtml(message)}</li>`)
    .join('');
  const issues = view.issues
    .map((issue) => `<li><strong>${escapeHtml(issue.source)}:</strong> ${escapeHtml(issue.message)}</li>`)
    .join('');
  return `<ul class="compact-list">${warnings}${issues}</ul>`;
}

/** Render the complete A4-oriented print document. */
export function renderBatchProductionRequestHtml(view: BatchProductionRequestView): string {
  const capacity = view.currentAssemblyCapacity === null
    ? 'Unavailable'
    : `${formatNumber(view.currentAssemblyCapacity, 0)} pc`;
  const overage = view.overageQuantity === null
    ? 'Unavailable'
    : `${formatNumber(view.overageQuantity, 0)} pc`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(view.product.name)} — Production Request</title>
  <style>
    @page { size: A4; margin: 4mm;
      @bottom-left { content: "Craft Business Manager | Batch sheet"; font: 8pt Arial, sans-serif; color: #555; }
      @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8pt Arial, sans-serif; color: #555; }
    }
    * { box-sizing: border-box; }
    html { background: #edeae4; }
    body { width: min(210mm, 100%); margin: 8mm auto; padding: 18mm 16mm; background: #fff; box-shadow: 0 2mm 8mm #0002; color: #111; font-family: Arial, Helvetica, sans-serif; font-size: 10pt; line-height: 1.4; overflow-wrap: anywhere; }
    h1, h2, h3, p { margin-top: 0; }
    h1 { margin-bottom: 2mm; font-size: 20pt; letter-spacing: .02em; }
    h2 { margin: 6mm 0 2.5mm; padding-bottom: 1.5mm; border-bottom: 1.5px solid #111; font-size: 12pt; text-transform: uppercase; letter-spacing: .04em; break-after: avoid; }
    h3 { margin-bottom: 2mm; font-size: 10.5pt; }
    .brand { margin-bottom: 1mm; font-size: 8.5pt; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
    .subhead { display: flex; justify-content: space-between; gap: 8mm; padding-bottom: 4mm; border-bottom: 2px solid #111; }
    .subhead p { margin: 0; }
    .subhead > div { min-width: 0; }
    .reference { flex: 0 0 48mm; text-align: right; font-size: 8pt; }
    .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 3mm; margin-top: 4mm; }
    .summary > div, .metric { padding: 2.5mm; border: 1px solid #aaa; break-inside: avoid; }
    .summary span, .metric span { display: block; margin-bottom: .8mm; color: #555; font-size: 7.5pt; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
    .summary strong, .metric strong { font-size: 10pt; }
    .readiness { margin-top: 3mm; padding: 2.5mm 3mm; border: 1.5px solid #111; font-weight: 700; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 2mm; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    thead { display: table-header-group; }
    th, td { padding: 1.8mm; border: 1px solid #bbb; vertical-align: top; text-align: left; overflow-wrap: anywhere; }
    th { background: #eee; font-size: 7.5pt; letter-spacing: .03em; text-transform: uppercase; }
    td { font-size: 9pt; }
    .materials-table th:first-child { width: 28%; }
    .components-table th:first-child { width: 23%; }
    tr { break-inside: avoid; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .muted { color: #555; font-size: 8.5pt; }
    .empty { padding: 4mm; text-align: center; color: #555; }
    .compact-list { margin: 0; padding-left: 5mm; }
    .compact-list li { margin-bottom: 1.5mm; break-inside: avoid; }
    .blank-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4mm 8mm; }
    .blank-field { min-height: 11mm; padding-top: 2mm; border-bottom: 1px solid #111; }
    .blank-field span { display: block; color: #555; font-size: 8pt; text-transform: uppercase; }
    .notes-box { min-height: 25mm; border: 1px solid #888; }
    .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7mm; margin-top: 12mm; break-after: avoid; }
    .signature { padding-top: 8mm; border-top: 1px solid #111; text-align: center; }
    .footer { margin-top: 3mm; padding-top: 2mm; border-top: 1px solid #aaa; color: #555; font-size: 8pt; break-before: avoid; break-inside: avoid; }
    .screen-note { margin-bottom: 8mm; padding: 3mm; border: 1px solid #ddd; color: #555; font-size: 9pt; }
    section { break-inside: auto; }
    .keep-together, .signatures { break-inside: avoid; }
    p { orphans: 3; widows: 3; }
    @media screen and (max-width: 600px) {
      body { margin: 0; padding: 8mm 5mm; }
      .subhead { flex-direction: column; gap: 3mm; }
      .reference { flex-basis: auto; text-align: left; }
      .summary, .grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media print {
      html { background: #fff; }
      .screen-note { display: none; }
      body {
        width: auto;
        margin: 0;
        padding: 14mm 12mm;
        box-shadow: none;
        -webkit-box-decoration-break: clone;
        box-decoration-break: clone;
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
      a { color: inherit; text-decoration: none; }
    }
  </style>
</head>
<body>
  <aside class="screen-note">A4 portrait | the PDF keeps a built-in content inset even if the browser margin setting is None. With default print margins the layout totals 16 mm at the sides and 18 mm at the top and bottom. Turn off browser headers and footers.</aside>
  <header>
    <div class="brand">Craft Business Manager</div>
    <div class="subhead">
      <div>
        <h1>Production Request / Batch Sheet</h1>
        <p>Planning snapshot for workshop preparation and production execution.</p>
      </div>
      <div class="reference">
        <strong>${escapeHtml(view.requestReference)}</strong><br>
        Generated ${escapeHtml(formatDateTime(view.generatedAtIso))}
      </div>
    </div>
  </header>

  <section class="summary" aria-label="Batch summary">
    <div><span>Product</span><strong>${escapeHtml(view.product.name)}</strong><br><span class="muted">${escapeHtml(view.product.id)}</span></div>
    <div><span>Category</span><strong>${escapeHtml(view.product.categoryLabel)}</strong><br><span class="muted">${view.product.isActive ? 'Active product' : 'Archived product'}</span></div>
    <div><span>Planned finished pieces</span><strong>${escapeHtml(formatNumber(view.plannedQuantity, 0))} pc</strong></div>
    <div><span>Safety waste reserve</span><strong>${escapeHtml(formatNumber(view.safetyWastePercentage, 2))}%</strong></div>
    <div><span>Effective yield evidence</span><strong>${escapeHtml(view.effectiveYieldSampleId ?? 'Not available')}</strong></div>
    <div><span>Current assembly capacity</span><strong>${escapeHtml(capacity)}</strong></div>
  </section>

  <div class="readiness">Estimate readiness: ${escapeHtml(label(view.readinessStatus))} · Batch feasibility: ${escapeHtml(label(view.feasibility))} · Overage: ${escapeHtml(overage)}</div>

  <section>
    <h2>Materials to Prepare</h2>
    <table class="materials-table">
      <thead><tr><th>Material</th><th>Required</th><th>On hand</th><th>Shortage</th><th>Capacity</th><th>Status</th></tr></thead>
      <tbody>${materialRows(view)}</tbody>
    </table>
  </section>

  ${view.components.length > 0 ? `<section>
    <h2>Components / Vessels / Nested Products</h2>
    <table class="components-table">
      <thead><tr><th>Component</th><th>Source</th><th>Role</th><th>Per parent</th><th>Batch qty</th><th>Available</th><th>Capacity</th><th>Status</th></tr></thead>
      <tbody>${componentRows(view)}</tbody>
    </table>
  </section>` : ''}

  <section>
    <h2>Capacity & Limiting Resources</h2>
    ${limiterRows(view)}
  </section>

  <section>
    <h2>Financial Summary</h2>
    <div class="grid-4">
      <div class="metric"><span>Planned production cost</span><strong>${escapeHtml(formatMoney(view.financials.plannedProductionCost))}</strong></div>
      <div class="metric"><span>Average cost / finished pc</span><strong>${escapeHtml(formatMoney(view.financials.averageCostPerFinishedUnit))}</strong></div>
      <div class="metric"><span>Selling price / pc</span><strong>${escapeHtml(formatMoney(view.financials.sellingPrice))}</strong></div>
      <div class="metric"><span>Profit / pc</span><strong>${escapeHtml(formatMoney(view.financials.profitPerUnit))}</strong></div>
      <div class="metric"><span>Expected revenue</span><strong>${escapeHtml(formatMoney(view.financials.expectedRevenue))}</strong></div>
      <div class="metric"><span>Expected profit</span><strong>${escapeHtml(formatMoney(view.financials.expectedProfit))}</strong></div>
      <div class="metric"><span>Batch margin</span><strong>${escapeHtml(formatPercent(view.financials.batchMargin))}</strong></div>
      <div class="metric"><span>Financial readiness</span><strong>${escapeHtml(label(view.financials.status))}</strong></div>
    </div>
  </section>

  <section>
    <h2>Readiness Notes / Issues</h2>
    ${warningList(view)}
  </section>

  ${view.product.notes ? `<section><h2>Product Notes</h2><p>${escapeHtml(view.product.notes)}</p></section>` : ''}

  <section class="keep-together">
    <h2>Production Notes / Instructions</h2>
    <div class="notes-box" aria-label="Blank production notes area"></div>
  </section>

  <div class="keep-together">
  <section>
    <h2>Actual Production Results</h2>
    <div class="blank-grid">
      <div class="blank-field"><span>Actual good pieces</span></div>
      <div class="blank-field"><span>Rejected / damaged pieces</span></div>
      <div class="blank-field"><span>Production started</span></div>
      <div class="blank-field"><span>Production completed</span></div>
      <div class="blank-field"><span>Actual waste / variance</span></div>
      <div class="blank-field"><span>Actual batch remarks</span></div>
    </div>
  </section>

  <section class="signatures" aria-label="Production sign off">
    <div class="signature">Prepared by</div>
    <div class="signature">Produced by</div>
    <div class="signature">Checked by</div>
  </section>

  <footer class="footer">
    Planning snapshot only. Printing does not reserve, decrement, or otherwise change stock.
  </footer>
  </div>
</body>
</html>`;
}

/** Open a dedicated print window and invoke the browser's native print / Save as PDF dialog. */
export function printBatchProductionRequest(
  view: BatchProductionRequestView,
  openWindow: BatchPrintWindowOpener = () => window.open('', '_blank') as unknown as BatchPrintWindow | null,
): void {
  const printWindow = openWindow();
  if (!printWindow) {
    throw new BatchProductionRequestPrintError(
      'POPUP_BLOCKED',
      'The batch sheet could not be opened. Allow pop-ups for this app, then try printing again.',
    );
  }

  printWindow.document.open();
  printWindow.document.write(renderBatchProductionRequestHtml(view));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}