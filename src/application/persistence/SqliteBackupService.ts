import type { PhysicalBusinessDatasetV5 } from '../../domain/physicalBusinessDatasetV5';
import { sqliteRequest } from '../../storage/sqlite/sqliteClient';
import type { WorkspaceAutosave } from './WorkspaceAutosave';

export interface SqliteBackupReview {
  databaseGeneration?: string | null;
  hasCatalog: boolean;
  dataset: PhysicalBusinessDatasetV5 | null;
  products: number;
  materials: number;
  receipts: number;
  quotations: number;
  images: number;
  savedAt: string;
}
export class SqliteBackupService {
  constructor(private readonly autosave: WorkspaceAutosave) {}
  async exportBackup(): Promise<Uint8Array> {
    const dataset = await this.autosave.snapshotForBackup();
    return sqliteRequest({ action: 'backup.export', payload: { dataset } });
  }
  inspect(bytes: Uint8Array): Promise<SqliteBackupReview> { return sqliteRequest({ action: 'backup.inspect', payload: { bytes } }); }
  async restore(bytes: Uint8Array, expectedGeneration?: string | null): Promise<void> {
    const review = await sqliteRequest<SqliteBackupReview>({ action: 'backup.inspect', payload: { bytes, includeDataset: true } });
    if (expectedGeneration !== undefined && expectedGeneration !== review.databaseGeneration) throw new Error('The database changed after review. Select the backup again before restoring.');
    if (!review.dataset) throw new Error('This backup has no business catalog to restore.');
    const history = await sqliteRequest({ action: 'history.load' });
    await this.autosave.replaceDataset(review.dataset, (copy, expectedRevision) => sqliteRequest({ action: 'backup.restore',
      payload: { bytes, copy, expectedRevision, expectedHistoryRevision: history.revision, expectedGeneration: review.databaseGeneration } }));
  }
  async recover(bytes: Uint8Array, expectedGeneration?: string | null): Promise<void> {
    const review = await this.inspect(bytes);
    if (expectedGeneration !== undefined && expectedGeneration !== review.databaseGeneration) throw new Error('The database changed after review. Select the backup again before restoring.');
    await sqliteRequest({ action: 'backup.recover', payload: { bytes, expectedGeneration: review.databaseGeneration } });
    await this.autosave.start();
  }
}
