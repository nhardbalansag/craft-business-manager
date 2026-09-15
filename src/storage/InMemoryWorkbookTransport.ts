import type { WorkbookBinaryInput } from './workbookCodec';
import {
  cloneWorkbookBytes,
  type WorkbookSaveOptions,
  type WorkbookSaveReceipt,
  type WorkbookTransport,
} from './WorkbookTransport';

export type InMemoryWorkbookTransportErrorCode = 'NO_WORKBOOK_AVAILABLE';

export class InMemoryWorkbookTransportError extends Error {
  readonly code: InMemoryWorkbookTransportErrorCode;

  constructor(code: InMemoryWorkbookTransportErrorCode, message: string) {
    super(message);
    this.name = 'InMemoryWorkbookTransportError';
    this.code = code;
  }
}

/**
 * Minimal byte transport used by persistence integration tests and non-native composition.
 *
 * It deliberately reports backup requests as unsupported. Backup creation and replacement
 * semantics belong to Phase 5.4B.
 */
export class InMemoryWorkbookTransport implements WorkbookTransport {
  private bytes?: Uint8Array;

  constructor(initialBytes?: WorkbookBinaryInput) {
    if (initialBytes !== undefined) this.bytes = cloneWorkbookBytes(initialBytes);
  }

  async loadWorkbook(): Promise<Uint8Array> {
    if (!this.bytes) {
      throw new InMemoryWorkbookTransportError(
        'NO_WORKBOOK_AVAILABLE',
        'No workbook bytes are available in the in-memory transport.',
      );
    }

    return new Uint8Array(this.bytes);
  }

  async saveWorkbook(
    bytes: Uint8Array,
    options: WorkbookSaveOptions = {},
  ): Promise<WorkbookSaveReceipt> {
    this.bytes = new Uint8Array(bytes);

    return {
      reference: 'memory://workbook',
      backup:
        options.backup === 'if-supported'
          ? { status: 'unsupported' }
          : { status: 'not-requested' },
    };
  }
}
