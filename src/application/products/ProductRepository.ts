import type { Product } from '../../domain/products';

/** Persistence boundary for product application services. */
export interface ProductRepository {
  list(): Promise<Product[]>;
  findById(id: string): Promise<Product | null>;
  insert(product: Product): Promise<void>;
  replace(product: Product): Promise<void>;
}
