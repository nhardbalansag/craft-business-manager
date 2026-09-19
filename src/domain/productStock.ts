export interface ProductStock {
  productId: string;
  onHandQuantity: number;
  notes?: string;
}

export type ProductStockErrorCode =
  | 'INVALID_PRODUCT_ID'
  | 'NON_FINITE_ON_HAND_QUANTITY'
  | 'NON_INTEGER_ON_HAND_QUANTITY'
  | 'NEGATIVE_ON_HAND_QUANTITY';

export class ProductStockError extends Error {
  readonly code: ProductStockErrorCode;
  readonly productId?: string;
  readonly input?: unknown;

  constructor(
    code: ProductStockErrorCode,
    message: string,
    context: { productId?: string; input?: unknown } = {},
  ) {
    super(message);
    this.name = 'ProductStockError';
    this.code = code;
    this.productId = context.productId;
    this.input = context.input;
  }
}

export function cloneProductStock(stock: ProductStock): ProductStock {
  return { ...stock };
}

/**
 * Normalizes the authoritative finished Product stock source record.
 *
 * Stock unit is implicitly pc and is deliberately not represented as a mutable field.
 * Blank notes are omitted rather than persisted as meaningless source data.
 */
export function normalizeProductStock(stock: ProductStock): ProductStock {
  const notes = stock.notes?.trim();

  return {
    ...stock,
    productId: stock.productId.trim(),
    notes: notes ? notes : undefined,
  };
}

/**
 * Validates one ProductStock source record.
 *
 * Product repository existence and one-record-per-Product persistence enforcement
 * belong to Phase 3.2B. This pure domain contract validates source identity/quantity only.
 */
export function validateProductStockContract(stock: ProductStock): void {
  if (!stock.productId.trim()) {
    throw new ProductStockError(
      'INVALID_PRODUCT_ID',
      'Product stock Product ID is required.',
      { productId: stock.productId, input: stock.productId },
    );
  }

  if (!Number.isFinite(stock.onHandQuantity)) {
    throw new ProductStockError(
      'NON_FINITE_ON_HAND_QUANTITY',
      'Product stock on-hand quantity must be finite.',
      { productId: stock.productId, input: stock.onHandQuantity },
    );
  }

  if (!Number.isInteger(stock.onHandQuantity)) {
    throw new ProductStockError(
      'NON_INTEGER_ON_HAND_QUANTITY',
      'Product stock on-hand quantity must be a whole-piece count.',
      { productId: stock.productId, input: stock.onHandQuantity },
    );
  }

  if (stock.onHandQuantity < 0) {
    throw new ProductStockError(
      'NEGATIVE_ON_HAND_QUANTITY',
      'Product stock on-hand quantity cannot be negative.',
      { productId: stock.productId, input: stock.onHandQuantity },
    );
  }
}
