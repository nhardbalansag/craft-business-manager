import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { BrowserWorkspaceStore } from '../BrowserWorkspaceStore';
import { SqliteDatabaseHost } from './SqliteDatabaseHost';
import { createEmptyBusinessDatasetV2 } from '../../domain/businessDatasetV2';
import { extendBusinessDatasetV2 } from '../../domain/physicalBusinessDatasetV3';
import { extendPhysicalBusinessDatasetV3 } from '../../domain/physicalBusinessDatasetV4';
import { extendPhysicalBusinessDatasetV4 } from '../../domain/physicalBusinessDatasetV5';
import history from '../../ui/transactions/__fixtures__/mobile-transactions.json';
import { emptyBusinessWorkspace } from '../../domain/businessInsights';

let factory: IDBFactory;
beforeEach(() => { factory = new IDBFactory(); });
function copy(revision: string, name = 'SQLite product') {
  const dataset = extendPhysicalBusinessDatasetV4(extendPhysicalBusinessDatasetV3(extendBusinessDatasetV2(createEmptyBusinessDatasetV2())));
  dataset.products.push({ id: 'P', name, category: 'candle', isActive: true, safetyWasteRate: 0 });
  return { formatVersion: 1 as const, revision, savedAt: new Date().toISOString(), dataset };
}
describe('Durable SQLite primary storage', () => {
  it('rejects saving an investor document prepared against stale sales history', async () => {
    const host = new SqliteDatabaseHost(() => factory);
    const before = await host.request({ action: 'business.load' });
    await host.request({ action: 'history.save', payload: { archive: history, expectedRevision: 0 } });
    await expect(host.request({ action: 'business.save', payload: { workspace: before.workspace, expectedRevision: before.revision, expectedHistoryRevision: 0 } })).rejects.toThrow('Sales history changed');
    expect((await host.request({ action: 'business.load' })).revision).toBe(before.revision);
    expect((await host.request({ action: 'business.load' })).workspace.ledger).toEqual([]);
    expect((await host.request({ action: 'history.load' })).archive).toEqual(history);
  });
  it('keeps business records across catalog/history writes, rejects stale edits, and restores them from a portable backup', async () => {
    const host = new SqliteDatabaseHost(() => factory), other = new SqliteDatabaseHost(() => factory);
    const workspace = emptyBusinessWorkspace('2026-11-01'); workspace.profile.description = 'Investor snapshot test';
    workspace.ledger.push({ id: 'rent', date: '2026-11-01', cashDate: '2026-11-02', kind: 'operating-expense', category: 'Rent', description: 'Studio rent', amount: 200, paid: true, reference: 'R-1' });
    await host.request({ action: 'business.load' });
    await host.request({ action: 'business.save', payload: { workspace, expectedRevision: 0 } });
    await other.request({ action: 'save', payload: { copy: copy('catalog'), expectedRevision: null } });
    await other.request({ action: 'history.save', payload: { archive: history, expectedRevision: 0 } });
    expect((await host.request({ action: 'business.load' })).workspace).toEqual(workspace);
    await expect(other.request({ action: 'business.save', payload: { workspace, expectedRevision: 0 } })).rejects.toThrow('changed in another tab');
    const bytes = await host.request({ action: 'backup.export' });
    await host.request({ action: 'business.save', payload: { workspace: emptyBusinessWorkspace(), expectedRevision: 1 } });
    const review = await host.request({ action: 'backup.inspect', payload: { bytes } });
    expect(review.ledgerEntries).toBe(1);
    await host.request({ action: 'backup.restore', payload: { bytes, copy: copy('restored'), expectedRevision: 'catalog', expectedHistoryRevision: 1, expectedGeneration: review.databaseGeneration } });
    const restored = await new SqliteDatabaseHost(() => factory).request({ action: 'business.load' });
    expect(restored.workspace).toEqual(workspace); expect(restored.revision).toBe(3);
    await expect(other.request({ action: 'business.save', payload: { workspace, expectedRevision: 1 } })).rejects.toThrow('changed in another tab');
  });
  it('migrates the old workspace once and retains its original recovery copy', async () => {
    const legacy = new BrowserWorkspaceStore(() => factory); await legacy.save(copy('legacy'), null);
    const first = new SqliteDatabaseHost(() => factory);
    expect(await first.request({ action: 'load' })).toEqual(await legacy.load());
    const next = copy('next', 'Edited in SQLite'); await first.request({ action: 'save', payload: { copy: next, expectedRevision: 'legacy' } });
    const fresh = new SqliteDatabaseHost(() => factory);
    expect(await fresh.request({ action: 'load' })).toEqual(next);
    expect((await legacy.load() as any).revision).toBe('legacy');
  });

  it('rejects stale tab writes and atomically keeps catalog and history in one database', async () => {
    const first = new SqliteDatabaseHost(() => factory), second = new SqliteDatabaseHost(() => factory);
    expect(await first.request({ action: 'load' })).toBeUndefined();
    await second.request({ action: 'load' });
    await first.request({ action: 'save', payload: { copy: copy('one'), expectedRevision: null } });
    await second.request({ action: 'history.save', payload: { archive: history, expectedRevision: 0 } });
    await expect(second.request({ action: 'save', payload: { copy: copy('stale'), expectedRevision: null } })).rejects.toThrow('Another tab');
    expect((await first.request({ action: 'load' })).revision).toBe('one');
    expect((await first.request({ action: 'history.load' })).archive).toEqual(history);
    const backup = await first.request({ action: 'backup.export' });
    const inspection = await second.request({ action: 'backup.inspect', payload: { bytes: backup } });
    expect(inspection.products).toBe(1); expect(inspection.receipts).toBe(history.customerReceipts.length);
  });

  it('stops on an invalid legacy copy without creating a replacement SQLite file', async () => {
    const legacy = new BrowserWorkspaceStore(() => factory); await legacy.save({ ...copy('bad'), dataset: { schemaVersion: 99 } as any }, null);
    const host = new SqliteDatabaseHost(() => factory);
    await expect(host.request({ action: 'load' })).rejects.toThrow('Migration stopped');
    expect((await legacy.load() as any).revision).toBe('bad');
  });

  it('rejects a restore if history changes after review and does not return photo-heavy catalog data just to review counts', async () => {
    const host = new SqliteDatabaseHost(() => factory);
    await host.request({ action: 'load' });
    await host.request({ action: 'save', payload: { copy: copy('one'), expectedRevision: null } });
    const bytes = await host.request({ action: 'backup.export' });
    const review = await host.request({ action: 'backup.inspect', payload: { bytes } });
    expect(review.hasCatalog).toBe(true); expect(review.dataset).toBeNull();
    await host.request({ action: 'history.save', payload: { archive: history, expectedRevision: 0 } });
    await expect(host.request({ action: 'backup.restore', payload: { bytes, copy: copy('restore'), expectedRevision: 'one',
      expectedHistoryRevision: 1, expectedGeneration: review.databaseGeneration } })).rejects.toThrow('changed after review');
    expect((await host.request({ action: 'load' })).revision).toBe('one');
    expect((await host.request({ action: 'history.load' })).revision).toBe(1);
  });
});
