import { describe, expect, it } from 'vitest';
import { importBusinessDatasetFromXlsx } from './businessDatasetWorkbookImport';
import type { WorkbookCodec } from './workbookCodec';
import { CRAFT_BUSINESS_WORKBOOK_FORMAT_ID, type WorkbookNeutralDocument } from './workbookSchema';

function codecFor(document: WorkbookNeutralDocument): WorkbookCodec {
  return {
    encode: () => new Uint8Array(),
    decode: () => document,
  };
}

function metaDocument(
  workbookFormatVersion: number,
  datasetSchemaVersion: number,
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
            exportedAt: '2026-09-16T00:00:00.000Z',
            applicationVersion: null,
          },
        ],
      },
    ],
  };
}

describe('Phase 5.4A2 XLSX import compatibility handoff', () => {
  it('runs version compatibility before strict current-sheet validation for future workbooks', () => {
    const result = importBusinessDatasetFromXlsx(
      new Uint8Array([1]),
      codecFor(metaDocument(2, 1)),
    );

    expect(result).toEqual({
      ok: false,
      issues: [
        expect.objectContaining({
          stage: 'compatibility',
          code: 'UNSUPPORTED_FUTURE_VERSION',
          compatibilityStatus: 'unsupported-future',
          sourceVersion: { workbookFormatVersion: 2, datasetSchemaVersion: 1 },
          targetVersion: { workbookFormatVersion: 1, datasetSchemaVersion: 1 },
        }),
      ],
    });
  });

  it('rejects missing _Meta as compatibility metadata instead of heuristic legacy detection', () => {
    const result = importBusinessDatasetFromXlsx(
      new Uint8Array([1]),
      codecFor({ sheets: [{ name: 'Materials', columns: [], rows: [] }] }),
    );

    expect(result).toEqual({
      ok: false,
      issues: [
        expect.objectContaining({
          stage: 'compatibility',
          code: 'MISSING_META_SHEET',
        }),
      ],
    });
  });

  it('rejects wrong application format identity before strict current schema validation', () => {
    const result = importBusinessDatasetFromXlsx(
      new Uint8Array([1]),
      codecFor(metaDocument(1, 1, 'other-app')),
    );

    expect(result).toEqual({
      ok: false,
      issues: [
        expect.objectContaining({
          stage: 'compatibility',
          code: 'INVALID_FORMAT_ID',
          sheetName: '_Meta',
          excelRow: 2,
          input: 'other-app',
        }),
      ],
    });
  });

  it('rejects malformed version metadata as structured compatibility diagnostics', () => {
    const result = importBusinessDatasetFromXlsx(
      new Uint8Array([1]),
      codecFor(metaDocument(0, 1.5)),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toEqual([
      expect.objectContaining({
        stage: 'compatibility',
        code: 'INVALID_DATASET_SCHEMA_VERSION',
      }),
      expect.objectContaining({
        stage: 'compatibility',
        code: 'INVALID_WORKBOOK_FORMAT_VERSION',
      }),
    ]);
  });

  it('hands a current v1/v1 document back to the existing strict current schema validator', () => {
    const result = importBusinessDatasetFromXlsx(
      new Uint8Array([1]),
      codecFor(metaDocument(1, 1)),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        stage: 'schema',
        code: 'MISSING_REQUIRED_SHEET',
        sheetName: 'Materials',
      }),
    );
    expect(result.issues.some((issue) => issue.stage === 'compatibility')).toBe(false);
  });
});
