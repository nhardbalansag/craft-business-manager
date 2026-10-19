import { describe, expect, it } from 'vitest';
import type { ProductPriceResolutionResult } from '../../application/pricing/ProductPriceResolutionService';
import {
  buildCustomerQuotationView,
  CustomerQuotationError,
} from './customerQuotation';

function result(
  overrides: Partial<ProductPriceResolutionResult> = {},
): ProductPriceResolutionResult {
  return {
    productId: 'PROD-CANDLE',
    productName: 'Rose Candle',
    productIsActive: true,
    quantity: 12,
    mode: 'default',
    selectedTierId: null,
    status: 'ready',
    offerCount: 12,
    unitSellingPrice: 85,
    totalSellingPrice: 1020,
    integratedQuote: {} as ProductPriceResolutionResult['integratedQuote'],
    selectedTier: null,
    eligibleTierIds: [],
    tierEligibility: [],
    warnings: [],
    issues: [],
    ...overrides,
  };
}

describe('customerQuotation', () => {
  it('builds a customer-facing quotation from authoritative resolved pricing', () => {
    const view = buildCustomerQuotationView(result(), {
      businessName: 'My Lovely Craft',
      quotationReference: 'QT-001',
      customerName: 'Juan Dela Cruz',
      customerContact: '0917 000 0000',
      customerAddress: 'Bulacan',
      validUntil: '2026-10-13',
      notes: 'Pink rose candles.',
      terms: '50% down payment.',
      generatedAtIso: '2026-10-06T00:00:00.000Z',
    });

    expect(view).toMatchObject({
      businessName: 'My Lovely Craft',
      quotationReference: 'QT-001',
      customer: {
        name: 'Juan Dela Cruz',
        contact: '0917 000 0000',
        address: 'Bulacan',
      },
      items: [
        {
          product: {
            id: 'PROD-CANDLE',
            name: 'Rose Candle',
            quantity: 12,
          },
          pricing: {
            sourceLabel: 'Default / Single',
            unitSellingPrice: 85,
            totalSellingPrice: 1020,
          },
        },
      ],
      subtotal: 1020,
      total: 1020,
    });
  });

  it('includes images for each matching Product without changing pricing or requiring images for others', () => {
    const photo = `data:image/jpeg;base64,/9j/${'AAAA'.repeat(25)}`;
    const resultView = buildCustomerQuotationView(
      [
        result(),
        result({ productId: 'PROD-PLASTER', productName: 'Paintable Bear', quantity: 5, unitSellingPrice: 120, totalSellingPrice: 600 }),
      ],
      {
        businessName: 'My Lovely Craft', quotationReference: 'QT-PHOTOS',
        customerName: 'Event Client', generatedAtIso: '2026-10-06T00:00:00.000Z',
      },
      [
        { id: 'PROD-CANDLE', name: 'Rose Candle', category: 'candle', safetyWasteRate: 0.05, isActive: true, imageDataUrl: photo },
        { id: 'PROD-PLASTER', name: 'Paintable Bear', category: 'paintable-art', safetyWasteRate: 0.05, isActive: true },
      ],
    );
    expect(resultView.items[0].product.imageDataUrl).toBe(photo);
    expect(resultView.items[1].product.imageDataUrl).toBeUndefined();
    expect(resultView.total).toBe(1620);
  });

  it('combines multiple resolved Products into one quotation total', () => {
    const view = buildCustomerQuotationView(
      [
        result(),
        result({
          productId: 'PROD-PLASTER',
          productName: 'Paintable Bear',
          quantity: 5,
          unitSellingPrice: 120,
          totalSellingPrice: 600,
        }),
      ],
      {
        businessName: 'My Lovely Craft',
        quotationReference: 'QT-MULTI',
        customerName: 'Event Customer',
        generatedAtIso: '2026-10-06T00:00:00.000Z',
      },
    );

    expect(view.items).toHaveLength(2);
    expect(view.items.map((item) => item.product.name)).toEqual([
      'Rose Candle',
      'Paintable Bear',
    ]);
    expect(view.subtotal).toBe(1620);
    expect(view.total).toBe(1620);
  });

  it('uses the selected tier name without exposing internal economics', () => {
    const view = buildCustomerQuotationView(
      result({
        mode: 'explicit-tier',
        selectedTierId: 'TIER-0003',
        selectedTier: {
          tier: {
            id: 'TIER-0003',
            productId: 'PROD-CANDLE',
            name: 'Event Bulk',
            kind: 'bulk',
            priceBasis: 'per-unit',
            priceAmount: 75,
            unitsPerOffer: 1,
            minimumOrderQuantity: 10,
            additionalCostPerOffer: 0,
            isActive: true,
          },
          status: 'ready',
          economics: null,
          defaultComparison: null,
          belowCost: false,
          warnings: [],
          issues: [],
        },
        unitSellingPrice: 75,
        totalSellingPrice: 900,
      }),
      {
        businessName: 'My Lovely Craft',
        quotationReference: 'QT-002',
        customerName: 'Event Client',
        generatedAtIso: '2026-10-06T00:00:00.000Z',
      },
    );

    expect(view.pricing.sourceLabel).toBe('Event Bulk');
    expect(view.pricing.tierId).toBe('TIER-0003');
    expect(view).not.toHaveProperty('profitPerUnit');
    expect(view).not.toHaveProperty('fullyLoadedUnitCost');
  });

  it('rejects quotation generation when resolved pricing is not ready', () => {
    expect(() =>
      buildCustomerQuotationView(
        result({
          status: 'not-ready',
          unitSellingPrice: null,
          totalSellingPrice: null,
        }),
        {
          businessName: 'My Lovely Craft',
          quotationReference: 'QT-003',
          customerName: 'Customer',
          generatedAtIso: '2026-10-06T00:00:00.000Z',
        },
      ),
    ).toThrowError(CustomerQuotationError);
  });
});
