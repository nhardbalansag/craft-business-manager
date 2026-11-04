import type { WorkspaceRecoveryCopy } from '../BrowserWorkspaceStore';
import { validatePhysicalBusinessDatasetV5Integrity } from '../../domain/physicalBusinessDatasetV5';
import { decodeSqlite, encodeSqlite, historyFromDocument, newSqliteDocument, setDocumentHistory, type SqliteDocument } from './sqliteFormat';
import { sqliteRuntime } from './sqliteRuntime';
import { validateBusinessWorkspace } from '../../domain/businessInsights';

export type SqliteAction = 'load' | 'save' | 'history.load' | 'history.save' | 'business.load' | 'business.save' | 'backup.export' | 'backup.inspect' | 'backup.restore' | 'backup.recover';
export interface SqliteRequest { action: SqliteAction; payload?: any }
const DATABASE = 'my-lovely-craft.sqlite';
const STORE = 'database';
function token() { return globalThis.crypto.randomUUID(); }
function conflict(message: string): never { const error = new Error(message); error.name = 'WorkspaceConflictError'; throw error; }
function openDatabase(factory: IDBFactory, name: string, store: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name, 1); let blocked = false;
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store); };
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); if (blocked) request.result.close(); else resolve(request.result); };
    request.onerror = () => reject(request.error ?? new Error('SQLite file storage could not be opened.'));
    request.onblocked = () => { blocked = true; reject(new Error('Close other tabs and retry opening SQLite storage.')); };
  });
}
async function legacyValue(factory: IDBFactory, name: string, store: string): Promise<any> {
  const db = await openDatabase(factory, name, store);
  try { return await new Promise((resolve, reject) => {
    const transaction = db.transaction(store, 'readonly'), request = transaction.objectStore(store).get('current');
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = transaction.onerror = () => reject(transaction.error ?? new Error('The previous saved data could not be read.'));
  }); } finally { db.close(); }
}

