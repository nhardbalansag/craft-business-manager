import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Product } from '../../domain/products';
import { getProductPhotos } from '../../domain/productPhotos';
import { AppIcon } from '../icons/AppIcon';
import './productImageZoom.css';

type ImageProduct = Pick<Product, 'name' | 'imageDataUrl' | 'brochureImageDataUrl'>;

export interface ProductImageZoomProps {
  product: ImageProduct;
  imageClassName?: string;
  alt?: string;
  disabled?: boolean;
}

/** Reuses the saved Product thumbnail but expands to the sharper brochure photo when available. */
export function ProductImageZoom({ product, imageClassName = '', alt, disabled = false }: ProductImageZoomProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { thumbnail, brochure } = getProductPhotos(product);
  const preview = thumbnail ?? brochure;
  const enlarged = brochure ?? thumbnail;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' || event.key === 'Tab') {
        // A Product details dialog may also be underneath this image viewer.
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.key === 'Escape') setOpen(false);
        else closeRef.current?.focus();
      }
    }

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus();
    };
  }, [open]);

  if (!preview || !enlarged) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="product-image-zoom-trigger"
        aria-label={`View full-size image of ${product.name}`}
        title="Click to enlarge product image"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <img
          className={imageClassName}
          src={preview}
          alt={alt ?? `Product reference: ${product.name}`}
          loading="lazy"
          decoding="async"
        />
        <span className="product-image-zoom-hint" aria-hidden="true"><AppIcon name="search" size={13} /></span>
      </button>
      {open && createPortal(
        <div
          className="product-image-zoom-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section className="product-image-zoom-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <header className="product-image-zoom-heading">
              <h2 id={titleId}>{product.name}</h2>
              <button
                ref={closeRef}
                type="button"
                className="button button-secondary"
                aria-label="Close enlarged product image"
                onClick={() => setOpen(false)}
              >
                <AppIcon name="close" size={17} /> Close
              </button>
            </header>
            <div className="product-image-zoom-canvas">
              <img src={enlarged} alt={product.name} />
            </div>
            <p className="product-image-zoom-caption">
              {brochure ? 'Showing the saved high-resolution brochure image.' : 'Showing the saved product photo. Reupload the original image for a sharper enlarged view.'}
            </p>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
