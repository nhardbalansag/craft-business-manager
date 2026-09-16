// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { BrowserWorkbookImportCommand } from './application/persistence/BrowserWorkbookImportCommand';
import { PersistenceLifecycleOperationalError } from './application/persistence/PersistenceLifecycle';
import type { PersistenceWorkbookApplyResult } from './application/persistence/PersistenceCoordinator';
import * as session from './application/session';
import type { Material } from './domain/materials';

const hydratedResult: PersistenceWorkbookApplyResult = {
  status: 'hydrated',
  metadata: {
    formatId: 'craft-business-manager',
    workbookFormatVersion: 1,
    datasetSchemaVersion: 1,
    exportedAt: '2026-09-16T06:20:00.000Z',
  },
};

const rejectedResult: PersistenceWorkbookApplyResult = {
  status: 'rejected',
  stage: 'hydrate',
  issues: [
    {
      code: 'INVALID_RECORD',
      message: 'Synthetic rejected dataset.',
      path: 'materials[0]',
    },
  ],
};

const beforeMaterial: Material = {
  id: 'BEFORE',
  name: 'Before Import Material',
  group: 'plaster',
  baseUnit: 'g',
  purchaseQuantity: 1,
  purchaseUnit: 'kg',
  packageCost: 100,
  onHandQuantity: 1,
  onHandUnit: 'kg',
  isActive: true,
};

const importedMaterial: Material = {
  id: 'AFTER',
  name: 'Imported Workbook Material',
  group: 'wax',
  baseUnit: 'g',
  purchaseQuantity: 500,
  purchaseUnit: 'g',
  packageCost: 80,
  onHandQuantity: 250,
  onHandUnit: 'g',
  isActive: true,
};

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  await Promise.all([
    session.materialRepository.replaceAll([]),
    session.calibrationRepository.replaceAll([]),
    session.mixPresetRepository.replaceAll([]),
    session.productRepository.replaceAll([]),
    session.yieldSampleRepository.replaceAll([]),
    session.fixedRecipeItemRepository.replaceAll([]),
    session.productComponentRepository.replaceAll([]),
    session.productStockRepository.replaceAll([]),
    session.productFinancialProfileRepository.replaceAll([]),
  ]);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
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

function workbookFile(name = 'workspace.xlsx'): File {
  return {
    name,
    size: 3,
    arrayBuffer: vi.fn(async () => arrayBuffer([1, 2, 3])),
  } as unknown as File;
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

async function choose(file: File = workbookFile()) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
}

async function mount(command: BrowserWorkbookImportCommand) {
  await act(async () => root.render(<App workbookImportCommand={command} />));
}

function workspaceRevision(): string | null {
  return container.querySelector('.workspace-revision-boundary')?.getAttribute('data-workspace-revision') ?? null;
}

function activeNavigation(): string | undefined {
  return Array.from(container.querySelectorAll('.nav-item')).find((item) =>
    item.classList.contains('active'),
  )?.textContent ?? undefined;
}

describe('App Phase 5.5A2 workspace refresh boundary', () => {
  it('remounts the visible workspace from the same repositories only after successful hydration', async () => {
    await session.materialRepository.replaceAll([beforeMaterial]);
    const importAndApplyWorkbook = vi.fn(async () => {
      await session.materialRepository.replaceAll([importedMaterial]);
      return hydratedResult;
    });
    const command = new BrowserWorkbookImportCommand({ importAndApplyWorkbook });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await mount(command);

    expect(container.textContent).toContain('Before Import Material');
    expect(container.textContent).not.toContain('Imported Workbook Material');
    expect(workspaceRevision()).toBe('0');
    expect(activeNavigation()).toBe('Materials');

    await choose();
    await click('Apply import');

    expect(importAndApplyWorkbook).toHaveBeenCalledOnce();
    expect(workspaceRevision()).toBe('1');
    expect(activeNavigation()).toBe('Materials');
    expect(container.textContent).toContain('Imported Workbook Material');
    expect(container.textContent).not.toContain('Before Import Material');
  });

  it('does not advance the workspace revision or replace the visible presentation for a rejected import', async () => {
    await session.materialRepository.replaceAll([beforeMaterial]);
    const command = new BrowserWorkbookImportCommand({
      importAndApplyWorkbook: vi.fn(async () => rejectedResult),
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await mount(command);
    await choose(workbookFile('rejected.xlsx'));
    await click('Apply import');

    expect(workspaceRevision()).toBe('0');
    expect(activeNavigation()).toBe('Materials');
    expect(container.textContent).toContain('Before Import Material');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Import rejected');
  });

  it('does not advance the workspace revision for an operational failure', async () => {
    await session.materialRepository.replaceAll([beforeMaterial]);
    const failure = new PersistenceLifecycleOperationalError(
      'hydrate',
      'HYDRATION_APPLY_FAILED_RESTORED',
      'Workbook hydration failed and the previous live dataset was restored.',
      new Error('synthetic failure'),
    );
    const command = new BrowserWorkbookImportCommand({
      importAndApplyWorkbook: vi.fn(async () => {
        throw failure;
      }),
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await mount(command);
    await choose(workbookFile('failed.xlsx'));
    await click('Apply import');

    expect(workspaceRevision()).toBe('0');
    expect(activeNavigation()).toBe('Materials');
    expect(container.textContent).toContain('Before Import Material');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('previous live dataset was restored');
  });

  it('keeps the active navigation section stable across a successful workspace remount', async () => {
    const command = new BrowserWorkbookImportCommand({
      importAndApplyWorkbook: vi.fn(async () => hydratedResult),
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await mount(command);
    await click('Products');
    expect(activeNavigation()).toBe('Products');
    expect(container.textContent).toContain('Your product workshop');

    await choose(workbookFile('products.xlsx'));
    await click('Apply import');

    expect(workspaceRevision()).toBe('1');
    expect(activeNavigation()).toBe('Products');
    expect(container.textContent).toContain('Your product workshop');
  });
});
