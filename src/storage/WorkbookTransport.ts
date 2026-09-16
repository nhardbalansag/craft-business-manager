import type { WorkbookBinaryInput } from './workbookCodec';

/**
 * Backup policy requested by the application without prescribing transport implementation details.
 */
export type WorkbookBackupRequest = 'none' | 'if-supported' | 'required';

export interface WorkbookSaveOptions {
  readonly backup?: WorkbookBackupRequest;
}

export type WorkbookBackupReceipt =
  | { readonly status: 'not-requested' }
  | { readonly status: 'unsupported' }
  | { readonly status: 'not-needed'; readonly reason: 'no-existing-workbook' }
  | { readonly status: 'created'; readonly reference: string };

export type WorkbookBackupSupport = 'supported' | 'unsupported';
export type WorkbookReplacementGuarantee = 'atomic' | 'direct-non-atomic';

/**
 * Explicit transport guarantees. These describe only byte-storage behavior and must never be
 * inferred from an implementation class name or runtime environment.
 */
export interface WorkbookTransportCapabilities {
  readonly backup: WorkbookBackupSupport;
  readonly stagedReplacement: boolean;
  readonly replacement: WorkbookReplacementGuarantee;
}

/** Create an immutable capability value that callers may safely retain. */
export function createWorkbookTransportCapabilities(
  capabilities: WorkbookTransportCapabilities,
): Readonly<WorkbookTransportCapabilities> {
  return Object.freeze({ ...capabilities });
}

export interface WorkbookReplacementReceipt {
  readonly guarantee: WorkbookReplacementGuarantee;
}

/**
 * Transport-owned acknowledgement of a workbook save.
 *
 * `reference` is deliberately transport-neutral. It may later represent a browser artifact,
 * native path, object-store key, or another transport identifier without exposing those details
 * to the persistence coordinator.
 */
export interface WorkbookSaveReceipt {
  readonly reference?: string;
  readonly backup: WorkbookBackupReceipt;
  readonly replacement: WorkbookReplacementReceipt;
}

export type WorkbookTransportSaveFailureStage =
  | 'capability'
  | 'read-existing'
  | 'backup'
  | 'stage'
  | 'commit'
  | 'cleanup';

export type WorkbookTransportSaveErrorCode =
  | 'REQUIRED_BACKUP_UNSUPPORTED'
  | 'READ_EXISTING_FAILED'
  | 'BACKUP_FAILED'
  | 'STAGE_FAILED'
  | 'COMMIT_FAILED'
  | 'CLEANUP_FAILED';

/**
 * Whether the new primary workbook is authoritative at the point a safe-save error is reported.
 * This prevents a post-commit cleanup problem from being mistaken for a rolled-back replacement.
 */
export type WorkbookTransportCommitState = 'not-committed' | 'committed';

export class WorkbookTransportSaveError extends Error {
  readonly stage: WorkbookTransportSaveFailureStage;
  readonly code: WorkbookTransportSaveErrorCode;
  readonly commitState: WorkbookTransportCommitState;
  readonly causeValue: unknown;

  constructor(
    stage: WorkbookTransportSaveFailureStage,
    code: WorkbookTransportSaveErrorCode,
    commitState: WorkbookTransportCommitState,
    message: string,
    causeValue?: unknown,
  ) {
    super(message);
    this.name = 'WorkbookTransportSaveError';
    this.stage = stage;
    this.code = code;
    this.commitState = commitState;
    this.causeValue = causeValue;
  }
}

/**
 * Byte-only persistence transport used by the Phase 5 coordinator.
 *
 * Implementations must not know about BusinessDataset, workbook sheet mappings, repository
 * hydration, or derived business calculations. Mutable byte buffers crossing this boundary must
 * be defensively owned by the implementation.
 */
export interface WorkbookTransport {
  readonly capabilities: Readonly<WorkbookTransportCapabilities>;
  loadWorkbook(): Promise<Uint8Array>;
  saveWorkbook(
    bytes: Uint8Array,
    options?: WorkbookSaveOptions,
  ): Promise<WorkbookSaveReceipt>;
}

/** Create a transport-owned copy of workbook bytes from either supported codec input shape. */
export function cloneWorkbookBytes(bytes: WorkbookBinaryInput): Uint8Array {
  if (bytes instanceof Uint8Array) return new Uint8Array(bytes);
  return new Uint8Array(bytes.slice(0));
}
