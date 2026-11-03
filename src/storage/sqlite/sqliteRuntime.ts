import initSqlJs, { type SqlJsStatic } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
let runtime: Promise<SqlJsStatic> | undefined;
export function sqliteRuntime(): Promise<SqlJsStatic> {
  return runtime ??= initSqlJs((globalThis as any).process?.versions?.node ? {} : { locateFile: () => wasmUrl })
    .catch((error: unknown) => { runtime = undefined; throw error; });
}
