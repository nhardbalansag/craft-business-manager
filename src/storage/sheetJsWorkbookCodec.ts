import * as XLSX from 'xlsx';
import type {
  WorkbookFormulaCell,
  WorkbookNeutralDocument,
  WorkbookNeutralSheet,
} from './workbookSchema';
import {
  WorkbookCodecError,
  type WorkbookBinaryInput,
  type WorkbookCodec,
} from './workbookCodec';
import {
  WorkbookResourceLimitError,
  createWorkbookResourceLimitIssue,
  createWorkbookResourceLimits,
  type WorkbookResourceLimits,
} from './workbookResourceLimits';

export const SHEETJS_CE_VERSION = XLSX.version;
export const SHEETJS_CE_EXPECTED_VERSION = '0.20.3' as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFormulaValue(value: unknown): value is WorkbookFormulaCell {
  return isRecord(value) && typeof value.formula === 'string';
}

function assertDocument(document: WorkbookNeutralDocument): void {
  if (!document || !Array.isArray(document.sheets)) {
    throw new WorkbookCodecError(
      'INVALID_DOCUMENT',
      'Workbook codec input must provide a sheets array.',
      document,
    );
  }

  const seenNames = new Set<string>();
  for (const sheet of document.sheets) {
    if (
      !sheet ||
      typeof sheet.name !== 'string' ||
      sheet.name.length === 0 ||
      !Array.isArray(sheet.columns) ||
      !sheet.columns.every((column: unknown) => typeof column === 'string') ||
      !Array.isArray(sheet.rows)
    ) {
      throw new WorkbookCodecError(
        'INVALID_SHEET',
        'Each workbook sheet must provide a non-empty name, string columns, and rows.',
        sheet,
      );
    }

    if (seenNames.has(sheet.name)) {
      throw new WorkbookCodecError(
        'INVALID_SHEET',
        `Workbook codec input contains duplicate sheet ${sheet.name}.`,
        sheet.name,
      );
    }
    seenNames.add(sheet.name);
  }
}

function encodeCell(value: unknown, sheetName: string, column: string): string | number | boolean | null {
  if (value === null || value === undefined) return null;

  if (isFormulaValue(value)) {
    throw new WorkbookCodecError(
      'FORMULA_WRITE_NOT_ALLOWED',
      `Formula values cannot be written by the authoritative workbook codec (${sheetName}.${column}).`,
      value,
    );
  }

  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  throw new WorkbookCodecError(
    'INVALID_CELL_VALUE',
    `Workbook cell ${sheetName}.${column} must be a finite number, string, boolean, null, or undefined.`,
    value,
  );
}

function encodeSheet(sheet: WorkbookNeutralSheet): XLSX.WorkSheet {
  const matrix: (string | number | boolean | null)[][] = [
    [...sheet.columns],
    ...sheet.rows.map((row) =>
      sheet.columns.map((column) => encodeCell(row[column], sheet.name, column)),
    ),
  ];

  return XLSX.utils.aoa_to_sheet(matrix);
}

function decodeHeaderCell(
  worksheet: XLSX.WorkSheet,
  row: number,
  column: number,
  sheetName: string,
): string {
  const address = XLSX.utils.encode_cell({ r: row, c: column });
  const cell = worksheet[address];

  if (!cell || cell.v === null || cell.v === undefined) return '';
  if (typeof cell.f === 'string' && cell.f.length > 0) {
    throw new WorkbookCodecError(
      'INVALID_HEADER_CELL',
      `Worksheet ${sheetName} contains a formula in its header row at ${address}.`,
      cell.f,
    );
  }
  if (typeof cell.v !== 'string') {
    throw new WorkbookCodecError(
      'INVALID_HEADER_CELL',
      `Worksheet ${sheetName} header ${address} must be text.`,
      cell.v,
    );
  }
  return cell.v;
}

function decodeDataCell(cell: XLSX.CellObject | undefined): unknown {
  if (!cell) return undefined;

  if (typeof cell.f === 'string' && cell.f.length > 0) {
    const formulaCell: WorkbookFormulaCell = { formula: cell.f };
    if (cell.v !== undefined && cell.v !== null) formulaCell.cachedValue = cell.v;
    return formulaCell;
  }

  return cell.v;
}

interface WorksheetResourceMetrics {
  readonly columns: number;
  readonly rows: number;
  readonly cells: number;
}

function worksheetResourceMetrics(worksheet: XLSX.WorkSheet): WorksheetResourceMetrics {
  const ref = worksheet['!ref'];
  if (!ref) return { columns: 0, rows: 0, cells: 0 };

  const range = XLSX.utils.decode_range(ref);
  const columns = range.e.c - range.s.c + 1;
  const rows = Math.max(0, range.e.r - range.s.r);
  return {
    columns,
    rows,
    cells: columns * (rows + 1), // Includes the header row.
  };
}

