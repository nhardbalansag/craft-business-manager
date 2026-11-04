import { useDeferredValue, useMemo, useState } from 'react';
import type { BusinessReport } from '../../domain/businessInsights';
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_RULES, type Product } from '../../domain/products';
import { businessMoney, REPORT_CAVEATS } from '../../application/insights/businessDocuments';

export function BusinessOverview({ report, products }: { report: BusinessReport; products: Product[] }) {
  const [query, setQuery] = useState(''), [category, setCategory] = useState('all'), [limit, setLimit] = useState(25);
  const deferred = useDeferredValue(query.trim().toLowerCase().replace(/\s+/g, ' '));
  const categories = useMemo(() => new Map(products.map(p => [p.id, p.category])), [products]);
  const rows = useMemo(() => report.products.filter(p => `${p.name} ${p.productId}`.toLowerCase().replace(/\s+/g, ' ').includes(deferred) &&
    (category === 'all' || categories.get(p.productId) === category)), [report, deferred, category, categories]);
  const m = report.metrics, chart = report.months.slice(-24), max = Math.max(1, ...chart.flatMap(r => [r.sales, r.expenses]));
  const cards: [string, string, string][] = [
    ['Recorded sales', businessMoney(m.sales), `${m.orders} orders · ${m.units} units`],
    ['Sales change', m.growthPercent === null ? 'No baseline' : `${m.growthPercent.toFixed(1)}%`, `Prior period: ${businessMoney(m.previousSales)}`],
    ['Estimated gross profit', businessMoney(m.grossProfit), m.marginPercent === null ? 'Requires complete saved costs' : `${m.marginPercent.toFixed(1)}% estimated margin`],
    ['Operating expenses', businessMoney(m.operatingExpenses), 'Recorded expenses, paid or unpaid'],
    ['Indicative operating result', businessMoney(m.indicativeResult), 'After recorded expenses · before tax'],
    ['Net cash movement', businessMoney(m.cashNet), `${businessMoney(m.cashIn)} in · ${businessMoney(m.cashOut)} out`],
    ['Tracked closing cash', businessMoney(m.closingCash), m.openingCash === null ? 'Set an earlier cash starting point in Profile' : `Opening: ${businessMoney(m.openingCash)}`],
    ['Average order value', businessMoney(m.averageOrder), `${m.repeatCustomers} repeat / ${m.identifiedCustomers} identified customers`],
  ];
  return <>
    {!m.orders && <p className="insights-callout">No saved receipts in this period. Create or import receipt history in Transactions, or change the report dates.</p>}
    <div className="insights-metrics">{cards.map(([label, value, note]) => <article className="insights-metric" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div>
    <section className="panel insights-panel" aria-labelledby="sales-trend-title"><div className="insights-heading"><div><h2 id="sales-trend-title">Sales &amp; expense trends</h2><p className="insights-muted">Monthly totals in PHP · {report.from} to {report.to} · SGT</p></div><div className="insights-legend"><span>● Sales</span><span>● Operating expenses</span></div></div>
      <div className="insights-chart" role="img" aria-label="Monthly sales and operating expenses. Exact amounts are in the trend table below.">
        {chart.map(row => <div className="insights-chart-month" key={row.month} title={`${row.month}: sales ${businessMoney(row.sales)}, expenses ${businessMoney(row.expenses)}`}><div className="insights-bars"><span style={{ height: `${row.sales / max * 100}%` }} /><span style={{ height: `${row.expenses / max * 100}%` }} /></div><small><span className="insights-chart-year">{row.month.slice(2, 5)}</span>{row.month.slice(5)}</small></div>)}
      </div>
      {report.months.length > 24 && <small>The chart shows the latest 24 months; the table includes the full selected period.</small>}
      <details><summary>View monthly figures</summary><div className="insights-table-wrap"><table><caption className="sr-only">Monthly business trends</caption><thead><tr><th>Month</th><th>Sales</th><th>Orders</th><th>Operating expenses</th><th>Net cash movement</th></tr></thead><tbody>{report.months.map(row => <tr key={row.month}><td>{row.month}</td><td>{businessMoney(row.sales)}</td><td>{row.orders}</td><td>{businessMoney(row.expenses)}</td><td>{businessMoney(row.cashNet)}</td></tr>)}</tbody></table></div></details>
    </section>
    <section className="panel insights-panel" aria-labelledby="product-performance-title"><h2 id="product-performance-title">Product performance</h2><p className="insights-muted">Receipt discounts are allocated to product sales. Filters below affect this breakdown; the business totals above cover the whole period.</p>
      <div className="insights-form-grid"><label className="field"><span>Search product performance</span><input type="search" placeholder="e.g. P (1pcs)" value={query} onChange={e => { setQuery(e.target.value); setLimit(25); }} /></label>
        <label className="field"><span>Performance category</span><select value={category} onChange={e => { setCategory(e.target.value); setLimit(25); }}><option value="all">All categories</option>{PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{PRODUCT_CATEGORY_RULES[c].label}</option>)}</select></label></div>
      <div className="insights-table-wrap"><table><thead><tr><th>Product / code</th><th>Units</th><th>Sales after discount</th><th>Saved cost</th><th>Estimated gross profit</th></tr></thead><tbody>{rows.slice(0, limit).map(p => <tr key={p.productId}><td><strong>{p.name}</strong><small>{p.productId}</small></td><td>{p.units}</td><td>{businessMoney(p.sales)}</td><td>{businessMoney(p.savedCost)}</td><td>{businessMoney(p.grossProfit)}</td></tr>)}</tbody></table></div>
      {!rows.length && <p>No products match these filters.</p>}{rows.length > limit && <button type="button" className="button button-secondary" onClick={() => setLimit(limit + 25)}>Show more products</button>}
      <p className="insights-muted">{rows.length} matching products · Balances saved at sale: {businessMoney(m.balanceAtSale)} (historical, not a running receivables balance).</p>
    </section>
    <aside className="insights-callout"><strong>Record coverage</strong><p>{m.orders} receipts · {m.ledgerEntries} ledger entries · {m.unknownCostReceipts} receipts with incomplete cost evidence.</p><p>{REPORT_CAVEATS}</p></aside>
  </>;
}
