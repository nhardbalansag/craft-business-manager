import type { PendingBrowserWorkbookSelection } from './BrowserWorkbookImportCommand';
import type { PersistenceCoordinator, PersistenceWorkbookApplyResult } from './PersistenceCoordinator';
import { getGoogleDriveApiKey } from './googleDriveImportPreferences';
import { getWorkbookImportMaxBytes, MEBIBYTE } from './workbookImportPreferences';

export interface GoogleDriveWorkbookSource {
  readonly fileId: string;
  readonly sourceUrl: string;
  readonly resourceKey?: string;
}

export interface PendingGoogleDriveWorkbook extends PendingBrowserWorkbookSelection, GoogleDriveWorkbookSource {
  readonly modifiedTime?: string;
}

export class GoogleDriveImportError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'GoogleDriveImportError';
  }
}

function fail(code: string, message: string): never { throw new GoogleDriveImportError(code, message); }

export function parseGoogleDriveWorkbookUrl(value: string): GoogleDriveWorkbookSource {
  let url: URL;
  try { url = new URL(value.trim()); } catch {
    return fail('INVALID_DRIVE_URL', 'Paste the Google Drive sharing link for an uploaded .xlsx file.');
  }
  if (url.protocol !== 'https:' || url.port || url.username || url.password ||
      !['drive.google.com', 'docs.google.com', 'drive.usercontent.google.com'].includes(url.hostname)) {
    return fail('INVALID_DRIVE_URL', 'Use an HTTPS Google Drive file sharing link.');
  }
  let fileId: string | undefined;
  if (url.hostname === 'drive.google.com' || url.hostname === 'docs.google.com') {
    fileId = url.pathname.match(/^\/file\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]+)(?:\/(?:view|edit|preview))?\/?$/)?.[1];
    if (!fileId && url.hostname === 'docs.google.com') {
      fileId = url.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]+)(?:\/(?:edit|view|preview))?\/?$/)?.[1];
    }
    if (!fileId && url.hostname === 'drive.google.com' && /^\/(?:open|uc)\/?$/.test(url.pathname)) {
      fileId = url.searchParams.get('id') ?? undefined;
    }
  } else if (url.pathname === '/download') {
    fileId = url.searchParams.get('id') ?? undefined;
  }
  const resourceKey = url.searchParams.get('resourcekey') ?? undefined;
  if (!fileId || !/^[A-Za-z0-9_-]{1,200}$/.test(fileId) ||
      (resourceKey !== undefined && !/^[A-Za-z0-9_-]{1,200}$/.test(resourceKey))) {
    return fail('INVALID_DRIVE_URL', 'Use a file link, not a folder or published Google Sheets link. Keep the file in Excel (.xlsx) format.');
  }
  const source = new URL(`https://drive.google.com/file/d/${fileId}/view`);
  if (resourceKey) source.searchParams.set('resourcekey', resourceKey);
  return Object.freeze({ fileId, resourceKey, sourceUrl: source.toString() });
}

interface DriveMetadata {
  readonly name: string;
  readonly mimeType: string;
  readonly size?: string;
  readonly modifiedTime?: string;
  readonly capabilities?: { readonly canDownload?: boolean };
}

export interface GoogleDriveImportOptions {
  readonly fetch?: typeof fetch;
  readonly apiKey?: () => string;
  readonly maxWorkbookBytes?: () => number;
  readonly timeoutMs?: number;
}

function sizeError(actual: number, maximum: number): never {
  return fail('WORKBOOK_BYTES_EXCEEDED', `Workbook is ${(actual / MEBIBYTE).toFixed(1)} MiB; the limit is ${maximum / MEBIBYTE} MiB. Increase Maximum workbook size in Workbook tools and fetch again.`);
}

async function checkResponse(response: Response): Promise<void> {
  if (response.ok) return;
  let reason = '';
  try {
    const body = await response.json() as { error?: { errors?: { reason?: string }[]; details?: { reason?: string }[] } };
    reason = [...(body.error?.errors ?? []), ...(body.error?.details ?? [])]
      .map((entry) => entry.reason ?? '').join(' ');
  } catch { /* Do not surface an HTML login page or a URL containing the API key. */ }
  if (response.status === 429 || /quota|rateLimit|dailyLimit/i.test(reason)) {
    return fail('DRIVE_QUOTA_EXCEEDED', 'Google Drive has temporarily limited downloads. Wait and fetch again. Your workspace is unchanged.');
  }
  if (/key|serviceDisabled|accessNotConfigured|SERVICE_DISABLED|SERVICE_BLOCKED|REFERRER/i.test(reason)) {
    return fail('DRIVE_API_SETUP_REQUIRED', 'Check the Google Drive browser API key: enable the Drive API and allow this website in its restrictions, then fetch again.');
  }
  if ([401, 403, 404].includes(response.status)) {
    return fail('DRIVE_FILE_NOT_ACCESSIBLE', `Google Drive returned HTTP ${response.status}. Set the file to Anyone with the link → Viewer, allow downloads, and check the browser API key setup.`);
  }
  return fail('DRIVE_HTTP_ERROR', `Google Drive returned HTTP ${response.status}. Try fetching the workbook again.`);
}