function worksheetOrThrow(workbook: XLSX.WorkBook, name: string): XLSX.WorkSheet {
  const worksheet = workbook.Sheets[name];
  if (!worksheet) {
    throw new WorkbookCodecError(
      'XLSX_DECODE_FAILED',
      `Workbook references missing worksheet ${name}.`,
    );
  }
  return worksheet;
}

function assertWorkbookRangesWithinLimits(
  workbook: XLSX.WorkBook,
  limits: Readonly<WorkbookResourceLimits>,
): void {
  if (workbook.SheetNames.length > limits.maxWorksheetCount) {
    throw new WorkbookResourceLimitError(
      createWorkbookResourceLimitIssue(
        'worksheet-count',
        workbook.SheetNames.length,
        limits.maxWorksheetCount,
      ),
    );
  }

  let totalRows = 0;
  let totalCells = 0;

  for (const name of workbook.SheetNames) {
    const metrics = worksheetResourceMetrics(worksheetOrThrow(workbook, name));
    totalRows += metrics.rows;
    totalCells += metrics.cells;

    if (metrics.columns > limits.maxColumnsPerSheet) {
      throw new WorkbookResourceLimitError(
        createWorkbookResourceLimitIssue(
          'sheet-columns',
          metrics.columns,
          limits.maxColumnsPerSheet,
          name,
        ),
      );
    }

    if (metrics.rows > limits.maxRowsPerSheet) {
      throw new WorkbookResourceLimitError(
        createWorkbookResourceLimitIssue(
          'sheet-rows',
          metrics.rows,
          limits.maxRowsPerSheet,
          name,
        ),
      );
    }
  }

  if (totalRows > limits.maxTotalRows) {
    throw new WorkbookResourceLimitError(
      createWorkbookResourceLimitIssue('total-rows', totalRows, limits.maxTotalRows),
    );
  }

  if (totalCells > limits.maxTotalCells) {
    throw new WorkbookResourceLimitError(
      createWorkbookResourceLimitIssue('total-cells', totalCells, limits.maxTotalCells),
    );
  }
}

function decodeSheet(name: string, worksheet: XLSX.WorkSheet): WorkbookNeutralSheet {
  const ref = worksheet['!ref'];
  if (!ref) return { name, columns: [], rows: [] };

  const range = XLSX.utils.decode_range(ref);
  const columns: string[] = [];
  for (let column = range.s.c; column <= range.e.c; column += 1) {
    columns.push(decodeHeaderCell(worksheet, range.s.r, column, name));
  }

  const rows: Record<string, unknown>[] = [];
  for (let row = range.s.r + 1; row <= range.e.r; row += 1) {
    const decoded: Record<string, unknown> = {};
    let hasCell = false;

    for (let offset = 0; offset < columns.length; offset += 1) {
      const column = range.s.c + offset;
      const address = XLSX.utils.encode_cell({ r: row, c: column });
      const cell = worksheet[address];
      if (!cell) continue;

      decoded[columns[offset]] = decodeDataCell(cell);
      hasCell = true;
    }

    if (hasCell) rows.push(decoded);
  }

  return { name, columns, rows };
}

export class SheetJsWorkbookCodec implements WorkbookCodec {
  private readonly resourceLimits: Readonly<WorkbookResourceLimits>;

  constructor(resourceLimits: Partial<WorkbookResourceLimits> = {}) {
    this.resourceLimits = createWorkbookResourceLimits(resourceLimits);
  }

  encode(document: WorkbookNeutralDocument): Uint8Array {
    assertDocument(document);

    try {
      const workbook = XLSX.utils.book_new();
      for (const sheet of document.sheets) {
        XLSX.utils.book_append_sheet(workbook, encodeSheet(sheet), sheet.name);
      }

      const result = XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'array',
        compression: true,
      });

      if (result instanceof ArrayBuffer) return new Uint8Array(result);
      if (result instanceof Uint8Array) return new Uint8Array(result);

      throw new WorkbookCodecError(
        'XLSX_ENCODE_FAILED',
        'SheetJS returned an unsupported workbook byte representation.',
        result,
      );
    } catch (error) {
      if (error instanceof WorkbookCodecError) throw error;
      throw new WorkbookCodecError('XLSX_ENCODE_FAILED', 'SheetJS failed to encode workbook bytes.', error);
    }
  }

  decode(bytes: WorkbookBinaryInput): WorkbookNeutralDocument {
    try {
      const workbook = XLSX.read(bytes, {
        cellFormula: true,
        cellDates: false,
      });

      assertWorkbookRangesWithinLimits(workbook, this.resourceLimits);

      return {
        sheets: workbook.SheetNames.map((name) =>
          decodeSheet(name, worksheetOrThrow(workbook, name)),
        ),
      };
    } catch (error) {
      if (error instanceof WorkbookCodecError || error instanceof WorkbookResourceLimitError) {
        throw error;
      }
      throw new WorkbookCodecError('XLSX_DECODE_FAILED', 'SheetJS failed to decode workbook bytes.', error);
    }
  }
}
