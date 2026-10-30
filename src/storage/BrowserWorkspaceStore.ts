import type { PhysicalBusinessDatasetV5 } from '../domain/physicalBusinessDatasetV5';

export interface WorkspaceRecoveryCopy {
  readonly formatVersion: 1;
  readonly revision: string;
  readonly savedAt: string;
  readonly dataset: PhysicalBusinessDatasetV5;
}

export interface WorkspaceRecoveryStore {
  load(): Promise<unknown | undefined>;
  save(copy: WorkspaceRecoveryCopy, expectedRevision: string | null): Promise<void>;
}

export class WorkspaceConflictError extends Error {
  constructor() {
    super('Another tab saved a newer workspace. Export your current workbook before reloading to recover that version.');
    this.name = 'WorkspaceConflictError';
  }
}

const DATABASE = 'craft-business-manager.workspace';
const STORE = 'recovery';
const KEY = 'current';

/** IndexedDB supports photo-heavy datasets without localStorage's small string quota. */
export class BrowserWorkspaceStore implements WorkspaceRecoveryStore {
  constructor(private readonly factory: () => IDBFactory = () => window.indexedDB) {}

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      let request: IDBOpenDBRequest;
      try {
        request = this.factory().open(DATABASE, 1);
      } catch (error) {
        reject(error);
        return;
      }
      let blocked = false;
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
      };
      request.onerror = () => reject(request.error ?? new Error('Local workspace storage could not be opened.'));
      request.onblocked = () => {
        blocked = true;
        reject(new Error('Close other tabs of this app and retry local recovery.'));
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => database.close();
        if (blocked) database.close();
        else resolve(database);
      };
    });
  }

  async load(): Promise<unknown | undefined> {
    const database = await this.open();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE, 'readonly');
        const request = transaction.objectStore(STORE).get(KEY);
        transaction.oncomplete = () => resolve(request.result);
        transaction.onabort = () => reject(transaction.error ?? new Error('Local workspace read failed.'));
        transaction.onerror = () => reject(transaction.error ?? new Error('Local workspace read failed.'));
      });
    } finally {
      database.close();
    }
  }

  async save(copy: WorkspaceRecoveryCopy, expectedRevision: string | null): Promise<void> {
    const database = await this.open();
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(STORE, 'readwrite');
        const store = transaction.objectStore(STORE);
        const current = store.get(KEY);
        let failure: unknown;
        current.onsuccess = () => {
          // Compare and replace inside the same transaction to prevent stale tabs
          // from silently overwriting a newer recovery copy.
          const actual = current.result === undefined ? null : current.result?.revision;
          if (actual !== expectedRevision) {
            failure = new WorkspaceConflictError();
            transaction.abort();
            return;
          }
          try {
            store.put(copy, KEY);
          } catch (error) {
            failure = error;
            transaction.abort();
          }
        };
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('Local workspace save failed.'));
        transaction.onerror = () => reject(failure ?? transaction.error ?? new Error('Local workspace save failed.'));
      });
    } finally {
      database.close();
    }
  }
}
