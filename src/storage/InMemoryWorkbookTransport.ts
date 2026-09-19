import type { WorkbookBinaryInput } from './workbookCodec';
import {
  cloneWorkbookBytes,
  createWorkbookTransportCapabilities,
  WorkbookTransportSaveError,
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
 * This simple transport intentionally remains a direct/non-atomic replacement transport in B1.
 * Backup creation, staging, and logical atomic commit are introduced by the B2 reference transport.
 */
export class InMemoryWorkbookTransport implements WorkbookTransport {
  readonly capabilities = createWorkbookTransportCapabilities({
    backup: 'unsupported',
    stagedReplacement: false,
    replacement: 'direct-non-atomic',
  });

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
    if (options.backup === 'required') {
      throw new WorkbookTransportSaveError(
        'capability',
        'REQUIRED_BACKUP_UNSUPPORTED',
        'not-committed',
        'This workbook transport does not support the required backup policy.',
      );
    }

    this.bytes = new Uint8Array(bytes);

    return {
      reference: 'memory://workbook',
      backup:
        options.backup === 'if-supported'
          ? { status: 'unsupported' }
          : { status: 'not-requested' },
      replacement: { guarantee: this.capabilities.replacement },
    };
  }
}
