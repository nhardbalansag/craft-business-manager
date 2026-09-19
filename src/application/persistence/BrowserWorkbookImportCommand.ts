import type {
  PersistenceCoordinator,
  PersistenceWorkbookApplyResult,
} from './PersistenceCoordinator';

export interface BrowserWorkbookFileInput {
  readonly name: string;
  readonly size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface PendingBrowserWorkbookSelection {
  readonly name: string;
  readonly byteLength: number;
}

export type BrowserWorkbookSelectionResult =
  | {
      readonly status: 'selected';
      readonly selection: PendingBrowserWorkbookSelection;
    }
  | {
      readonly status: 'cancelled';
      readonly selection: PendingBrowserWorkbookSelection | null;
    };

export type BrowserWorkbookImportWorkflowErrorCode =
  | 'UNSUPPORTED_FILE_EXTENSION'
  | 'FILE_READ_FAILED'
  | 'NO_PENDING_WORKBOOK';

export class BrowserWorkbookImportWorkflowError extends Error {
  readonly code: BrowserWorkbookImportWorkflowErrorCode;
  readonly causeValue: unknown;

  constructor(
    code: BrowserWorkbookImportWorkflowErrorCode,
    message: string,
    causeValue?: unknown,
  ) {
    super(message);
    this.name = 'BrowserWorkbookImportWorkflowError';
    this.code = code;
    this.causeValue = causeValue;
  }
}

type WorkbookImportTarget = Pick<PersistenceCoordinator, 'importAndApplyWorkbook'>;

interface OwnedPendingWorkbook {
  readonly name: string;
  readonly bytes: Uint8Array;
}

function cloneBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}

function selectionMetadata(pending: OwnedPendingWorkbook): PendingBrowserWorkbookSelection {
  return Object.freeze({
    name: pending.name,
    byteLength: pending.bytes.byteLength,
  });
}

function hasXlsxExtension(fileName: string): boolean {
  return fileName.trim().toLocaleLowerCase().endsWith('.xlsx');
}

/**
 * Browser-facing Phase 5.5A1 boundary for selecting workbook bytes and explicitly applying them.
 *
 * Selection is intentionally non-destructive. This class never parses workbook sheets, validates
 * business records, hydrates repositories, or performs native filesystem work. Applying a pending
 * selection delegates to the existing PersistenceCoordinator, which remains the authoritative
 * import/validation/hydration lifecycle.
 */
export class BrowserWorkbookImportCommand {
  private pending: OwnedPendingWorkbook | null = null;

  constructor(private readonly importTarget: WorkbookImportTarget) {}

  getPendingSelection(): PendingBrowserWorkbookSelection | null {
    return this.pending === null ? null : selectionMetadata(this.pending);
  }

  clearSelection(): void {
    this.pending = null;
  }

  async selectFile(
    file: BrowserWorkbookFileInput | null | undefined,
  ): Promise<BrowserWorkbookSelectionResult> {
    if (file === null || file === undefined) {
      return {
        status: 'cancelled',
        selection: this.getPendingSelection(),
      };
    }

    if (!hasXlsxExtension(file.name)) {
      throw new BrowserWorkbookImportWorkflowError(
        'UNSUPPORTED_FILE_EXTENSION',
        'Select a .xlsx workbook file.',
      );
    }

    let buffer: ArrayBuffer;
    try {
      buffer = await file.arrayBuffer();
    } catch (error) {
      throw new BrowserWorkbookImportWorkflowError(
        'FILE_READ_FAILED',
        'The selected workbook could not be read.',
        error,
      );
    }

    const ownedBytes = cloneBytes(new Uint8Array(buffer));
    this.pending = {
      name: file.name,
      bytes: ownedBytes,
    };

    return {
      status: 'selected',
      selection: selectionMetadata(this.pending),
    };
  }

  async applyPendingSelection(): Promise<PersistenceWorkbookApplyResult> {
    if (this.pending === null) {
      throw new BrowserWorkbookImportWorkflowError(
        'NO_PENDING_WORKBOOK',
        'Select a workbook before applying an import.',
      );
    }

    return this.importTarget.importAndApplyWorkbook(cloneBytes(this.pending.bytes));
  }
}
