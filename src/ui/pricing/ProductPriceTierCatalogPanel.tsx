import type {
  ProductPriceTierQuoteLine,
  ProductPriceTierQuoteResult,
  ProductPriceTierQuoteStatus,
} from '../../application/productPriceTiers/ProductPriceTierQuoteService';
import type {
  ProductPriceTierKind,
  ProductPriceTierPriceBasis,
} from '../../domain/productPriceTiers';
import { formatPercent, formatPhp } from './productPricingQuoteView';

interface ProductPriceTierCatalogPanelProps {
  productName: string | null;
  quote: ProductPriceTierQuoteResult | null;
  loading: boolean;
  error: string | null;
  hasUnsavedChanges?: boolean;
  onRefresh?: () => void;
}

function titleCase(value: string): string {
  return value
    .split('-')
    .map((part) => part.charAt(0).toLocaleUpperCase() + part.slice(1))
    .join(' ');
}

function readinessLabel(status: ProductPriceTierQuoteStatus): string {
  return status === 'not-ready' ? 'Not ready' : titleCase(status);
}

function kindLabel(kind: ProductPriceTierKind): string {
  switch (kind) {
    case 'package':
      return 'Package';
    case 'bulk':
      return 'Bulk';
    case 'custom':
      return 'Custom';
  }
}

function basisLabel(basis: ProductPriceTierPriceBasis): string {
  return basis === 'per-unit' ? 'Per unit' : 'Per offer';
}

function sourcePriceLabel(line: ProductPriceTierQuoteLine): string {
  return line.tier.priceBasis === 'per-unit'
    ? `${formatPhp(line.tier.priceAmount)} / unit`
    : `${formatPhp(line.tier.priceAmount)} / offer`;
}

function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="tier-catalog-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}

