/** Excel text cells hold at most 32,767 characters. Reserve headroom for safe XLSX round-trips. */
export const MAX_PRODUCT_IMAGE_DATA_URL_LENGTH = 25_000;

const JPEG_DATA_URL = /^data:image\/jpeg;base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export function isValidProductImageDataUrl(value: unknown): value is string {
  return typeof value === 'string' &&
    value.length <= MAX_PRODUCT_IMAGE_DATA_URL_LENGTH &&
    JPEG_DATA_URL.test(value);
}
