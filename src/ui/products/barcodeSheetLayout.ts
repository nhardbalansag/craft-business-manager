/** True A4 dimensions in millimetres; print at 100% / Actual Size. */
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
export const BARCODE_SHEET_MAX_COPIES = 500;

export type BarcodeSheetOrientation = 'portrait' | 'landscape';

export interface BarcodeSheetOptions {
  labelWidthCm: number;
  labelHeightCm: number;
  marginCm: number;
  gapXCm: number;
  gapYCm: number;
  copies: number;
  orientation: BarcodeSheetOrientation;
  showProductName: boolean;
  showProductId: boolean;
  showCutGuides: boolean;
}

export interface BarcodeSheetLayout {
  paperWidthMm: number;
  paperHeightMm: number;
  labelWidthMm: number;
  labelHeightMm: number;
  marginMm: number;
  gapXmm: number;
  gapYmm: number;
  columns: number;
  rows: number;
  labelsPerPage: number;
  totalPages: number;
  copies: number;
}

export const DEFAULT_BARCODE_SHEET_OPTIONS: Readonly<BarcodeSheetOptions> = Object.freeze({
  labelWidthCm: 4,
  labelHeightCm: 2,
  marginCm: 0.5,
  gapXCm: 0,
  gapYCm: 0,
  copies: 50,
  orientation: 'portrait',
  showProductName: true,
  showProductId: true,
  showCutGuides: false,
});

export class BarcodeSheetLayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BarcodeSheetLayoutError';
  }
}

function finiteRange(value: number, min: number, max: number, label: string) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new BarcodeSheetLayoutError(`${label} must be between ${min} and ${max} cm.`);
  }
}

/**
 * Compute a fixed physical A4 grid without shrinking barcodes to fill a page.
 * Remainder spaces stay blank; more requested copies flow to further A4 pages.
 */
export function calculateBarcodeSheetLayout(options: BarcodeSheetOptions): BarcodeSheetLayout {
  finiteRange(options.labelWidthCm, 2, 20, 'Label width');
  finiteRange(options.labelHeightCm, 1.5, 28, 'Label height');
  finiteRange(options.marginCm, 0, 3, 'Paper margin');
  finiteRange(options.gapXCm, 0, 2, 'Horizontal spacing');
  finiteRange(options.gapYCm, 0, 2, 'Vertical spacing');
  if (!Number.isSafeInteger(options.copies) || options.copies < 1 || options.copies > BARCODE_SHEET_MAX_COPIES) {
    throw new BarcodeSheetLayoutError(`Copies must be a whole number from 1 to ${BARCODE_SHEET_MAX_COPIES}.`);
  }
  if (options.orientation !== 'portrait' && options.orientation !== 'landscape') {
    throw new BarcodeSheetLayoutError('Select A4 portrait or landscape.');
  }
  const paperWidthMm = options.orientation === 'portrait' ? A4_WIDTH_MM : A4_HEIGHT_MM;
  const paperHeightMm = options.orientation === 'portrait' ? A4_HEIGHT_MM : A4_WIDTH_MM;
  const labelWidthMm = options.labelWidthCm * 10;
  const labelHeightMm = options.labelHeightCm * 10;
  const marginMm = options.marginCm * 10;
  const gapXmm = options.gapXCm * 10;
  const gapYmm = options.gapYCm * 10;
  const usableWidth = paperWidthMm - 2 * marginMm;
  const usableHeight = paperHeightMm - 2 * marginMm;
  // Small epsilon handles floating-point cm conversions, not over-size labels.
  const columns = Math.max(0, Math.floor((usableWidth + gapXmm + 1e-7) / (labelWidthMm + gapXmm)));
  const rows = Math.max(0, Math.floor((usableHeight + gapYmm + 1e-7) / (labelHeightMm + gapYmm)));
  const labelsPerPage = columns * rows;
  if (labelsPerPage === 0) {
    throw new BarcodeSheetLayoutError(
      'This label size and spacing do not fit on A4 paper. Reduce the label size, margins, or spacing.',
    );
  }
  return {
    paperWidthMm, paperHeightMm, labelWidthMm, labelHeightMm,
    marginMm, gapXmm, gapYmm, columns, rows, labelsPerPage,
    totalPages: Math.ceil(options.copies / labelsPerPage),
    copies: options.copies,
  };
}
