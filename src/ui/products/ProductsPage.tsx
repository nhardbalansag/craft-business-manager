import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { materialService, mixPresetService, productService } from '../../application/session';
import { nextSequentialId } from '../../domain/identifiers';
import type { Material } from '../../domain/materials';
import type { MixPreset } from '../../domain/mixPresets';
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_RULES, type Product, type ProductCategory } from '../../domain/products';
import { optimizeProductImages } from './productImageUpload';
import { ProductCatalog } from './ProductCatalog';
import { ProductComponentsView } from './ProductComponentsView';
import { ProductStockView } from './ProductStockView';
import { PricingPage } from '../pricing/PricingPage';
import { AppIcon } from '../icons/AppIcon';
import { ProductImageZoom } from './ProductImageZoom';
import { YieldPage } from '../yield/YieldPage';
import './products.css';
import './productEditorWorkflow.css';

type WorkspaceView = 'products' | 'yield' | 'components' | 'stock' | 'pricing';

type ProductFormState = {
  id: string;
  name: string;
  category: ProductCategory;
  mixPresetId: string;
  candleWaxMaterialId: string;
  candleEssentialOilMaterialId: string;
  imageDataUrl: string;
  brochureImageDataUrl: string;
  safetyWastePercent: string;
  notes: string;
};

const EMPTY_PRODUCT_FORM: ProductFormState = {
  id: '',
  name: '',
  category: 'paintable-art',
  mixPresetId: '',
  candleWaxMaterialId: '',
  candleEssentialOilMaterialId: '',
  imageDataUrl: '',
  brochureImageDataUrl: '',
  safetyWastePercent: '5',
  notes: '',
};

function categoryLabel(category: ProductCategory): string {
  return PRODUCT_CATEGORY_RULES[category].label;
}

function productToForm(product: Product): ProductFormState {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    mixPresetId: product.mixPresetId ?? '',
    candleWaxMaterialId: product.candleWaxMaterialId ?? '',
    candleEssentialOilMaterialId: product.candleEssentialOilMaterialId ?? '',
    imageDataUrl: product.imageDataUrl ?? '',
    brochureImageDataUrl: product.brochureImageDataUrl ?? '',
    safetyWastePercent: String(product.safetyWasteRate * 100),
    notes: product.notes ?? '',
  };
}

function formToProduct(form: ProductFormState, isActive: boolean): Product {
  return {
    id: form.id,
    name: form.name,
    category: form.category,
    mixPresetId: form.mixPresetId.trim() || undefined,
    candleWaxMaterialId: form.category === 'candle' ? form.candleWaxMaterialId.trim() || undefined : undefined,
    candleEssentialOilMaterialId: form.category === 'candle' ? form.candleEssentialOilMaterialId.trim() || undefined : undefined,
    safetyWasteRate: Number(form.safetyWastePercent) / 100,
    imageDataUrl: form.imageDataUrl || undefined,
    brochureImageDataUrl: form.brochureImageDataUrl || undefined,
    notes: form.notes,
    isActive,
  };
}

function normalizeQuery(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please check the form and try again.';
}

