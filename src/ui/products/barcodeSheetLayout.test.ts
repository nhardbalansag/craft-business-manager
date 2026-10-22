import { describe, expect, it } from 'vitest';
import {
  BARCODE_SHEET_MAX_COPIES,
  BarcodeSheetLayoutError,
  DEFAULT_BARCODE_SHEET_OPTIONS,
  calculateBarcodeSheetLayout,
} from './barcodeSheetLayout';

describe('A4 barcode label layout', () => {
  it('fits the requested fifty 4cm × 2cm barcodes on one physical A4 page', () => {
    const layout = calculateBarcodeSheetLayout(DEFAULT_BARCODE_SHEET_OPTIONS);
    expect(layout).toMatchObject({
      paperWidthMm: 210, paperHeightMm: 297,
      labelWidthMm: 40, labelHeightMm: 20,
      marginMm: 5, gapXmm: 0, gapYmm: 0,
      columns: 5, rows: 14, labelsPerPage: 70,
      copies: 50, totalPages: 1,
    });
  });

  it('paginates labels without reducing their configured dimensions', () => {
    const layout = calculateBarcodeSheetLayout({
      ...DEFAULT_BARCODE_SHEET_OPTIONS,
      copies: 150,
    });
    expect(layout.totalPages).toBe(3);
    expect(layout.labelWidthMm).toBe(40);
    expect(layout.labelHeightMm).toBe(20);
    expect(layout.labelsPerPage).toBe(70);
  });

  it('supports decimal-centimeter margins and gaps and A4 landscape', () => {
    const layout = calculateBarcodeSheetLayout({
      ...DEFAULT_BARCODE_SHEET_OPTIONS,
      orientation: 'landscape',
      labelWidthCm: 4.5,
      labelHeightCm: 2.5,
      marginCm: 0.7,
      gapXCm: 0.2,
      gapYCm: 0.1,
      copies: 80,
    });
    expect(layout).toMatchObject({
      paperWidthMm: 297, paperHeightMm: 210,
      labelWidthMm: 45, labelHeightMm: 25,
      marginMm: 7, gapXmm: 2, gapYmm: 1,
      columns: 6, rows: 7, labelsPerPage: 42, totalPages: 2,
    });
  });

  it('rejects impossible dimensions instead of scaling or silently clipping', () => {
    expect(() => calculateBarcodeSheetLayout({
      ...DEFAULT_BARCODE_SHEET_OPTIONS, labelWidthCm: 20, marginCm: 1,
    })).toThrow(BarcodeSheetLayoutError);
    expect(() => calculateBarcodeSheetLayout({
      ...DEFAULT_BARCODE_SHEET_OPTIONS, labelHeightCm: 28, marginCm: 1,
    })).toThrow('do not fit on A4 paper');
  });

  it('rejects non-integer, zero and excessive copies, including non-finite physical values', () => {
    for (const copies of [0, 1.5, BARCODE_SHEET_MAX_COPIES + 1, Number.NaN, Infinity]) {
      expect(() => calculateBarcodeSheetLayout({
        ...DEFAULT_BARCODE_SHEET_OPTIONS, copies,
      })).toThrow(BarcodeSheetLayoutError);
    }
    for (const labelWidthCm of [Number.NaN, Infinity, -1, 0, 30]) {
      expect(() => calculateBarcodeSheetLayout({
        ...DEFAULT_BARCODE_SHEET_OPTIONS, labelWidthCm,
      })).toThrow(BarcodeSheetLayoutError);
    }
  });

  it('honors exact boundary fit and keeps non-fitting configurations unprintable', () => {
    const layout = calculateBarcodeSheetLayout({
      ...DEFAULT_BARCODE_SHEET_OPTIONS,
      marginCm: 0.5, labelWidthCm: 10, labelHeightCm: 14.35, copies: 3,
    });
    expect(layout).toMatchObject({ columns: 2, rows: 2, labelsPerPage: 4, totalPages: 1 });
  });
});
