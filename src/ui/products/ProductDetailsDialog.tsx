import { useEffect, useRef } from 'react';
import { PRODUCT_CATEGORY_RULES, type Product } from '../../domain/products';
import { isValidProductImageDataUrl } from '../../domain/productImage';
import './productDetailsDialog.css';

interface ProductDetailsDialogProps {
  product: Product;
  onClose: () => void;
  onEdit: () => void;
  onComponents: () => void;
}

/** Read-only, customer-neutral summary of authoritative saved Product data. */
export function ProductDetailsDialog({
  product,
  onClose,
  onEdit,
  onComponents,
}: ProductDetailsDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      } else if (event.key === 'Tab') {
        const focusable = Array.from(
          dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [],
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const category = PRODUCT_CATEGORY_RULES[product.category];
  const imageDataUrl = isValidProductImageDataUrl(product.imageDataUrl)
    ? product.imageDataUrl
    : null;
  const materialReserve = (product.safetyWasteRate * 100).toLocaleString(
    'en-PH',
    { maximumFractionDigits: 3 },
  );

  return (
    <div
      className="product-view-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="product-view-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-view-title"
        aria-describedby="product-view-subtitle"
      >
        <div className="product-view-heading">
          <div>
            <p className="panel-kicker">PRODUCT DETAILS</p>
            <h2 id="product-view-title">{product.name}</h2>
            <p id="product-view-subtitle">Saved information · Read-only view</p>
          </div>
          <button
            ref={closeRef}
            className="button button-secondary"
            type="button"
            aria-label="Close product view"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="product-view-layout">
          <div className="product-view-photo" aria-label="Product photo">
            {imageDataUrl ? (
              <img src={imageDataUrl} alt={product.name} />
            ) : (
              <span>No product photo uploaded</span>
            )}
          </div>

          <div className="product-view-content">
            <div className="product-view-status-line">
              <span className="product-view-category">{category.label}</span>
              <span className={\`status-pill \${product.isActive ? 'status-active' : ''}\`}>
                {product.isActive ? 'Active' : 'Archived'}
              </span>
            </div>

            <dl className="product-view-facts">
              <div><dt>Product ID</dt><dd>{product.id}</dd></div>
              <div><dt>Category</dt><dd>{category.label}</dd></div>
              <div><dt>Production style</dt><dd>{category.productionStyle === 'molded' ? 'Molded' : 'Poured'}</dd></div>
              <div><dt>Material reserve</dt><dd>{materialReserve}%</dd></div>
              {product.mixPresetId && <div><dt>Mix preset ID</dt><dd>{product.mixPresetId}</dd></div>}
              {product.preferredYieldSampleId && (
                <div><dt>Preferred Yield sample</dt><dd>{product.preferredYieldSampleId}</dd></div>
              )}
              {product.candleWaxMaterialId && (
                <div><dt>Candle wax material ID</dt><dd>{product.candleWaxMaterialId}</dd></div>
              )}
              {product.candleEssentialOilMaterialId && (
                <div><dt>Essential oil material ID</dt><dd>{product.candleEssentialOilMaterialId}</dd></div>
              )}
            </dl>
          </div>
        </div>

        <div className="product-view-notes">
          <h3>Workshop notes</h3>
          <p>{product.notes?.trim() || 'No workshop notes saved for this product.'}</p>
        </div>

        <div className="product-view-actions">
          <button type="button" className="button button-quiet" onClick={onComponents}>View components</button>
          <button type="button" className="button button-primary" onClick={onEdit}>Edit product</button>
        </div>
      </section>
    </div>
  );
}
