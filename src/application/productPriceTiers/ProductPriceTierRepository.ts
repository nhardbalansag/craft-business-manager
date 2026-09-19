import type { ProductPriceTier } from '../../domain/productPriceTiers';

/** Persistence boundary for Product price tier application services. */
export interface ProductPriceTierRepository {
  list(): Promise<ProductPriceTier[]>;
  findById(id: string): Promise<ProductPriceTier | null>;
  insert(tier: ProductPriceTier): Promise<void>;
  replace(tier: ProductPriceTier): Promise<void>;
}
