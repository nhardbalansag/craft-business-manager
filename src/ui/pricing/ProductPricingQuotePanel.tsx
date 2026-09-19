import type { ProductPricingQuoteResult } from '../../application/pricing/ProductPricingQuoteService';
import type {
  MaterialComponentTraceRow,
  ProductComponentTraceNode,
} from './productPricingQuoteView';
import {
  buildProductComponentTrace,
  formatPercent,
  formatPhp,
  formatPricingPolicyValue,
  materialComponentTraceRows,
  pricingPolicyLabel,
  quoteReadinessLabel,
} from './productPricingQuoteView';

interface ProductPricingQuotePanelProps {
  productName: string | null;
  quote: ProductPricingQuoteResult | null;
  loading: boolean;
  error: string | null;
  hasUnsavedChanges?: boolean;
  onRefresh?: () => void;
}

function roleLabel(role: string): string {
  return role
    .split('-')
    .map((part) => part.charAt(0).toLocaleUpperCase() + part.slice(1))
    .join(' ');
}

function statusLabel(status: string): string {
  return status
    .split('-')
    .map((part) => part.charAt(0).toLocaleUpperCase() + part.slice(1))
    .join(' ');
}

function MaterialComponentRow({ row }: { row: MaterialComponentTraceRow }) {
  return (
    <div className="pricing-component-line">
      <div>
        <strong>{row.sourceMaterialName ?? row.sourceMaterialId}</strong>
        <small>
          {row.sourceMaterialId} · {roleLabel(row.role)} · {row.quantityPerParent} pc per parent
        </small>
      </div>
      <div className="pricing-component-line-values">
        <span>{formatPhp(row.costPerPc)} / pc</span>
        <strong>{formatPhp(row.componentCostContribution)}</strong>
      </div>
      {row.issues.length > 0 && (
        <ul className="pricing-inline-issues">
          {row.issues.map((issue, index) => <li key={`${row.componentId}-issue-${index}`}>{issue}</li>)}
        </ul>
      )}
    </div>
  );
}

