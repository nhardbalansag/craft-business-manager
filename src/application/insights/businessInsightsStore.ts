import type { BusinessSnapshot, BusinessWorkspace, BusinessReport } from '../../domain/businessInsights';
import type { TransactionHistorySnapshot } from '../../ui/transactions/transactionHistoryStore';
import { sqliteRequest } from '../../storage/sqlite/sqliteClient';
import { workspaceChanges } from '../session';
import { calculateBusinessReport } from './businessReports';

export const loadBusinessWorkspace = (): Promise<BusinessSnapshot> => sqliteRequest({ action: 'business.load' });
export const saveBusinessWorkspace = (workspace: BusinessWorkspace, expectedRevision: number, expectedHistoryRevision?: number): Promise<BusinessSnapshot> =>
  workspaceChanges.batch(() => sqliteRequest({ action: 'business.save', payload: { workspace, expectedRevision, expectedHistoryRevision } }));

/** The browser calculation stays off the UI thread; callers cancel superseded date ranges. */
export async function loadBusinessReport(history: TransactionHistorySnapshot, workspace: BusinessWorkspace, from: string, to: string, signal: AbortSignal): Promise<BusinessReport> {
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  if (typeof Worker === 'undefined') return calculateBusinessReport(history.archive.customerReceipts, history.archive.transactionEntries ?? [], workspace, from, to);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./insights.worker.ts', import.meta.url), { type: 'module' });
    const cleanup = () => { worker.terminate(); signal.removeEventListener('abort', abort); };
    const abort = () => { cleanup(); reject(new DOMException('Cancelled', 'AbortError')); };
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = event => { cleanup(); event.data.error ? reject(new Error(event.data.error)) : resolve(event.data.result); };
    worker.onerror = () => { cleanup(); reject(new Error('The report worker could not start. Reload the workspace and try again.')); };
    try { worker.postMessage({ receipts: history.archive.customerReceipts, entries: history.archive.transactionEntries ?? [], workspace: { ledger: workspace.ledger, profile: workspace.profile }, from, to }); }
    catch (error) { cleanup(); reject(error); }
  });
}
