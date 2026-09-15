import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  validateWorkbookSchema,
  type WorkbookFormulaCell,
  type WorkbookNeutralDocument,
} from './workbookSchema';
import { WorkbookCodecError, type WorkbookCodec } from './workbookCodec';
import {
  SHEETJS_CE_EXPECTED_VERSION,
  SHEETJS_CE_VERSION,
  SheetJsWorkbookCodec,
} from './sheetJsWorkbookCodec';

function workbookBytes(workbook: XLSX.WorkBook): Uint8Array {
  const result = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  if (result instanceof ArrayBuffer) return new Uint8Array(result);
  if (result instanceof Uint8Array) return new Uint8Array(result);
  throw new Error('Unexpected test workbook byte representation.');
}

describe('SheetJsWorkbookCodec', () => {
  it('uses the exact evaluated SheetJS CE release', () => {
    expect(SHEETJS_CE_VERSION).toBe(SHEETJS_CE_EXPECTED_VERSION);
    expect(SHEETJS_CE_VERSION).toBe('0.20.3');
  });

  it('satisfies the library-neutral WorkbookCodec boundary', () => {
    const codec: WorkbookCodec = new SheetJsWorkbookCodec();
    expect(typeof codec.encode).toBe('function');
    expect(typeof codec.decode).toBe('function');
  });

  it('round-trips workbook-neutral sheets and primitive cells entirely in memory', () => {
    const codec = new SheetJsWorkbookCodec();
    const source: WorkbookNeutralDocument = {
      sheets: [
        {
          name: '_Meta',
          columns: ['formatId', 'workbookFormatVersion', 'enabled'],
          rows: [
            {
              formatId: 'craft-business-manager',
              workbookFormatVersion: 1,
              enabled: true,
            },
          ],
        },
        {
          name: 'Notes',
          columns: ['name', 'amount', 'active'],
          rows: [{ name: 'Sample', amount: 12.5, active: false }],
        },
      ],
    };

    const bytes = codec.encode(source);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.byteLength).toBeGreaterThan(0);
    expect(codec.decode(bytes)).toEqual(source);
  });

  it('decodes ArrayBuffer input as well as Uint8Array input', () => {
    const codec = new SheetJsWorkbookCodec();
    const source: WorkbookNeutralDocument = {
      sheets: [{ name: 'Data', columns: ['value'], rows: [{ value: 42 }] }],
    };
    const bytes = codec.encode(source);
    const arrayBuffer = bytes.slice().buffer as ArrayBuffer;

    expect(codec.decode(arrayBuffer)).toEqual(source);
  });

  it('preserves worksheet order across the real XLSX byte round-trip', () => {
    const codec = new SheetJsWorkbookCodec();
    const source: WorkbookNeutralDocument = {
      sheets: [
        { name: '_Meta', columns: ['value'], rows: [{ value: 'meta' }] },
        { name: 'Materials', columns: ['value'], rows: [{ value: 'material' }] },
        { name: 'Extra User Sheet', columns: ['value'], rows: [{ value: 'annotation' }] },
      ],
    };

    const decoded = codec.decode(codec.encode(source));
    expect(decoded.sheets.map((sheet) => sheet.name)).toEqual([
      '_Meta',
      'Materials',
      'Extra User Sheet',
    ]);
  });

  it('writes formula-looking authoritative strings as literal text', () => {
    const codec = new SheetJsWorkbookCodec();
    const values = ['=1+1', '+SUM(A1:A2)', '-1+2', '@SUM(A1:A2)'];
    const source: WorkbookNeutralDocument = {
      sheets: [
        {
          name: 'LiteralText',
          columns: ['equals', 'plus', 'minus', 'at'],
          rows: [
            {
              equals: values[0],
              plus: values[1],
              minus: values[2],
              at: values[3],
            },
          ],
        },
      ],
    };

    const decoded = codec.decode(codec.encode(source));
    const row = decoded.sheets[0].rows[0];
    expect([row.equals, row.plus, row.minus, row.at]).toEqual(values);
    for (const value of Object.values(row)) {
      expect(value).not.toEqual(expect.objectContaining({ formula: expect.any(String) }));
    }
  });

  it('refuses to create formula cells through the authoritative encode boundary', () => {
    const codec = new SheetJsWorkbookCodec();
    const formula: WorkbookFormulaCell = { formula: '1+1', cachedValue: 2 };
    const source: WorkbookNeutralDocument = {
      sheets: [{ name: 'Data', columns: ['value'], rows: [{ value: formula }] }],
    };

    expect(() => codec.encode(source)).toThrowError(WorkbookCodecError);
    try {
      codec.encode(source);
    } catch (error) {
      expect(error).toMatchObject({ code: 'FORMULA_WRITE_NOT_ALLOWED' });
    }
  });

  it('detects a real formula cell from XLSX bytes without evaluating it as source data', () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([['value'], [2]]);
    worksheet.A2 = { t: 'n', v: 2, f: '1+1' };
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');

    const decoded = new SheetJsWorkbookCodec().decode(workbookBytes(workbook));
    expect(decoded.sheets[0].rows[0].value).toEqual({ formula: '1+1', cachedValue: 2 });
  });

  it('feeds decoded formula metadata into the existing workbook schema rejection rule', () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['id', 'name', 'category', 'mixPresetId', 'safetyWasteRate', 'notes', 'isActive'],
      ['product-1', 'Product', 'candle', null, 0, null, true],
    ]);
    worksheet.A2 = { t: 's', v: 'product-1', f: '"product-1"' };
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

    const decoded = new SheetJsWorkbookCodec().decode(workbookBytes(workbook));
    const issues = validateWorkbookSchema(decoded);

    expect(issues.some((issue) => issue.code === 'FORMULA_CELL_NOT_ALLOWED')).toBe(true);
  });

  it('rejects formula and non-text header cells with controlled codec errors', () => {
    const formulaWorkbook = XLSX.utils.book_new();
    const formulaHeader = XLSX.utils.aoa_to_sheet([['value'], [1]]);
    formulaHeader.A1 = { t: 's', v: 'value', f: '"value"' };
    XLSX.utils.book_append_sheet(formulaWorkbook, formulaHeader, 'FormulaHeader');

    const numericWorkbook = XLSX.utils.book_new();
    const numericHeader = XLSX.utils.aoa_to_sheet([[123], [1]]);
    XLSX.utils.book_append_sheet(numericWorkbook, numericHeader, 'NumericHeader');

    const codec = new SheetJsWorkbookCodec();
    for (const bytes of [workbookBytes(formulaWorkbook), workbookBytes(numericWorkbook)]) {
      expect(() => codec.decode(bytes)).toThrowError(WorkbookCodecError);
      try {
        codec.decode(bytes);
      } catch (error) {
        expect(error).toMatchObject({ code: 'INVALID_HEADER_CELL' });
      }
    }
  });

  it('rejects duplicate sheet names and unsupported outbound cell values before XLSX encoding', () => {
    const codec = new SheetJsWorkbookCodec();
    const duplicate: WorkbookNeutralDocument = {
      sheets: [
        { name: 'Data', columns: ['value'], rows: [{ value: 1 }] },
        { name: 'Data', columns: ['value'], rows: [{ value: 2 }] },
      ],
    };
    const invalidCell: WorkbookNeutralDocument = {
      sheets: [{ name: 'Data', columns: ['value'], rows: [{ value: Number.NaN }] }],
    };

    expect(() => codec.encode(duplicate)).toThrowError(WorkbookCodecError);
    try {
      codec.encode(duplicate);
    } catch (error) {
      expect(error).toMatchObject({ code: 'INVALID_SHEET' });
    }

    expect(() => codec.encode(invalidCell)).toThrowError(WorkbookCodecError);
    try {
      codec.encode(invalidCell);
    } catch (error) {
      expect(error).toMatchObject({ code: 'INVALID_CELL_VALUE' });
    }
  });

  it('keeps the spike filesystem-independent by operating only on supplied bytes', () => {
    const codec = new SheetJsWorkbookCodec();
    const source: WorkbookNeutralDocument = {
      sheets: [{ name: 'Data', columns: ['value'], rows: [{ value: 'in-memory' }] }],
    };

    const bytes = codec.encode(source);
    const decoded = codec.decode(bytes);
    expect(decoded.sheets[0].rows[0].value).toBe('in-memory');
  });
});