function ProductComponentTraceCard({ node }: { node: ProductComponentTraceNode }) {
  const directBase =
    node.childDirectMaterialMode === 'neutral-component-only'
      ? 'None — component-only'
      : formatPhp(node.baseDirectMaterialCostPerUnit);
  const safetyReserve =
    node.childDirectMaterialMode === 'neutral-component-only'
      ? 'None — component-only'
      : formatPhp(node.safetyWasteReserveCostPerUnit);

  return (
    <details className="pricing-component-trace" open={false}>
      <summary>
        <span className="pricing-trace-title">
          <strong>{node.childProductName ?? node.childProductId}</strong>
          <small>
            {node.childProductId} · {roleLabel(node.role)} · {node.quantityPerParent} pc per parent
          </small>
        </span>
        <span className="pricing-trace-summary-values">
          <span className={`pricing-readiness-pill status-${node.status}`}>{statusLabel(node.status)}</span>
          <strong>{formatPhp(node.componentCostContribution)}</strong>
        </span>
      </summary>

      <div className="pricing-trace-body">
        <p className="pricing-trace-path"><strong>Path:</strong> {node.path.join(' → ')}</p>

        <dl className="pricing-mini-cost-grid">
          <div><dt>Direct materials</dt><dd>{directBase}</dd></div>
          <div><dt>Safety reserve</dt><dd>{safetyReserve}</dd></div>
          <div><dt>Purchased components</dt><dd>{formatPhp(node.materialComponentCostSubtotal)}</dd></div>
          <div><dt>Handmade components</dt><dd>{formatPhp(node.productComponentCostSubtotal)}</dd></div>
          <div><dt>Labor</dt><dd>{formatPhp(node.laborCostPerUnit)}</dd></div>
          <div><dt>Overhead</dt><dd>{formatPhp(node.overheadCostPerUnit)}</dd></div>
          <div><dt>Known child subtotal</dt><dd>{formatPhp(node.knownChildProductionCostSubtotal)}</dd></div>
          <div><dt>Child unit cost</dt><dd>{formatPhp(node.childFullyLoadedUnitCost)}</dd></div>
          <div><dt>Known parent contribution</dt><dd>{formatPhp(node.knownComponentCostContribution)}</dd></div>
          <div><dt>Parent contribution</dt><dd>{formatPhp(node.componentCostContribution)}</dd></div>
        </dl>

        {node.materialComponents.length > 0 && (
          <div className="pricing-trace-group">
            <h5>Purchased components inside this Product</h5>
            <div className="pricing-component-lines">
              {node.materialComponents.map((row) => (
                <MaterialComponentRow key={row.componentId} row={row} />
              ))}
            </div>
          </div>
        )}

        {node.children.length > 0 && (
          <div className="pricing-trace-group">
            <h5>Nested handmade Product components</h5>
            <div className="pricing-component-trace-list nested">
              {node.children.map((child) => (
                <ProductComponentTraceCard key={`${child.componentId}-${child.path.join('/')}`} node={child} />
              ))}
            </div>
          </div>
        )}

        {node.issues.length > 0 && (
          <div className="pricing-trace-group pricing-trace-issues">
            <h5>Component issues</h5>
            <ul>
              {node.issues.map((issue, index) => <li key={`${node.componentId}-issue-${index}`}>{issue}</li>)}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}

function CostValueRow({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="pricing-summary-row">
      <div><strong>{label}</strong>{note && <small>{note}</small>}</div>
      <span>{value}</span>
    </div>
  );
}

export function ProductPricingQuotePanel({
  productName,
  quote,
  loading,
  error,
  hasUnsavedChanges = false,
  onRefresh,
}: ProductPricingQuotePanelProps) {
  const cost = quote?.fullyLoadedUnitCost ?? null;
  const direct = cost?.directMaterialCost ?? null;
  const purchasedComponents = cost ? materialComponentTraceRows(cost.componentLines) : [];
  const handmadeComponents = cost ? buildProductComponentTrace(cost.componentLines) : [];

  const readiness = loading
    ? 'Loading'
    : quote
      ? quoteReadinessLabel(quote.status)
      : error
        ? 'Not ready'
        : productName
          ? 'Waiting for quote'
          : 'Select a Product';

  const directBaseValue = cost?.directMaterialMode === 'neutral-component-only'
    ? 'None — component-only'
    : formatPhp(direct?.baseDirectMaterialCostSubtotal ?? null);
  const safetyReserveValue = cost?.directMaterialMode === 'neutral-component-only'
    ? 'None — component-only'
    : formatPhp(direct?.safetyWasteReserveCostSubtotal ?? null);
  const safetyReserveNote = direct
    ? `${formatPercent(direct.safetyWasteRate)} configured safety waste`
    : cost?.directMaterialMode === 'neutral-component-only'
      ? 'No direct material requirements for this component-only Product.'
      : undefined;

  const issueCount = quote
    ? quote.issues.length + (cost?.issues.length ?? 0) + (direct?.issues.length ?? 0)
    : 0;

  return (
    <section className="pricing-quote-section" aria-label="Unit economics pricing calculator">
      <div className="pricing-quote-heading">
        <div>
          <p className="panel-kicker">UNIT ECONOMICS</p>
          <h2>Saved pricing result</h2>
          <p>
            Read-only fully loaded cost and selling-price evidence from the authoritative Phase 4 pricing quote service.
          </p>
        </div>
        <div className="pricing-quote-heading-actions">
          <span className={`pricing-readiness-pill ${quote ? `status-${quote.status}` : ''}`}>{readiness}</span>
          {onRefresh && (
            <button className="button button-secondary pricing-refresh-button" type="button" onClick={onRefresh} disabled={loading}>
              {error ? 'Retry quote' : loading ? 'Refreshing…' : 'Refresh saved quote'}
            </button>
          )}
        </div>
      </div>

      {hasUnsavedChanges && (
        <div className="pricing-unsaved-note" role="status">
          <strong>Unsaved financial changes are not included below.</strong>
          <span>Save the financial profile first to refresh the authoritative unit-economics result.</span>
        </div>
      )}

      {error && <div className="feedback feedback-error pricing-quote-feedback" role="status">{error}</div>}

      <div className="pricing-hero-metrics" aria-label="Pricing result summary">
        <div><span>Total unit cost</span><strong>{formatPhp(quote?.totalFullyLoadedUnitCost ?? null)}</strong><small>Fully loaded cost per sellable unit</small></div>
        <div><span>Selling price</span><strong>{formatPhp(quote?.sellingPrice ?? null)}</strong><small>{pricingPolicyLabel(quote?.pricingPolicy ?? null)}</small></div>
        <div><span>Profit / unit</span><strong>{formatPhp(quote?.profitPerUnit ?? null)}</strong><small>After fully loaded unit cost</small></div>
        <div><span>Effective margin</span><strong>{formatPercent(quote?.effectiveMargin ?? null)}</strong><small>{issueCount} readiness issue{issueCount === 1 ? '' : 's'}</small></div>
      </div>

      <div className="pricing-quote-grid">
        <article className="panel pricing-quote-panel">
          <div className="panel-heading">
            <div><p className="panel-kicker">COST COMPOSITION</p><h3>{productName ?? 'Selected Product'}</h3></div>
            {quote && <span className={`pricing-readiness-pill status-${quote.costStatus}`}>{statusLabel(quote.costStatus)}</span>}
          </div>

          <div className="pricing-summary-list">
            <CostValueRow label="Direct materials" value={directBaseValue} />
            <CostValueRow label="Safety reserve" value={safetyReserveValue} note={safetyReserveNote} />
            <CostValueRow label="Purchased components" value={formatPhp(cost?.materialComponentCostSubtotal ?? null)} />
            <CostValueRow label="Handmade Product components" value={formatPhp(cost?.productComponentCostSubtotal ?? null)} />
            <CostValueRow label="Labor" value={formatPhp(cost?.laborCostPerUnit ?? null)} />
            <CostValueRow label="Overhead" value={formatPhp(cost?.overheadCostPerUnit ?? null)} />
            <CostValueRow
              label="Known cost subtotal"
              value={formatPhp(quote?.knownFullyLoadedUnitCostSubtotal ?? null)}
              note="Useful partial evidence only; never used as a substitute for an unresolved final total."
            />
            <CostValueRow label="Total unit cost" value={formatPhp(quote?.totalFullyLoadedUnitCost ?? null)} />
          </div>
        </article>

        <article className="panel pricing-quote-panel">
          <div className="panel-heading">
            <div><p className="panel-kicker">PRICING RESULT</p><h3>Selling price & profit</h3></div>
            {quote && <span className={`pricing-readiness-pill status-${quote.metricsStatus}`}>{statusLabel(quote.metricsStatus)}</span>}
          </div>

          <div className="pricing-summary-list">
            <CostValueRow label="Pricing policy" value={pricingPolicyLabel(quote?.pricingPolicy ?? null)} />
            <CostValueRow label="Policy value" value={formatPricingPolicyValue(quote?.pricingPolicy ?? null)} />
            <CostValueRow label="Selling price" value={formatPhp(quote?.sellingPrice ?? null)} />
            <CostValueRow label="Profit per unit" value={formatPhp(quote?.profitPerUnit ?? null)} />
            <CostValueRow label="Effective markup" value={formatPercent(quote?.effectiveMarkup ?? null)} />
            <CostValueRow label="Effective margin" value={formatPercent(quote?.effectiveMargin ?? null)} />
          </div>

          <div className="pricing-status-strip">
            <div><span>Quote</span><strong>{quote ? quoteReadinessLabel(quote.status) : 'Unavailable'}</strong></div>
            <div><span>Selling price</span><strong>{quote ? statusLabel(quote.sellingPriceStatus) : 'Unavailable'}</strong></div>
            <div><span>Metrics</span><strong>{quote ? statusLabel(quote.metricsStatus) : 'Unavailable'}</strong></div>
          </div>
        </article>
      </div>

      <details className="pricing-technical-details">
        <summary>
          <span><strong>Cost trace details</strong><small>Purchased and handmade component evidence</small></span>
          <span>{purchasedComponents.length + handmadeComponents.length} root line{purchasedComponents.length + handmadeComponents.length === 1 ? '' : 's'}</span>
        </summary>
        <div className="pricing-detail-grid">
          <article className="panel pricing-detail-panel">
            <div className="panel-heading">
              <div><p className="panel-kicker">PURCHASED COMPONENTS</p><h3>Material-backed component cost</h3></div>
              <span className="material-count"><strong>{purchasedComponents.length}</strong><span>lines</span></span>
            </div>
            {purchasedComponents.length === 0 ? (
              <p className="pricing-detail-empty">No root Material-backed component cost lines are available for this quote.</p>
            ) : (
              <div className="pricing-component-lines">
                {purchasedComponents.map((row) => <MaterialComponentRow key={row.componentId} row={row} />)}
              </div>
            )}
          </article>

          <article className="panel pricing-detail-panel">
            <div className="panel-heading">
              <div><p className="panel-kicker">HANDMADE PRODUCT COMPONENTS</p><h3>Nested fully loaded cost paths</h3></div>
              <span className="material-count"><strong>{handmadeComponents.length}</strong><span>root lines</span></span>
            </div>
            {handmadeComponents.length === 0 ? (
              <p className="pricing-detail-empty">No root handmade Product-component cost paths are available for this quote.</p>
            ) : (
              <div className="pricing-component-trace-list">
                {handmadeComponents.map((node) => (
                  <ProductComponentTraceCard key={`${node.componentId}-${node.path.join('/')}`} node={node} />
                ))}
              </div>
            )}
          </article>
        </div>
      </details>

      <article className="panel pricing-issues-panel">
        <div className="panel-heading">
          <div><p className="panel-kicker">READINESS & ISSUES</p><h3>{issueCount > 0 ? 'What needs attention' : 'Pricing readiness'}</h3></div>
          {quote && <span className={`pricing-readiness-pill status-${quote.status}`}>{quoteReadinessLabel(quote.status)}</span>}
        </div>

        {!quote ? (
          <p className="pricing-detail-empty">
            {loading
              ? 'Loading authoritative pricing quote evidence…'
              : productName
                ? 'No quote evidence is currently available.'
                : 'Select a Product to inspect quote readiness and issues.'}
          </p>
        ) : issueCount === 0 ? (
          <div className="pricing-ready-message">
            <strong>No readiness issues found.</strong>
            <span>The saved quote has no top-level pricing, fully loaded cost, or direct-material issues.</span>
          </div>
        ) : (
          <div className="pricing-issues-columns">
            <div>
              <h4>Pricing quote</h4>
              {quote.issues.length === 0 ? <p>No top-level quote issues.</p> : (
                <ul>{quote.issues.map((issue, index) => <li key={`quote-${issue.code}-${index}`}>{issue.message}</li>)}</ul>
              )}
            </div>
            <div>
              <h4>Fully loaded cost</h4>
              {cost?.issues.length ? (
                <ul>{cost.issues.map((issue, index) => <li key={`cost-${issue.code}-${index}`}>{issue.message}</li>)}</ul>
              ) : <p>No top-level fully loaded cost issues.</p>}
            </div>
            <div>
              <h4>Direct materials</h4>
              {direct?.issues.length ? (
                <ul>{direct.issues.map((issue, index) => <li key={`direct-${issue.code}-${index}`}>{issue.message}</li>)}</ul>
              ) : <p>No direct-material issues.</p>}
            </div>
          </div>
        )}
      </article>
    </section>
  );
}
