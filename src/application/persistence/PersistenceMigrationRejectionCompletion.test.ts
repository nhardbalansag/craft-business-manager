import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyBusinessDataset } from '../../domain/businessDataset';
import type { WorkbookCodec } from '../../storage/workbookCodec';

const { importWorkbookMock } = vi.hoisted(() => ({
  importWorkbookMock: vi.fn(),
}));

vi.mock('../../storage/businessDatasetWorkbookImport', () => ({
  importBusinessDatasetFromXlsx: importWorkbookMock,
}));

import { PersistenceCoordinator } from './PersistenceCoordinator';

function codecStub(): WorkbookCodec {
  return {
    encode: vi.fn(() => new Uint8Array([1])),
    decode: vi.fn(() => ({ sheets: [] })),
  };
}

describe('Phase 5.4A3 migration rejection hydration safety gate', () => {
  beforeEach(() => {
    importWorkbookMock.mockReset();
  });

  it('returns a structured migration-stage import rejection with zero hydration calls', async () => {
    const migrationCause = new Error('synthetic migration failure');
    importWorkbookMock.mockReturnValue({
      ok: false,
      issues: [
        {
          stage: 'migration',
          code: 'MIGRATION_STEP_FAILED',
          message: 'Synthetic registered migration failed.',
          sourceVersion: { workbookFormatVersion: 1, datasetSchemaVersion: 1 },
          targetVersion: { workbookFormatVersion: 2, datasetSchemaVersion: 1 },
          stepIndex: 0,
          causeValue: migrationCause,
        },
      ],
    });

    const hydration = {
      hydrate: vi.fn(async () => ({ status: 'hydrated' as const })),
    };
    const coordinator = new PersistenceCoordinator(
      { snapshot: vi.fn(async () => createEmptyBusinessDataset()) },
      hydration,
      codecStub(),
    );

    const result = await coordinator.importAndApplyWorkbook(new Uint8Array([1, 2, 3]));

    expect(result).toEqual({
      status: 'rejected',
      stage: 'import',
      issues: [
        expect.objectContaining({
          stage: 'migration',
          code: 'MIGRATION_STEP_FAILED',
          stepIndex: 0,
          causeValue: migrationCause,
        }),
      ],
    });
    expect(importWorkbookMock).toHaveBeenCalledTimes(1);
    expect(hydration.hydrate).not.toHaveBeenCalled();
  });
});
