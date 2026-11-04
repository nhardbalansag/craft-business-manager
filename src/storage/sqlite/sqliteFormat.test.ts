import { beforeAll, describe, expect, it } from 'vitest';
import type { SqlJsStatic } from 'sql.js';
import { createEmptyBusinessDatasetV2 } from '../../domain/businessDatasetV2';
import { extendBusinessDatasetV2 } from '../../domain/physicalBusinessDatasetV3';
import { extendPhysicalBusinessDatasetV3 } from '../../domain/physicalBusinessDatasetV4';
import { extendPhysicalBusinessDatasetV4 } from '../../domain/physicalBusinessDatasetV5';
import nativeHistory from '../../ui/transactions/__fixtures__/native-transactions.json';
import { decodeSqlite, encodeSqlite, historyFromDocument, newSqliteDocument, setDocumentHistory, SQLITE_APPLICATION_ID, sha256 } from './sqliteFormat';
import { sqliteRuntime } from './sqliteRuntime';

let SQL: SqlJsStatic;
beforeAll(async () => { SQL = await sqliteRuntime(); });
export function datasetFixture() {
  const data = extendPhysicalBusinessDatasetV4(extendPhysicalBusinessDatasetV3(extendBusinessDatasetV2(createEmptyBusinessDatasetV2())));
  const photo = 'data:image/jpeg;base64,' + Object.values(nativeHistory.images)[0];
  data.products.push({ id: 'P-1', name: 'Bear P (1pcs)', category: 'paintable-art', isActive: true, safetyWasteRate: .05, imageDataUrl: photo, brochureImageDataUrl: photo });
  data.productStocks.push({ productId: 'P-1', onHandQuantity: 7 });
  return data;
}

