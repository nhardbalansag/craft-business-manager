import { describe, expect, it } from 'vitest';
import {
  cloneProductStock,
  normalizeProductStock,
  ProductStockError,
  type ProductStock,
  validateProductStockContract,
} from './productStock';

function stock(overrides: Partial<ProductStock> = {}): ProductStock {
  return {
    productId: 'product-1',
    onHandQuantity: 0,
    ...overrides,
  };
}

describe('ProductStock contract', () => {
  it('accepts explicit zero stock', () => {
    expect(() => validateProductStockContract(stock({ onHandQuantity: 0 }))).not.toThrow();
  });

  it('accepts positive whole-piece stock', () => {
    expect(() => validateProductStockContract(stock({ onHandQuantity: 42 }))).not.toThrow();
  });

  it('normalizes Product identity and notes', () => {
    expect(
      normalizeProductStock(
        stock({
          productId: '  candle-pot  ',
          onHandQuantity: 3,
          notes: '  shelf count  ',
        }),
      ),
    ).toEqual({
      productId: 'candle-pot',
      onHandQuantity: 3,
      notes: 'shelf count',
    });
  });

  it('omits blank normalized notes', () => {
    expect(normalizeProductStock(stock({ notes: '   ' }))).toEqual({
      productId: 'product-1',
      onHandQuantity: 0,
      notes: undefined,
    });
  });

  it('defensively clones stock records', () => {
    const original = stock({ onHandQuantity: 5, notes: 'counted' });
    const cloned = cloneProductStock(original);

    cloned.onHandQuantity = 99;
    cloned.notes = 'changed';

    expect(original).toEqual({
      productId: 'product-1',
      onHandQuantity: 5,
      notes: 'counted',
    });
  });

  it('rejects blank Product identity', () => {
    expect(() => validateProductStockContract(stock({ productId: '   ' }))).toThrowError(
      expect.objectContaining({
        code: 'INVALID_PRODUCT_ID',
      }),
    );
  });

  it('rejects fractional stock', () => {
    expect(() => validateProductStockContract(stock({ onHandQuantity: 1.5 }))).toThrowError(
      expect.objectContaining({
        code: 'NON_INTEGER_ON_HAND_QUANTITY',
      }),
    );
  });

  it('rejects negative stock', () => {
    expect(() => validateProductStockContract(stock({ onHandQuantity: -1 }))).toThrowError(
      expect.objectContaining({
        code: 'NEGATIVE_ON_HAND_QUANTITY',
      }),
    );
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects non-finite stock %s',
    (onHandQuantity) => {
      expect(() => validateProductStockContract(stock({ onHandQuantity }))).toThrowError(
        expect.objectContaining({
          code: 'NON_FINITE_ON_HAND_QUANTITY',
        }),
      );
    },
  );

  it('includes offending Product/quantity context in typed errors', () => {
    try {
      validateProductStockContract(stock({ productId: ' child ', onHandQuantity: -2 }));
      throw new Error('Expected validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(ProductStockError);
      expect(error).toMatchObject({
        code: 'NEGATIVE_ON_HAND_QUANTITY',
        productId: ' child ',
        input: -2,
      });
    }
  });
});
