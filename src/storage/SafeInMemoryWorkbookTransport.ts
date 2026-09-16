import type { WorkbookBinaryInput } from './workbookCodec';
import {
  cloneWorkbookBytes,
  createWorkbookTransportCapabilities,
  WorkbookTransportSaveError,
  type WorkbookBackupReceipt,
  type WorkbookSaveOptions,
  type WorkbookSaveReceipt,
  type WorkbookTransport,
  type WorkbookTransportSaveFailureStage,
} from './WorkbookTransport';

export type SafeInMemoryWorkbookTransportFaultStage = Exclude<
  WorkbookTransportSaveFailureStage,
  'capability'
>;

export type SafeInMemoryWorkbookTransportClock = () => Date;
export type SafeInMemoryWorkbookTransportFaultInjector = (
  stage: SafeInMemoryWorkbookTransportFaultStage,
) => void | Promise<void>;

export interface SafeInMemoryWorkbookTransportOptions {
  readonly clock?: SafeInMemoryWorkbookTransportClock;
  readonly faultInjector?: SafeInMemoryWorkbookTransportFaultInjector;
}

export type SafeInMemoryWorkbookTransportErrorCode =
  | 'NO_WORKBOOK_AVAILABLE'
  | 'BACKUP_NOT_FOUND';

export class SafeInMemoryWorkbookTransportError extends Error {
  readonly code: SafeInMemoryWorkbookTransportErrorCode;

  constructor(code: SafeInMemoryWorkbookTransportErrorCode, message: string) {
    super(message);
    this.name = 'SafeInMemoryWorkbookTransportError';
    this.code = code;
  }
}

export interface SafeInMemoryWorkbookTransportCleanupFailureContext {
  readonly operationError: WorkbookTransportSaveError;
  readonly cleanupCause: unknown;
}

/**
 * Deterministic Phase 5 reference transport for backup-before-commit and staged replacement.
 *
 * Its `atomic` guarantee is logical only: commit is a single in-memory primary-reference swap
 * after staging succeeds. It does not claim filesystem durability, fsync, rename atomicity,
 * locking, or crash consistency; those remain native transport concerns for Phase 6.
 */
export class SafeInMemoryWorkbookTransport implements WorkbookTransport {
  readonly capabilities = createWorkbookTransportCapabilities({
    backup: 'supported',
    stagedReplacement: true,
    replacement: 'atomic',
  });

  private primaryBytes?: Uint8Array;
  private stagedBytes?: Uint8Array;
  private readonly backups = new Map<string, Uint8Array>();
  private backupSequence = 0;
  private readonly clock: SafeInMemoryWorkbookTransportClock;
  private readonly faultInjector?: SafeInMemoryWorkbookTransportFaultInjector;

  constructor(
    initialBytes?: WorkbookBinaryInput,
    options: SafeInMemoryWorkbookTransportOptions = {},
  ) {
    if (initialBytes !== undefined) this.primaryBytes = cloneWorkbookBytes(initialBytes);
    this.clock = options.clock ?? (() => new Date());
    this.faultInjector = options.faultInjector;
  }

  async loadWorkbook(): Promise<Uint8Array> {
    if (!this.primaryBytes) {
      throw new SafeInMemoryWorkbookTransportError(
        'NO_WORKBOOK_AVAILABLE',
        'No primary workbook bytes are available in the safe in-memory transport.',
      );
    }

    return new Uint8Array(this.primaryBytes);
  }

  /** Reference-transport diagnostics used by B2/B3 tests; not part of WorkbookTransport. */
  listBackupReferences(): readonly string[] {
    return Object.freeze([...this.backups.keys()]);
  }

  /** Return a caller-owned copy of a retained backup artifact. */
  async loadBackup(reference: string): Promise<Uint8Array> {
    const backup = this.backups.get(reference);
    if (!backup) {
      throw new SafeInMemoryWorkbookTransportError(
        'BACKUP_NOT_FOUND',
        `No backup workbook exists for reference ${reference}.`,
      );
    }

    return new Uint8Array(backup);
  }

  /** Return a caller-owned copy of the current staging artifact, when one exists. */
  peekStagedWorkbook(): Uint8Array | undefined {
    return this.stagedBytes === undefined ? undefined : new Uint8Array(this.stagedBytes);
  }