async function readWorkbook(response: Response, maximum: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maximum) {
    await response.body?.cancel();
    return sizeError(declared, maximum);
  }
  if (response.headers.get('content-type')?.toLowerCase().includes('text/html')) {
    await response.body?.cancel();
    return fail('DRIVE_NOT_XLSX', 'Google returned a web page instead of the Excel file. Check sharing and download access.');
  }
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maximum) return sizeError(bytes.byteLength, maximum);
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximum) {
        await reader.cancel();
        return sizeError(length, maximum);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

/** Downloads the original Drive blob; no Google Sheets conversion or third-party proxy. */
export class GoogleDriveWorkbookImportCommand {
  private pending: { selection: PendingGoogleDriveWorkbook; bytes: Uint8Array } | null = null;
  private loading = false;

  constructor(
    private readonly target: Pick<PersistenceCoordinator, 'importAndApplyWorkbook'>,
    private readonly options: GoogleDriveImportOptions = {},
  ) {}

  getPendingSelection(): PendingGoogleDriveWorkbook | null { return this.pending?.selection ?? null; }
  clearSelection(): void { this.pending = null; }

  async loadWorkbook(value: string): Promise<PendingGoogleDriveWorkbook> {
    if (this.loading) return fail('DRIVE_FETCH_IN_PROGRESS', 'Wait for the current Google Drive fetch to finish.');
    this.pending = null;
    const source = parseGoogleDriveWorkbookUrl(value);
    const apiKey = (this.options.apiKey ?? getGoogleDriveApiKey)().trim();
    if (!apiKey) return fail('DRIVE_API_SETUP_REQUIRED', 'Complete the one-time Google Drive API setup below, then paste your Excel file link and fetch it.');
    const maximum = (this.options.maxWorkbookBytes ?? getWorkbookImportMaxBytes)();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 120_000);
    this.loading = true;
    const fetcher = this.options.fetch ?? globalThis.fetch;
    const headers: Record<string, string> = {};
    if (source.resourceKey) headers['X-Goog-Drive-Resource-Keys'] = `${source.fileId}/${source.resourceKey}`;
    const url = new URL(`https://www.googleapis.com/drive/v3/files/${source.fileId}`);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('supportsAllDrives', 'true');
    const request: RequestInit = { method: 'GET', credentials: 'omit', cache: 'no-store',
      redirect: 'follow', signal: controller.signal, headers };
    try {
      url.searchParams.set('fields', 'name,mimeType,size,modifiedTime,capabilities(canDownload)');
      const metadataResponse = await fetcher(url.toString(), request);
      await checkResponse(metadataResponse);
      let metadata: DriveMetadata;
      try { metadata = await metadataResponse.json() as DriveMetadata; } catch {
        return fail('DRIVE_INVALID_METADATA', 'The Drive file information could not be read. Fetch the file again.');
      }
      if (!metadata || typeof metadata.name !== 'string' || !/\.xlsx$/i.test(metadata.name) ||
          typeof metadata.mimeType !== 'string' || metadata.mimeType.startsWith('application/vnd.google-apps.')) {
        return fail('DRIVE_NOT_XLSX', 'Choose an uploaded Excel (.xlsx) file. Native Google Sheets, folders, shortcuts, and other file types cannot use this import.');
      }
      if (metadata.capabilities?.canDownload === false) {
        return fail('DRIVE_DOWNLOAD_DISABLED', 'The file owner has disabled downloads. Allow viewers to download the Excel file, then fetch again.');
      }
      const expectedSize = metadata.size && /^\d+$/.test(metadata.size) ? Number(metadata.size) : undefined;
      if (expectedSize !== undefined && expectedSize > maximum) return sizeError(expectedSize, maximum);
      url.searchParams.delete('fields');
      url.searchParams.set('alt', 'media');
      const response = await fetcher(url.toString(), request);
      await checkResponse(response);
      const bytes = await readWorkbook(response, maximum);
      if (bytes.byteLength === 0) return fail('DRIVE_EMPTY_FILE', 'Google Drive returned an empty Excel file.');
      if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 3 || bytes[3] !== 4) {
        return fail('DRIVE_NOT_XLSX', 'The download is not an XLSX workbook. Check that the link points to the original Excel file.');
      }
      if (expectedSize !== undefined && bytes.byteLength !== expectedSize) {
        return fail('DRIVE_FILE_CHANGED', 'The file size changed while fetching. Fetch again to get a complete, current snapshot.');
      }
      const selection = Object.freeze({ ...source, name: metadata.name, byteLength: bytes.byteLength,
        modifiedTime: typeof metadata.modifiedTime === 'string' ? metadata.modifiedTime : undefined });
      this.pending = { selection, bytes };
      return selection;
    } catch (error) {
      if (error instanceof GoogleDriveImportError) throw error;
      if (controller.signal.aborted) return fail('DRIVE_FETCH_TIMEOUT', 'The Google Drive request timed out. Check your connection and fetch again.');
      return fail('DRIVE_FETCH_FAILED', 'The Excel file could not be fetched from Google Drive. Check your connection, file sharing, and one-time Drive API setup.');
    } finally {
      clearTimeout(timer);
      this.loading = false;
    }
  }

  async applyPendingSelection(): Promise<PersistenceWorkbookApplyResult> {
    if (!this.pending) return fail('NO_PENDING_DRIVE_WORKBOOK', 'Fetch an Excel file from Google Drive before applying the import.');
    return this.target.importAndApplyWorkbook(new Uint8Array(this.pending.bytes));
  }
}
