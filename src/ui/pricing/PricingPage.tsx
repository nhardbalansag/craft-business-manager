import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  productFinancialProfileService,
  productPriceTierQuoteService,
  productPriceTierService,
  productPricingQuoteService,
  productService,
} from '../../application/session';
import type { ProductPricingQuoteResult } from '../../application/pricing/ProductPricingQuoteService';
import type { ProductPriceTierQuoteResult } from '../../application/productPriceTiers/ProductPriceTierQuoteService';
import type { ProductPriceTier } from '../../domain/productPriceTiers';
import type { ProductFinancialProfile } from '../../domain/productFinancialProfile';
import {
  PRODUCT_CATEGORY_RULES,
  type Product,
} from '../../domain/products';
import { ProductPricingQuotePanel } from './ProductPricingQuotePanel';
import { ProductPriceTierCatalogPanel } from './ProductPriceTierCatalogPanel';
import {
  ProductPriceTierEditorPanel,
  type ProductPriceTierEditorValue,
} from './ProductPriceTierEditorPanel';
import {
  createEmptyProductFinancialProfileForm,
  pricingValueHelp,
  pricingValueLabel,
  productFinancialProfileFormToSource,
  productFinancialProfileToForm,
  type PricingMethodSelection,
  type ProductFinancialProfileFormState,
} from './productFinancialProfileForm';
import { formatPhp, pricingPolicyLabel } from './productPricingQuoteView';
import { AppIcon } from '../icons/AppIcon';
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

function tierQuoteErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'The saved price-tier economics could not be loaded.';
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

