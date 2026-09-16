// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App, { type PersistenceUiClock } from './App';
import {
  BrowserWorkbookExportCommand,
  type BrowserWorkbookDownloadAdapter,
} from './application/persistence/BrowserWorkbookExportCommand';
import { BrowserWorkbookImportCommand } from './application/persistence/BrowserWorkbookImportCommand';
import { PersistenceLifecycleOperationalError } from './application/persistence/PersistenceLifecycle';
import * as session from './application/session';
import { createEmptyBusinessDataset } from './domain/businessDataset';
import type { BusinessDataset } from './domain/types';
import {
  createBusinessDatasetWorkbookDocument,
  exportBusinessDatasetToXlsx,
} from './storage/businessDatasetWorkbookExport';
import { importBusinessDatasetFromXlsx } from './storage/businessDatasetWorkbookImport';
import { DEFAULT_WORKBOOK_RESOURCE_LIMITS } from './storage/workbookResourceLimits';
import { SheetJsWorkbookCodec } from './storage/sheetJsWorkbookCodec';
import {
  CURRENT_WORKBOOK_FORMAT_VERSION,
  type WorkbookNeutralDocument,
} from './storage/workbookSchema';

const codec = new SheetJsWorkbookCodec();
const metadata = { exportedAt: '2026-09-17T01:45:00.000Z' } as const;
const exportClock = new Date('2026-09-17T02:15:30.000Z');

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
        packageCost: 66,
        onHandQuantity: 1.5,
        onHandUnit: 'kg',
        isActive: true,
      },
    ],
  };
}

