import type {
  PersistenceCoordinator,
  PersistenceWorkbookExported,
} from './PersistenceCoordinator';

export const XLSX_WORKBOOK_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export type BrowserWorkbookExportWorkflowErrorCode =
  | 'DOWNLOAD_PREPARATION_FAILED'
  | 'DOWNLOAD_DISPATCH_FAILED'
  | 'DOWNLOAD_CLEANUP_FAILED';

export class BrowserWorkbookExportWorkflowError extends Error {
  readonly code: BrowserWorkbookExportWorkflowErrorCode;
  readonly causeValue: unknown;
  readonly cleanupCauseValue: unknown;

  constructor(
    code: BrowserWorkbookExportWorkflowErrorCode,
    message: string,
    causeValue?: unknown,
    cleanupCauseValue?: unknown,
  ) {
    super(message);
    this.name = 'BrowserWorkbookExportWorkflowError';
    this.code = code;
    this.causeValue = causeValue;
    this.cleanupCauseValue = cleanupCauseValue;
  }
}

export type BrowserWorkbookExportClock = () => Date;

type WorkbookExportTarget = Pick<PersistenceCoordinator, 'exportCurrentWorkbook'>;

export interface BrowserWorkbookDownloadAdapter {
  createBlob(bytes: Uint8Array, mimeType: string): Blob;
  createObjectUrl(blob: Blob): string;
  dispatchDownload(objectUrl: string, fileName: string): void;
  revokeObjectUrl(objectUrl: string): void;
}

export interface BrowserWorkbookExportCommandOptions {
  readonly clock?: BrowserWorkbookExportClock;
  readonly downloadAdapter?: BrowserWorkbookDownloadAdapter;
}

export interface BrowserWorkbookExportResult {
  readonly status: 'download-dispatched';
  readonly fileName: string;
  readonly byteLength: number;
  readonly mimeType: typeof XLSX_WORKBOOK_MIME_TYPE;
  readonly metadata: PersistenceWorkbookExported['metadata'];
}

function cloneBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}

function systemClock(): Date {
  return new Date();
}

function padTwoDigits(value: number): string {
  return value.toString().padStart(2, '0');
}

/**
 * Build deterministic browser download guidance from a clock value.
 *
 * UTC fields are intentional so the same injected instant produces the same filename regardless of
 * the machine running the tests or application. The filename is guidance for a downloaded copy;
 * it is never treated as a native filesystem path.
 */
export function createBrowserWorkbookDownloadFilename(now: Date): string {
  if (Number.isNaN(now.getTime())) {
    throw new RangeError('Cannot create a workbook download filename from an invalid date.');
  }

  const date = [
    now.getUTCFullYear().toString().padStart(4, '0'),
    padTwoDigits(now.getUTCMonth() + 1),
    padTwoDigits(now.getUTCDate()),
  ].join('-');
  const time = [
    padTwoDigits(now.getUTCHours()),
    padTwoDigits(now.getUTCMinutes()),
    padTwoDigits(now.getUTCSeconds()),
  ].join('');

  return `craft-business-manager-${date}-${time}.xlsx`;
}

function createDefaultBrowserWorkbookDownloadAdapter(): BrowserWorkbookDownloadAdapter {
  return {
    createBlob(bytes, mimeType) {
      const owned = cloneBytes(bytes);
      const buffer = owned.buffer.slice(
        owned.byteOffset,
        owned.byteOffset + owned.byteLength,
      ) as ArrayBuffer;
      return new Blob([buffer], { type: mimeType });
    },
    createObjectUrl(blob) {
      return URL.createObjectURL(blob);
    },
    dispatchDownload(objectUrl, fileName) {
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = fileName;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);

      try {
        anchor.click();
      } finally {
        anchor.remove();
      }
    },
    revokeObjectUrl(objectUrl) {
      URL.revokeObjectURL(objectUrl);
    },
  };
}

/**
 * Browser-facing Phase 5.5B1 boundary for explicitly exporting and downloading the current workbook.
 *
 * This class never enumerates repositories, constructs workbook sheets, encodes XLSX directly,
 * invokes WorkbookTransport, or claims native save/backup/atomic-replacement semantics. Canonical
 * workbook bytes come only from PersistenceCoordinator.exportCurrentWorkbook().
 */
export class BrowserWorkbookExportCommand {
  private readonly clock: BrowserWorkbookExportClock;
  private readonly downloadAdapter: BrowserWorkbookDownloadAdapter;

  constructor(
    private readonly exportTarget: WorkbookExportTarget,
    options: BrowserWorkbookExportCommandOptions = {},
  ) {
    this.clock = options.clock ?? systemClock;
    this.downloadAdapter =
      options.downloadAdapter ?? createDefaultBrowserWorkbookDownloadAdapter();
  }

  async exportAndDownload(): Promise<BrowserWorkbookExportResult> {
    // Coordinator snapshot/export failures intentionally retain their existing operational meaning.
    const exported = await this.exportTarget.exportCurrentWorkbook();
    const ownedBytes = cloneBytes(exported.bytes);

    let fileName: string;
    let objectUrl: string;

    try {
      fileName = createBrowserWorkbookDownloadFilename(this.clock());
      const blob = this.downloadAdapter.createBlob(
        cloneBytes(ownedBytes),
        XLSX_WORKBOOK_MIME_TYPE,
      );
      objectUrl = this.downloadAdapter.createObjectUrl(blob);
    } catch (error) {
      throw new BrowserWorkbookExportWorkflowError(
        'DOWNLOAD_PREPARATION_FAILED',
        'The workbook was exported, but the browser download could not be prepared.',
        error,
      );
    }

    let dispatchFailed = false;
    let dispatchError: unknown;
    let cleanupFailed = false;
    let cleanupError: unknown;

    try {
      this.downloadAdapter.dispatchDownload(objectUrl, fileName);
    } catch (error) {
      dispatchFailed = true;
      dispatchError = error;
    } finally {
      try {
        this.downloadAdapter.revokeObjectUrl(objectUrl);
      } catch (error) {
        cleanupFailed = true;
        cleanupError = error;
      }
    }

    if (dispatchFailed) {
      throw new BrowserWorkbookExportWorkflowError(
        'DOWNLOAD_DISPATCH_FAILED',
        'The workbook was exported, but the browser download could not be started.',
        dispatchError,
        cleanupFailed ? cleanupError : undefined,
      );
    }

    if (cleanupFailed) {
      throw new BrowserWorkbookExportWorkflowError(
        'DOWNLOAD_CLEANUP_FAILED',
        'The workbook download was started, but its temporary browser resource could not be cleaned up.',
        cleanupError,
      );
    }

    return Object.freeze({
      status: 'download-dispatched' as const,
      fileName,
      byteLength: ownedBytes.byteLength,
      mimeType: XLSX_WORKBOOK_MIME_TYPE,
      metadata: Object.freeze({ ...exported.metadata }),
    });
  }
}
