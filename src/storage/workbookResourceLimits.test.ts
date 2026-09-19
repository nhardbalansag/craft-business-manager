import { describe, expect, it } from 'vitest';
import type { WorkbookNeutralDocument } from './workbookSchema';
import {
  DEFAULT_WORKBOOK_RESOURCE_LIMITS,
  WorkbookResourceLimitError,
  assertNeutralWorkbookResourceLimits,
  createWorkbookResourceLimits,
  validateNeutralWorkbookResourceLimits,
  validateWorkbookBinaryResourceLimit,
} from './workbookResourceLimits';

function document(
  sheets: WorkbookNeutralDocument['sheets'],
): WorkbookNeutralDocument {
  return { sheets };
}

describe('workbook resource limits', () => {
  it('publishes immutable practical defaults', () => {
    expect(DEFAULT_WORKBOOK_RESOURCE_LIMITS).toEqual({
      maxWorkbookBytes: 20 * 1024 * 1024,
      maxWorksheetCount: 32,
      maxColumnsPerSheet: 64,
      maxRowsPerSheet: 50_000,
      maxTotalRows: 150_000,
      maxTotalCells: 2_000_000,
    });
    expect(Object.isFrozen(DEFAULT_WORKBOOK_RESOURCE_LIMITS)).toBe(true);
  });

  it('creates frozen policies and rejects invalid limits', () => {
    const limits = createWorkbookResourceLimits({ maxWorkbookBytes: 123 });
    expect(limits.maxWorkbookBytes).toBe(123);
    expect(Object.isFrozen(limits)).toBe(true);

    expect(() => createWorkbookResourceLimits({ maxRowsPerSheet: 0 })).toThrow(TypeError);
    expect(() => createWorkbookResourceLimits({ maxTotalCells: 1.5 })).toThrow(TypeError);
  });

  it('accepts binary input exactly at the byte limit and rejects one byte over', () => {
    const limits = createWorkbookResourceLimits({ maxWorkbookBytes: 3 });
    expect(validateWorkbookBinaryResourceLimit(new Uint8Array([1, 2, 3]), limits)).toEqual([]);
    expect(validateWorkbookBinaryResourceLimit(new Uint8Array([1, 2, 3, 4]), limits)).toEqual([
      expect.objectContaining({
        code: 'WORKBOOK_BYTES_EXCEEDED',
        kind: 'workbook-bytes',
        actual: 4,
        maximum: 3,
      }),
    ]);
  });

  it('reports worksheet-count excess deterministically', () => {
    const limits = createWorkbookResourceLimits({ maxWorksheetCount: 1 });
    const issues = validateNeutralWorkbookResourceLimits(
      document([
        { name: 'One', columns: [], rows: [] },
        { name: 'Two', columns: [], rows: [] },
      ]),
      limits,
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'WORKSHEET_COUNT_EXCEEDED',
        actual: 2,
        maximum: 1,
      }),
    );
  });

  it('reports per-sheet column and row excess with sheet context', () => {
    const limits = createWorkbookResourceLimits({
      maxColumnsPerSheet: 2,
      maxRowsPerSheet: 1,
    });
    const issues = validateNeutralWorkbookResourceLimits(
      document([
        {
          name: 'Materials',
          columns: ['a', 'b', 'c'],
          rows: [{ a: 1 }, { a: 2 }],
        },
      ]),
      limits,
    );

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'SHEET_COLUMNS_EXCEEDED',
          sheetName: 'Materials',
          actual: 3,
          maximum: 2,
        }),
        expect.objectContaining({
          code: 'SHEET_ROWS_EXCEEDED',
          sheetName: 'Materials',
          actual: 2,
          maximum: 1,
        }),
      ]),
    );
  });

  it('reports total rows across sheets', () => {
    const limits = createWorkbookResourceLimits({ maxTotalRows: 2 });
    const issues = validateNeutralWorkbookResourceLimits(
      document([
        { name: 'One', columns: ['id'], rows: [{ id: 1 }, { id: 2 }] },
        { name: 'Two', columns: ['id'], rows: [{ id: 3 }] },
      ]),
      limits,
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'TOTAL_ROWS_EXCEEDED',
        actual: 3,
        maximum: 2,
      }),
    );
  });

  it('counts header slots in the total-cell safety budget', () => {
    const limits = createWorkbookResourceLimits({ maxTotalCells: 5 });
    const issues = validateNeutralWorkbookResourceLimits(
      document([
        {
          name: 'Data',
          columns: ['a', 'b'],
          rows: [{ a: 1, b: 2 }, { a: 3, b: 4 }],
        },
      ]),
      limits,
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'TOTAL_CELLS_EXCEEDED',
        actual: 6,
        maximum: 5,
      }),
    );
  });

  it('throws a typed error from the assertion boundary', () => {
    const limits = createWorkbookResourceLimits({ maxRowsPerSheet: 1 });
    const oversized = document([
      { name: 'Data', columns: ['id'], rows: [{ id: 1 }, { id: 2 }] },
    ]);

    expect(() => assertNeutralWorkbookResourceLimits(oversized, limits)).toThrow(
      WorkbookResourceLimitError,
    );
    try {
      assertNeutralWorkbookResourceLimits(oversized, limits);
    } catch (error) {
      expect(error).toMatchObject({
        issue: expect.objectContaining({ code: 'SHEET_ROWS_EXCEEDED' }),
      });
    }
  });
});
