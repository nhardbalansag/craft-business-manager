import { describe, expect, it } from 'vitest';
import type { Product } from '../../domain/products';
import {
  buildProductLabelView,
  getProductLabelSizePreset,
  normalizeProductLabelCopies,
  PRODUCT_LABEL_MAX_COPIES,
} from './productLabelView';

const product: Product = {
  id: 'ART-DINO-01',
  name: 'Paintable Dinosaur',
  category: 'paintable-art',
  safetyWasteRate: 0.05,
  notes: 'Keep molds together.',
  isActive: true,
};

describe('productLabelView', () => {
  it('builds a label snapshot from authoritative product identity and selected presentation options', () => {
    expect(
      buildProductLabelView(product, {
        sizeId: '50x30',
        copies: 4,
        showCategory: true,
        showStatus: false,
      }),
    ).toEqual({
      product: {
        id: 'ART-DINO-01',
        name: 'Paintable Dinosaur',
        categoryLabel: 'Paintable art',
        isActive: true,
      },
      size: { id: '50x30', label: '50 × 30 mm', widthMm: 50, heightMm: 30 },
      copies: 4,
      showCategory: true,
      showStatus: false,
    });
  });

  it('normalizes copy bounds and resolves supported millimeter presets', () => {
    expect(normalizeProductLabelCopies(Number.NaN)).toBe(1);
    expect(normalizeProductLabelCopies(0)).toBe(1);
    expect(normalizeProductLabelCopies(2.9)).toBe(2);
    expect(normalizeProductLabelCopies(999)).toBe(PRODUCT_LABEL_MAX_COPIES);
    expect(getProductLabelSizePreset('60x40')).toMatchObject({ widthMm: 60, heightMm: 40 });
  });
});
