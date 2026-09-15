import type { ProductComponent } from '../../domain/productComponents';
import { cloneProductComponent } from '../../domain/productComponents';
import type { ProductComponentRepository } from './ProductComponentRepository';

function key(id: string): string {
  return id.trim().toLowerCase();
}

export class InMemoryProductComponentRepository implements ProductComponentRepository {
  private readonly components = new Map<string, ProductComponent>();

  constructor(seed: ProductComponent[] = []) {
    for (const component of seed) {
      this.components.set(key(component.id), cloneProductComponent(component));
    }
  }

  async list(): Promise<ProductComponent[]> {
    return [...this.components.values()].map(cloneProductComponent);
  }

  async findById(id: string): Promise<ProductComponent | null> {
    const component = this.components.get(key(id));
    return component ? cloneProductComponent(component) : null;
  }

  async insert(component: ProductComponent): Promise<void> {
    this.components.set(key(component.id), cloneProductComponent(component));
  }

  async replace(component: ProductComponent): Promise<void> {
    this.components.set(key(component.id), cloneProductComponent(component));
  }

  async delete(id: string): Promise<void> {
    this.components.delete(key(id));
  }
}
