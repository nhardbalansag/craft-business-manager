// A backup must include edits that are still waiting for the debounced SQLite save.
let flush: (() => Promise<void>) | undefined;
export function registerBusinessFlush(callback: () => Promise<void>) {
  flush = callback;
  return () => { if (flush === callback) flush = undefined; };
}
export async function flushBusinessChanges() { await flush?.(); }
