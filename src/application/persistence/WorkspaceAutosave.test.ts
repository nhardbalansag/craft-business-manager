import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyBusinessDatasetV2 } from '../../domain/businessDatasetV2';
import { extendBusinessDatasetV2 } from '../../domain/physicalBusinessDatasetV3';
import { extendPhysicalBusinessDatasetV3 } from '../../domain/physicalBusinessDatasetV4';
import { extendPhysicalBusinessDatasetV4, type PhysicalBusinessDatasetV5 } from '../../domain/physicalBusinessDatasetV5';
import { type WorkspaceRecoveryCopy, type WorkspaceRecoveryStore, WorkspaceConflictError } from '../../storage/BrowserWorkspaceStore';
import { WorkspaceAutosave } from './WorkspaceAutosave';
import { WorkspaceChangeTracker } from './WorkspaceChangeTracker';

export function emptyWorkspace(): PhysicalBusinessDatasetV5 {
  return extendPhysicalBusinessDatasetV4(extendPhysicalBusinessDatasetV3(
    extendBusinessDatasetV2(createEmptyBusinessDatasetV2()),
  ));
}

class MemoryStore implements WorkspaceRecoveryStore {
  value: unknown;
  fail = false;
  writes = 0;
  async load() { return structuredClone(this.value); }
  async save(copy: WorkspaceRecoveryCopy, expected: string | null) {
    if (this.fail) throw new Error('quota');
    if (((this.value as WorkspaceRecoveryCopy | undefined)?.revision ?? null) !== expected) throw new WorkspaceConflictError();
    this.value = structuredClone(copy);
    this.writes += 1;
  }
}

function fixture(store: WorkspaceRecoveryStore = new MemoryStore()) {
  let dataset = emptyWorkspace();
  const changes = new WorkspaceChangeTracker();
  const hydrate = vi.fn(async (candidate: unknown) => {
    dataset = structuredClone(candidate as PhysicalBusinessDatasetV5);
    return { status: 'hydrated' as const };
  });
  const source = { snapshot: vi.fn(async () => structuredClone(dataset)) };
  const autosave = new WorkspaceAutosave(source, { hydrate }, store, changes);
  const repository = changes.observeRepository({
    async replaceAll(next: PhysicalBusinessDatasetV5) { dataset = structuredClone(next); },
  });
  return { autosave, changes, source, hydrate, repository, dataset: () => dataset };
}

