import {
  validatePhysicalBusinessDatasetV5Integrity,
  type PhysicalBusinessDatasetV5,
} from '../../domain/physicalBusinessDatasetV5';
import { WorkspaceConflictError, type WorkspaceRecoveryCopy, type WorkspaceRecoveryStore } from '../../storage/BrowserWorkspaceStore';
import { WorkspaceChangeTracker } from './WorkspaceChangeTracker';

export interface WorkspaceAutosaveStatus {
  readonly state: 'loading' | 'ready' | 'saving' | 'saved' | 'error';
  readonly restored: boolean;
  readonly savedAt?: string;
  readonly message?: string;
}

interface WorkspaceSource {
  snapshot(): Promise<PhysicalBusinessDatasetV5>;
}

interface WorkspaceHydrator {
  hydrate(candidate: unknown): Promise<{ readonly status: 'hydrated' | 'rejected' }>;
}

function recoveryCopy(input: unknown): WorkspaceRecoveryCopy {
  const value = input as Partial<WorkspaceRecoveryCopy> | null;
  if (!value || value.formatVersion !== 1 || typeof value.revision !== 'string' || !value.revision ||
      typeof value.savedAt !== 'string' || Number.isNaN(Date.parse(value.savedAt)) ||
      !validatePhysicalBusinessDatasetV5Integrity(value.dataset).valid) {
    throw new Error('The local recovery copy is invalid or belongs to an unsupported app version. It has been preserved.');
  }
  return value as WorkspaceRecoveryCopy;
}

/** Saves validated full snapshots, never a partially replaced collection graph. */
export class WorkspaceAutosave {
  private status: WorkspaceAutosaveStatus = { state: 'loading', restored: false };
  private readonly listeners = new Set<() => void>();
  private initialization?: Promise<void>;
  private initialized = false;
  private savedRevision = 0;
  private storedRevision: string | null = null;
  private timer?: ReturnType<typeof setTimeout>;
  private saving?: Promise<void>;
  private unsubscribeChanges?: () => void;

  constructor(
    private readonly source: WorkspaceSource,
    private readonly hydrator: WorkspaceHydrator,
    private readonly store: WorkspaceRecoveryStore,
    private readonly changes: WorkspaceChangeTracker,
  ) {}

  getStatus = (): WorkspaceAutosaveStatus => this.status;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  hasUnsavedChanges = (): boolean => !this.initialized ||
    this.changes.activeOperations > 0 || this.changes.revision !== this.savedRevision;

  private update(status: WorkspaceAutosaveStatus) {
    this.status = status;
    this.listeners.forEach((listener) => listener());
  }

  start(): Promise<void> {
    if (this.initialization) return this.initialization;
    this.update({ state: 'loading', restored: false });
    this.initialization = this.restore().catch((error: unknown) => {
      this.initialization = undefined;
      this.update({ state: 'error', restored: false, message: error instanceof Error ? error.message : 'Local recovery failed.' });
      throw error;
    });
    return this.initialization;
  }

  private async restore(): Promise<void> {
    const stored = await this.store.load();
    let copy: WorkspaceRecoveryCopy | undefined;
    if (stored !== undefined) {
      copy = recoveryCopy(stored);
      const result = await this.hydrator.hydrate(copy.dataset);
      if (result.status !== 'hydrated') throw new Error('The local recovery copy could not be restored. It has been preserved.');
    }
    this.storedRevision = copy?.revision ?? null;
    this.savedRevision = this.changes.revision;
    this.initialized = true;
    this.unsubscribeChanges = this.changes.subscribe(() => this.changed());
    this.update({ state: copy ? 'saved' : 'ready', restored: !!copy, savedAt: copy?.savedAt });
  }

  dispose(): void {
    this.unsubscribeChanges?.();
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.initialized = false;
  }

  private changed() {
    if (!this.hasUnsavedChanges()) {
      if (this.status.state === 'saving' && !this.saving) {
        this.update({ ...this.status, state: this.status.savedAt ? 'saved' : 'ready' });
      }
      return;
    }
    this.update({ ...this.status, state: 'saving', message: undefined });
    if (this.timer !== undefined) clearTimeout(this.timer);
    // Let an entire synchronous/microtask-backed service operation finish first.
    this.timer = setTimeout(() => { this.timer = undefined; void this.flush(); }, 0);
  }

