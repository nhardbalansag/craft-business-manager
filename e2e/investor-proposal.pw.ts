import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { unzipSync, strFromU8 } from 'fflate';

test.use({ actionTimeout: 15000 });
async function openInvestor(page: Page) {
  await page.goto('/'); await expect(page.getByLabel('Refresh protection')).toContainText('SQLite');
  await page.getByRole('button', { name: 'Business insights', exact: true }).click();
  const app = page.locator('.business-insights');
  await app.getByRole('button', { name: 'Investor proposals', exact: true }).click();
  return app;
}
async function terms(page: Page) {
  const app = page.locator('.business-insights');
  await app.getByLabel('Investor name', { exact: true }).fill('María Santos');
  await app.getByLabel('Proposal date', { exact: true }).fill('2026-11-04');
  await app.getByLabel('Projected start month', { exact: true }).fill('2026-11');
  await app.getByLabel('Proposed investment (PHP)', { exact: true }).fill('10000');
  await app.getByLabel('Maximum total payout including capital (PHP)', { exact: true }).fill('14000');
  await app.getByLabel('Assumptions and financial record coverage', { exact: true }).fill('Owner-entered assumptions. Costs and operating expenses reviewed; future results and available cash may differ.');
}

test('owner generates branded investor PDF/Word and saves an independent proposal in a restorable SQLite backup', async ({ page }, info) => {
  test.setTimeout(180000);
  const errors: string[] = [], scripts: string[] = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (r.resourceType() === 'script') scripts.push(r.url()); });
  const app = await openInvestor(page); await terms(page);
  await app.getByLabel('Assumed monthly sales (PHP)', { exact: true }).fill('20000');
  await app.getByLabel('Assumed monthly product costs (PHP)', { exact: true }).fill('8000');
  await app.getByLabel('Assumed monthly operating expenses (PHP)', { exact: true }).fill('2000');
  await app.getByLabel('Proposed use of investment', { exact: true }).fill('Additional molds, materials and packaging for the planned collection.');
  await app.getByLabel('Risks specific to this proposal', { exact: true }).fill('Demand may change and production is limited. Costs are reviewed before accepting orders.');
  await app.getByLabel('Additional investment conditions', { exact: true }).fill('Proposed terms require a separate written agreement and review of actual profit and cash.');
  await expect(app.getByText('Saved in SQLite', { exact: true })).toBeVisible();
  const moderate = app.getByRole('article', { name: 'Moderate investor projection' });
  await expect(moderate).toContainText('14,000.00'); await expect(moderate).toContainText('month 6');
  expect(scripts.some(url => /pdfmake-|vfs_fonts-/.test(url))).toBe(false);
  await app.getByRole('button', { name: 'Preview investor proposal', exact: true }).click();
  const frame = app.frameLocator('iframe[title="Investor proposal preview"]');
  await expect(frame.getByText('Prepared for María Santos', { exact: false })).toBeVisible();
  await expect(frame.getByRole('heading', { name: 'Estimated outcomes · not guaranteed', exact: true })).toBeVisible();
  await expect(frame.getByRole('heading', { name: 'Monthly estimated payout schedule', exact: true })).toHaveCount(3);
  const pdfDownload = page.waitForEvent('download'); await app.getByRole('button', { name: 'Download investor PDF', exact: true }).click();
  const pdfPath = info.outputPath('investor-proposal.pdf'); await (await pdfDownload).saveAs(pdfPath);
  expect(readFileSync(pdfPath).subarray(0, 5).toString()).toBe('%PDF-'); expect(readFileSync(pdfPath).length).toBeGreaterThan(10000);
  const wordDownload = page.waitForEvent('download'); await app.getByRole('button', { name: 'Download investor Word (.docx)', exact: true }).click();
  const wordPath = info.outputPath('investor-proposal.docx'); await (await wordDownload).saveAs(wordPath);
  const xml = strFromU8(unzipSync(readFileSync(wordPath))['word/document.xml']);
  expect(xml).toContain('María Santos'); expect(xml).toContain('not guaranteed payments'); expect(xml).toContain('Annual estimates');
  await app.getByRole('button', { name: 'Save proposal snapshot', exact: true }).click();
  await expect(app.getByRole('button', { name: 'Proposal saved', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('investor-preview.png'), fullPage: true });
  // Changing assumptions does not rewrite an existing investor document.
  await app.getByLabel('Assumed monthly sales (PHP)', { exact: true }).fill('22000');
  await expect(app.locator('iframe[title="Investor proposal preview"]')).toHaveCount(0);
  await expect(app.getByText('Saved in SQLite', { exact: true })).toBeVisible();
  await app.getByRole('button', { name: 'Documents', exact: true }).click();
  await expect(app.getByRole('combobox', { name: 'Saved document', exact: true })).toContainText('María Santos');
  const savedFrame = app.frameLocator('iframe[title="Business document preview"]');
  await expect(savedFrame.getByText('₱20,000.00', { exact: true }).first()).toBeVisible();
  await app.getByRole('button', { name: 'Expenses & cash', exact: true }).click();
  await expect(app.getByText('No ledger entries match.', { exact: false })).toBeVisible();
  await page.getByLabel('Database tools', { exact: true }).click();
  const backupEvent = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download SQLite backup', exact: true }).click();
  const backupPath = info.outputPath('investor-proposal.sqlite'); await (await backupEvent).saveAs(backupPath);
  const verification = JSON.parse(execFileSync('python', ['scripts/verify-mobile-sqlite.py', backupPath], { encoding: 'utf8' }));
  expect(verification).toMatchObject({ native_sqlite: 'passed', receipts: 0 });
  const business = JSON.parse(execFileSync('python', ['-c', 'import sqlite3,json,sys; db=sqlite3.connect(sys.argv[1]); w=json.loads(db.execute("SELECT value FROM craft_web_meta WHERE key=?",("business_workspace",)).fetchone()[0]); print(json.dumps({"ledger":len(w["ledger"]),"documents":len(w["documents"]),"kind":w["documents"][0]["kind"],"originalSales":w["documents"][0]["investment"]["basis"]["baseline"]["monthlySales"]}))', backupPath], { encoding: 'utf8' }));
  expect(business).toEqual({ ledger: 0, documents: 1, kind: 'investor-proposal', originalSales: 20000 });
  await page.getByLabel('Import / restore SQLite backup', { exact: true }).setInputFiles(backupPath);
  await page.getByRole('button', { name: 'Restore this SQLite backup', exact: true }).click();
  await expect(page.getByText('SQLite backup restored.', { exact: false })).toBeVisible();
  await page.locator('.workbook-tools-close-row button').click();
  await page.reload(); await expect(page.getByLabel('Refresh protection')).toContainText('Workspace restored');
  await page.getByRole('button', { name: 'Business insights', exact: true }).click(); await app.getByRole('button', { name: 'Investor proposals', exact: true }).click();
  await expect(app.getByLabel('Investor name', { exact: true })).toHaveValue('María Santos');
  await expect(app.getByLabel('Assumed monthly sales (PHP)', { exact: true })).toHaveValue('22000');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(app.getByRole('article', { name: 'Moderate investor projection' })).toBeVisible();
  expect(await app.locator('.investor-proposal').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('investor-mobile.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('historical proposals require saved costs and expense review and can reuse a capacity-limited business forecast', async ({ page }) => {
  test.setTimeout(150000);
  await page.goto('/'); await expect(page.getByLabel('Refresh protection')).toContainText('SQLite');
  await page.getByRole('button', { name: 'Transactions', exact: true }).click();
  const archive = readFileSync(new URL('../src/ui/transactions/__fixtures__/mobile-transactions.json', import.meta.url));
  await page.getByLabel('Upload transaction archive', { exact: true }).setInputFiles({ name: 'sales.json', mimeType: 'application/json', buffer: archive });
  await page.getByRole('button', { name: 'Append imported history', exact: true }).click();
  await page.getByRole('button', { name: 'Business insights', exact: true }).click(); const app = page.locator('.business-insights');
  await app.getByRole('button', { name: 'Investor proposals', exact: true }).click(); await terms(page);
  await app.getByRole('combobox', { name: 'Projection source', exact: true }).selectOption('history');
  await app.getByLabel('Historical from date', { exact: true }).fill('2026-08-01'); await app.getByLabel('Historical to date', { exact: true }).fill('2026-10-31');
  await expect(app.getByText('1 receipts across 3 complete month(s).', { exact: false })).toBeVisible();
  await expect(app.getByRole('button', { name: 'Preview investor proposal', exact: true })).toBeDisabled();
  await app.getByRole('checkbox', { name: /I reviewed expense coverage/ }).check();
  await expect(app.getByText('Saved in SQLite', { exact: true })).toBeVisible();
  await app.getByRole('button', { name: 'Preview investor proposal', exact: true }).click();
  const frame = app.frameLocator('iframe[title="Investor proposal preview"]');
  await expect(frame.getByText('Historical inputs: 2026-08-01 to 2026-10-31', { exact: false })).toBeVisible();
  await app.getByLabel('Historical from date', { exact: true }).fill('2026-10-02');
  await expect(app.getByText('Choose complete calendar months', { exact: false }).first()).toBeVisible();
  await expect(app.getByRole('button', { name: 'Preview investor proposal', exact: true })).toBeDisabled();
  // Reuse existing unit pricing/cost inputs and physical capacity from the business scenario planner.
  await app.getByRole('button', { name: 'Forecast', exact: true }).click();
  await app.getByLabel('Initial units per month', { exact: true }).fill('10'); await app.getByLabel('Monthly capacity (units)', { exact: true }).fill('12');
  await app.getByLabel('Average selling price / unit (PHP)', { exact: true }).fill('100'); await app.getByLabel('Variable cost / unit (PHP)', { exact: true }).fill('40');
  await app.getByLabel('Monthly fixed expenses (PHP)', { exact: true }).fill('100'); await expect(app.getByText('Saved in SQLite', { exact: true })).toBeVisible();
  await app.getByRole('button', { name: 'Investor proposals', exact: true }).click();
  await app.getByRole('combobox', { name: 'Projection source', exact: true }).selectOption('forecast');
  await app.getByLabel('Optimistic Sales-volume factor (%)', { exact: true }).fill('200');
  await expect(app.getByText('Saved in SQLite', { exact: true })).toBeVisible();
  await app.getByRole('button', { name: 'Preview investor proposal', exact: true }).click();
  await expect(frame.getByText('Projected volume is capped by the production capacity', { exact: false })).toBeVisible();
});
