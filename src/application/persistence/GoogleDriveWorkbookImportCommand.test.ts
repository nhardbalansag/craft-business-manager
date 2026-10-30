import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoogleDriveWorkbookImportCommand, parseGoogleDriveWorkbookUrl } from './GoogleDriveWorkbookImportCommand';
import { createEmptyBusinessDatasetV2 } from '../../domain/businessDatasetV2';
import { extendBusinessDatasetV2 } from '../../domain/physicalBusinessDatasetV3';
import { extendPhysicalBusinessDatasetV3 } from '../../domain/physicalBusinessDatasetV4';
import { extendPhysicalBusinessDatasetV4 } from '../../domain/physicalBusinessDatasetV5';
import { exportPhysicalBusinessDatasetV5ToXlsx } from '../../storage/physicalBusinessDatasetV5Workbook';
import { SheetJsWorkbookCodec } from '../../storage/sheetJsWorkbookCodec';
import { PersistenceCoordinator, type PersistenceWorkbookApplyResult } from './PersistenceCoordinator';

const fileId = 'UploadedExcelFile_123456789';
const link = `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
const key = 'test-browser-key-123456789';
const bytes = new Uint8Array([0x50, 0x4b, 3, 4, 1, 2, 3]);
const metadata = { name: 'craft.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  size: String(bytes.byteLength), capabilities: { canDownload: true } };
const hydrated: PersistenceWorkbookApplyResult = { status: 'hydrated', metadata: {
  formatId: 'craft-business-manager', workbookFormatVersion: 5, datasetSchemaVersion: 5,
  exportedAt: '2026-10-30T00:00:00.000Z',
} };

function binary(value: Uint8Array = bytes, headers: Record<string, string> = {}) {
  return new Response(new Uint8Array(value).buffer, { headers });
}

function setup() {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(metadata)).mockResolvedValueOnce(binary());
  const apply = vi.fn(async (_input: Uint8Array | ArrayBuffer) => hydrated);
  const command = new GoogleDriveWorkbookImportCommand({ importAndApplyWorkbook: apply }, { fetch: fetcher, apiKey: () => key });
  return { fetcher, apply, command };
}

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Google Drive Excel link parsing', () => {
  it.each([
    link,
    `https://drive.google.com/open?id=${fileId}`,
    `https://drive.google.com/uc?export=download&id=${fileId}`,
    `https://drive.google.com/file/u/0/d/${fileId}/view`,
    `https://docs.google.com/spreadsheets/d/${fileId}/edit?usp=sharing`,
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download`,
  ])('normalizes supported file links: %s', (value) => {
    expect(parseGoogleDriveWorkbookUrl(value)).toMatchObject({ fileId,
      sourceUrl: `https://drive.google.com/file/d/${fileId}/view` });
  });

  it('preserves a resource key required for link-shared files', () => {
    expect(parseGoogleDriveWorkbookUrl(`${link}&resourcekey=0-shared_key`)).toMatchObject({
      resourceKey: '0-shared_key', sourceUrl: `https://drive.google.com/file/d/${fileId}/view?resourcekey=0-shared_key`,
    });
  });

  it.each(['not a URL', `http://drive.google.com/file/d/${fileId}/view`,
    `https://drive.google.com.evil.test/file/d/${fileId}/view`,
    `https://user:password@drive.google.com/file/d/${fileId}/view`,
    `https://drive.google.com:444/file/d/${fileId}/view`,
    `https://drive.google.com/drive/folders/${fileId}`,
    'https://docs.google.com/spreadsheets/d/e/2PACX-published/pubhtml',
    'https://drive.google.com/uc?id=..%2Fprivate',
    `${link}&resourcekey=invalid%2Fkey`,
  ])('rejects unrelated or unsupported URLs: %s', (value) => {
    expect(() => parseGoogleDriveWorkbookUrl(value)).toThrow();
  });
});

