import { useMemo, useState, type FormEvent } from 'react';
import {
  buildPhysicalLabelView,
  printPhysicalLabels,
  type PhysicalLabelIdentity,
  type PhysicalLabelPrintWindowOpener,
} from './physicalLabel';
import { renderIdentityCode128Svg, renderIdentityQrSvg } from './machineReadable';
import {
  DEFAULT_THERMAL_LABEL_SIZE_ID,
  getThermalLabelSizePreset,
  normalizeThermalLabelCopies,
  THERMAL_LABEL_MAX_COPIES,
  THERMAL_LABEL_MIN_COPIES,
  THERMAL_LABEL_SIZE_PRESETS,
  type ThermalLabelSizeId,
} from './thermalLabel';
import '../products/productLabelPrint.css';

interface PhysicalLabelPrintDialogProps {
  identity: PhysicalLabelIdentity;
  onClose: () => void;
  openPrintWindow?: PhysicalLabelPrintWindowOpener;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The label could not be printed.';
}

export function PhysicalLabelPrintDialog({
  identity,
  onClose,
  openPrintWindow,
}: PhysicalLabelPrintDialogProps) {
  const [sizeId, setSizeId] = useState<ThermalLabelSizeId>(DEFAULT_THERMAL_LABEL_SIZE_ID);
  const [copies, setCopies] = useState('1');
  const [showQr, setShowQr] = useState(true);
  const [showBarcode, setShowBarcode] = useState(true);
  const [showStatus, setShowStatus] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  const size = getThermalLabelSizePreset(sizeId);
  const normalizedCopies = useMemo(() => normalizeThermalLabelCopies(Number(copies)), [copies]);
  const view = useMemo(
    () => buildPhysicalLabelView(identity, { sizeId, copies: normalizedCopies, showQr, showBarcode, showStatus }),
    [copies, identity, normalizedCopies, showBarcode, showQr, showStatus, sizeId],
  );
  const qrSvg = useMemo(
    () => (showQr ? renderIdentityQrSvg(identity.kind, identity.id) : ''),
    [identity.id, identity.kind, showQr],
  );
  const barcodeSvg = useMemo(
    () => (showBarcode ? renderIdentityCode128Svg(identity.id) : ''),
    [identity.id, showBarcode],
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    setFeedback(null);
    try {
      if (openPrintWindow) printPhysicalLabels(view, openPrintWindow);
      else printPhysicalLabels(view);
    } catch (error) {
      setFeedback(errorMessage(error));
    }
  }

  return (
    <div className="product-label-dialog-backdrop" role="presentation">
      <section className="product-label-dialog" role="dialog" aria-modal="true" aria-labelledby="physical-label-dialog-title">
        <div className="product-label-dialog-heading">
          <div>
            <p className="panel-kicker">THERMAL LABEL</p>
            <h2 id="physical-label-dialog-title">Print {identity.kind === 'MOLD' ? 'mold' : 'storage'} label</h2>
            <p>{identity.title} <span className="material-id">{identity.id}</span></p>
          </div>
          <button type="button" className="text-button" onClick={onClose} aria-label="Close physical label dialog">Close</button>
        </div>

        <div className="product-label-dialog-layout">
          <form className="product-label-controls" onSubmit={submit}>
            <label className="field">
              <span>Label size</span>
              <select value={sizeId} onChange={(event) => setSizeId(event.target.value as ThermalLabelSizeId)}>
                {THERMAL_LABEL_SIZE_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Copies</span>
              <input
                type="number"
                min={THERMAL_LABEL_MIN_COPIES}
                max={THERMAL_LABEL_MAX_COPIES}
                value={copies}
                onChange={(event) => setCopies(event.target.value)}
                onBlur={() => setCopies(String(normalizedCopies))}
              />
            </label>
            <fieldset className="product-label-options">
              <legend>Include on label</legend>
              <label><input type="checkbox" checked={showQr} onChange={(event) => setShowQr(event.target.checked)} /> QR code</label>
              <label><input type="checkbox" checked={showBarcode} onChange={(event) => setShowBarcode(event.target.checked)} /> Code 128 barcode</label>
              <label><input type="checkbox" checked={showStatus} onChange={(event) => setShowStatus(event.target.checked)} /> Active / archived status</label>
            </fieldset>
            <div className="product-label-printer-note">
              <strong>Uses the same browser thermal-printer workflow.</strong>
              <p>Select your installed thermal printer and match its paper size to {size.label}.</p>
            </div>
            {feedback && <div className="feedback error" role="alert">{feedback}</div>}
            <div className="product-label-dialog-actions">
              <button type="submit" className="button button-primary">Print {normalizedCopies === 1 ? 'label' : `${normalizedCopies} labels`}</button>
              <button type="button" className="button button-quiet" onClick={onClose}>Cancel</button>
            </div>
          </form>

          <div className="product-label-preview-panel">
            <div className="product-label-preview-heading"><span>Preview</span><strong>{size.label}</strong></div>
            <div className="product-label-preview-stage">
              <div className="product-label-preview-paper has-codes" style={{ aspectRatio: `${size.widthMm} / ${size.heightMm}` }} aria-label="Physical label preview">
                <span className="product-label-preview-brand">{identity.eyebrow}</span>
                <div className="product-label-preview-main">
                  <div className="product-label-preview-copy">
                    <strong className="product-label-preview-name">{identity.title}</strong>
                    <span className="product-label-preview-id">{identity.id}</span>
                    {identity.details.map((detail) => <span className="product-label-preview-details" key={detail}>{detail}</span>)}
                    {showStatus && <span className="product-label-preview-details">{identity.isActive ? 'ACTIVE' : 'ARCHIVED'}</span>}
                  </div>
                  {showQr && <span className="product-label-preview-qr" aria-label="QR code preview" dangerouslySetInnerHTML={{ __html: qrSvg }} />}
                </div>
                {showBarcode && <span className="product-label-preview-barcode" aria-label="Barcode preview" dangerouslySetInnerHTML={{ __html: barcodeSvg }} />}
              </div>
            </div>
            <p className="product-label-preview-help">
              QR payload: <code>CBM:{identity.kind}:{identity.id}</code>. Barcode text is the stable ID.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
