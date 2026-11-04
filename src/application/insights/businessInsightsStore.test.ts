import { beforeEach, expect, it, vi } from 'vitest';
import { emptyBusinessWorkspace } from '../../domain/businessInsights';
import { sqliteRequest } from '../../storage/sqlite/sqliteClient';
import { loadBusinessHistory, saveBusinessWorkspace } from './businessInsightsStore';

vi.mock('../../storage/sqlite/sqliteClient', () => ({ sqliteRequest: vi.fn() }));
vi.mock('../session', () => ({ workspaceChanges: { batch: (operation: () => Promise<unknown>) => operation() } }));
beforeEach(() => { vi.mocked(sqliteRequest).mockReset(); });
it('sends only changed sections and preserves immutable form and evidence references after worker acknowledgement', async () => {
  const previous = emptyBusinessWorkspace(), next = { ...previous, proposal: { ...previous.proposal, recipient: 'Customer' } };
  vi.mocked(sqliteRequest).mockResolvedValue({ revision: 5 });
  const saved = await saveBusinessWorkspace(next, 4, undefined, previous);
  expect(sqliteRequest).toHaveBeenCalledWith({ action: 'business.save', payload: { changes: { proposal: next.proposal }, expectedRevision: 4, expectedHistoryRevision: undefined, revisionOnly: true } });
  expect(saved.workspace).toBe(next); expect(saved.workspace.ledger).toBe(previous.ledger); expect(saved.workspace.documents).toBe(previous.documents);
  expect(saved.revision).toBe(5); expect(previous.proposal.recipient).toBe('');
});
it('retains complete validation for initial saves and forwards historical revision guards', async () => {
  const workspace = emptyBusinessWorkspace(); vi.mocked(sqliteRequest).mockResolvedValue({ revision: 2 });
  await saveBusinessWorkspace(workspace, 1, 7);
  expect(sqliteRequest).toHaveBeenCalledWith({ action: 'business.save', payload: { workspace, expectedRevision: 1, expectedHistoryRevision: 7, revisionOnly: true } });
});
it('loads compact sales evidence instead of a photo-heavy portable transaction archive', async () => {
  const evidence = { revision: 1, archive: { customerReceipts: [], transactionEntries: [] } }; vi.mocked(sqliteRequest).mockResolvedValue(evidence);
  expect(await loadBusinessHistory()).toBe(evidence); expect(sqliteRequest).toHaveBeenCalledWith({ action: 'business.history' });
});
