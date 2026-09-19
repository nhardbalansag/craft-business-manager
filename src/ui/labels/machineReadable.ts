import { code128, drawingSVG, qrcode } from '@bwip-js/generic';

export type PhysicalIdentityKind = 'PRODUCT' | 'MOLD' | 'LOCATION';

export class MachineReadableIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MachineReadableIdentityError';
  }
}

function normalizeId(id: string): string {
  const normalized = id.trim();
  if (!normalized) {
    throw new MachineReadableIdentityError('A nonblank authoritative ID is required for QR/barcode generation.');
  }
  return normalized;
}

export function buildIdentityPayload(kind: PhysicalIdentityKind, id: string): string {
  return `CBM:${kind}:${normalizeId(id)}`;
}

export function renderIdentityQrSvg(kind: PhysicalIdentityKind, id: string): string {
  const svg = qrcode(
    {
      bcid: 'qrcode',
      text: buildIdentityPayload(kind, id),
      scale: 2,
    },
    drawingSVG(),
  );

  return String(svg);
}

export function renderIdentityCode128Svg(id: string): string {
  const svg = code128(
    {
      bcid: 'code128',
      text: normalizeId(id),
      scale: 1,
      height: 8,
      includetext: false,
    },
    drawingSVG(),
  );

  return String(svg);
}
