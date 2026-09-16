import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { SheetJsWorkbookCodec } from './sheetJsWorkbookCodec';
import { WorkbookResourceLimitError } from './workbookResourceLimits';

function workbookBytes(workbook: XLSX.WorkBook): Uint8Array {
  const result = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  if (result instanceof ArrayBuffer) return new Uint8Array(result);
  if (result instanceof Uint8Array) return new Uint8Array(result);
  throw new Error('Unexpected test workbook byte representation.');
}

describe('SheetJsWorkbookCodec resource-limit guards', () => {
  it('accepts worksheet dimensions exactly at configured limits', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([['value'], [1]]),
      'Data',
    );

    const codec = new SheetJsWorkbookCodec({
      maxWorksheetCount: 1,
      maxColumnsPerSheet: 1,
      maxRowsPerSheet: 1,
      maxTotalRows: 1,
      maxTotalCells: 2,
    });

    expect(codec.decode(workbookBytes(workbook))).toEqual({
      sheets: [{ name: 'Data', columns: ['value'], rows: [{ value: 1 }] }],
    });
  });

  it('rejects worksheet count before per-sheet expansion', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['value']]), 'One');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['value']]), 'Two');

    const codec = new SheetJsWorkbookCodec({ maxWorksheetCount: 1 });
    expect(() => codec.decode(workbookBytes(workbook))).toThrow(WorkbookResourceLimitError);
    try {
      codec.decode(workbookBytes(workbook));
    } catch (error) {
      expect(error).toMatchObject({
        issue: expect.objectContaining({
          code: 'WORKSHEET_COUNT_EXCEEDED',
          actual: 2,
          maximum: 1,
        }),
      });
    }
  });

  it('rejects an excessive declared worksheet range before materializing neutral rows', () => {
    const workbook = XLSX.utils.book_new();
    const worksheet: XLSX.WorkSheet = {
      A1: { t: 's', v: 'value' },
      A2: { t: 'n', v: 1 },
      '!ref': 'A1:C10',
    };
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Oversized');

    const codec = new SheetJsWorkbookCodec({
      maxColumnsPerSheet: 2,
      maxRowsPerSheet: 5,
    });

    expect(() => codec.decode(workbookBytes(workbook))).toThrow(WorkbookResourceLimitError);
    try {
      codec.decode(workbookBytes(workbook));
    } catch (error) {
      expect(error).toMatchObject({
        issue: expect.objectContaining({
          code: 'SHEET_COLUMNS_EXCEEDED',
          sheetName: 'Oversized',
          actual: 3,
          maximum: 2,
        }),
      });
    }
  });

  it('rejects aggregate declared cell ranges before neutral workbook expansion', () => {
    const workbook = XLSX.utils.book_new();
    for (const name of ['One', 'Two']) {
      const worksheet: XLSX.WorkSheet = {
        A1: { t: 's', v: 'a' },
        B1: { t: 's', v: 'b' },
        A2: { t: 'n', v: 1 },
        '!ref': 'A1:B2',
      };
      XLSX.utils.book_append_sheet(workbook, worksheet, name);
    }

    const codec = new SheetJsWorkbookCodec({ maxTotalCells: 7 });
    expect(() => codec.decode(workbookBytes(workbook))).toThrow(WorkbookResourceLimitError);
    try {
      codec.decode(workbookBytes(workbook));
    } catch (error) {
      expect(error).toMatchObject({
        issue: expect.objectContaining({
          code: 'TOTAL_CELLS_EXCEEDED',
          actual: 8,
          maximum: 7,
        }),
      });
    }
  });
});
