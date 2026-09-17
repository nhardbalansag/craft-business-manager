import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { materialService, mixPresetService, productService } from '../../application/session';
import type { Material } from '../../domain/materials';
import {
  MIX_PRESET_LINE_ROLES,
  MIX_RATIO_BASES,
  type MixPreset,
  type MixPresetLine,
  type MixPresetLineRole,
  type RatioBasis,
} from '../../domain/mixPresets';
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_RULES, type Product, type ProductCategory } from '../../domain/products';
import { ProductCatalog } from './ProductCatalog';
import { ProductComponentsView } from './ProductComponentsView';
import { ProductStockView } from './ProductStockView';
import './products.css';

type WorkspaceView = 'products' | 'mixes' | 'components' | 'stock';
type ActiveFilter = 'active' | 'archived' | 'all';

type ProductFormState = {
  id: string;
  name: string;
  category: ProductCategory;
  mixPresetId: string;
  safetyWastePercent: string;
  notes: string;
};

type MixLineForm = {
  key: string;
  materialId: string;
  role: MixPresetLineRole;
  parts: string;
};

type MixFormState = {
  id: string;
  name: string;
  basis: RatioBasis;
  compatibleCategories: ProductCategory[];
  lines: MixLineForm[];
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

let lineSequence = 0;
function newLine(role: MixPresetLineRole = 'primary'): MixLineForm {
  lineSequence += 1;
  return {
    key: `mix-line-${lineSequence}`,
    materialId: '',
    role,
    parts: role === 'primary' ? '100' : '1',
  };
}

function emptyMixForm(): MixFormState {
  return {
    id: '',
    name: '',
    basis: 'weight',
    compatibleCategories: ['candle'],
    lines: [newLine('primary')],
    notes: '',
  };
}

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

function mixToForm(preset: MixPreset): MixFormState {
  return {
    id: preset.id,
    name: preset.name,
    basis: preset.basis,
    compatibleCategories: [...preset.compatibleCategories],
    lines: preset.lines.map((line) => ({
      key: `mix-line-${++lineSequence}`,
      materialId: line.materialId,
      role: line.role,
      parts: String(line.parts),
    })),
    notes: preset.notes ?? '',
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

function formToMixPreset(form: MixFormState, isActive: boolean): MixPreset {
  return {
    id: form.id,
    name: form.name,
    basis: form.basis,
    compatibleCategories: [...form.compatibleCategories],
    lines: form.lines.map<MixPresetLine>((line) => ({
      materialId: line.materialId,
      role: line.role,
      parts: Number(line.parts),
    })),
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

function ratioSummary(preset: MixPreset, materials: readonly Material[]): string {
  const materialById = new Map(materials.map((material) => [material.id.toLocaleLowerCase(), material]));
  return preset.lines
    .map((line) => {
      const material = materialById.get(line.materialId.toLocaleLowerCase());
      return `${material?.name ?? line.materialId} ${line.parts}`;
    })
    .join(' : ');
}

export function ProductsPage() {
  const [view, setView] = useState<WorkspaceView>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [mixPresets, setMixPresets] = useState<MixPreset[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  const [productForm, setProductForm] = useState<ProductFormState>(EMPTY_PRODUCT_FORM);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productFeedback, setProductFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mutationInFlight = useRef(false);
  const productNameInput = useRef<HTMLInputElement>(null);
  const draftWarning = useRef<HTMLDivElement>(null);
  // undefined means no pending switch; null means a new product was requested.
  const [pendingProduct, setPendingProduct] = useState<Product | null | undefined>(undefined);
  const [componentProductId, setComponentProductId] = useState('');

  const [mixForm, setMixForm] = useState<MixFormState>(() => emptyMixForm());
  const [editingMixId, setEditingMixId] = useState<string | null>(null);
  const [mixFeedback, setMixFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [mixQuery, setMixQuery] = useState('');
  const [mixStatus, setMixStatus] = useState<ActiveFilter>('active');
  const [mixBasis, setMixBasis] = useState<RatioBasis | 'all'>('all');

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

  const visibleMixes = useMemo(() => {
    const query = normalizeQuery(mixQuery);
    return mixPresets.filter((preset) => {
      const statusMatches = mixStatus === 'all' || (mixStatus === 'active' ? preset.isActive : !preset.isActive);
      const basisMatches = mixBasis === 'all' || preset.basis === mixBasis;
      const queryMatches =
        !query ||
        [
          preset.id,
          preset.name,
          preset.notes ?? '',
          ...preset.compatibleCategories,
          ...preset.lines.flatMap((line) => [
            line.materialId,
            materials.find((material) => material.id.toLowerCase() === line.materialId.toLowerCase())?.name ?? '',
          ]),
        ].some((value) => value.toLocaleLowerCase().includes(query));
      return statusMatches && basisMatches && queryMatches;
    });
  }, [mixBasis, mixPresets, mixQuery, mixStatus, materials]);

  const compatibleMixes = useMemo(
    () =>
      mixPresets.filter(
        (preset) =>
          preset.compatibleCategories.includes(productForm.category) &&
          (preset.isActive || preset.id === productForm.mixPresetId),
      ),
    [mixPresets, productForm.category, productForm.mixPresetId],
  );

  const activeMaterials = useMemo(() => materials.filter((material) => material.isActive), [materials]);
  const savedProduct = products.find((product) => product.id === editingProductId);
  const productDirty = JSON.stringify(productForm) !== JSON.stringify(savedProduct ? productToForm(savedProduct) : EMPTY_PRODUCT_FORM);

  useEffect(() => {
    if (pendingProduct !== undefined) draftWarning.current?.focus();
  }, [pendingProduct]);

  function openProductEditor(product: Product | null) {
    setEditingProductId(product?.id ?? null);
    setProductForm(product ? productToForm(product) : EMPTY_PRODUCT_FORM);
    setProductFeedback(null);
    setPendingProduct(undefined);
    productNameInput.current?.focus();
  }

  function requestProductEditor(product: Product | null) {
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

  function resetMixForm() {
    setEditingMixId(null);
    setMixForm(emptyMixForm());
    setMixFeedback(null);
  }

  async function submitProduct(event: FormEvent) {
    event.preventDefault();
    if (mutationInFlight.current || loading || loadError) return;
    mutationInFlight.current = true;
    setBusy(true);
    setProductFeedback(null);
    try {
      if (productForm.safetyWastePercent.trim() === '')
        throw new Error('Enter a material reserve percentage, including 0 for no reserve.');
      if (editingProductId) {
        const existing = products.find((product) => product.id === editingProductId);
        const candidate = formToProduct(productForm, existing?.isActive ?? true);
        await productService.updateProduct(editingProductId, {
          name: candidate.name,
          category: candidate.category,
          mixPresetId: candidate.mixPresetId,
          safetyWasteRate: candidate.safetyWasteRate,
          notes: candidate.notes,
        });
        setProductForm(productToForm(candidate));
        setProductFeedback({ type: 'success', message: 'Product updated.' });
      } else {
        await productService.createProduct(formToProduct(productForm, true));
        setProductFeedback({ type: 'success', message: 'Product created.' });
        setProductForm(EMPTY_PRODUCT_FORM);
      }
      await reload();
      setPendingProduct(undefined);
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

  async function submitMix(event: FormEvent) {
    event.preventDefault();
    if (mutationInFlight.current || loading || loadError) return;
    mutationInFlight.current = true;
    setBusy(true);
    setMixFeedback(null);
    try {
      if (editingMixId) {
        const existing = mixPresets.find((preset) => preset.id === editingMixId);
        const candidate = formToMixPreset(mixForm, existing?.isActive ?? true);
        await mixPresetService.updateMixPreset(editingMixId, {
          name: candidate.name,
          basis: candidate.basis,
          compatibleCategories: candidate.compatibleCategories,
          lines: candidate.lines,
          notes: candidate.notes,
        });
        setMixFeedback({ type: 'success', message: 'Mix preset updated.' });
      } else {
        await mixPresetService.createMixPreset(formToMixPreset(mixForm, true));
        setMixFeedback({ type: 'success', message: 'Mix preset created.' });
        setMixForm(emptyMixForm());
      }
      await reload();
    } catch (error) {
      setMixFeedback({ type: 'error', message: errorMessage(error) });
    } finally {
      mutationInFlight.current = false;
      setBusy(false);
    }
  }

  async function archiveMix(preset: MixPreset) {
    if (mutationInFlight.current || loading || loadError) return;
    mutationInFlight.current = true;
    setBusy(true);
    setMixFeedback(null);
    try {
      if (preset.isActive) await mixPresetService.archiveMixPreset(preset.id);
      else await mixPresetService.updateMixPreset(preset.id, { isActive: true });
      if (editingMixId === preset.id) resetMixForm();
      await reload();
      setMixFeedback({ type: 'success', message: `${preset.name} ${preset.isActive ? 'archived' : 'restored'}.` });
    } catch (error) {
      setMixFeedback({ type: 'error', message: errorMessage(error) });
    } finally {
      mutationInFlight.current = false;
      setBusy(false);
    }
  }

  function updateMixLine(key: string, changes: Partial<Omit<MixLineForm, 'key'>>) {
    setMixForm((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.key === key ? { ...line, ...changes } : line)),
    }));
  }

  function addMixLine() {
    setMixForm((current) => ({ ...current, lines: [...current.lines, newLine('secondary')] }));
  }

  function removeMixLine(key: string) {
    setMixForm((current) => ({ ...current, lines: current.lines.filter((line) => line.key !== key) }));
  }

  function toggleCompatibleCategory(category: ProductCategory) {
    setMixForm((current) => ({
      ...current,
      compatibleCategories: current.compatibleCategories.includes(category)
        ? current.compatibleCategories.filter((item) => item !== category)
        : [...current.compatibleCategories, category],
    }));
  }

  const materialName = useCallback(
    (materialId: string) =>
      materials.find((material) => material.id.toLocaleLowerCase() === materialId.toLocaleLowerCase())?.name ??
      materialId,
    [materials],
  );

  return (
    <section className="materials-workspace products-workspace">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">WORKSHOP / PRODUCTS</p>
          <h1>Your product workshop</h1>
          <p className="page-lead">Build your collection, refine your mixes, and bring every component together.</p>
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
          <span>Mix presets</span>
          <strong>{loading || loadError ? '-' : mixPresets.filter((item) => item.isActive).length}</strong>
          <small>Reusable material ratios</small>
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
            { id: 'mixes', title: 'Mix presets', hint: 'Reusable ratios' },
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
      {view === 'mixes' && mixFeedback && (
        <div
          className={`feedback feedback-${mixFeedback.type}`}
          role={mixFeedback.type === 'error' ? 'alert' : 'status'}
        >
          {mixFeedback.message}
        </div>
      )}

      <div id="products-view-products" hidden={view !== 'products'} className="product-catalog-layout">
        <ProductCatalog
          products={products}
          mixPresets={mixPresets}
          loading={loading}
          loadFailed={Boolean(loadError)}
          disabled={busy || loading || Boolean(loadError)}
          editingId={editingProductId}
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
            <div className="form-grid">
              <label className="field">
                <span>Product ID</span>
                <input
                  required
                  value={productForm.id}
                  disabled={Boolean(editingProductId)}
                  onChange={(event) => setProductForm({ ...productForm, id: event.target.value })}
                  placeholder="ART-001"
                />
              </label>
              <label className="field">
                <span>Name</span>
                <input
                  ref={productNameInput}
                  required
                  value={productForm.name}
                  onChange={(event) => setProductForm({ ...productForm, name: event.target.value })}
                  placeholder="Paintable star"
                />
              </label>
              <label className="field">
                <span>Category</span>
                <select
                  value={productForm.category}
                  onChange={(event) =>
                    setProductForm({
                      ...productForm,
                      category: event.target.value as ProductCategory,
                      mixPresetId: mixPresets.some(
                        (preset) =>
                          preset.id === productForm.mixPresetId &&
                          preset.compatibleCategories.includes(event.target.value as ProductCategory),
                      )
                        ? productForm.mixPresetId
                        : '',
                    })
                  }
                >
                  {PRODUCT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {categoryLabel(category)}
                    </option>
                  ))}
                </select>
                <small>
                  {PRODUCT_CATEGORY_RULES[productForm.category].productionStyle} · typical{' '}
                  {PRODUCT_CATEGORY_RULES[productForm.category].typicalMixBasis} mix
                </small>
              </label>
              <label className="field">
                <span>Safety waste (%)</span>
                <input
                  required
                  type="number"
                  min="0"
                  max="99.999"
                  step="0.1"
                  value={productForm.safetyWastePercent}
                  onChange={(event) => setProductForm({ ...productForm, safetyWastePercent: event.target.value })}
                />
                <small>Extra direct material to allow for production waste. Enter 0 for no reserve.</small>
              </label>
              <label className="field field-wide">
                <span>Mix preset</span>
                <select
                  value={productForm.mixPresetId}
                  onChange={(event) => setProductForm({ ...productForm, mixPresetId: event.target.value })}
                >
                  <option value="">No mix preset</option>
                  {compatibleMixes.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                      {preset.isActive ? '' : ' (archived)'}
                    </option>
                  ))}
                </select>
                <small>Only presets compatible with {categoryLabel(productForm.category)} are shown.</small>
              </label>
              <label className="field field-wide">
                <span>Notes</span>
                <textarea
                  value={productForm.notes}
                  onChange={(event) => setProductForm({ ...productForm, notes: event.target.value })}
                  placeholder="Mold, curing or production notes..."
                />
              </label>
            </div>

            <button className="button button-primary button-full" type="submit">
              {busy ? 'Saving...' : editingProductId ? 'Save product' : 'Create product'}
            </button>
          </fieldset>
        </form>
      </div>
      <div id="products-view-mixes" hidden={view !== 'mixes'}>
        <div className="materials-layout product-layout">
          <form className="panel material-form" onSubmit={submitMix}>
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">RATIO LIBRARY</p>
                <h2>{editingMixId ? 'Edit mix preset' : 'Add a mix preset'}</h2>
              </div>
              {editingMixId && (
                <button type="button" className="text-button" disabled={busy} onClick={resetMixForm}>
                  Cancel
                </button>
              )}
            </div>
            <fieldset className="product-form-fields" disabled={busy || loading || Boolean(loadError)}>
              <div className="form-grid">
                <label className="field">
                  <span>Preset ID</span>
                  <input
                    required
                    value={mixForm.id}
                    disabled={Boolean(editingMixId)}
                    onChange={(event) => setMixForm({ ...mixForm, id: event.target.value })}
                    placeholder="MIX-PLASTER-2-1"
                  />
                </label>
                <label className="field">
                  <span>Name</span>
                  <input
                    required
                    value={mixForm.name}
                    onChange={(event) => setMixForm({ ...mixForm, name: event.target.value })}
                    placeholder="Plaster 2:1"
                  />
                </label>
                <label className="field field-wide">
                  <span>Ratio basis</span>
                  <select
                    value={mixForm.basis}
                    onChange={(event) => setMixForm({ ...mixForm, basis: event.target.value as RatioBasis })}
                  >
                    {MIX_RATIO_BASES.map((basis) => (
                      <option key={basis} value={basis}>
                        {basis === 'weight' ? 'Weight' : 'Volume'}
                      </option>
                    ))}
                  </select>
                  <small>All ratio quantities will be resolved using a {mixForm.basis} anchor unit.</small>
                </label>
                <div className="field field-wide">
                  <span>Compatible product categories</span>
                  <div className="category-checkboxes">
                    {PRODUCT_CATEGORIES.map((category) => (
                      <label key={category}>
                        <input
                          type="checkbox"
                          checked={mixForm.compatibleCategories.includes(category)}
                          onChange={() => toggleCompatibleCategory(category)}
                        />
                        {categoryLabel(category)}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="field field-wide">
                  <span>Ratio lines</span>
                  <div className="mix-lines">
                    {mixForm.lines.map((line, index) => (
                      <div className="mix-line-row" key={line.key}>
                        <select
                          aria-label={`Mix material ${index + 1}`}
                          value={line.materialId}
                          onChange={(event) => updateMixLine(line.key, { materialId: event.target.value })}
                        >
                          <option value="">Select material</option>
                          {activeMaterials.map((material) => (
                            <option key={material.id} value={material.id}>
                              {material.name} · {material.baseUnit}
                            </option>
                          ))}
                        </select>
                        <select
                          aria-label={`Mix role ${index + 1}`}
                          value={line.role}
                          onChange={(event) =>
                            updateMixLine(line.key, { role: event.target.value as MixPresetLineRole })
                          }
                        >
                          {MIX_PRESET_LINE_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                        <input
                          required
                          aria-label={`Mix parts ${index + 1}`}
                          type="number"
                          min="0.000001"
                          step="any"
                          value={line.parts}
                          onChange={(event) => updateMixLine(line.key, { parts: event.target.value })}
                          placeholder="parts"
                        />
                        <button
                          type="button"
                          className="text-button danger"
                          disabled={mixForm.lines.length === 1}
                          onClick={() => removeMixLine(line.key)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="button button-quiet add-line-button" onClick={addMixLine}>
                    + Add material line
                  </button>
                  <small>Exactly one line must be primary. Parts are relative, not absolute batch quantities.</small>
                </div>
                <label className="field field-wide">
                  <span>Notes</span>
                  <textarea
                    value={mixForm.notes}
                    onChange={(event) => setMixForm({ ...mixForm, notes: event.target.value })}
                    placeholder="Mixing order, brand-specific notes..."
                  />
                </label>
              </div>
              <button className="button button-primary button-full" type="submit">
                {busy ? 'Saving...' : editingMixId ? 'Save mix preset' : 'Create mix preset'}
              </button>
            </fieldset>
          </form>

          <div className="panel material-list">
            <div className="panel-heading list-heading">
              <div>
                <p className="panel-kicker">MIX PRESETS</p>
                <h2>Reusable ratios</h2>
              </div>
              <div className="material-count">
                <strong>{visibleMixes.length}</strong>
                <span>shown</span>
              </div>
            </div>
            <div className="filters products-filters">
              <label className="search-field">
                <span className="sr-only">Search mix presets</span>
                <input
                  value={mixQuery}
                  onChange={(event) => setMixQuery(event.target.value)}
                  placeholder="Search mix, ID or material..."
                />
              </label>
              <select
                aria-label="Mix basis filter"
                value={mixBasis}
                onChange={(event) => setMixBasis(event.target.value as RatioBasis | 'all')}
              >
                <option value="all">All bases</option>
                <option value="weight">Weight</option>
                <option value="volume">Volume</option>
              </select>
              <select
                aria-label="Mix status filter"
                value={mixStatus}
                onChange={(event) => setMixStatus(event.target.value as ActiveFilter)}
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
                <option value="all">All status</option>
              </select>
            </div>
            <div className="table-wrap" tabIndex={0} role="region" aria-label="Mix preset list">
              {loading ? (
                <div className="empty-state">
                  <p>Loading mix presets…</p>
                </div>
              ) : visibleMixes.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">∶</div>
                  <h3>{mixPresets.length ? 'No matching mix presets' : 'No mix presets yet'}</h3>
                  <p>
                    {mixPresets.length
                      ? 'Adjust your search or filters to find a preset.'
                      : 'Create a reusable ratio such as plaster 2:1 or wax 100:8.'}
                  </p>
                  {mixPresets.length > 0 && (
                    <button
                      type="button"
                      className="button button-quiet"
                      onClick={() => {
                        setMixQuery('');
                        setMixStatus('active');
                        setMixBasis('all');
                      }}
                    >
                      Clear mix filters
                    </button>
                  )}
                </div>
              ) : (
                <table role="table" className="responsive-table materials-table products-table mix-table">
                  <thead role="rowgroup">
                    <tr role="row">
                      <th role="columnheader" scope="col">Preset</th>
                      <th role="columnheader" scope="col">Basis</th>
                      <th role="columnheader" scope="col">Ratio</th>
                      <th role="columnheader" scope="col">Compatible with</th>
                      <th role="columnheader" scope="col">Status</th>
                      <th role="columnheader" scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody role="rowgroup">
                    {visibleMixes.map((preset) => (
                      <tr role="row" key={preset.id} className={preset.isActive ? '' : 'archived-row'}>
                        <td role="cell" data-label="Preset">
                          <strong>{preset.name}</strong>
                          <span className="material-id">{preset.id}</span>
                        </td>
                        <td role="cell" data-label="Basis">
                          <span className="group-pill">{preset.basis}</span>
                        </td>
                        <td role="cell" data-label="Ratio">
                          <span className="ratio-summary">{ratioSummary(preset, materials)}</span>
                          <small className="line-detail">
                            {preset.lines.map((line) => `${materialName(line.materialId)} · ${line.role}`).join(' · ')}
                          </small>
                        </td>
                        <td role="cell" data-label="Compatible with">{preset.compatibleCategories.map(categoryLabel).join(', ')}</td>
                        <td role="cell" data-label="Status">
                          <span className={`status-pill ${preset.isActive ? 'status-active' : ''}`}>
                            {preset.isActive ? 'Active' : 'Archived'}
                          </span>
                        </td>
                        <td role="cell" data-label="Actions" className="row-actions">
                          <button
                            type="button"
                            className="text-button"
                            disabled={busy || loading || Boolean(loadError)}
                            onClick={() => {
                              setEditingMixId(preset.id);
                              setMixForm(mixToForm(preset));
                              setMixFeedback(null);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-button danger"
                            disabled={busy || loading || Boolean(loadError)}
                            onClick={() => void archiveMix(preset)}
                          >
                            {preset.isActive ? 'Archive' : 'Restore'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="list-footer">
              <span>Presets describe proportions. Actual batch quantities are calculated during planning.</span>
              <span>{mixPresets.filter((item) => item.isActive).length} active</span>
            </div>
          </div>
        </div>
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
