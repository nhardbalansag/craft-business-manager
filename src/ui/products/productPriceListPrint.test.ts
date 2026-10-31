import { describe, expect, it, vi } from 'vitest';
import type { ProductPriceListView } from './productPriceList';
import { printProductPriceList, renderProductPriceListHtml } from './productPriceListPrint';

const photo = 'data:image/jpeg;base64,/9j/' + 'AAAA'.repeat(25);
const view: ProductPriceListView = {
  includePictures: true, includePackages: false,
  rows: [{ productId: 'P-1', name: 'Bear P (1pcs)', categoryLabel: 'Paintable art', imageDataUrl: photo,
    prices: [
      { id: 'single', label: 'SINGLE', detail: 'Per piece', quantity: 1, unitPrice: 35 },
      { id: 'bulk', label: '30+ PCS', detail: 'Party package', quantity: 30, unitPrice: 25 },
    ],
  }],
};

describe('Printable product price list', () => {
  it('prints pictures only when enabled and includes package minimums only when requested', () => {
    const html = renderProductPriceListHtml(view);
    expect(html).toContain(photo);
    expect(html).toContain('₱35.00');
    expect(html).not.toContain('₱25.00');
    expect(html).toContain('P-1');
    expect(html).toContain('table-header-group');
    expect(html).toContain('break-inside: avoid');
    const withPackages = renderProductPriceListHtml({ ...view, includePictures: false, includePackages: true });
    expect(withPackages).not.toContain(photo);
    expect(withPackages).not.toContain('<th class="picture-column">');
    expect(withPackages).toContain('Party package · Min. 30 pcs');
    expect(withPackages).toContain('₱25.00');
  });

  it('escapes source text, rejects unsafe images and never turns missing or invalid prices into zero', () => {
    const html = renderProductPriceListHtml({ ...view, rows: [{ ...view.rows[0], name: '<script>bad()</script>', imageDataUrl: 'javascript:alert(1)', prices: [
      { ...view.rows[0].prices[0], unitPrice: NaN },
      { ...view.rows[0].prices[0], quantity: 0 },
    ] }] });
    expect(html).toContain('&lt;script&gt;bad()&lt;/script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('src="javascript:');
    expect(html).toContain('No picture');
    expect(html).toContain('Contact us for pricing');
    expect(html).not.toContain('₱0.00');
  });

  it('handles blocked popups and waits for both loaded and failed photos before printing', async () => {
    expect(() => printProductPriceList(view, () => null)).toThrow('Allow pop-ups');
    const listeners: Record<string, () => void> = {};
    const photoNode = { complete: false, addEventListener: (name: string, callback: () => void) => { listeners[name] = callback; } };
    const print = vi.fn(), focus = vi.fn();
    const doc = { open: vi.fn(), close: vi.fn(), write: vi.fn(), images: [photoNode] };
    printProductPriceList(view, () => ({ document: doc as unknown as Document, print, focus }));
    expect(doc.write).toHaveBeenCalledWith(expect.stringContaining('Bear P (1pcs)'));
    expect(print).not.toHaveBeenCalled();
    listeners.error();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(print).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledOnce();
  });
});
