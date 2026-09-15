import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  productFinancialProfileService,
  productPricingQuoteService,
  productService,
} from '../../application/session';
import type { ProductPricingQuoteResult } from '../../application/pricing/ProductPricingQuoteService';
import type { ProductFinancialProfile } from '../../domain/productFinancialProfile';
import {
  PRODUCT_CATEGORY_RULES,
  type Product,
} from '../../domain/products';
import { ProductPricingQuotePanel } from './ProductPricingQuotePanel';
import {
  createEmptyProductFinancialProfileForm,
  pricingValueHelp,
  pricingValueLabel,
  productFinancialProfileFormToSource,
  productFinancialProfileToForm,
  type PricingMethodSelection,
  type ProductFinancialProfileFormState,
} from './productFinancialProfileForm';
import './pricing.css';

type ActiveFilter = 'active' | 'archived' | 'all';
type Feedback = { type: 'success' | 'error'; message: string } | null;

function comparable(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please check the financial profile and try again.';
}

function quoteErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'The authoritative unit-economics quote could not be loaded.';
}

function upsertProfileList(
  profiles: readonly ProductFinancialProfile[],
  profile: ProductFinancialProfile,
): ProductFinancialProfile[] {
  const key = comparable(profile.productId);
  return [
    ...profiles.filter((candidate) => comparable(candidate.productId) !== key),
    profile,
  ].sort((left, right) =>
    left.productId.localeCompare(right.productId, undefined, { sensitivity: 'base' }),
  );
}

