import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  materialService,
  mixPresetService,
  productService,
} from '../../application/session';
import type { Material } from '../../domain/materials';
import {
  MIX_PRESET_LINE_ROLES,
  MIX_RATIO_BASES,
  type MixPreset,
  type MixPresetLine,
  type MixPresetLineRole,
  type RatioBasis,
} from '../../domain/mixPresets';
import {
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_RULES,
  type Product,
  type ProductCategory,
} from '../../domain/products';
import './products.css';

type WorkspaceView = 'products' | 'mixes';
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
  const [productQuery, setProductQuery] = useState('');
  const [productStatus, setProductStatus] = useState<ActiveFilter>('active');
  const [productCategory, setProductCategory] = useState<ProductCategory | 'all'>('all');

  const [mixForm, setMixForm] = useState<MixFormState>(() => emptyMixForm());
  const [editingMixId, setEditingMixId] = useState<string | null>(null);
  const [mixFeedback, setMixFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [mixQuery, setMixQuery] = useState('');
  const [mixStatus, setMixStatus] = useState<ActiveFilter>('active');
  const [mixBasis, setMixBasis] = useState<RatioBasis | 'all'>('all');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [nextProducts, nextMixes, nextMaterials] = await Promise.all([
        productService.listProducts(),
        mixPresetService.listMixPresets(),
        materialService.listMaterials(),
      ]);
      setProducts(nextProducts);
      setMixPresets(nextMixes);
      setMaterials(nextMaterials);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const visibleProducts = useMemo(() => {
    const query = normalizeQuery(productQuery);
    return products.filter((product) => {
      const statusMatches =
        productStatus === 'all' || (productStatus === 'active' ? product.isActive : !product.isActive);
      const categoryMatches = productCategory === 'all' || product.category === productCategory;
      const queryMatches =
        !query ||
        [product.id, product.name, product.notes ?? '', product.mixPresetId ?? ''].some((value) =>
          value.toLocaleLowerCase().includes(query),
        );
      return statusMatches && categoryMatches && queryMatches;
    });
  }, [products, productCategory, productQuery, productStatus]);

  const visibleMixes = useMemo(() => {
    const query = normalizeQuery(mixQuery);
    return mixPresets.filter((preset) => {
      const statusMatches = mixStatus === 'all' || (mixStatus === 'active' ? preset.isActive : !preset.isActive);
      const basisMatches = mixBasis === 'all' || preset.basis === mixBasis;
      const queryMatches =
        !query ||
        [preset.id, preset.name, preset.notes ?? '', ...preset.compatibleCategories, ...preset.lines.map((line) => line.materialId)].some(
          (value) => value.toLocaleLowerCase().includes(query),
        );
      return statusMatches && basisMatches && queryMatches;
    });
  }, [mixBasis, mixPresets, mixQuery, mixStatus]);

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

  function resetProductForm() {
    setEditingProductId(null);
    setProductForm(EMPTY_PRODUCT_FORM);
    setProductFeedback(null);
  }

  function resetMixForm() {
    setEditingMixId(null);
    setMixForm(emptyMixForm());
    setMixFeedback(null);
  }

  async function submitProduct(event: FormEvent) {
    event.preventDefault();
    setProductFeedback(null);
    try {
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
        setProductFeedback({ type: 'success', message: 'Product updated.' });
      } else {
        await productService.createProduct(formToProduct(productForm, true));
        setProductFeedback({ type: 'success', message: 'Product created.' });
        setProductForm(EMPTY_PRODUCT_FORM);
      }
      await reload();
    } catch (error) {
      setProductFeedback({ type: 'error', message: errorMessage(error) });
    }
  }

  async function archiveProduct(product: Product) {
    setProductFeedback(null);
    try {
      await productService.archiveProduct(product.id);
      if (editingProductId === product.id) resetProductForm();
      await reload();
      setProductFeedback({ type: 'success', message: `${product.name} archived.` });
    } catch (error) {
      setProductFeedback({ type: 'error', message: errorMessage(error) });
    }
  }

  async function submitMix(event: FormEvent) {
    event.preventDefault();
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
    }
  }

  async function archiveMix(preset: MixPreset) {
    setMixFeedback(null);
    try {
      await mixPresetService.archiveMixPreset(preset.id);
      if (editingMixId === preset.id) resetMixForm();
      await reload();
      setMixFeedback({ type: 'success', message: `${preset.name} archived.` });
    } catch (error) {
      setMixFeedback({ type: 'error', message: errorMessage(error) });
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
    (materialId: string) => materials.find((material) => material.id.toLocaleLowerCase() === materialId.toLocaleLowerCase())?.name ?? materialId,
    [materials],
  );

  return (
    <section className="materials-workspace products-workspace">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">PHASE 2 · PRODUCT FOUNDATION</p>
          <h1>Products & mixes</h1>
          <p className="page-lead">
            Define what you sell and the reusable material ratios behind production. Yield samples and production estimates are added in the next UI phases.
          </p>
        </div>
        <div className="session-badge"><span className="status-dot" />Session workspace</div>
      </div>

      <div className="workspace-switcher" role="tablist" aria-label="Product workspace views">
        <button type="button" className={view === 'products' ? 'active' : ''} onClick={() => setView('products')}>Products</button>
        <button type="button" className={view === 'mixes' ? 'active' : ''} onClick={() => setView('mixes')}>Mix presets</button>
      </div>

      {view === 'products' ? (
        <div className="materials-layout product-layout">
          <form className="panel material-form" onSubmit={submitProduct}>
            <div className="panel-heading">
              <div><p className="panel-kicker">PRODUCT MASTER</p><h2>{editingProductId ? 'Edit product' : 'Add a product'}</h2></div>
              {editingProductId && <button type="button" className="text-button" onClick={resetProductForm}>Cancel</button>}
            </div>

            <div className="form-grid">
              <label className="field"><span>Product ID</span><input value={productForm.id} disabled={Boolean(editingProductId)} onChange={(event) => setProductForm({ ...productForm, id: event.target.value })} placeholder="ART-001" /></label>
              <label className="field"><span>Name</span><input value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} placeholder="Paintable star" /></label>
              <label className="field"><span>Category</span><select value={productForm.category} onChange={(event) => setProductForm({ ...productForm, category: event.target.value as ProductCategory, mixPresetId: '' })}>{PRODUCT_CATEGORIES.map((category) => <option key={category} value={category}>{categoryLabel(category)}</option>)}</select><small>{PRODUCT_CATEGORY_RULES[productForm.category].productionStyle} · typical {PRODUCT_CATEGORY_RULES[productForm.category].typicalMixBasis} mix</small></label>
              <label className="field"><span>Safety waste (%)</span><input type="number" min="0" max="99.999" step="0.1" value={productForm.safetyWastePercent} onChange={(event) => setProductForm({ ...productForm, safetyWastePercent: event.target.value })} /><small>Forward-looking production reserve, separate from defect rate.</small></label>
              <label className="field field-wide"><span>Mix preset</span><select value={productForm.mixPresetId} onChange={(event) => setProductForm({ ...productForm, mixPresetId: event.target.value })}><option value="">No mix preset</option>{compatibleMixes.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}{preset.isActive ? '' : ' (archived)'}</option>)}</select><small>Only presets compatible with {categoryLabel(productForm.category)} are shown.</small></label>
              <label className="field field-wide"><span>Notes</span><textarea value={productForm.notes} onChange={(event) => setProductForm({ ...productForm, notes: event.target.value })} placeholder="Mold, curing or production notes..." /></label>
            </div>

            <button className="button button-primary button-full" type="submit">{editingProductId ? 'Save product' : 'Create product'}</button>
            {productFeedback && <div className={`feedback feedback-${productFeedback.type}`}>{productFeedback.message}</div>}
          </form>

          <div className="panel material-list">
            <div className="panel-heading list-heading"><div><p className="panel-kicker">PRODUCT CATALOG</p><h2>Sellable products</h2></div><div className="material-count"><strong>{visibleProducts.length}</strong><span>shown</span></div></div>
            <div className="filters products-filters">
              <label className="search-field"><span className="sr-only">Search products</span><input value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder="Search product, ID or mix..." /></label>
              <select aria-label="Product category filter" value={productCategory} onChange={(event) => setProductCategory(event.target.value as ProductCategory | 'all')}><option value="all">All categories</option>{PRODUCT_CATEGORIES.map((category) => <option key={category} value={category}>{categoryLabel(category)}</option>)}</select>
              <select aria-label="Product status filter" value={productStatus} onChange={(event) => setProductStatus(event.target.value as ActiveFilter)}><option value="active">Active</option><option value="archived">Archived</option><option value="all">All status</option></select>
            </div>
            <div className="table-wrap">
              {loading ? <div className="empty-state"><p>Loading products…</p></div> : visibleProducts.length === 0 ? <div className="empty-state"><div className="empty-icon">◇</div><h3>No products yet</h3><p>Create a product or adjust your filters.</p></div> : (
                <table className="materials-table products-table"><thead><tr><th>Product</th><th>Category</th><th>Mix</th><th>Safety waste</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visibleProducts.map((product) => {
                  const preset = mixPresets.find((item) => item.id.toLocaleLowerCase() === product.mixPresetId?.toLocaleLowerCase());
                  return <tr key={product.id} className={product.isActive ? '' : 'archived-row'}><td><strong>{product.name}</strong><span className="material-id">{product.id}</span></td><td><span className="group-pill">{categoryLabel(product.category)}</span></td><td>{preset?.name ?? product.mixPresetId ?? '—'}</td><td>{(product.safetyWasteRate * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%</td><td><span className={`status-pill ${product.isActive ? 'status-active' : ''}`}>{product.isActive ? 'Active' : 'Archived'}</span></td><td className="row-actions"><button type="button" className="text-button" onClick={() => { setEditingProductId(product.id); setProductForm(productToForm(product)); setProductFeedback(null); }}>Edit</button>{product.isActive && <button type="button" className="text-button danger" onClick={() => void archiveProduct(product)}>Archive</button>}</td></tr>;
                })}</tbody></table>
              )}
            </div>
            <div className="list-footer"><span>Product components/vessels are intentionally deferred to Phase 3.</span><span>{products.filter((item) => item.isActive).length} active</span></div>
          </div>
        </div>
      ) : (
        <div className="materials-layout product-layout">
          <form className="panel material-form" onSubmit={submitMix}>
            <div className="panel-heading"><div><p className="panel-kicker">RATIO LIBRARY</p><h2>{editingMixId ? 'Edit mix preset' : 'Add a mix preset'}</h2></div>{editingMixId && <button type="button" className="text-button" onClick={resetMixForm}>Cancel</button>}</div>
            <div className="form-grid">
              <label className="field"><span>Preset ID</span><input value={mixForm.id} disabled={Boolean(editingMixId)} onChange={(event) => setMixForm({ ...mixForm, id: event.target.value })} placeholder="MIX-PLASTER-2-1" /></label>
              <label className="field"><span>Name</span><input value={mixForm.name} onChange={(event) => setMixForm({ ...mixForm, name: event.target.value })} placeholder="Plaster 2:1" /></label>
              <label className="field field-wide"><span>Ratio basis</span><select value={mixForm.basis} onChange={(event) => setMixForm({ ...mixForm, basis: event.target.value as RatioBasis })}>{MIX_RATIO_BASES.map((basis) => <option key={basis} value={basis}>{basis === 'weight' ? 'Weight' : 'Volume'}</option>)}</select><small>All ratio quantities will be resolved using a {mixForm.basis} anchor unit.</small></label>
              <div className="field field-wide"><span>Compatible product categories</span><div className="category-checkboxes">{PRODUCT_CATEGORIES.map((category) => <label key={category}><input type="checkbox" checked={mixForm.compatibleCategories.includes(category)} onChange={() => toggleCompatibleCategory(category)} />{categoryLabel(category)}</label>)}</div></div>
              <div className="field field-wide"><span>Ratio lines</span><div className="mix-lines">{mixForm.lines.map((line, index) => <div className="mix-line-row" key={line.key}>
                <select aria-label={`Mix material ${index + 1}`} value={line.materialId} onChange={(event) => updateMixLine(line.key, { materialId: event.target.value })}><option value="">Select material</option>{activeMaterials.map((material) => <option key={material.id} value={material.id}>{material.name} · {material.baseUnit}</option>)}</select>
                <select aria-label={`Mix role ${index + 1}`} value={line.role} onChange={(event) => updateMixLine(line.key, { role: event.target.value as MixPresetLineRole })}>{MIX_PRESET_LINE_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}</select>
                <input aria-label={`Mix parts ${index + 1}`} type="number" min="0.000001" step="any" value={line.parts} onChange={(event) => updateMixLine(line.key, { parts: event.target.value })} placeholder="parts" />
                <button type="button" className="text-button danger" disabled={mixForm.lines.length === 1} onClick={() => removeMixLine(line.key)}>Remove</button>
              </div>)}</div><button type="button" className="button button-quiet add-line-button" onClick={addMixLine}>+ Add material line</button><small>Exactly one line must be primary. Parts are relative, not absolute batch quantities.</small></div>
              <label className="field field-wide"><span>Notes</span><textarea value={mixForm.notes} onChange={(event) => setMixForm({ ...mixForm, notes: event.target.value })} placeholder="Mixing order, brand-specific notes..." /></label>
            </div>
            <button className="button button-primary button-full" type="submit">{editingMixId ? 'Save mix preset' : 'Create mix preset'}</button>
            {mixFeedback && <div className={`feedback feedback-${mixFeedback.type}`}>{mixFeedback.message}</div>}
          </form>

          <div className="panel material-list">
            <div className="panel-heading list-heading"><div><p className="panel-kicker">MIX PRESETS</p><h2>Reusable ratios</h2></div><div className="material-count"><strong>{visibleMixes.length}</strong><span>shown</span></div></div>
            <div className="filters products-filters"><label className="search-field"><span className="sr-only">Search mix presets</span><input value={mixQuery} onChange={(event) => setMixQuery(event.target.value)} placeholder="Search mix, ID or material..." /></label><select aria-label="Mix basis filter" value={mixBasis} onChange={(event) => setMixBasis(event.target.value as RatioBasis | 'all')}><option value="all">All bases</option><option value="weight">Weight</option><option value="volume">Volume</option></select><select aria-label="Mix status filter" value={mixStatus} onChange={(event) => setMixStatus(event.target.value as ActiveFilter)}><option value="active">Active</option><option value="archived">Archived</option><option value="all">All status</option></select></div>
            <div className="table-wrap">{loading ? <div className="empty-state"><p>Loading mix presets…</p></div> : visibleMixes.length === 0 ? <div className="empty-state"><div className="empty-icon">∶</div><h3>No mix presets yet</h3><p>Create a reusable ratio such as plaster 2:1 or wax 100:8.</p></div> : <table className="materials-table products-table mix-table"><thead><tr><th>Preset</th><th>Basis</th><th>Ratio</th><th>Compatible with</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visibleMixes.map((preset) => <tr key={preset.id} className={preset.isActive ? '' : 'archived-row'}><td><strong>{preset.name}</strong><span className="material-id">{preset.id}</span></td><td><span className="group-pill">{preset.basis}</span></td><td><span className="ratio-summary">{ratioSummary(preset, materials)}</span><small className="line-detail">{preset.lines.map((line) => `${materialName(line.materialId)} · ${line.role}`).join(' · ')}</small></td><td>{preset.compatibleCategories.map(categoryLabel).join(', ')}</td><td><span className={`status-pill ${preset.isActive ? 'status-active' : ''}`}>{preset.isActive ? 'Active' : 'Archived'}</span></td><td className="row-actions"><button type="button" className="text-button" onClick={() => { setEditingMixId(preset.id); setMixForm(mixToForm(preset)); setMixFeedback(null); }}>Edit</button>{preset.isActive && <button type="button" className="text-button danger" onClick={() => void archiveMix(preset)}>Archive</button>}</td></tr>)}</tbody></table>}</div>
            <div className="list-footer"><span>Preset ratios stay relative; Phase 1 handles material-specific normalization.</span><span>{mixPresets.filter((item) => item.isActive).length} active</span></div>
          </div>
        </div>
      )}
    </section>
  );
}
