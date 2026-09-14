import type { BusinessDataset } from '../domain/types';

export interface StoragePort {
  load(): Promise<BusinessDataset>;
  save(dataset: BusinessDataset): Promise<void>;
  createBackup?(dataset: BusinessDataset): Promise<string>;
}
