import { describe, expect, it } from 'vitest';
import {
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_RULES,
  ProductContractError,
  cloneProduct,
  getProductCategoryRule,
  isProductCategory,
  parseProductCategory,
  validateProductContract,
  type Product,
} from './products';

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'ART-001',
    name: 'Paintable Star',
    category: 'paintable-art',
    mixPresetId: 'MIX-PLASTER-2-1',
    safetyWasteRate: 0.05,
    notes: 'Sample product',
    isActive: true,
    ...overrides,
  };
}

describe('candle fragrance pairing contract', () => {
  it('requires a paired wax and essential oil only for candle Products', () => {
    expect(() => validateProductContract(product({
      category: 'candle', candleWaxMaterialId: 'WAX', candleEssentialOilMaterialId: 'OIL',
    }))).not.toThrow();
    for (const configured of [
      product({ category: 'candle', candleWaxMaterialId: 'WAX' }),
      product({ category: 'candle', candleEssentialOilMaterialId: 'OIL' }),
      product({ category: 'candle', candleWaxMaterialId: 'WAX', candleEssentialOilMaterialId: 'WAX' }),
      product({ candleWaxMaterialId: 'WAX', candleEssentialOilMaterialId: 'OIL' }),
    ]) {
      expect(() => validateProductContract(configured)).toThrow(
        expect.objectContaining({ code: 'INVALID_CANDLE_OIL_CONFIGURATION' }),
      );
    }
  });
});

describe('product quotation image contract', () => {
  const photo = `data:image/jpeg;base64,/9j/${'AAAA'.repeat(25)}`;

  it('accepts an optional compact JPEG image and rejects oversized, non-JPEG and unsafe URLs', () => {
    expect(() => validateProductContract(product({ imageDataUrl: photo }))).not.toThrow();
    for (const value of [
      'https://example.org/image.png',
      'data:image/svg+xml;base64,PHN2Zz48c2NyaXB0',
      'data:image/png;base64,AAAA',
      `data:image/jpeg;base64,${'AAAA'.repeat(6_251)}`,
    ]) {
      expect(() => validateProductContract(product({ imageDataUrl: value }))).toThrow(
        expect.objectContaining({ code: 'INVALID_IMAGE_DATA_URL' }),
      );
    }
  });
});

describe('product categories', () => {
  it('exposes the locked Phase 2 categories', () => {
    expect(PRODUCT_CATEGORIES).toEqual(['paintable-art', 'candle-pot', 'candle']);
  });

  it.each(PRODUCT_CATEGORIES)('recognizes %s as a supported category', (category) => {
    expect(isProductCategory(category)).toBe(true);
    expect(parseProductCategory(category)).toBe(category);
  });

  it('rejects unsupported category values with a controlled error', () => {
    expect(() => parseProductCategory('gift-set')).toThrowError(ProductContractError);
    try {
      parseProductCategory('gift-set');
    } catch (error) {
      expect(error).toBeInstanceOf(ProductContractError);
      expect((error as ProductContractError).code).toBe('INVALID_CATEGORY');
    }
  });
});

describe('product category rules', () => {
  it('centralizes molded/volume guidance for paintable art and candle pots', () => {
    for (const category of ['paintable-art', 'candle-pot'] as const) {
      expect(getProductCategoryRule(category)).toMatchObject({
        category,
        productionStyle: 'molded',
        typicalMixBasis: 'volume',
        yieldLearning: 'recommended',
        componentCompositionPhase: 3,
      });
    }
  });

  it('centralizes candle guidance without introducing vessel composition', () => {
    expect(PRODUCT_CATEGORY_RULES.candle).toMatchObject({
      productionStyle: 'poured',
      typicalMixBasis: 'weight',
      yieldLearning: 'supported',
      componentCompositionPhase: 3,
    });
  });
});

describe('product contract validation', () => {
  it.each(PRODUCT_CATEGORIES)('accepts a valid %s product', (category) => {
    expect(() => validateProductContract(product({ category }))).not.toThrow();
  });

  it('allows products without a mix preset', () => {
    expect(() => validateProductContract(product({ mixPresetId: undefined }))).not.toThrow();
  });

  it('accepts safety waste from zero up to but excluding 100%', () => {
    expect(() => validateProductContract(product({ safetyWasteRate: 0 }))).not.toThrow();
    expect(() => validateProductContract(product({ safetyWasteRate: 0.999 }))).not.toThrow();
  });

  it.each([
    [{ id: '   ' }, 'INVALID_ID'],
    [{ name: '   ' }, 'INVALID_NAME'],
    [{ category: 'gift-set' as Product['category'] }, 'INVALID_CATEGORY'],
    [{ mixPresetId: '  ' }, 'INVALID_MIX_PRESET_ID'],
    [{ safetyWasteRate: -0.01 }, 'INVALID_SAFETY_WASTE_RATE'],
    [{ safetyWasteRate: 1 }, 'INVALID_SAFETY_WASTE_RATE'],
    [{ safetyWasteRate: 1.25 }, 'INVALID_SAFETY_WASTE_RATE'],
    [{ safetyWasteRate: Number.NaN }, 'INVALID_SAFETY_WASTE_RATE'],
    [{ safetyWasteRate: Number.POSITIVE_INFINITY }, 'INVALID_SAFETY_WASTE_RATE'],
    [{ isActive: 'yes' as unknown as boolean }, 'INVALID_ACTIVE_STATE'],
  ] as const)('rejects invalid product source data %#', (overrides, expectedCode) => {
    try {
      validateProductContract(product(overrides as Partial<Product>));
      throw new Error('Expected product validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(ProductContractError);
      expect((error as ProductContractError).code).toBe(expectedCode);
    }
  });

  it('clones the authoritative source fields without adding derived data', () => {
    const original = product();
    const cloned = cloneProduct(original);
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
  });
});
