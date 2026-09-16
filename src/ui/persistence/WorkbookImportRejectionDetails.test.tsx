// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PersistenceLifecycleRejected } from '../../application/persistence/PersistenceLifecycle';
import type { BusinessDatasetWorkbookImportIssue } from '../../storage/businessDatasetWorkbookImport';
import { WorkbookImportRejectionDetails } from './WorkbookImportRejectionDetails';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function importIssue(
  stage: BusinessDatasetWorkbookImportIssue['stage'],
  code: string,
  extra: Partial<BusinessDatasetWorkbookImportIssue> = {},
): BusinessDatasetWorkbookImportIssue {
  return {
    stage,
    code,
    message: `Problem for ${code}.`,
    ...extra,
  };
}

async function renderResult(result: PersistenceLifecycleRejected) {
  await act(async () => root.render(<WorkbookImportRejectionDetails result={result} />));
}

function text(): string {
  return container.textContent ?? '';
}

describe('WorkbookImportRejectionDetails Phase 5.5C2 recovery guidance', () => {
  it('keeps raw workbook issue evidence visible with sheet, row, column, path, code, and message', async () => {
    await renderResult({
      status: 'rejected',
      stage: 'import',
      issues: [
        importIssue('schema', 'INVALID_CELL_TYPE', {
          sheetName: 'Materials',
          rowIndex: 2,
          excelRow: 4,
          column: 'packageCost',
          path: 'materials[2].packageCost',
          message: 'packageCost must be a number.',
        }),
      ],
    });

    const content = text();
    expect(content).toContain('Invalid workbook values');
    expect(content).toContain('INVALID_CELL_TYPE');
    expect(content).toContain('packageCost must be a number.');
    expect(content).toContain('Sheet Materials');
    expect(content).toContain('Excel row 4');
    expect(content).toContain('Column packageCost');
    expect(content).toContain('Path materials[2].packageCost');
    expect(content).toContain('technical source of truth');
  });

  it('renders deterministic future-version guidance from the recovery classifier', async () => {
    await renderResult({
      status: 'rejected',
      stage: 'import',
      issues: [
        importIssue('compatibility', 'UNSUPPORTED_FUTURE_VERSION', {
          sourceVersion: { workbookFormatVersion: 3, datasetSchemaVersion: 4 },
          targetVersion: { workbookFormatVersion: 1, datasetSchemaVersion: 1 },
        }),
      ],
    });

    const content = text();
    expect(content).toContain('Unsupported or incompatible workbook version');
    expect(content).toContain('compatible or newer Craft Business Manager version');
    expect(content).toContain('Source version: workbook v3 / dataset v4');
    expect(content).toContain('Supported target: workbook v1 / dataset v1');
    expect(container.querySelector('[data-recovery-action="restore-known-good-backup"]')).toBeNull();
  });

  it('renders corrupt-workbook recovery with browser-truthful known-good-copy guidance', async () => {
    await renderResult({
      status: 'rejected',
      stage: 'import',
      issues: [importIssue('codec', 'XLSX_DECODE_FAILED', { message: 'Workbook bytes could not be decoded.' })],
    });

    const content = text();
    expect(content).toContain('Unreadable or corrupt workbook');
    expect(content).toContain('known-good workbook copy that you already possess');
    expect(content).toContain('Browser restore note');
    expect(content).toContain('does not create, discover, or manage a Phase 5.4B pre-save transport backup');
    expect(content).not.toContain('backup created');
    expect(content).not.toContain('managed backup path');
  });

  it('renders resource-limit usage and reduce-size guidance without manufacturing backup guidance', async () => {
    await renderResult({
      status: 'rejected',
      stage: 'import',
      issues: [
        importIssue('resource-limit', 'WORKBOOK_BYTES_EXCEEDED', {
          limitKind: 'workbook-bytes',
          actual: 25_000_000,
          maximum: 20_000_000,
        }),
      ],
    });

    const content = text();
    expect(content).toContain('Workbook resource limit');
    expect(content).toContain('Reduce the workbook size or content');
    expect(content).toContain('25,000,000 / 20,000,000 maximum');
    expect(content).not.toContain('Browser restore note');
  });

  it('renders invalid-business-data guidance and preserves the raw business path', async () => {
    await renderResult({
      status: 'rejected',
      stage: 'import',
      issues: [
        importIssue('dataset', 'MISSING_REFERENCE', {
          sheetName: 'Products',
          excelRow: 2,
          path: 'products[0].mixPresetId',
          message: 'Product references a missing mix preset.',
        }),
      ],
    });

    const content = text();
    expect(content).toContain('Invalid business data');
    expect(content).toContain('Correct the invalid workbook values or referenced business data');
    expect(content).toContain('MISSING_REFERENCE');
    expect(content).toContain('Path products[0].mixPresetId');
  });

  it('shows deterministic stage counts across mixed rejection categories', async () => {
    await renderResult({
      status: 'rejected',
      stage: 'import',
      issues: [
        importIssue('dataset', 'MISSING_REFERENCE'),
        importIssue('schema', 'INVALID_CELL_TYPE'),
        importIssue('compatibility', 'UNSUPPORTED_FUTURE_VERSION'),
      ],
    });

    const stageSummary = container.querySelector('[aria-label="Workbook issue stage summary"]')?.textContent ?? '';
    expect(stageSummary).toContain('Version compatibility: 1');
    expect(stageSummary).toContain('Workbook structure / values: 1');
    expect(stageSummary).toContain('Business data validation: 1');
    expect(text()).toContain('Unsupported or incompatible workbook version');
  });

  it('keeps defensive hydration rejection distinct while preserving its raw dataset validation issue', async () => {
    await renderResult({
      status: 'rejected',
      stage: 'hydrate',
      issues: [
        {
          code: 'MISSING_REFERENCE',
          collection: 'products',
          index: 0,
          field: 'mixPresetId',
          path: 'products[0].mixPresetId',
          message: 'Synthetic hydration validation rejection.',
        },
      ],
    });

    const content = text();
    expect(content).toContain('Dataset validation');
    expect(content).toContain('MISSING_REFERENCE');
    expect(content).toContain('Collection products');
    expect(content).toContain('Record 0');
    expect(content).toContain('Field mixPresetId');
    expect(content).toContain('Synthetic hydration validation rejection.');
    expect(container.querySelector('[aria-label="Workbook recovery summary"]')).toBeNull();
  });
});
