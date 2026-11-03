import { SqliteDatabaseHost, type SqliteRequest } from './SqliteDatabaseHost';
const database = new SqliteDatabaseHost();
globalThis.addEventListener('message', async (event: MessageEvent<{ id: number; request: SqliteRequest }>) => {
  const { id, request } = event.data;
  try { globalThis.postMessage({ id, result: await database.request(request) }); }
  catch (error) { globalThis.postMessage({ id, error: { name: error instanceof Error ? error.name : 'Error', message: error instanceof Error ? error.message : String(error) } }); }
});
