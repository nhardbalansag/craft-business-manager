import type {
  ProductPriceResolutionResult,
  ProductPriceResolutionTierEligibility,
} from '../../application/pricing/ProductPriceResolutionService';
import type { ProductPriceTierQuoteLine } from '../../application/productPriceTiers/ProductPriceTierQuoteService';
import { resolveProductPriceTierPricingSource } from '../../domain/productPriceTiers';
import { formatPhp } from './productPricingQuoteView';

interface ProductPriceResolutionPanelProps {
  productName: string | null;
  quantity: string;
  selectedTierId: string | null;
  result: ProductPriceResolutionResult | null;
  loading: boolean;
  error: string | null;
  hasUnsavedChanges?: boolean;
  onQuantityChange: (value: string) => void;
  onSelectPricingSource: (tierId: string | null) => void;
  onRefresh?: () => void;
  onCreateQuotation?: () => void;
}

function eligibilityFor(
  result: ProductPriceResolutionResult,
  tierId: string,
): ProductPriceResolutionTierEligibility | null {
  const key = tierId.trim().toLowerCase();
  return (
    result.tierEligibility.find(
      (candidate) => candidate.tierId.trim().toLowerCase() === key,
    ) ?? null
  );
}

function tierEconomicsResolvable(line: ProductPriceTierQuoteLine): boolean {
  if (!line.economics) return false;
  if (line.status === 'ready') return true;
  if (line.status !== 'partial') return false;

  return line.issues.every(
    (candidate) =>
      candidate.code === 'DEFAULT_QUOTE_PARTIAL' ||
      candidate.code === 'DEFAULT_QUOTE_NOT_READY',
  );
}

function tierEligibilitySummary(
  line: ProductPriceTierQuoteLine,
  eligibility: ProductPriceResolutionTierEligibility | null,
): {
  selectable: boolean;
  label: string;
  detail: string;
} {
  if (!eligibility) {
    return {
      selectable: false,
      label: 'Check quantity',
      detail: 'Enter a valid whole-unit quantity to evaluate this tier.',
    };
  }

  if (!eligibility.productMatches) {
    return {
      selectable: false,
      label: 'Unavailable',
      detail: 'This tier belongs to a different Product and cannot be selected.',
    };
  }

  if (!eligibility.eligible) {
    return {
      selectable: false,
      label: 'Quantity ineligible',
      detail:
        eligibility.issues.map((issue) => issue.message).join(' ') ||
        'This tier is not eligible for the requested quantity.',
    };
  }

  if (!tierEconomicsResolvable(line)) {
    return {
      selectable: false,
      label: 'Price not ready',
      detail:
        line.issues.map((issue) => issue.message).join(' ') ||
        'Quantity is eligible, but authoritative tier economics are not ready.',
    };
  }

  return {
    selectable: true,
    label: 'Ready to select',
    detail:
      line.tier.priceBasis === 'per-offer'
        ? `${eligibility.offerCount?.toLocaleString('en-PH') ?? '—'} complete offer(s) for this quantity.`
        : 'The requested quantity meets this tier threshold.',
  };
}

function sourcePriceLabel(line: ProductPriceTierQuoteLine): string {
  const source = resolveProductPriceTierPricingSource(line.tier);
  if (source.pricingMethod === 'profit-per-unit') {
    return `${formatPhp(source.pricingValue)} profit / unit`;
  }
  return line.tier.priceBasis === 'per-unit'
    ? `${formatPhp(source.pricingValue)} / unit`
    : `${formatPhp(source.pricingValue)} / ${line.tier.unitsPerOffer.toLocaleString('en-PH')}-unit offer`;
}

function resultSourceLabel(result: ProductPriceResolutionResult): string {
  if (result.mode === 'default') return 'Default / Single';
  return result.selectedTier?.tier.name ?? result.selectedTierId ?? 'Explicit tier';
}

