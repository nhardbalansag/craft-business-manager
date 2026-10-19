import { isValidProductImageDataUrl } from '../../domain/productImage';
import { isValidBrochureImageDataUrl } from '../../domain/productBrochureImage';

const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface OptimizedProductImages {
  imageDataUrl: string;
  brochureImageDataUrl: string;
}

/** Creates a small Excel-cell thumbnail AND a separate print-quality JPEG (stored in chunks). */
export async function optimizeProductImages(file: File): Promise<OptimizedProductImages> {
  if (!ALLOWED_MIME.has(file.type)) throw new Error('Choose a JPG, PNG, or WebP product image.');
  if (file.size === 0 || file.size > MAX_SOURCE_BYTES) throw new Error('Product image must be smaller than 8 MB.');

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('The selected image could not be opened.'));
      image.src = url;
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('The selected image has invalid dimensions.');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser does not support image resizing.');

    function encode(sides: readonly number[], qualities: readonly number[], validator: (value: unknown) => value is string): string {
      for (const side of sides) {
        canvas.width = side;
        canvas.height = side;
        const scale = Math.min(side / image.naturalWidth, side / image.naturalHeight);
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        context.fillStyle = '#fff';
        context.fillRect(0, 0, side, side);
        context.drawImage(image, (side - width) / 2, (side - height) / 2, width, height);
        for (const quality of qualities) {
          const data = canvas.toDataURL('image/jpeg', quality);
          if (validator(data)) return data;
        }
      }
      throw new Error('This image is too detailed to store. Try a smaller photo.');
    }

    const brochureImageDataUrl = encode([1600, 1400, 1200, 1000, 800], [.93, .86, .78, .7, .6], isValidBrochureImageDataUrl);
    const imageDataUrl = encode([320, 280, 240, 200, 160], [.83, .72, .6, .48], isValidProductImageDataUrl);
    return { imageDataUrl, brochureImageDataUrl };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Kept for consumers that need the original small workbook-safe thumbnail. */
export async function optimizeProductImage(file: File): Promise<string> {
  return (await optimizeProductImages(file)).imageDataUrl;
}
