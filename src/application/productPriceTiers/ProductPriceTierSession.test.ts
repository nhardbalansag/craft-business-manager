import { describe, expect, it } from 'vitest';
import {
  productPriceTierRepository,
  productPriceTierService,
  productRepository,
  productService,
} from '../session';
import { InMemoryProductPriceTierRepository } from './InMemoryProductPriceTierRepository';
import { ProductPriceTierService } from './ProductPriceTierService';

describe('TP2C shared Product price tier session wiring', () => {
  it('exposes the shared repository/service over the authoritative Product repository', () => {
    expect(productPriceTierRepository).toBeInstanceOf(InMemoryProductPriceTierRepository);
    expect(productPriceTierService).toBeInstanceOf(ProductPriceTierService);
    expect(productRepository).toBeDefined();
    expect(productService).toBeDefined();
  });

  it('supports a shared-session create/read/archive/restore flow without persistence wiring', async () => {
    const productId = 'TP2C-SESSION-PRODUCT';

    if (!(await productRepository.findById(productId))) {
      await productService.createProduct({
        id: productId,
        name: 'TP2C Session Product',
        category: 'candle',
        safetyWasteRate: 0,
        isActive: true,
      });
    }

    const created = await productPriceTierService.createTier({
      productId: ' tp2c-session-product ',
      name: ' Session Bulk 12+ ',
      kind: 'bulk',
      priceBasis: 'per-unit',
      priceAmount: 45,
      unitsPerOffer: 1,
      minimumOrderQuantity: 12,
      additionalCostPerOffer: 0,
      notes: ' shared session ',
      isActive: true,
    });

    expect(created.id).toMatch(/^TIER-\d{4,}$/);
    expect(created.productId).toBe(productId);
    expect(created.name).toBe('Session Bulk 12+');
    expect(created.notes).toBe('shared session');

    expect(await productPriceTierService.getTier(created.id)).toEqual(created);

    const archived = await productPriceTierService.archiveTier(created.id);
    expect(archived.isActive).toBe(false);

    const restored = await productPriceTierService.restoreTier(created.id);
    expect(restored.isActive).toBe(true);
    expect((await productPriceTierService.listTiersByProduct(productId)).map((tier) => tier.id))
      .toContain(created.id);
  });
});
