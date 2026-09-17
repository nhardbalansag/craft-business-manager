import { useMemo, useState, type FormEvent } from 'react';
import type { Product } from '../../domain/products';
import { renderIdentityCode128Svg, renderIdentityQrSvg } from '../labels/machineReadable';
import { printProductLabels, type ProductLabelPrintWindowOpener } from './productLabelPrint';
import {
  buildProductLabelView,
  DEFAULT_PRODUCT_LABEL_SIZE_ID,
  getProductLabelSizePreset,
  normalizeProductLabelCopies,
  PRODUCT_LABEL_MAX_COPIES,
  PRODUCT_LABEL_MIN_COPIES,
  PRODUCT_LABEL_SIZE_PRESETS,
  type ProductLabelSizeId,
} from './productLabelView';
import './productLabelPrint.css';

interface ProductLabelPrintDialogProps {
  product: Product;
  onClose: () => void;
  openPrintWindow?: ProductLabelPrintWindowOpener;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The product label could not be printed.';
}

export function ProductLabelPrintDialog({ product, onClose, openPrintWindow }: ProductLabelPrintDialogProps) {
  const [sizeId, setSizeId] = useState<ProductLabelSizeId>(DEFAULT_PRODUCT_LABEL_SIZE_ID);
  const [copies, setCopies] = useState('1');
  const [showCategory, setShowCategory] = useState(true);
  const [showStatus, setShowStatus] = useState(true);
  const [showQr, setShowQr] = useState(true);
  const [showBarcode, setShowBarcode] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  const size = getProductLabelSizePreset(sizeId);
  const normalizedCopies = useMemo(() => normalizeProductLabelCopies(Number(copies)), [copies]);
  const view = useMemo(
    () =>
      buildProductLabelView(product, {
        sizeId,
        copies: normalizedCopies,
        showCategory,
        showStatus,
        showQr,
        showBarcode,
      }),
    [normalizedCopies, product, showBarcode, showCategory, showQr, showStatus, sizeId],
  );
  const qrSvg = useMemo(
    () => (view.showQr ? renderIdentityQrSvg('PRODUCT', view.product.id) : ''),
    [view.product.id, view.showQr],
  );
  const barcodeSvg = useMemo(
    () => (view.showBarcode ? renderIdentityCode128Svg(view.product.id) : ''),
    [view.product.id, view.showBarcode],
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    setFeedback(null);
    try {
      if (openPrintWindow) printProductLabels(view, openPrintWindow);
      else printProductLabels(view);
    } catch (error) {
      setFeedback(errorMessage(error));
    }
  }

  return (
    <div className="product-label-dialog-backdrop" role="presentation">
      <section
        className="product-label-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-label-dialog-title"
      >
        <div className="product-label-dialog-heading">
          <div>
            <p className="panel-kicker">THERMAL LABEL</p>
            <h2 id="product-label-dialog-title">Print product label</h2>
            <p>
              {product.name} <span className="material-id">{product.id}</span>
            </p>
          </div>
          <button type="button" className="text-button" onClick={onClose} aria-label="Close product label dialog">
            Close
          </button>
        </div>

        <div className="product-label-dialog-layout">
          <form className="product-label-controls" onSubmit={submit}>
            <label className="field">
              <span>Label size</span>
              <select value={sizeId} onChange={(event) => setSizeId(event.target.value as ProductLabelSizeId)}>
                {PRODUCT_LABEL_SIZE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Copies</span>
              <input
                type="number"
                min={PRODUCT_LABEL_MIN_COPIES}
                max={PRODUCT_LABEL_MAX_COPIES}
                step="1"
                value={copies}
                onChange={(event) => setCopies(event.target.value)}
                onBlur={() => setCopies(String(normalizedCopies))}
              />
              <small>Print 1–50 identical labels.</small>
            </label>

            <fieldset className="product-label-options">
              <legend>Include on label</legend>
              <label>
                <input type="checkbox" checked={showQr} onChange={(event) => setShowQr(event.target.checked)} />
                QR code
              </label>
              <label>
                <input type="checkbox" checked={showBarcode} onChange={(event) => setShowBarcode(event.target.checked)} />
                Code 128 barcode
              </label>
              <label>
                <input type="checkbox" checked={showCategory} onChange={(event) => setShowCategory(event.target.checked)} />
                Category
              </label>
              <label>
                <input type="checkbox" checked={showStatus} onChange={(event) => setShowStatus(event.target.checked)} />
                Active / archived status
              </label>
            </fieldset>

            <div className="product-label-printer-note">
              <strong>Printer selection happens in your browser / operating system.</strong>
              <p>
                Choose your installed thermal printer in the print dialog and make sure its paper size matches {size.label}.
              </p>
            </div>

            {feedback && (
              <div className="feedback error" role="alert">
                {feedback}
              </div>
            )}

            <div className="product-label-dialog-actions">
              <button type="submit" className="button button-primary">
                Print {normalizedCopies === 1 ? 'label' : `${normalizedCopies} labels`}
              </button>
              <button type="button" className="button button-quiet" onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>

          <div className="product-label-preview-panel">
            <div className="product-label-preview-heading">
              <span>Preview</span>
              <strong>{size.label}</strong>
            </div>
            <div className="product-label-preview-stage">
              <div
                className={`product-label-preview-paper ${view.showQr || view.showBarcode ? 'has-codes' : ''}`}
                style={{ aspectRatio: `${size.widthMm} / ${size.heightMm}` }}
                aria-label="Product label preview"
              >
                <span className="product-label-preview-brand">Craft Business Manager</span>
                <div className="product-label-preview-main">
                  <div className="product-label-preview-copy">
                    <strong className="product-label-preview-name">{view.product.name}</strong>
                    <span className="product-label-preview-id">{view.product.id}</span>
                    {(view.showCategory || view.showStatus) && (
                      <span className="product-label-preview-details">
                        {view.showCategory ? view.product.categoryLabel : ''}
                        {view.showCategory && view.showStatus ? ' • ' : ''}
                        {view.showStatus ? (view.product.isActive ? 'ACTIVE' : 'ARCHIVED') : ''}
                      </span>
                    )}
                  </div>
                  {view.showQr && (
                    <span
                      className="product-label-preview-qr"
                      aria-label="Product QR code preview"
                      dangerouslySetInnerHTML={{ __html: qrSvg }}
                    />
                  )}
                </div>
                {view.showBarcode && (
                  <span
                    className="product-label-preview-barcode"
                    aria-label="Product barcode preview"
                    dangerouslySetInnerHTML={{ __html: barcodeSvg }}
                  />
                )}
              </div>
            </div>
            <p className="product-label-preview-help">
              QR payload: <code>CBM:PRODUCT:{view.product.id}</code>. Barcode text is the Product ID. Preview is scaled for the screen.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
