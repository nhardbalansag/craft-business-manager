import { describe, expect, it } from 'vitest';
import {
  BROCHURE_IMAGE_COLUMN_NAMES,
  BROCHURE_IMAGE_PART_COUNT,
  BROCHURE_IMAGE_PART_SIZE,
  MAX_BROCHURE_IMAGE_DATA_URL_LENGTH,
  brochureImageFromParts,
  brochureImageParts,
  isValidBrochureImageDataUrl,
} from './productBrochureImage';

const header = 'data:image/jpeg;base64,';
const jpeg = header + 'AAAA'.repeat(84_000); // Larger than one Excel cell and larger than the old thumbnail.

describe('High-resolution brochure image workbook splitting', () => {
  it('splits large JPEG into Excel-safe cells and joins it without losing any bytes', () => {
    expect(jpeg.length).toBeGreaterThan(300_000);
    expect(isValidBrochureImageDataUrl(jpeg)).toBe(true);
    const chunks = brochureImageParts(jpeg);
    expect(Object.keys(chunks)).toEqual(BROCHURE_IMAGE_COLUMN_NAMES.slice(0, Math.ceil(jpeg.length / BROCHURE_IMAGE_PART_SIZE)));
    const values = Object.values(chunks).filter((value): value is string => typeof value === 'string');
    expect(values).toHaveLength(Math.ceil(jpeg.length / BROCHURE_IMAGE_PART_SIZE));
    expect(values.every((value) => value.length <= BROCHURE_IMAGE_PART_SIZE)).toBe(true);
    expect(brochureImageFromParts(chunks)).toBe(jpeg);
    expect(BROCHURE_IMAGE_PART_COUNT).toBe(20);
  });

  it('handles missing optional images and rejects partial, oversized or untrusted data', () => {
    expect(brochureImageFromParts({})).toBeUndefined();
    expect(brochureImageParts(undefined)).toEqual({});
    expect(isValidBrochureImageDataUrl(header + 'AAAA'.repeat(125_000))).toBe(false);
    expect(isValidBrochureImageDataUrl('javascript:alert(1)')).toBe(false);
    expect(isValidBrochureImageDataUrl('data:image/svg+xml;base64,AAAA')).toBe(false);
    expect(() => brochureImageParts('https://unsafe.example/image.jpg')).toThrow('valid JPEG');
    const chunks = brochureImageParts(jpeg);
    const copy = { ...chunks, [BROCHURE_IMAGE_COLUMN_NAMES[1]]: null };
    expect(() => brochureImageFromParts(copy)).toThrow('incomplete');
    expect(() => brochureImageFromParts({ ...chunks, [BROCHURE_IMAGE_COLUMN_NAMES[0]]: 123 })).toThrow('invalid workbook');
    expect(MAX_BROCHURE_IMAGE_DATA_URL_LENGTH).toBe(480_000);
  });
});
