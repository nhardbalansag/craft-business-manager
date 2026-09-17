import { useCallback, useEffect, useState } from 'react';
import { productService } from '../../application/session';
import type { Product } from '../../domain/products';
import { PhysicalIdentificationWorkspace } from './PhysicalIdentificationWorkspace';
import { ProductsPage } from './ProductsPage';

type ProductsWorkspaceMode = 'catalog' | 'physical';

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Products could not be loaded for physical identification.';
}

export function ProductsWorkspacePage() {
  const [mode, setMode] = useState<ProductsWorkspaceMode>('catalog');
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    setLoadError(null);
    try {
      setProducts(await productService.listProducts());
    } catch (error) {
      setLoadError(message(error));
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    if (mode === 'physical') void loadProducts();
  }, [loadProducts, mode]);

  return (
    <section aria-label="Products workspace">
      <nav className="workspace-switcher" aria-label="Products workshop areas">
        <button
          type="button"
          className={mode === 'catalog' ? 'active' : ''}
          aria-pressed={mode === 'catalog'}
          onClick={() => setMode('catalog')}
        >
          <strong>Catalog &amp; recipes</strong>
          <small>Products, mixes, components &amp; stock</small>
        </button>
        <button
          type="button"
          className={mode === 'physical' ? 'active' : ''}
          aria-pressed={mode === 'physical'}
          onClick={() => setMode('physical')}
        >
          <strong>Molds &amp; storage</strong>
          <small>Physical IDs, locations &amp; labels</small>
        </button>
      </nav>

      {mode === 'catalog' ? (
        <ProductsPage />
      ) : loadError ? (
        <div className="feedback feedback-error" role="alert">
          Could not load Products for physical identification: {loadError}{' '}
          <button type="button" className="text-button" disabled={loadingProducts} onClick={() => void loadProducts()}>
            Retry loading
          </button>
        </div>
      ) : loadingProducts ? (
        <div className="panel empty-state" role="status">Loading physical identification workspace…</div>
      ) : (
        <PhysicalIdentificationWorkspace products={products} />
      )}
    </section>
  );
}
