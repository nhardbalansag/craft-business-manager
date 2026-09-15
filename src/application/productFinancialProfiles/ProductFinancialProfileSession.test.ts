import { describe, expect, it } from 'vitest';
import {
  productFinancialProfileRepository,
  productFinancialProfileService,
  productService,
} from '../session';

describe('Product financial profile shared session wiring', () => {
  it('writes and reads a financial profile through the shared application-service boundary', async () => {
    await productService.createProduct({
      id: 'phase-4-1c-session-product',
      name: 'Phase 4.1C Session Product',
      category: 'candle',
      safetyWasteRate: 0,
      isActive: true,
    });

    const saved = await productFinancialProfileService.upsertProfile({
      productId: 'PHASE-4-1C-SESSION-PRODUCT',
      laborCostPerUnit: 15,
      overheadCostPerUnit: 4,
      pricingPolicy: { method: 'profit-amount', value: 20 },
      notes: 'shared session profile',
    });

    expect(saved.productId).toBe('phase-4-1c-session-product');
    expect(await productFinancialProfileService.getProfile('phase-4-1c-session-product')).toEqual(saved);
    expect(await productFinancialProfileRepository.findByProductId('phase-4-1c-session-product')).toEqual(saved);
  });
});
