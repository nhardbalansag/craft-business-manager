import type { WorkbookBinaryInput } from './workbookCodec';

/**
 * A neutral backup request that does not define how backups are created.
 * Detailed backup naming, staging, atomic replacement, cleanup, and recovery remain Phase 5.4B.
 */
export type WorkbookBackupRequest = 'none' | 'if-supported';

export interface WorkbookSaveOptions {
  readonly backup?: WorkbookBackupRequest;
}

export type WorkbookBackupReceipt =
  | { readonly status: 'not-requested' }
  | { readonly status: 'unsupported' }
  | { readonly status: 'created'; readonly reference: string };

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
}

/**
 * Byte-only persistence transport used by the Phase 5 coordinator.
 *
 * Implementations must not know about BusinessDataset, workbook sheet mappings, repository
 * hydration, or derived business calculations. Mutable byte buffers crossing this boundary must
 * be defensively owned by the implementation.
 */
export interface WorkbookTransport {
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
