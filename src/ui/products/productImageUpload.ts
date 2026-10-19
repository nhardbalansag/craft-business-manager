import { isValidProductImageDataUrl } from '../../domain/productImage';

const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Resizes a local uploaded photo into a JPEG thumbnail small enough to persist in a workbook cell. */
export async function optimizeProductImage(file: File): Promise<string> {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error('Choose a JPG, PNG, or WebP product image.');
  }
  if (file.size === 0 || file.size > MAX_SOURCE_BYTES) {
    throw new Error('Product image must be smaller than 8 MB.');
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('The selected image could not be opened.'));
      image.src = url;
    });
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error('The selected image has invalid dimensions.');
    }

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser does not support image resizing.');

    // Always encode as a safe JPEG, placing transparent product cutouts on white.
    for (const side of [320, 280, 240, 200, 160]) {
      canvas.width = side;
      canvas.height = side;
      for (const quality of [0.83, 0.72, 0.6, 0.48]) {
        context.fillStyle = '#fff';
        context.fillRect(0, 0, side, side);
        const scale = Math.min(side / image.naturalWidth, side / image.naturalHeight);
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        context.drawImage(image, (side - width) / 2, (side - height) / 2, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        if (isValidProductImageDataUrl(dataUrl)) return dataUrl;
      }
    }
    throw new Error('This photo is too detailed to fit the workbook. Try a simpler or smaller image.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
