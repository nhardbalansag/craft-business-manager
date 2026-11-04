import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { SheetJsWorkbookCodec } from '../src/storage/sheetJsWorkbookCodec';
import { createEmptyBusinessDatasetV2 } from '../src/domain/businessDatasetV2';
import { extendBusinessDatasetV2 } from '../src/domain/physicalBusinessDatasetV3';
import { extendPhysicalBusinessDatasetV3 } from '../src/domain/physicalBusinessDatasetV4';
import { extendPhysicalBusinessDatasetV4 } from '../src/domain/physicalBusinessDatasetV5';
import { execFileSync } from 'node:child_process';

test('downloads a real XLSX directly from a fresh SQLite workspace', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.getByLabel('Refresh protection')).toContainText('SQLite');
  await page.getByLabel('Database tools', { exact: true }).click();
  const downloadEvent = page.waitForEvent('download', { timeout: 15000 });
  await page.getByRole('button', { name: 'Download workbook', exact: true }).click();
  const download = await downloadEvent;
  const path = info.outputPath('downloaded.xlsx'); await download.saveAs(path);
  const document = new SheetJsWorkbookCodec().decode(readFileSync(path));
  expect(document.sheets.some(sheet => sheet.name === 'Products')).toBe(true);
});

test('exports long SQLite text losslessly, retains pictures, and offers a smaller picture-free copy', async ({ page }, info) => {
  const data = extendPhysicalBusinessDatasetV4(extendPhysicalBusinessDatasetV3(extendBusinessDatasetV2(createEmptyBusinessDatasetV2())));
  const history = JSON.parse(readFileSync(new URL('../src/ui/transactions/__fixtures__/native-transactions.json', import.meta.url), 'utf8'));
  const photo = 'data:image/jpeg;base64,' + Object.values(history.images)[0], notes = 'Detailed craft notes 🧸\n'.repeat(3000);
  data.products.push({ id: 'P-1', name: 'Bear P (1pcs)', category: 'paintable-art', isActive: true, safetyWasteRate: 0, notes, imageDataUrl: photo, brochureImageDataUrl: photo });
  await page.goto('/'); await expect(page.getByLabel('Refresh protection')).toContainText('SQLite');
  await page.evaluate(async dataset => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('craft-business-manager.workspace', 1);
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('recovery')) request.result.createObjectStore('recovery'); };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { const db = request.result, tx = db.transaction('recovery', 'readwrite');
        tx.objectStore('recovery').put({ formatVersion: 1, revision: 'long-text-test', savedAt: new Date().toISOString(), dataset }, 'current');
        tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = () => reject(tx.error); };
    });
    await new Promise<void>((resolve, reject) => { const request = indexedDB.deleteDatabase('my-lovely-craft.sqlite'); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); });
  }, data);
  await page.reload(); await expect(page.getByLabel('Refresh protection')).toContainText('Workspace restored');
  await page.getByLabel('Database tools', { exact: true }).click();
  const fullDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download workbook', exact: true }).click();
  const fullPath = info.outputPath('with-pictures.xlsx'); await (await fullDownload).saveAs(fullPath);
  const codec = new SheetJsWorkbookCodec(), full = codec.decode(readFileSync(fullPath));
  expect(full.sheets.find(s => s.name === 'Products')?.rows[0]).toMatchObject({ notes, imageDataUrl: photo });
  await page.getByLabel('Workbook file', { exact: true }).setInputFiles(fullPath);
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'Apply import', exact: true }).click();
  await expect(page.getByLabel('Refresh protection')).toContainText('Workspace saved');
  const smallDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download workbook without pictures', exact: true }).click();
  const smallPath = info.outputPath('without-pictures.xlsx'); const small = await smallDownload; await small.saveAs(smallPath);
  expect(small.suggestedFilename()).toContain('without-pictures.xlsx');
  const product = codec.decode(readFileSync(smallPath)).sheets.find(s => s.name === 'Products')!.rows[0];
  expect(product.notes).toBe(notes); expect(product.imageDataUrl).toBeUndefined();
  expect(Object.keys(product).filter(k => k.startsWith('brochureImagePart')).every(k => product[k] == null)).toBe(true);
  const backupDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download SQLite backup', exact: true }).click();
  const backupPath = info.outputPath('original-pictures-retained.sqlite'); await (await backupDownload).saveAs(backupPath);
  expect(JSON.parse(execFileSync('python', ['scripts/verify-mobile-sqlite.py', backupPath], { encoding: 'utf8' }))).toMatchObject({ native_sqlite: 'passed', products: 1, images: 1 });
});

test('explains a failed Excel module load instead of hiding its cause', async ({ page }) => {
  await page.route('**/assets/sheetJsWorkbookCodec-*.js', route => route.abort());
  await page.goto('/'); await expect(page.getByLabel('Refresh protection')).toContainText('SQLite');
  await page.getByLabel('Database tools', { exact: true }).click();
  await page.getByRole('button', { name: 'Download workbook', exact: true }).click();
  await expect(page.locator('.workbook-export-feedback-error')).toContainText('Excel support could not load');
  await expect(page.locator('.workbook-export-feedback-error')).toContainText('Save your edits');
});
