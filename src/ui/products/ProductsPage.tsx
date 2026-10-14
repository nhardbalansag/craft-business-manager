import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { materialService, mixPresetService, productService } from '../../application/session';
import { nextSequentialId } from '../../domain/identifiers';
import type { Material } from '../../domain/materials';
import type { MixPreset } from '../../domain/mixPresets';
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_RULES, type Product, type ProductCategory } from '../../domain/products';
import { ProductCatalog } from './ProductCatalog';
import { ProductComponentsView } from './ProductComponentsView';
import { ProductStockView } from './ProductStockView';
import './products.css';
import './productEditorWorkflow.css';

type WorkspaceView = 'products' | 'components' | 'stock';

type ProductFormState = {
  id: string;
  name: string;
  category: ProductCategory;
  mixPresetId: string;
  safetyWastePercent: string;
  notes: string;
};

const EMPTY_PRODUCT_FORM: ProductFormState = {
  id: '',
  name: '',
  category: 'paintable-art',
  mixPresetId: '',
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
    safetyWasteRate: Number(form.safetyWastePercent) / 100,
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mutationInFlight = useRef(false);
  const productNameInput = useRef<HTMLInputElement>(null);
  const draftWarning = useRef<HTMLDivElement>(null);
  // undefined means no pending switch; null means a new product was requested.
  const [pendingProduct, setPendingProduct] = useState<Product | null | undefined>(undefined);
  const [componentProductId, setComponentProductId] = useState('');

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
    setEditorOpen(true);
    setProductTouched([]);
    setProductAttempted(false);
    setEditingProductId(product?.id ?? null);
    setProductForm(product ? productToForm(product) : EMPTY_PRODUCT_FORM);
    setProductFeedback(null);
    setPendingProduct(undefined);
    productNameInput.current?.focus();
  }

  function requestProductEditor(product: Product | null) {
    if (mutationInFlight.current) return;
    catalogReturnTarget.current = document.activeElement as HTMLElement;
    setEditorOpen(true);
    if (product && product.id === editingProductId) {
      productNameInput.current?.focus();
    } else if (productDirty) {
      setPendingProduct(product);
    } else {
      openProductEditor(product);
    }
  }

  function resetProductForm() {
    setEditingProductId(null);
    setProductForm(EMPTY_PRODUCT_FORM);
    setProductFeedback(null);
    setPendingProduct(undefined);
  }

  async function submitProduct(event: FormEvent) {
    event.preventDefault();
    if (mutationInFlight.current || loading || loadError) return;
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
          safetyWasteRate: candidate.safetyWasteRate,
          notes: candidate.notes,
        });
        setProductForm(productToForm(updated));
        setProductFeedback({ type: 'success', message: 'Product updated.' });
      } else {
        const created = await productService.createProduct(formToProduct({ ...productForm, id: generatedProductId }, true));
        setProductFeedback({ type: 'success', message: 'Product created.' });
        setEditingProductId(created.id);
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
          <p className="page-lead">Build your collection, manage components, and track finished stock.</p>
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
            { id: 'components', title: 'Components', hint: 'Assembly setup' },
            { id: 'stock', title: 'Finished stock', hint: 'Ready to assemble' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={busy}
            className={view === item.id ? 'active' : ''}
            aria-pressed={view === item.id}
            aria-controls={`products-view-${item.id}`}
            onClick={() => setView(item.id)}
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
          onComponents={(product) => {
            setComponentProductId(product.id);
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

          <fieldset className="product-form-fields" disabled={busy || loading || Boolean(loadError)}>
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
            <section className="product-editor-section" aria-labelledby="product-recipe-heading">
              <div className="product-section-heading"><span aria-hidden="true">2</span><div><h3 id="product-recipe-heading">Production setup</h3><p>Choose the category and extra material allowance.</p></div></div>
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
              <div className="product-reserve-preview" aria-label="Material reserve preview">
                <span>Material planning example</span>
                <strong>{productErrors.safetyWastePercent ? 'Enter a valid reserve to preview' : `100 g base + ${reservePercent.toLocaleString(undefined, { maximumFractionDigits: 4 })} g reserve = ${(100 + reservePercent).toLocaleString(undefined, { maximumFractionDigits: 4 })} g planned`}</strong>
                <small>Applied to direct material requirements for this product.</small>
              </div>
            </section>
            <section className="product-editor-section" aria-labelledby="product-notes-heading">
              <div className="product-section-heading"><span aria-hidden="true">3</span><div><h3 id="product-notes-heading">Workshop notes <small>Optional</small></h3><p>Keep making instructions close to the product.</p></div></div>
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
              <button className="button button-primary button-full" type="submit">
                {busy ? 'Saving...' : editingProductId ? 'Save product' : 'Create product'}
              </button>
            </div>
          </fieldset>
        </form>
      </div>
      {view === 'components' && (
        <div id="products-view-components">
          <ProductComponentsView
            products={products}
            materials={materials}
            catalogLoading={loading}
            initialProductId={componentProductId}
          />
        </div>
      )}
      {view === 'stock' && (
        <div id="products-view-stock">
          <ProductStockView products={products} catalogLoading={loading} />
        </div>
      )}
    </section>
  );
}
