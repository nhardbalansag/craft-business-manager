import { useEffect, useMemo, useState } from 'react';
import type { MixPreset } from '../../domain/mixPresets';
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_RULES, type Product, type ProductCategory } from '../../domain/products';
import { AppIcon } from '../icons/AppIcon';
import { ProductLabelPrintDialog } from './ProductLabelPrintDialog';
import './productCatalogEditorSeparation.css';

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
  editorOpen?: boolean;
  onBack?: () => void;
  onResume?: () => void;
  hasDraft?: boolean;
}

type ProductEditorIntent =
  | { mode: 'new' }
  | { mode: 'edit'; productName: string; productId: string }
  | null;

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
  editorOpen,
  onBack,
  onResume,
  hasDraft,
}: ProductCatalogProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ProductCategory | 'all'>('all');
  const [status, setStatus] = useState<'active' | 'archived' | 'all'>('active');
  const [sort, setSort] = useState<'name' | 'category'>('name');
  const [density, setDensity] = useState<'cards' | 'compact' | 'table'>('cards');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 25 | 50>(10);
  const [labelProduct, setLabelProduct] = useState<Product | null>(null);
  const [localEditorIntent, setEditorIntent] = useState<ProductEditorIntent>(null);
  const editingProduct = products.find((product) => product.id === editingId);
  const editorIntent: ProductEditorIntent = editorOpen === undefined ? localEditorIntent : !editorOpen ? null
    : editingId ? { mode: 'edit', productName: editingProduct?.name ?? editingId, productId: editingId } : { mode: 'new' };
  const mixById = useMemo(() => new Map(mixPresets.map((mix) => [mix.id.toLowerCase(), mix])), [mixPresets]);
  const matchingProducts = useMemo(() => {
    const search = query.trim().toLowerCase();
    return products
      .filter((product) => {
        const mix = mixById.get(product.mixPresetId?.toLowerCase() ?? '');
        return (
          (status === 'all' || product.isActive === (status === 'active')) &&
          [product.name, product.id, product.notes ?? '', product.mixPresetId ?? '', mix?.name ?? ''].some((value) =>
            value.toLowerCase().includes(search),
          )
        );
      });
  }, [products, mixById, query, status]);
  const visible = useMemo(() => matchingProducts
      .filter((product) => category === 'all' || category === product.category)
      .sort(
        (a, b) =>
          (sort === 'category'
            ? PRODUCT_CATEGORY_RULES[a.category].label.localeCompare(PRODUCT_CATEGORY_RULES[b.category].label)
            : 0) ||
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) ||
          a.id.localeCompare(b.id),
      ), [matchingProducts, category, sort]);
  const filtered = query !== '' || category !== 'all' || status !== 'active';
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const pageStart = (page - 1) * pageSize;
  const paginatedVisible = visible.slice(pageStart, pageStart + pageSize);
  const shownStart = visible.length === 0 ? 0 : pageStart + 1;
  const shownEnd = Math.min(pageStart + pageSize, visible.length);
  const paginationItems = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const pages = Array.from(
      new Set([1, totalPages, page - 1, page, page + 1].filter((value) => value >= 1 && value <= totalPages)),
    ).sort((left, right) => left - right);

    const items: Array<number | 'ellipsis-left' | 'ellipsis-right'> = [];
    pages.forEach((value, index) => {
      const previous = pages[index - 1];
      if (previous !== undefined && value - previous > 1) {
        items.push(previous === 1 ? 'ellipsis-left' : 'ellipsis-right');
      }
      items.push(value);
    });
    return items;
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [query, category, status, sort, pageSize]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  function clearFilters() {
    setQuery('');
    setCategory('all');
    setStatus('active');
  }

  function startNewProduct() {
    onNew();
    setEditorIntent({ mode: 'new' });
  }

  function startEditProduct(product: Product) {
    onEdit(product);
    setEditorIntent({ mode: 'edit', productName: product.name, productId: product.id });
  }

  return (
    <section
      className={`panel product-catalog ${editorIntent ? 'is-editor-shell-open' : ''}`}
      aria-label="Product catalog"
      aria-busy={loading}
    >
      {editorIntent && (
        <div className="product-editor-shell" aria-label="Product editor navigation">
          <div className="product-editor-navigation">
            <button
              type="button"
              className="product-editor-back"
              disabled={disabled}
              onClick={() => { setEditorIntent(null); onBack?.(); }}
            >
              <AppIcon name="arrow-left" size={16} />
              Back to product catalog
            </button>
            <div className="product-editor-breadcrumb" aria-label="Product editor location">
              <span>Products</span>
              <span aria-hidden="true">/</span>
              <span>Product catalog</span>
              <span aria-hidden="true">/</span>
              <strong>{editorIntent.mode === 'new' ? 'Add product' : 'Edit product'}</strong>
            </div>
          </div>

          <div className="product-editor-context">
            <div>
              <p className="panel-kicker">PRODUCT EDITOR</p>
              <h2>{editorIntent.mode === 'new' ? 'Add a new product' : `Edit ${editorIntent.productName}`}</h2>
              <p>
                {editorIntent.mode === 'new'
                  ? 'Set up the product identity, production recipe, and material reserve.'
                  : `Update the details for ${editorIntent.productId}, then save your changes.`}
              </p>
            </div>
            <span className="product-editor-mode-pill">
              {editorIntent.mode === 'new' ? 'New product' : 'Editing'}
            </span>
          </div>

          <div className="product-editor-draft-note">
            <strong>Focused editing</strong>
            <span>Your draft is preserved if you return to the catalog before saving.</span>
          </div>
        </div>
      )}

      <div className="product-catalog-collection" hidden={Boolean(editorIntent)}>
        {hasDraft && onResume && (
          <div className="product-resume-draft">
            <div><strong>Continue your unsaved draft</strong><p>{editingProduct ? `Changes to ${editingProduct.name}` : 'A new product is in progress.'}</p></div>
            <button type="button" className="button button-quiet" disabled={disabled} onClick={onResume}>Resume draft</button>
          </div>
        )}
        <div className="panel-heading">
          <div>
            <p className="panel-kicker">YOUR COLLECTION</p>
            <h2>Product catalog</h2>
            <p className="product-catalog-purpose">Browse, search, organize, and manage your collection. Product data entry opens separately.</p>
          </div>
          <div className="product-catalog-heading-actions">
            <button
              type="button"
              className="button button-primary"
              disabled={disabled}
              aria-label="+ New product"
              onClick={startNewProduct}
            >
              + Add product
            </button>
          </div>
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
          <button type="button" aria-label="All categories" aria-pressed={category === 'all'} onClick={() => setCategory('all')}>
            All categories <span className="product-filter-count" aria-hidden="true">{loading || loadFailed ? '-' : matchingProducts.length}</span>
          </button>
          {PRODUCT_CATEGORIES.map((value) => (
            <button type="button" key={value} aria-label={PRODUCT_CATEGORY_RULES[value].label} aria-pressed={category === value} onClick={() => setCategory(value)}>
              {PRODUCT_CATEGORY_RULES[value].label} <span className="product-filter-count" aria-hidden="true">{loading || loadFailed ? '-' : matchingProducts.filter((product) => product.category === value).length}</span>
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
        <div className="product-results-toolbar">
          <p className="product-result-count" role="status" aria-live="polite">
            {loadFailed
              ? 'Catalog could not be refreshed'
              : loading
                ? 'Loading your collection...'
                : `${visible.length} of ${products.length} products shown`}
          </p>
          <div className="product-density-control" role="group" aria-label="Catalog layout">
            <button type="button" aria-pressed={density === 'cards'} onClick={() => setDensity('cards')}>Cards</button>
            <button type="button" aria-pressed={density === 'compact'} onClick={() => setDensity('compact')}>Compact</button>
            <button type="button" aria-pressed={density === 'table'} onClick={() => setDensity('table')}>Table</button>
          </div>
        </div>
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
              <AppIcon name="products" size={22} />
            </span>
            <h3>Make room for your first creation</h3>
            <p>Add a product, choose its category, and set the material reserve for future batches.</p>
            <button type="button" className="button button-quiet" disabled={disabled} onClick={startNewProduct}>
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
        ) : density === 'table' ? (
          <div
            className="table-wrap product-catalog-table-wrap"
            tabIndex={0}
            aria-label="Product catalog table"
          >
            <table className="products-table product-catalog-table">
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">Category</th>
                  <th scope="col">Mix preset</th>
                  <th scope="col">Material reserve</th>
                  <th scope="col">Status</th>
                  <th scope="col">Notes</th>
                  <th scope="col" className="product-table-actions-heading">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedVisible.map((product) => {
                  const mix = mixById.get(product.mixPresetId?.toLowerCase() ?? '');
                  return (
                    <tr
                      key={product.id}
                      className={editingId === product.id ? 'is-editing' : ''}
                    >
                      <td>
                        <div className="product-table-identity">
                          <span className={`product-category-icon category-${product.category}`} aria-hidden="true">
                            {product.category === 'candle'
                              ? <AppIcon name="flame" size={16} />
                              : product.category === 'candle-pot'
                                ? <AppIcon name="jar" size={16} />
                                : <AppIcon name="palette" size={16} />}
                          </span>
                          <span>
                            <strong>{product.name}</strong>
                            <small className="material-id">{product.id}</small>
                          </span>
                        </div>
                      </td>
                      <td>{PRODUCT_CATEGORY_RULES[product.category].label}</td>
                      <td>
                        {mix?.name ?? product.mixPresetId ?? 'No mix preset'}
                        {mix && !mix.isActive ? ' (archived)' : ''}
                      </td>
                      <td>
                        {(product.safetyWasteRate * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%
                      </td>
                      <td>
                        <span className={`status-pill ${product.isActive ? 'status-active' : ''}`}>
                          {product.isActive ? 'Active' : 'Archived'}
                        </span>
                      </td>
                      <td>
                        <span className="product-table-notes">
                          {product.notes?.trim() || '—'}
                        </span>
                      </td>
                      <td>
                        <div className="product-table-actions">
                          <button
                            type="button"
                            className="button button-quiet"
                            disabled={disabled}
                            aria-label={`Edit ${product.name}`}
                            onClick={() => startEditProduct(product)}
                          >
                            {editingId === product.id ? 'Continue editing' : 'Edit'}
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={`product-card-grid ${density === 'compact' ? 'is-compact' : ''}`}>
            {paginatedVisible.map((product) => {
              const mix = mixById.get(product.mixPresetId?.toLowerCase() ?? '');
              return (
                <article
                  key={product.id}
                  className={`product-catalog-card ${editingId === product.id ? 'is-editing' : ''}`}
                  aria-label={product.name}
                >
                  <div className="product-card-top">
                    <span className={`product-category-icon category-${product.category}`} aria-hidden="true">
                      {product.category === 'candle'
                        ? <AppIcon name="flame" size={18} />
                        : product.category === 'candle-pot'
                          ? <AppIcon name="jar" size={18} />
                          : <AppIcon name="palette" size={18} />}
                    </span>
                    <span className={`status-pill ${product.isActive ? 'status-active' : ''}`}>
                      {product.isActive ? 'Active' : 'Archived'}
                    </span>
                  </div>
                  <div className="product-card-identity">
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
                      onClick={() => startEditProduct(product)}
                    >
                      {editingId === product.id ? 'Continue editing' : 'Edit product'}
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

        {!loading && !loadFailed && visible.length > 0 && (
          <nav className="product-pagination" aria-label="Product catalog pagination">
            <div className="product-pagination-summary" role="status" aria-live="polite">
              Showing <strong>{shownStart}–{shownEnd}</strong> of <strong>{visible.length}</strong> products
            </div>

            <div className="product-pagination-pages">
              <button
                type="button"
                className="button button-quiet"
                disabled={page === 1}
                aria-label="Previous product page"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </button>

              <div className="product-pagination-numbers" aria-label="Product pages">
                {paginationItems.map((item) =>
                  typeof item === 'number' ? (
                    <button
                      key={item}
                      type="button"
                      className="product-page-button"
                      aria-label={`Product page ${item}`}
                      aria-current={page === item ? 'page' : undefined}
                      onClick={() => setPage(item)}
                    >
                      {item}
                    </button>
                  ) : (
                    <span key={item} className="product-pagination-ellipsis" aria-hidden="true">…</span>
                  ),
                )}
              </div>

              <button
                type="button"
                className="button button-quiet"
                disabled={page === totalPages}
                aria-label="Next product page"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                Next
              </button>
            </div>

            <label className="field product-page-size">
              <span>Products per page</span>
              <select
                aria-label="Products per page"
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value) as 10 | 25 | 50)}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </label>
          </nav>
        )}
      </div>

      {labelProduct && <ProductLabelPrintDialog product={labelProduct} onClose={() => setLabelProduct(null)} />}
    </section>
  );
}
