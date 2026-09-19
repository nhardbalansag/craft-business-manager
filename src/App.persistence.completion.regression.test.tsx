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
import { BUSINESS_DATASET_V2_SCHEMA_VERSION } from './domain/businessDatasetV2';
import type { BusinessDataset } from './domain/types';
import {
  createBusinessDatasetWorkbookDocument,
  exportBusinessDatasetToXlsx,
} from './storage/businessDatasetWorkbookExport';
import {
  CORE_WORKBOOK_V3_FORMAT_VERSION,
  importBusinessDatasetV2FromXlsx,
} from './storage/businessDatasetV2Workbook';
import { DEFAULT_WORKBOOK_RESOURCE_LIMITS } from './storage/workbookResourceLimits';
import { SheetJsWorkbookCodec } from './storage/sheetJsWorkbookCodec';
import type { WorkbookNeutralDocument } from './storage/workbookSchema';

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
    materials: [{
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
    }],
  };
}

function invalidReferenceCandidate(): BusinessDataset {
  return {
    ...datasetWithMaterial('MAT-PLASTER', 'Plaster source'),
    products: [{
      id: 'PRODUCT-ONE',
      name: 'Paintable figure',
      category: 'paintable-art',
      safetyWasteRate: 0,
      isActive: true,
    }],
  };
}

function mapSheet(
  document: WorkbookNeutralDocument,
  name: string,
  transform: (sheet: WorkbookNeutralDocument['sheets'][number]) => WorkbookNeutralDocument['sheets'][number],
): WorkbookNeutralDocument {
  return { sheets: document.sheets.map((sheet) => (sheet.name === name ? transform(sheet) : sheet)) };
}

function realWorkbookBytes(dataset: BusinessDataset): Uint8Array {
  return exportBusinessDatasetToXlsx(dataset, metadata, codec);
}

function futureVersionBytes(): Uint8Array {
  const document = createBusinessDatasetWorkbookDocument(createEmptyBusinessDataset(), metadata);
  return codec.encode(mapSheet(document, '_Meta', (sheet) => ({
    ...sheet,
    rows: sheet.rows.map((row, index) => index === 0
      ? {
          ...row,
          workbookFormatVersion: CORE_WORKBOOK_V3_FORMAT_VERSION + 1,
          datasetSchemaVersion: BUSINESS_DATASET_V2_SCHEMA_VERSION + 1,
        }
      : row),
  })));
}

function invalidStructureBytes(): Uint8Array {
  const document = createBusinessDatasetWorkbookDocument(createEmptyBusinessDataset(), metadata);
  return codec.encode({ sheets: document.sheets.filter((sheet) => sheet.name !== 'Materials') });
}

function invalidBusinessDataBytes(): Uint8Array {
  const document = createBusinessDatasetWorkbookDocument(invalidReferenceCandidate(), metadata);
  return codec.encode(mapSheet(document, 'Products', (sheet) => ({
    ...sheet,
    rows: sheet.rows.map((row, index) => index === 0
      ? { ...row, mixPresetId: 'MISSING-PRESET' }
      : row),
  })));
}

function workbookFile(name: string, bytes: Uint8Array): File {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return {
    name,
    size: bytes.byteLength,
    arrayBuffer: vi.fn(async () => buffer),
  } as unknown as File;
}

function button(text: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll('button')).find((item) => item.textContent?.includes(text));
  if (!found) throw new Error(`Missing button: ${text}`);
  return found;
}

async function click(text: string) {
  await act(async () => button(text).click());
}

async function applyWorkbook(name: string, bytes: Uint8Array) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('Missing workbook file input.');
  Object.defineProperty(input, 'files', { configurable: true, value: [workbookFile(name, bytes)] });
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
  await click('Apply import');
}

function revision(): string | null {
  return container.querySelector('.workspace-revision-boundary')?.getAttribute('data-workspace-revision') ?? null;
}

function activeNavigation(): string | undefined {
  return Array.from(container.querySelectorAll('.nav-item')).find((item) => item.classList.contains('active'))?.textContent ?? undefined;
}

function statusCard(label: string): HTMLElement {
  const found = container.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  if (!found) throw new Error(`Missing status card: ${label}`);
  return found;
}

