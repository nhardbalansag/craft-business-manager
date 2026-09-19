import { describe, expect, it, vi } from 'vitest';
import {
  PublicGoogleSheetsImportCommand,
  PublicGoogleSheetsImportWorkflowError,
  parsePublishedGoogleSheetUrl,
  type PublicGoogleSheetsFetch,
} from './PublicGoogleSheetsImportCommand';
import type { PersistenceWorkbookApplyResult } from './PersistenceCoordinator';

const publishedId = '2PACX-1vExamplePublishedSpreadsheet1234567890';
const publishedUrl = `https://docs.google.com/spreadsheets/d/e/${publishedId}/pubhtml?gid=0&single=true`;
const exportUrl = `https://docs.google.com/spreadsheets/d/e/${publishedId}/pub?output=xlsx`;

const hydrated: PersistenceWorkbookApplyResult = {
  status: 'hydrated',
  metadata: {
    formatId: 'craft-business-manager',
    workbookFormatVersion: 1,
    datasetSchemaVersion: 1,
    exportedAt: '2026-09-17T00:00:00.000Z',
  },
};

function exactArrayBuffer(values: readonly number[]): ArrayBuffer {
  const buffer = new ArrayBuffer(values.length);
  new Uint8Array(buffer).set(values);
  return buffer;
}

function response(
  bytes: readonly number[] = [1, 2, 3, 4],
  options: { ok?: boolean; status?: number; readError?: Error } = {},
) {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    arrayBuffer: vi.fn(async () => {
      if (options.readError) throw options.readError;
      return exactArrayBuffer(bytes);
    }),
  };
}

describe('parsePublishedGoogleSheetUrl', () => {
  it('normalizes pubhtml and published pub links to an XLSX export URL', () => {
    expect(parsePublishedGoogleSheetUrl(publishedUrl)).toEqual({
      publishedId,
      sourceUrl: `https://docs.google.com/spreadsheets/d/e/${publishedId}/pubhtml`,
      exportUrl,
    });

    expect(
      parsePublishedGoogleSheetUrl(
        `https://docs.google.com/spreadsheets/d/e/${publishedId}/pub?output=html&gid=123`,
      ),
    ).toEqual({
      publishedId,
      sourceUrl: `https://docs.google.com/spreadsheets/d/e/${publishedId}/pubhtml`,
      exportUrl,
    });
  });

  it('rejects ordinary sharing/edit links so public import never depends on Google session cookies', () => {
    expect(() =>
      parsePublishedGoogleSheetUrl(
        'https://docs.google.com/spreadsheets/d/ordinary-sheet-id/edit?usp=sharing',
      ),
    ).toThrow(PublicGoogleSheetsImportWorkflowError);

    try {
      parsePublishedGoogleSheetUrl(
        'https://docs.google.com/spreadsheets/d/ordinary-sheet-id/edit?usp=sharing',
      );
    } catch (error) {
      expect(error).toMatchObject({ code: 'INVALID_PUBLISHED_GOOGLE_SHEETS_URL' });
    }
  });

  it('rejects non-Google hosts and non-HTTPS links', () => {
    for (const value of [
      `https://example.com/spreadsheets/d/e/${publishedId}/pubhtml`,
      `http://docs.google.com/spreadsheets/d/e/${publishedId}/pubhtml`,
      'not a url',
    ]) {
      expect(() => parsePublishedGoogleSheetUrl(value)).toThrow(
        PublicGoogleSheetsImportWorkflowError,
      );
    }
  });
});

describe('PublicGoogleSheetsImportCommand', () => {
  it('fetches the normalized published XLSX snapshot but does not hydrate until explicitly applied', async () => {
    const fetchPublishedSheet = vi.fn<PublicGoogleSheetsFetch>(async () => response([7, 8, 9]));
    const importAndApplyWorkbook = vi.fn<
      (bytes: Uint8Array) => Promise<PersistenceWorkbookApplyResult>
    >(async () => hydrated);
    const command = new PublicGoogleSheetsImportCommand(
      { importAndApplyWorkbook },
      fetchPublishedSheet,
    );

    const selection = await command.loadPublishedSheet(publishedUrl);

    expect(fetchPublishedSheet).toHaveBeenCalledWith(exportUrl);
    expect(importAndApplyWorkbook).not.toHaveBeenCalled();
    expect(selection.byteLength).toBe(3);
    expect(selection.publishedId).toBe(publishedId);
    expect(selection.sourceUrl).toContain('/pubhtml');
    expect(selection.exportUrl).toBe(exportUrl);
    expect(selection.name).toMatch(/^google-sheet-.+\.xlsx$/);

    const result = await command.applyPendingSelection();
    expect(result).toBe(hydrated);
    expect(importAndApplyWorkbook).toHaveBeenCalledOnce();
    expect(Array.from(importAndApplyWorkbook.mock.calls[0][0])).toEqual([7, 8, 9]);
  });

  it('clears pending public Google Sheet evidence explicitly', async () => {
    const command = new PublicGoogleSheetsImportCommand(
      { importAndApplyWorkbook: vi.fn(async () => hydrated) },
      vi.fn<PublicGoogleSheetsFetch>(async () => response()),
    );

    await command.loadPublishedSheet(publishedUrl);
    expect(command.getPendingSelection()).not.toBeNull();
    command.clearSelection();
    expect(command.getPendingSelection()).toBeNull();
    await expect(command.applyPendingSelection()).rejects.toMatchObject({
      code: 'NO_PENDING_GOOGLE_SHEET',
    });
  });

  it('reports network, HTTP, response-read, and empty-response failures without creating pending state', async () => {
    const scenarios: Array<{
      fetcher: PublicGoogleSheetsFetch;
      code: string;
    }> = [
      {
        fetcher: vi.fn(async () => {
          throw new TypeError('network blocked');
        }),
        code: 'GOOGLE_SHEETS_FETCH_FAILED',
      },
      {
        fetcher: vi.fn(async () => response([], { ok: false, status: 404 })),
        code: 'GOOGLE_SHEETS_HTTP_ERROR',
      },
      {
        fetcher: vi.fn(async () => response([], { readError: new Error('read failed') })),
        code: 'GOOGLE_SHEETS_RESPONSE_READ_FAILED',
      },
      {
        fetcher: vi.fn(async () => response([])),
        code: 'GOOGLE_SHEETS_EMPTY_RESPONSE',
      },
    ];

    for (const scenario of scenarios) {
      const command = new PublicGoogleSheetsImportCommand(
        { importAndApplyWorkbook: vi.fn(async () => hydrated) },
        scenario.fetcher,
      );
      await expect(command.loadPublishedSheet(publishedUrl)).rejects.toMatchObject({
        code: scenario.code,
      });
      expect(command.getPendingSelection()).toBeNull();
    }
  });

  it('replaces an earlier pending snapshot only after a later fetch succeeds', async () => {
    const fetcher = vi
      .fn<PublicGoogleSheetsFetch>()
      .mockResolvedValueOnce(response([1, 2]))
      .mockRejectedValueOnce(new Error('second fetch failed'));
    const command = new PublicGoogleSheetsImportCommand(
      { importAndApplyWorkbook: vi.fn(async () => hydrated) },
      fetcher,
    );

    const first = await command.loadPublishedSheet(publishedUrl);
    await expect(command.loadPublishedSheet(publishedUrl)).rejects.toMatchObject({
      code: 'GOOGLE_SHEETS_FETCH_FAILED',
    });

    expect(command.getPendingSelection()).toEqual(first);
  });
});
