import type { MultiProductionSummary, MultiProductionEntry } from './multiProductionSummary';

const esc = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const num = (n: number) => n.toLocaleString('en-PH', { maximumFractionDigits: 4 });

export function renderMultiProductionSheet(
  entries: readonly MultiProductionEntry[],
  summary: MultiProductionSummary,
): string {
  const products = entries.map((entry) => `<tr><td>${esc(entry.product.name)}</td><td>${esc(entry.product.id)}</td><td class="right">${num(entry.quantity)}</td><td>${esc(entry.plan?.status ?? 'Unavailable')}</td></tr>`).join('');
  const table = (rows: MultiProductionSummary['directMaterials']) =>
    rows.length ? rows.map((row) => `<tr><td>${esc(row.name)}</td><td class="right">${num(row.required)} ${esc(row.unit)}</td><td class="right">${row.available === null ? 'Unresolved' : `${num(row.available)} ${esc(row.unit)}`}</td><td class="right">${row.shortage === null ? 'Check stock' : `${num(row.shortage)} ${esc(row.unit)}`}</td></tr>`).join('')
      : '<tr><td colspan="4">No derivable requirements.</td></tr>';
  const groups = summary.mixtureGroups.map((group, idx) => `<section>
    <h3>Mixture group ${idx + 1}</h3>
    <p>${group.products.map((product) => `${esc(product.name)} (${num(product.quantity)} pcs, ${num(product.pours)} pours using ${esc(product.moldName)})`).join(' · ')}</p>
    <p><strong>${num(group.totalMixtureGrams)} g total mixture</strong> · ${num(group.requiredPours)} combined complete pours</p>
    <table><thead><tr><th>Role</th><th>Material</th><th class="right">Required</th></tr></thead>
    <tbody>${group.materials.map((line) => `<tr><td>${esc(line.role)}</td><td>${esc(line.name)}</td><td class="right">${num(line.grams)} g</td></tr>`).join('')}</tbody></table>
  </section>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Multi-product production batch</title>
  <style>
    @page { size: A4; margin: 13mm; }
    body { font: 10pt Arial, sans-serif; color: #222; }
    h1 { font-size: 19pt; border-bottom: 2px solid #222; padding-bottom: 4mm; }
    h2 { margin-top: 7mm; font-size: 12pt; }
    h3 { font-size: 10.5pt; margin-bottom: 1mm; }
    p { line-height: 1.45; }
    table { border-collapse: collapse; width: 100%; margin-top: 3mm; }
    th,td { border-bottom: 1px solid #ddd; padding: 2.2mm; text-align: left; }
    th { background: #eee; }
    tr { break-inside: avoid; }
    section { break-inside: avoid; }
    .right { text-align: right; }
    .note { padding: 3mm; background: #f5f1e8; }
    .screen-only { margin-bottom: 5mm; }
    @media print { .screen-only { display:none; } }
  </style></head><body>
  <p class="screen-only">Use Print or Save as PDF. Turn off browser headers and footers if needed.</p>
  <h1>Multi-product production batch</h1>
  <p>Generated: ${esc(new Date().toLocaleString('en-PH'))} · ${summary.products} Products · ${num(summary.finishedPieces)} finished pieces</p>
  <p class="note">Planning snapshot only. Nothing is reserved or deducted. Authoritative Product/Yield requirements include safety waste; theoretical Mold Formula mixtures do not. These two sets of quantities must NOT be added together.</p>
  <h2>Products to make</h2>
  <table><thead><tr><th>Product</th><th>ID</th><th class="right">Pieces</th><th>Recipe readiness</th></tr></thead><tbody>${products}</tbody></table>
  <h2>Total direct materials — combined Product/Yield requirements</h2>
  <table><thead><tr><th>Material</th><th class="right">Needed</th><th class="right">Stock</th><th class="right">Shortage</th></tr></thead><tbody>${table(summary.directMaterials)}</tbody></table>
  <h2>Compatible Mold Formula mixing groups</h2>
  <p>Separate groups must not be mixed. Complete-pour rounding is calculated independently for each Mold.</p>
  ${groups || '<p>No Mold Formula selected. This is not evidence that a mixture is unnecessary.</p>'}
  <h2>Theoretical Mold Formula material purchasing totals</h2>
  <p><strong>Combined theoretical mixture: ${num(summary.formulaMixtureGrams)} g</strong>. These stock totals include each Material only once.</p>
  <table><thead><tr><th>Material</th><th class="right">Needed</th><th class="right">Stock</th><th class="right">Shortage</th></tr></thead><tbody>${table(summary.formulaMaterials)}</tbody></table>
  ${summary.warnings.length ? `<h2>Unresolved inputs / warnings</h2><ul>${summary.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul>` : ''}
  </body></html>`;
}

export function printMultiProductionSheet(
  entries: readonly MultiProductionEntry[],
  summary: MultiProductionSummary,
  openWindow: () => Window | null = () => window.open('', '_blank'),
): void {
  const printable = openWindow();
  if (!printable) throw new Error('Print window blocked. Allow pop-ups and try again.');
  printable.document.open();
  printable.document.write(renderMultiProductionSheet(entries, summary));
  printable.document.close();
  printable.focus();
  printable.print();
}
