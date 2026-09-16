// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { BrowserWorkbookImportCommand } from './application/persistence/BrowserWorkbookImportCommand';
import * as session from './application/session';
import { createEmptyBusinessDataset } from './domain/businessDataset';
import type { BusinessDataset } from './domain/types';
import {
  createBusinessDatasetWorkbookDocument,
  exportBusinessDatasetToXlsx,
} from './storage/businessDatasetWorkbookExport';
import { DEFAULT_WORKBOOK_RESOURCE_LIMITS } from './storage/workbookResourceLimits';
import { SheetJsWorkbookCodec } from './storage/sheetJsWorkbookCodec';
import {
  CURRENT_WORKBOOK_FORMAT_VERSION,
  type WorkbookNeutralDocument,
} from './storage/workbookSchema';

const METADATA = { exportedAt: '2026-09-16T06:30:00.000Z' } as const;
const codec = new SheetJsWorkbookCodec();

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

function datasetWithMaterial(id: string, name: string): BusinessDataset {
  return {
    ...createEmptyBusinessDataset(),
    materials: [
      {
        id,
        name,
        group: 'plaster',
        baseUnit: 'g',
        purchaseQuantity: 1,
        purchaseUnit: 'kg',
        packageCost: 100,
        onHandQuantity: 1,
        onHandUnit: 'kg',
        isActive: true,
      },
    ],
  };
}

function datasetWithProductReferenceCandidate(): BusinessDataset {
  return {
    ...datasetWithMaterial('MAT-PLASTER', 'Plaster source'),
    products: [
      {
        id: 'PRODUCT-ONE',
        name: 'Paintable figure',
        category: 'paintable-art',
        safetyWasteRate: 0,
        isActive: true,
      },
    ],
  };
}

function realWorkbookBytes(dataset: BusinessDataset): Uint8Array {
  return exportBusinessDatasetToXlsx(dataset, METADATA, codec);
}

function mapSheet(
  document: WorkbookNeutralDocument,
  name: string,
  transform: (sheet: WorkbookNeutralDocument['sheets'][number]) => WorkbookNeutralDocument['sheets'][number],
): WorkbookNeutralDocument {
  return {
    sheets: document.sheets.map((sheet) => (sheet.name === name ? transform(sheet) : sheet)),
  };
}

function futureVersionBytes(): Uint8Array {
  const document = createBusinessDatasetWorkbookDocument(createEmptyBusinessDataset(), METADATA);
  const future = mapSheet(document, '_Meta', (sheet) => ({
    ...sheet,
    rows: sheet.rows.map((row, index) =>
      index === 0
        ? { ...row, workbookFormatVersion: CURRENT_WORKBOOK_FORMAT_VERSION + 1 }
        : row,
    ),
  }));
  return codec.encode(future);
}

function invalidStructureBytes(): Uint8Array {
  const document = createBusinessDatasetWorkbookDocument(createEmptyBusinessDataset(), METADATA);
  return codec.encode({
    sheets: document.sheets.filter((sheet) => sheet.name !== 'Materials'),
  });
}

function invalidBusinessDatasetBytes(): Uint8Array {
  const document = createBusinessDatasetWorkbookDocument(
    datasetWithProductReferenceCandidate(),
    METADATA,
  );
  const invalid = mapSheet(document, 'Products', (sheet) => ({
    ...sheet,
    rows: sheet.rows.map((row, index) =>
      index === 0 ? { ...row, mixPresetId: 'MISSING-PRESET' } : row,
    ),
  }));
  return codec.encode(invalid);
}

function exactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function workbookFile(
  name: string,
  bytes: Uint8Array,
  read: () => Promise<ArrayBuffer> = async () => exactArrayBuffer(bytes),
): File {
  return {
    name,
    size: bytes.byteLength,
    arrayBuffer: vi.fn(read),
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

async function choose(file: File | null) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: file === null ? [] : [file],
  });
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
}

function revision(): string | null {
  return (
    container
      .querySelector('.workspace-revision-boundary')
      ?.getAttribute('data-workspace-revision') ?? null
  );
}

function realImportCommand() {
  return new BrowserWorkbookImportCommand(session.persistenceCoordinator);
}

async function mount(command = realImportCommand()) {
  await act(async () => root.render(<App workbookImportCommand={command} />));
  return command;
}

async function seedPreviousWorkspace() {
  const previous = datasetWithMaterial('BEFORE', 'Previous live material');
  await session.validatedAtomicDatasetHydrationService.hydrate(previous);
  return session.completeSourceSnapshotService.snapshot();
}

async function expectRejectedThroughBrowser(
  name: string,
  bytes: Uint8Array,
  expectedIssueStage: string,
) {
  const before = await seedPreviousWorkspace();
  const directResult = await session.persistenceCoordinator.importAndApplyWorkbook(bytes);
  expect(directResult.status).toBe('rejected');
  if (directResult.status === 'rejected') {
    expect(directResult.stage).toBe('import');
    expect(
      directResult.issues.some(
        (issue) => 'stage' in issue && issue.stage === expectedIssueStage,
      ),
    ).toBe(true);
  }
  expect(await session.completeSourceSnapshotService.snapshot()).toEqual(before);

  const command = realImportCommand();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  await mount(command);
  expect(container.textContent).toContain('Previous live material');

  await choose(workbookFile(name, bytes));
  await click('Apply import');

  expect(revision()).toBe('0');
  expect(container.querySelector('[role="status"]')).toBeNull();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('Import rejected');
  expect(container.textContent).toContain('Previous live material');
  expect(command.getPendingSelection()?.name).toBe(name);
  expect(await session.completeSourceSnapshotService.snapshot()).toEqual(before);
}

