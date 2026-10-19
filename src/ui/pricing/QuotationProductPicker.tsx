import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_RULES, type Product, type ProductCategory } from '../../domain/products';
import { isValidProductImageDataUrl } from '../../domain/productImage';
import { AppIcon } from '../icons/AppIcon';

const PAGE_SIZE = 8;

function normalize(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
}

export function searchQuotationProducts(
  products: readonly Product[],
  query: string,
  category: ProductCategory | 'all',
): Product[] {
  const keywords = normalize(query.trim()).split(/\s+/).filter(Boolean);
  return products
    .filter((product) => {
      if (!product.isActive || (category !== 'all' && product.category !== category)) return false;
      const haystack = normalize([
        product.name,
        product.id,
        PRODUCT_CATEGORY_RULES[product.category].label,
        product.notes ?? '',
      ].join(' '));
      return keywords.every((keyword) => haystack.includes(keyword));
    })
    .sort((left, right) =>
      left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }) ||
      left.id.localeCompare(right.id, undefined, { sensitivity: 'base' }));
}

export interface QuotationProductPickerProps {
  products: readonly Product[];
  selectedProductId: string;
  unavailableProductIds: ReadonlySet<string>;
  lineNumber: number;
  disabled?: boolean;
  onSelect: (id: string) => void;
}

/** Search and category filters belong to each quotation line, not to the entire quotation. */
export function QuotationProductPicker({
  products,
  selectedProductId,
  unavailableProductIds,
  lineNumber,
  disabled = false,
  onSelect,
}: QuotationProductPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ProductCategory | 'all'>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const selected = products.find((product) => product.id === selectedProductId);
  const matches = useMemo(
    () => searchQuotationProducts(products, query, category),
    [products, query, category],
  );
  const selectable = matches.filter(
    (product) => product.id === selectedProductId || !unavailableProductIds.has(product.id),
  );
  const shown = selectable.slice(0, visibleCount);
  const active = shown[activeIndex] ?? null;
  const unavailableCount = matches.length - selectable.length;

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  function openSearch() {
    if (disabled) return;
    setQuery('');
    setCategory('all');
    setVisibleCount(PAGE_SIZE);
    setActiveIndex(-1);
    setOpen(true);
    // The search field mounts on the next render.
  }

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function choose(product: Product) {
    if (product.id !== selectedProductId && unavailableProductIds.has(product.id)) return;
    setOpen(false);
    setQuery('');
    setCategory('all');
    setVisibleCount(PAGE_SIZE);
    setActiveIndex(-1);
    if (product.id !== selectedProductId) onSelect(product.id);
    triggerRef.current?.focus();
  }

  function closeSearch() {
    setOpen(false);
    setActiveIndex(-1);
    triggerRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeSearch();
    } else if (event.target === inputRef.current && event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, shown.length - 1));
    } else if (event.target === inputRef.current && event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(-1, index - 1));
    } else if (event.target === inputRef.current && event.key === 'Enter' && active) {
      event.preventDefault();
      choose(active);
    }
  }

  return (
    <div
      className="quotation-product-picker"
      onKeyDown={handleKeyDown}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <span className="quotation-product-picker-label" id={listId + '-label'}>Product</span>
      <button
        type="button"
        ref={triggerRef}
        className="quotation-product-picker-trigger"
        aria-label={'Find product for quotation item ' + lineNumber}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-describedby={listId + '-label'}
        disabled={disabled}
        onClick={() => open ? closeSearch() : openSearch()}
      >
        {selected?.imageDataUrl && isValidProductImageDataUrl(selected.imageDataUrl) && (
          <img src={selected.imageDataUrl} alt="" className="quotation-product-picker-thumbnail" />
        )}
        <span className="quotation-product-picker-selected">
          <strong>{selected?.name ?? 'Search and select a Product'}</strong>
          <small>
            {selected
              ? selected.id + ' · ' + PRODUCT_CATEGORY_RULES[selected.category].label
              : 'Search name, ID, category or notes'}
          </small>
        </span>
        <AppIcon name="search" size={18} />
      </button>

      {open && !disabled && (
        <div className="quotation-product-picker-search" aria-label={'Product search for item ' + lineNumber}>
          <div className="quotation-product-picker-controls">
            <label className="field">
              <span>Keywords</span>
              <input
                ref={inputRef}
                type="search"
                role="combobox"
                aria-label={'Search quotation products for item ' + lineNumber}
                aria-autocomplete="list"
                aria-expanded={open}
                aria-controls={listId}
                aria-activedescendant={active ? listId + '-' + active.id : undefined}
                autoComplete="off"
                value={query}
                placeholder="Name, ID, category, notes..."
                onChange={(event) => {
                  setQuery(event.target.value);
                  setVisibleCount(PAGE_SIZE);
                  setActiveIndex(-1);
                }}
              />
            </label>
            <label className="field">
              <span>Category</span>
              <select
                aria-label={'Filter quotation products by category for item ' + lineNumber}
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value as ProductCategory | 'all');
                  setVisibleCount(PAGE_SIZE);
                  setActiveIndex(-1);
                }}
              >
                <option value="all">All categories</option>
                {PRODUCT_CATEGORIES.map((key) => (
                  <option key={key} value={key}>{PRODUCT_CATEGORY_RULES[key].label}</option>
                ))}
              </select>
            </label>
            <button
              className="button button-quiet"
              type="button"
              disabled={!query && category === 'all'}
              onClick={() => {
                setQuery('');
                setCategory('all');
                setVisibleCount(PAGE_SIZE);
                setActiveIndex(-1);
                inputRef.current?.focus();
              }}
            >
              Clear filters
            </button>
          </div>
          <div className="quotation-product-picker-results-meta" role="status">
            {selectable.length} available matching {selectable.length === 1 ? 'product' : 'products'}
            {unavailableCount > 0 ? ' · ' + unavailableCount + ' already in quotation' : ''}
          </div>
          <div id={listId} role="listbox" aria-label={'Quotation product results for item ' + lineNumber} className="quotation-product-picker-results">
            {shown.length === 0 ? (
              <div className="quotation-product-picker-empty">
                <strong>No matching products</strong>
                <small>Try another keyword or category. Products already in other items cannot be selected again.</small>
              </div>
            ) : shown.map((product, index) => (
              <button
                key={product.id}
                id={listId + '-' + product.id}
                type="button"
                role="option"
                aria-selected={product.id === selectedProductId}
                className={'quotation-product-picker-result' + (index === activeIndex ? ' is-active' : '')}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(product)}
              >
                {product.imageDataUrl && isValidProductImageDataUrl(product.imageDataUrl) && (
                  <img src={product.imageDataUrl} alt="" className="quotation-product-picker-thumbnail" />
                )}
                <span>
                  <strong>{product.name}</strong>
                  <small>{product.id} · {PRODUCT_CATEGORY_RULES[product.category].label}</small>
                </span>
                {product.id === selectedProductId && <em>Selected</em>}
              </button>
            ))}
          </div>
          {selectable.length > shown.length && (
            <button
              type="button"
              className="button button-secondary quotation-product-picker-more"
              onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
            >
              Show more products ({shown.length} of {selectable.length})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