export function ProductsPage() {
  const [view, setView] = useState<WorkspaceView>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [mixPresets, setMixPresets] = useState<MixPreset[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  const [productForm, setProductForm] = useState<ProductFormState>(EMPTY_PRODUCT_FORM);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [productTouched, setProductTouched] = useState<string[]>([]);
  const [productAttempted, setProductAttempted] = useState(false);
  const productFormElement = useRef<HTMLFormElement>(null);
  const catalogReturnTarget = useRef<HTMLElement | null>(null);
  const [productFeedback, setProductFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageProcessing, setImageProcessing] = useState(false);
  const imageRequestVersion = useRef(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mutationInFlight = useRef(false);
  const productNameInput = useRef<HTMLInputElement>(null);
  const draftWarning = useRef<HTMLDivElement>(null);
  // undefined means no pending switch; null means a new product was requested.
  const [pendingProduct, setPendingProduct] = useState<Product | null | undefined>(undefined);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  // These workspaces stay mounted while hidden. Refresh any cached Product lists
  // whenever the catalog successfully creates a new Product.
  const [productCatalogRevision, setProductCatalogRevision] = useState(0);
  // Pricing remains mounted between tabs; changes to saved component inputs
  // must invalidate its cached cost and quantity-aware selling price.
  const [componentPricingRevision, setComponentPricingRevision] = useState(0);
  const [pricingVisited, setPricingVisited] = useState(false);
  const [yieldVisited, setYieldVisited] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [nextProducts, nextMixes, nextMaterials] = await Promise.all([
        productService.listProducts(),
        mixPresetService.listMixPresets(),
        materialService.listMaterials(),
      ]);
      setProducts(nextProducts);
      setMixPresets(nextMixes);
      setMaterials(nextMaterials);
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const generatedProductId = useMemo(() => nextSequentialId(products.map((product) => product.id), 'PROD'), [products]);
  const savedProduct = products.find((product) => product.id === editingProductId);
  const productDirty = JSON.stringify(productForm) !== JSON.stringify(savedProduct ? productToForm(savedProduct) : EMPTY_PRODUCT_FORM);
  const reservePercent = Number(productForm.safetyWastePercent);
  const productErrors: Record<string, string> = {};
  if (!productForm.name.trim()) productErrors.name = 'Enter a product name.';
  else if (products.some((product) => product.id !== editingProductId && normalizeQuery(product.name) === normalizeQuery(productForm.name)))
    productErrors.name = 'This product name is already in use. Choose a different name.';
  if (!productForm.safetyWastePercent.trim()) productErrors.safetyWastePercent = 'Enter a material reserve percentage, including 0 for no reserve.';
  else if (!Number.isFinite(reservePercent) || reservePercent < 0 || reservePercent >= 100)
    productErrors.safetyWastePercent = 'Enter a percentage from 0 to less than 100.';
  if (
    productForm.category === 'candle' &&
    Boolean(productForm.candleWaxMaterialId) !== Boolean(productForm.candleEssentialOilMaterialId)
  ) productErrors.candleOilConfig = 'Select both wax and essential oil, or leave both blank.';
  if (productForm.category === 'candle' && productForm.candleWaxMaterialId && productForm.candleEssentialOilMaterialId) {
    const wax = materials.find((material) => material.id === productForm.candleWaxMaterialId);
    const oil = materials.find((material) => material.id === productForm.candleEssentialOilMaterialId);
    if (!wax?.isActive || wax.group !== 'wax' || wax.baseUnit !== 'g' || wax.essentialOilPercent === undefined ||
        !oil?.isActive || oil.group !== 'fragrance' || oil.baseUnit !== 'g') {
      productErrors.candleOilConfig = 'Choose an active gram-based wax with a configured essential oil percentage and an active gram-based fragrance material.';
    }
  }
  function visibleProductError(key: string) {
    return (productAttempted || productTouched.includes(key)) ? productErrors[key] : undefined;
  }

  useEffect(() => {
    if (editorOpen && pendingProduct === undefined) productNameInput.current?.focus();
  }, [editorOpen, editingProductId]);

  function resumeProductDraft() {
    catalogReturnTarget.current = document.activeElement as HTMLElement;
    setEditorOpen(true);
  }

  function backToCatalog() {
    setEditorOpen(false);
    requestAnimationFrame(() => {
      const target = catalogReturnTarget.current;
      if (target?.isConnected) target.focus();
      if (document.activeElement !== target) document.querySelector<HTMLButtonElement>('button[aria-label="+ New product"]')?.focus();
    });
  }

  useEffect(() => {
    if (pendingProduct !== undefined) draftWarning.current?.focus();
  }, [pendingProduct]);

  function openProductEditor(product: Product | null) {
    imageRequestVersion.current += 1;
    setImageProcessing(false);
    // Keep the Components tab aligned with the product whose details are being edited.
    // Only change this context after a pending draft switch has been confirmed.
    if (product) {
      setSelectedProductId(product.id);
    }
    setEditorOpen(true);
    setProductTouched([]);
    setProductAttempted(false);
    setEditingProductId(product?.id ?? null);
    setProductForm(product ? productToForm(product) : EMPTY_PRODUCT_FORM);
    setImageError(null);
    setProductFeedback(null);
    setPendingProduct(undefined);
    productNameInput.current?.focus();
  }

  function requestProductEditor(product: Product | null) {
    if (mutationInFlight.current) return;
    catalogReturnTarget.current = document.activeElement as HTMLElement;
    setEditorOpen(true);
    if (product && product.id === editingProductId) {
      setSelectedProductId(product.id);
      productNameInput.current?.focus();
    } else if (productDirty) {
      setPendingProduct(product);
    } else {
      openProductEditor(product);
    }
  }

  async function loadImage(file: File | undefined) {
    if (!file) return;
    const version = ++imageRequestVersion.current;
    setImageProcessing(true);
    setImageError(null);
    try {
      const { imageDataUrl, brochureImageDataUrl } = await optimizeProductImages(file);
      if (imageRequestVersion.current !== version) return;
      setProductForm((current) => ({ ...current, imageDataUrl, brochureImageDataUrl }));
      setProductFeedback(null);
    } catch (error) {
      if (imageRequestVersion.current === version) setImageError(errorMessage(error));
    } finally {
      if (imageRequestVersion.current === version) setImageProcessing(false);
    }
  }

  function resetProductForm() {
    imageRequestVersion.current += 1;
    setImageProcessing(false);
    setImageError(null);
    setEditingProductId(null);
    setProductForm(EMPTY_PRODUCT_FORM);
    setProductFeedback(null);
    setPendingProduct(undefined);
  }

  async function submitProduct(event: FormEvent) {
    event.preventDefault();
    if (mutationInFlight.current || loading || loadError || imageProcessing) return;
    setProductAttempted(true);
    const firstError = Object.keys(productErrors)[0];
    if (firstError) {
      setProductFeedback({ type: 'error', message: productErrors[firstError] });
      productFormElement.current?.querySelector<HTMLElement>(`[name="${firstError}"]`)?.focus();
      return;
    }
    mutationInFlight.current = true;
    setBusy(true);
    setProductFeedback(null);
    try {
      if (productForm.safetyWastePercent.trim() === '')
        throw new Error('Enter a material reserve percentage, including 0 for no reserve.');
      if (editingProductId) {
        const existing = products.find((product) => product.id === editingProductId);
        const candidate = formToProduct(productForm, existing?.isActive ?? true);
        const updated = await productService.updateProduct(editingProductId, {
          name: candidate.name,
          category: candidate.category,
          mixPresetId: candidate.mixPresetId,
          candleWaxMaterialId: candidate.candleWaxMaterialId,
          candleEssentialOilMaterialId: candidate.candleEssentialOilMaterialId,
          safetyWasteRate: candidate.safetyWasteRate,
          notes: candidate.notes,
          imageDataUrl: candidate.imageDataUrl,
          brochureImageDataUrl: candidate.brochureImageDataUrl,
        });
        setProductForm(productToForm(updated));
        setProductFeedback({ type: 'success', message: 'Product updated.' });
      } else {
        const created = await productService.createProduct(formToProduct({ ...productForm, id: generatedProductId }, true));
        setProductFeedback({ type: 'success', message: 'Product created.' });
        setEditingProductId(created.id);
        setSelectedProductId(created.id);
        setProductCatalogRevision((revision) => revision + 1);
        setProductForm(productToForm(created));
      }
      await reload();
      setPendingProduct(undefined);
      setProductAttempted(false);
      setProductTouched([]);
    } catch (error) {
      setProductFeedback({ type: 'error', message: errorMessage(error) });
    } finally {
      mutationInFlight.current = false;
      setBusy(false);
    }
  }

  function navigateToComponents() {
    setView('components');
  }

  function navigateToYield() {
    setYieldVisited(true);
    setView('yield');
  }

  function navigateToPricing(productId?: string) {
    if (productId) setSelectedProductId(productId);
    setPricingVisited(true);
    setView('pricing');
  }

  async function archiveProduct(product: Product) {
    if (mutationInFlight.current || loading || loadError) return;
    mutationInFlight.current = true;
    setBusy(true);
    setProductFeedback(null);
    try {
      if (product.isActive) await productService.archiveProduct(product.id);
      else await productService.updateProduct(product.id, { isActive: true });
      if (editingProductId === product.id) resetProductForm();
      await reload();
      setProductFeedback({
        type: 'success',
        message: `${product.name} ${product.isActive ? 'archived' : 'restored'}.`,
      });
    } catch (error) {
      setProductFeedback({ type: 'error', message: errorMessage(error) });
    } finally {
      mutationInFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="materials-workspace products-workspace">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">WORKSHOP / PRODUCTS</p>
          <h1>Your product workshop</h1>
          <p className="page-lead">Manage products, record real batch yield, and review components, stock and pricing in one place.</p>
        </div>
        <div className="session-badge">Catalog &amp; recipe setup</div>
      </div>

      <div className="products-overview" aria-label="Workshop summary">
        <article className="panel">
          <span>Active products</span>
          <strong>{loading || loadError ? '-' : products.filter((item) => item.isActive).length}</strong>
          <small>Your current collection</small>
        </article>
        <article className="panel">
          <span>Total products</span>
          <strong>{loading || loadError ? '-' : products.length}</strong>
          <small>All catalog entries</small>
        </article>
        <article className="panel">
          <span>Archived products</span>
          <strong>{loading || loadError ? '-' : products.filter((item) => !item.isActive).length}</strong>
          <small>Keep history; restore when needed</small>
        </article>
      </div>
      <nav className="workspace-switcher" aria-label="Product workspace views">
        {(
          [
            { id: 'products', title: 'Products', hint: 'Your collection' },
            { id: 'yield', title: 'Yield', hint: 'Batches & history' },
            { id: 'components', title: 'Components', hint: 'Assembly setup' },
            { id: 'stock', title: 'Finished stock', hint: 'Ready to assemble' },
            { id: 'pricing', title: 'Pricing', hint: 'Quotes & unit economics' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={busy}
            className={view === item.id ? 'active' : ''}
            aria-pressed={view === item.id}
            aria-controls={`products-view-${item.id}`}
            onClick={() => {
              if (item.id === 'yield') navigateToYield();
              else if (item.id === 'components') navigateToComponents();
              else if (item.id === 'pricing') navigateToPricing();
              else setView(item.id);
            }}
          >
            <strong>{item.title}</strong>
            <small>{item.hint}</small>
          </button>
        ))}
      </nav>
      {loadError && (
        <div className="feedback feedback-error" role="alert">
          Could not refresh the workshop: {loadError}{' '}
          <button type="button" className="text-button" disabled={busy || loading} onClick={() => void reload()}>
            Retry loading
          </button>
        </div>
      )}
      {view === 'products' && productFeedback && (
        <div
          className={`feedback feedback-${productFeedback.type}`}
          role={productFeedback.type === 'error' ? 'alert' : 'status'}
        >
          {productFeedback.message}
        </div>
      )}
      <div id="products-view-products" hidden={view !== 'products'} className="product-catalog-layout">
        <ProductCatalog
          products={products}
          loading={loading}
          loadFailed={Boolean(loadError)}
          disabled={busy || loading || Boolean(loadError)}
          editingId={editingProductId}
          editorOpen={editorOpen}
          onBack={backToCatalog}
          hasDraft={productDirty}
          onResume={resumeProductDraft}
          onNew={() => requestProductEditor(null)}
          onEdit={requestProductEditor}
          onSelect={(product) => setSelectedProductId(product.id)}
          onPricing={(product) => navigateToPricing(product.id)}
          onComponents={(product) => {
            setSelectedProductId(product.id);
            setView('components');
          }}
          onToggleActive={(product) => void archiveProduct(product)}
        />
        <form
          className="panel material-form product-details-form"
          aria-label="Product details"
          ref={productFormElement}
          noValidate
          onChange={() => setProductFeedback(null)}
          onBlurCapture={(event) => {
            const target = event.target;
            const key = target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement ? target.name : '';
            if (key) setProductTouched((current) => current.includes(key) ? current : [...current, key]);
          }}
          onSubmit={submitProduct}
          aria-busy={busy}
        >
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">PRODUCT DETAILS</p>
              <h2>{editingProductId ? 'Edit product' : 'Add a product'}</h2>
              <p className="product-editor-hint">
                {editingProductId
                  ? `Editing ${editingProductId}. Your ID stays the same.`
                  : 'Start with a name and category, then choose how to make it.'}
              </p>
            </div>
            {editingProductId && (
              <button type="button" className="text-button" disabled={busy} onClick={() => requestProductEditor(null)}>
                Clear
              </button>
            )}
          </div>

          <div className={`product-editor-state ${productDirty ? 'has-changes' : ''}`} role="status">
            <strong>{productDirty ? 'Unsaved changes' : editingProductId ? 'All changes saved' : 'New product'}</strong>
            <span>{productDirty ? 'Save this draft before moving on, or discard it when switching products.' : 'Product identity, recipe setup, and workshop notes.'}</span>
          </div>
          {pendingProduct !== undefined && (
            <div className="product-draft-warning" role="alert" ref={draftWarning} tabIndex={-1}>
              <strong>Keep your current draft?</strong>
              <p>{pendingProduct ? `Opening ${pendingProduct.name} will replace your unsaved changes.` : 'Starting a new product will replace your unsaved changes.'}</p>
              <div>
                <button className="button button-primary" type="button" disabled={busy} onClick={() => { setPendingProduct(undefined); productNameInput.current?.focus(); }}>Keep editing</button>
                <button className="button button-quiet" type="button" disabled={busy} onClick={() => openProductEditor(pendingProduct)}>Discard changes</button>
              </div>
            </div>
          )}

          <fieldset className="product-form-fields" disabled={busy || imageProcessing || loading || Boolean(loadError)}>
            <section className="product-editor-section" aria-labelledby="product-identity-heading">
              <div className="product-section-heading"><span aria-hidden="true">1</span><div><h3 id="product-identity-heading">Product identity</h3><p>Name the product; its stable ID is assigned automatically.</p></div></div>
              <div className="form-grid">
                <label className="field">
                  <span>Product ID</span>
                  <input
                    aria-describedby="product-id-help"
                    value={editingProductId ? productForm.id : generatedProductId}
                    readOnly
                    aria-readonly="true"
                  />
                  <small id="product-id-help">{editingProductId ? 'The existing ID is preserved so recipes and history stay linked.' : 'Assigned automatically when this product is created. Existing Product IDs are never changed.'}</small>
                </label>
                <label className="field">
                  <span>Name</span>
                  <input
                    ref={productNameInput}
                    name="name"
                    aria-invalid={Boolean(visibleProductError('name'))}
                    aria-describedby="product-name-error"
                    required
                    value={productForm.name}
                    onChange={(event) => setProductForm({ ...productForm, name: event.target.value })}
                    placeholder="Paintable star"
                  />
                  <small className="product-field-error" id="product-name-error">{visibleProductError('name')}</small>
                </label>
              </div>
            </section>
            <section className="product-editor-section" aria-labelledby="product-photo-heading">
              <div className="product-section-heading">
                <span aria-hidden="true">2</span>
                <div>
                  <h3 id="product-photo-heading">Product image <small>Optional</small></h3>
                  <p>Upload a product photo for quotations and a larger, clearer A4 brochure photo.</p>
                </div>
              </div>
              <div className="product-image-editor" aria-label="Product image editor">
                <div className="product-image-preview">
                  {productForm.imageDataUrl ? (
                    <ProductImageZoom product={{ name: productForm.name || 'product', imageDataUrl: productForm.imageDataUrl, brochureImageDataUrl: productForm.brochureImageDataUrl }} alt={`Preview of ${productForm.name || 'product'}`} />
                  ) : (
                    <span>No product image</span>
                  )}
                </div>
                <div className="product-image-actions">
                  <label className="field">
                    <span>{productForm.imageDataUrl ? 'Replace product image' : 'Upload product image'}</span>
                    <input
                      type="file"
                      name="productImage"
                      accept="image/jpeg,image/png,image/webp"
                      aria-label="Upload product image"
                      disabled={imageProcessing || busy}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        event.currentTarget.value = '';
                        void loadImage(file);
                      }}
                    />
                  </label>
                  {productForm.imageDataUrl && (
                    <button type="button" className="button button-secondary" disabled={imageProcessing} onClick={() => {
                      imageRequestVersion.current += 1;
                      setProductForm((current) => ({ ...current, imageDataUrl: '', brochureImageDataUrl: '' }));
                      setImageError(null);
                    }}>Remove image</button>
                  )}
                  <small>JPG, PNG or WebP (up to 8 MB). The app saves a small catalog thumbnail and a separate, sharper brochure photo in workbook-safe parts. Reupload older photos for better printing.</small>
                  {productForm.brochureImageDataUrl && <small role="status">High-resolution brochure photo saved in this Product draft.</small>}
                  {productForm.imageDataUrl && !productForm.brochureImageDataUrl && <small role="status">This Product has only an old small thumbnail. Reupload the original photo to improve brochure quality.</small>}
                  {imageProcessing && <span role="status">Optimizing product image…</span>}
                  {imageError && <span className="product-field-error" role="alert">{imageError}</span>}
                </div>
              </div>
            </section>
            <section className="product-editor-section" aria-labelledby="product-recipe-heading">
              <div className="product-section-heading"><span aria-hidden="true">3</span><div><h3 id="product-recipe-heading">Production setup</h3><p>Choose the category and extra material allowance.</p></div></div>
              <div className="form-grid">
                <label className="field">
                  <span>Category</span>
                  <select
                    value={productForm.category}
                    onChange={(event) => {
                      const keepsMix = mixPresets.some((preset) => preset.id === productForm.mixPresetId && preset.compatibleCategories.includes(event.target.value as ProductCategory));
                      setProductForm({
                        ...productForm,
                        category: event.target.value as ProductCategory,
                        mixPresetId: keepsMix ? productForm.mixPresetId : '',
                        candleWaxMaterialId: event.target.value === 'candle' ? productForm.candleWaxMaterialId : '',
                        candleEssentialOilMaterialId: event.target.value === 'candle' ? productForm.candleEssentialOilMaterialId : '',
                      });
                    }}
                  >
                    {PRODUCT_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {categoryLabel(category)}
                      </option>
                    ))}
                  </select>
                  <small>
                    {PRODUCT_CATEGORY_RULES[productForm.category].productionStyle} production
                  </small>
                </label>
                <label className="field">
                  <span>Safety waste (%)</span>
                  <input
                    required
                    type="number"
                    name="safetyWastePercent"
                    aria-invalid={Boolean(visibleProductError('safetyWastePercent'))}
                    aria-describedby="product-reserve-help product-reserve-error"
                    min="0"
                    max="100"
                    step="any"
                    value={productForm.safetyWastePercent}
                    onChange={(event) => setProductForm({ ...productForm, safetyWastePercent: event.target.value })}
                  />
                  <small id="product-reserve-help">Extra direct material to allow for production waste. Enter 0 for no reserve.</small>
                  <small className="product-field-error" id="product-reserve-error">{visibleProductError('safetyWastePercent')}</small>
                </label>
              </div>
              {productForm.category === 'candle' && (
                <div className="form-grid" aria-label="Scented candle material settings">
                  <label className="field">
                    <span>Wax for essential oil calculation</span>
                    <select name="candleWaxMaterialId" value={productForm.candleWaxMaterialId}
                      onChange={(event) => setProductForm({ ...productForm, candleWaxMaterialId: event.target.value })}>
                      <option value="">No automatic oil calculation</option>
                      {materials.filter((material) => material.isActive && material.group === 'wax' && material.baseUnit === 'g')
                        .map((material) => <option key={material.id} value={material.id}>
                          {material.name}{material.essentialOilPercent === undefined ? ' (percentage not set)' : ` · ${material.essentialOilPercent}% oil`}
                        </option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span>Essential oil for production costs</span>
                    <select name="candleEssentialOilMaterialId" value={productForm.candleEssentialOilMaterialId}
                      onChange={(event) => setProductForm({ ...productForm, candleEssentialOilMaterialId: event.target.value })}>
                      <option value="">No essential oil selected</option>
                      {materials.filter((material) => material.isActive && material.group === 'fragrance' && material.baseUnit === 'g')
                        .map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}
                    </select>
                  </label>
                  <p className="field-wide product-editor-hint">The chosen wax percentage automatically determines the oil needed by Production and Pricing. Existing oil lines in Yield/recipes are replaced, not added twice; original Yield records stay unchanged.</p>
                  {visibleProductError('candleOilConfig') && <p className="feedback feedback-error field-wide" role="alert">{visibleProductError('candleOilConfig')}</p>}
                </div>
              )}
              <div className="product-reserve-preview" aria-label="Material reserve preview">
                <span>Material planning example</span>
                <strong>{productErrors.safetyWastePercent ? 'Enter a valid reserve to preview' : `100 g base + ${reservePercent.toLocaleString(undefined, { maximumFractionDigits: 4 })} g reserve = ${(100 + reservePercent).toLocaleString(undefined, { maximumFractionDigits: 4 })} g planned`}</strong>
                <small>Applied to direct material requirements for this product.</small>
              </div>
            </section>
            <section className="product-editor-section" aria-labelledby="product-notes-heading">
              <div className="product-section-heading"><span aria-hidden="true">4</span><div><h3 id="product-notes-heading">Workshop notes <small>Optional</small></h3><p>Keep making instructions close to the product.</p></div></div>
              <div className="form-grid">
                <label className="field field-wide">
                  <span>Notes</span>
                  <textarea
                    value={productForm.notes}
                    onChange={(event) => setProductForm({ ...productForm, notes: event.target.value })}
                    placeholder="Mold, curing or production notes..."
                  />
                </label>
              </div>
            </section>
            <div className="product-editor-savebar">
              <span>{editingProductId ? `Product ${editingProductId}` : 'New products are added as active.'}</span>
              <div className="product-editor-savebar-actions">
                <button
                  className="button button-secondary product-editor-bottom-back"
                  type="button"
                  disabled={busy || imageProcessing || loading}
                  onClick={backToCatalog}
                >
                  <AppIcon name="arrow-left" size={17} />
                  Back to product catalog
                </button>
                <button className="button button-primary button-full" type="submit" disabled={imageProcessing || busy}>
                  {imageProcessing ? 'Optimizing image…' : busy ? 'Saving...' : editingProductId ? 'Save product' : 'Create product'}
                </button>
              </div>
            </div>
          </fieldset>
        </form>
      </div>
      <div id="products-view-yield" className="products-yield-area" hidden={view !== 'yield'}>
        {yieldVisited && (
          <YieldPage
            preferredProductId={selectedProductId}
            productCatalogRevision={productCatalogRevision}
            onSelectedProductChange={setSelectedProductId}
            onOpenProducts={() => setView('products')}
          />
        )}
      </div>
      {view === 'components' && (
        <div id="products-view-components">
          <ProductComponentsView
            products={products}
            materials={materials}
            catalogLoading={loading}
            initialProductId={selectedProductId ?? undefined}
            onSelectedProductChange={setSelectedProductId}
            onComponentsSaved={() => setComponentPricingRevision((current) => current + 1)}
          />
        </div>
      )}
      {view === 'stock' && (
        <div id="products-view-stock">
          <ProductStockView
            products={products}
            catalogLoading={loading}
            initialProductId={selectedProductId}
            onSelectedProductChange={setSelectedProductId}
          />
        </div>
      )}
      <div id="products-view-pricing" className="products-pricing-area" hidden={view !== 'pricing'}>
        {pricingVisited && (
          <PricingPage
            preferredProductId={selectedProductId}
            productCatalogRevision={productCatalogRevision}
            componentPricingRevision={componentPricingRevision}
            onSelectedProductChange={setSelectedProductId}
          />
        )}
      </div>
    </section>
  );
}