describe('Phase 5.5A3 real browser import regression gate', () => {
  it('selects real current XLSX bytes non-destructively, explicitly applies them, hydrates, and refreshes the visible workspace', async () => {
    const before = await seedPreviousWorkspace();
    const incoming = datasetWithMaterial('AFTER', 'Imported real workbook material');
    const bytes = realWorkbookBytes(incoming);
    const command = realImportCommand();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await mount(command);
    expect(revision()).toBe('0');
    expect(container.textContent).toContain('Previous live material');

    await choose(workbookFile('valid-current.xlsx', bytes));

    expect(command.getPendingSelection()).toEqual({
      name: 'valid-current.xlsx',
      byteLength: bytes.byteLength,
    });
    expect(await session.completeSourceSnapshotService.snapshot()).toEqual(before);
    expect(container.textContent).toContain('Previous live material');
    expect(container.textContent).not.toContain('Imported real workbook material');

    await click('Apply import');

    expect(revision()).toBe('1');
    expect(command.getPendingSelection()).toBeNull();
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      'Imported valid-current.xlsx',
    );
    expect(container.textContent).toContain('Imported real workbook material');
    expect(container.textContent).not.toContain('Previous live material');
    expect(await session.completeSourceSnapshotService.snapshot()).toEqual(incoming);
  });

  it('rejects corrupt/unreadable workbook bytes without changing the previous live dataset', async () => {
    await expectRejectedThroughBrowser(
      'corrupt.xlsx',
      new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0xff, 0xff, 0xff]),
      'codec',
    );
  });

  it('rejects a real XLSX workbook with a future format version without refreshing the workspace', async () => {
    await expectRejectedThroughBrowser('future.xlsx', futureVersionBytes(), 'compatibility');
  });

  it('rejects a real XLSX workbook with invalid canonical structure without refreshing the workspace', async () => {
    await expectRejectedThroughBrowser('invalid-structure.xlsx', invalidStructureBytes(), 'schema');
  });

  it('rejects a structurally valid XLSX workbook whose reconstructed business dataset has an invalid reference', async () => {
    await expectRejectedThroughBrowser('invalid-business.xlsx', invalidBusinessDatasetBytes(), 'dataset');
  });

  it('rejects an over-limit browser selection before workbook decode and preserves the previous workspace', async () => {
    const before = await seedPreviousWorkspace();
    const oversized = new Uint8Array(DEFAULT_WORKBOOK_RESOURCE_LIMITS.maxWorkbookBytes + 1);
    const command = realImportCommand();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await mount(command);

    await choose(workbookFile('oversized.xlsx', oversized));
    await click('Apply import');

    expect(revision()).toBe('0');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Import rejected');
    expect(container.textContent).toContain('Previous live material');
    expect(command.getPendingSelection()?.name).toBe('oversized.xlsx');
    expect(await session.completeSourceSnapshotService.snapshot()).toEqual(before);
  });

  it('uses the most recently selected real workbook when the user changes files before apply', async () => {
    const before = await seedPreviousWorkspace();
    const first = datasetWithMaterial('FIRST', 'First pending workbook');
    const second = datasetWithMaterial('SECOND', 'Second pending workbook');
    const command = realImportCommand();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await mount(command);

    await choose(workbookFile('first.xlsx', realWorkbookBytes(first)));
    expect(command.getPendingSelection()?.name).toBe('first.xlsx');
    await choose(workbookFile('second.xlsx', realWorkbookBytes(second)));

    expect(command.getPendingSelection()?.name).toBe('second.xlsx');
    expect(await session.completeSourceSnapshotService.snapshot()).toEqual(before);

    await click('Apply import');

    expect(revision()).toBe('1');
    expect(container.textContent).toContain('Second pending workbook');
    expect(container.textContent).not.toContain('First pending workbook');
    expect(await session.completeSourceSnapshotService.snapshot()).toEqual(second);
  });

  it('allows a successful real import after a prior rejected attempt in the same mounted workflow', async () => {
    const before = await seedPreviousWorkspace();
    const incoming = datasetWithMaterial('RECOVERED', 'Recovered second import');
    const command = realImportCommand();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await mount(command);

    await choose(workbookFile('future-first.xlsx', futureVersionBytes()));
    await click('Apply import');

    expect(revision()).toBe('0');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Import rejected');
    expect(await session.completeSourceSnapshotService.snapshot()).toEqual(before);

    await choose(workbookFile('valid-second.xlsx', realWorkbookBytes(incoming)));
    await click('Apply import');

    expect(revision()).toBe('1');
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      'Imported valid-second.xlsx',
    );
    expect(container.textContent).toContain('Recovered second import');
    expect(await session.completeSourceSnapshotService.snapshot()).toEqual(incoming);
  });
});
