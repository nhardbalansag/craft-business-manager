import { describe, expect, it, vi } from 'vitest';
import type { CustomerQuotationView } from './customerQuotation';
import {
  printCustomerQuotation,
  renderCustomerQuotationHtml,
} from './customerQuotationPrint';

const view: CustomerQuotationView = {
  businessName: 'My Lovely Craft',
  quotationReference: 'QT-100',
  generatedAtIso: '2026-10-06T00:00:00.000Z',
  validUntil: '2026-10-13',
  customer: {
    name: 'Ana <Customer>',
    contact: 'ana@example.com',
    address: 'Bulacan',
  },
  items: [
    {
      product: {
        id: 'PROD-001',
        name: 'Custom Candle',
        quantity: 20,
      },
      pricing: {
        sourceLabel: 'Event Bulk',
        tierId: 'TIER-0002',
        unitSellingPrice: 80,
        totalSellingPrice: 1600,
        offerCount: 20,
      },
    },
    {
      product: {
        id: 'PROD-002',
        name: 'Paintable Bear',
        quantity: 5,
      },
      pricing: {
        sourceLabel: 'Default / Single',
        tierId: null,
        unitSellingPrice: 120,
        totalSellingPrice: 600,
        offerCount: 5,
      },
    },
  ],
  subtotal: 2200,
  total: 2200,
  product: {
    id: 'PROD-001',
    name: 'Custom Candle',
    quantity: 20,
  },
  pricing: {
    sourceLabel: 'Event Bulk',
    tierId: 'TIER-0002',
    unitSellingPrice: 80,
    totalSellingPrice: 1600,
    offerCount: 20,
  },
  notes: 'Lavender scent.',
  terms: '50% down payment.',
};

describe('customerQuotationPrint', () => {
  it('renders an A4 customer-facing quotation without internal cost/profit fields', () => {
    const html = renderCustomerQuotationHtml(view);

    expect(html).toContain('Customer Quotation');
    expect(html).toContain('QT-100');
    expect(html).toContain('Custom Candle');
    expect(html).toContain('Paintable Bear');
    expect(html).toContain('₱1,600.00');
    expect(html).toContain('₱600.00');
    expect(html).toContain('₱2,200.00');
    expect(html).toContain('Ana &lt;Customer&gt;');
    expect(html).toContain('Save as PDF');
    expect(html).not.toContain('Profit per unit');
    expect(html).not.toContain('Fully loaded');
    expect(html).not.toContain('Margin');
  });

  it('writes the document and invokes the browser print dialog', () => {
    const document = {
      open: vi.fn(),
      write: vi.fn(),
      close: vi.fn(),
    };
    const focus = vi.fn();
    const print = vi.fn();

    printCustomerQuotation(view, () => ({
      document: document as unknown as Document,
      focus,
      print,
    }));

    expect(document.open).toHaveBeenCalledOnce();
    expect(document.write).toHaveBeenCalledOnce();
    expect(document.close).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledOnce();
    expect(print).toHaveBeenCalledOnce();
  });
});
