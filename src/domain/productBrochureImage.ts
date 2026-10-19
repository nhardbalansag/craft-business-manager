/** A dedicated print-quality JPEG can exceed Excel's 32,767-character cell limit.
 * Persist it as ordered 24,000-character text fragments in the Products sheet.
 */
export const BROCHURE_IMAGE_PART_SIZE = 24_000;
export const BROCHURE_IMAGE_PART_COUNT = 20;
export const MAX_BROCHURE_IMAGE_DATA_URL_LENGTH = BROCHURE_IMAGE_PART_SIZE * BROCHURE_IMAGE_PART_COUNT;
export const BROCHURE_IMAGE_COLUMN_NAMES = Object.freeze(
  Array.from({ length: BROCHURE_IMAGE_PART_COUNT }, (_, i) =>
    'brochureImagePart' + String(i + 1).padStart(2, '0')),
);
const JPEG_DATA_URL = /^data:image\/jpeg;base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export function isValidBrochureImageDataUrl(value: unknown): value is string {
  return typeof value === 'string' &&
    value.length <= MAX_BROCHURE_IMAGE_DATA_URL_LENGTH &&
    JPEG_DATA_URL.test(value);
}

export function brochureImageParts(dataUrl: string | undefined): Record<string, string> {
  if (dataUrl === undefined) return {};
  if (!isValidBrochureImageDataUrl(dataUrl)) {
    throw new Error('Brochure image must be a valid JPEG within the export size limit.');
  }
  return Object.fromEntries(BROCHURE_IMAGE_COLUMN_NAMES.flatMap((column, index) => {
    const part = dataUrl.slice(index * BROCHURE_IMAGE_PART_SIZE, (index + 1) * BROCHURE_IMAGE_PART_SIZE);
    return part ? [[column, part]] : [];
  }));
}

export function brochureImageFromParts(row: Readonly<Record<string, unknown>>): string | undefined {
  let fragments = '';
  let complete = false;
  for (const column of BROCHURE_IMAGE_COLUMN_NAMES) {
    const value = row[column];
    if (value === undefined || value === null || value === '') {
      complete = true;
      continue;
    }
    if (complete || typeof value !== 'string' || value.length > BROCHURE_IMAGE_PART_SIZE) {
      throw new Error('Saved brochure image is incomplete or contains invalid workbook cells.');
    }
    fragments += value;
  }
  if (!fragments) return undefined;
  if (!isValidBrochureImageDataUrl(fragments)) {
    throw new Error('Saved brochure image has an invalid data format.');
  }
  return fragments;
}
