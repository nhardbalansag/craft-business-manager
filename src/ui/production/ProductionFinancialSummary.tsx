import type { PlannedBatchCapacityFeasibilityResult } from '../../application/production/PlannedBatchCapacityFeasibilityService';
import { AppIcon } from '../icons/AppIcon';
import { BatchProductionRequestPrintButton } from './BatchProductionRequestPrintButton';
import {
  buildFinancialLimiterRows,
  capacityFeasibilityLabel,
  financialReadinessLabel,
  formatBatchMoney,
  formatBatchPercent,
} from './plannedBatchFinancialView';
import { capacityPlan } from './productionPlanningView';
import './productionFinancial.css';

interface ProductionFinancialSummaryProps {
  result: PlannedBatchCapacityFeasibilityResult | null;
  loading: boolean;
  onPrepare: () => void;
}

const warningLabels: Record<string, string> = {
  OVER_CURRENT_CAPACITY: 'More stock is needed',
  CAPACITY_UNRESOLVED: 'Check your stock setup',
  LIMITING_RESOURCE_EXPLANATION_INCOMPLETE: 'Bottleneck details are incomplete',
};

export function ProductionFinancialSummary({
  result: suppliedResult,
  loading,
  onPrepare,
}: ProductionFinancialSummaryProps) {
  const result = loading ? null : suppliedResult;
  const financials = result?.financials ?? null;
  const limiterRows = buildFinancialLimiterRows(result);
  const capacity = capacityPlan(result);
  const issues = [...(result?.issues ?? []), ...(financials?.issues ?? [])];

  if (!result)
    return (
      <section className="panel production-page-state" aria-label="Batch overview">
        <span className="production-step" aria-hidden="true">
          02
        </span>
        <h2>{loading ? 'Calculating your batch...' : 'Your batch overview will appear here'}</h2>
        <p>
          {loading
            ? 'Checking materials, component stock, and pricing.'
            : 'Choose a product and enter a valid quantity above. If the estimate failed, use Retry estimate.'}
        </p>
      </section>
    );

  return (
    <section className="production-financial-workspace" aria-label="Batch financial plan">
      <section className={`panel production-feasibility-banner feasibility-${result.feasibility}`}>
        <div className="production-feasibility-copy">
          <span className="panel-kicker">CAN YOU MAKE THIS BATCH?</span>
          <h2>{capacityFeasibilityLabel(result.feasibility)}</h2>
          <p>
            {result.feasibility === 'over-current-capacity'
              ? `Your request is ${result.overageQuantity ?? 'an unresolved number of'} pieces above current capacity. Review the preparation list to see what is missing.`
              : result.feasibility === 'within-current-capacity'
                ? 'Current materials and component stock cover this quantity. Review costs and readiness before making.'
                : 'Some stock or recipe information is missing. Review the issues below before relying on this estimate.'}
          </p>
          <button className="button button-primary" type="button" onClick={onPrepare}>
            Review preparation list <AppIcon name="chevron-right" size={16} />
          </button>
        </div>
        <div className="production-capacity-snapshot">
          <div className="production-feasibility-metrics">
            <div>
              <span>Planned pieces</span>
              <strong>{result.plannedQuantity.toLocaleString()}</strong>
            </div>
            <div>
              <span>Current capacity</span>
              <strong>{capacity ? capacity.capacity.toLocaleString() : 'Unavailable'}</strong>
            </div>
          </div>
          {capacity && (
            <>
              <div
                className="production-capacity-track"
                role="img"
                aria-label={`${result.plannedQuantity} pieces requested; current capacity ${capacity.capacity} pieces`}
              >
                <span style={{ width: `${capacity.percentage}%` }} />
              </div>
              <small>
                {result.feasibility === 'over-current-capacity'
                  ? `${result.overageQuantity} more pieces than current stock supports`
                  : `${capacity.remaining.toLocaleString()} pieces of capacity remaining`}
              </small>
            </>
          )}
        </div>
      </section>

      <div className="production-financial-heading">
        <div>
          <p className="panel-kicker">BATCH OUTLOOK</p>
          <h2>Know your numbers</h2>
          <p>Estimates for all {result.plannedQuantity.toLocaleString()} requested pieces.</p>
        </div>
        <div className={`production-financial-readiness readiness-${result.status}`}>
          <span>Estimate readiness</span>
          <strong>{financialReadinessLabel(result.status)}</strong>
          <small>Financials: {financialReadinessLabel(result.financials.status)}</small>
        </div>
      </div>
      {financials?.status !== 'ready' && (
        <p className="production-warning">
          Financial data is incomplete. Available amounts may be partial; resolve the issues below before using them to
          price or plan.
        </p>
      )}
      <div className="production-financial-grid">
        <article className="panel production-financial-card">
          <span>Planned production cost</span>
          <strong>{formatBatchMoney(financials?.plannedProductionCost)}</strong>
          <small>Includes physical batch rounding, labor, and overhead where configured.</small>
        </article>
        <article className="panel production-financial-card">
          <span>Expected revenue</span>
          <strong>{formatBatchMoney(financials?.expectedRevenue)}</strong>
          <small>Selling price times requested pieces.</small>
        </article>
        <article className="panel production-financial-card production-profit-card">
          <span>Expected profit</span>
          <strong
            className={financials?.expectedProfit != null && financials.expectedProfit < 0 ? 'financial-negative' : ''}
          >
            {formatBatchMoney(financials?.expectedProfit)}
          </strong>
          <small>Revenue minus planned production cost.</small>
        </article>
        <article className="panel production-financial-card">
          <span>Effective batch margin</span>
          <strong className={financials?.batchMargin != null && financials.batchMargin < 0 ? 'financial-negative' : ''}>
            {formatBatchPercent(financials?.batchMargin)}
          </strong>
          <small>Profit as a share of revenue; unavailable at zero revenue.</small>
        </article>
      </div>
      <div className="production-unit-summary">
        <span>
          Average cost / finished piece{' '}
          <strong>{formatBatchMoney(financials?.plannedAverageCostPerFinishedUnit)}</strong>
        </span>
        <span>
          Selling price / piece <strong>{formatBatchMoney(financials?.sellingPrice)}</strong>
        </span>
      </div>

      <BatchProductionRequestPrintButton result={result} />

      {result.warnings.length > 0 && (
        <section className="panel production-financial-warning-panel" aria-label="Batch advisories">
          <div className="panel-heading list-heading">
            <div>
              <p className="panel-kicker">BEFORE YOU MAKE</p>
              <h3>Batch advisories</h3>
            </div>
            <div className="material-count">
              <strong>{result.warnings.length}</strong>
              <span>warnings</span>
            </div>
          </div>
          <div className="production-financial-warnings">
            {result.warnings.map((warning) => (
              <article
                key={warning.code}
                className={`production-financial-warning warning-${warning.code.toLocaleLowerCase()}`}
              >
                <strong>{warningLabels[warning.code] ?? warning.code.replaceAll('_', ' ')}</strong>
                <span>{warning.message}</span>
              </article>
            ))}
          </div>
        </section>
      )}

      {limiterRows.length > 0 && (
        <section className="panel production-financial-limiter-panel">
          <div className="panel-heading list-heading">
            <div>
              <p className="panel-kicker">WHAT SETS YOUR CAPACITY</p>
              <h3>Limiting resources</h3>
            </div>
            <div className="material-count">
              <strong>{limiterRows.length}</strong>
              <span>resources</span>
            </div>
          </div>
          <div className="production-financial-limiters">
            {limiterRows.map((row) => (
              <article key={`${row.resourceType}-${row.sourceId}`} className="production-financial-limiter-card">
                <div>
                  <span className="component-kind-pill">{row.typeLabel}</span>
                  <strong>{row.sourceName}</strong>
                </div>
                <span>Supports {row.capacityPieces.toLocaleString()} finished pieces</span>
                <small>{row.evidence}</small>
                <details>
                  <summary>View component path</summary>
                  <small className="limiter-path">{row.pathLabel}</small>
                </details>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="panel production-financial-issues-panel">
        <div className="panel-heading list-heading">
          <div>
            <p className="panel-kicker">ESTIMATE CHECK</p>
            <h3>Issues to resolve</h3>
          </div>
          <div className="material-count">
            <strong>{issues.length}</strong>
            <span>issues</span>
          </div>
        </div>
        {issues.length === 0 ? (
          <div className="production-ready">
            <strong>Estimate is ready</strong>
            <span>
              No financial or capacity readiness issues were reported. Capacity advisories are shown separately above.
            </span>
          </div>
        ) : (
          <ul className="production-issues">
            {issues.map((issue, index) => (
              <li key={`${issue.code}-${index}`}>
                <span>{issue.message}</span>
                <details>
                  <summary>Technical reference</summary>
                  <code>{issue.code}</code>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
