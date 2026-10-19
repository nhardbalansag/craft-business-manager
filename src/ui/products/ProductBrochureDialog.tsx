import { useEffect, useRef, useState } from 'react';
import type { Product } from '../../domain/products';
import { PRODUCT_CATEGORY_RULES } from '../../domain/products';
import { isValidProductImageDataUrl } from '../../domain/productImage';
import { isValidBrochureImageDataUrl } from '../../domain/productBrochureImage';
import {
  loadProductBrochurePrices,
  type BrochurePriceOption,
} from './productBrochurePricing';
import {
  printProductBrochure,
  type ProductBrochureView,
} from './productBrochurePrint';
import './productBrochureDialog.css';

export interface ProductBrochureDialogProps {
  product: Product;
  onClose: () => void;
  loadPrices?: (productId: string) => Promise<BrochurePriceOption[]>;
  onPrint?: (view: ProductBrochureView) => void;
}

function money(value: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency', currency: 'PHP',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value);
}

export function ProductBrochureDialog({
  product,
  onClose,
  loadPrices = loadProductBrochurePrices,
  onPrint = printProductBrochure,
}: ProductBrochureDialogProps) {
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState<BrochurePriceOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const category = PRODUCT_CATEGORY_RULES[product.category];
  const printPhoto = isValidBrochureImageDataUrl(product.brochureImageDataUrl)
    ? product.brochureImageDataUrl
    : isValidProductImageDataUrl(product.imageDataUrl) ? product.imageDataUrl : null;
  const hasPhoto = printPhoto !== null;
  const hasPrintQualityPhoto = isValidBrochureImageDataUrl(product.brochureImageDataUrl);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setOptions([]);
    setSelectedIds([]);
    setPriceError(null);
    setDescription('');
    setPrintError(null);
    void loadPrices(product.id).then((prices) => {
      if (cancelled) return;
      const valid = prices.filter((option) => Number.isFinite(option.unitPrice) && option.unitPrice >= 0);
      setOptions(valid);
      setSelectedIds(valid.slice(0, 3).map((price) => price.id));
    }).catch((error: unknown) => {
      if (cancelled) return;
      setPriceError(error instanceof Error ? error.message : 'Unable to load Product selling prices.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [product.id, loadPrices]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      } else if (event.key === 'Tab') {
        const elements = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), input:not(:disabled)') ?? [],
        );
        if (!elements.length) return;
        const first = elements[0]!;
        const last = elements[elements.length - 1]!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const selected = options.filter((option) => selectedIds.includes(option.id)).slice(0, 3);
  const view: ProductBrochureView = {
    productId: product.id,
    name: product.name,
    categoryLabel: category.label,
    description,
    imageDataUrl: printPhoto,
    prices: selected,
  };

  function togglePrice(id: string, checked: boolean) {
    setSelectedIds((current) => checked
      ? (current.includes(id) || current.length >= 3 ? current : [...current, id])
      : current.filter((value) => value !== id));
  }

  function print() {
    setPrintError(null);
    try {
      onPrint(view);
    } catch (error) {
      setPrintError(error instanceof Error ? error.message : 'Could not open the brochure print window.');
    }
  }

  return (
    <div
      className="product-brochure-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-brochure-title"
        className="product-brochure-dialog"
      >
        <div className="product-brochure-heading">
          <div>
            <p className="panel-kicker">MY LOVELY CRAFT · PRINTABLE BROCHURE</p>
            <h2 id="product-brochure-title">Product brochure</h2>
            <p>Prepare a customer-facing A4 sheet for {product.name}. Nothing here changes your saved Product.</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="button button-secondary"
            aria-label="Close product brochure"
            onClick={onClose}
          >Close</button>
        </div>

        <div className="product-brochure-layout">
          <div className="product-brochure-controls">
            <label className="field">
              <span>Brochure description</span>
              <textarea
                aria-label="Brochure description"
                value={description}
                maxLength={200}
                rows={4}
                placeholder="e.g. Handcrafted plaster candle vessel with a soft pastel finish."
                onChange={(event) => setDescription(event.target.value)}
              />
              <small>Optional. Write customer-facing copy; internal workshop notes are never printed.</small>
            </label>

            <div className="product-brochure-photo-note">
              {hasPrintQualityPhoto
                ? 'High-resolution brochure photo ready for A4 printing.'
                : hasPhoto
                  ? 'This Product only has an old low-resolution thumbnail. Reupload the original photo under Edit Product to get a sharp brochure.'
                  : 'No Product photo is uploaded yet. Edit the Product and upload a good-resolution photo for the brochure.'}
            </div>

            <fieldset className="product-brochure-prices" disabled={loading}>
              <legend>Price &amp; packages <small>(up to 3)</small></legend>
              {loading && <p role="status">Loading saved selling prices…</p>}
              {!loading && priceError && <p className="product-brochure-error" role="alert">{priceError}</p>}
              {!loading && options.length === 0 && (
                <p>No ready selling prices. Brochure will display “Contact us for pricing” instead.</p>
              )}
              {options.map((option) => (
                <label key={option.id} className="product-brochure-price-option">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(option.id)}
                    disabled={!selectedIds.includes(option.id) && selectedIds.length >= 3}
                    onChange={(event) => togglePrice(option.id, event.target.checked)}
                  />
                  <span>
                    <strong>{option.label} · {money(option.unitPrice)}/pc</strong>
                    <small>{option.detail} · minimum {option.quantity} pcs</small>
                  </span>
                </label>
              ))}
              {options.length > 3 && <small>Choose up to three prices to match your sample brochure layout.</small>}
            </fieldset>

            <div className="product-brochure-print-actions">
              <button
                type="button"
                className="button button-primary"
                disabled={loading}
                onClick={print}
              >
                Print / Save as PDF
              </button>
              <small>In the browser print dialog, choose A4 portrait or Save as PDF, with headers and footers turned off.</small>
              {printError && <p className="product-brochure-error" role="alert">{printError}</p>}
            </div>
          </div>

          <div className="product-brochure-preview-container">
            <p className="product-brochure-preview-label">Brochure preview · A4 portrait</p>
            <div className="product-brochure-preview" aria-label="Brochure preview">
              <header>
                <img src="/brand/mlc-mark.webp" alt="" />
                <strong>MY LOVELY CRAFT</strong>
                <small>CANDLES · PLASTER PAINT · GIFTS</small>
              </header>
              <p className="product-brochure-category">{category.label.toUpperCase()}</p>
              <div className="product-brochure-hero">
                {hasPhoto
                  ? <img src={printPhoto ?? undefined} alt={product.name} />
                  : <span>No product photo</span>}
              </div>
              <h3>{product.name}</h3>
              <p className="product-brochure-description">
                {description.trim() || 'Handcrafted with love for your special moments.'}
              </p>
              {selected.length > 0 ? (
                <div className="product-brochure-preview-pricing">
                  <strong>PRICE &amp; PACKAGES</strong>
                  <div className="product-brochure-preview-tiers">
                    {selected.map((option) => (
                      <div key={option.id}>
                        <span>{option.label}</span>
                        <strong>{money(option.unitPrice)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="product-brochure-preview-inquiry">CONTACT US FOR PRICING</div>
              )}
              <p className="product-brochure-code">PRODUCT CODE {product.id} · CUSTOM ORDERS WELCOME</p>
              <footer>CRAFTED WITH LOVE · mylovelycraft.coresite.pro</footer>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
