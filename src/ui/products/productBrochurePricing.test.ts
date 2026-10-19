import { describe, expect, it, vi } from 'vitest';
import type { ProductPriceResolutionResult } from '../../application/pricing/ProductPriceResolutionService';
import type { ProductPriceTier } from '../../domain/productPriceTiers';
import {
  loadProductBrochurePrices,
  type BrochurePricingProvider,
} from './productBrochurePricing';

function tier(id: string, minimumOrderQuantity: number, active = true): ProductPriceTier {
  return {
    id, productId: 'CND-001', name: id === 'BULK-30' ? '30 pieces' : 'Event Bulk',
    kind: 'bulk', priceBasis: 'per-unit', pricingMethod: 'fixed-price',
    pricingValue: 999,
    unitsPerOffer: 1, minimumOrderQuantity, additionalCostPerOffer: 0,
    isActive: active,
  };
}
function resolution(productId: string, quantity: number, unitPrice: number | null): ProductPriceResolutionResult {
  return {
    productId, productName: 'Pink Candle', productIsActive: true, quantity,
    mode: 'default', selectedTierId: null, status: unitPrice === null ? 'not-ready' : 'ready',
    offerCount: quantity, unitSellingPrice: unitPrice,
    totalSellingPrice: unitPrice === null ? null : unitPrice * quantity,
    selectedTier: null, eligibleTierIds: [], tierEligibility: [],
    integratedQuote: {} as ProductPriceResolutionResult['integratedQuote'],
    warnings: [], issues: [],
  };
}
describe('A4 brochure price resolution', () => {
  it('uses quantity-aware resolved per-unit prices for default and active tiers, never source values', async () => {
    const resolve = vi.fn(async (request: { productId: string; quantity: number; selectedTierId?: string }) =>
      resolution(request.productId, request.quantity,
        request.selectedTierId === 'BULK-30' ? 22 :
        request.selectedTierId === 'BULK-50' ? 19 : 24));
    const provider: BrochurePricingProvider = {
      listTiersByProduct: async () => [tier('BULK-50', 50), tier('OLD', 100, false), tier('BULK-30', 30)],
      resolve,
    };
    const options = await loadProductBrochurePrices('CND-001', provider);
    expect(options.map((option) => [option.id, option.quantity, option.unitPrice])).toEqual([
      ['single', 1, 24],
      ['BULK-30', 30, 22],
      ['BULK-50', 50, 19],
    ]);
    expect(options.map((option) => option.label)).toEqual(['SINGLE', '30+ PCS', '50+ PCS']);
    expect(options.every((option) => option.unitPrice !== 999)).toBe(true);
    expect(resolve).toHaveBeenCalledWith({ productId: 'CND-001', quantity: 30, selectedTierId: 'BULK-30' });
    expect(resolve).toHaveBeenCalledWith({ productId: 'CND-001', quantity: 50, selectedTierId: 'BULK-50' });
    expect(resolve).not.toHaveBeenCalledWith(expect.objectContaining({ selectedTierId: 'OLD' }));
  });

  it('omits unavailable, failed, and invalid pricing instead of fabricating figures', async () => {
    const provider: BrochurePricingProvider = {
      listTiersByProduct: async () => [tier('ERR', 15), tier('NO-PRICE', 30), tier('OK', 50)],
      resolve: async (request) => {
        if (request.selectedTierId === 'ERR') throw new Error('Pricing provider unavailable');
        if (request.selectedTierId === 'NO-PRICE' || !request.selectedTierId) return resolution(request.productId, request.quantity, null);
        return resolution(request.productId, request.quantity, 18.25);
      },
    };
    const prices = await loadProductBrochurePrices('CND-001', provider);
    expect(prices).toMatchObject([{ id: 'OK', unitPrice: 18.25, quantity: 50 }]);
  });
});
