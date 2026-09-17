import type { StorageLocation } from '../../domain/storageLocations';

export interface StorageLocationRepository {
  list(): Promise<StorageLocation[]>;
  findById(id: string): Promise<StorageLocation | null>;
  insert(location: StorageLocation): Promise<void>;
  replace(location: StorageLocation): Promise<void>;
}
