import type { ProductFinancialProfile } from '../../domain/productFinancialProfile';

/** Persistence boundary for Product financial-profile source data. */
export interface ProductFinancialProfileRepository {
  list(): Promise<ProductFinancialProfile[]>;
  findByProductId(productId: string): Promise<ProductFinancialProfile | null>;
  upsert(profile: ProductFinancialProfile): Promise<void>;
}