function datasetWithInvalidReferenceCandidate(): BusinessDataset {
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

function mapSheet(
  document: WorkbookNeutralDocument,
  name: string,
  transform: (sheet: WorkbookNeutralDocument['sheets'][number]) => WorkbookNeutralDocument['sheets'][number],
): WorkbookNeutralDocument {
  return {
    sheets: document.sheets.map((sheet) => (sheet.name === name ? transform(sheet) : sheet)),
  };
}

function realWorkbookBytes(dataset: BusinessDataset): Uint8Array {
  return exportBusinessDatasetToXlsx(dataset, metadata, codec);
}

function futureVersionBytes(): Uint8Array {
  const document = createBusinessDatasetWorkbookDocument(createEmptyBusinessDataset(), metadata);
  return codec.encode(
    mapSheet(document, '_Meta', (sheet) => ({
      ...sheet,
      rows: sheet.rows.map((row, index) =>
        index === 0
          ? { ...row, workbookFormatVersion: CURRENT_WORKBOOK_FORMAT_VERSION + 1 }
          : row,
      ),
    })),
  );
}

function invalidStructureBytes(): Uint8Array {
  const document = createBusinessDatasetWorkbookDocument(createEmptyBusinessDataset(), metadata);
  return codec.encode({
    sheets: document.sheets.filter((sheet) => sheet.name !== 'Materials'),
  });
}

function invalidBusinessDataBytes(): Uint8Array {
  const document = createBusinessDatasetWorkbookDocument(
    datasetWithInvalidReferenceCandidate(),
    metadata,
  );
  return codec.encode(
    mapSheet(document, 'Products', (sheet) => ({
      ...sheet,
      rows: sheet.rows.map((row, index) =>
        index === 0 ? { ...row, mixPresetId: 'MISSING-PRESET' } : row,
      ),
    })),
  );
}

function exactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function workbookFile(name: string, bytes: Uint8Array): File {
  return {
    name,
    size: bytes.byteLength,
    arrayBuffer: vi.fn(async () => exactArrayBuffer(bytes)),
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

async function choose(file: File) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('Missing workbook file input.');
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
}

function revision(): string | null {
  return container.querySelector('.workspace-revision-boundary')?.getAttribute('data-workspace-revision') ?? null;
}

function activeNavigation(): string | undefined {
  return Array.from(container.querySelectorAll('.nav-item')).find((item) =>
    item.classList.contains('active'),
  )?.textContent ?? undefined;
}

function statusCard(label: string): HTMLElement {
  const found = container.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  if (!found) throw new Error(`Missing status card: ${label}`);
  return found;
}

function sequenceClock(...instants: string[]): PersistenceUiClock {
  const values = [...instants];
  return () => {
    const next = values.shift();
    if (next === undefined) throw new Error('Unexpected persistence UI clock call.');
    return new Date(next);
  };
}

interface DownloadCapture {
  readonly bytes: Uint8Array[];
  readonly dispatches: Array<{ objectUrl: string; fileName: string }>;
  readonly revoked: string[];
}

function downloadHarness(options: { failDispatchOnce?: boolean } = {}) {
  const capture: DownloadCapture = { bytes: [], dispatches: [], revoked: [] };
  let failDispatch = options.failDispatchOnce ?? false;
  const adapter: BrowserWorkbookDownloadAdapter = {
    createBlob(bytes, mimeType) {
      const owned = new Uint8Array(bytes);
      capture.bytes.push(owned);
      return new Blob([owned.buffer], { type: mimeType });
    },
    createObjectUrl() {
      return `blob:phase-5-5c3-${capture.bytes.length}`;
    },
    dispatchDownload(objectUrl, fileName) {
      if (failDispatch) {
        failDispatch = false;
        throw new Error('synthetic browser dispatch failure');
      }
      capture.dispatches.push({ objectUrl, fileName });
    },
    revokeObjectUrl(objectUrl) {
      capture.revoked.push(objectUrl);
    },
  };
  return { capture, adapter };
}

function realExportCommand(adapter: BrowserWorkbookDownloadAdapter) {
  return new BrowserWorkbookExportCommand(session.persistenceCoordinator, {
    clock: () => new Date(exportClock),
    downloadAdapter: adapter,
  });
}

async function mount(options: {
  importCommand?: BrowserWorkbookImportCommand;
  exportCommand?: BrowserWorkbookExportCommand;
  uiClock?: PersistenceUiClock;
} = {}) {
  const importCommand = options.importCommand ?? new BrowserWorkbookImportCommand(session.persistenceCoordinator);
  const exportCommand = options.exportCommand ?? realExportCommand(downloadHarness().adapter);
  await act(async () =>
    root.render(
      <App
        workbookImportCommand={importCommand}
        workbookExportCommand={exportCommand}
        persistenceUiClock={options.uiClock}
      />,
    ),
  );
  return { importCommand, exportCommand };
}

function rejectionText(): string {
  return container.querySelector('.workbook-recovery-panel')?.textContent ?? '';
}

async function applyWorkbook(name: string, bytes: Uint8Array) {
  await choose(workbookFile(name, bytes));
  await click('Apply import');
}

describe('Phase 5.5C3 persistence UX regression and Phase 5.5 completion gate', () => {
  it('integrates real import, session status, one workspace refresh, and real export without replacing imported identity', async () => {
    const incoming = datasetWithMaterial('MAT-ACTIVE', 'Imported completion material');
    const { capture, adapter } = downloadHarness();
    const uiClock = sequenceClock(
      '2026-09-17T02:00:00.000Z',
      '2026-09-17T02:20:00.000Z',
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await mount({ exportCommand: realExportCommand(adapter), uiClock });

    await click('Products');
    await applyWorkbook('phase-5-5-active.xlsx', realWorkbookBytes(incoming));

    expect(revision()).toBe('1');
    expect(activeNavigation()).toBe('Products');
    expect(statusCard('Active imported workbook').textContent).toContain('phase-5-5-active.xlsx');
    expect(statusCard('Active imported workbook').textContent).toContain(
      'Imported into this session 2026-09-17 02:00:00 UTC',
    );
    expect(await session.completeSourceSnapshotService.snapshot()).toEqual(incoming);

    await click('Download workbook');

    expect(revision()).toBe('1');
    expect(activeNavigation()).toBe('Products');
    expect(statusCard('Active imported workbook').textContent).toContain('phase-5-5-active.xlsx');
    const downloadStatus = statusCard('Last downloaded workbook copy').textContent ?? '';
    expect(downloadStatus).toContain('craft-business-manager-2026-09-17-021530.xlsx');
    expect(downloadStatus).toContain('Download dispatched 2026-09-17 02:20:00 UTC');
    expect(capture.dispatches).toHaveLength(1);
    expect(capture.revoked).toEqual(['blob:phase-5-5c3-1']);

    const exported = importBusinessDatasetFromXlsx(capture.bytes[0]!, codec);
    expect(exported.ok).toBe(true);
    if (!exported.ok) throw new Error('Expected completion-gate export to re-import.');
    expect(exported.dataset).toEqual(incoming);
    expect(await session.completeSourceSnapshotService.snapshot()).toEqual(incoming);
  });

  it('shows raw deterministic recovery guidance for all expected rejection families while preserving live state and last-successful status', async () => {
    const knownGood = datasetWithMaterial('KNOWN-GOOD', 'Known good live material');
    const recovered = datasetWithMaterial('RECOVERED', 'Recovered final material');
    const uiClock = sequenceClock(
      '2026-09-17T02:00:00.000Z',
      '2026-09-17T02:30:00.000Z',
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await mount({ uiClock });
    await click('Pricing');
    await applyWorkbook('known-good.xlsx', realWorkbookBytes(knownGood));
    expect(revision()).toBe('1');
    expect(activeNavigation()).toBe('Pricing');

    const cases: Array<{
      name: string;
      bytes: Uint8Array;
      category: string;
      rawCode: string;
      guidance: string;
    }> = [
      {
        name: 'corrupt.xlsx',
        bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0xff, 0xff, 0xff]),
        category: 'Unreadable or corrupt workbook',
        rawCode: 'XLSX_DECODE_FAILED',
        guidance: 'known-good workbook copy that you already possess',
      },
      {
        name: 'future.xlsx',
        bytes: futureVersionBytes(),
        category: 'Unsupported or incompatible workbook version',
        rawCode: 'UNSUPPORTED_FUTURE_VERSION',
        guidance: 'compatible or newer Craft Business Manager version',
      },
      {
        name: 'structure.xlsx',
        bytes: invalidStructureBytes(),
        category: 'Workbook structure',
        rawCode: 'MISSING_REQUIRED_SHEET',
        guidance: 'Repair the workbook structure',
      },
      {
        name: 'invalid-business.xlsx',
        bytes: invalidBusinessDataBytes(),
        category: 'Invalid business data',
        rawCode: 'MISSING_REFERENCE',
        guidance: 'Correct the invalid workbook values or referenced business data',
      },
      {
        name: 'oversized.xlsx',
        bytes: new Uint8Array(DEFAULT_WORKBOOK_RESOURCE_LIMITS.maxWorkbookBytes + 1),
        category: 'Workbook resource limit',
        rawCode: 'WORKBOOK_BYTES_EXCEEDED',
        guidance: 'Reduce the workbook size or content',
      },
    ];

    for (const scenario of cases) {
      await applyWorkbook(scenario.name, scenario.bytes);
      const details = rejectionText();
      expect(details).toContain('Current workspace preserved');
      expect(details).toContain(scenario.category);
      expect(details).toContain(scenario.rawCode);
      expect(details).toContain(scenario.guidance);
      expect(details).toContain('technical source of truth');
      expect(revision()).toBe('1');
      expect(activeNavigation()).toBe('Pricing');
      expect(statusCard('Active imported workbook').textContent).toContain('known-good.xlsx');
      expect(statusCard('Active imported workbook').textContent).not.toContain(scenario.name);
      expect(await session.completeSourceSnapshotService.snapshot()).toEqual(knownGood);
    }

    expect(container.textContent).toContain(
      'Browser import does not create, discover, or manage a Phase 5.4B pre-save transport backup',
    );

    await applyWorkbook('recovered.xlsx', realWorkbookBytes(recovered));

    expect(rejectionText()).toBe('');
    expect(revision()).toBe('2');
    expect(activeNavigation()).toBe('Pricing');
    expect(statusCard('Active imported workbook').textContent).toContain('recovered.xlsx');
    expect(await session.completeSourceSnapshotService.snapshot()).toEqual(recovered);
  });

  it('keeps unexpected import operational failure separate from expected validation recovery and preserves successful session identity', async () => {
    const knownGood = datasetWithMaterial('KNOWN', 'Known operational baseline');
    const uiClock = sequenceClock('2026-09-17T02:00:00.000Z');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { importCommand } = await mount({ uiClock });
    await applyWorkbook('known-operational.xlsx', realWorkbookBytes(knownGood));

    const failure = new PersistenceLifecycleOperationalError(
      'import',
      'IMPORT_FAILED',
      'Workbook import failed unexpectedly.',
      new Error('synthetic C3 operational failure'),
    );
    vi.spyOn(session.persistenceCoordinator, 'importAndApplyWorkbook').mockRejectedValueOnce(failure);

    await choose(workbookFile('operational-failure.xlsx', realWorkbookBytes(knownGood)));
    await click('Apply import');

    expect(container.querySelector('.workbook-import-panel [role="alert"]')?.textContent).toContain(
      'Workbook import failed unexpectedly.',
    );
    expect(rejectionText()).toBe('');
    expect(revision()).toBe('1');
    expect(statusCard('Active imported workbook').textContent).toContain('known-operational.xlsx');
    expect(statusCard('Active imported workbook').textContent).not.toContain('operational-failure.xlsx');
    expect(importCommand.getPendingSelection()?.name).toBe('operational-failure.xlsx');
    expect(await session.completeSourceSnapshotService.snapshot()).toEqual(knownGood);
  });

  it('does not record a failed browser export as success, preserves workspace identity, and records a later successful retry truthfully', async () => {
    const live = datasetWithMaterial('EXPORT-LIVE', 'Export retry live material');
    const hydrated = await session.validatedAtomicDatasetHydrationService.hydrate(live);
    expect(hydrated.status).toBe('hydrated');
    const { capture, adapter } = downloadHarness({ failDispatchOnce: true });
    const uiClock = sequenceClock('2026-09-17T02:40:00.000Z');
    await mount({ exportCommand: realExportCommand(adapter), uiClock });
    await click('Yield');

    await click('Download workbook');

    expect(container.querySelector('.workbook-export-panel [role="alert"]')?.textContent).toContain(
      'browser download could not be started',
    );
    expect(statusCard('Last downloaded workbook copy').textContent).toContain(
      'No workbook copy has been downloaded successfully',
    );
    expect(revision()).toBe('0');
    expect(activeNavigation()).toBe('Yield');
    expect(capture.dispatches).toHaveLength(0);
    expect(capture.revoked).toEqual(['blob:phase-5-5c3-1']);

    await click('Download workbook');

    expect(capture.dispatches).toHaveLength(1);
    expect(capture.revoked).toEqual(['blob:phase-5-5c3-1', 'blob:phase-5-5c3-2']);
    expect(statusCard('Last downloaded workbook copy').textContent).toContain(
      'craft-business-manager-2026-09-17-021530.xlsx',
    );
    expect(revision()).toBe('0');
    expect(activeNavigation()).toBe('Yield');
    expect(await session.completeSourceSnapshotService.snapshot()).toEqual(live);

    const pageText = container.textContent ?? '';
    expect(pageText).toContain('browser-selected identity label, not a managed native filesystem path');
    expect(pageText).toContain('does not overwrite a workbook you previously imported');
    expect(pageText).toContain('does not create a pre-save backup');
    expect(pageText).toContain('Native Save / Save As');
    expect(pageText).not.toContain('All changes saved');
  });
});
