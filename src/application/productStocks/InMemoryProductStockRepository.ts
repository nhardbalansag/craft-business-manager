import type { ProductStock } from '../../domain/productStock';
import { cloneProductStock } from '../../domain/productStock';
import type { CollectionReplacementPort } from '../persistence/CollectionReplacementPort';
import type { ProductStockRepository } from './ProductStockRepository';

function key(productId: string): string {
  return productId.trim().toLowerCase();
}

export class InMemoryProductStockRepository
  implements ProductStockRepository, CollectionReplacementPort<ProductStock>
{
  private stocks = new Map<string, ProductStock>();

  constructor(seed: ProductStock[] = []) {
    for (const stock of seed) {
      this.stocks.set(key(stock.productId), cloneProductStock(stock));
    }
  }

  async list(): Promise<ProductStock[]> {
    return [...this.stocks.values()].map(cloneProductStock);
  }

  async findByProductId(productId: string): Promise<ProductStock | null> {
    const stock = this.stocks.get(key(productId));
    return stock ? cloneProductStock(stock) : null;
  }

  async upsert(stock: ProductStock): Promise<void> {
    this.stocks.set(key(stock.productId), cloneProductStock(stock));
  }

  async replaceAll(records: readonly ProductStock[]): Promise<void> {
    const next = new Map<string, ProductStock>();
    for (const stock of records) {
      next.set(key(stock.productId), cloneProductStock(stock));
    }
    this.stocks = next;
  }
}
