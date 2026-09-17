import { cloneMold, type Mold } from '../../domain/molds';
import type { CollectionReplacementPort } from '../persistence/CollectionReplacementPort';
import type { MoldRepository } from './MoldRepository';

function key(id: string): string {
  return id.trim().toLowerCase();
}

export class InMemoryMoldRepository implements MoldRepository, CollectionReplacementPort<Mold> {
  private molds = new Map<string, Mold>();

  constructor(seed: Mold[] = []) {
    for (const mold of seed) this.molds.set(key(mold.id), cloneMold(mold));
  }

  async list(): Promise<Mold[]> {
    return [...this.molds.values()].map(cloneMold);
  }

  async findById(id: string): Promise<Mold | null> {
    const mold = this.molds.get(key(id));
    return mold ? cloneMold(mold) : null;
  }

  async insert(mold: Mold): Promise<void> {
    this.molds.set(key(mold.id), cloneMold(mold));
  }

  async replace(mold: Mold): Promise<void> {
    this.molds.set(key(mold.id), cloneMold(mold));
  }

  async replaceAll(records: readonly Mold[]): Promise<void> {
    const next = new Map<string, Mold>();
    for (const mold of records) next.set(key(mold.id), cloneMold(mold));
    this.molds = next;
  }
}