function materialWorkspace(name = 'Recovered plaster') {
  const dataset = emptyWorkspace();
  dataset.materials.push({ id: 'MAT-1', name, group: 'plaster', baseUnit: 'g',
    purchaseQuantity: 1000, purchaseUnit: 'g', packageCost: 45,
    onHandQuantity: 500, onHandUnit: 'g', isActive: true });
  return dataset;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('WorkspaceAutosave', () => {
  it('does not overwrite storage on an empty startup; saves edits and restores a fresh session', async () => {
    const store = new MemoryStore();
    const first = fixture(store);
    await first.autosave.start();
    expect(store.writes).toBe(0);
    await first.repository.replaceAll(materialWorkspace());
    expect(first.autosave.hasUnsavedChanges()).toBe(true);
    await first.autosave.flush();
    expect(first.autosave.getStatus()).toMatchObject({ state: 'saved' });
    expect(first.autosave.hasUnsavedChanges()).toBe(false);
    const second = fixture(store);
    await second.autosave.start();
    expect(second.dataset()).toEqual(first.dataset());
    expect(second.autosave.getStatus().restored).toBe(true);
    expect(store.writes).toBe(1);
  });

  it('saves mutations automatically without an explicit flush', async () => {
    const store = new MemoryStore();
    const { autosave, repository } = fixture(store);
    await autosave.start();
    await repository.replaceAll(materialWorkspace());
    await vi.runAllTimersAsync();
    expect(store.writes).toBe(1);
    expect(autosave.hasUnsavedChanges()).toBe(false);
  });

  it('keeps the previous copy when saving fails and can retry', async () => {
    const store = new MemoryStore();
    const { autosave, repository } = fixture(store);
    await autosave.start();
    await repository.replaceAll(materialWorkspace('First'));
    await autosave.flush();
    const previous = structuredClone(store.value);
    store.fail = true;
    await repository.replaceAll(materialWorkspace('Second'));
    await autosave.flush();
    expect(autosave.getStatus().state).toBe('error');
    expect(autosave.hasUnsavedChanges()).toBe(true);
    expect(store.value).toEqual(previous);
    store.fail = false;
    await autosave.flush();
    expect(autosave.getStatus().state).toBe('saved');
    expect((store.value as WorkspaceRecoveryCopy).dataset.materials[0].name).toBe('Second');
  });

  it.each([{ formatVersion: 9 }, { formatVersion: 1, revision: 'x', savedAt: new Date().toISOString(), dataset: {} }])(
    'preserves invalid or unsupported recovery copies', async (value) => {
      const store = new MemoryStore();
      store.value = value;
      const { autosave, hydrate, repository } = fixture(store);
      await expect(autosave.start()).rejects.toThrow('preserved');
      expect(hydrate).not.toHaveBeenCalled();
      await repository.replaceAll(materialWorkspace());
      await autosave.flush();
      expect(store.value).toEqual(value);
      expect(store.writes).toBe(0);
    },
  );

  it('waits for complete multi-collection operations, including rollback', async () => {
    const store = new MemoryStore();
    const { autosave, changes, repository } = fixture(store);
    await autosave.start();
    let release!: () => void;
    const operation = changes.batch(async () => {
      await repository.replaceAll(materialWorkspace('Intermediate'));
      await new Promise<void>((resolve) => { release = resolve; });
      await repository.replaceAll(materialWorkspace('Final'));
    });
    await Promise.resolve();
    await autosave.flush();
    expect(store.writes).toBe(0);
    expect(autosave.hasUnsavedChanges()).toBe(true);
    release();
    await operation;
    await autosave.flush();
    expect(store.writes).toBe(1);
    expect((store.value as WorkspaceRecoveryCopy).dataset.materials[0].name).toBe('Final');
  });

  it('does not replace a good copy with an invalid graph', async () => {
    const store = new MemoryStore();
    const { autosave, repository } = fixture(store);
    await autosave.start();
    await repository.replaceAll(materialWorkspace());
    await autosave.flush();
    const previous = structuredClone(store.value);
    const invalid = materialWorkspace();
    invalid.productStocks.push({ productId: 'MISSING', onHandQuantity: 1 });
    await repository.replaceAll(invalid);
    await autosave.flush();
    expect(autosave.getStatus().state).toBe('error');
    expect(store.value).toEqual(previous);
  });

  it('keeps edits made while an older save is committing', async () => {
    const store = new MemoryStore();
    const originalSave = store.save.bind(store);
    let release!: () => void;
    let started!: () => void;
    const startedSaving = new Promise<void>((resolve) => { started = resolve; });
    vi.spyOn(store, 'save').mockImplementationOnce(async (copy, revision) => {
      started();
      await new Promise<void>((resolve) => { release = resolve; });
      await originalSave(copy, revision);
    });
    const { autosave, repository } = fixture(store);
    await autosave.start();
    await repository.replaceAll(materialWorkspace('First'));
    const saving = autosave.flush();
    await startedSaving;
    await repository.replaceAll(materialWorkspace('Latest'));
    release();
    await saving;
    expect((store.value as WorkspaceRecoveryCopy).dataset.materials[0].name).toBe('Latest');
    expect(autosave.hasUnsavedChanges()).toBe(false);
  });

  it('rejects a stale tab instead of overwriting newer data', async () => {
    const store = new MemoryStore();
    const first = fixture(store);
    const second = fixture(store);
    await Promise.all([first.autosave.start(), second.autosave.start()]);
    await first.repository.replaceAll(materialWorkspace('Newer tab'));
    await first.autosave.flush();
    await second.repository.replaceAll(materialWorkspace('Stale tab'));
    await second.autosave.flush();
    expect(second.autosave.getStatus().message).toContain('Another tab');
    expect(second.autosave.hasUnsavedChanges()).toBe(true);
    expect((store.value as WorkspaceRecoveryCopy).dataset.materials[0].name).toBe('Newer tab');
  });

  it('initializes once under repeated startup calls and retries failed reads', async () => {
    const store = new MemoryStore();
    vi.spyOn(store, 'load').mockRejectedValueOnce(new Error('storage blocked'));
    const { autosave } = fixture(store);
    await expect(autosave.start()).rejects.toThrow('blocked');
    await Promise.all([autosave.start(), autosave.start()]);
    expect(store.load).toHaveBeenCalledTimes(2);
    expect(autosave.getStatus().state).toBe('ready');
  });
});
