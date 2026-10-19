import { describe, expect, it, vi } from 'vitest';
import {
  printProductBrochure,
  ProductBrochurePrintError,
  renderProductBrochureHtml,
  type ProductBrochureView,
} from './productBrochurePrint';

const photo = 'data:image/jpeg;base64,/9j/' + 'AAAA'.repeat(25);
const view: ProductBrochureView = {
  productId: 'CLC-01',
  name: 'Blush Round Candle',
  categoryLabel: 'Candle',
  description: 'Handcrafted plaster candle vessel with a soft pastel finish.',
  imageDataUrl: photo,
  prices: [
    { id: 'single', label: 'SINGLE', quantity: 1, unitPrice: 24, detail: 'Per piece' },
    { id: 'bulk30', label: '30+ PCS', quantity: 30, unitPrice: 22, detail: 'Bulk' },
    { id: 'bulk50', label: '50+ PCS', quantity: 50, unitPrice: 19, detail: 'Bulk' },
  ],
};

describe('A4 My Lovely Craft brochure print', () => {
  it('renders the reference-inspired branding, image, customer copy and actual three price columns', () => {
    const html = renderProductBrochureHtml(view);
    expect(html).toContain('@page { size: A4 portrait; margin: 0; }');
    expect(html).toContain('<h1 class="brand-name">My Lovely Craft</h1>');
    expect(html).toContain('/brand/mlc-mark.webp');
    expect(html).toContain('Blush Round Candle');
    expect(html).toContain(photo);
    expect(html).toContain('Handcrafted plaster candle vessel');
    expect(html).toContain('PRICE &amp; PACKAGES');
    expect(html).toContain('SINGLE');
    expect(html).toContain('30+ PCS');
    expect(html).toContain('50+ PCS');
    expect(html).toContain('₱24.00');
    expect(html).toContain('₱22.00');
    expect(html).toContain('₱19.00');
    expect(html).toContain('PRODUCT CODE CLC-01');
    expect(html).toContain('mylovelycraft.coresite.pro');
    expect(html).toContain('Save as PDF');
    expect(html).not.toContain('Fully loaded cost');
    expect(html).not.toContain('Profit / unit');
  });

  it('escapes source content and does not print untrusted image URLs or internal notes', () => {
    const html = renderProductBrochureHtml({
      ...view, name: '<img onerror=alert(1)>', imageDataUrl: 'javascript:alert(1)',
      description: '<script>evil()</script>',
      prices: [],
    });
    expect(html).toContain('&lt;img onerror=alert(1)&gt;');
    expect(html).toContain('&lt;script&gt;evil()&lt;/script&gt;');
    expect(html).not.toContain('src="javascript:alert(1)"');
    expect(html).toContain('Product photo not yet available');
    expect(html).toContain('CONTACT US FOR PRICING');
    expect(html).not.toContain('PRICE &amp; PACKAGES');
  });

  it('prints an HTML document and invokes the browser print dialog for Save as PDF', () => {
    const document = {
      open: vi.fn(), write: vi.fn(), close: vi.fn(),
      images: [] as HTMLImageElement[],
    };
    const focus = vi.fn(), print = vi.fn();
    printProductBrochure(view, () => ({
      document: document as unknown as Document, focus, print,
    }));
    expect(document.write).toHaveBeenCalledWith(expect.stringContaining('Blush Round Candle'));
    expect(document.write).toHaveBeenCalledWith(expect.stringContaining('A4 portrait'));
    expect(document.open).toHaveBeenCalledOnce();
    expect(document.close).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledOnce();
    expect(print).toHaveBeenCalledOnce();
  });

  it('fails gracefully when popups are blocked', () => {
    expect(() => printProductBrochure(view, () => null)).toThrow(ProductBrochurePrintError);
  });

  it('limits the layout to three prices even if an invalid caller passes more', () => {
    const html = renderProductBrochureHtml({
      ...view,
      prices: [
        ...view.prices,
        { id: 'fourth', label: 'OTHER', quantity: 200, unitPrice: 1, detail: 'Unused' },
      ],
    });
    expect(html).not.toContain('OTHER');
    expect(html).not.toContain('₱1.00');
  });
});