describe('Mobile-compatible SQLite database format', () => {
  it('verifies and round-trips the optional business extension without changing Android state or record contracts', async () => {
    const document = newSqliteDocument(); document.dataset = datasetFixture();
    document.business.profile.description = 'Investor records'; document.businessRevision = 4;
    const bytes = await encodeSqlite(SQL, document, true);
    const decoded = await decodeSqlite(SQL, bytes, true);
    expect(decoded.business).toEqual(document.business); expect(decoded.businessRevision).toBe(4);
    const db = new SQL.Database(bytes);
    db.run("UPDATE craft_web_meta SET value=value || ' ' WHERE key='business_workspace'");
    await expect(decodeSqlite(SQL, db.export(), true)).rejects.toThrow('business workspace checksum'); db.close();
    const android = new SQL.Database(bytes); android.run('DROP TABLE craft_web_meta');
    const mobile = await decodeSqlite(SQL, android.export(), true); android.close();
    expect(mobile.business.ledger).toEqual([]); expect(mobile.businessRevision).toBe(0);
    expect(mobile.dataset).toEqual(document.dataset);
  });
  it('writes a real SQLite file with Android application ID, normalized records, images and portable state', async () => {
    const document = newSqliteDocument(); document.dataset = datasetFixture(); document.workspaceRevision = 'test-revision';
    document.savedAt = '2026-11-04T00:00:00.000Z';
    await setDocumentHistory(document, nativeHistory); document.historyRevision = 3;
    const before = structuredClone(document);
    const bytes = await encodeSqlite(SQL, document, true);
    expect(new TextDecoder().decode(bytes.subarray(0, 16))).toBe('SQLite format 3\0');
    const db = new SQL.Database(bytes);
    expect(db.exec('PRAGMA application_id')[0].values[0][0]).toBe(SQLITE_APPLICATION_ID);
    expect(db.exec('SELECT COUNT(*) FROM craft_images')[0].values[0][0]).toBe(1);
    expect(db.exec("SELECT json FROM craft_records WHERE collection='products'")[0].values[0][0]).not.toContain('data:image');
    expect(db.exec('SELECT content FROM craft_state_chunks')[0].values[0][0]).toContain('backup://image/'); db.close();
    const decoded = await decodeSqlite(SQL, bytes, true);
    expect(decoded.dataset).toEqual(document.dataset); expect(decoded.workspaceRevision).toBe(document.workspaceRevision);
    expect(await historyFromDocument(decoded)).toEqual(nativeHistory);
    expect(document).toEqual(before);
  });

  it.each(['state', 'record', 'image', 'manifest'])('rejects corrupt %s bytes before any restore is allowed', async (kind) => {
    const document = newSqliteDocument(); document.dataset = datasetFixture();
    const db = new SQL.Database(await encodeSqlite(SQL, document, true));
    if (kind === 'state') db.run("UPDATE craft_state_chunks SET content=content || ' '");
    if (kind === 'record') db.run("UPDATE craft_records SET json=json || ' '");
    if (kind === 'image') db.run("UPDATE craft_images SET bytes=x'ffd8ff00'");
    if (kind === 'manifest') db.run("UPDATE craft_meta SET value='0' WHERE key='image_count'");
    const bytes = db.export(); db.close(); await expect(decodeSqlite(SQL, bytes, true)).rejects.toThrow(/checksum|manifest/i);
  });

  it('rejects foreign databases, unsupported versions, invalid graphs and missing rows', async () => {
    const foreign = new SQL.Database(); foreign.run('CREATE TABLE anything (id INTEGER)');
    await expect(decodeSqlite(SQL, foreign.export())).rejects.toThrow('another application'); foreign.close();
    const document = newSqliteDocument(); document.dataset = datasetFixture();
    const db = new SQL.Database(await encodeSqlite(SQL, document));
    db.run("DELETE FROM craft_records WHERE collection='products'");
    await expect(decodeSqlite(SQL, db.export())).rejects.toThrow(/incomplete|damaged/); db.close();
    document.dataset.productComponents.push({ id: 'self', parentProductId: 'P-1', sourceId: 'P-1', sourceType: 'product', role: 'other', quantityPerParent: 1 });
    await expect(encodeSqlite(SQL, document)).rejects.toThrow('catalog is invalid');
  });

  it('keeps mobile inventory balances aligned with web stock changes while preserving movement history', async () => {
    const document = newSqliteDocument(); document.dataset = datasetFixture();
    document.state.inventory = { balances: [{ productId: 'P-1', quantity: 1 }], movements: [] };
    const result = await decodeSqlite(SQL, await encodeSqlite(SQL, document, true));
    expect(result.state.inventory.balances[0].quantity).toBe(7);
    expect(result.state.inventory.movements).toEqual([]);
  });

  it('accepts an Android-style file without web metadata and retains mobile-only print settings', async () => {
    const document = newSqliteDocument(); document.dataset = datasetFixture(); document.state.printer.name = 'Phone printer';
    document.state.jobs = [{ id: 'JOB', createdAt: '2026-11-04T00:00:00Z', printer: 'Phone printer', status: 'sent', copies: 1, receipt: { title: 'Saved print', text: 'Keep this history' } }];
    const db = new SQL.Database(await encodeSqlite(SQL, document, true)); db.run('DROP TABLE craft_web_meta');
    const bytes = db.export(); db.close(); const imported = await decodeSqlite(SQL, bytes, true);
    expect(imported.dataset).toEqual(document.dataset); expect(imported.state.jobs).toEqual(document.state.jobs);
    expect(imported.state.printer.name).toBe('Phone printer');
    const roundTrip = await decodeSqlite(SQL, await encodeSqlite(SQL, imported, true), true);
    expect(roundTrip.state.jobs).toEqual(document.state.jobs);
  });

  it('matches the exact aggregate-record hash contract of the Android reader', async () => {
    const document = newSqliteDocument(); document.dataset = datasetFixture();
    const db = new SQL.Database(await encodeSqlite(SQL, document, true));
    const rows = db.exec('SELECT collection,position,sha256 FROM craft_records ORDER BY collection,position')[0].values;
    const text = rows.map(([collection, position, hash]) => `${collection}:${position}:${hash}\n`).join('');
    const hash = db.exec("SELECT value FROM craft_meta WHERE key='records_sha256'")[0].values[0][0];
    expect(await sha256(text)).toBe(hash); db.close();
  });
});
