import { describe, expect, it } from 'vitest';
import { XLSX_WORKBOOK_MIME_TYPE, type BrowserWorkbookExportResult } from '../../application/persistence/BrowserWorkbookExportCommand';
import type { PersistenceWorkbookHydrated } from '../../application/persistence/PersistenceCoordinator';
import { CURRENT_BUSINESS_DATASET_SCHEMA_VERSION } from '../../domain/businessDataset';
import {
  CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
  CURRENT_WORKBOOK_FORMAT_VERSION,
} from '../../storage/workbookSchema';
import {
  createWorkbookPersistenceSessionStatus,
  recordSuccessfulWorkbookExport,
  recordSuccessfulWorkbookImport,
} from './workbookPersistenceSession';

const hydrated: PersistenceWorkbookHydrated = {
  status: 'hydrated',
  metadata: {
    formatId: CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
    workbookFormatVersion: CURRENT_WORKBOOK_FORMAT_VERSION,
    datasetSchemaVersion: CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
    exportedAt: '2026-09-17T00:00:00.000Z',
    applicationVersion: '0.1.0',
  },
};

const exported: BrowserWorkbookExportResult = {
  status: 'download-dispatched',
  fileName: 'craft-business-manager-2026-09-17-010000.xlsx',
  byteLength: 2_048,
  mimeType: XLSX_WORKBOOK_MIME_TYPE,
  metadata: {
    exportedAt: '2026-09-17T01:00:00.000Z',
    applicationVersion: '0.1.0',
  },
};

describe('workbook persistence UI session status', () => {
  it('starts with the current contract and no invented workbook identity or history', () => {
    const status = createWorkbookPersistenceSessionStatus();

    expect(status.contract).toEqual({
      formatId: CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
      workbookFormatVersion: CURRENT_WORKBOOK_FORMAT_VERSION,
      datasetSchemaVersion: CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
    });
    expect(status.activeImportedWorkbook).toBeNull();
    expect(status.lastSuccessfulExport).toBeNull();
    expect(Object.isFrozen(status)).toBe(true);
    expect(Object.isFrozen(status.contract)).toBe(true);
  });

  it('records a successful import with browser identity, workbook metadata, and observed operation time', () => {
    const status = recordSuccessfulWorkbookImport(createWorkbookPersistenceSessionStatus(), {
      selection: { name: 'owner-data.xlsx', byteLength: 1_024 },
      result: hydrated,
      observedAt: new Date('2026-09-17T01:30:00.000Z'),
    });

    expect(status.activeImportedWorkbook).toEqual({
      fileName: 'owner-data.xlsx',
      byteLength: 1_024,
      importedAt: '2026-09-17T01:30:00.000Z',
      metadata: hydrated.metadata,
    });
    expect(status.lastSuccessfulExport).toBeNull();
    expect(Object.isFrozen(status.activeImportedWorkbook)).toBe(true);
    expect(Object.isFrozen(status.activeImportedWorkbook?.metadata)).toBe(true);
  });

  it('records a successful downloaded copy without replacing the active imported identity', () => {
    const imported = recordSuccessfulWorkbookImport(createWorkbookPersistenceSessionStatus(), {
      selection: { name: 'owner-data.xlsx', byteLength: 1_024 },
      result: hydrated,
      observedAt: new Date('2026-09-17T01:30:00.000Z'),
    });

    const status = recordSuccessfulWorkbookExport(imported, {
      result: exported,
      observedAt: new Date('2026-09-17T01:45:00.000Z'),
    });

    expect(status.activeImportedWorkbook).toBe(imported.activeImportedWorkbook);
    expect(status.lastSuccessfulExport).toEqual({
      fileName: exported.fileName,
      byteLength: exported.byteLength,
      downloadedAt: '2026-09-17T01:45:00.000Z',
      metadata: exported.metadata,
    });
    expect(Object.isFrozen(status.lastSuccessfulExport)).toBe(true);
    expect(Object.isFrozen(status.lastSuccessfulExport?.metadata)).toBe(true);
  });

  it('fails closed for an invalid observed clock instead of manufacturing a session timestamp', () => {
    expect(() =>
      recordSuccessfulWorkbookExport(createWorkbookPersistenceSessionStatus(), {
        result: exported,
        observedAt: new Date(Number.NaN),
      }),
    ).toThrow(RangeError);
  });
});
