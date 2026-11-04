import { useRef, useState } from 'react';
import { sqliteBackupService } from '../../application/session';
import type { SqliteBackupReview, SqliteBackupService } from '../../application/persistence/SqliteBackupService';

function message(error: unknown) { return error instanceof Error ? error.message : 'The SQLite operation failed. Your current data is retained.'; }
async function readFile(file: File): Promise<Uint8Array> {
  if (file.size > 256 * 1024 * 1024) throw new Error('Choose a SQLite backup smaller than 256 MB.');
  if (file.arrayBuffer) return new Uint8Array(await file.arrayBuffer());
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer)); reader.onerror = () => reject(reader.error); reader.readAsArrayBuffer(file); });
}
export function downloadSqlite(bytes: Uint8Array): void {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/vnd.sqlite3' }));
  try {
    const anchor = document.createElement('a'); anchor.href = url;
    anchor.download = `my-lovely-craft-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`;
    document.body.append(anchor); anchor.click(); anchor.remove();
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
export function SqliteBackupPanel({ service = sqliteBackupService, onRestored, download = downloadSqlite, recovery = false }: {
  service?: Pick<SqliteBackupService, 'inspect' | 'restore' | 'exportBackup'> & Partial<Pick<SqliteBackupService, 'recover'>>;
  onRestored: () => void;
  download?: (bytes: Uint8Array) => void;
  recovery?: boolean;
}) {
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [review, setReview] = useState<{ bytes: Uint8Array; name: string; details: SqliteBackupReview } | null>(null);
  const locked = useRef(false), version = useRef(0);
  async function backup() {
    if (locked.current) return; locked.current = true; setBusy('backup'); setError(''); setNotice('');
    try { download(await service.exportBackup()); setNotice('SQLite backup downloaded. Import this file on the web app or in the mobile app under Data files → Import SQLite backup.'); }
    catch (cause) { setError(message(cause)); }
    finally { locked.current = false; setBusy(''); }
  }
  async function inspect(file?: File) {
    if (!file || locked.current) return;
    const current = ++version.current; locked.current = true; setReview(null); setBusy('review'); setError(''); setNotice('');
    try { const bytes = await readFile(file), details = await service.inspect(bytes); if (current === version.current) setReview({ bytes, name: file.name, details }); }
    catch (cause) { setError(message(cause)); }
    finally { locked.current = false; setBusy(''); }
  }
  async function restore() {
    if (!review || locked.current) return;
    locked.current = true; setBusy('restore'); setError('');
    try {
      if (recovery) { if (!service.recover) throw new Error('SQLite recovery is unavailable.'); await service.recover(review.bytes, review.details.databaseGeneration); }
      else await service.restore(review.bytes, review.details.databaseGeneration);
      setReview(null); setNotice('SQLite backup restored. Catalog, photos, transaction history and business insights are available.'); onRestored();
    }
    catch (cause) { setError(message(cause)); }
    finally { locked.current = false; setBusy(''); }
  }
  return <section className="panel sqlite-backup-panel" aria-label="SQLite database and backups" aria-busy={!!busy}>
    <div className="panel-heading"><div><p className="panel-kicker">PRIMARY STORAGE</p><h2>SQLite database &amp; backups</h2></div></div>
    <p>Saved records live in SQLite on this browser. Excel and Google Sheets are optional import sources.</p>
    <p>Backups include the catalog, product photos, pricing, components, inventory, transaction history, expenses, forecasts and saved business documents. The .sqlite file is compatible with the My Lovely Craft mobile app.</p>
    <p>Business insights are a web feature. Keep your original web backup: the current mobile app does not display these records or retain them when exporting a new backup.</p>
    {!recovery && <button type="button" className="button button-primary" disabled={!!busy} onClick={() => void backup()}>{busy === 'backup' ? 'Preparing SQLite backup…' : 'Download SQLite backup'}</button>}
    <label className="field"><span>Import / restore SQLite backup</span><input type="file" accept=".sqlite,.sqlite3,.db,application/vnd.sqlite3,application/x-sqlite3" disabled={!!busy}
      onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void inspect(file); }} /></label>
    {busy === 'review' && <p role="status">Checking SQLite tables, checksums, photos and catalog relationships…</p>}
    {review && <div className="sqlite-backup-review">
      <h3>Review {review.name}</h3>
      <p>{review.details.products} products · {review.details.materials} materials · {review.details.images} images · {review.details.receipts} receipts · {review.details.quotations} quotations</p>
      <p>{review.details.ledgerEntries ?? 0} business ledger entries · {review.details.businessDocuments ?? 0} business documents</p>
      <p>Restoring replaces the current catalog, transaction history and business insights. Backups created before Business insights contain an empty business workspace. Download a backup of your current data first if you need to keep it.</p>
      <p>On mobile, choose “Import catalog only” to preserve phone history, or “Restore all backup data” to replace it.</p>
      <button type="button" className="button button-primary" disabled={!!busy || !review.details.hasCatalog} onClick={() => void restore()}>{busy === 'restore' ? 'Restoring SQLite backup…' : 'Restore this SQLite backup'}</button>{' '}
      <button type="button" className="button button-secondary" disabled={!!busy} onClick={() => setReview(null)}>Cancel restore</button>
    </div>}
    {error && <p className="feedback feedback-error" role="alert">{error}</p>}
    {notice && <p className="feedback feedback-success" role="status">{notice}</p>}
  </section>;
}
