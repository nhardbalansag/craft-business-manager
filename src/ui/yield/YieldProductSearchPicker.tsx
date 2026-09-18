import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react';
import type { Product } from '../../domain/products';
import { PRODUCT_CATEGORY_RULES } from '../../domain/products';
import { AppIcon } from '../icons/AppIcon';
import './yieldProductSearchPicker.css';

const PRODUCT_RESULT_LIMIT = 8;

export interface YieldProductSearchPickerProps {
  readonly products: readonly Product[];
  readonly selectedProductId: string;
  readonly disabled?: boolean;
  readonly onSelect: (productId: string) => void;
}

function productSearchText(product: Product): string {
  return [
    product.name,
    product.id,
    PRODUCT_CATEGORY_RULES[product.category].label,
    product.isActive ? 'active' : 'archived',
  ]
    .join(' ')
    .toLocaleLowerCase();
}

export function YieldProductSearchPicker({
  products,
  selectedProductId,
  disabled = false,
  onSelect,
}: YieldProductSearchPickerProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const listboxId = useId();
  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? null;

  const matchingProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return [...products]
      .filter((product) => !normalizedQuery || productSearchText(product).includes(normalizedQuery))
      .sort((left, right) => {
        if (left.id === selectedProductId && right.id !== selectedProductId) return -1;
        if (right.id === selectedProductId && left.id !== selectedProductId) return 1;
        if (left.isActive !== right.isActive) return left.isActive ? -1 : 1;
        return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
          || left.id.localeCompare(right.id, undefined, { sensitivity: 'base' });
      });
  }, [products, query, selectedProductId]);

  const visibleProducts = matchingProducts.slice(0, PRODUCT_RESULT_LIMIT);
  const activeProduct = visibleProducts[Math.min(activeIndex, Math.max(visibleProducts.length - 1, 0))];

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  function choose(product: Product) {
    setQuery('');
    setOpen(false);
    setActiveIndex(0);
    if (product.id !== selectedProductId) onSelect(product.id);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.min(current + 1, Math.max(visibleProducts.length - 1, 0)));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === 'Enter' && open && activeProduct) {
      event.preventDefault();
      choose(activeProduct);
    }
  }

  return (
    <div
      className="yield-product-picker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <label className="field yield-product-search-field">
        <span>Find product</span>
        <div className="yield-product-search-input-wrap">
          <span className="yield-product-search-icon" aria-hidden="true"><AppIcon name="search" size={18} /></span>
          <input
            type="search"
            role="combobox"
            aria-label="Search products for yield"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-activedescendant={open && activeProduct ? `${listboxId}-${activeProduct.id}` : undefined}
            autoComplete="off"
            value={query}
            disabled={disabled}
            placeholder="Search name, ID, or category…"
            onFocus={() => {
              setOpen(true);
              setActiveIndex(0);
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          {query && !disabled && (
            <button
              type="button"
              className="yield-product-search-clear"
              aria-label="Clear product search"
              onClick={() => {
                setQuery('');
                setOpen(true);
                setActiveIndex(0);
              }}
            >
              <AppIcon name="close" size={16} />
            </button>
          )}
        </div>
        <small>
          {selectedProduct
            ? `Selected: ${selectedProduct.name} · ${selectedProduct.id}`
            : 'Type to find the product whose batch evidence you want to record.'}
        </small>
      </label>

      {open && !disabled && (
        <div className="yield-product-search-menu">
          <div className="yield-product-search-menu-heading">
            <span>{query.trim() ? 'Matching products' : 'Products'}</span>
            <strong>{matchingProducts.length}</strong>
          </div>
          <div id={listboxId} className="yield-product-search-results" role="listbox" aria-label="Yield product search results">
            {visibleProducts.length === 0 ? (
              <div className="yield-product-search-empty" role="status">
                <strong>No matching products</strong>
                <span>Try a product name, Product ID, or category.</span>
              </div>
            ) : visibleProducts.map((product, index) => (
              <button
                id={`${listboxId}-${product.id}`}
                key={product.id}
                type="button"
                role="option"
                aria-selected={product.id === selectedProductId}
                className={`yield-product-search-result ${index === activeIndex ? 'is-keyboard-active' : ''} ${product.id === selectedProductId ? 'is-selected' : ''}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(product)}
              >
                <span className="yield-product-search-result-main">
                  <strong>{product.name}</strong>
                  <small>{product.id} · {PRODUCT_CATEGORY_RULES[product.category].label}</small>
                </span>
                <span className={`yield-product-search-status ${product.isActive ? 'is-active' : 'is-archived'}`}>
                  {product.id === selectedProductId ? 'Selected' : product.isActive ? 'Active' : 'Archived'}
                </span>
              </button>
            ))}
          </div>
          {matchingProducts.length > PRODUCT_RESULT_LIMIT && (
            <div className="yield-product-search-more">
              Showing {PRODUCT_RESULT_LIMIT} of {matchingProducts.length}. Type more to narrow the list.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
