// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserWorkbookImportCommand } from '../../application/persistence/BrowserWorkbookImportCommand';
import { PersistenceLifecycleOperationalError } from '../../application/persistence/PersistenceLifecycle';
import type { PersistenceWorkbookApplyResult } from '../../application/persistence/PersistenceCoordinator';
import { WorkbookImportPanel } from './WorkbookImportPanel';

const hydratedResult: PersistenceWorkbookApplyResult = {
  status: 'hydrated',
  metadata: {
    formatId: 'craft-business-manager',
    workbookFormatVersion: 1,
    datasetSchemaVersion: 1,
    exportedAt: '2026-09-16T06:10:00.000Z',
  },
};

const rejectedResult: PersistenceWorkbookApplyResult = {
  status: 'rejected',
  stage: 'hydrate',
  issues: [
    {
      code: 'INVALID_RECORD',
      message: 'Synthetic invalid product.',
      path: 'products[0]',
    },
  ],
};

let container: HTMLDivElement;
let root: Root;
let onHydrated: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  onHydrated = vi.fn();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function arrayBuffer(bytes: readonly number[]): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.length);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function workbookFile(
  name = 'business.xlsx',
  bytes: readonly number[] = [1, 2, 3],
  read: () => Promise<ArrayBuffer> = async () => arrayBuffer(bytes),
): File {
  return {
    name,
    size: bytes.length,
    arrayBuffer: vi.fn(read),
  } as unknown as File;
}

function commandWith(
  implementation: (bytes: Uint8Array) => Promise<PersistenceWorkbookApplyResult>,
) {
  const importAndApplyWorkbook = vi.fn(implementation);
  return {
    command: new BrowserWorkbookImportCommand({ importAndApplyWorkbook }),
    importAndApplyWorkbook,
  };
}

async function mount(command: BrowserWorkbookImportCommand) {
  await act(async () => root.render(<WorkbookImportPanel command={command} onHydrated={onHydrated} />));
}

function button(text: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll('button')).find((item) =>
    item.textContent?.includes(text),
  );
  if (!found) throw new Error(`Missing button: ${text}`);
  return found;
}

async function click(text: string) {
  await act(async () => button(text).click());
}

async function choose(file: File | null) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: file === null ? [] : [file],
  });
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
}

describe('WorkbookImportPanel browser selection workflow', () => {
  it('wires the Open / Import action to the hidden browser file chooser', async () => {
    const { command } = commandWith(async () => hydratedResult);
    await mount(command);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const open = vi.spyOn(input, 'click').mockImplementation(() => {});

    await click('Choose workbook');

    expect(open).toHaveBeenCalledOnce();
    expect(input.accept).toContain('.xlsx');
  });

  it('shows selected file identity without applying data and can cancel the pending selection', async () => {
    const { command, importAndApplyWorkbook } = commandWith(async () => hydratedResult);
    await mount(command);

    await choose(workbookFile('shop-data.xlsx', [1, 2, 3, 4]));

    expect(container.textContent).toContain('shop-data.xlsx');
    expect(container.textContent).toContain('4 B');
    expect(importAndApplyWorkbook).not.toHaveBeenCalled();
    expect(button('Apply import').disabled).toBe(false);

    await click('Cancel selection');

    expect(container.textContent).not.toContain('shop-data.xlsx');
    expect(command.getPendingSelection()).toBeNull();
    expect(button('Apply import').disabled).toBe(true);
  });

  it('shows a controlled file-read error and leaves import disabled when nothing was selected', async () => {
    const { command, importAndApplyWorkbook } = commandWith(async () => hydratedResult);
    await mount(command);

    await choose(
      workbookFile('broken.xlsx', [9], async () => {
        throw new Error('browser read unavailable');
      }),
    );

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'The selected workbook could not be read.',
    );
    expect(button('Apply import').disabled).toBe(true);
    expect(importAndApplyWorkbook).not.toHaveBeenCalled();
  });
});

describe('WorkbookImportPanel explicit replacement workflow', () => {
  it('requires destructive confirmation before delegating the apply command', async () => {
    const { command, importAndApplyWorkbook } = commandWith(async () => hydratedResult);
    await mount(command);
    await choose(workbookFile());
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

    await click('Apply import');

    expect(confirm).toHaveBeenCalledOnce();
    expect(confirm.mock.calls[0][0]).toContain('replaces the currently loaded authoritative business data');
    expect(importAndApplyWorkbook).not.toHaveBeenCalled();
    expect(onHydrated).not.toHaveBeenCalled();
  });

  it('reports successful hydration, clears selection, and requests one workspace refresh', async () => {
    const { command, importAndApplyWorkbook } = commandWith(async () => hydratedResult);
    await mount(command);
    await choose(workbookFile('valid.xlsx'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await click('Apply import');

    expect(importAndApplyWorkbook).toHaveBeenCalledOnce();
    expect(onHydrated).toHaveBeenCalledOnce();
    expect(command.getPendingSelection()).toBeNull();
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Imported valid.xlsx');
    expect(button('Apply import').disabled).toBe(true);
  });

  it('keeps rejection distinct from success and does not request a workspace refresh', async () => {
    const { command } = commandWith(async () => rejectedResult);
    await mount(command);
    await choose(workbookFile('invalid.xlsx'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await click('Apply import');

    expect(onHydrated).not.toHaveBeenCalled();
    expect(command.getPendingSelection()).toEqual({ name: 'invalid.xlsx', byteLength: 3 });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Import rejected during dataset validation: 1 issue.',
    );
  });

  it('shows controlled operational failure without manufacturing success or refresh', async () => {
    const failure = new PersistenceLifecycleOperationalError(
      'hydrate',
      'HYDRATION_APPLY_FAILED_RESTORED',
      'Workbook hydration failed and the previous live dataset was restored.',
      new Error('synthetic apply failure'),
    );
    const { command } = commandWith(async () => {
      throw failure;
    });
    await mount(command);
    await choose(workbookFile('restore.xlsx'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await click('Apply import');

    expect(onHydrated).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'previous live dataset was restored',
    );
  });

  it('disables duplicate submission while one import is still pending', async () => {
    let resolve!: (result: PersistenceWorkbookApplyResult) => void;
    const { command, importAndApplyWorkbook } = commandWith(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await mount(command);
    await choose(workbookFile('slow.xlsx'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await act(async () => {
      button('Apply import').click();
      await Promise.resolve();
    });

    expect(importAndApplyWorkbook).toHaveBeenCalledOnce();
    expect(button('Importing…').disabled).toBe(true);

    await act(async () => button('Importing…').click());
    expect(importAndApplyWorkbook).toHaveBeenCalledOnce();

    await act(async () => resolve(hydratedResult));
    expect(onHydrated).toHaveBeenCalledOnce();
  });
});
