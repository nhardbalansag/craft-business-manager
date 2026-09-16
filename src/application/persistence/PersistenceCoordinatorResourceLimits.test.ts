import { describe, expect, it, vi } from 'vitest';
import { PersistenceCoordinator } from './PersistenceCoordinator';
import type { WorkbookCodec } from '../../storage/workbookCodec';
import {
  WorkbookResourceLimitError,
  createWorkbookResourceLimitIssue,
} from '../../storage/workbookResourceLimits';

describe('PersistenceCoordinator resource-limit safety', () => {
  it('returns a controlled import rejection and never calls hydration after an early codec range limit', async () => {
    const snapshot = vi.fn();
    const hydrate = vi.fn();
    const codec: WorkbookCodec = {
      encode: () => new Uint8Array(),
      decode: () => {
        throw new WorkbookResourceLimitError(
          createWorkbookResourceLimitIssue('sheet-rows', 50_001, 50_000, 'Materials'),
        );
      },
    };
    const coordinator = new PersistenceCoordinator({ snapshot }, { hydrate }, codec);

    const result = await coordinator.importAndApplyWorkbook(new Uint8Array([1, 2, 3]));

    expect(result).toEqual({
      status: 'rejected',
      stage: 'import',
      issues: [
        expect.objectContaining({
          stage: 'resource-limit',
          code: 'SHEET_ROWS_EXCEEDED',
          sheetName: 'Materials',
          actual: 50_001,
          maximum: 50_000,
        }),
      ],
    });
    expect(hydrate).not.toHaveBeenCalled();
    expect(snapshot).not.toHaveBeenCalled();
  });
});
