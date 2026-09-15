import type { PlannedBatchCapacityFeasibilityResult } from '../../application/production/PlannedBatchCapacityFeasibilityService';
import {
  buildFinancialLimiterRows,
  capacityFeasibilityLabel,
  financialReadinessLabel,
  formatBatchMoney,
  formatBatchPercent,
} from './plannedBatchFinancialView';
import './productionFinancial.css';

interface ProductionFinancialSummaryProps {
  result: PlannedBatchCapacityFeasibilityResult | null;
  loading: boolean;
}

export function ProductionFinancialSummary({ result, loading }: ProductionFinancialSummaryProps) {
  const financials = result?.financials ?? null;
  const limiterRows = buildFinancialLimiterRows(result);
  const status = result ? financialReadinessLabel(result.status) : loading ? 'Calculating…' : '—';
  const financialStatus = financials
    ? financialReadinessLabel(financials.status)
    : loading
      ? 'Calculating…'
      : '—';

  return (
    <section className="production-financial-workspace" aria-label="Phase 4 batch financial plan">
      <div className="production-financial-heading">
        <div>
          <p className="panel-kicker">PHASE 4 · BATCH FINANCIAL PLAN</p>
          <h2>Production financial summary &amp; warnings</h2>
          <p>
            Read-only physical batch financials and current feasibility for the unchanged requested quantity.
          </p>
        </div>
        <div className={`production-financial-readiness readiness-${result?.status ?? 'idle'}`}>
          <span>Joined readiness</span>
          <strong>{status}</strong>
          <small>Financials: {financialStatus}</small>
        </div>
      </div>

      <div className="production-financial-grid">
        <article className="panel production-financial-card">
          <span>Planned production cost</span>
          <strong>{formatBatchMoney(financials?.plannedProductionCost)}</strong>
          <small>Physical Phase 4.4A batch cost, including final-batch direct-material rounding.</small>
        </article>
        <article className="panel production-financial-card">
          <span>Expected revenue</span>
          <strong>{formatBatchMoney(financials?.expectedRevenue)}</strong>
          <small>Authoritative selling price × unchanged requested quantity.</small>
        </article>
        <article className="panel production-financial-card">
          <span>Expected profit</span>
          <strong className={financials?.expectedProfit !== null && financials?.expectedProfit !== undefined && financials.expectedProfit < 0 ? 'financial-negative' : ''}>
            {formatBatchMoney(financials?.expectedProfit)}
          </strong>
          <small>Revenue minus physical planned production cost. Negative profit remains visible.</small>
        </article>
        <article className="panel production-financial-card">
          <span>Effective batch margin</span>
          <strong>{formatBatchPercent(financials?.batchMargin)}</strong>
          <small>Unavailable when authoritative expected revenue is zero or unresolved.</small>
        </article>
        <article className="panel production-financial-card">
          <span>Average physical cost per unit</span>
          <strong>{formatBatchMoney(financials?.plannedAverageCostPerFinishedUnit)}</strong>
          <small>Unavailable for a zero-piece request.</small>
        </article>
        <article className="panel production-financial-card">
          <span>Requested quantity</span>
          <strong>{result ? `${result.plannedQuantity} pc` : loading ? 'Calculating…' : '—'}</strong>
          <small>The request is advisory planning input and is never auto-clamped.</small>
        </article>
      </div>

      <div className={`panel production-feasibility-banner feasibility-${result?.feasibility ?? 'idle'}`}>
        <div>
          <span className="panel-kicker">CAPACITY FEASIBILITY</span>
          <strong>{result ? capacityFeasibilityLabel(result.feasibility) : loading ? 'Calculating…' : '—'}</strong>
        </div>
        <div className="production-feasibility-metrics">
          <div><span>Current capacity</span><strong>{result?.currentAssemblyCapacity ?? 'Unavailable'}</strong></div>
          <div><span>Overage</span><strong>{result?.overageQuantity !== null && result?.overageQuantity !== undefined ? `${result.overageQuantity} pc` : 'Unavailable'}</strong></div>
        </div>
      </div>

      <section className="panel production-financial-warning-panel">
        <div className="panel-heading list-heading">
          <div><p className="panel-kicker">CAPACITY WARNINGS</p><h3>Advisories for this request</h3></div>
          <div className="material-count"><strong>{result?.warnings.length ?? 0}</strong><span>warnings</span></div>
        </div>
        {result?.warnings.length ? (
          <div className="production-financial-warnings">
            {result.warnings.map((warning) => (
              <article key={warning.code} className={`production-financial-warning warning-${warning.code.toLocaleLowerCase()}`}>
                <strong>{warning.code.replaceAll('_', ' ')}</strong>
                <span>{warning.message}</span>
              </article>
            ))}
          </div>
        ) : (
          <p className="yield-notice">{loading ? 'Evaluating current capacity warnings…' : 'No Phase 4 capacity warning is currently published.'}</p>
        )}
      </section>

      <section className="panel production-financial-limiter-panel">
        <div className="panel-heading list-heading">
          <div><p className="panel-kicker">AUTHORITATIVE TIED LIMITERS</p><h3>Limiting resources</h3></div>
          <div className="material-count"><strong>{limiterRows.length}</strong><span>tied</span></div>
        </div>
        {limiterRows.length ? (
          <div className="production-financial-limiters">
            {limiterRows.map((row) => (
              <article key={`${row.resourceType}-${row.sourceId}`} className="production-financial-limiter-card">
                <div><span className="component-kind-pill">{row.typeLabel}</span><strong>{row.sourceName}</strong></div>
                <span>Capacity {row.capacityPieces} parent pieces</span>
                <small>{row.evidence}</small>
                <small className="limiter-path">{row.pathLabel}</small>
              </article>
            ))}
          </div>
        ) : (
          <p className="yield-notice">
            {loading
              ? 'Resolving authoritative tied limiting resources…'
              : 'No authoritative top-level limiter set is published for this Phase 4 result.'}
          </p>
        )}
      </section>

      <section className="panel production-financial-issues-panel">
        <div className="panel-heading list-heading">
          <div><p className="panel-kicker">FINANCIAL / FEASIBILITY READINESS</p><h3>Issues to resolve</h3></div>
          <div className="material-count"><strong>{(result?.issues.length ?? 0) + (financials?.issues.length ?? 0)}</strong><span>issues</span></div>
        </div>
        {result && result.issues.length + (financials?.issues.length ?? 0) === 0 ? (
          <div className="production-ready"><strong>Ready</strong><span>No Phase 4 batch-financial or feasibility readiness issue is currently reported.</span></div>
        ) : result ? (
          <ul className="production-issues">
            {result.issues.map((issue) => (
              <li key={`feasibility-${issue.code}`}><strong>{issue.code}</strong><span>{issue.message}</span></li>
            ))}
            {financials?.issues.map((issue) => (
              <li key={`financial-${issue.code}`}><strong>{issue.code}</strong><span>{issue.message}</span></li>
            ))}
          </ul>
        ) : (
          <p className="yield-notice">{loading ? 'Evaluating financial and feasibility readiness…' : 'Select a valid Product and whole planned quantity to calculate Phase 4 evidence.'}</p>
        )}
      </section>
    </section>
  );
}