  flush(): Promise<void> {
    if (!this.initialized || this.changes.activeOperations > 0) return Promise.resolve();
    if (this.saving) return this.saving;
    this.saving = this.savePending().catch((error: unknown) => {
      this.update({ ...this.status, state: 'error', message: error instanceof WorkspaceConflictError
        ? error.message
        : `Local saving failed. Keep this tab open and retry before making a SQLite backup. ${error instanceof Error ? error.message : 'Check available browser storage.'}` });
    }).finally(() => { this.saving = undefined; });
    return this.saving;
  }

  /** Explicitly commit a fresh durable catalog, even before the first record is created. */
  async checkpoint(): Promise<void> {
    if (!this.initialized || this.changes.activeOperations > 0) throw new Error('Wait for the current save to finish before making a backup.');
    await this.changes.batch(async () => {}, true);
    await this.flush();
    if (this.hasUnsavedChanges() || this.status.state === 'error') throw new Error(this.status.message ?? 'SQLite has not finished saving. Retry the local save first.');
  }

  /** Backups can rescue the latest valid working data even when local storage is full. */
  async snapshotForBackup(): Promise<PhysicalBusinessDatasetV5> {
    if (!this.initialized || this.changes.activeOperations > 0) throw new Error('Wait for the current operation to finish before making a backup.');
    const revision = this.changes.revision, dataset = await this.source.snapshot();
    if (revision !== this.changes.revision || this.changes.activeOperations > 0) throw new Error('The workspace changed while preparing the backup. Try again.');
    if (!validatePhysicalBusinessDatasetV5Integrity(dataset).valid) throw new Error('The current workspace is invalid. The existing database is retained.');
    return dataset;
  }

  /** Restore the live projections and durable database together, rolling back on commit failure. */
  async replaceDataset(
    dataset: PhysicalBusinessDatasetV5,
    commit: (copy: WorkspaceRecoveryCopy, expectedRevision: string | null) => Promise<void>,
  ): Promise<void> {
    if (!validatePhysicalBusinessDatasetV5Integrity(dataset).valid) throw new Error('The backup catalog is invalid. Nothing was replaced.');
    await this.flush();
    if (this.hasUnsavedChanges() || this.status.state === 'error') throw new Error('Save the current workspace successfully before restoring a backup.');
    const revision = this.changes.revision, before = await this.source.snapshot();
    if (revision !== this.changes.revision || this.changes.activeOperations > 0) throw new Error('The workspace changed while preparing restore. Try again.');
    await this.changes.batch(async () => {
      const applied = await this.hydrator.hydrate(dataset);
      if (applied.status !== 'hydrated') throw new Error('The backup could not be restored. The existing workspace is retained.');
      const copy: WorkspaceRecoveryCopy = { formatVersion: 1, revision: globalThis.crypto.randomUUID(), savedAt: new Date().toISOString(), dataset };
      try { await commit(copy, this.storedRevision); }
      catch (error) {
        const rolledBack = await this.hydrator.hydrate(before);
        if (rolledBack.status !== 'hydrated') throw new Error('Restore failed and the editor needs recovery. Reload to recover the unchanged SQLite database.');
        this.savedRevision = this.changes.revision;
        this.update({ ...this.status, state: 'error', message: error instanceof Error ? error.message : 'SQLite restore failed. The previous database is retained.' });
        throw error;
      }
      this.storedRevision = copy.revision; this.savedRevision = this.changes.revision;
      this.update({ state: 'saved', restored: true, savedAt: copy.savedAt });
    });
  }

  private async savePending(): Promise<void> {
    while (this.changes.revision !== this.savedRevision && this.changes.activeOperations === 0) {
      this.update({ ...this.status, state: 'saving', message: undefined });
      const revision = this.changes.revision;
      const dataset = await this.source.snapshot();
      if (revision !== this.changes.revision || this.changes.activeOperations > 0) continue;
      if (!validatePhysicalBusinessDatasetV5Integrity(dataset).valid) {
        throw new Error('The current workspace could not be validated for recovery.');
      }
      const copy: WorkspaceRecoveryCopy = {
        formatVersion: 1,
        // Equality token, not a credential. LAN HTTP previews may not expose randomUUID.
        revision: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        savedAt: new Date().toISOString(),
        dataset,
      };
      await this.store.save(copy, this.storedRevision);
      this.storedRevision = copy.revision;
      this.savedRevision = revision;
      if (!this.hasUnsavedChanges()) {
        this.update({ ...this.status, state: 'saved', savedAt: copy.savedAt, message: undefined });
      }
    }
  }
}
