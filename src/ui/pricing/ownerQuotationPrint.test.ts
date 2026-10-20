import { describe, expect, it, vi } from 'vitest';
import type { OwnerQuotationView } from './ownerQuotation';
import { printOwnerQuotation, renderOwnerQuotationHtml } from './ownerQuotationPrint';
import { CustomerQuotationPrintError } from './customerQuotationPrint';

const owner: OwnerQuotationView = {
  businessName: 'My Lovely Craft', quotationReference: 'QT-<PRIVATE>',
  generatedAtIso: '2026-10-21T02:00:00.000Z', validUntil: '2026-10-28',
  customer: { name: 'Wedding <Client>', contact: 'customer@example.com', address: 'Bulacan' },
  notes: 'Rose <candle> design', terms: 'Deposit 50%',
  items: [
    { productId: 'CND-01', productName: 'Daisy <Candle>', quantity: 10, sourceLabel: 'Default / Single',
      unitSellingPrice: 80, totalSellingPrice: 800, unitProductCost: 30, totalProductCost: 300,
      profitPerUnit: 50, totalProfit: 500, grossMargin: .625 },
    { productId: 'POT-02', productName: 'Candle Pot', quantity: 6, sourceLabel: 'Event Package',
      unitSellingPrice: 100, totalSellingPrice: 600, unitProductCost: 45, totalProductCost: 270,
      profitPerUnit: 55, totalProfit: 330, grossMargin: .55 },
  ],
  totalSales: 1400, totalProductCost: 570, totalProfit: 830,
  grossMargin: 830 / 1400, unresolvedCostCount: 0,
};

describe('private owner quotation print/PDF', () => {
  it('renders an explicitly confidential A4 report with item and total costs, gross profit and margin', () => {
    const html = renderOwnerQuotationHtml(owner);
    expect(html).toContain('@page { size: A4 landscape; margin: 12mm; }');
    expect(html).toContain('Business Owner Copy');
    expect(html).toContain('CONFIDENTIAL');
    expect(html).toContain('QT-&lt;PRIVATE&gt;');
    expect(html).toContain('Wedding &lt;Client&gt;');
    expect(html).toContain('Daisy &lt;Candle&gt;');
    expect(html).not.toContain('Daisy <Candle>');
    for (const expected of ['₱1,400.00', '₱570.00', '₱830.00', '₱300.00', '₱270.00', '₱500.00', '₱330.00']) {
      expect(html).toContain(expected);
    }
    expect(html).toContain('62.50%');
    expect(html).toContain('quotation estimates, not realized sales or net profit');
    expect(html).toContain('Save as PDF');
  });

  it('marks incomplete costs as unavailable, not zero totals or fabricated profit', () => {
    const html = renderOwnerQuotationHtml({
      ...owner, unresolvedCostCount: 1, totalProductCost: null,
      totalProfit: null, grossMargin: null,
      items: [{ ...owner.items[0], unitProductCost: null, totalProductCost: null, profitPerUnit: null, totalProfit: null, grossMargin: null }],
    });
    expect(html).toContain('Not available');
    expect(html).toContain('1 product(s) do not have complete saved cost evidence');
    expect(html).toContain('₱1,400.00');
  });

  it('opens only the private report and handles blocked pop-ups', () => {
    const mockDocument = { open: vi.fn(), write: vi.fn(), close: vi.fn() };
    const print = vi.fn(), focus = vi.fn();
    printOwnerQuotation(owner, () => ({
      document: mockDocument as unknown as Document, print, focus,
    }));
    expect(mockDocument.write).toHaveBeenCalledWith(expect.stringContaining('CONFIDENTIAL'));
    expect(mockDocument.write).not.toHaveBeenCalledWith(expect.stringContaining('Customer Quotation</small>'));
    expect(print).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledOnce();
    expect(() => printOwnerQuotation(owner, () => null)).toThrow(CustomerQuotationPrintError);
  });
});
