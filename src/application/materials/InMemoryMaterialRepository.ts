import type { Material } from '../../domain/materials';
import { cloneMaterial } from '../../domain/materials';
import type { MaterialRepository } from './MaterialRepository';

function key(id: string): string {
  return id.trim().toLocaleLowerCase();
}

export class InMemoryMaterialRepository implements MaterialRepository {
  private readonly materials = new Map<string, Material>();

  constructor(seed: Material[] = []) {
    for (const material of seed) {
      this.materials.set(key(material.id), cloneMaterial(material));
    }
  }

  async list(): Promise<Material[]> {
    return [...this.materials.values()].map(cloneMaterial);
  }

  async findById(id: string): Promise<Material | null> {
    const material = this.materials.get(key(id));
    return material ? cloneMaterial(material) : null;
  }

  async insert(material: Material): Promise<void> {
    this.materials.set(key(material.id), cloneMaterial(material));
  }

  async replace(material: Material): Promise<void> {
    this.materials.set(key(material.id), cloneMaterial(material));
  }
}
