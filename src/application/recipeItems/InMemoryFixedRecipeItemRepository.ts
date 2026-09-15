import type { FixedRecipeItem } from '../../domain/fixedRecipeItems';
import { cloneFixedRecipeItem } from '../../domain/fixedRecipeItems';
import type { CollectionReplacementPort } from '../persistence/CollectionReplacementPort';
import type { FixedRecipeItemRepository } from './FixedRecipeItemRepository';

function key(id: string): string {
  return id.trim().toLowerCase();
}

export class InMemoryFixedRecipeItemRepository
  implements FixedRecipeItemRepository, CollectionReplacementPort<FixedRecipeItem>
{
  private items = new Map<string, FixedRecipeItem>();

  constructor(seed: FixedRecipeItem[] = []) {
    for (const item of seed) {
      this.items.set(key(item.id), cloneFixedRecipeItem(item));
    }
  }

  async list(): Promise<FixedRecipeItem[]> {
    return [...this.items.values()].map(cloneFixedRecipeItem);
  }

  async findById(id: string): Promise<FixedRecipeItem | null> {
    const item = this.items.get(key(id));
    return item ? cloneFixedRecipeItem(item) : null;
  }

  async insert(item: FixedRecipeItem): Promise<void> {
    this.items.set(key(item.id), cloneFixedRecipeItem(item));
  }

  async replace(item: FixedRecipeItem): Promise<void> {
    this.items.set(key(item.id), cloneFixedRecipeItem(item));
  }

  async delete(id: string): Promise<void> {
    this.items.delete(key(id));
  }

  async replaceAll(records: readonly FixedRecipeItem[]): Promise<void> {
    const next = new Map<string, FixedRecipeItem>();
    for (const item of records) {
      next.set(key(item.id), cloneFixedRecipeItem(item));
    }
    this.items = next;
  }
}
