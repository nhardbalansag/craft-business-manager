import type { Product } from '../../domain/products';
import { cloneProduct } from '../../domain/products';
import type { CollectionReplacementPort } from '../persistence/CollectionReplacementPort';
import type { ProductRepository } from './ProductRepository';

function key(id: string): string {
  return id.trim().toLowerCase();
}

export class InMemoryProductRepository
  implements ProductRepository, CollectionReplacementPort<Product>
{
  private products = new Map<string, Product>();

  constructor(seed: Product[] = []) {
    for (const product of seed) {
      this.products.set(key(product.id), cloneProduct(product));
    }
  }

  async list(): Promise<Product[]> {
    return [...this.products.values()].map(cloneProduct);
  }

  async findById(id: string): Promise<Product | null> {
    const product = this.products.get(key(id));
    return product ? cloneProduct(product) : null;
  }

  async insert(product: Product): Promise<void> {
    this.products.set(key(product.id), cloneProduct(product));
  }

  async replace(product: Product): Promise<void> {
    this.products.set(key(product.id), cloneProduct(product));
  }

  async replaceAll(records: readonly Product[]): Promise<void> {
    const next = new Map<string, Product>();
    for (const product of records) {
      next.set(key(product.id), cloneProduct(product));
    }
    this.products = next;
  }
}