function parseDraftAmount(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function isPricingValueReady(form: ProductFinancialProfileFormState): boolean {
  if (form.pricingMethod === 'unconfigured') return true;
  const value = parseDraftAmount(form.pricingValue);
  if (value === null) return false;
  return form.pricingMethod !== 'margin-percent' || value < 100;
}

function pricingMethodSummary(form: ProductFinancialProfileFormState): string {
  if (form.pricingMethod === 'unconfigured') return 'Selling-price policy not configured';
  if (!form.pricingValue.trim()) return 'Pricing value still required';
  if (form.pricingMethod === 'profit-amount') return `Fixed profit · PHP ${form.pricingValue}`;
  return `${form.pricingMethod === 'markup-percent' ? 'Markup' : 'Target margin'} · ${form.pricingValue}%`;
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
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [quote, setQuote] = useState<ProductPricingQuoteResult | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [tierQuote, setTierQuote] = useState<ProductPriceTierQuoteResult | null>(null);
  const [tierQuoteLoading, setTierQuoteLoading] = useState(false);
  const [tierQuoteError, setTierQuoteError] = useState<string | null>(null);
  const [tierEditorOpen, setTierEditorOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<ProductPriceTier | null>(null);
  const [tierSaving, setTierSaving] = useState(false);
  const [archivingTierId, setArchivingTierId] = useState<string | null>(null);
  const [tierMutationError, setTierMutationError] = useState<string | null>(null);
  const [tierMutationFeedback, setTierMutationFeedback] = useState<string | null>(null);
  const quoteRequestVersion = useRef(0);
  const tierQuoteRequestVersion = useRef(0);

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

  const loadTierQuote = useCallback(async (productId: string) => {
    const requestVersion = ++tierQuoteRequestVersion.current;
    setTierQuoteLoading(true);
    setTierQuoteError(null);
    setTierQuote(null);

    try {
      const nextQuote = await productPriceTierQuoteService.quoteProduct(productId);
      if (requestVersion === tierQuoteRequestVersion.current) {
        setTierQuote(nextQuote);
      }
    } catch (error) {
      if (requestVersion === tierQuoteRequestVersion.current) {
        setTierQuoteError(tierQuoteErrorMessage(error));
      }
    } finally {
      if (requestVersion === tierQuoteRequestVersion.current) {
        setTierQuoteLoading(false);
      }
    }
  }, []);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setWorkspaceError(null);
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
      setWorkspaceError(errorMessage(error));
      setProducts([]);
      setProfiles([]);
      setSelectedProductId(null);
      setForm(createEmptyProductFinancialProfileForm());
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
      tierQuoteRequestVersion.current += 1;
      setQuote(null);
      setQuoteLoading(false);
      setQuoteError(null);
      setTierQuote(null);
      setTierQuoteLoading(false);
      setTierQuoteError(null);
      return;
    }

    void loadQuote(selectedProductId);
    void loadTierQuote(selectedProductId);
  }, [loadQuote, loadTierQuote, selectedProductId]);

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

  const savedForm = useMemo(
    () => productFinancialProfileToForm(selectedProfile),
    [selectedProfile],
  );

  const formDirty = selectedProduct !== null && JSON.stringify(form) !== JSON.stringify(savedForm);
  const laborDraft = parseDraftAmount(form.laborCostPerUnit);
  const overheadDraft = parseDraftAmount(form.overheadCostPerUnit);
  const draftReady =
    selectedProduct !== null &&
    laborDraft !== null &&
    overheadDraft !== null &&
    isPricingValueReady(form);
  const operatingAddition =
    laborDraft !== null && overheadDraft !== null ? laborDraft + overheadDraft : null;

  const activeCount = products.filter((product) => product.isActive).length;
  const configuredCount = products.filter((product) => profileByProductId.has(comparable(product.id))).length;
  const unconfiguredCount = Math.max(products.length - configuredCount, 0);

  function selectProduct(product: Product) {
    quoteRequestVersion.current += 1;
    tierQuoteRequestVersion.current += 1;
    setQuote(null);
    setQuoteError(null);
    setQuoteLoading(true);
    setTierQuote(null);
    setTierQuoteError(null);
    setTierQuoteLoading(true);
    setSelectedProductId(product.id);
    setForm(
      productFinancialProfileToForm(
        profileByProductId.get(comparable(product.id)) ?? null,
      ),
    );
    setFeedback(null);
    setTierEditorOpen(false);
    setEditingTier(null);
    setTierMutationError(null);
    setTierMutationFeedback(null);
  }

  function updatePricingMethod(pricingMethod: PricingMethodSelection) {
    setForm((current) => ({
      ...current,
      pricingMethod,
      pricingValue: pricingMethod === current.pricingMethod ? current.pricingValue : '',
    }));
    setFeedback(null);
  }

  function resetDraft() {
    setForm(savedForm);
    setFeedback(null);
  }

  async function submitProfile(event: FormEvent) {
    event.preventDefault();
    if (!selectedProduct || !draftReady) return;

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
      await Promise.all([
        loadQuote(selectedProduct.id),
        loadTierQuote(selectedProduct.id),
      ]);
    } catch (error) {
      setFeedback({ type: 'error', message: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  }


  function startCreateTier() {
    if (!selectedProduct?.isActive) return;
    setEditingTier(null);
    setTierMutationError(null);
    setTierMutationFeedback(null);
    setTierEditorOpen(true);
  }

  function startEditTier(tier: ProductPriceTier) {
    setEditingTier(tier);
    setTierMutationError(null);
    setTierMutationFeedback(null);
    setTierEditorOpen(true);
  }

  function closeTierEditor() {
    if (tierSaving) return;
    setTierEditorOpen(false);
    setEditingTier(null);
    setTierMutationError(null);
  }

  async function submitTier(value: ProductPriceTierEditorValue) {
    if (!selectedProduct) return;

    setTierSaving(true);
    setTierMutationError(null);
    setTierMutationFeedback(null);
    try {
      const saved = editingTier
        ? await productPriceTierService.updateTier(editingTier.id, {
            productId: selectedProduct.id,
            ...value,
            isActive: editingTier.isActive,
          })
        : await productPriceTierService.createTier({
            productId: selectedProduct.id,
            ...value,
            isActive: true,
          });

      setTierEditorOpen(false);
      setEditingTier(null);
      setTierMutationFeedback(
        editingTier
          ? `Price tier ${saved.name} updated.`
          : `Price tier ${saved.name} created as ${saved.id}.`,
      );
      await loadTierQuote(selectedProduct.id);
    } catch (error) {
      setTierMutationError(
        error instanceof Error ? error.message : 'The price tier could not be saved.',
      );
    } finally {
      setTierSaving(false);
    }
  }

  async function archiveTier(tier: ProductPriceTier) {
    if (!selectedProduct) return;

    setArchivingTierId(tier.id);
    setTierMutationError(null);
    setTierMutationFeedback(null);
    try {
      const archived = await productPriceTierService.archiveTier(tier.id);
      if (editingTier?.id === archived.id) {
        setTierEditorOpen(false);
        setEditingTier(null);
      }
      setTierMutationFeedback(`Price tier ${archived.name} archived.`);
      await loadTierQuote(selectedProduct.id);
    } catch (error) {
      setTierMutationError(
        error instanceof Error ? error.message : 'The price tier could not be archived.',
      );
    } finally {
      setArchivingTierId(null);
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
          <h1>Pricing & unit economics</h1>
          <p className="page-lead">
            Set the financial inputs you control, then review the saved fully loaded unit cost, selling price, profit, markup, and margin for each Product.
          </p>
        </div>
        <div className="session-badge"><span className="status-dot" />Included in workbook exports</div>
      </div>

      <div className="pricing-source-note">
        <strong>Source + derived view.</strong>
        <span>
          Labor, overhead, pricing policy, and notes are editable source data. The unit-economics result is read-only and always comes from the saved authoritative Product state.
        </span>
      </div>

      <section className="pricing-workflow" aria-label="Pricing workflow">
        <div className={selectedProduct ? 'complete' : 'current'}>
          <span>1</span>
          <div><strong>Choose the product</strong><small>Find the Product you want to price.</small></div>
        </div>
        <div className={selectedProduct ? 'current' : ''}>
          <span>2</span>
          <div><strong>Set financial inputs</strong><small>Enter labor, overhead, and an optional selling-price policy.</small></div>
        </div>
        <div className={selectedProduct && !formDirty ? 'current' : ''}>
          <span>3</span>
          <div><strong>Review saved unit economics</strong><small>Inspect cost, selling price, profit, and readiness issues.</small></div>
        </div>
      </section>

      <div className="pricing-overview" aria-label="Pricing catalog summary">
        <div><span>Products</span><strong>{products.length}</strong><small>{activeCount} active</small></div>
        <div><span>Profiles saved</span><strong>{configuredCount}</strong><small>Authoritative financial inputs</small></div>
        <div><span>Need setup</span><strong>{unconfiguredCount}</strong><small>No financial profile yet</small></div>
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
                aria-label="Search pricing products"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name or Product ID"
              />
            </label>
            <label className="field">
              <span>Status</span>
              <select
                aria-label="Filter pricing products by status"
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
              <div className="empty-icon" aria-hidden="true"><AppIcon name="pricing" size={28} /></div>
              <h3>Loading pricing workspace</h3>
              <p>Reading Product identities and current financial profile source records.</p>
            </div>
          ) : workspaceError ? (
            <div className="empty-state compact-pricing-empty" role="alert">
              <div className="empty-icon" aria-hidden="true"><AppIcon name="alert" size={28} /></div>
              <h3>Pricing workspace unavailable</h3>
              <p>{workspaceError}</p>
              <button className="button button-secondary" type="button" onClick={() => void loadWorkspace()}>
                Retry loading
              </button>
            </div>
          ) : products.length === 0 ? (
            <div className="empty-state compact-pricing-empty">
              <div className="empty-icon" aria-hidden="true"><AppIcon name="plus-circle" size={28} /></div>
              <h3>Create a Product first</h3>
              <p>The Pricing workspace needs a Product identity before financial configuration or unit economics can be inspected.</p>
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className="empty-state compact-pricing-empty">
              <div className="empty-icon" aria-hidden="true"><AppIcon name="search" size={28} /></div>
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
                    aria-label={`Price ${product.name}`}
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
                      {profile ? 'Profile saved' : 'Needs setup'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <form className="panel pricing-editor-panel" aria-label="Pricing financial profile" onSubmit={submitProfile}>
          <div className="panel-heading pricing-editor-heading">
            <div>
              <p className="panel-kicker">FINANCIAL SOURCE</p>
              <h2>{selectedProduct ? selectedProduct.name : 'Select a Product'}</h2>
            </div>
            <div className="pricing-editor-badges">
              {formDirty && <span className="pricing-draft-pill">Unsaved changes</span>}
              {selectedProduct && (
                <span className={`status-pill ${selectedProduct.isActive ? 'status-active' : ''}`}>
                  {selectedProduct.isActive ? 'Active' : 'Archived'}
                </span>
              )}
            </div>
          </div>

          {selectedProduct && (
            <div className="pricing-product-context" aria-label="Selected pricing product context">
              <div><span>Category</span><strong>{PRODUCT_CATEGORY_RULES[selectedProduct.category].label}</strong></div>
              <div><span>Safety waste</span><strong>{(selectedProduct.safetyWasteRate * 100).toLocaleString('en-PH', { maximumFractionDigits: 4 })}%</strong></div>
              <div><span>Saved profile</span><strong>{selectedProfile ? 'Yes' : 'No'}</strong></div>
              <div><span>Saved policy</span><strong>{pricingPolicyLabel(selectedProfile?.pricingPolicy ?? null)}</strong></div>
            </div>
          )}

          <div className={`pricing-profile-state ${selectedProfile ? 'configured' : 'missing'}`}>
            <strong>
              {!selectedProduct
                ? 'No Product selected'
                : selectedProfile
                  ? 'Saved financial profile loaded'
                  : 'Financial profile not configured'}
            </strong>
            <span>
              {!selectedProduct
                ? 'Select a Product from the catalog before entering or saving financial source values.'
                : selectedProfile
                  ? 'Edit the draft below, then save to refresh the authoritative unit-economics quote.'
                  : 'Enter labor and overhead explicitly. Use 0 only when a cost is intentionally zero.'}
            </span>
          </div>

          <div className="pricing-form-section">
            <div className="pricing-form-section-heading">
              <span>1</span><div><strong>Per-unit operating costs</strong><small>Add the costs not already coming from materials and components.</small></div>
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
                <small>Explicit PHP labor cost required to finish one sellable unit.</small>
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
            </div>
          </div>

          <div className="pricing-form-section">
            <div className="pricing-form-section-heading">
              <span>2</span><div><strong>Selling-price policy</strong><small>Choose how selling price should be derived after total unit cost is known.</small></div>
            </div>
            <div className="form-grid pricing-form-grid">
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
                <small>Pricing may remain unconfigured while labor and overhead are still saved as known source values.</small>
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
            </div>

            <div className="pricing-method-guide" aria-label="Pricing method guide">
              <div><strong>Fixed profit</strong><span>Add a fixed PHP amount to unit cost.</span></div>
              <div><strong>Markup</strong><span>Profit as a percentage of total unit cost.</span></div>
              <div><strong>Target margin</strong><span>Profit as a percentage of the final selling price.</span></div>
            </div>
          </div>

          <details className="pricing-notes-details">
            <summary>Notes & assumptions <span>Optional</span></summary>
            <label className="field">
              <span>Notes</span>
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
          </details>

          <div className="pricing-draft-preview" aria-label="Draft financial input preview">
            <div className="pricing-draft-preview-heading">
              <div><span>DRAFT INPUT PREVIEW</span><strong>What will be saved</strong></div>
              <span className={`pricing-save-state ${draftReady ? 'ready' : ''}`}>
                {draftReady ? 'Ready to save' : 'Complete required inputs'}
              </span>
            </div>
            <div className="pricing-draft-metrics">
              <div><span>Labor</span><strong>{formatPhp(laborDraft)}</strong></div>
              <div><span>Overhead</span><strong>{formatPhp(overheadDraft)}</strong></div>
              <div><span>Labor + overhead</span><strong>{formatPhp(operatingAddition)}</strong></div>
              <div><span>Pricing policy</span><strong>{pricingMethodSummary(form)}</strong></div>
            </div>
            <p>This preview covers editable financial inputs only. Materials, components, total unit cost, selling price, and profit remain authoritative saved quote results below.</p>
          </div>

          <div className="pricing-unit-guide" aria-label="Financial input units">
            <div><strong>PHP</strong><span>Labor, overhead, and fixed-profit amounts are pesos per finished unit.</span></div>
            <div><strong>%</strong><span>Markup and target-margin inputs are human percentages; the application stores canonical decimal rates.</span></div>
          </div>

          <div className="pricing-editor-actions">
            <button className="button button-secondary" type="button" disabled={!formDirty || saving} onClick={resetDraft}>
              Reset changes
            </button>
            <button className="button button-primary" type="submit" disabled={editorDisabled || !draftReady}>
              {saving ? 'Saving financial profile…' : selectedProfile ? 'Save changes' : 'Save financial profile'}
            </button>
          </div>

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
        hasUnsavedChanges={formDirty}
        onRefresh={selectedProduct ? () => void loadQuote(selectedProduct.id) : undefined}
      />

      {tierMutationFeedback && (
        <div className="feedback feedback-success tier-mutation-feedback" role="status">
          {tierMutationFeedback}
        </div>
      )}

      <ProductPriceTierEditorPanel
        product={selectedProduct}
        tier={editingTier}
        open={tierEditorOpen}
        saving={tierSaving}
        error={tierMutationError}
        onSubmit={submitTier}
        onCancel={closeTierEditor}
      />

      <ProductPriceTierCatalogPanel
        productName={selectedProduct?.name ?? null}
        quote={tierQuote}
        loading={tierQuoteLoading}
        error={tierQuoteError}
        hasUnsavedChanges={formDirty}
        onRefresh={selectedProduct ? () => void loadTierQuote(selectedProduct.id) : undefined}
        onCreateTier={selectedProduct?.isActive ? startCreateTier : undefined}
        onEditTier={startEditTier}
        onArchiveTier={archiveTier}
        archivingTierId={archivingTierId}
      />
    </section>
  );
}