describe('GoogleDriveWorkbookImportCommand', () => {
  it('downloads the original bytes with metadata and resource-key support, then applies only on request', async () => {
    const { fetcher, apply, command } = setup();
    const selection = await command.loadWorkbook(`${link}&resourcekey=0-key`);
    expect(selection).toMatchObject({ name: 'craft.xlsx', byteLength: bytes.length, fileId });
    expect(JSON.stringify(selection)).not.toContain(key);
    expect(apply).not.toHaveBeenCalled();
    const [metadataUrl, request] = fetcher.mock.calls[0];
    expect(new URL(String(metadataUrl)).origin).toBe('https://www.googleapis.com');
    expect(new URL(String(metadataUrl)).searchParams.get('fields')).toContain('mimeType');
    expect(request).toMatchObject({ credentials: 'omit', cache: 'no-store',
      headers: { 'X-Goog-Drive-Resource-Keys': `${fileId}/0-key` } });
    expect(new URL(String(fetcher.mock.calls[1][0])).searchParams.get('alt')).toBe('media');
    expect(await command.applyPendingSelection()).toEqual(hydrated);
    expect(apply.mock.calls[0][0]).toEqual(bytes);
    command.clearSelection();
    await expect(command.applyPendingSelection()).rejects.toMatchObject({ code: 'NO_PENDING_DRIVE_WORKBOOK' });
  });

  it('requires setup before making any request', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const command = new GoogleDriveWorkbookImportCommand({ importAndApplyWorkbook: vi.fn() }, { fetch: fetcher, apiKey: () => '' });
    await expect(command.loadWorkbook(link)).rejects.toMatchObject({ code: 'DRIVE_API_SETUP_REQUIRED' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    [{ name: 'sheet.xlsx', mimeType: 'application/vnd.google-apps.spreadsheet' }, 'DRIVE_NOT_XLSX'],
    [{ ...metadata, name: 'workbook.xls' }, 'DRIVE_NOT_XLSX'],
    [{ ...metadata, capabilities: { canDownload: false } }, 'DRIVE_DOWNLOAD_DISABLED'],
    [{ ...metadata, size: '54594185' }, 'WORKBOOK_BYTES_EXCEEDED'],
  ])('rejects metadata that cannot be imported without downloading the file', async (value, code) => {
    const { fetcher, command } = setup();
    fetcher.mockReset().mockResolvedValueOnce(Response.json(value));
    const guarded = new GoogleDriveWorkbookImportCommand({ importAndApplyWorkbook: vi.fn() }, {
      fetch: fetcher, apiKey: () => key, maxWorkbookBytes: () => 48 * 1024 * 1024,
    });
    await expect(guarded.loadWorkbook(link)).rejects.toMatchObject({ code });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(command.getPendingSelection()).toBeNull();
  });

  it.each([
    [404, {}, 'DRIVE_FILE_NOT_ACCESSIBLE'],
    [403, { error: { details: [{ reason: 'API_KEY_HTTP_REFERRER_BLOCKED' }] } }, 'DRIVE_API_SETUP_REQUIRED'],
    [400, { error: { errors: [{ reason: 'badRequest' }], details: [{ reason: 'API_KEY_INVALID' }] } }, 'DRIVE_API_SETUP_REQUIRED'],
    [403, { error: { errors: [{ reason: 'downloadQuotaExceeded' }] } }, 'DRIVE_QUOTA_EXCEEDED'],
    [429, {}, 'DRIVE_QUOTA_EXCEEDED'],
    [500, {}, 'DRIVE_HTTP_ERROR'],
  ])('gives actionable feedback for HTTP %s', async (status, body, code) => {
    const { fetcher, apply, command } = setup();
    fetcher.mockReset().mockResolvedValue(Response.json(body, { status }));
    await expect(command.loadWorkbook(link)).rejects.toMatchObject({ code });
    expect(apply).not.toHaveBeenCalled();
  });

  it.each([
    [new Response('<html>sign in</html>', { headers: { 'content-type': 'text/html' } }), 'DRIVE_NOT_XLSX'],
    [binary(new Uint8Array()), 'DRIVE_EMPTY_FILE'],
    [binary(new Uint8Array([1, 2, 3, 4])), 'DRIVE_NOT_XLSX'],
    [binary(new Uint8Array([...bytes, 8])), 'DRIVE_FILE_CHANGED'],
  ])('rejects HTML, empty, invalid, or incomplete downloads', async (response, code) => {
    const { fetcher, command } = setup();
    fetcher.mockReset().mockResolvedValueOnce(Response.json(metadata)).mockResolvedValueOnce(response);
    await expect(command.loadWorkbook(link)).rejects.toMatchObject({ code });
    expect(command.getPendingSelection()).toBeNull();
  });

  it('cancels downloads that exceed the byte limit while streaming', async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(6)); },
      cancel() { cancelled = true; } });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ ...metadata, size: undefined }))
      .mockResolvedValueOnce(new Response(stream));
    const command = new GoogleDriveWorkbookImportCommand({ importAndApplyWorkbook: vi.fn() }, {
      fetch: fetcher, apiKey: () => key, maxWorkbookBytes: () => 5,
    });
    await expect(command.loadWorkbook(link)).rejects.toMatchObject({ code: 'WORKBOOK_BYTES_EXCEEDED' });
    expect(cancelled).toBe(true);
  });

  it('clears an old pending file when a later fetch fails and never exposes key-bearing network errors', async () => {
    const { fetcher, apply, command } = setup();
    await command.loadWorkbook(link);
    fetcher.mockRejectedValueOnce(new Error(`network error https://www.googleapis.com/?key=${key}`));
    await expect(command.loadWorkbook(link)).rejects.toMatchObject({ code: 'DRIVE_FETCH_FAILED' });
    expect(command.getPendingSelection()).toBeNull();
    await expect(command.applyPendingSelection()).rejects.toMatchObject({ code: 'NO_PENDING_DRIVE_WORKBOOK' });
    expect(apply).not.toHaveBeenCalled();
  });

  it('times out a stalled request', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    const command = new GoogleDriveWorkbookImportCommand({ importAndApplyWorkbook: vi.fn() }, {
      fetch: fetcher, apiKey: () => key, timeoutMs: 5,
    });
    const assertion = expect(command.loadWorkbook(link)).rejects.toMatchObject({ code: 'DRIVE_FETCH_TIMEOUT' });
    await vi.advanceTimersByTimeAsync(6);
    await assertion;
  });

  it('passes a real current XLSX through normal validation and preserves photos and all source collections', async () => {
    const dataset = extendPhysicalBusinessDatasetV4(extendPhysicalBusinessDatasetV3(
      extendBusinessDatasetV2(createEmptyBusinessDatasetV2()),
    ));
    dataset.products.push({ id: 'DRIVE-PHOTO', name: 'Excel product', category: 'paintable-art',
      isActive: true, safetyWasteRate: 0, imageDataUrl: 'data:image/jpeg;base64,AAAA',
      brochureImageDataUrl: `data:image/jpeg;base64,${'A'.repeat(40_000)}` });
    const codec = new SheetJsWorkbookCodec();
    const workbook = exportPhysicalBusinessDatasetV5ToXlsx(dataset, { exportedAt: '2026-10-30T00:00:00.000Z' }, codec);
    const hydrate = vi.fn(async () => ({ status: 'hydrated' as const }));
    const coordinator = new PersistenceCoordinator({ snapshot: vi.fn(), physicalIdentification: true,
      tieredPricing: true, plasterMoldYieldProfiles: true, yieldMoldFormulaSources: true }, { hydrate }, codec);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ ...metadata, size: String(workbook.byteLength) }))
      .mockResolvedValueOnce(binary(workbook));
    const command = new GoogleDriveWorkbookImportCommand(coordinator, { fetch: fetcher, apiKey: () => key });
    await command.loadWorkbook(link);
    expect(hydrate).not.toHaveBeenCalled();
    expect(await command.applyPendingSelection()).toMatchObject({ status: 'hydrated' });
    expect(hydrate).toHaveBeenCalledWith(dataset);
  });
});
