import type { ProductPriceTier } from '../../domain/productPriceTiers';
import { cloneProductPriceTier } from '../../domain/productPriceTiers';
import type { CollectionReplacementPort } from '../persistence/CollectionReplacementPort';
import type { ProductPriceTierRepository } from './ProductPriceTierRepository';

function key(id: string): string {
  return id.trim().toLowerCase();
}

export class InMemoryProductPriceTierRepository
  implements ProductPriceTierRepository, CollectionReplacementPort<ProductPriceTier>
{
  private tiers = new Map<string, ProductPriceTier>();

  constructor(seed: ProductPriceTier[] = []) {
    for (const tier of seed) {
      this.tiers.set(key(tier.id), cloneProductPriceTier(tier));
    }
  }

  async list(): Promise<ProductPriceTier[]> {
    return [...this.tiers.values()].map(cloneProductPriceTier);
  }

  async findById(id: string): Promise<ProductPriceTier | null> {
    const tier = this.tiers.get(key(id));
    return tier ? cloneProductPriceTier(tier) : null;
  }

  async insert(tier: ProductPriceTier): Promise<void> {
    this.tiers.set(key(tier.id), cloneProductPriceTier(tier));
  }

  async replace(tier: ProductPriceTier): Promise<void> {
    this.tiers.set(key(tier.id), cloneProductPriceTier(tier));
  }

  async replaceAll(records: readonly ProductPriceTier[]): Promise<void> {
    const next = new Map<string, ProductPriceTier>();
    for (const tier of records) {
      next.set(key(tier.id), cloneProductPriceTier(tier));
    }
    this.tiers = next;
  }
}
