import { describe, expect, it } from 'vitest';
import {
  MachineReadableIdentityError,
  buildIdentityPayload,
  renderIdentityCode128Svg,
  renderIdentityQrSvg,
} from './machineReadable';

describe('machine-readable physical identities', () => {
  it('builds deterministic typed QR payloads', () => {
    expect(buildIdentityPayload('PRODUCT', ' PRD-001 ')).toBe('CBM:PRODUCT:PRD-001');
    expect(buildIdentityPayload('MOLD', 'MOLD-0012')).toBe('CBM:MOLD:MOLD-0012');
    expect(buildIdentityPayload('LOCATION', 'LOC-BIN-04')).toBe('CBM:LOCATION:LOC-BIN-04');
  });

  it('renders standards-based SVG QR and Code 128 output', () => {
    const qr = renderIdentityQrSvg('MOLD', 'MOLD-0012');
    const barcode = renderIdentityCode128Svg('MOLD-0012');

    expect(qr).toContain('<svg');
    expect(qr).toContain('viewBox=');
    expect(barcode).toContain('<svg');
    expect(barcode).toContain('viewBox=');
    expect(qr).not.toBe(barcode);
  });

  it('rejects blank authoritative IDs', () => {
    expect(() => buildIdentityPayload('PRODUCT', '   ')).toThrow(MachineReadableIdentityError);
    expect(() => renderIdentityQrSvg('LOCATION', '')).toThrow(MachineReadableIdentityError);
    expect(() => renderIdentityCode128Svg(' ')).toThrow(MachineReadableIdentityError);
  });
});
