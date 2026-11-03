import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createEmptyBusinessDatasetV2 } from '../src/domain/businessDatasetV2';
import { extendBusinessDatasetV2 } from '../src/domain/physicalBusinessDatasetV3';
import { extendPhysicalBusinessDatasetV3 } from '../src/domain/physicalBusinessDatasetV4';
import { extendPhysicalBusinessDatasetV4 } from '../src/domain/physicalBusinessDatasetV5';
import { exportPhysicalBusinessDatasetV5ToXlsx } from '../src/storage/physicalBusinessDatasetV5Workbook';
import { SheetJsWorkbookCodec } from '../src/storage/sheetJsWorkbookCodec';
const history = JSON.parse(readFileSync(new URL('../src/ui/transactions/__fixtures__/native-transactions.json', import.meta.url), 'utf8'));

test('production worker migrates data, retains Excel import, and round-trips a native-readable SQLite backup', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByLabel('Refresh protection')).toContainText('SQLite');
  const data = extendPhysicalBusinessDatasetV4(extendPhysicalBusinessDatasetV3(extendBusinessDatasetV2(createEmptyBusinessDatasetV2())));
  const photo = 'data:image/jpeg;base64,' + Object.values(history.images)[0];
  data.products.push({ id: 'P-1', name: 'Bear P (1pcs)', category: 'paintable-art', isActive: true, safetyWasteRate: 0, imageDataUrl: photo, brochureImageDataUrl: photo });
  data.productStocks.push({ productId: 'P-1', onHandQuantity: 7 });
  // Seed only this isolated test browser's original stores, then reopen to exercise migration.
  await page.evaluate(async ({ data, history }) => {
    async function put(name: string, store: string, value: unknown) {
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(name, 1);
        open.onupgradeneeded = () => { if (!open.result.objectStoreNames.contains(store)) open.result.createObjectStore(store); };
        open.onerror = () => reject(open.error);
        open.onsuccess = () => { const db = open.result, tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(value, 'current');
          tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = () => { db.close(); reject(tx.error); }; };
      });
    }
    await put('craft-business-manager.workspace', 'recovery', { formatVersion: 1, revision: 'legacy-test', savedAt: new Date().toISOString(), dataset: data });
    await put('my-lovely-craft-transaction-history', 'history', { revision: 1, archive: history });
    await new Promise<void>((resolve, reject) => { const request = indexedDB.deleteDatabase('my-lovely-craft.sqlite'); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); });
  }, { data, history });
  await page.reload(); await expect(page.getByLabel('Refresh protection')).toContainText('Workspace restored');
  await page.getByRole('button', { name: 'Products', exact: true }).click();
  await expect(page.getByRole('button', { name: 'View Bear P (1pcs)', exact: true })).toBeVisible();
  await page.getByLabel('Database tools', { exact: true }).click();
  const sqlite = page.getByRole('region', { name: 'SQLite database and backups' });
  const downloaded = page.waitForEvent('download'); await sqlite.getByRole('button', { name: 'Download SQLite backup', exact: true }).click();
  const download = await downloaded, backupPath = info.outputPath('portable.sqlite'); await download.saveAs(backupPath);
  expect(readFileSync(backupPath).subarray(0, 16).toString()).toBe('SQLite format 3\0');
  const verified = execFileSync('python', ['scripts/verify-mobile-sqlite.py', backupPath], { encoding: 'utf8' });
  expect(JSON.parse(verified)).toMatchObject({ native_sqlite: 'passed', products: 1, images: 1, receipts: 1 });
  // Import another workbook to prove Excel is still an optional, persisted source.
  const excel = structuredClone(data); excel.products[0].name = 'Changed through Excel';
  const workbook = exportPhysicalBusinessDatasetV5ToXlsx(excel, { exportedAt: new Date().toISOString() }, new SheetJsWorkbookCodec());
  await page.getByLabel('Workbook file', { exact: true }).setInputFiles({ name: 'legacy.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(workbook) });
  page.once('dialog', (dialog) => dialog.accept()); await page.getByRole('button', { name: 'Apply import', exact: true }).click();
  await expect(page.getByLabel('Refresh protection')).toContainText('Workspace saved');
  await page.locator('.workbook-tools-close-row button').click();
  await expect(page.getByRole('button', { name: 'View Changed through Excel', exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByLabel('Refresh protection')).toContainText('Workspace restored');
  await page.getByRole('button', { name: 'Products', exact: true }).click();
  await expect(page.getByRole('button', { name: 'View Changed through Excel', exact: true })).toBeVisible();
  await page.getByLabel('Database tools', { exact: true }).click();
  await page.getByLabel('Import / restore SQLite backup', { exact: true }).setInputFiles(backupPath);
  await expect(sqlite).toContainText('1 products'); await expect(sqlite).toContainText('1 receipts');
  await sqlite.getByRole('button', { name: 'Restore this SQLite backup', exact: true }).click();
  await expect(sqlite).toContainText('SQLite backup restored');
  await page.locator('.workbook-tools-close-row button').click();
  await expect(page.getByRole('button', { name: 'View Bear P (1pcs)', exact: true })).toBeVisible();
  // A new database instance after reload must see the restored state, not the Excel version.
  await page.reload(); await expect(page.getByLabel('Refresh protection')).toContainText('Workspace restored');
  await page.getByRole('button', { name: 'Products', exact: true }).click();
  await expect(page.getByRole('button', { name: 'View Bear P (1pcs)', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  // A corrupt local file must keep editing gated while permitting a reviewed backup recovery.
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('my-lovely-craft.sqlite', 1);
      request.onsuccess = () => { const db = request.result, tx = db.transaction('database', 'readwrite');
        tx.objectStore('database').put(new Uint8Array([1, 2, 3]), 'main.sqlite');
        tx.objectStore('database').put('corrupt-test-generation', 'generation');
        tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = () => { db.close(); reject(tx.error); }; };
      request.onerror = () => reject(request.error);
    });
  });
  await page.reload(); await expect(page.getByLabel('Local workspace recovery')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Products', exact: true })).toHaveCount(0);
  await page.getByLabel('Import / restore SQLite backup', { exact: true }).setInputFiles(backupPath);
  await page.getByRole('button', { name: 'Restore this SQLite backup', exact: true }).click();
  await expect(page.getByLabel('Refresh protection')).toContainText('Workspace restored');
  await page.getByRole('button', { name: 'Products', exact: true }).click();
  await expect(page.getByRole('button', { name: 'View Bear P (1pcs)', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('sqlite-restored.png'), fullPage: true });
});
