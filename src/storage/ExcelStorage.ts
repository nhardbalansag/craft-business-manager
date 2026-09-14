import type { BusinessDataset } from '../domain/types';
import type { StoragePort } from './StoragePort';

/**
 * Excel-backed persistence adapter.
 *
 * The workbook parser/writer and Tauri filesystem gateway are intentionally kept
 * outside the domain layer. Phase 3 will map workbook sheets to BusinessDataset.
 */
export class ExcelStorage implements StoragePort {
  async load(): Promise<BusinessDataset> {
    throw new Error('ExcelStorage.load is scheduled for the Excel persistence phase.');
  }

  async save(_dataset: BusinessDataset): Promise<void> {
    throw new Error('ExcelStorage.save is scheduled for the Excel persistence phase.');
  }
}
