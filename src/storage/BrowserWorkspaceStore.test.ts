import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { createEmptyBusinessDatasetV2 } from '../domain/businessDatasetV2';
import { extendBusinessDatasetV2 } from '../domain/physicalBusinessDatasetV3';
import { extendPhysicalBusinessDatasetV3 } from '../domain/physicalBusinessDatasetV4';
import { extendPhysicalBusinessDatasetV4 } from '../domain/physicalBusinessDatasetV5';
import { BrowserWorkspaceStore, WorkspaceConflictError, type WorkspaceRecoveryCopy } from './BrowserWorkspaceStore';

function copy(revision = 'first'): WorkspaceRecoveryCopy {
  return { formatVersion: 1, revision, savedAt: '2026-10-30T00:00:00.000Z',
    dataset: extendPhysicalBusinessDatasetV4(extendPhysicalBusinessDatasetV3(
      extendBusinessDatasetV2(createEmptyBusinessDatasetV2()),
    )) };
}

describe('BrowserWorkspaceStore IndexedDB transactions', () => {
  it('starts empty and retains a large snapshot across store instances', async () => {
    const factory = new IDBFactory();
    const first = new BrowserWorkspaceStore(() => factory);
    expect(await first.load()).toBeUndefined();
    const snapshot = copy();
    for (let index = 0; index < 20; index += 1) {
      snapshot.dataset.products.push({ id: `PHOTO-${index}`, name: `Photo product ${index}`, category: 'paintable-art',
        safetyWasteRate: 0, isActive: true, brochureImageDataUrl: `data:image/jpeg;base64,${'A'.repeat(400_000)}` });
    }
    await first.save(snapshot, null);
    expect(await new BrowserWorkspaceStore(() => factory).load()).toEqual(snapshot);
  });

  it('compares revisions atomically across competing writers', async () => {
    const factory = new IDBFactory();
    const first = new BrowserWorkspaceStore(() => factory);
    const second = new BrowserWorkspaceStore(() => factory);
    const results = await Promise.allSettled([first.save(copy('one'), null), second.save(copy('two'), null)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(WorkspaceConflictError);
    const current = await first.load() as WorkspaceRecoveryCopy;
    await expect(second.save(copy('stale'), null)).rejects.toBeInstanceOf(WorkspaceConflictError);
    await second.save(copy('next'), current.revision);
    expect((await first.load() as WorkspaceRecoveryCopy).revision).toBe('next');
  });

  it('preserves the previous copy if structured cloning fails', async () => {
    const factory = new IDBFactory();
    const store = new BrowserWorkspaceStore(() => factory);
    await store.save(copy(), null);
    const invalid = { ...copy('invalid'), unsupported: () => {} };
    await expect(store.save(invalid, 'first')).rejects.toBeDefined();
    expect(await store.load()).toEqual(copy());
  });

  it('reports unavailable browser storage', async () => {
    const store = new BrowserWorkspaceStore(() => { throw new Error('storage blocked'); });
    await expect(store.load()).rejects.toThrow('blocked');
  });
});
