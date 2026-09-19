import type { WorkbookBinaryInput } from './workbookCodec';
import type { WorkbookNeutralDocument } from './workbookSchema';

export interface WorkbookResourceLimits {
  readonly maxWorkbookBytes: number;
  readonly maxWorksheetCount: number;
  readonly maxColumnsPerSheet: number;
  readonly maxRowsPerSheet: number;
  readonly maxTotalRows: number;
  readonly maxTotalCells: number;
}

export type WorkbookResourceLimitKind =
  | 'workbook-bytes'
  | 'worksheet-count'
  | 'sheet-columns'
  | 'sheet-rows'
  | 'total-rows'
  | 'total-cells';

export type WorkbookResourceLimitIssueCode =
  | 'WORKBOOK_BYTES_EXCEEDED'
  | 'WORKSHEET_COUNT_EXCEEDED'
  | 'SHEET_COLUMNS_EXCEEDED'
  | 'SHEET_ROWS_EXCEEDED'
  | 'TOTAL_ROWS_EXCEEDED'
  | 'TOTAL_CELLS_EXCEEDED';

export interface WorkbookResourceLimitIssue {
  readonly code: WorkbookResourceLimitIssueCode;
  readonly kind: WorkbookResourceLimitKind;
  readonly actual: number;
  readonly maximum: number;
  readonly message: string;
  readonly sheetName?: string;
}

export const DEFAULT_WORKBOOK_RESOURCE_LIMITS: Readonly<WorkbookResourceLimits> =
  Object.freeze({
    // Browser-oriented Phase 5 guardrails. These are intentionally well above the
    // expected small-business workbook size while still bounding decode/reconstruction.
    maxWorkbookBytes: 20 * 1024 * 1024,
    maxWorksheetCount: 32,
    maxColumnsPerSheet: 64,
    maxRowsPerSheet: 50_000,
    maxTotalRows: 150_000,
    maxTotalCells: 2_000_000,
  });

const ISSUE_CODE_BY_KIND: Readonly<
  Record<WorkbookResourceLimitKind, WorkbookResourceLimitIssueCode>
> = {
  'workbook-bytes': 'WORKBOOK_BYTES_EXCEEDED',
  'worksheet-count': 'WORKSHEET_COUNT_EXCEEDED',
  'sheet-columns': 'SHEET_COLUMNS_EXCEEDED',
  'sheet-rows': 'SHEET_ROWS_EXCEEDED',
  'total-rows': 'TOTAL_ROWS_EXCEEDED',
  'total-cells': 'TOTAL_CELLS_EXCEEDED',
};

function assertPositiveInteger(name: keyof WorkbookResourceLimits, value: number): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(`${name} must be a positive safe integer.`);
  }
}

export function createWorkbookResourceLimits(
  overrides: Partial<WorkbookResourceLimits> = {},
): Readonly<WorkbookResourceLimits> {
  const limits: WorkbookResourceLimits = {
    ...DEFAULT_WORKBOOK_RESOURCE_LIMITS,
    ...overrides,
  };

  (Object.keys(limits) as Array<keyof WorkbookResourceLimits>).forEach((key) => {
    assertPositiveInteger(key, limits[key]);
  });

  return Object.freeze(limits);
}

export function createWorkbookResourceLimitIssue(
  kind: WorkbookResourceLimitKind,
  actual: number,
  maximum: number,
  sheetName?: string,
): WorkbookResourceLimitIssue {
  const subject = sheetName === undefined ? 'Workbook' : `Worksheet ${sheetName}`;
  const unit =
    kind === 'workbook-bytes'
      ? 'bytes'
      : kind === 'worksheet-count'
        ? 'worksheets'
        : kind === 'sheet-columns'
          ? 'columns'
          : kind === 'sheet-rows' || kind === 'total-rows'
            ? 'rows'
            : 'cells';

  return {
    code: ISSUE_CODE_BY_KIND[kind],
    kind,
    actual,
    maximum,
    sheetName,
    message: `${subject} exceeds the ${kind} resource limit (${actual} ${unit}; maximum ${maximum}).`,
  };
}

export class WorkbookResourceLimitError extends Error {
  readonly issue: WorkbookResourceLimitIssue;

  constructor(issue: WorkbookResourceLimitIssue) {
    super(issue.message);
    this.name = 'WorkbookResourceLimitError';
    this.issue = issue;
  }
}

export function workbookBinaryByteLength(bytes: WorkbookBinaryInput): number {
  return bytes.byteLength;
}

export function validateWorkbookBinaryResourceLimit(
  bytes: WorkbookBinaryInput,
  limits: Readonly<WorkbookResourceLimits> = DEFAULT_WORKBOOK_RESOURCE_LIMITS,
): WorkbookResourceLimitIssue[] {
  const actual = workbookBinaryByteLength(bytes);
  return actual > limits.maxWorkbookBytes
    ? [
        createWorkbookResourceLimitIssue(
          'workbook-bytes',
          actual,
          limits.maxWorkbookBytes,
        ),
      ]
    : [];
}

export function validateNeutralWorkbookResourceLimits(
  document: WorkbookNeutralDocument,
  limits: Readonly<WorkbookResourceLimits> = DEFAULT_WORKBOOK_RESOURCE_LIMITS,
): WorkbookResourceLimitIssue[] {
  const issues: WorkbookResourceLimitIssue[] = [];

  if (document.sheets.length > limits.maxWorksheetCount) {
    issues.push(
      createWorkbookResourceLimitIssue(
        'worksheet-count',
        document.sheets.length,
        limits.maxWorksheetCount,
      ),
    );
  }

  let totalRows = 0;
  let totalCells = 0;

  for (const sheet of document.sheets) {
    const columns = sheet.columns.length;
    const rows = sheet.rows.length;
    const cells = columns * (rows + 1); // Includes the header row represented by `columns`.

    totalRows += rows;
    totalCells += cells;

    if (columns > limits.maxColumnsPerSheet) {
      issues.push(
        createWorkbookResourceLimitIssue(
          'sheet-columns',
          columns,
          limits.maxColumnsPerSheet,
          sheet.name,
        ),
      );
    }

    if (rows > limits.maxRowsPerSheet) {
      issues.push(
        createWorkbookResourceLimitIssue(
          'sheet-rows',
          rows,
          limits.maxRowsPerSheet,
          sheet.name,
        ),
      );
    }
  }

  if (totalRows > limits.maxTotalRows) {
    issues.push(
      createWorkbookResourceLimitIssue('total-rows', totalRows, limits.maxTotalRows),
    );
  }

  if (totalCells > limits.maxTotalCells) {
    issues.push(
      createWorkbookResourceLimitIssue('total-cells', totalCells, limits.maxTotalCells),
    );
  }

  return issues;
}

export function assertNeutralWorkbookResourceLimits(
  document: WorkbookNeutralDocument,
  limits: Readonly<WorkbookResourceLimits> = DEFAULT_WORKBOOK_RESOURCE_LIMITS,
): void {
  const issue = validateNeutralWorkbookResourceLimits(document, limits)[0];
  if (issue) throw new WorkbookResourceLimitError(issue);
}
