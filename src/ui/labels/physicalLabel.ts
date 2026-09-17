import { renderIdentityCode128Svg, renderIdentityQrSvg, type PhysicalIdentityKind } from './machineReadable';
import {
  getThermalLabelSizePreset,
  normalizeThermalLabelCopies,
  type ThermalLabelSizeId,
  type ThermalLabelSizePreset,
} from './thermalLabel';

export interface PhysicalLabelIdentity {
  kind: Extract<PhysicalIdentityKind, 'MOLD' | 'LOCATION'>;
  id: string;
  title: string;
  eyebrow: string;
  details: readonly string[];
  isActive: boolean;
}

export interface PhysicalLabelOptions {
  sizeId: ThermalLabelSizeId;
  copies: number;
  showQr: boolean;
  showBarcode: boolean;
  showStatus: boolean;
}

export interface PhysicalLabelView {
  identity: PhysicalLabelIdentity;
  size: ThermalLabelSizePreset;
  copies: number;
  showQr: boolean;
  showBarcode: boolean;
  showStatus: boolean;
}

export interface PhysicalLabelPrintDocument {
  open(): void;
  write(content: string): void;
  close(): void;
}

export interface PhysicalLabelPrintWindow {
  document: PhysicalLabelPrintDocument;
  focus(): void;
  print(): void;
}

export type PhysicalLabelPrintWindowOpener = () => PhysicalLabelPrintWindow | null;

export class PhysicalLabelPrintError extends Error {
  readonly code = 'POPUP_BLOCKED' as const;

  constructor(message: string) {
    super(message);
    this.name = 'PhysicalLabelPrintError';
  }
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function buildPhysicalLabelView(
  identity: PhysicalLabelIdentity,
  options: PhysicalLabelOptions,
): PhysicalLabelView {
  return {
    identity: {
      ...identity,
      details: [...identity.details],
    },
    size: getThermalLabelSizePreset(options.sizeId),
    copies: normalizeThermalLabelCopies(options.copies),
    showQr: options.showQr,
    showBarcode: options.showBarcode,
    showStatus: options.showStatus,
  };
}

function renderOne(view: PhysicalLabelView, index: number): string {
  const qr = view.showQr
    ? renderIdentityQrSvg(view.identity.kind, view.identity.id)
    : '';
  const barcode = view.showBarcode ? renderIdentityCode128Svg(view.identity.id) : '';
  const details = view.identity.details
    .filter((value) => value.trim())
    .slice(0, 3)
    .map((value) => `<div>${escapeHtml(value)}</div>`)
    .join('');

  return `<section class="label" aria-label="${escapeHtml(view.identity.kind)} label copy ${index + 1}">
    <div class="eyebrow">${escapeHtml(view.identity.eyebrow)}</div>
    <div class="main-row">
      <div class="copy">
        <div class="title">${escapeHtml(view.identity.title)}</div>
        <div class="identity">${escapeHtml(view.identity.id)}</div>
        ${details ? `<div class="details">${details}</div>` : ''}
        ${view.showStatus ? `<div class="status">${view.identity.isActive ? 'ACTIVE' : 'ARCHIVED'}</div>` : ''}
      </div>
      ${view.showQr ? `<div class="qr">${qr}</div>` : ''}
    </div>
    ${view.showBarcode ? `<div class="barcode">${barcode}</div>` : ''}
  </section>`;
}

export function renderPhysicalLabelPrintHtml(view: PhysicalLabelView): string {
  const pages = Array.from({ length: view.copies }, (_, index) => renderOne(view, index)).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(view.identity.title)} — ${escapeHtml(view.identity.kind)} Labels</title>
<style>
@page { size: ${view.size.widthMm}mm ${view.size.heightMm}mm; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #000; }
body { font-family: Arial, Helvetica, sans-serif; }
.label { width:${view.size.widthMm}mm; height:${view.size.heightMm}mm; padding:2mm; display:flex; flex-direction:column; justify-content:center; overflow:hidden; break-after:page; page-break-after:always; }
.label:last-child { break-after:auto; page-break-after:auto; }
.eyebrow { margin-bottom:.8mm; font-size:5pt; font-weight:800; letter-spacing:.08em; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.main-row { display:flex; gap:1.4mm; align-items:center; min-height:0; }
.copy { flex:1; min-width:0; }
.title { font-size:${view.size.widthMm <= 40 ? '9pt' : '11pt'}; line-height:1.05; font-weight:800; overflow-wrap:anywhere; max-height:2.2em; overflow:hidden; }
.identity { margin-top:.8mm; font:800 ${view.size.widthMm <= 40 ? '7pt' : '8.5pt'}/1 ui-monospace,SFMono-Regular,Consolas,monospace; overflow-wrap:anywhere; }
.details { margin-top:.7mm; font-size:${view.size.widthMm <= 40 ? '4.8pt' : '5.6pt'}; line-height:1.12; font-weight:600; max-height:3.4em; overflow:hidden; }
.status { margin-top:.5mm; font-size:4.8pt; font-weight:800; letter-spacing:.05em; }
.qr { flex:0 0 auto; width:${view.size.widthMm <= 40 ? '11mm' : '13mm'}; height:${view.size.widthMm <= 40 ? '11mm' : '13mm'}; }
.qr svg, .barcode svg { width:100%; height:100%; display:block; }
.barcode { margin-top:.7mm; width:100%; height:${view.size.heightMm <= 25 ? '5mm' : '6mm'}; overflow:hidden; }
@media print { html,body { width:${view.size.widthMm}mm; } body { print-color-adjust:exact; -webkit-print-color-adjust:exact; } }
</style>
</head>
<body>${pages}</body>
</html>`;
}

export function printPhysicalLabels(
  view: PhysicalLabelView,
  openWindow: PhysicalLabelPrintWindowOpener = () => window.open('', '_blank', 'noopener,noreferrer'),
): void {
  const target = openWindow();
  if (!target) {
    throw new PhysicalLabelPrintError(
      'The label print window was blocked. Allow pop-ups for this app and try printing again.',
    );
  }
  target.document.open();
  target.document.write(renderPhysicalLabelPrintHtml(view));
  target.document.close();
  target.focus();
  target.print();
}
