import type { BusinessDatasetWorkbookImportIssue } from '../../storage/businessDatasetWorkbookImport';

export type PersistenceLifecycleStage =
  | 'snapshot'
  | 'export'
  | 'transport-save'
  | 'transport-load'
  | 'import'
  | 'hydrate';

export type PersistenceLifecycleOperationalErrorCode =
  | 'SNAPSHOT_FAILED'
  | 'EXPORT_FAILED'
  | 'TRANSPORT_SAVE_FAILED'
  | 'TRANSPORT_LOAD_FAILED'
  | 'IMPORT_FAILED'
  | 'HYDRATION_FAILED'
  | 'HYDRATION_SNAPSHOT_FAILED'
  | 'HYDRATION_APPLY_FAILED_RESTORED'
  | 'HYDRATION_ROLLBACK_FAILED';

/**
 * Controlled unexpected/operational failure raised by the persistence coordinator.
 *
 * Expected invalid-workbook and validation rejections are returned as structured rejection
 * results instead. Original operational causes are retained here, including DatasetHydrationError,
 * so apply/rollback context is never flattened away.
 */
export class PersistenceLifecycleOperationalError extends Error {
  readonly stage: PersistenceLifecycleStage;
  readonly code: PersistenceLifecycleOperationalErrorCode;
  readonly causeValue: unknown;

  constructor(
    stage: PersistenceLifecycleStage,
    code: PersistenceLifecycleOperationalErrorCode,
    message: string,
    causeValue: unknown,
  ) {
    super(message);
    this.name = 'PersistenceLifecycleOperationalError';
    this.stage = stage;
    this.code = code;
    this.causeValue = causeValue;
  }
}

/** Expected fail-closed workbook rejection from the existing Phase 5.2C import boundary. */
export interface PersistenceWorkbookImportRejected {
  readonly status: 'rejected';
  readonly stage: 'import';
  readonly issues: readonly BusinessDatasetWorkbookImportIssue[];
}

export interface PersistenceDatasetHydrationIssue {
  readonly code: string;
  readonly message: string;
  readonly path: string;
}

/** Defensive result shape if hydration rejects a candidate before writes. */
export interface PersistenceDatasetHydrationRejected {
  readonly status: 'rejected';
  readonly stage: 'hydrate';
  readonly issues: readonly PersistenceDatasetHydrationIssue[];
}

export type PersistenceLifecycleRejected =
  | PersistenceWorkbookImportRejected
  | PersistenceDatasetHydrationRejected;
