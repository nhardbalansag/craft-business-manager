import type { FixedRecipeItem } from '../../domain/fixedRecipeItems';

/** Persistence boundary for fixed per-product recipe source inputs. */
export interface FixedRecipeItemRepository {
  list(): Promise<FixedRecipeItem[]>;
  findById(id: string): Promise<FixedRecipeItem | null>;
  insert(item: FixedRecipeItem): Promise<void>;
  replace(item: FixedRecipeItem): Promise<void>;
  delete(id: string): Promise<void>;
}
