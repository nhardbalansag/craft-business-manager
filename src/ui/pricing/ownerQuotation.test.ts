import { describe, expect, it } from 'vitest';
import type { ProductPriceResolutionResult } from '../../application/pricing/ProductPriceResolutionService';
import type { CustomerQuotationView } from './customerQuotation';
import { buildOwnerQuotationView, OwnerQuotationError } from './ownerQuotation';

const customer: CustomerQuotationView = {
  businessName: 'My Lovely Craft', quotationReference: 'QT-OWNER-01',
  generatedAtIso: '2026-10-21T02:00:00.000Z', validUntil: '2026-10-28',
  customer: { name: 'Wedding Couple', contact: null, address: null },
  notes: 'Dusty blue motif', terms: '50% down payment',
  items: [
    { product: { id: 'CND-01', name: 'Daisy Candle', quantity: 10 },
      pricing: { sourceLabel: 'Default / Single', tierId: null, unitSellingPrice: 80, totalSellingPrice: 800, offerCount: 10 } },
    { product: { id: 'POT-02', name: 'Custom Candle Pot', quantity: 6 },
      pricing: { sourceLabel: 'Package of 3', tierId: 'TIER-02', unitSellingPrice: 100, totalSellingPrice: 600, offerCount: 2 } },
  ],
  subtotal: 1400, total: 1400,
  product: { id: 'CND-01', name: 'Daisy Candle', quantity: 10 },
  pricing: { sourceLabel: 'Default / Single', tierId: null, unitSellingPrice: 80, totalSellingPrice: 800, offerCount: 10 },
};
function resolution(productId: string, quantity: number, sale: number, cost: number | null, tierExtra = 0): ProductPriceResolutionResult {
  const withTier = productId === 'POT-02';
  return {
    productId, productName: productId, productIsActive: true,
    quantity, mode: withTier ? 'explicit-tier' : 'default',
    selectedTierId: withTier ? 'TIER-02' : null,
    status: 'ready', offerCount: withTier ? 2 : quantity,
    unitSellingPrice: sale / quantity, totalSellingPrice: sale,
    integratedQuote: { totalFullyLoadedUnitCost: cost } as ProductPriceResolutionResult['integratedQuote'],
    selectedTier: withTier ? {
      tier: { id: 'TIER-02', productId },
      economics: { fullyLoadedUnitCost: cost, additionalCostPerOffer: tierExtra },
    } as unknown as ProductPriceResolutionResult['selectedTier'] : null,
    eligibleTierIds: [], tierEligibility: [], warnings: [], issues: [],
  };
}

describe('confidential business owner quotation costing', () => {
  it('calculates actual quoted cost, profit and margin across default and extra-cost package tiers', () => {
    const owner = buildOwnerQuotationView(customer, [
      resolution('CND-01', 10, 800, 30),
      resolution('POT-02', 6, 600, 40, 15),
    ]);
    expect(owner.items).toHaveLength(2);
    expect(owner.items[0]).toMatchObject({
      unitProductCost: 30, totalProductCost: 300,
      profitPerUnit: 50, totalProfit: 500, grossMargin: .625,
    });
    // Tier adds PHP 15 for each of two offers: cost 6*40 + 2*15.
    expect(owner.items[1]).toMatchObject({
      unitProductCost: 45, totalProductCost: 270,
      profitPerUnit: 55, totalProfit: 330, grossMargin: .55,
    });
    expect(owner).toMatchObject({
      totalSales: 1400, totalProductCost: 570,
      totalProfit: 830, unresolvedCostCount: 0,
      notes: 'Dusty blue motif',
    });
    expect(owner.grossMargin).toBeCloseTo(830 / 1400);
    expect(customer.items[0].pricing).not.toHaveProperty('totalProductCost');
    expect(customer).not.toHaveProperty('totalProfit');
  });

  it('marks unknown cost and aggregates as unavailable, rather than reporting false profits', () => {
    const owner = buildOwnerQuotationView(customer, [
      resolution('CND-01', 10, 800, null),
      resolution('POT-02', 6, 600, 40, 15),
    ]);
    expect(owner.items[0]).toMatchObject({
      totalProductCost: null, profitPerUnit: null, totalProfit: null, grossMargin: null,
    });
    expect(owner.items[1].totalProfit).toBe(330);
    expect(owner.totalSales).toBe(1400);
    expect(owner.totalProductCost).toBeNull();
    expect(owner.totalProfit).toBeNull();
    expect(owner.grossMargin).toBeNull();
    expect(owner.unresolvedCostCount).toBe(1);
  });

  it('supports below-cost quotes and does not report a margin when revenue is zero', () => {
    const single = { ...customer, items: [customer.items[0]], subtotal: 800, total: 800 };
    const owner = buildOwnerQuotationView(single, [resolution('CND-01', 10, 800, 100)]);
    expect(owner.totalProfit).toBe(-200);
    expect(owner.grossMargin).toBe(-.25);
    const zero = {
      ...single,
      total: 0,
      items: [{
        ...single.items[0],
        pricing: { ...single.items[0].pricing, totalSellingPrice: 0, unitSellingPrice: 0 },
      }],
    };
    const zeroResult = resolution('CND-01', 10, 0, 1);
    const zeroOwner = buildOwnerQuotationView(zero, [zeroResult]);
    expect(zeroOwner.totalProfit).toBe(-10);
    expect(zeroOwner.grossMargin).toBeNull();
  });

  it('refuses stale or mismatched resolution/quote identity and quantities', () => {
    const resolutions = [resolution('CND-01', 10, 800, 30), resolution('POT-02', 6, 600, 40, 15)];
    expect(() => buildOwnerQuotationView(customer, resolutions.slice(0, 1))).toThrow(OwnerQuotationError);
    expect(() => buildOwnerQuotationView(customer, [resolutions[1], resolutions[0]])).toThrow(OwnerQuotationError);
    expect(() => buildOwnerQuotationView(customer, [
      resolution('CND-01', 11, 800, 30), resolutions[1],
    ])).toThrow(OwnerQuotationError);
    expect(() => buildOwnerQuotationView(customer, [
      resolution('CND-01', 10, 810, 30), resolutions[1],
    ])).toThrow(OwnerQuotationError);
  });

  it('never assumes missing tier costing extras are zero', () => {
    const missing = resolution('POT-02', 6, 600, 40, 15);
    missing.selectedTier = null;
    const owner = buildOwnerQuotationView({ ...customer, items: [customer.items[1]], total: 600 }, [missing]);
    expect(owner.items[0].totalProductCost).toBeNull();
    expect(owner.unresolvedCostCount).toBe(1);
  });
});