function rejectionText(): string {
  return container.querySelector('.workbook-recovery-panel')?.textContent ?? '';
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
  exportCommand?: BrowserWorkbookExportCommand;
  uiClock?: PersistenceUiClock;
} = {}) {
  const importCommand = new BrowserWorkbookImportCommand(session.persistenceCoordinator);
  const exportCommand = options.exportCommand ?? realExportCommand(downloadHarness().adapter);
  await act(async () => root.render(
    <App
      workbookImportCommand={importCommand}
      workbookExportCommand={exportCommand}
      persistenceUiClock={options.uiClock}
    />,
  ));
  return { importCommand };
}

describe('Phase 5.5C3 persistence UX regression and Phase 5.5 completion gate', () => {
  it('integrates real import, session status, one refresh, and real export without replacing imported identity', async () => {
    const incoming = datasetWithMaterial('MAT-ACTIVE', 'Imported completion material');
    const { capture, adapter } = downloadHarness();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await mount({
      exportCommand: realExportCommand(adapter),
      uiClock: sequenceClock('2026-09-17T02:00:00.000Z', '2026-09-17T02:20:00.000Z'),
    });

    await click('Products');
    await applyWorkbook('phase-5-5-active.xlsx', realWorkbookBytes(incoming));
    expect(revision()).toBe('1');
    expect(activeNavigation()).toBe('Products');
    expect(statusCard('Active imported workbook').textContent).toContain('phase-5-5-active.xlsx');
    expect(await session.completeSourceSnapshotService.snapshot()).toEqual(incoming);

    await click('Download workbook');
    expect(revision()).toBe('1');
    expect(activeNavigation()).toBe('Products');
    expect(statusCard('Active imported workbook').textContent).toContain('phase-5-5-active.xlsx');
    expect(statusCard('Last downloaded workbook copy').textContent).toContain('craft-business-manager-2026-09-17-021530.xlsx');
    expect(capture.dispatches).toHaveLength(1);
    expect(capture.revoked).toEqual(['blob:phase-5-5c3-1']);

    const exported = importBusinessDatasetV2FromXlsx(capture.bytes[0]!, codec);
    expect(exported.ok).toBe(true);
    if (!exported.ok) throw new Error('Expected completion-gate export to re-import.');
    expect(exported.dataset.productPriceTiers).toEqual([]);
    expect({
      ...exported.dataset,
      schemaVersion: incoming.schemaVersion,
      productPriceTiers: undefined,
    }).toMatchObject(incoming);
    expect(await session.completeSourceSnapshotService.snapshot()).toEqual(incoming);
  });

  it('shows raw deterministic guidance for every expected rejection family while preserving state/status, then clears stale detail on success', async () => {
    const knownGood = datasetWithMaterial('KNOWN-GOOD', 'Known good live material');
    const recovered = datasetWithMaterial('RECOVERED', 'Recovered final material');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await mount({ uiClock: sequenceClock('2026-09-17T02:00:00.000Z', '2026-09-17T02:30:00.000Z') });
    await click('Pricing');
    await applyWorkbook('known-good.xlsx', realWorkbookBytes(knownGood));

    const cases = [
      ['corrupt.xlsx', new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0xff, 0xff, 0xff]), 'Unreadable or corrupt workbook', 'XLSX_DECODE_FAILED', 'known-good workbook copy that you already possess'],
      ['future.xlsx', futureVersionBytes(), 'Unsupported or incompatible workbook version', 'UNSUPPORTED_FUTURE_VERSION', 'compatible or newer Craft Business Manager version'],
      ['structure.xlsx', invalidStructureBytes(), 'Workbook structure', 'MISSING_REQUIRED_SHEET', 'Repair the workbook structure'],
      ['invalid-business.xlsx', invalidBusinessDataBytes(), 'Invalid business data', 'MISSING_REFERENCE', 'Correct the invalid workbook values or referenced business data'],
      ['oversized.xlsx', new Uint8Array(DEFAULT_WORKBOOK_RESOURCE_LIMITS.maxWorkbookBytes + 1), 'Workbook resource limit', 'WORKBOOK_BYTES_EXCEEDED', 'Reduce the workbook size or content'],
    ] as const;

    for (const [name, bytes, category, rawCode, guidance] of cases) {
      await applyWorkbook(name, bytes);
      const details = rejectionText();
      expect(details).toContain('Current workspace preserved');
      expect(details).toContain(category);
      expect(details).toContain(rawCode);
      expect(details).toContain(guidance);
      expect(details).toContain('technical source of truth');
      if (name === 'corrupt.xlsx') {
        expect(details).toContain('Browser import does not create, discover, or manage a Phase 5.4B pre-save transport backup');
      }
      expect(revision()).toBe('1');
      expect(activeNavigation()).toBe('Pricing');
      expect(statusCard('Active imported workbook').textContent).toContain('known-good.xlsx');
      expect(statusCard('Active imported workbook').textContent).not.toContain(name);
      expect(await session.completeSourceSnapshotService.snapshot()).toEqual(knownGood);
    }

    await applyWorkbook('recovered.xlsx', realWorkbookBytes(recovered));
    expect(rejectionText()).toBe('');
    expect(revision()).toBe('2');
    expect(activeNavigation()).toBe('Pricing');
    expect(statusCard('Active imported workbook').textContent).toContain('recovered.xlsx');
    expect(await session.completeSourceSnapshotService.snapshot()).toEqual(recovered);
  });

  it('keeps unexpected import operational failure separate from expected recovery and preserves successful identity', async () => {
    const knownGood = datasetWithMaterial('KNOWN', 'Known operational baseline');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { importCommand } = await mount({ uiClock: sequenceClock('2026-09-17T02:00:00.000Z') });
    await applyWorkbook('known-operational.xlsx', realWorkbookBytes(knownGood));

    vi.spyOn(session.persistenceCoordinator, 'importAndApplyWorkbook').mockRejectedValueOnce(
      new PersistenceLifecycleOperationalError(
        'import',
        'IMPORT_FAILED',
        'Workbook import failed unexpectedly.',
        new Error('synthetic C3 operational failure'),
      ),
    );
    await applyWorkbook('operational-failure.xlsx', realWorkbookBytes(knownGood));

    expect(container.querySelector('.workbook-import-panel [role="alert"]')?.textContent).toContain('Workbook import failed unexpectedly.');
    expect(rejectionText()).toBe('');
    expect(revision()).toBe('1');
    expect(statusCard('Active imported workbook').textContent).toContain('known-operational.xlsx');
    expect(statusCard('Active imported workbook').textContent).not.toContain('operational-failure.xlsx');
    expect(importCommand.getPendingSelection()?.name).toBe('operational-failure.xlsx');
    expect(await session.completeSourceSnapshotService.snapshot()).toEqual(knownGood);
  });

  it('does not record failed export as success and records a later retry without refresh or native-save claims', async () => {
    const live = datasetWithMaterial('EXPORT-LIVE', 'Export retry live material');
    expect((await session.validatedAtomicDatasetHydrationService.hydrate(live)).status).toBe('hydrated');
    const { capture, adapter } = downloadHarness({ failDispatchOnce: true });
    await mount({ exportCommand: realExportCommand(adapter), uiClock: sequenceClock('2026-09-17T02:40:00.000Z') });
    await click('Yield');

    await click('Download workbook');
    expect(container.querySelector('.workbook-export-panel [role="alert"]')?.textContent).toContain('browser download could not be started');
    expect(statusCard('Last downloaded workbook copy').textContent).toContain('No workbook copy has been downloaded successfully');
    expect(revision()).toBe('0');
    expect(activeNavigation()).toBe('Yield');
    expect(capture.dispatches).toHaveLength(0);
    expect(capture.revoked).toEqual(['blob:phase-5-5c3-1']);

    await click('Download workbook');
    expect(capture.dispatches).toHaveLength(1);
    expect(capture.revoked).toEqual(['blob:phase-5-5c3-1', 'blob:phase-5-5c3-2']);
    expect(statusCard('Last downloaded workbook copy').textContent).toContain('craft-business-manager-2026-09-17-021530.xlsx');
    expect(revision()).toBe('0');
    expect(activeNavigation()).toBe('Yield');
    expect(await session.completeSourceSnapshotService.snapshot()).toEqual(live);

    const pageText = container.textContent ?? '';
    expect(pageText).toContain('Browser filenames are identity labels, not managed filesystem paths');
    expect(pageText).toContain('does not overwrite a workbook you previously imported');
    expect(pageText).toContain('does not create a pre-save backup');
    expect(pageText).toContain('Native Save / Save As');
    expect(pageText).not.toContain('All changes saved');
  });
});
