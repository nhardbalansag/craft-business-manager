import type { PendingBrowserWorkbookSelection } from './BrowserWorkbookImportCommand';
import type {
  PersistenceCoordinator,
  PersistenceWorkbookApplyResult,
} from './PersistenceCoordinator';

export interface PublicGoogleSheetsFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type PublicGoogleSheetsFetch = (
  url: string,
) => Promise<PublicGoogleSheetsFetchResponse>;

export interface PublishedGoogleSheetSource {
  readonly publishedId: string;
  readonly sourceUrl: string;
  readonly exportUrl: string;
}

export interface PendingPublicGoogleSheetSelection extends PendingBrowserWorkbookSelection {
  readonly publishedId: string;
  readonly sourceUrl: string;
  readonly exportUrl: string;
}

export type PublicGoogleSheetsImportWorkflowErrorCode =
  | 'INVALID_PUBLISHED_GOOGLE_SHEETS_URL'
  | 'GOOGLE_SHEETS_FETCH_FAILED'
  | 'GOOGLE_SHEETS_HTTP_ERROR'
  | 'GOOGLE_SHEETS_RESPONSE_READ_FAILED'
  | 'GOOGLE_SHEETS_EMPTY_RESPONSE'
  | 'NO_PENDING_GOOGLE_SHEET';

export class PublicGoogleSheetsImportWorkflowError extends Error {
  readonly code: PublicGoogleSheetsImportWorkflowErrorCode;
  readonly causeValue: unknown;

  constructor(
    code: PublicGoogleSheetsImportWorkflowErrorCode,
    message: string,
    causeValue?: unknown,
  ) {
    super(message);
    this.name = 'PublicGoogleSheetsImportWorkflowError';
    this.code = code;
    this.causeValue = causeValue;
  }
}

type WorkbookImportTarget = Pick<PersistenceCoordinator, 'importAndApplyWorkbook'>;

interface OwnedPendingPublicGoogleSheet {
  readonly source: PublishedGoogleSheetSource;
  readonly bytes: Uint8Array;
}

function cloneBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}

function shortPublishedId(publishedId: string): string {
  const suffixLength = 10;
  return publishedId.length <= suffixLength
    ? publishedId
    : publishedId.slice(-suffixLength);
}

function selectionMetadata(
  pending: OwnedPendingPublicGoogleSheet,
): PendingPublicGoogleSheetSelection {
  return Object.freeze({
    name: `google-sheet-${shortPublishedId(pending.source.publishedId)}.xlsx`,
    byteLength: pending.bytes.byteLength,
    publishedId: pending.source.publishedId,
    sourceUrl: pending.source.sourceUrl,
    exportUrl: pending.source.exportUrl,
  });
}

/**
 * Parse only Google Sheets URLs produced by Publish to web.
 *
 * Standard `/spreadsheets/d/<id>/edit` sharing links are deliberately rejected in this first
 * integration. Public import must not depend on the browser's signed-in Google session or cookies.
 */
export function parsePublishedGoogleSheetUrl(value: string): PublishedGoogleSheetSource {
  const trimmed = value.trim();
  let url: URL;

  try {
    url = new URL(trimmed);
  } catch (error) {
    throw new PublicGoogleSheetsImportWorkflowError(
      'INVALID_PUBLISHED_GOOGLE_SHEETS_URL',
      'Paste a valid Google Sheets Published to the web URL.',
      error,
    );
  }

  if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com') {
    throw new PublicGoogleSheetsImportWorkflowError(
      'INVALID_PUBLISHED_GOOGLE_SHEETS_URL',
      'Use an https://docs.google.com Google Sheets Published to the web URL.',
    );
  }

  const match = url.pathname.match(
    /^\/spreadsheets\/d\/e\/([A-Za-z0-9_-]+)\/(pubhtml|pub)\/?$/,
  );
  if (match === null) {
    throw new PublicGoogleSheetsImportWorkflowError(
      'INVALID_PUBLISHED_GOOGLE_SHEETS_URL',
      'This first Google Sheets integration accepts Published to the web links only. In Google Sheets, publish the entire spreadsheet and paste the published URL.',
    );
  }

  const publishedId = match[1];
  const sourceUrl = `https://docs.google.com/spreadsheets/d/e/${publishedId}/pubhtml`;
  const exportUrl = `https://docs.google.com/spreadsheets/d/e/${publishedId}/pub?output=xlsx`;

  return Object.freeze({ publishedId, sourceUrl, exportUrl });
}

async function browserPublicGoogleSheetsFetch(
  url: string,
): Promise<PublicGoogleSheetsFetchResponse> {
  return fetch(url, {
    method: 'GET',
    credentials: 'omit',
    redirect: 'follow',
    cache: 'no-store',
  });
}

/**
 * Browser boundary for public Google Sheets snapshot import.
 *
 * Fetching a published sheet is non-destructive. The fetched XLSX bytes remain pending until the
 * caller explicitly applies them. Parsing, workbook compatibility, business validation, and
 * repository hydration remain owned by PersistenceCoordinator.
 */
export class PublicGoogleSheetsImportCommand {
  private pending: OwnedPendingPublicGoogleSheet | null = null;

  constructor(
    private readonly importTarget: WorkbookImportTarget,
    private readonly fetchPublishedSheet: PublicGoogleSheetsFetch = browserPublicGoogleSheetsFetch,
  ) {}

  getPendingSelection(): PendingPublicGoogleSheetSelection | null {
    return this.pending === null ? null : selectionMetadata(this.pending);
  }

  clearSelection(): void {
    this.pending = null;
  }

  async loadPublishedSheet(url: string): Promise<PendingPublicGoogleSheetSelection> {
    const source = parsePublishedGoogleSheetUrl(url);

    let response: PublicGoogleSheetsFetchResponse;
    try {
      response = await this.fetchPublishedSheet(source.exportUrl);
    } catch (error) {
      throw new PublicGoogleSheetsImportWorkflowError(
        'GOOGLE_SHEETS_FETCH_FAILED',
        'The published Google Sheet could not be fetched. Confirm that the entire spreadsheet is Published to the web and the published link is reachable.',
        error,
      );
    }

    if (!response.ok) {
      throw new PublicGoogleSheetsImportWorkflowError(
        'GOOGLE_SHEETS_HTTP_ERROR',
        `Google Sheets returned HTTP ${response.status}. Confirm that the entire spreadsheet is still Published to the web.`,
      );
    }

    let buffer: ArrayBuffer;
    try {
      buffer = await response.arrayBuffer();
    } catch (error) {
      throw new PublicGoogleSheetsImportWorkflowError(
        'GOOGLE_SHEETS_RESPONSE_READ_FAILED',
        'The published Google Sheet response could not be read.',
        error,
      );
    }

    const bytes = new Uint8Array(buffer);
    if (bytes.byteLength === 0) {
      throw new PublicGoogleSheetsImportWorkflowError(
        'GOOGLE_SHEETS_EMPTY_RESPONSE',
        'Google Sheets returned an empty workbook. Confirm that the entire spreadsheet is Published to the web.',
      );
    }

    this.pending = {
      source,
      bytes: cloneBytes(bytes),
    };

    return selectionMetadata(this.pending);
  }

  async applyPendingSelection(): Promise<PersistenceWorkbookApplyResult> {
    if (this.pending === null) {
      throw new PublicGoogleSheetsImportWorkflowError(
        'NO_PENDING_GOOGLE_SHEET',
        'Load a published Google Sheet before applying an import.',
      );
    }

    return this.importTarget.importAndApplyWorkbook(cloneBytes(this.pending.bytes));
  }
}
