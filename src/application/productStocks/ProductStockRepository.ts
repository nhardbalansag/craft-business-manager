import type { ProductStock } from '../../domain/productStock';

/** Persistence boundary for current finished Product/component stock source data. */
export interface ProductStockRepository {
  list(): Promise<ProductStock[]>;
  findByProductId(productId: string): Promise<ProductStock | null>;
  upsert(stock: ProductStock): Promise<void>;
}