export function ProductPriceResolutionPanel({
  productName,
  quantity,
  selectedTierId,
  result,
  loading,
  error,
  hasUnsavedChanges = false,
  onQuantityChange,
  onSelectPricingSource,
  onRefresh,
  onCreateQuotation,
}: ProductPriceResolutionPanelProps) {
  const tierLines = result?.integratedQuote.tierPricing?.tiers ?? [];
  const headingId = 'pricing-order-preview-heading';

  return (
    <section
      className="pricing-resolution-section"
      aria-labelledby={headingId}
      aria-busy={loading}
    >
      <div className="pricing-quote-heading pricing-resolution-heading">
        <div>
          <p className="panel-kicker">ORDER PRICE PREVIEW</p>
          <h2 id={headingId}>Quantity-aware pricing</h2>
          <p>
            Preview a saved price for a finished-unit quantity. Default / Single
            stays selected unless you manually choose a ready Package, Bulk, or
            Custom tier.
          </p>
        </div>
        <div className="pricing-quote-heading-actions">
          <span
            className={`pricing-readiness-pill ${
              result ? `status-${result.status}` : ''
            }`}
          >
            {loading
              ? 'Resolving…'
              : result
                ? result.status === 'ready'
                  ? 'Ready'
                  : 'Not ready'
                : productName
                  ? 'Waiting for preview'
                  : 'Select a Product'}
          </span>
          {onRefresh && (
            <button
              className="button button-secondary pricing-refresh-button"
              type="button"
              onClick={onRefresh}
              disabled={loading}
            >
              {loading ? 'Refreshing…' : 'Refresh preview'}
            </button>
          )}
          {onCreateQuotation && (
            <button
              className="button button-primary"
              type="button"
              onClick={onCreateQuotation}
              disabled={
                loading ||
                hasUnsavedChanges ||
                result?.status !== 'ready' ||
                result.unitSellingPrice === null ||
                result.totalSellingPrice === null
              }
            >
              Customer quotation
            </button>
          )}
        </div>
      </div>

      <div className="pricing-resolution-boundary-note" role="note">
        <strong>Preview only.</strong>
        <span>
          This manual selection changes only this Pricing workspace preview.
          Production projections continue to use Default / Single pricing.
        </span>
      </div>

      {hasUnsavedChanges && (
        <div className="pricing-unsaved-note" role="status">
          <strong>Unsaved financial changes are not included in this preview.</strong>
          <span>
            Save the financial profile first to refresh Default / Single and tier
            economics.
          </span>
        </div>
      )}

      <div className="panel pricing-resolution-controls">
        <label className="field pricing-resolution-quantity">
          <span>Order quantity (finished units)</span>
          <input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={quantity}
            disabled={!productName}
            onChange={(event) => onQuantityChange(event.target.value)}
            aria-describedby="pricing-resolution-quantity-help"
          />
          <small id="pricing-resolution-quantity-help">
            Use a positive whole-unit count. Per-offer tiers require exact offer
            divisibility.
          </small>
        </label>

        <fieldset
          className="pricing-resolution-sources"
          disabled={!productName || loading}
          aria-label="Pricing source selection"
        >
          <legend>Pricing source</legend>

          <label
            className={`pricing-resolution-option default ${
              selectedTierId === null ? 'selected' : ''
            }`}
          >
            <input
              type="radio"
              name="pricing-resolution-source"
              value="default"
              checked={selectedTierId === null}
              onChange={() => onSelectPricingSource(null)}
            />
            <span className="pricing-resolution-option-main">
              <strong>Default / Single</strong>
              <small>
                Existing authoritative Product selling price. Selected by default.
              </small>
            </span>
            <span className="pricing-resolution-option-meta">
              <strong>
                {formatPhp(result?.integratedQuote.sellingPrice ?? null)} / unit
              </strong>
              <small>Always the fallback source</small>
            </span>
          </label>

          {tierLines.map((line) => {
            const eligibility = result
              ? eligibilityFor(result, line.tier.id)
              : null;
            const state = tierEligibilitySummary(line, eligibility);
            const selected =
              selectedTierId?.trim().toLowerCase() ===
              line.tier.id.trim().toLowerCase();

            return (
              <label
                key={line.tier.id}
                className={`pricing-resolution-option tier ${
                  selected ? 'selected' : ''
                } ${state.selectable ? '' : 'disabled'}`}
              >
                <input
                  type="radio"
                  name="pricing-resolution-source"
                  value={line.tier.id}
                  checked={selected}
                  disabled={!state.selectable && !selected}
                  onChange={() => onSelectPricingSource(line.tier.id)}
                />
                <span className="pricing-resolution-option-main">
                  <span className="pricing-resolution-tier-title">
                    <strong>{line.tier.name}</strong>
                    <span
                      className={`status-pill ${
                        line.tier.isActive ? 'status-active' : ''
                      }`}
                    >
                      {line.tier.isActive ? 'Active' : 'Archived'}
                    </span>
                  </span>
                  <small>
                    {line.tier.id} · Minimum{' '}
                    {line.tier.minimumOrderQuantity.toLocaleString('en-PH')} units
                    {line.tier.priceBasis === 'per-offer'
                      ? ` · ${line.tier.unitsPerOffer.toLocaleString('en-PH')} units / offer`
                      : ''}
                  </small>
                </span>
                <span className="pricing-resolution-option-meta">
                  <strong>{sourcePriceLabel(line)}</strong>
                  <small className={state.selectable ? 'ready' : ''}>
                    {state.label}
                  </small>
                </span>
                <span className="pricing-resolution-option-detail">
                  {state.detail}
                </span>
              </label>
            );
          })}

          {result && tierLines.length === 0 && (
            <p className="pricing-resolution-no-tiers">
              No saved Package, Bulk, or Custom tiers are available. Default /
              Single remains the only pricing source.
            </p>
          )}
        </fieldset>
      </div>

      {error && (
        <div className="feedback feedback-error pricing-quote-feedback" role="alert">
          {error}
        </div>
      )}

      {!result ? (
        <div className="panel pricing-resolution-empty">
          <strong>
            {loading
              ? 'Resolving order pricing…'
              : productName
                ? 'Pricing preview is not available yet.'
                : 'Select a Product to preview quantity-aware pricing.'}
          </strong>
        </div>
      ) : (
        <article
          className={`panel pricing-resolution-result ${
            result.status === 'ready' ? 'ready' : 'not-ready'
          }`}
          aria-label="Resolved order pricing preview"
        >
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">RESOLVED PREVIEW</p>
              <h3>{resultSourceLabel(result)}</h3>
            </div>
            <span
              className={`pricing-readiness-pill status-${result.status}`}
            >
              {result.status === 'ready' ? 'Ready' : 'Not ready'}
            </span>
          </div>

          <div className="pricing-resolution-metrics">
            <div>
              <span>Quantity</span>
              <strong>
                {Number.isFinite(result.quantity)
                  ? result.quantity.toLocaleString('en-PH')
                  : '—'}
              </strong>
              <small>Finished units</small>
            </div>
            <div>
              <span>Offer count</span>
              <strong>
                {result.offerCount === null
                  ? '—'
                  : result.offerCount.toLocaleString('en-PH')}
              </strong>
              <small>
                {result.mode === 'explicit-tier' &&
                result.selectedTier?.tier.priceBasis === 'per-offer'
                  ? 'Complete tier offers'
                  : 'Pricing units'}
              </small>
            </div>
            <div>
              <span>Unit selling price</span>
              <strong>{formatPhp(result.unitSellingPrice)}</strong>
              <small>Effective price per finished unit</small>
            </div>
            <div>
              <span>Order selling price</span>
              <strong>{formatPhp(result.totalSellingPrice)}</strong>
              <small>Resolved total before downstream order concerns</small>
            </div>
          </div>

          {result.warnings.length > 0 && (
            <div
              className="tier-catalog-warning pricing-resolution-warning"
              role="status"
              aria-label="Resolved pricing warnings"
            >
              <strong>Pricing warning</strong>
              <ul>
                {result.warnings.map((warning, index) => (
                  <li key={`${warning.code}-${index}`}>{warning.message}</li>
                ))}
              </ul>
            </div>
          )}

          {result.issues.length > 0 && (
            <div
              className="tier-catalog-issues pricing-resolution-issues"
              role="alert"
              aria-label="Resolved pricing issues"
            >
              <strong>Preview not ready</strong>
              <ul>
                {result.issues.map((issue, index) => (
                  <li key={`${issue.code}-${index}`}>{issue.message}</li>
                ))}
              </ul>
            </div>
          )}
        </article>
      )}
    </section>
  );
}
