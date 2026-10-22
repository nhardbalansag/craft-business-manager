import { useMemo, useState, type FormEvent } from 'react';
import type { Product } from '../../domain/products';
import { renderIdentityCode128Svg } from '../labels/machineReadable';
import {
  BARCODE_SHEET_MAX_COPIES,
  DEFAULT_BARCODE_SHEET_OPTIONS,
  calculateBarcodeSheetLayout,
  type BarcodeSheetOptions,
  type BarcodeSheetOrientation,
} from './barcodeSheetLayout';
import {
  printBarcodeA4Sheets,
} from './productBarcodeA4Print';
import type { ProductLabelPrintWindowOpener } from './productLabelPrint';
import './productBarcodeA4.css';

interface ProductBarcodeA4DialogProps {
  product: Product;
  onClose: () => void;
  openPrintWindow?: ProductLabelPrintWindowOpener;
}

function parseAmount(value: string): number {
  return value.trim() === '' ? Number.NaN : Number(value);
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'The A4 barcode sheet could not be prepared.';
}

export function ProductBarcodeA4Dialog({
  product, onClose, openPrintWindow,
}: ProductBarcodeA4DialogProps) {
  const defaults = DEFAULT_BARCODE_SHEET_OPTIONS;
  const [labelWidth, setLabelWidth] = useState(String(defaults.labelWidthCm));
  const [labelHeight, setLabelHeight] = useState(String(defaults.labelHeightCm));
  const [margin, setMargin] = useState(String(defaults.marginCm));
  const [gapX, setGapX] = useState(String(defaults.gapXCm));
  const [gapY, setGapY] = useState(String(defaults.gapYCm));
  const [copies, setCopies] = useState(String(defaults.copies));
  const [orientation, setOrientation] = useState<BarcodeSheetOrientation>('portrait');
  const [showProductName, setShowProductName] = useState(true);
  const [showProductId, setShowProductId] = useState(true);
  const [showCutGuides, setShowCutGuides] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const options: BarcodeSheetOptions = useMemo(() => ({
    labelWidthCm: parseAmount(labelWidth),
    labelHeightCm: parseAmount(labelHeight),
    marginCm: parseAmount(margin),
    gapXCm: parseAmount(gapX),
    gapYCm: parseAmount(gapY),
    copies: parseAmount(copies),
    orientation,
    showProductName,
    showProductId,
    showCutGuides,
  }), [labelWidth, labelHeight, margin, gapX, gapY, copies, orientation,
    showProductName, showProductId, showCutGuides]);

  const result = useMemo(() => {
    try {
      return { layout: calculateBarcodeSheetLayout(options), error: null };
    } catch (error) {
      return { layout: null, error: message(error) };
    }
  }, [options]);
  const barcodeSvg = useMemo(() => {
    try {
      return renderIdentityCode128Svg(product.id);
    } catch {
      return '';
    }
  }, [product.id]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    try {
      if (openPrintWindow) printBarcodeA4Sheets(product, options, openPrintWindow);
      else printBarcodeA4Sheets(product, options);
    } catch (error) {
      setFeedback(message(error));
    }
  }

  const layout = result.layout;
  const previewCount = layout ? Math.min(layout.copies, layout.labelsPerPage, 100) : 0;

  return (
    <div className="barcode-a4-backdrop" role="presentation">
      <section className="barcode-a4-dialog" role="dialog" aria-modal="true" aria-labelledby="barcode-a4-title">
        <header className="barcode-a4-heading">
          <div>
            <p className="panel-kicker">PRODUCT BARCODES · A4 SHEETS</p>
            <h2 id="barcode-a4-title">Generate A4 barcode labels</h2>
            <p>{product.name} · <strong>{product.id}</strong></p>
          </div>
          <button type="button" className="text-button" onClick={onClose} aria-label="Close A4 barcode dialog">Close</button>
        </header>

        <div className="barcode-a4-layout">
          <form className="barcode-a4-form" onSubmit={submit} aria-label="A4 barcode label settings">
            <p className="barcode-a4-explainer">
              Every Code 128 barcode contains this Product's saved ID. The price is not encoded;
              your POS must look up the Product ID in its catalog.
            </p>
            <div className="barcode-a4-fields">
              <label className="field">
                <span>Barcode label width (cm)</span>
                <input aria-label="Barcode label width (cm)" type="number" min="2" max="20" step="0.1" value={labelWidth}
                  onChange={(event) => setLabelWidth(event.target.value)} required />
              </label>
              <label className="field">
                <span>Barcode label height (cm)</span>
                <input aria-label="Barcode label height (cm)" type="number" min="1.5" max="28" step="0.1" value={labelHeight}
                  onChange={(event) => setLabelHeight(event.target.value)} required />
              </label>
              <label className="field">
                <span>Number of barcodes</span>
                <input aria-label="Number of barcodes" type="number" min="1" max={BARCODE_SHEET_MAX_COPIES} step="1" value={copies}
                  onChange={(event) => setCopies(event.target.value)} required />
              </label>
              <label className="field">
                <span>Paper orientation</span>
                <select aria-label="Paper orientation" value={orientation}
                  onChange={(event) => setOrientation(event.target.value as BarcodeSheetOrientation)}>
                  <option value="portrait">A4 portrait (21 × 29.7 cm)</option>
                  <option value="landscape">A4 landscape (29.7 × 21 cm)</option>
                </select>
              </label>
              <label className="field">
                <span>Paper margin (cm)</span>
                <input aria-label="Paper margin (cm)" type="number" min="0" max="3" step="0.1" value={margin}
                  onChange={(event) => setMargin(event.target.value)} required />
              </label>
              <label className="field">
                <span>Gap between columns (cm)</span>
                <input aria-label="Gap between columns (cm)" type="number" min="0" max="2" step="0.1" value={gapX}
                  onChange={(event) => setGapX(event.target.value)} required />
              </label>
              <label className="field">
                <span>Gap between rows (cm)</span>
                <input aria-label="Gap between rows (cm)" type="number" min="0" max="2" step="0.1" value={gapY}
                  onChange={(event) => setGapY(event.target.value)} required />
              </label>
            </div>
            <fieldset className="barcode-a4-options">
              <legend>Show on printed label</legend>
              <label><input type="checkbox" checked={showProductName} onChange={(event) => setShowProductName(event.target.checked)} /> Product name</label>
              <label><input type="checkbox" checked={showProductId} onChange={(event) => setShowProductId(event.target.checked)} /> Human-readable Product ID</label>
              <label><input type="checkbox" checked={showCutGuides} onChange={(event) => setShowCutGuides(event.target.checked)} /> Cutting guides (for regular paper)</label>
            </fieldset>
            <div className="barcode-a4-print-advice">
              <strong>Printing and PDF</strong>
              <p>Print on A4 sticker paper or ordinary A4 paper. Choose <strong>Actual size / 100%</strong> (not Fit to page), turn off headers and footers, and match paper orientation. Choose <strong>Save as PDF</strong> from the browser print dialog if needed.</p>
              <p>Check one sample with your mobile scanner before printing a full sheet. Smaller labels and longer Product IDs may reduce scan reliability.</p>
            </div>
            {(feedback || result.error || !barcodeSvg) && (
              <p role="alert" className="feedback error">
                {feedback ?? result.error ?? 'This Product ID cannot be encoded as Code 128.'}
              </p>
            )}
            <div className="barcode-a4-buttons">
              <button type="submit" className="button button-primary" disabled={!layout || !barcodeSvg}>
                Print A4 barcodes / Save as PDF
              </button>
              <button type="button" className="button button-quiet" onClick={onClose}>Cancel</button>
            </div>
          </form>

          <div className="barcode-a4-preview-panel">
            <h3>A4 sheet preview</h3>
            {layout ? (
              <>
                <div className="barcode-a4-stats" aria-label="A4 barcode layout summary">
                  <strong>{layout.columns} columns × {layout.rows} rows</strong>
                  <span>{layout.labelsPerPage} labels per full page</span>
                  <span>{layout.copies} barcode copies · {layout.totalPages} A4 {layout.totalPages === 1 ? 'page' : 'pages'}</span>
                </div>
                <div className="barcode-a4-preview-frame">
                  <div className="barcode-a4-preview-paper"
                    aria-label="A4 barcode sheet preview"
                    style={{ aspectRatio: `${layout.paperWidthMm} / ${layout.paperHeightMm}` }}>
                    {Array.from({ length: previewCount }, (_, index) => {
                      const left = layout.marginMm + (index % layout.columns) * (layout.labelWidthMm + layout.gapXmm);
                      const top = layout.marginMm + Math.floor(index / layout.columns) * (layout.labelHeightMm + layout.gapYmm);
                      return (
                        <div key={index} className="barcode-a4-preview-sticker"
                          style={{
                            left: `${left / layout.paperWidthMm * 100}%`,
                            top: `${top / layout.paperHeightMm * 100}%`,
                            width: `${layout.labelWidthMm / layout.paperWidthMm * 100}%`,
                            height: `${layout.labelHeightMm / layout.paperHeightMm * 100}%`,
                            borderStyle: showCutGuides ? 'dashed' : 'solid',
                          }}>
                          {showProductName && <span className="barcode-a4-preview-name">{product.name}</span>}
                          <span className="barcode-a4-preview-bars" dangerouslySetInnerHTML={{ __html: barcodeSvg }} />
                          {showProductId && <span className="barcode-a4-preview-id">{product.id}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <p className="barcode-a4-preview-note">Preview shows page 1 at reduced scale. Printed labels use exact centimetre dimensions; unused cells stay blank.</p>
              </>
            ) : (
              <p className="barcode-a4-preview-note">Enter dimensions that fit on A4 paper to see a layout preview.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
