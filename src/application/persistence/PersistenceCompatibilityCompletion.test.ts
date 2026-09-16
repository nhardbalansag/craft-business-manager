import { describe, expect, it, vi } from 'vitest';
import { createEmptyBusinessDataset } from '../../domain/businessDataset';
import { exportBusinessDatasetToXlsx } from '../../storage/businessDatasetWorkbookExport';
import { InMemoryWorkbookTransport } from '../../storage/InMemoryWorkbookTransport';
import { SheetJsWorkbookCodec } from '../../storage/sheetJsWorkbookCodec';
import type { WorkbookCodec } from '../../storage/workbookCodec';
import {
  CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
  type WorkbookNeutralDocument,
} from '../../storage/workbookSchema';
import { PersistenceCoordinator } from './PersistenceCoordinator';

function acceptingHydration() {
  return { hydrate: vi.fn(async () => ({ status: 'hydrated' as const })) };
}

function snapshotSource() {
  return { snapshot: vi.fn(async () => createEmptyBusinessDataset()) };
}

function codecFor(document: WorkbookNeutralDocument): WorkbookCodec {
  return {
    encode: vi.fn(() => new Uint8Array([1])),
    decode: vi.fn(() => document),
  };
}

function metaDocument(
  workbookFormatVersion: unknown,
  datasetSchemaVersion: unknown,
  formatId: unknown = CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
): WorkbookNeutralDocument {
  return {
    sheets: [
      {
        name: '_Meta',
        columns: [
          'formatId',
          'workbookFormatVersion',
          'datasetSchemaVersion',
          'exportedAt',
          'applicationVersion',
        ],
        rows: [
          {
            formatId,
            workbookFormatVersion,
            datasetSchemaVersion,
            exportedAt: '2026-09-16T02:30:00.000Z',
            applicationVersion: '5.4a3-test',
          },
        ],
      },
    ],
  };
}

describe('Phase 5.4A3 persistence compatibility completion gate', () => {
  it('preserves current v1/v1 direct XLSX import and metadata through the coordinator', async () => {
    const codec = new SheetJsWorkbookCodec();
    const hydration = acceptingHydration();
    const coordinator = new PersistenceCoordinator(snapshotSource(), hydration, codec);
    const bytes = exportBusinessDatasetToXlsx(
      createEmptyBusinessDataset(),
      {
        exportedAt: '2026-09-16T02:35:00.000Z',
        applicationVersion: '5.4a3-current',
      },
      codec,
    );

    const result = await coordinator.importAndApplyWorkbook(bytes);

    expect(result).toEqual({
      status: 'hydrated',
      metadata: {
        formatId: CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
        workbookFormatVersion: 1,
        datasetSchemaVersion: 1,
        exportedAt: '2026-09-16T02:35:00.000Z',
        applicationVersion: '5.4a3-current',
      },
    });
    expect(hydration.hydrate).toHaveBeenCalledTimes(1);
    expect(hydration.hydrate).toHaveBeenCalledWith(createEmptyBusinessDataset());
  });

  it('preserves current v1/v1 transport-backed load through the same import/hydrate path', async () => {
    const codec = new SheetJsWorkbookCodec();
    const hydration = acceptingHydration();
    const coordinator = new PersistenceCoordinator(snapshotSource(), hydration, codec);
    const bytes = exportBusinessDatasetToXlsx(
      createEmptyBusinessDataset(),
      { exportedAt: '2026-09-16T02:40:00.000Z' },
      codec,
    );

    const result = await coordinator.loadCurrentWorkbook(new InMemoryWorkbookTransport(bytes));

    expect(result.status).toBe('hydrated');
    expect(hydration.hydrate).toHaveBeenCalledTimes(1);
  });

  it('rejects all production future-version combinations before hydration', async () => {
    for (const [workbookFormatVersion, datasetSchemaVersion] of [
      [2, 1],
      [1, 2],
      [2, 2],
    ] as const) {
      const hydration = acceptingHydration();
      const coordinator = new PersistenceCoordinator(
        snapshotSource(),
        hydration,
        codecFor(metaDocument(workbookFormatVersion, datasetSchemaVersion)),
      );

      const result = await coordinator.importAndApplyWorkbook(new Uint8Array([1]));

      expect(result).toMatchObject({ status: 'rejected', stage: 'import' });
      if (result.status === 'rejected' && result.stage === 'import') {
        expect(result.issues).toContainEqual(
          expect.objectContaining({
            stage: 'compatibility',
            code: 'UNSUPPORTED_FUTURE_VERSION',
          }),
        );
      }
      expect(hydration.hydrate).not.toHaveBeenCalled();
    }
  });

  it('rejects representative invalid metadata states before hydration writes', async () => {
    const invalidDocuments: WorkbookNeutralDocument[] = [
      { sheets: [] },
      metaDocument(0, 1),
      metaDocument(1, 1, 'other-app'),
    ];

    for (const document of invalidDocuments) {
      const hydration = acceptingHydration();
      const coordinator = new PersistenceCoordinator(
        snapshotSource(),
        hydration,
        codecFor(document),
      );

      const result = await coordinator.importAndApplyWorkbook(new Uint8Array([1]));

      expect(result).toMatchObject({ status: 'rejected', stage: 'import' });
      expect(hydration.hydrate).not.toHaveBeenCalled();
    }
  });
});
