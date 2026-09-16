// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserWorkbookImportCommand } from '../../application/persistence/BrowserWorkbookImportCommand';
import { PersistenceLifecycleOperationalError } from '../../application/persistence/PersistenceLifecycle';
import type { PersistenceWorkbookApplyResult } from '../../application/persistence/PersistenceCoordinator';
import { WorkbookImportPanel } from './WorkbookImportPanel';

const rejected: PersistenceWorkbookApplyResult = {
  status: 'rejected',
  stage: 'import',
  issues: [
    {
      stage: 'schema',
      code: 'INVALID_CELL_TYPE',
      message: 'packageCost must be a number.',
      sheetName: 'Materials',
      excelRow: 3,
      column: 'packageCost',
    },
  ],
};

const hydrated: PersistenceWorkbookApplyResult = {
  status: 'hydrated',
  metadata: {
    formatId: 'craft-business-manager',
    workbookFormatVersion: 1,
    datasetSchemaVersion: 1,
    exportedAt: '2026-09-17T00:00:00.000Z',
  },
};

let container: HTMLDivElement;
let root: Root;
const onHydrated = vi.fn(() => {});

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  onHydrated.mockClear();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function workbookFile(name: string): File {
  const buffer = new ArrayBuffer(3);
  new Uint8Array(buffer).set([1, 2, 3]);
  return {
    name,
    size: 3,
    arrayBuffer: vi.fn(async () => buffer),
  } as unknown as File;
}

function button(text: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll('button')).find((item) =>
    item.textContent?.includes(text),
  );
  if (!found) throw new Error(`Missing button: ${text}`);
  return found;
}

async function choose(name: string) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('Missing workbook input.');
  Object.defineProperty(input, 'files', { configurable: true, value: [workbookFile(name)] });
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
}

async function click(text: string) {
  await act(async () => button(text).click());
}

async function mount(implementation: (bytes: Uint8Array) => Promise<PersistenceWorkbookApplyResult>) {
  const command = new BrowserWorkbookImportCommand({ importAndApplyWorkbook: vi.fn(implementation) });
  await act(async () => root.render(<WorkbookImportPanel command={command} onHydrated={onHydrated} />));
  return command;
}

describe('WorkbookImportPanel Phase 5.5C2 rejection and recovery workflow', () => {
  it('shows raw validation detail and derived recovery guidance after expected rejection without refreshing', async () => {
    const command = await mount(async () => rejected);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await choose('invalid.xlsx');

    await click('Apply import');

    expect(onHydrated).not.toHaveBeenCalled();
    expect(command.getPendingSelection()).toEqual({ name: 'invalid.xlsx', byteLength: 3 });
    expect(container.querySelector('[aria-label="Workbook recovery summary"]')?.textContent).toContain(
      'Invalid workbook values',
    );
    expect(container.querySelector('[aria-label="Raw workbook validation issues"]')?.textContent).toContain(
      'INVALID_CELL_TYPE',
    );
    expect(container.querySelector('[aria-label="Raw workbook validation issues"]')?.textContent).toContain(
      'packageCost must be a number.',
    );
  });

  it('keeps unexpected operational failure separate from expected validation/recovery details', async () => {
    const failure = new PersistenceLifecycleOperationalError(
      'import',
      'IMPORT_FAILED',
      'Workbook import failed unexpectedly.',
      new Error('synthetic internal failure'),
    );
    await mount(async () => {
      throw failure;
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await choose('operation-failure.xlsx');

    await click('Apply import');

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Workbook import failed unexpectedly.',
    );
    expect(container.querySelector('.workbook-recovery-panel')).toBeNull();
    expect(onHydrated).not.toHaveBeenCalled();
  });

  it('clears stale rejection details when a later import succeeds', async () => {
    const importAndApplyWorkbook = vi
      .fn<(bytes: Uint8Array) => Promise<PersistenceWorkbookApplyResult>>()
      .mockResolvedValueOnce(rejected)
      .mockResolvedValueOnce(hydrated);
    const command = new BrowserWorkbookImportCommand({ importAndApplyWorkbook });
    await act(async () => root.render(<WorkbookImportPanel command={command} onHydrated={onHydrated} />));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await choose('invalid.xlsx');
    await click('Apply import');
    expect(container.querySelector('.workbook-recovery-panel')).not.toBeNull();

    await choose('valid.xlsx');
    expect(container.querySelector('.workbook-recovery-panel')).toBeNull();
    await click('Apply import');

    expect(onHydrated).toHaveBeenCalledOnce();
    expect(container.querySelector('.workbook-recovery-panel')).toBeNull();
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Imported valid.xlsx');
  });
});
