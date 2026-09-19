import { describe, expect, it, vi } from 'vitest';
import { createEmptyBusinessDataset } from '../domain/businessDataset';
import {
  createBusinessDatasetWorkbookDocument,
  exportBusinessDatasetToXlsx,
} from './businessDatasetWorkbookExport';
import { importBusinessDatasetFromXlsx } from './businessDatasetWorkbookImport';
import type { WorkbookCodec } from './workbookCodec';
import {
  WorkbookResourceLimitError,
  createWorkbookResourceLimitIssue,
} from './workbookResourceLimits';
import { SheetJsWorkbookCodec } from './sheetJsWorkbookCodec';
import type { WorkbookNeutralDocument } from './workbookSchema';

const METADATA = { exportedAt: '2026-09-16T03:30:00.000Z' } as const;

function currentDocument(): WorkbookNeutralDocument {
  return createBusinessDatasetWorkbookDocument(createEmptyBusinessDataset(), METADATA);
}

function codecReturning(document: WorkbookNeutralDocument): WorkbookCodec & {
  decode: ReturnType<typeof vi.fn>;
} {
  return {
    encode: () => new Uint8Array(),
    decode: vi.fn(() => document),
  };
}

describe('BusinessDataset XLSX import resource limits', () => {
  it('accepts input exactly at the configured byte limit', () => {
    const codec = codecReturning(currentDocument());
    const result = importBusinessDatasetFromXlsx(
      new Uint8Array([1, 2, 3]),
      codec,
      { maxWorkbookBytes: 3 },
    );

    expect(codec.decode).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
  });

  it('rejects over-limit bytes before codec decode', () => {
    const codec = codecReturning(currentDocument());
    const result = importBusinessDatasetFromXlsx(
      new Uint8Array([1, 2, 3, 4]),
      codec,
      { maxWorkbookBytes: 3 },
    );

    expect(codec.decode).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      issues: [
        expect.objectContaining({
          stage: 'resource-limit',
          code: 'WORKBOOK_BYTES_EXCEEDED',
          limitKind: 'workbook-bytes',
          actual: 4,
          maximum: 3,
        }),
      ],
    });
  });

  it('maps a codec early-range resource error to the resource-limit stage', () => {
    const codec: WorkbookCodec = {
      encode: () => new Uint8Array(),
      decode: () => {
        throw new WorkbookResourceLimitError(
          createWorkbookResourceLimitIssue('sheet-rows', 11, 10, 'Materials'),
        );
      },
    };

    const result = importBusinessDatasetFromXlsx(new Uint8Array([1]), codec);
    expect(result).toEqual({
      ok: false,
      issues: [
        expect.objectContaining({
          stage: 'resource-limit',
          code: 'SHEET_ROWS_EXCEEDED',
          sheetName: 'Materials',
          actual: 11,
          maximum: 10,
        }),
      ],
    });
  });

  it('re-checks worksheet count after arbitrary codec decode', () => {
    const source = currentDocument();
    const document: WorkbookNeutralDocument = {
      sheets: [
        ...source.sheets,
        { name: 'Extra', columns: ['value'], rows: [{ value: 1 }] },
      ],
    };
    const codec = codecReturning(document);

    const result = importBusinessDatasetFromXlsx(new Uint8Array([1]), codec, {
      maxWorksheetCount: source.sheets.length,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        stage: 'resource-limit',
        code: 'WORKSHEET_COUNT_EXCEEDED',
        actual: source.sheets.length + 1,
        maximum: source.sheets.length,
      }),
    );
  });

  it('re-checks per-sheet columns and preserves sheet context', () => {
    const codec = codecReturning(currentDocument());
    const result = importBusinessDatasetFromXlsx(new Uint8Array([1]), codec, {
      maxColumnsPerSheet: 5,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        stage: 'resource-limit',
        code: 'SHEET_COLUMNS_EXCEEDED',
        sheetName: 'Materials',
        limitKind: 'sheet-columns',
      }),
    );
  });

  it('re-checks per-sheet rows before schema or reconstruction', () => {
    const source = currentDocument();
    const sheets = source.sheets.map((sheet) =>
      sheet.name === 'Materials'
        ? { ...sheet, rows: [{}, {}] }
        : sheet,
    );
    const codec = codecReturning({ sheets });

    const result = importBusinessDatasetFromXlsx(new Uint8Array([1]), codec, {
      maxRowsPerSheet: 1,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]).toEqual(
      expect.objectContaining({
        stage: 'resource-limit',
        code: 'SHEET_ROWS_EXCEEDED',
        sheetName: 'Materials',
        actual: 2,
        maximum: 1,
      }),
    );
  });

  it('reports aggregate total-row and total-cell limits from decoded neutral documents', () => {
    const document: WorkbookNeutralDocument = {
      sheets: [
        { name: 'One', columns: ['a', 'b'], rows: [{ a: 1 }, { a: 2 }] },
        { name: 'Two', columns: ['a', 'b'], rows: [{ a: 3 }] },
      ],
    };
    const codec = codecReturning(document);

    const result = importBusinessDatasetFromXlsx(new Uint8Array([1]), codec, {
      maxWorksheetCount: 10,
      maxColumnsPerSheet: 10,
      maxRowsPerSheet: 10,
      maxTotalRows: 2,
      maxTotalCells: 5,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: 'resource-limit',
          code: 'TOTAL_ROWS_EXCEEDED',
          actual: 3,
          maximum: 2,
        }),
        expect.objectContaining({
          stage: 'resource-limit',
          code: 'TOTAL_CELLS_EXCEEDED',
          actual: 10,
          maximum: 5,
        }),
      ]),
    );
  });

  it('keeps the normal current v1/v1 real-XLSX import path unchanged under defaults', () => {
    const codec = new SheetJsWorkbookCodec();
    const source = createEmptyBusinessDataset();
    const bytes = exportBusinessDatasetToXlsx(source, METADATA, codec);
    const result = importBusinessDatasetFromXlsx(bytes, codec);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dataset).toEqual(source);
  });
});
