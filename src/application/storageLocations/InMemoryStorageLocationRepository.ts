import { cloneStorageLocation, type StorageLocation } from '../../domain/storageLocations';
import type { CollectionReplacementPort } from '../persistence/CollectionReplacementPort';
import type { StorageLocationRepository } from './StorageLocationRepository';

function key(id: string): string {
  return id.trim().toLowerCase();
}

export class InMemoryStorageLocationRepository
  implements StorageLocationRepository, CollectionReplacementPort<StorageLocation>
{
  private locations = new Map<string, StorageLocation>();

  constructor(seed: StorageLocation[] = []) {
    for (const location of seed) this.locations.set(key(location.id), cloneStorageLocation(location));
  }

  async list(): Promise<StorageLocation[]> {
    return [...this.locations.values()].map(cloneStorageLocation);
  }

  async findById(id: string): Promise<StorageLocation | null> {
    const location = this.locations.get(key(id));
    return location ? cloneStorageLocation(location) : null;
  }

  async insert(location: StorageLocation): Promise<void> {
    this.locations.set(key(location.id), cloneStorageLocation(location));
  }

  async replace(location: StorageLocation): Promise<void> {
    this.locations.set(key(location.id), cloneStorageLocation(location));
  }

  async replaceAll(records: readonly StorageLocation[]): Promise<void> {
    const next = new Map<string, StorageLocation>();
    for (const location of records) next.set(key(location.id), cloneStorageLocation(location));
    this.locations = next;
  }
}