/** SQLite runs in a worker. IndexedDB stores only its binary file and atomic generation token. */
export class SqliteDatabaseHost {
  private generation: string | null = null;
  private document?: SqliteDocument;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly factory: () => IDBFactory = () => globalThis.indexedDB) {}
  request(request: SqliteRequest): Promise<any> {
    const result = this.queue.catch(() => {}).then(() => this.execute(request)); this.queue = result; return result;
  }
  private async readFile(): Promise<{ generation: string | null; bytes?: Uint8Array; historyRevision?: number; businessRevision?: number }> {
    const db = await openDatabase(this.factory(), DATABASE, STORE);
    try { return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readonly'), store = transaction.objectStore(STORE), generation = store.get('generation'), historyRevision = store.get('history_revision'), businessRevision = store.get('business_revision');
      let bytes: IDBRequest | undefined;
      generation.onsuccess = () => { if (!this.document || generation.result !== this.generation) bytes = store.get('main.sqlite'); };
      transaction.oncomplete = () => resolve({ generation: generation.result ?? null, bytes: bytes?.result, historyRevision: historyRevision.result, businessRevision: businessRevision.result });
      transaction.onabort = transaction.onerror = () => reject(transaction.error ?? new Error('The saved SQLite database could not be read.'));
    }); } finally { db.close(); }
  }
  private async commit(document: SqliteDocument, retainPrevious = false): Promise<void> {
    const bytes = await encodeSqlite(await sqliteRuntime(), document), next = token();
    const db = await openDatabase(this.factory(), DATABASE, STORE);
    try { await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite'), store = transaction.objectStore(STORE), current = store.get('generation');
      let failure: Error | undefined;
      current.onsuccess = () => {
        if ((current.result ?? null) !== this.generation) {
          failure = new Error('Another tab saved a newer SQLite database. Download your work before reloading.'); failure.name = 'WorkspaceConflictError'; transaction.abort(); return;
        }
        const write = () => { store.put(bytes, 'main.sqlite'); store.put(next, 'generation'); store.put(document.historyRevision, 'history_revision'); store.put(document.businessRevision, 'business_revision'); };
        if (retainPrevious) {
          const previous = store.get('main.sqlite');
          previous.onsuccess = () => { if (previous.result) store.put(previous.result, 'previous.sqlite'); write(); };
        } else write();
      };
      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () => reject(failure ?? transaction.error ?? new Error('SQLite could not be saved. The previous database is retained.'));
    }); } finally { db.close(); }
    this.generation = next; this.document = document;
  }
  private async current(): Promise<SqliteDocument> {
    const saved = await this.readFile();
    if (saved.generation && (saved.generation !== this.generation || !this.document)) {
      if (!(saved.bytes instanceof Uint8Array)) throw new Error('The saved SQLite database is incomplete. It has been preserved.');
      this.document = await decodeSqlite(await sqliteRuntime(), saved.bytes); this.generation = saved.generation;
    } else if (!saved.generation) {
      this.generation = null; this.document = undefined;
      const document = newSqliteDocument();
      const [workspace, history] = await Promise.all([
        legacyValue(this.factory(), 'craft-business-manager.workspace', 'recovery'),
        legacyValue(this.factory(), 'my-lovely-craft-transaction-history', 'history'),
      ]);
      if (workspace !== undefined) {
        if (workspace?.formatVersion !== 1 || typeof workspace.revision !== 'string' || !workspace.revision ||
          !Number.isFinite(Date.parse(workspace.savedAt)) || !validatePhysicalBusinessDatasetV5Integrity(workspace.dataset).valid) {
          throw new Error('The existing workspace is invalid. Migration stopped and the previous data is retained.');
        }
        document.dataset = workspace.dataset; document.workspaceRevision = workspace.revision; document.savedAt = workspace.savedAt;
      }
      if (history !== undefined) {
        if (!Number.isSafeInteger(history.revision) || history.revision < 1) throw new Error('Existing transaction history is invalid. The previous data is retained.');
        await setDocumentHistory(document, history.archive); document.historyRevision = history.revision;
      }
      // Never remove the original recovery copies; failed migration is fully retryable.
      await this.commit(document);
    }
    return this.document!;
  }
  private async execute({ action, payload }: SqliteRequest): Promise<any> {
    if (action === 'backup.inspect') {
      const decoded = await decodeSqlite(await sqliteRuntime(), payload.bytes, true);
      const saved = await this.readFile();
      return { databaseGeneration: saved.generation, hasCatalog: decoded.dataset !== null,
        dataset: payload.includeDataset ? decoded.dataset : null, products: decoded.dataset?.products.length ?? 0,
        materials: decoded.dataset?.materials.length ?? 0, receipts: decoded.state.customerReceipts?.length ?? 0,
        quotations: decoded.state.quotations?.length ?? 0, images: decoded.images.size, savedAt: decoded.savedAt,
        ledgerEntries: decoded.business.ledger.length, businessDocuments: decoded.business.documents.length };
    }
    if (action === 'backup.recover') {
      const incoming = await decodeSqlite(await sqliteRuntime(), payload.bytes, true);
      if (!incoming.dataset) throw new Error('This backup has no business catalog to restore.');
      this.document = undefined;
      const saved = await this.readFile();
      if (payload.expectedGeneration !== saved.generation) conflict('The local database changed after review. Select the backup again before restoring.');
      this.generation = saved.generation;
      incoming.workspaceRevision = token(); incoming.savedAt = new Date().toISOString();
      incoming.historyRevision = Math.max(saved.historyRevision ?? 0, incoming.historyRevision) + 1;
      incoming.businessRevision = Math.max(saved.businessRevision ?? 0, incoming.businessRevision) + 1;
      await this.commit(incoming, true); return;
    }
    const current = await this.current();
    if (action === 'load') return current.dataset ? { formatVersion: 1, revision: current.workspaceRevision!, savedAt: current.savedAt, dataset: current.dataset } satisfies WorkspaceRecoveryCopy : undefined;
    if (action === 'history.load') return { revision: current.historyRevision, archive: await historyFromDocument(current) };
    if (action === 'business.load') return { revision: current.businessRevision, workspace: structuredClone(current.business) };
    if (action === 'backup.export') {
      const backup = structuredClone(current);
      if (payload?.dataset) { backup.dataset = payload.dataset; backup.workspaceRevision = token(); backup.savedAt = new Date().toISOString(); }
      return encodeSqlite(await sqliteRuntime(), backup, true);
    }
    const next = structuredClone(current);
    if (action === 'business.save') {
      if (payload.expectedHistoryRevision !== undefined && payload.expectedHistoryRevision !== current.historyRevision) conflict('Sales history changed while the investor proposal was being prepared. Refresh sales and review the proposal before saving.');
      if (payload.expectedRevision !== current.businessRevision) conflict('Business records changed in another tab or restore. Reload business insights before saving.');
      if (!Number.isSafeInteger(payload.expectedRevision) || payload.expectedRevision < 0 || payload.expectedRevision >= Number.MAX_SAFE_INTEGER) throw new Error('Invalid business workspace revision.');
      next.business = structuredClone(validateBusinessWorkspace(payload.workspace)); next.businessRevision++; next.savedAt = new Date().toISOString();
      await this.commit(next); return { revision: next.businessRevision, workspace: structuredClone(next.business) };
    }
    if (action === 'history.save') {
      if (payload.expectedRevision !== current.historyRevision) conflict('Transaction history changed in another tab. Reload history before saving.');
      if (!Number.isSafeInteger(payload.expectedRevision) || payload.expectedRevision < 0 || payload.expectedRevision >= Number.MAX_SAFE_INTEGER) throw new Error('Invalid transaction history revision.');
      await setDocumentHistory(next, payload.archive); next.historyRevision++; next.savedAt = new Date().toISOString();
      await this.commit(next); return { revision: next.historyRevision, archive: await historyFromDocument(next) };
    }
    if (payload.expectedRevision !== current.workspaceRevision) conflict('Another tab saved a newer workspace. Download a backup before reloading.');
    const copy = payload.copy as WorkspaceRecoveryCopy;
    if (copy?.formatVersion !== 1 || typeof copy.revision !== 'string' || !copy.revision || !Number.isFinite(Date.parse(copy.savedAt)) || !validatePhysicalBusinessDatasetV5Integrity(copy.dataset).valid) throw new Error('Invalid SQLite workspace. The saved database has not changed.');
    if (action === 'backup.restore') {
      if (payload.expectedGeneration !== this.generation) conflict('The local database changed after review. Select the backup again before restoring.');
      if (payload.expectedHistoryRevision !== current.historyRevision) conflict('Transaction history changed while the backup was being reviewed. Reload and try again.');
      const incoming = await decodeSqlite(await sqliteRuntime(), payload.bytes, true);
      incoming.workspaceRevision = copy.revision; incoming.savedAt = copy.savedAt; incoming.dataset = copy.dataset;
      incoming.historyRevision = current.historyRevision + 1;
      incoming.businessRevision = current.businessRevision + 1;
      await this.commit(incoming, true); return;
    }
    if (action !== 'save') throw new Error('Unknown SQLite operation.');
    next.dataset = copy.dataset; next.workspaceRevision = copy.revision; next.savedAt = copy.savedAt;
    await this.commit(next);
  }
}
