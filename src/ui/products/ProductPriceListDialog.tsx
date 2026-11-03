import { useEffect, useMemo, useRef, useState } from 'react';
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_RULES, type Product } from '../../domain/products';
import { loadProductBrochurePrices, type BrochurePriceOption } from './productBrochurePricing';
import {
  comparePriceListProducts, filterPriceListProducts, loadProductPriceList, priceListMoney, priceListPhoto, priceListPriceLabel, priceListPrices,
  type ProductPriceListFilters, type ProductPriceListRow, type ProductPriceListView,
} from './productPriceList';
import { printProductPriceList } from './productPriceListPrint';
import './productPriceList.css';

export interface ProductPriceListDialogProps {
  products: readonly Product[];
  onClose: () => void;
  initialFilters?: Partial<ProductPriceListFilters>;
  loadPrices?: (id: string) => Promise<BrochurePriceOption[]>;
  onPrint?: (view: ProductPriceListView) => void;
}

const PAGE_SIZE = 25;

export function ProductPriceListDialog({
  products, onClose, initialFilters, loadPrices = loadProductBrochurePrices, onPrint = printProductPriceList,
}: ProductPriceListDialogProps) {
  const [filters, setFilters] = useState<ProductPriceListFilters>({
    query: '', category: 'all', status: 'active', pictures: 'all', ...initialFilters,
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [previewPage, setPreviewPage] = useState(1);
  const [includePictures, setIncludePictures] = useState(false);
  const [includePackages, setIncludePackages] = useState(false);
  const [rows, setRows] = useState<ProductPriceListRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const closeCallback = useRef(onClose);
  closeCallback.current = onClose;
  const selectedProducts = useMemo(() => products.filter((product) => selectedIds.has(product.id))
    .sort(comparePriceListProducts), [products, selectedIds]);
  const filteredProducts = useMemo(() => filterPriceListProducts(products, filters), [products, filters]);
  const matches = useMemo(() => selectedOnly ? filteredProducts.filter((product) => selectedIds.has(product.id)) : filteredProducts,
    [filteredProducts, selectedOnly, selectedIds]);
  const matchingSelected = matches.filter((product) => selectedIds.has(product.id)).length;
  const allSelected = matches.length > 0 && matchingSelected === matches.length;
  const hiddenSelected = selectedProducts.length - matchingSelected;
  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const pageRows = matches.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const view: ProductPriceListView = { rows: rows ?? [], includePictures, includePackages };
  const previewPages = Math.max(1, Math.ceil((rows?.length ?? 0) / PAGE_SIZE));
  const previewRows = rows?.slice((previewPage - 1) * PAGE_SIZE, previewPage * PAGE_SIZE) ?? [];

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = matchingSelected > 0 && !allSelected;
  }, [matchingSelected, allSelected]);

  useEffect(() => { setPage(1); }, [filters, selectedOnly]);

  useEffect(() => {
    setPreviewPage(1);
    if (rows) previewRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [rows]);

  useEffect(() => {
    // A changed catalog invalidates generated prices and any in-flight snapshot.
    generation.current++;
    setRows(null);
    setLoading(false);
    setSelectedIds((current) => new Set(products.filter((product) => current.has(product.id)).map((product) => product.id)));
  }, [products]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation(); closeCallback.current();
      } else if (event.key === 'Tab') {
        const elements = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('*') ?? [])
          .filter((element) => element.tabIndex >= 0 && !element.matches(':disabled') && !element.closest('fieldset:disabled'));
        const first = elements[0], last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      generation.current++;
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  function select(next: Set<string>) {
    setSelectedIds(next);
    setRows(null);
    setError(null);
  }

  async function generate() {
    const version = ++generation.current;
    setLoading(true); setRows(null); setError(null);
    try {
      const result = await loadProductPriceList(selectedProducts, loadPrices, () => generation.current !== version);
      if (generation.current === version) setRows(result);
    } catch (cause) {
      if (generation.current === version) setError(cause instanceof Error ? cause.message : 'Could not load saved selling prices. Please try again.');
    } finally {
      if (generation.current === version) setLoading(false);
    }
  }

  function print() {
    setError(null);
    try { onPrint(view); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open the price list print window.'); }
  }

  return (
    <div className="price-list-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="price-list-dialog" role="dialog" aria-modal="true" aria-labelledby="price-list-title">
        <header className="price-list-heading">
          <div><p className="panel-kicker">MY LOVELY CRAFT · CUSTOMER PRICE LIST</p><h2 id="price-list-title">Generate a price list</h2>
            <p>Find your products, choose what to include, then preview and print your list.</p></div>
          <button ref={closeRef} type="button" className="button button-secondary" aria-label="Close price list" onClick={onClose}>Close</button>
        </header>

        <fieldset className="price-list-picker" disabled={loading}>
          <legend>1. Choose products</legend>
          <label className="field price-list-search"><span>Search by product name or code</span>
            <input type="search" value={filters.query} placeholder="e.g. P (1pcs)" onChange={(event) => setFilters({ ...filters, query: event.target.value })} />
          </label>
          <div className="price-list-filters">
            <label className="field"><span>Category</span><select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value as ProductPriceListFilters['category'] })}>
              <option value="all">All categories</option>{PRODUCT_CATEGORIES.map((category) => <option key={category} value={category}>{PRODUCT_CATEGORY_RULES[category].label}</option>)}
            </select></label>
            <label className="field"><span>Product status</span><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value as ProductPriceListFilters['status'] })}>
              <option value="active">Active products</option><option value="archived">Archived products</option><option value="all">All products</option>
            </select></label>
            <label className="field"><span>Picture availability</span><select value={filters.pictures} onChange={(event) => setFilters({ ...filters, pictures: event.target.value as ProductPriceListFilters['pictures'] })}>
              <option value="all">With or without pictures</option><option value="with">With pictures</option><option value="without">Without pictures</option>
            </select></label>
            <button type="button" className="text-button" onClick={() => { setFilters({ query: '', category: 'all', status: 'active', pictures: 'all' }); setSelectedOnly(false); }}>Clear filters</button>
          </div>
          <div className="price-list-selection-toolbar">
            <label className="price-list-check"><input ref={selectAllRef} type="checkbox" checked={allSelected} disabled={!matches.length} onChange={(event) => {
              const next = new Set(selectedIds);
              matches.forEach((product) => event.target.checked ? next.add(product.id) : next.delete(product.id));
              select(next);
            }} />Select all matches ({matches.length})</label>
            <label className="price-list-check"><input type="checkbox" checked={selectedOnly} onChange={(event) => setSelectedOnly(event.target.checked)} />Show selected only</label>
            <button type="button" className="text-button" disabled={!selectedProducts.length} onClick={() => select(new Set())}>Clear selection</button>
          </div>
          <p className="price-list-count" role="status" aria-live="polite">{matches.length} matching · {selectedProducts.length} selected{hiddenSelected > 0 ? ` (${hiddenSelected} outside current filters)` : ''}. Selections stay checked when you change filters.</p>
          <div className="price-list-results" tabIndex={0} role="region" aria-label="Matching products">
            <table><thead><tr><th scope="col">Select</th><th scope="col">Product / code</th><th scope="col">Category</th><th scope="col">Picture</th></tr></thead>
              <tbody>{pageRows.map((product) => <tr key={product.id} className={selectedIds.has(product.id) ? 'is-selected' : ''}>
                <td><input type="checkbox" aria-label={`Select ${product.name} (${product.id})`} checked={selectedIds.has(product.id)} onChange={(event) => {
                  const next = new Set(selectedIds);
                  if (event.target.checked) next.add(product.id); else next.delete(product.id);
                  select(next);
                }} /></td>
                <td><strong>{product.name}</strong><small>{product.id}{!product.isActive ? ' · Archived' : ''}</small></td>
                <td>{PRODUCT_CATEGORY_RULES[product.category].label}</td><td>{priceListPhoto(product) ? 'Available' : 'No picture'}</td>
              </tr>)}</tbody>
            </table>
            {!matches.length && <p className="price-list-empty">No products match. Try another name or code, or clear the filters.</p>}
          </div>
          {pages > 1 && <nav className="price-list-pagination" aria-label="Price list product pages">
            <button type="button" className="button button-secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button>
            <span>Page {currentPage} of {pages} · Select all matches includes every page</span>
            <button type="button" className="button button-secondary" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</button>
          </nav>}
        </fieldset>

        <section className="price-list-options" aria-label="Price list options">
          <h3>2. Choose list options</h3>
          <div className="price-list-option-checks">
            <label className="price-list-check"><input type="checkbox" checked={includePictures} onChange={(event) => setIncludePictures(event.target.checked)} />Include product pictures</label>
            <label className="price-list-check"><input type="checkbox" checked={includePackages} onChange={(event) => setIncludePackages(event.target.checked)} />Include bulk / package prices</label>
          </div>
          <p>Uses your saved selling prices in PHP per piece. Products without a ready price show “Contact us for pricing.”</p>
          <button type="button" className="button button-primary" disabled={loading || !selectedProducts.length} onClick={() => void generate()}>{loading ? 'Loading selling prices…' : `Generate price list (${selectedProducts.length})`}</button>
          {loading && <p role="status">Preparing prices for {selectedProducts.length} products…</p>}
        </section>
        {error && <p className="feedback feedback-error" role="alert">{error}</p>}
        {rows && <section ref={previewRef} className="price-list-preview" aria-label="Price list preview">
          <div className="price-list-preview-heading"><div><h3>Price list preview</h3><p>{rows.length} products · PHP per piece{includePackages ? ' · Package minimums apply' : ' · Single / default prices'}</p></div>
            <button type="button" className="button button-primary" onClick={print}>Print / Save as PDF</button></div>
          <div className="price-list-preview-table" tabIndex={0} role="region" aria-label="Generated price list">
            <table><thead><tr>{includePictures && <th scope="col">Picture</th>}<th scope="col">Product / code</th><th scope="col">Category</th><th scope="col">Selling price / piece</th></tr></thead>
              <tbody>{previewRows.map((row) => {
                const prices = priceListPrices(row, includePackages);
                return <tr key={row.productId}>
                  {includePictures && <td className="price-list-photo">{row.imageDataUrl ? <img src={row.imageDataUrl} alt={row.name} loading="lazy" /> : <small>No picture</small>}</td>}
                  <td><strong>{row.name}</strong><small>{row.productId}</small></td><td>{row.categoryLabel}</td>
                  <td>{prices.length ? prices.map((price) => <div className="price-list-price" key={price.id}><strong>{priceListMoney(price.unitPrice)}</strong><small>{priceListPriceLabel(price)}</small></div>) : <small>Contact us for pricing</small>}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          {previewPages > 1 && <nav className="price-list-pagination" aria-label="Price list preview pages">
            <button type="button" className="button button-secondary" disabled={previewPage === 1} onClick={() => setPreviewPage((current) => current - 1)}>Preview previous</button>
            <span>Page {previewPage} of {previewPages} · Printing includes all {rows.length} products</span>
            <button type="button" className="button button-secondary" disabled={previewPage === previewPages} onClick={() => setPreviewPage((current) => current + 1)}>Preview next</button>
          </nav>}
          <p className="price-list-print-help">Choose A4 portrait or Save as PDF in the print dialog, with browser headers and footers turned off.</p>
        </section>}
      </section>
    </div>
  );
}