  async saveWorkbook(
    bytes: Uint8Array,
    options: WorkbookSaveOptions = {},
  ): Promise<WorkbookSaveReceipt> {
    // Own caller bytes immediately, before the first async lifecycle checkpoint.
    const ownedReplacement = new Uint8Array(bytes);
    const backupRequest = options.backup ?? 'none';

    let existingPrimary: Uint8Array | undefined;
    try {
      await this.injectFault('read-existing');
      existingPrimary =
        this.primaryBytes === undefined ? undefined : new Uint8Array(this.primaryBytes);
    } catch (cause) {
      throw new WorkbookTransportSaveError(
        'read-existing',
        'READ_EXISTING_FAILED',
        'not-committed',
        'Failed to inspect the existing primary workbook before safe replacement.',
        cause,
      );
    }

    const backupReceipt = await this.prepareBackup(backupRequest, existingPrimary);

    try {
      this.stagedBytes = new Uint8Array(ownedReplacement);
      await this.injectFault('stage');
    } catch (cause) {
      const operationError = new WorkbookTransportSaveError(
        'stage',
        'STAGE_FAILED',
        'not-committed',
        'Failed to stage replacement workbook bytes.',
        cause,
      );
      await this.cleanupAfterPreCommitFailure(operationError);
      throw operationError;
    }

    try {
      await this.injectFault('commit');
      const staged = this.stagedBytes;
      if (!staged) {
        throw new Error('No staged workbook bytes are available for commit.');
      }
      // Logical atomic commit: the old primary remains authoritative until this reference swap.
      this.primaryBytes = staged;
    } catch (cause) {
      const operationError =
        cause instanceof WorkbookTransportSaveError
          ? cause
          : new WorkbookTransportSaveError(
              'commit',
              'COMMIT_FAILED',
              'not-committed',
              'Failed to commit the staged workbook as the new primary.',
              cause,
            );
      await this.cleanupAfterPreCommitFailure(operationError);
      throw operationError;
    }

    try {
      await this.injectFault('cleanup');
      this.stagedBytes = undefined;
    } catch (cause) {
      throw new WorkbookTransportSaveError(
        'cleanup',
        'CLEANUP_FAILED',
        'committed',
        'The new primary workbook was committed, but staging cleanup failed.',
        cause,
      );
    }

    return {
      reference: 'memory://safe-workbook',
      backup: backupReceipt,
      replacement: { guarantee: this.capabilities.replacement },
    };
  }

  private async prepareBackup(
    request: NonNullable<WorkbookSaveOptions['backup']> | 'none',
    existingPrimary: Uint8Array | undefined,
  ): Promise<WorkbookBackupReceipt> {
    if (request === 'none') return { status: 'not-requested' };

    if (existingPrimary === undefined) {
      return { status: 'not-needed', reason: 'no-existing-workbook' };
    }

    try {
      await this.injectFault('backup');
      const reference = this.createBackupReference();
      this.backups.set(reference, new Uint8Array(existingPrimary));
      return { status: 'created', reference };
    } catch (cause) {
      throw new WorkbookTransportSaveError(
        'backup',
        'BACKUP_FAILED',
        'not-committed',
        'Failed to preserve the existing primary workbook before replacement.',
        cause,
      );
    }
  }

  private createBackupReference(): string {
    const timestamp = this.clock().toISOString();
    this.backupSequence += 1;
    return `memory://safe-backup/${timestamp}/${String(this.backupSequence).padStart(4, '0')}`;
  }

  private async cleanupAfterPreCommitFailure(
    operationError: WorkbookTransportSaveError,
  ): Promise<void> {
    if (this.stagedBytes === undefined) return;

    try {
      await this.injectFault('cleanup');
      this.stagedBytes = undefined;
    } catch (cleanupCause) {
      const context: SafeInMemoryWorkbookTransportCleanupFailureContext = {
        operationError,
        cleanupCause,
      };
      throw new WorkbookTransportSaveError(
        'cleanup',
        'CLEANUP_FAILED',
        'not-committed',
        'Replacement was not committed and staging cleanup also failed.',
        context,
      );
    }
  }

  private async injectFault(stage: SafeInMemoryWorkbookTransportFaultStage): Promise<void> {
    await this.faultInjector?.(stage);
  }
}
