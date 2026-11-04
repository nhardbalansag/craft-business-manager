import type { BusinessSnapshot, BusinessWorkspace, BusinessReport } from '../../domain/businessInsights';
import type { TransactionHistorySnapshot } from '../../ui/transactions/transactionHistoryStore';
import { sqliteRequest } from '../../storage/sqlite/sqliteClient';
import { workspaceChanges } from '../session';
import { calculateBusinessReport } from './businessReports';

export const loadBusinessWorkspace = (): Promise<BusinessSnapshot> => sqliteRequest({ action: 'business.load' });
export type BusinessHistorySnapshot = { revision: number; archive: Pick<TransactionHistorySnapshot['archive'], 'customerReceipts' | 'transactionEntries'> };
/** Reports need sales and movements, never the history archive's photos or quotations. */
export const loadBusinessHistory = (): Promise<BusinessHistorySnapshot> => sqliteRequest({ action: 'business.history' });
export const saveBusinessWorkspace = (workspace: BusinessWorkspace, expectedRevision: number, expectedHistoryRevision?: number, previous?: BusinessWorkspace): Promise<BusinessSnapshot> =>
  workspaceChanges.batch(async () => {
    // Autosaving a small draft must not copy megabytes of unchanged document pictures into the worker.
    const changes = previous && workspace.version === previous.version ? Object.fromEntries((['profile', 'ledger', 'scenarios', 'proposal', 'investorProposal', 'documents'] as const)
      .filter(key => workspace[key] !== previous[key]).map(key => [key, workspace[key]])) : undefined;
    const { revision } = await sqliteRequest<{ revision: number }>({ action: 'business.save', payload: {
      ...(changes ? { changes } : { workspace }), expectedRevision, expectedHistoryRevision, revisionOnly: true,
    } });
    // Validation does not normalize inputs. Retain immutable UI references instead of returning copies of every document/ledger row.
    return { revision, workspace };
  });

/** The browser calculation stays off the UI thread; callers cancel superseded date ranges. */
export async function loadBusinessReport(history: BusinessHistorySnapshot, workspace: BusinessWorkspace, from: string, to: string, signal: AbortSignal): Promise<BusinessReport> {
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
