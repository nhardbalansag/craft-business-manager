import { describe, expect, it } from 'vitest';
import {
  PersistenceLifecycleOperationalError,
  type PersistenceDatasetHydrationRejected,
  type PersistenceWorkbookImportRejected,
} from './PersistenceLifecycle';

describe('PersistenceLifecycle diagnostics', () => {
  it('retains stable stage, code, message, and original operational cause', () => {
    const cause = new Error('disk unavailable');
    const error = new PersistenceLifecycleOperationalError(
      'transport-save',
      'TRANSPORT_SAVE_FAILED',
      'Workbook transport save failed.',
      cause,
    );

    expect(error).toMatchObject({
      name: 'PersistenceLifecycleOperationalError',
      stage: 'transport-save',
      code: 'TRANSPORT_SAVE_FAILED',
      message: 'Workbook transport save failed.',
    });
    expect(error.causeValue).toBe(cause);
  });

  it('keeps rollback failure distinguishable from restored apply failure', () => {
    const restored = new PersistenceLifecycleOperationalError(
      'hydrate',
      'HYDRATION_APPLY_FAILED_RESTORED',
      'Hydration failed and the previous dataset was restored.',
      { code: 'APPLY_FAILED_RESTORED' },
    );
    const rollbackFailed = new PersistenceLifecycleOperationalError(
      'hydrate',
      'HYDRATION_ROLLBACK_FAILED',
      'Hydration failed and rollback also failed.',
      { code: 'ROLLBACK_FAILED' },
    );

    expect(restored.code).not.toBe(rollbackFailed.code);
    expect(rollbackFailed.code).toBe('HYDRATION_ROLLBACK_FAILED');
  });

  it('preserves structured workbook import issues as a normal rejection result', () => {
    const rejected: PersistenceWorkbookImportRejected = {
      status: 'rejected',
      stage: 'import',
      issues: [
        {
          stage: 'schema',
          code: 'MISSING_SHEET',
          message: 'Products sheet is required.',
          sheetName: 'Products',
        },
      ],
    };

    expect(rejected).toEqual({
      status: 'rejected',
      stage: 'import',
      issues: [
        {
          stage: 'schema',
          code: 'MISSING_SHEET',
          message: 'Products sheet is required.',
          sheetName: 'Products',
        },
      ],
    });
  });

  it('keeps defensive hydration rejection separate from operational hydration failure', () => {
    const rejected: PersistenceDatasetHydrationRejected = {
      status: 'rejected',
      stage: 'hydrate',
      issues: [
        {
          code: 'INVALID_DATASET',
          message: 'Dataset is invalid.',
          path: 'products',
        },
      ],
    };

    expect(rejected.status).toBe('rejected');
    expect(rejected.stage).toBe('hydrate');
    expect(rejected.issues).toHaveLength(1);
  });
});
