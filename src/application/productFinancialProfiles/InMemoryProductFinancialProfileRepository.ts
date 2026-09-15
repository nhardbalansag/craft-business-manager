import {
  cloneProductFinancialProfile,
  type ProductFinancialProfile,
} from '../../domain/productFinancialProfile';
import type { CollectionReplacementPort } from '../persistence/CollectionReplacementPort';
import type { ProductFinancialProfileRepository } from './ProductFinancialProfileRepository';

function key(productId: string): string {
  return productId.trim().toLowerCase();
}

export class InMemoryProductFinancialProfileRepository
  implements ProductFinancialProfileRepository, CollectionReplacementPort<ProductFinancialProfile>
{
  private profiles = new Map<string, ProductFinancialProfile>();

  constructor(seed: ProductFinancialProfile[] = []) {
    for (const profile of seed) {
      this.profiles.set(key(profile.productId), cloneProductFinancialProfile(profile));
    }
  }

  async list(): Promise<ProductFinancialProfile[]> {
    return [...this.profiles.values()].map(cloneProductFinancialProfile);
  }

  async findByProductId(productId: string): Promise<ProductFinancialProfile | null> {
    const profile = this.profiles.get(key(productId));
    return profile ? cloneProductFinancialProfile(profile) : null;
  }

  async upsert(profile: ProductFinancialProfile): Promise<void> {
    this.profiles.set(key(profile.productId), cloneProductFinancialProfile(profile));
  }

  async replaceAll(records: readonly ProductFinancialProfile[]): Promise<void> {
    const next = new Map<string, ProductFinancialProfile>();
    for (const profile of records) {
      next.set(key(profile.productId), cloneProductFinancialProfile(profile));
    }
    this.profiles = next;
  }
}
