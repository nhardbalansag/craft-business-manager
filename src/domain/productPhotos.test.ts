import { describe, expect, it } from 'vitest';
import { getProductPhotos } from './productPhotos';

const image = 'data:image/jpeg;base64,' + 'AAAA'.repeat(100);
describe('Product photo validation cache', () => {
  it('reuses validated photos on repeated renders and rejects changed invalid sources', () => {
    const product = { imageDataUrl: image, brochureImageDataUrl: image };
    const first = getProductPhotos(product);
    expect(first).toEqual({ thumbnail: image, brochure: image });
    expect(getProductPhotos(product)).toBe(first);
    product.brochureImageDataUrl = 'javascript:alert(1)';
    expect(getProductPhotos(product)).toEqual({ thumbnail: image, brochure: null });
    product.imageDataUrl = 'https://example.com/unsafe.jpg';
    expect(getProductPhotos(product)).toEqual({ thumbnail: null, brochure: null });
    expect(first.brochure).toBe(image);
  });
});
