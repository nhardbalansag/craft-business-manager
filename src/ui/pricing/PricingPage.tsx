import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  productFinancialProfileService,
  productPriceResolutionService,
  productPriceTierService,
  productPricingQuoteIntegrationService,
  productService,
} from '../../application/session';
import type { ProductPriceResolutionResult } from '../../application/pricing/ProductPriceResolutionService';
import type { IntegratedProductPricingQuoteResult } from '../../application/pricing/ProductPricingQuoteIntegrationService';
import type { ProductPriceTier } from '../../domain/productPriceTiers';
import type { ProductFinancialProfile } from '../../domain/productFinancialProfile';
import {
  PRODUCT_CATEGORY_RULES,
  type Product,
} from '../../domain/products';
import { ProductPriceResolutionPanel } from './ProductPriceResolutionPanel';
import { CustomerQuotationDialog } from './CustomerQuotationDialog';
import { PricingEditorModal } from './PricingEditorModal';
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
import { isValidProductImageDataUrl } from '../../domain/productImage';
import { isValidBrochureImageDataUrl } from '../../domain/productBrochureImage';
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

interface PricingPageProps {
  preferredProductId?: string | null;
  onSelectedProductChange?: (productId: string) => void;
}

export function PricingPage({ preferredProductId, onSelectedProductChange }: PricingPageProps = {}) {
  const preferredProductRef = useRef(preferredProductId);
  preferredProductRef.current = preferredProductId;
  const [products, setProducts] = useState<Product[]>([]);
  const [profiles, setProfiles] = useState<ProductFinancialProfile[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFinancialProfileFormState>(() =>
    createEmptyProductFinancialProfileForm(),
  );
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ActiveFilter>('active');
  const [productCatalogOpen, setProductCatalogOpen] = useState(false);
  const [financialSourceOpen, setFinancialSourceOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [quote, setQuote] = useState<IntegratedProductPricingQuoteResult | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [resolutionQuantity, setResolutionQuantity] = useState('1');
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [resolution, setResolution] = useState<ProductPriceResolutionResult | null>(null);
  const [resolutionLoading, setResolutionLoading] = useState(false);
  const [resolutionError, setResolutionError] = useState<string | null>(null);
  const [quotationOpen, setQuotationOpen] = useState(false);
  const [orderPreviewOpen, setOrderPreviewOpen] = useState(false);
  const [tierPricingOpen, setTierPricingOpen] = useState(false);
  const [tierEditorOpen, setTierEditorOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<ProductPriceTier | null>(null);
  const [tierSaving, setTierSaving] = useState(false);
  const [archivingTierId, setArchivingTierId] = useState<string | null>(null);
  const [tierMutationError, setTierMutationError] = useState<string | null>(null);
  const [tierMutationFeedback, setTierMutationFeedback] = useState<string | null>(null);
  const quoteRequestVersion = useRef(0);
  const resolutionRequestVersion = useRef(0);
  const productCatalogTriggerRef = useRef<HTMLButtonElement>(null);
  const productCatalogCloseRef = useRef<HTMLButtonElement>(null);

  const loadQuote = useCallback(async (productId: string) => {
    const requestVersion = ++quoteRequestVersion.current;
    setQuoteLoading(true);
    setQuoteError(null);
    setQuote(null);

    try {
      const nextQuote = await productPricingQuoteIntegrationService.quoteProduct(productId);
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

  const loadResolution = useCallback(
    async (
      productId: string,
      quantityValue: string,
      tierId: string | null,
    ) => {
      const requestVersion = ++resolutionRequestVersion.current;
      setResolutionLoading(true);
      setResolutionError(null);

      const quantity = quantityValue.trim()
        ? Number(quantityValue)
        : Number.NaN;

      try {
        const nextResolution = await productPriceResolutionService.resolve({
          productId,
          quantity,
          ...(tierId === null ? {} : { selectedTierId: tierId }),
        });
        if (requestVersion === resolutionRequestVersion.current) {
          setResolution(nextResolution);
        }
      } catch (error) {
        if (requestVersion === resolutionRequestVersion.current) {
          setResolution(null);
          setResolutionError(
            error instanceof Error
              ? error.message
              : 'The quantity-aware pricing preview could not be resolved.',
          );
        }
      } finally {
        if (requestVersion === resolutionRequestVersion.current) {
          setResolutionLoading(false);
        }
      }
    },
    [],
  );

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

      const initialProduct = nextProducts.find((product) => product.id === preferredProductRef.current)
        ?? nextProducts.find((product) => product.isActive) ?? nextProducts[0] ?? null;
      const initialProfile = initialProduct
        ? nextProfiles.find(
            (profile) => comparable(profile.productId) === comparable(initialProduct.id),
          ) ?? null
        : null;

      setSelectedProductId(initialProduct?.id ?? null);
      setForm(productFinancialProfileToForm(initialProfile));
      setFinancialSourceOpen(false);
    } catch (error) {
      setWorkspaceError(errorMessage(error));
      setProducts([]);
      setProfiles([]);
      setSelectedProductId(null);
      setForm(createEmptyProductFinancialProfileForm());
      resolutionRequestVersion.current += 1;
      setResolution(null);
      setResolutionLoading(false);
      setResolutionError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!productCatalogOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProductCatalogOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    productCatalogCloseRef.current?.focus();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      productCatalogTriggerRef.current?.focus();
    };
  }, [productCatalogOpen]);

  useEffect(() => {
    if (selectedProductId === null) {
      quoteRequestVersion.current += 1;
      resolutionRequestVersion.current += 1;
      setQuote(null);
      setQuoteLoading(false);
      setQuoteError(null);
      setResolution(null);
      setResolutionLoading(false);
      setResolutionError(null);
      return;
    }

    void loadQuote(selectedProductId);
  }, [loadQuote, selectedProductId]);

  useEffect(() => {
    if (selectedProductId === null || quote === null) {
      return;
    }

    void loadResolution(
      selectedProductId,
      resolutionQuantity,
      selectedTierId,
    );
  }, [
    loadResolution,
    quote,
    resolutionQuantity,
    selectedProductId,
    selectedTierId,
  ]);

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

  // Prefer the small saved Product photo for UI rendering. Older Products may only
  // have the print-quality brochure photo, so use that when needed.
  const selectedProductImage = isValidProductImageDataUrl(selectedProduct?.imageDataUrl)
    ? selectedProduct.imageDataUrl
    : isValidBrochureImageDataUrl(selectedProduct?.brochureImageDataUrl)
      ? selectedProduct.brochureImageDataUrl
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
    onSelectedProductChange?.(product.id);
    quoteRequestVersion.current += 1;
    resolutionRequestVersion.current += 1;
    setQuote(null);
    setQuoteError(null);
    setQuoteLoading(true);
    setResolutionQuantity('1');
    setSelectedTierId(null);
    setResolution(null);
    setResolutionLoading(false);
    setResolutionError(null);
    setQuotationOpen(false);
    setOrderPreviewOpen(false);
    setFinancialSourceOpen(false);
    setTierPricingOpen(false);
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
    setProductCatalogOpen(false);
  }

  // Follow Product selection across Catalog, Components, Finished stock, and Pricing.
  // Pricing remains mounted while its tab is hidden so same-Product drafts survive switching.
  useEffect(() => {
    if (!preferredProductId || preferredProductId === selectedProductId) return;
    const product = products.find((item) => item.id === preferredProductId);
    if (product) selectProduct(product);
  }, [preferredProductId, selectedProductId, products]);

  function openOrderPricePreview() {
    if (!selectedProduct) return;
    setOrderPreviewOpen(true);
  }

  function closeOrderPricePreview() {
    setOrderPreviewOpen(false);
  }

  function openQuotationFromPreview() {
    // There must be only one active modal: close the preview before quotation.
    setOrderPreviewOpen(false);
    setQuotationOpen(true);
  }

  function openFinancialSource() {
    if (!selectedProduct) return;
    setFeedback(null);
    setFinancialSourceOpen(true);
  }

  function closeFinancialSource() {
    if (saving) return;
    // Preserve the unsaved draft when dismissing; the summary still warns
    // that saved economics do not include unsaved financial inputs.
    setFinancialSourceOpen(false);
  }

  function openProductCatalog() {
    setProductCatalogOpen(true);
  }

  function closeProductCatalog() {
    setProductCatalogOpen(false);
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
      await loadQuote(selectedProduct.id);
      setFinancialSourceOpen(false);
    } catch (error) {
      setFeedback({ type: 'error', message: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  }


  function openTierPricing() {
    if (!selectedProduct) return;
    setTierPricingOpen(true);
  }

  function closeTierPricing() {
    if (archivingTierId) return;
    setTierPricingOpen(false);
  }

  function startCreateTier() {
    if (!selectedProduct?.isActive) return;
    setTierPricingOpen(false);
    setEditingTier(null);
    setTierMutationError(null);
    setTierMutationFeedback(null);
    setTierEditorOpen(true);
  }

  function startEditTier(tier: ProductPriceTier) {
    setTierPricingOpen(false);
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
    setTierPricingOpen(true);
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
      setTierPricingOpen(true);
      setTierMutationFeedback(
        editingTier
          ? `Price tier ${saved.name} updated.`
          : `Price tier ${saved.name} created as ${saved.id}.`,
      );
      await loadQuote(selectedProduct.id);
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
      await loadQuote(selectedProduct.id);
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
      <section className="panel pricing-product-selector" aria-label="Selected pricing Product">
        <div className="pricing-product-selector-identity">
          {selectedProduct && selectedProductImage && !loading && !workspaceError && (
            <img
              className="pricing-product-reference-image"
              src={selectedProductImage}
              alt={`Product reference: ${selectedProduct.name}`}
              loading="lazy"
              decoding="async"
            />
          )}
          <div className="pricing-product-selector-copy">
          <p className="panel-kicker">YOUR PRODUCT</p>
          {loading ? (
            <>
              <h2>Loading pricing workspace</h2>
              <p>Loading product details…</p>
            </>
          ) : workspaceError ? (
            <>
              <h2>Pricing workspace unavailable</h2>
              <p role="alert">{workspaceError}</p>
            </>
          ) : selectedProduct ? (
            <>
              <div className="pricing-product-selector-title">
                <h2>{selectedProduct.name}</h2>
                <span className={`status-pill ${selectedProduct.isActive ? 'status-active' : ''}`}>
                  {selectedProduct.isActive ? 'Active' : 'Archived'}
                </span>
              </div>
              <p>
                {selectedProduct.id} · {PRODUCT_CATEGORY_RULES[selectedProduct.category].label}
                {' · '}
                {selectedProfile ? 'Costs saved' : 'Costs not set'}
              </p>
            </>
          ) : (
            <>
              <h2>No Product selected</h2>
              <p>
                {products.length === 0
                  ? 'Create a Product first, then return here to configure pricing.'
                  : 'Open the Product Catalog to choose which Product you want to price.'}
              </p>
            </>
          )}
          </div>
        </div>
        <div className="pricing-product-selector-actions">
          {workspaceError && (
            <button className="button button-secondary" type="button" onClick={() => void loadWorkspace()}>
              Retry loading
            </button>
          )}
          <button
            ref={productCatalogTriggerRef}
            className="button button-primary"
            type="button"
            onClick={openProductCatalog}
            aria-label="Open Product Catalog"
            aria-haspopup="dialog"
            aria-expanded={productCatalogOpen}
          >
            <AppIcon name="products" size={17} />
            Change product
          </button>
        </div>
      </section>

      <section className="panel pricing-financial-source-summary" aria-label="Financial source summary">
        <div className="pricing-financial-summary-heading">
          <div>
            <h2>Financial source</h2>
            <p>{selectedProfile ? 'Costs and pricing saved' : 'Set costs and selling price'}</p>
          </div>
          <button
            className="button button-primary"
            type="button"
            aria-haspopup="dialog"
            aria-expanded={financialSourceOpen}
            aria-label={selectedProfile ? 'Edit Financial Source' : 'Set Financial Source'}
            disabled={!selectedProduct || loading || Boolean(workspaceError)}
            onClick={openFinancialSource}
          >
            <AppIcon name="pricing" size={17} />
            {selectedProfile ? 'Edit Financial Source' : 'Set Financial Source'}
          </button>
        </div>
        {formDirty && (
          <p className="pricing-financial-draft-warning" role="status">
            Unsaved financial changes are preserved. Reopen Financial Source to save or reset them.
          </p>
        )}
        {feedback && !financialSourceOpen && (
          <div className={`feedback ${feedback.type === 'error' ? 'feedback-error' : 'feedback-success'}`} role="status">
            {feedback.message}
          </div>
        )}
      </section>

      <ProductPricingQuotePanel
        productName={selectedProduct?.name ?? null}
        quote={quote}
        loading={quoteLoading}
        error={quoteError}
        hasUnsavedChanges={formDirty}
        onRefresh={selectedProduct ? () => void loadQuote(selectedProduct.id) : undefined}
      />

      <details className="pricing-overview" aria-label="Pricing catalog summary">
        <summary>
          <span>Catalog: <strong>{configuredCount} of {products.length}</strong> products have costs set</span>
          <span className="pricing-overview-hint">View totals</span>
        </summary>
        <div className="pricing-overview-stats">
          <div><span>Products</span><strong>{products.length}</strong><small>{activeCount} active</small></div>
          <div><span>Profiles saved</span><strong>{configuredCount}</strong><small>Financial inputs saved</small></div>
          <div><span>Need setup</span><strong>{unconfiguredCount}</strong><small>No financial profile yet</small></div>
        </div>
      </details>

      <div className="pricing-quick-actions" aria-label="Pricing next steps">
        <section className="panel pricing-order-preview-summary" aria-label="Order price preview summary">
          <div className="pricing-financial-summary-heading">
            <div>
              <p className="panel-kicker">ORDER & QUOTATION</p>
              <h2>Order price</h2>
            </div>
            <button
              className="button button-primary"
              type="button"
              aria-label="Open Order Price Preview"
              aria-haspopup="dialog"
              aria-expanded={orderPreviewOpen}
              disabled={!selectedProduct || loading || Boolean(workspaceError)}
              onClick={openOrderPricePreview}
            >
              <AppIcon name="pricing" size={17} />
              Open Order Price Preview
            </button>
          </div>
          <div className="pricing-order-preview-summary-values">
            <div><span>Units</span><strong>{resolutionQuantity.trim() || '—'}</strong></div>
            <div><span>Order total</span><strong>{formatPhp(resolution?.totalSellingPrice ?? null)}</strong></div>
          </div>
          {(resolutionError || quoteError) && (
            <p className="pricing-order-preview-summary-status" role="status">Price needs attention. Open preview for details.</p>
          )}
        </section>

        <section className="panel pricing-tier-summary" aria-label="Tier pricing summary">
          <div className="pricing-financial-summary-heading">
            <div>
              <p className="panel-kicker">BULK & CUSTOM</p>
              <h2>Price tiers</h2>
            </div>
            <button
              className="button button-primary"
              type="button"
              aria-label="Open Tier Pricing"
              aria-haspopup="dialog"
              aria-expanded={tierPricingOpen}
              disabled={!selectedProduct || loading || Boolean(workspaceError)}
              onClick={openTierPricing}
            >
              <AppIcon name="pricing" size={17} />
              Open Tier Pricing
            </button>
          </div>
          <div className="pricing-tier-summary-values">
            <div><span>Saved tiers</span><strong>{quote?.tierPricing?.tiers.length ?? 0}</strong></div>
            <div><span>Default price</span><strong>{formatPhp(quote?.tierPricing?.defaultSellingPrice ?? null)}</strong></div>
          </div>
          {quoteError && (
            <p className="pricing-tier-summary-status" role="status">Tier prices need attention.</p>
          )}
        </section>
      </div>

      <PricingEditorModal
        open={financialSourceOpen}
        titleId="pricing-financial-source-title"
        label="Financial Source"
        onClose={closeFinancialSource}
        closeDisabled={saving}
        restoreFocusSelector={'[aria-label="Edit Financial Source"], [aria-label="Set Financial Source"]'}
      >
        <form className="panel pricing-editor-panel" aria-label="Pricing financial profile" onSubmit={submitProfile}>
          <div className="panel-heading pricing-editor-heading">
            <div>
              <p className="panel-kicker">FINANCIAL SOURCE</p>
              <h2 id="pricing-financial-source-title">{selectedProduct ? selectedProduct.name : 'Select a Product'}</h2>
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
            <button className="button button-quiet" type="button" disabled={saving} onClick={closeFinancialSource}>
              Cancel
            </button>
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
      </PricingEditorModal>

      {productCatalogOpen && (
        <div
          className="pricing-product-catalog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeProductCatalog();
          }}
        >
          <section
            className="panel pricing-product-catalog-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pricing-product-catalog-title"
          >
            <div className="panel-heading pricing-panel-heading pricing-product-catalog-modal-heading">
              <div>
                <p className="panel-kicker">PRODUCT CATALOG</p>
                <h2 id="pricing-product-catalog-title">Select a Product</h2>
                <p>Choose the Product whose financial inputs and unit economics you want to review.</p>
              </div>
              <div className="pricing-product-catalog-modal-actions">
                <div className="material-count"><strong>{visibleProducts.length}</strong><span>shown</span></div>
                <button
                  ref={productCatalogCloseRef}
                  className="button button-secondary pricing-product-catalog-close"
                  type="button"
                  aria-label="Close Product Catalog"
                  onClick={closeProductCatalog}
                >
                  <AppIcon name="close" size={17} />
                  Close
                </button>
              </div>
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

            <div className="pricing-product-catalog-modal-body">
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
            </div>
          </section>
        </div>
      )}

      <PricingEditorModal
        open={orderPreviewOpen}
        titleId="pricing-order-preview-heading"
        label="Order Price Preview"
        onClose={closeOrderPricePreview}
        restoreFocusSelector={'[aria-label="Open Order Price Preview"]'}
        wide
      >
        <ProductPriceResolutionPanel
          productName={selectedProduct?.name ?? null}
          quantity={resolutionQuantity}
          selectedTierId={selectedTierId}
          result={resolution}
          loading={resolutionLoading || quoteLoading}
          error={resolutionError ?? quoteError}
          hasUnsavedChanges={formDirty}
          onQuantityChange={setResolutionQuantity}
          onSelectPricingSource={setSelectedTierId}
          onRefresh={
            selectedProduct && quote
              ? () =>
                  void loadResolution(
                    selectedProduct.id,
                    resolutionQuantity,
                    selectedTierId,
                  )
              : undefined
          }
          onCreateQuotation={
            resolution?.status === 'ready' ? openQuotationFromPreview : undefined
          }
        />
      </PricingEditorModal>

      <CustomerQuotationDialog
        open={quotationOpen}
        result={resolution}
        products={products}
        resolvePrice={(request) => productPriceResolutionService.resolve(request)}
        onClose={() => setQuotationOpen(false)}
      />

      {!tierPricingOpen && !tierEditorOpen && tierMutationFeedback && (
        <div className="feedback feedback-success tier-mutation-feedback" role="status">
          {tierMutationFeedback}
        </div>
      )}
      {!tierPricingOpen && !tierEditorOpen && tierMutationError && (
        <div className="feedback feedback-error tier-mutation-feedback" role="status">
          {tierMutationError}
        </div>
      )}

      <PricingEditorModal
        open={tierEditorOpen}
        titleId="price-tier-editor-title"
        label={editingTier ? `Edit tier ${editingTier.name}` : 'Create price tier'}
        onClose={closeTierEditor}
        closeDisabled={tierSaving}
        restoreFocusSelector={'[aria-label="Open Tier Pricing"]'}
      >
        <ProductPriceTierEditorPanel
          product={selectedProduct}
          tier={editingTier}
          open={tierEditorOpen}
          saving={tierSaving}
          error={tierMutationError}
          fullyLoadedUnitCost={quote?.totalFullyLoadedUnitCost ?? null}
          onSubmit={submitTier}
          onCancel={closeTierEditor}
        />
      </PricingEditorModal>

      <PricingEditorModal
        open={tierPricingOpen}
        titleId="tier-pricing-catalog-heading"
        label="Tier Pricing"
        onClose={closeTierPricing}
        closeDisabled={Boolean(archivingTierId)}
        restoreFocusSelector={'[aria-label="Open Tier Pricing"]'}
        wide
      >
        {tierMutationFeedback && (
          <div className="feedback feedback-success pricing-tier-modal-feedback" role="status">
            {tierMutationFeedback}
          </div>
        )}
        {tierMutationError && (
          <div className="feedback feedback-error pricing-tier-modal-feedback" role="alert">
            {tierMutationError}
          </div>
        )}
        <ProductPriceTierCatalogPanel
          productName={selectedProduct?.name ?? null}
          quote={quote?.tierPricing ?? null}
          loading={quoteLoading}
          error={quote?.integrationIssues[0]?.message ?? quoteError}
          hasUnsavedChanges={formDirty}
          onRefresh={selectedProduct ? () => void loadQuote(selectedProduct.id) : undefined}
          onCreateTier={selectedProduct?.isActive ? startCreateTier : undefined}
          onEditTier={startEditTier}
          onArchiveTier={archiveTier}
          archivingTierId={archivingTierId}
        />
      </PricingEditorModal>
    </section>
  );
}
