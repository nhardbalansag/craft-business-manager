import type { SqliteDatabaseHost, SqliteRequest } from './SqliteDatabaseHost';
import { WorkspaceConflictError } from '../BrowserWorkspaceStore';

let worker: Worker | undefined, host: Promise<SqliteDatabaseHost> | undefined, nextId = 0;
const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
export async function sqliteRequest<T = any>(request: SqliteRequest): Promise<T> {
  // The same host is usable by Node tools and storage tests without a browser worker.
  if (typeof Worker === 'undefined') {
    host ??= import('./SqliteDatabaseHost').then((module) => new module.SqliteDatabaseHost());
    return structuredClone(await (await host).request(structuredClone(request)));
  }
  if (!worker) {
    worker = new Worker(new URL('./sqlite.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event) => {
      const item = pending.get(event.data.id); if (!item) return; pending.delete(event.data.id);
      if (event.data.error) {
        const error = event.data.error.name === 'WorkspaceConflictError' ? new WorkspaceConflictError() : new Error(event.data.error.message);
        error.message = event.data.error.message; item.reject(error);
      } else item.resolve(event.data.result);
    };
    worker.onerror = () => {
      for (const item of pending.values()) item.reject(new Error('SQLite could not start. Keep this tab open and retry local storage.'));
      pending.clear(); worker?.terminate(); worker = undefined;
    };
  }
  return new Promise<T>((resolve, reject) => {
    const id = ++nextId; pending.set(id, { resolve, reject });
    try { worker!.postMessage({ id, request }); } catch (error) { pending.delete(id); reject(error); }
  });
}
