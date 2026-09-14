import { describe, expect, it } from 'vitest';
import type { Product } from '../../domain/products';
import { InMemoryMixPresetRepository } from '../mixPresets/InMemoryMixPresetRepository';
import { InMemoryProductRepository } from './InMemoryProductRepository';
import { ProductApplicationError, ProductService } from './ProductService';

const product: Product = {
  id: 'ART-001',
  name: 'Paintable Star',
  category: 'paintable-art',
  safetyWasteRate: 0.05,
  isActive: true,
};

function service(seed: Product[] = [product]): ProductService {
  return new ProductService(
    new InMemoryProductRepository(seed),
    new InMemoryMixPresetRepository(),
  );
}

describe('ProductService safety waste policy', () => {
  it('returns the validated derived planning policy for a product', async () => {
    await expect(service().getSafetyWastePolicy('art-001')).resolves.toEqual({
      productId: 'ART-001',
      rate: 0.05,
      percentage: 5,
      multiplier: 1.05,
      purpose: 'planning-reserve',
      observedDefectRateIncluded: false,
    });
  });

  it('supports archived products for historical/planning inspection', async () => {
    const archived = { ...product, isActive: false, safetyWasteRate: 0.08 };
    await expect(service([archived]).getSafetyWastePolicy('ART-001')).resolves.toMatchObject({
      rate: 0.08,
      percentage: 8,
      multiplier: 1.08,
    });
  });

  it('uses the normal product-not-found error for unknown products', async () => {
    await expect(service([]).getSafetyWastePolicy('MISSING')).rejects.toEqual(
      expect.objectContaining<Partial<ProductApplicationError>>({ code: 'PRODUCT_NOT_FOUND' }),
    );
  });
});
