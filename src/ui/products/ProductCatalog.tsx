import { useMemo, useState } from 'react';
import type { MixPreset } from '../../domain/mixPresets';
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_RULES, type Product, type ProductCategory } from '../../domain/products';
import { ProductLabelPrintDialog } from './ProductLabelPrintDialog';

interface ProductCatalogProps {
  products: readonly Product[];
  mixPresets: readonly MixPreset[];
  loading: boolean;
  loadFailed: boolean;
  disabled: boolean;
  editingId: string | null;
  onEdit: (product: Product) => void;
  onNew: () => void;
  onComponents: (product: Product) => void;
  onToggleActive: (product: Product) => void;
}

export function ProductCatalog({
  products,
  mixPresets,
  loading,
  loadFailed,
  disabled,
  editingId,
  onEdit,
  onNew,
  onComponents,
  onToggleActive,
}: ProductCatalogProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ProductCategory | 'all'>('all');
  const [status, setStatus] = useState<'active' | 'archived' | 'all'>('active');
  const [sort, setSort] = useState<'name' | 'category'>('name');
  const [labelProduct, setLabelProduct] = useState<Product | null>(null);
  const mixById = useMemo(() => new Map(mixPresets.map((mix) => [mix.id.toLowerCase(), mix])), [mixPresets]);
  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    return products
      .filter((product) => {
        const mix = mixById.get(product.mixPresetId?.toLowerCase() ?? '');
        return (
          (status === 'all' || product.isActive === (status === 'active')) &&
          (category === 'all' || category === product.category) &&
          [product.name, product.id, product.notes ?? '', product.mixPresetId ?? '', mix?.name ?? ''].some((value) =>
            value.toLowerCase().includes(search),
          )
        );
      })
      .sort(
        (a, b) =>
          (sort === 'category'
            ? PRODUCT_CATEGORY_RULES[a.category].label.localeCompare(PRODUCT_CATEGORY_RULES[b.category].label)
            : 0) ||
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) ||
          a.id.localeCompare(b.id),
      );
  }, [products, mixById, query, category, status, sort]);
  const filtered = query !== '' || category !== 'all' || status !== 'active';

  function clearFilters() {
    setQuery('');
    setCategory('all');
    setStatus('active');
  }

  return (
    <section className="panel product-catalog" aria-label="Product catalog" aria-busy={loading}>
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">YOUR COLLECTION</p>
          <h2>Product catalog</h2>
        </div>
        <button type="button" className="button button-primary" disabled={disabled} onClick={onNew}>
          + New product
        </button>
      </div>
      <label className="field product-catalog-search">
        <span className="sr-only">Search products</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, ID, mix, or notes"
        />
      </label>
      <div className="product-category-filters" role="group" aria-label="Filter by category">
        <button type="button" aria-pressed={category === 'all'} onClick={() => setCategory('all')}>
          All categories
        </button>
        {PRODUCT_CATEGORIES.map((value) => (
          <button type="button" key={value} aria-pressed={category === value} onClick={() => setCategory(value)}>
            {PRODUCT_CATEGORY_RULES[value].label}
          </button>
        ))}
      </div>
      <div className="product-catalog-toolbar">
        <label className="field">
          <span>Status</span>
          <select
            aria-label="Product status filter"
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
          >
            <option value="active">Active products</option>
            <option value="archived">Archived products</option>
            <option value="all">All products</option>
          </select>
        </label>
        <label className="field">
          <span>Sort by</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
            <option value="name">Name A to Z</option>
            <option value="category">Category, then name</option>
          </select>
        </label>
        {filtered && (
          <button type="button" className="text-button" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>
      <p className="product-result-count" role="status">
        {loadFailed
          ? 'Catalog could not be refreshed'
          : loading
            ? 'Loading your collection...'
            : `${visible.length} of ${products.length} products shown`}
      </p>
      {loadFailed ? (
        <div className="empty-state">
          <h3>Catalog unavailable</h3>
          <p>Use Retry loading above to reconnect to your product collection.</p>
        </div>
      ) : loading ? (
        <div className="empty-state">
          <p>Loading products...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="empty-state">
          <span className="product-category-icon" aria-hidden="true">
            01
          </span>
          <h3>Make room for your first creation</h3>
          <p>Add a product, choose its category, and set the material reserve for future batches.</p>
          <button type="button" className="button button-quiet" disabled={disabled} onClick={onNew}>
            Add your first product
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <h3>No matching products</h3>
          <p>Try a different search, category, or status to find what you need.</p>
          <button type="button" className="button button-quiet" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className="product-card-grid">
          {visible.map((product) => {
            const mix = mixById.get(product.mixPresetId?.toLowerCase() ?? '');
            return (
              <article
                key={product.id}
                className={`product-catalog-card ${editingId === product.id ? 'is-editing' : ''}`}
                aria-label={product.name}
              >
                <div className="product-card-top">
                  <span className={`product-category-icon category-${product.category}`} aria-hidden="true">
                    {product.category === 'candle' ? 'C' : product.category === 'candle-pot' ? 'P' : 'A'}
                  </span>
                  <span className={`status-pill ${product.isActive ? 'status-active' : ''}`}>
                    {product.isActive ? 'Active' : 'Archived'}
                  </span>
                </div>
                <div>
                  <p className="product-card-category">{PRODUCT_CATEGORY_RULES[product.category].label}</p>
                  <h3>{product.name}</h3>
                  <span className="material-id">{product.id}</span>
                </div>
                <dl className="product-card-facts">
                  <div>
                    <dt>Mix preset</dt>
                    <dd>
                      {mix?.name ?? product.mixPresetId ?? 'No mix preset'}
                      {mix && !mix.isActive ? ' (archived)' : ''}
                    </dd>
                  </div>
                  <div>
                    <dt>Material reserve</dt>
                    <dd>{(product.safetyWasteRate * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%</dd>
                  </div>
                </dl>
                {product.notes && (
                  <details className="product-card-notes">
                    <summary>Production notes</summary>
                    <p>{product.notes}</p>
                  </details>
                )}
                <div className="product-card-actions">
                  <button
                    type="button"
                    className="button button-quiet"
                    disabled={disabled}
                    aria-label={`Edit ${product.name}`}
                    onClick={() => onEdit(product)}
                  >
                    {editingId === product.id ? 'Editing' : 'Edit product'}
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    disabled={disabled}
                    aria-label={`Components for ${product.name}`}
                    onClick={() => onComponents(product)}
                  >
                    Components
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    disabled={disabled}
                    aria-label={`Print label for ${product.name}`}
                    onClick={() => setLabelProduct(product)}
                  >
                    Print label
                  </button>
                  <button
                    type="button"
                    className={`text-button ${product.isActive ? 'danger' : ''}`}
                    disabled={disabled}
                    aria-label={`${product.isActive ? 'Archive' : 'Restore'} ${product.name}`}
                    onClick={() => onToggleActive(product)}
                  >
                    {product.isActive ? 'Archive' : 'Restore'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {labelProduct && <ProductLabelPrintDialog product={labelProduct} onClose={() => setLabelProduct(null)} />}
    </section>
  );
}
