import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import * as XLSX from 'xlsx';
import fixture from './__fixtures__/mobile-transactions.json';
import nativeFixture from './__fixtures__/native-transactions.json';
import {
  emptyTransactionArchive,
  mergePortableTransactions,
  readPortableTransactions,
  readTransactionWorkbook,
  validatePortableTransactions,
} from './portableTransactions';
import {
  loadTransactionHistory,
  saveTransactionHistory,
} from './transactionHistoryStore';
import { transactionWorkbook } from './transactionWorkbook';
import {
  defaultTransactionFilters,
  filterTransactionReceipts,
  transactionSummary,
} from './transactions';
import { transactionFinancialHtml } from './transactionReport';

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
});
afterEach(() => {
  vi.unstubAllGlobals();
});
describe('mobile transaction transfer and durable web history', () => {
  it('verifies and restores the historical image archive produced by Android native code', async () => {
    const archive = await validatePortableTransactions(nativeFixture);
    expect(Object.keys(archive.images)).toHaveLength(1);
    expect(archive.quotations[0].photos.A.uri).toMatch(
      /^backup:\/\/image\/[a-f0-9]{64}$/
    );
    const id = Object.keys(archive.images)[0],
      corrupt = {
        ...archive,
        images: { [id]: archive.images[id].slice(0, -4) + 'AAAA' },
      };
    await expect(validatePortableTransactions(corrupt)).rejects.toThrow(
      'checksum'
    );
    await expect(
      validatePortableTransactions({ ...archive, images: {} })
    ).rejects.toThrow('incomplete');
    expect(
      mergePortableTransactions(emptyTransactionArchive(), archive).archive
        .images
    ).toEqual(archive.images);
  });
  it('accepts the actual mobile-service fixture and round-trips JSON and Excel without a catalog', async () => {
    const archive = await validatePortableTransactions(fixture);
    expect(archive.customerReceipts[0].items[0].totalProductCost).toBe(44);
    expect(transactionSummary(archive.customerReceipts)).toMatchObject({
      sales: 58,
      credit: 58,
      cost: 44,
      profit: 14,
    });
    const json = JSON.stringify(archive);
    expect(
      await readPortableTransactions(new File([json], 'mobile.json'))
    ).toEqual(archive);
    const bytes = transactionWorkbook(archive, json);
    expect(readTransactionWorkbook(bytes)).toBe(json);
    expect(
      await readPortableTransactions(
        new File([new Uint8Array(bytes).buffer], 'mobile.xlsx')
      )
    ).toEqual(archive);
    const workbook = XLSX.read(bytes, { type: 'array' });
    expect(workbook.Sheets.Products).toBeUndefined();
    expect(workbook.SheetNames).toContain('ReceiptItems');
  });
  it('appends beside newer transactions and keeps local versions of conflicting IDs', async () => {
    const incoming = await validatePortableTransactions(fixture),
      current = emptyTransactionArchive();
    current.customerReceipts = [
      {
        ...incoming.customerReceipts[0],
        id: 'NEW',
        reference: 'NEW',
        createdAt: '2026-11-01T01:00:00Z',
      },
    ];
    const merged = mergePortableTransactions(current, incoming);
    expect(merged.stats).toMatchObject({
      receiptsAdded: 1,
      quotationsAdded: 1,
      duplicates: 0,
      conflicts: 0,
    });
    expect(merged.archive.customerReceipts.map((r) => r.id)).toEqual([
      'NEW',
      'SALE-INTEROP-1',
    ]);
    expect(
      mergePortableTransactions(merged.archive, incoming).stats
    ).toMatchObject({ receiptsAdded: 0, quotationsAdded: 0, duplicates: 2 });
    merged.archive.customerReceipts[1] = {
      ...merged.archive.customerReceipts[1],
      customerName: 'Local change',
    };
    const conflict = mergePortableTransactions(merged.archive, incoming);
    expect(conflict.stats.conflicts).toBe(1);
    expect(conflict.archive.customerReceipts[1].customerName).toBe(
      'Local change'
    );
  });
  it('persists history independently in IndexedDB and rejects stale concurrent writers atomically', async () => {
    const empty = await loadTransactionHistory();
    expect(empty.revision).toBe(0);
    const archive = await validatePortableTransactions(fixture);
    const results = await Promise.allSettled([
      saveTransactionHistory(archive, 0),
      saveTransactionHistory(archive, 0),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejection = results.find(
      (r) => r.status === 'rejected'
    ) as PromiseRejectedResult;
    expect(rejection.reason.message).toContain('another tab');
    const saved = await loadTransactionHistory();
    expect(saved.revision).toBe(1);
    expect(saved.archive).toEqual(archive);
    await expect(
      saveTransactionHistory(emptyTransactionArchive(), 0)
    ).rejects.toThrow('another tab');
    expect(
      (await loadTransactionHistory()).archive.customerReceipts
    ).toHaveLength(1);
    await saveTransactionHistory(archive, 1);
    expect((await loadTransactionHistory()).revision).toBe(2);
  });
  it('rejects damaged amounts, duplicate IDs, formula payloads, unsupported versions and non-portable pictures', async () => {
    const archive = await validatePortableTransactions(fixture);
    await expect(
      validatePortableTransactions({ ...archive, version: 2 })
    ).rejects.toThrow('Unsupported');
    await expect(
      validatePortableTransactions({
        ...archive,
        customerReceipts: [
          ...archive.customerReceipts,
          ...archive.customerReceipts,
        ],
      })
    ).rejects.toThrow('duplicate');
    await expect(
      validatePortableTransactions({
        ...archive,
        customerReceipts: [{ ...archive.customerReceipts[0], total: 1 }],
      })
    ).rejects.toThrow('invalid');
    const badPhoto = {
      ...archive,
      quotations: archive.quotations.map((q) => ({
        ...q,
        photos: {
          A: {
            uri: 'file:///secret.jpg',
            thumbnailUri: 'https://example.com/track.jpg',
          },
        },
      })),
    };
    await expect(validatePortableTransactions(badPhoto)).rejects.toThrow(
      'invalid'
    );
    const book = XLSX.read(
      transactionWorkbook(archive, JSON.stringify(archive)),
      { type: 'array' }
    );
    book.Sheets.TransactionArchive.A2.f = '1+1';
    expect(() =>
      readTransactionWorkbook(
        new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx' }))
      )
    ).toThrow('formulas');
    await expect(
      readPortableTransactions(new File(['SQLite format 3'], 'history.sqlite'))
    ).rejects.toThrow('JSON or Excel');
  });
  it('uses SGT date boundaries and keeps private report content escaped with separate cash and sale totals', async () => {
    const archive = await validatePortableTransactions(fixture),
      receipt = archive.customerReceipts[0];
    const entry = {
      receiptId: receipt.id,
      direction: 'debit' as const,
      amount: 9.5,
      date: '2026-11-01',
      notes: 'Adjustment',
      updatedAt: '2026-11-01T02:00:00Z',
    };
    expect(
      filterTransactionReceipts(
        { ...archive, transactionEntries: [entry] },
        {
          ...defaultTransactionFilters,
          from: '2026-11-01',
          to: '2026-11-01',
          dateBasis: 'movement',
        }
      )
    ).toHaveLength(1);
    expect(transactionSummary([receipt], [entry])).toMatchObject({
      debit: 9.5,
      credit: 0,
      net: -9.5,
      sales: 58,
      profit: 14,
    });
    const html = transactionFinancialHtml(
      [{ ...receipt, customerName: '<script>bad()</script>' }],
      [entry],
      '<date range>'
    );
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;date range&gt;');
    expect(html).toContain('PRIVATE OWNER REPORT');
  });
});
