import { sqliteRequest } from '../../storage/sqlite/sqliteClient';
import { workspaceChanges } from '../../application/session';
import type { PortableTransactionArchive } from './portableTransactions';

export type TransactionHistorySnapshot = { revision: number; archive: PortableTransactionArchive };

/** Catalog and transaction history share one durable SQLite database and backup. */
export async function loadTransactionHistory(): Promise<TransactionHistorySnapshot> {
  return sqliteRequest({ action: 'history.load' });
}
export async function saveTransactionHistory(archive: PortableTransactionArchive, expectedRevision: number): Promise<TransactionHistorySnapshot> {
  return workspaceChanges.batch(() => sqliteRequest({ action: 'history.save', payload: { archive, expectedRevision } }));
}
