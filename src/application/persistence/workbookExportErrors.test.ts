import { expect, it } from 'vitest';
import { workbookExportErrorMessage } from './workbookExportErrors';
import { PersistenceLifecycleOperationalError } from './PersistenceLifecycle';
import { WorkbookCodecError } from '../../storage/workbookCodec';
import { BusinessDatasetWorkbookExportError } from '../../storage/businessDatasetWorkbookExport';

it('shows the real nested encoding cause and a useful smaller-download recovery option', () => {
  const error = new PersistenceLifecycleOperationalError('export', 'EXPORT_FAILED', 'Current business source state could not be exported to XLSX.',
    new WorkbookCodecError('XLSX_ENCODE_FAILED', 'SheetJS failed to encode workbook bytes.', new Error('Text length must not exceed 32767 characters')));
  const message = workbookExportErrorMessage(error);
  expect(message).toContain('Text length must not exceed 32767'); expect(message).toContain('without pictures');
  expect(message).not.toContain(' at ');
});
it('identifies invalid fields without printing private source input', () => {
  const cause = new BusinessDatasetWorkbookExportError('INVALID_DATASET', 'Validation failed', { datasetIssues: [
    { code: 'INVALID_RECORD', path: 'products[2].notes', message: 'Notes must be text.', input: 'private source value' } as any,
  ] });
  const message = workbookExportErrorMessage(new PersistenceLifecycleOperationalError('export', 'EXPORT_FAILED', 'Workbook export failed.', cause));
  expect(message).toContain('products[2].notes: Notes must be text.'); expect(message).not.toContain('private source value');
});
it('recognizes module loading failures and handles cyclic or non-error causes safely', () => {
  const error = new Error('Failed to fetch dynamically imported module');
  expect(workbookExportErrorMessage(error)).toContain('Save your edits');
  Object.assign(error, { causeValue: error });
  expect(workbookExportErrorMessage(error)).toContain('Excel support could not load');
  expect(workbookExportErrorMessage(null)).toBe('The workbook export failed unexpectedly.');
});
