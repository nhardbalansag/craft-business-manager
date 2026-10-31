import { isValidProductImageDataUrl } from './productImage';
import { isValidBrochureImageDataUrl } from './productBrochureImage';

type PhotoSource = { imageDataUrl?: string; brochureImageDataUrl?: string };
interface ProductPhotos { thumbnail: string | null; brochure: string | null }
const cache = new WeakMap<PhotoSource, { image?: string; brochureImage?: string; photos: ProductPhotos }>();

/** Cache validation per Product without retaining products after a catalog is replaced. */
export function getProductPhotos(product: PhotoSource): Readonly<ProductPhotos> {
  const previous = cache.get(product);
  if (previous && previous.image === product.imageDataUrl && previous.brochureImage === product.brochureImageDataUrl) return previous.photos;
  const photos = Object.freeze({
    thumbnail: isValidProductImageDataUrl(product.imageDataUrl) ? product.imageDataUrl : null,
    brochure: isValidBrochureImageDataUrl(product.brochureImageDataUrl) ? product.brochureImageDataUrl : null,
  });
  cache.set(product, { image: product.imageDataUrl, brochureImage: product.brochureImageDataUrl, photos });
  return photos;
}
