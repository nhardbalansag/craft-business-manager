import { describe, expect, it } from 'vitest';
import type {
  BusinessDatasetWorkbookImportIssue,
  BusinessDatasetWorkbookImportIssueStage,
} from './businessDatasetWorkbookImport';
import {
  classifyWorkbookImportIssueRecovery,
  summarizeWorkbookImportRecovery,
  type WorkbookRecoveryCategory,
} from './workbookRecoveryDiagnostics';

function issue(
  stage: BusinessDatasetWorkbookImportIssueStage,
  code: string,
  extra: Partial<BusinessDatasetWorkbookImportIssue> = {},
): BusinessDatasetWorkbookImportIssue {
  return {
    stage,
    code,
    message: `${stage}:${code}`,
    ...extra,
  };
}

describe('workbook recovery diagnostic classification', () => {
  it.each<{
    label: string;
    input: BusinessDatasetWorkbookImportIssue;
    expected: WorkbookRecoveryCategory;
  }>([
    {
      label: 'truncated or corrupt decode failure',
      input: issue('codec', 'XLSX_DECODE_FAILED'),
      expected: 'unreadable-or-corrupt-workbook',
    },
    {
      label: 'over-limit workbook',
      input: issue('resource-limit', 'WORKBOOK_BYTES_EXCEEDED', {
        limitKind: 'workbook-bytes',
        actual: 21,
        maximum: 20,
      }),
      expected: 'resource-limit',
    },
    {
      label: 'future version',
      input: issue('compatibility', 'UNSUPPORTED_FUTURE_VERSION'),
      expected: 'unsupported-or-incompatible-version',
    },
    {
      label: 'missing _Meta',
      input: issue('compatibility', 'MISSING_META_SHEET'),
      expected: 'workbook-structure',
    },
    {
      label: 'missing required sheet',
      input: issue('schema', 'MISSING_REQUIRED_SHEET', { sheetName: 'Products' }),
      expected: 'workbook-structure',
    },
    {
      label: 'missing required header',
      input: issue('schema', 'MISSING_REQUIRED_COLUMN', {
        sheetName: 'Materials',
        column: 'id',
      }),
      expected: 'workbook-structure',
    },
    {
      label: 'duplicate header',
      input: issue('schema', 'DUPLICATE_COLUMN', {
        sheetName: 'Materials',
        column: 'id',
      }),
      expected: 'workbook-structure',
    },
    {
      label: 'malformed number or boolean',
      input: issue('schema', 'INVALID_CELL_TYPE', {
        sheetName: 'Products',
        column: 'safetyWasteRate',
      }),
      expected: 'invalid-workbook-values',
    },
    {
      label: 'invalid enum',
      input: issue('schema', 'INVALID_ENUM_TOKEN'),
      expected: 'invalid-workbook-values',
    },
    {
      label: 'invalid unit',
      input: issue('schema', 'INVALID_UNIT_TOKEN'),
      expected: 'invalid-workbook-values',
    },
    {
      label: 'formula in authoritative data',
      input: issue('schema', 'FORMULA_CELL_NOT_ALLOWED'),
      expected: 'invalid-workbook-values',
    },
    {
      label: 'orphan normalized child row',
      input: issue('reconstruction', 'ORPHAN_CHILD_ROW'),
      expected: 'invalid-workbook-values',
    },
    {
      label: 'invalid source reference',
      input: issue('dataset', 'MISSING_REFERENCE'),
      expected: 'invalid-business-data',
    },
    {
      label: 'product composition cycle',
      input: issue('dataset', 'INVALID_COMPONENT_GRAPH'),
      expected: 'invalid-business-data',
    },
    {
      label: 'unexpected migration operational failure',
      input: issue('migration', 'MIGRATION_STEP_FAILED'),
      expected: 'unexpected-import-failure',
    },
  ])('classifies $label as $expected', ({ input, expected }) => {
    expect(classifyWorkbookImportIssueRecovery(input)).toBe(expected);
  });

  it('summarizes deterministic stage/category counts and primary precedence', () => {
    const issues = [
      issue('dataset', 'MISSING_REFERENCE'),
      issue('schema', 'INVALID_CELL_TYPE'),
      issue('compatibility', 'UNSUPPORTED_FUTURE_VERSION'),
      issue('codec', 'XLSX_DECODE_FAILED'),
      issue('resource-limit', 'TOTAL_CELLS_EXCEEDED'),
    ];

    const summary = summarizeWorkbookImportRecovery(issues);

    expect(summary.primaryCategory).toBe('resource-limit');
    expect(summary.issueCount).toBe(5);
    expect(summary.stageCounts).toMatchObject({
      'resource-limit': 1,
      codec: 1,
      compatibility: 1,
      schema: 1,
      dataset: 1,
    });
    expect(summary.categoryCounts).toMatchObject({
      'resource-limit': 1,
      'unreadable-or-corrupt-workbook': 1,
      'unsupported-or-incompatible-version': 1,
      'invalid-workbook-values': 1,
      'invalid-business-data': 1,
    });
  });

  it('produces the same summary regardless of raw issue ordering', () => {
    const issues = [
      issue('dataset', 'INVALID_COMPONENT_GRAPH'),
      issue('schema', 'MISSING_REQUIRED_COLUMN'),
      issue('compatibility', 'UNSUPPORTED_FUTURE_VERSION'),
    ];

    const forward = summarizeWorkbookImportRecovery(issues);
    const reverse = summarizeWorkbookImportRecovery([...issues].reverse());

    expect(reverse).toEqual(forward);
    expect(forward.primaryCategory).toBe('unsupported-or-incompatible-version');
    expect(forward.recommendedActions).toEqual([
      'open-with-compatible-or-newer-app',
      'select-another-file',
      'repair-workbook-structure',
      'restore-known-good-backup',
      'correct-source-data',
    ]);
  });

  it('preserves original raw issue evidence unchanged', () => {
    const rawIssues: BusinessDatasetWorkbookImportIssue[] = [
      issue('schema', 'INVALID_CELL_TYPE', {
        sheetName: 'Materials',
        rowIndex: 2,
        excelRow: 4,
        column: 'packageCost',
        input: { original: 'not-a-number' },
      }),
      issue('dataset', 'MISSING_REFERENCE', {
        path: 'products[0].mixPresetId',
      }),
    ];
    const before = structuredClone(rawIssues);

    const summary = summarizeWorkbookImportRecovery(rawIssues);

    expect(rawIssues).toEqual(before);
    expect(summary.issueCount).toBe(rawIssues.length);
    expect(Object.prototype.hasOwnProperty.call(summary, 'issues')).toBe(false);
  });

  it('keeps backup restore advisory and never claims live state changed', () => {
    const summary = summarizeWorkbookImportRecovery([
      issue('codec', 'XLSX_DECODE_FAILED'),
    ]);

    expect(summary.backupRestoreRecommended).toBe(true);
    expect(summary.recommendedActions).toEqual([
      'select-another-file',
      'restore-known-good-backup',
    ]);
    expect(summary.liveStateChanged).toBe(false);
  });

  it('does not recommend backup restore for resource limits or version incompatibility alone', () => {
    const resource = summarizeWorkbookImportRecovery([
      issue('resource-limit', 'WORKBOOK_BYTES_EXCEEDED'),
    ]);
    const version = summarizeWorkbookImportRecovery([
      issue('compatibility', 'UNSUPPORTED_FUTURE_VERSION'),
    ]);

    expect(resource.backupRestoreRecommended).toBe(false);
    expect(resource.recommendedActions).toEqual(['reduce-workbook-size', 'select-another-file']);
    expect(version.backupRestoreRecommended).toBe(false);
    expect(version.recommendedActions).toEqual([
      'open-with-compatible-or-newer-app',
      'select-another-file',
    ]);
  });

  it('maps reconstruction operational failures to retry/report instead of pretending source repair is sufficient', () => {
    const summary = summarizeWorkbookImportRecovery([
      issue('reconstruction', 'RECONSTRUCTION_FAILED', {
        causeValue: new Error('synthetic internal failure'),
      }),
    ]);

    expect(summary.primaryCategory).toBe('unexpected-import-failure');
    expect(summary.recommendedActions).toEqual(['retry-or-report-unexpected-error']);
    expect(summary.backupRestoreRecommended).toBe(false);
  });

  it('rejects empty issue collections because there is no recovery failure to classify', () => {
    expect(() => summarizeWorkbookImportRecovery([])).toThrowError(TypeError);
  });
});
