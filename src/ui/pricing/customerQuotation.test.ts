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
    });
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