function TierCard({ line }: { line: ProductPriceTierQuoteLine }) {
  const economics = line.economics;
  const comparison = line.defaultComparison;

  return (
    <article
      className={`tier-catalog-card ${line.tier.isActive ? '' : 'archived'}`}
      aria-label={`Price tier ${line.tier.name}`}
    >
      <div className="tier-catalog-card-heading">
        <div>
          <div className="tier-catalog-title-line">
            <h3>{line.tier.name}</h3>
            <span className={`status-pill ${line.tier.isActive ? 'status-active' : ''}`}>
              {line.tier.isActive ? 'Active' : 'Archived'}
            </span>
          </div>
          <p>
            <span className="material-id">{line.tier.id}</span>
            <span> · {kindLabel(line.tier.kind)} · {basisLabel(line.tier.priceBasis)}</span>
          </p>
        </div>
        <span className={`pricing-readiness-pill status-${line.status}`}>
          {readinessLabel(line.status)}
        </span>
      </div>

      <div className="tier-catalog-source-grid" aria-label={`${line.tier.name} source terms`}>
        <Metric label="Source price" value={sourcePriceLabel(line)} />
        <Metric label="Units / offer" value={line.tier.unitsPerOffer.toLocaleString('en-PH')} />
        <Metric label="Minimum order" value={`${line.tier.minimumOrderQuantity.toLocaleString('en-PH')} units`} />
        <Metric label="Extra cost / offer" value={formatPhp(line.tier.additionalCostPerOffer)} />
      </div>

      {economics ? (
        <>
          <div className="tier-catalog-economics-grid" aria-label={`${line.tier.name} economics`}>
            <Metric label="Offer cost" value={formatPhp(economics.totalOfferCost)} />
            <Metric label="Offer selling price" value={formatPhp(economics.offerSellingPrice)} />
            <Metric label="Effective unit price" value={formatPhp(economics.effectiveUnitSellingPrice)} />
            <Metric label="Profit / offer" value={formatPhp(economics.profitPerOffer)} />
            <Metric label="Profit / unit" value={formatPhp(economics.effectiveProfitPerUnit)} />
            <Metric label="Effective markup" value={formatPercent(economics.effectiveMarkup)} />
            <Metric label="Effective margin" value={formatPercent(economics.effectiveMargin)} />
          </div>

          {comparison && (
            <div className="tier-catalog-comparison" aria-label={`${line.tier.name} Default pricing comparison`}>
              <div>
                <span>Default equivalent</span>
                <strong>{formatPhp(comparison.defaultEquivalentOfferPrice)}</strong>
              </div>
              <div>
                <span>Tier savings vs Default</span>
                <strong>{formatPhp(comparison.discountAmountVsDefault)}</strong>
              </div>
              <div>
                <span>Savings rate</span>
                <strong>{formatPercent(comparison.discountRateVsDefault)}</strong>
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="tier-catalog-unavailable">
          Authoritative tier economics are unavailable until the selected Product has a ready fully loaded unit cost.
        </p>
      )}

      {line.tier.notes && (
        <p className="tier-catalog-notes"><strong>Notes:</strong> {line.tier.notes}</p>
      )}

      {(line.warnings.length > 0 || line.issues.length > 0) && (
        <div className="tier-catalog-diagnostics">
          {line.warnings.length > 0 && (
            <div className="tier-catalog-warning" role="status">
              <strong>Pricing warning</strong>
              <ul>
                {line.warnings.map((warning) => (
                  <li key={warning.code}>{warning.message}</li>
                ))}
              </ul>
            </div>
          )}
          {line.issues.length > 0 && (
            <div className="tier-catalog-issues">
              <strong>Readiness details</strong>
              <ul>
                {line.issues.map((issue, index) => (
                  <li key={`${issue.code}-${index}`}>{issue.message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export function ProductPriceTierCatalogPanel({
  productName,
  quote,
  loading,
  error,
  hasUnsavedChanges = false,
  onRefresh,
}: ProductPriceTierCatalogPanelProps) {
  const activeCount = quote?.tiers.filter((line) => line.tier.isActive).length ?? 0;
  const archivedCount = quote?.tiers.filter((line) => !line.tier.isActive).length ?? 0;
  const readyCount = quote?.tiers.filter((line) => line.status === 'ready').length ?? 0;

  return (
    <section className="tier-catalog-section" aria-label="Tier pricing catalog">
      <div className="pricing-quote-heading tier-catalog-heading">
        <div>
          <p className="panel-kicker">TIER PRICING</p>
          <h2>Price tier catalog</h2>
          <p>
            Read-only Package, Bulk, and Custom offer economics from the saved tier sources. Default / Single pricing remains separate and no tier is automatically selected for production or orders.
          </p>
        </div>
        <div className="pricing-quote-heading-actions">
          <span className={`pricing-readiness-pill ${quote ? `status-${quote.status}` : ''}`}>
            {loading
              ? 'Loading'
              : quote
                ? readinessLabel(quote.status)
                : error
                  ? 'Not ready'
                  : productName
                    ? 'Waiting for tiers'
                    : 'Select a Product'}
          </span>
          {onRefresh && (
            <button
              className="button button-secondary pricing-refresh-button"
              type="button"
              onClick={onRefresh}
              disabled={loading}
            >
              {error ? 'Retry tier economics' : loading ? 'Refreshing…' : 'Refresh tier economics'}
            </button>
          )}
        </div>
      </div>

      {hasUnsavedChanges && (
        <div className="pricing-unsaved-note" role="status">
          <strong>Unsaved financial changes are not included in tier economics.</strong>
          <span>Save the financial profile first to refresh cost, Default comparison, and tier profitability.</span>
        </div>
      )}

      {error && (
        <div className="feedback feedback-error pricing-quote-feedback" role="status">
          {error}
        </div>
      )}

      <div className="tier-catalog-summary" aria-label="Tier catalog summary">
        <Metric label="Saved tiers" value={(quote?.tiers.length ?? 0).toLocaleString('en-PH')} />
        <Metric label="Active" value={activeCount.toLocaleString('en-PH')} />
        <Metric label="Archived" value={archivedCount.toLocaleString('en-PH')} />
        <Metric label="Economics ready" value={readyCount.toLocaleString('en-PH')} />
        <Metric label="Fully loaded unit cost" value={formatPhp(quote?.totalFullyLoadedUnitCost ?? null)} />
        <Metric label="Default / Single" value={formatPhp(quote?.defaultSellingPrice ?? null)} />
      </div>

      {!quote ? (
        <div className="panel tier-catalog-empty">
          <strong>
            {loading
              ? 'Loading saved tier sources and economics…'
              : productName
                ? 'No tier quote is currently available.'
                : 'Select a Product to inspect its saved price tiers.'}
          </strong>
          <span>
            Tier economics are derived from the same authoritative fully loaded unit cost used by the existing Pricing workspace.
          </span>
        </div>
      ) : quote.tiers.length === 0 ? (
        <div className="panel tier-catalog-empty">
          <strong>No price tiers saved for {productName ?? quote.productName}.</strong>
          <span>
            Default / Single pricing continues to work exactly as before. Tier creation and editing are intentionally outside this read-only phase.
          </span>
        </div>
      ) : (
        <div className="tier-catalog-list">
          {quote.tiers.map((line) => (
            <TierCard key={line.tier.id} line={line} />
          ))}
        </div>
      )}

      {quote && quote.issues.length > 0 && (
        <article className="panel tier-catalog-top-level-issues">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">TIER QUOTE READINESS</p>
              <h3>Shared pricing evidence</h3>
            </div>
            <span className={`pricing-readiness-pill status-${quote.status}`}>
              {readinessLabel(quote.status)}
            </span>
          </div>
          <ul>
            {quote.issues.map((issue, index) => (
              <li key={`${issue.code}-${index}`}>{issue.message}</li>
            ))}
          </ul>
        </article>
      )}
    </section>
  );
}