export function PricingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [profiles, setProfiles] = useState<ProductFinancialProfile[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFinancialProfileFormState>(() =>
    createEmptyProductFinancialProfileForm(),
  );
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ActiveFilter>('active');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [quote, setQuote] = useState<ProductPricingQuoteResult | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const quoteRequestVersion = useRef(0);

  const loadQuote = useCallback(async (productId: string) => {
    const requestVersion = ++quoteRequestVersion.current;
    setQuoteLoading(true);
    setQuoteError(null);
    setQuote(null);

    try {
      const nextQuote = await productPricingQuoteService.quoteProduct(productId);
      if (requestVersion === quoteRequestVersion.current) {
        setQuote(nextQuote);
      }
    } catch (error) {
      if (requestVersion === quoteRequestVersion.current) {
        setQuoteError(quoteErrorMessage(error));
      }
    } finally {
      if (requestVersion === quoteRequestVersion.current) {
        setQuoteLoading(false);
      }
    }
  }, []);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const [nextProducts, nextProfiles] = await Promise.all([
        productService.listProducts(),
        productFinancialProfileService.listProfiles(),
      ]);

      setProducts(nextProducts);
      setProfiles(nextProfiles);

      const initialProduct = nextProducts.find((product) => product.isActive) ?? nextProducts[0] ?? null;
      const initialProfile = initialProduct
        ? nextProfiles.find(
            (profile) => comparable(profile.productId) === comparable(initialProduct.id),
          ) ?? null
        : null;

      setSelectedProductId(initialProduct?.id ?? null);
      setForm(productFinancialProfileToForm(initialProfile));
    } catch (error) {
      setFeedback({ type: 'error', message: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (selectedProductId === null) {
      quoteRequestVersion.current += 1;
      setQuote(null);
      setQuoteLoading(false);
      setQuoteError(null);
      return;
    }

    void loadQuote(selectedProductId);
  }, [loadQuote, selectedProductId]);

  const profileByProductId = useMemo(
    () => new Map(profiles.map((profile) => [comparable(profile.productId), profile])),
    [profiles],
  );

  const visibleProducts = useMemo(() => {
    const normalizedQuery = comparable(query);
    return products.filter((product) => {
      const statusMatches =
        statusFilter === 'all' ||
        (statusFilter === 'active' ? product.isActive : !product.isActive);
      const queryMatches =
        !normalizedQuery ||
        product.id.toLocaleLowerCase().includes(normalizedQuery) ||
        product.name.toLocaleLowerCase().includes(normalizedQuery);
      return statusMatches && queryMatches;
    });
  }, [products, query, statusFilter]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );

  const selectedProfile = selectedProduct
    ? profileByProductId.get(comparable(selectedProduct.id)) ?? null
    : null;

  function selectProduct(product: Product) {
    quoteRequestVersion.current += 1;
    setQuote(null);
    setQuoteError(null);
    setQuoteLoading(true);
    setSelectedProductId(product.id);
    setForm(
      productFinancialProfileToForm(
        profileByProductId.get(comparable(product.id)) ?? null,
      ),
    );
    setFeedback(null);
  }

  function updatePricingMethod(pricingMethod: PricingMethodSelection) {
    setForm((current) => ({
      ...current,
      pricingMethod,
      pricingValue: pricingMethod === current.pricingMethod ? current.pricingValue : '',
    }));
    setFeedback(null);
  }

  async function submitProfile(event: FormEvent) {
    event.preventDefault();
    if (!selectedProduct) return;

    setSaving(true);
    setFeedback(null);
    try {
      const source = productFinancialProfileFormToSource(selectedProduct.id, form);
      await productFinancialProfileService.upsertProfile(source);

      const authoritative = await productFinancialProfileService.getProfile(selectedProduct.id);
      if (!authoritative) {
        throw new Error('Financial profile save completed but the authoritative profile could not be reloaded.');
      }

      setProfiles((current) => upsertProfileList(current, authoritative));
      setForm(productFinancialProfileToForm(authoritative));
      setFeedback({
        type: 'success',
        message: `Financial profile saved for ${selectedProduct.name}.`,
      });
      await loadQuote(selectedProduct.id);
    } catch (error) {
      setFeedback({ type: 'error', message: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  const pricingConfigured = form.pricingMethod !== 'unconfigured';
  const pricingInputMax = form.pricingMethod === 'margin-percent' ? 99.999999 : undefined;
  const editorDisabled = selectedProduct === null || saving;

  return (
    <section className="materials-workspace pricing-workspace">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">PHASE 4 · PRICING</p>
          <h1>Financial profiles</h1>
          <p className="page-lead">
            Configure Product financial source values, then inspect the authoritative fully loaded unit cost and pricing result for the same Product.
          </p>
        </div>
        <div className="session-badge"><span className="status-dot" />Session workspace</div>
      </div>

      <div className="pricing-source-note">
        <strong>Source + derived view.</strong>
        <span>
          The financial profile is editable source data. Unit cost, selling price, profit, markup, and margin below are read-only results from Phase 4 application services.
        </span>
      </div>

      <div className="pricing-layout">
        <section className="panel pricing-catalog-panel" aria-label="Product financial profile catalog">
          <div className="panel-heading pricing-panel-heading">
            <div>
              <p className="panel-kicker">PRODUCT CATALOG</p>
              <h2>Select a Product</h2>
            </div>
            <div className="material-count"><strong>{visibleProducts.length}</strong><span>shown</span></div>
          </div>

          <div className="pricing-filters">
            <label className="field search-field">
              <span>Search Products</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name or Product ID"
              />
            </label>
            <label className="field">
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as ActiveFilter)}
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
                <option value="all">All</option>
              </select>
            </label>
          </div>

          {loading ? (
            <div className="empty-state compact-pricing-empty">
              <div className="empty-icon">₱</div>
              <h3>Loading Products…</h3>
              <p>Reading Product identities and current financial profile source records.</p>
            </div>
          ) : products.length === 0 ? (
            <div className="empty-state compact-pricing-empty">
              <div className="empty-icon">+</div>
              <h3>Create a Product first</h3>
              <p>The Pricing workspace needs a Product identity before financial configuration or unit economics can be inspected.</p>
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className="empty-state compact-pricing-empty">
              <div className="empty-icon">⌕</div>
              <h3>No Products match this view</h3>
              <p>Change the search or status filter. Archived Products remain available under Archived or All.</p>
            </div>
          ) : (
            <div className="pricing-product-list">
              {visibleProducts.map((product) => {
                const profile = profileByProductId.get(comparable(product.id));
                const selected = product.id === selectedProductId;
                return (
                  <button
                    key={product.id}
                    type="button"
                    className={`pricing-product-card ${selected ? 'selected' : ''}`}
                    aria-pressed={selected}
                    onClick={() => selectProduct(product)}
                  >
                    <span className="pricing-product-main">
                      <span className="pricing-product-heading">
                        <strong>{product.name}</strong>
                        <span className={`status-pill ${product.isActive ? 'status-active' : ''}`}>
                          {product.isActive ? 'Active' : 'Archived'}
                        </span>
                      </span>
                      <span className="material-id">{product.id}</span>
                      <small>{PRODUCT_CATEGORY_RULES[product.category].label}</small>
                    </span>
                    <span className={`pricing-profile-pill ${profile ? 'configured' : 'missing'}`}>
                      {profile ? 'Configured' : 'Not configured'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <form className="panel pricing-editor-panel" onSubmit={submitProfile}>
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">FINANCIAL SOURCE</p>
              <h2>{selectedProduct ? selectedProduct.name : 'Select a Product'}</h2>
            </div>
            {selectedProduct && (
              <span className={`status-pill ${selectedProduct.isActive ? 'status-active' : ''}`}>
                {selectedProduct.isActive ? 'Active' : 'Archived'}
              </span>
            )}
          </div>

          <div className={`pricing-profile-state ${selectedProfile ? 'configured' : 'missing'}`}>
            <strong>
              {!selectedProduct
                ? 'No Product selected'
                : selectedProfile
                  ? 'Configured source profile'
                  : 'Not configured'}
            </strong>
            <span>
              {!selectedProduct
                ? 'Select a Product from the catalog before entering or saving financial source values.'
                : selectedProfile
                  ? 'These values are authoritative source inputs. Saving updates the same Product-keyed profile and refreshes unit economics.'
                  : 'No source profile exists yet. Enter labor and overhead explicitly; use 0 only when zero cost is intentional.'}
            </span>
          </div>

          <div className="form-grid pricing-form-grid">
            <label className="field">
              <span>Labor cost per unit (PHP)</span>
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                disabled={editorDisabled}
                value={form.laborCostPerUnit}
                onChange={(event) => {
                  setForm({ ...form, laborCostPerUnit: event.target.value });
                  setFeedback(null);
                }}
                placeholder="0.00"
              />
              <small>Explicit PHP cost for labor required to finish one sellable unit.</small>
            </label>

            <label className="field">
              <span>Overhead cost per unit (PHP)</span>
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                disabled={editorDisabled}
                value={form.overheadCostPerUnit}
                onChange={(event) => {
                  setForm({ ...form, overheadCostPerUnit: event.target.value });
                  setFeedback(null);
                }}
                placeholder="0.00"
              />
              <small>Explicit PHP overhead assigned to one sellable unit.</small>
            </label>

            <label className="field field-wide">
              <span>Pricing method</span>
              <select
                disabled={editorDisabled}
                value={form.pricingMethod}
                onChange={(event) => updatePricingMethod(event.target.value as PricingMethodSelection)}
              >
                <option value="unconfigured">Not configured</option>
                <option value="profit-amount">Fixed profit amount</option>
                <option value="markup-percent">Markup percentage</option>
                <option value="margin-percent">Target margin percentage</option>
              </select>
              <small>
                Pricing may remain unconfigured while labor and overhead are still saved as known source values.
              </small>
            </label>

            <label className="field field-wide">
              <span>{pricingValueLabel(form.pricingMethod)}</span>
              <input
                type="number"
                min="0"
                max={pricingInputMax}
                step="any"
                inputMode="decimal"
                disabled={editorDisabled || !pricingConfigured}
                value={pricingConfigured ? form.pricingValue : ''}
                onChange={(event) => {
                  setForm({ ...form, pricingValue: event.target.value });
                  setFeedback(null);
                }}
                placeholder={form.pricingMethod === 'profit-amount' ? '25.00' : '25'}
              />
              <small>{pricingValueHelp(form.pricingMethod)}</small>
            </label>

            <label className="field field-wide">
              <span>Notes (optional)</span>
              <textarea
                disabled={editorDisabled}
                value={form.notes}
                onChange={(event) => {
                  setForm({ ...form, notes: event.target.value });
                  setFeedback(null);
                }}
                placeholder="Pricing assumptions, packaging notes, or review context"
              />
            </label>
          </div>

          <div className="pricing-unit-guide" aria-label="Financial input units">
            <div><strong>PHP</strong><span>Labor, overhead, and fixed-profit amounts are pesos per finished unit.</span></div>
            <div><strong>%</strong><span>Markup and target-margin inputs are human percentages; the application stores canonical decimal rates.</span></div>
          </div>

          <button className="button button-primary button-full" type="submit" disabled={editorDisabled}>
            {saving ? 'Saving financial profile…' : 'Save financial profile'}
          </button>

          {feedback && (
            <div className={`feedback ${feedback.type === 'error' ? 'feedback-error' : 'feedback-success'}`} role="status">
              {feedback.message}
            </div>
          )}
        </form>
      </div>

      <ProductPricingQuotePanel
        productName={selectedProduct?.name ?? null}
        quote={quote}
        loading={quoteLoading}
        error={quoteError}
      />
    </section>
  );
}
