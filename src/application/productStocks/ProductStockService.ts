import {
  cloneProductStock,
  normalizeProductStock,
  type ProductStock,
  validateProductStockContract,
} from '../../domain/productStock';
import type { ProductRepository } from '../products/ProductRepository';
import type { ProductStockRepository } from './ProductStockRepository';

export interface ProductStockListFilter {
  productId?: string;
  query?: string;
}

export type ProductStockApplicationErrorCode = 'PRODUCT_NOT_FOUND';

export class ProductStockApplicationError extends Error {
  readonly code: ProductStockApplicationErrorCode;
  readonly productId?: string;

  constructor(
    code: ProductStockApplicationErrorCode,
    message: string,
    context: { productId?: string } = {},
  ) {
    super(message);
    this.name = 'ProductStockApplicationError';
    this.code = code;
    this.productId = context.productId;
  }
}

function comparable(value: string): string {
  return value.trim().toLowerCase();
}

function matchesQuery(stock: ProductStock, query: string): boolean {
  const normalized = comparable(query);
  if (!normalized) return true;

  return [stock.productId, stock.notes ?? ''].some((value) =>
    value.toLowerCase().includes(normalized),
  );
}

export class ProductStockService {
  constructor(
    private readonly repository: ProductStockRepository,
    private readonly products: ProductRepository,
  ) {}

  async setStock(
    productId: string,
    onHandQuantity: number,
    notes?: string,
  ): Promise<ProductStock> {
    return this.setStockRecord({ productId, onHandQuantity, notes });
  }

  async setStockRecord(input: ProductStock): Promise<ProductStock> {
    const normalized = normalizeProductStock(input);
    validateProductStockContract(normalized);

    const product = await this.products.findById(normalized.productId);
    if (!product) {
      throw new ProductStockApplicationError(
        'PRODUCT_NOT_FOUND',
        `Product not found for ProductStock: ${normalized.productId}.`,
        { productId: normalized.productId },
      );
    }

    const stock = normalizeProductStock({
      ...normalized,
      productId: product.id,
    });

    await this.repository.upsert(stock);
    return cloneProductStock(stock);
  }

  async getStock(productId: string): Promise<ProductStock | null> {
    const stock = await this.repository.findByProductId(productId);
    return stock ? cloneProductStock(stock) : null;
  }

  async listStocks(filter: ProductStockListFilter = {}): Promise<ProductStock[]> {
    const productKey = filter.productId ? comparable(filter.productId) : undefined;

    return (await this.repository.list())
      .filter(
        (stock) => productKey === undefined || comparable(stock.productId) === productKey,
      )
      .filter((stock) => filter.query === undefined || matchesQuery(stock, filter.query))
      .sort((left, right) =>
        left.productId.localeCompare(right.productId, undefined, { sensitivity: 'base' }),
      )
      .map(cloneProductStock);
  }
}
