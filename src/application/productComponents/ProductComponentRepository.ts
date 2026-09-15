import type { ProductComponent } from '../../domain/productComponents';

/** Persistence boundary for Phase 3 product-composition source data. */
export interface ProductComponentRepository {
  list(): Promise<ProductComponent[]>;
  findById(id: string): Promise<ProductComponent | null>;
  insert(component: ProductComponent): Promise<void>;
  replace(component: ProductComponent): Promise<void>;
  delete(id: string): Promise<void>;
}
