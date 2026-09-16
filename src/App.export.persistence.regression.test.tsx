// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import {
  BrowserWorkbookExportCommand,
  XLSX_WORKBOOK_MIME_TYPE,
  type BrowserWorkbookDownloadAdapter,
} from './application/persistence/BrowserWorkbookExportCommand';
import { PersistenceCoordinator } from './application/persistence/PersistenceCoordinator';
import * as session from './application/session';
import { CURRENT_BUSINESS_DATASET_SCHEMA_VERSION } from './domain/businessDataset';
import type { BusinessDataset } from './domain/types';
import { importBusinessDatasetFromXlsx } from './storage/businessDatasetWorkbookImport';
import type { WorkbookCodec } from './storage/workbookCodec';
import { SheetJsWorkbookCodec } from './storage/sheetJsWorkbookCodec';

const fixedNow = new Date('2026-09-17T01:30:45.000Z');
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

function representativeDataset(suffix = 'A'): BusinessDataset {
  const plasterId = `MAT-PLASTER-${suffix}`;
  const vesselId = `MAT-VESSEL-${suffix}`;
  const mixId = `MIX-${suffix}`;
  const paintableId = `PRODUCT-PAINT-${suffix}`;
  const candleId = `PRODUCT-CANDLE-${suffix}`;

  return {
    schemaVersion: CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
    materials: [
      {
        id: plasterId,
        name: `Fine plaster ${suffix}`,
        group: 'plaster',
        baseUnit: 'g',
        purchaseQuantity: 1,
        purchaseUnit: 'kg',
        packageCost: suffix === 'A' ? 66 : 72,
        onHandQuantity: suffix === 'A' ? 1.25 : 2.5,
        onHandUnit: 'kg',
        source: { vendorName: `Supplier ${suffix}` },
        isActive: true,
      },
      {
        id: vesselId,
        name: `Glass vessel ${suffix}`,
        group: 'container',
        baseUnit: 'pc',
        purchaseQuantity: 12,
        purchaseUnit: 'pc',
        packageCost: 240,
        onHandQuantity: 8,
        onHandUnit: 'pc',
        isActive: true,
      },
    ],
    materialCalibrations: [
      {
        id: `CAL-${suffix}`,
        materialId: plasterId,
        measuredVolume: 1,
        volumeUnit: 'cup',
        knownWeight: 415,
        weightUnit: 'g',
        recordedAt: '2026-09-17T00:00:00.000Z',
      },
    ],
    mixPresets: [
      {
        id: mixId,
        name: `Plaster mix ${suffix}`,
        compatibleCategories: ['paintable-art'],
        basis: 'weight',
        lines: [{ materialId: plasterId, role: 'primary', parts: 1 }],
        isActive: true,
      },
    ],
    products: [
      {
        id: paintableId,
        name: `Paintable figure ${suffix}`,
        category: 'paintable-art',
        mixPresetId: mixId,
        safetyWasteRate: 0.05,
        isActive: true,
      },
      {
        id: candleId,
        name: `Event candle ${suffix}`,
        category: 'candle',
        safetyWasteRate: 0.02,
        isActive: true,
      },
    ],
    yieldSamples: [
      {
        id: `YIELD-${suffix}`,
        productId: paintableId,
        mixPresetId: mixId,
        materialInputs: [{ materialId: plasterId, quantity: 200, unit: 'g' }],
        goodPieces: 4,
        rejectedPieces: 1,
        recordedAt: '2026-09-17T00:15:00.000Z',
      },
    ],
    recipeItems: [
      {
        id: `RECIPE-${suffix}`,
        productId: candleId,
        materialId: plasterId,
        quantityPerProduct: 20,
        unit: 'g',
        role: 'additive',
      },
    ],
    productComponents: [
      {
        id: `COMPONENT-${suffix}`,
        parentProductId: candleId,
        sourceType: 'material',
        sourceId: vesselId,
        role: 'vessel',
        quantityPerParent: 1,
      },
    ],
    productStocks: [{ productId: paintableId, onHandQuantity: suffix === 'A' ? 3 : 7 }],
    productFinancialProfiles: [
      {
        productId: candleId,
        laborCostPerUnit: 10,
        overheadCostPerUnit: 5,
        pricingPolicy: { method: 'markup-percent', value: 25 },
      },
    ],
  };
}

interface DownloadCapture {
  readonly bytes: Uint8Array[];
  readonly mimeTypes: string[];
  readonly objectUrls: string[];
  readonly dispatches: Array<{ objectUrl: string; fileName: string }>;
  readonly revoked: string[];
}

function createDownloadHarness(options: {
  failBlobOnce?: boolean;
  failObjectUrlOnce?: boolean;
  failDispatchOnce?: boolean;
} = {}) {
  const capture: DownloadCapture = {
    bytes: [],
    mimeTypes: [],
    objectUrls: [],
    dispatches: [],
    revoked: [],
  };
  let failBlob = options.failBlobOnce ?? false;
  let failObjectUrl = options.failObjectUrlOnce ?? false;
  let failDispatch = options.failDispatchOnce ?? false;

  const adapter: BrowserWorkbookDownloadAdapter = {
    createBlob(bytes, mimeType) {
      if (failBlob) {
        failBlob = false;
        throw new Error('synthetic Blob failure');
      }
      const owned = new Uint8Array(bytes);
      capture.bytes.push(owned);
      capture.mimeTypes.push(mimeType);
      return new Blob([owned.buffer], { type: mimeType });
    },
    createObjectUrl() {
      if (failObjectUrl) {
        failObjectUrl = false;
        throw new Error('synthetic object URL failure');
      }
      const url = `blob:phase-5-5b3-${capture.objectUrls.length + 1}`;
      capture.objectUrls.push(url);
      return url;
    },
    dispatchDownload(objectUrl, fileName) {
      if (failDispatch) {
        failDispatch = false;
        throw new Error('synthetic download dispatch failure');
      }
      capture.dispatches.push({ objectUrl, fileName });
    },
    revokeObjectUrl(objectUrl) {
      capture.revoked.push(objectUrl);
    },
  };

  return { capture, adapter };
}

function realCommand(adapter: BrowserWorkbookDownloadAdapter) {
  return new BrowserWorkbookExportCommand(session.persistenceCoordinator, {
    clock: () => new Date(fixedNow),
    downloadAdapter: adapter,
  });
}

async function hydrate(dataset: BusinessDataset) {
  const result = await session.validatedAtomicDatasetHydrationService.hydrate(dataset);
  expect(result.status).toBe('hydrated');
  return session.completeSourceSnapshotService.snapshot();
}

async function mount(command: BrowserWorkbookExportCommand) {
  await act(async () => root.render(<App workbookExportCommand={command} />));
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

function exportFeedback(role: 'status' | 'alert') {
  return container.querySelector(`.workbook-export-panel [role="${role}"]`)?.textContent ?? '';
}

function decodeCaptured(bytes: Uint8Array): BusinessDataset {
  const imported = importBusinessDatasetFromXlsx(bytes, codec);
  expect(imported.ok).toBe(true);
  if (!imported.ok) throw new Error('Expected captured workbook to import successfully.');
  return imported.dataset;
}

describe('Phase 5.5B3 real browser export regression and completion gate', () => {
  it('exports the real authoritative dataset through the UI as canonical XLSX bytes without mutating live repositories', async () => {
    const expected = await hydrate(representativeDataset('A'));
    const { capture, adapter } = createDownloadHarness();
    await mount(realCommand(adapter));

    expect(capture.bytes).toHaveLength(0);
    expect(exportFeedback('status')).toBe('');

    await click('Download workbook');

    expect(capture.bytes).toHaveLength(1);
    expect(decodeCaptured(capture.bytes[0]!)).toEqual(expected);
    expect(await session.completeSourceSnapshotService.snapshot()).toEqual(expected);
    expect(capture.mimeTypes).toEqual([XLSX_WORKBOOK_MIME_TYPE]);
    expect(capture.dispatches).toEqual([
      {
        objectUrl: 'blob:phase-5-5b3-1',
        fileName: 'craft-business-manager-2026-09-17-013045.xlsx',
      },
    ]);
    expect(capture.revoked).toEqual(['blob:phase-5-5b3-1']);
    expect(exportFeedback('status')).toContain('new workbook copy');

    const copy = container.querySelector('.workbook-export-panel')?.textContent ?? '';
    expect(copy).toContain('does not overwrite a workbook you previously imported');
    expect(copy).toContain('does not create a pre-save backup');
    expect(copy).toContain('Native Save / Save As');
  });

  it('performs fresh sequential exports after authoritative source data changes and never reuses stale bytes', async () => {
    const firstExpected = await hydrate(representativeDataset('A'));
    const { capture, adapter } = createDownloadHarness();
    await mount(realCommand(adapter));

    await click('Download workbook');
    const firstBytes = capture.bytes[0]!;

    const secondExpected = await hydrate(representativeDataset('B'));
    await click('Download workbook');
    const secondBytes = capture.bytes[1]!;

    expect(capture.dispatches).toHaveLength(2);
    expect(capture.revoked).toEqual(['blob:phase-5-5b3-1', 'blob:phase-5-5b3-2']);
    expect(decodeCaptured(firstBytes)).toEqual(firstExpected);
    expect(decodeCaptured(secondBytes)).toEqual(secondExpected);
    expect(Array.from(secondBytes)).not.toEqual(Array.from(firstBytes));
    expect(await session.completeSourceSnapshotService.snapshot()).toEqual(secondExpected);
  });

  it('shows no success on a source snapshot failure and succeeds on retry without a duplicate download', async () => {
    await hydrate(representativeDataset('A'));
    const { capture, adapter } = createDownloadHarness();
    const snapshot = vi
      .spyOn(session.completeSourceSnapshotService, 'snapshot')
      .mockRejectedValueOnce(new Error('synthetic snapshot failure'));
    await mount(realCommand(adapter));

    await click('Download workbook');

    expect(exportFeedback('alert')).toContain('Complete source snapshot failed before workbook export.');
    expect(exportFeedback('status')).toBe('');
    expect(capture.dispatches).toHaveLength(0);

    await click('Download workbook');

    expect(snapshot).toHaveBeenCalledTimes(2);
    expect(capture.dispatches).toHaveLength(1);
    expect(exportFeedback('status')).toContain('new workbook copy');
  });

  it('surfaces workbook encoding failure distinctly and allows a clean retry through the same UI', async () => {
    await hydrate(representativeDataset('A'));
    let failEncode = true;
    const flakyCodec: WorkbookCodec = {
      encode(document) {
        if (failEncode) {
          failEncode = false;
          throw new Error('synthetic encoding failure');
        }
        return codec.encode(document);
      },
      decode(bytes) {
        return codec.decode(bytes);
      },
    };
    const coordinator = new PersistenceCoordinator(
      session.completeSourceSnapshotService,
      session.validatedAtomicDatasetHydrationService,
      flakyCodec,
    );
    const { capture, adapter } = createDownloadHarness();
    const command = new BrowserWorkbookExportCommand(coordinator, {
      clock: () => new Date(fixedNow),
      downloadAdapter: adapter,
    });
    await mount(command);

    await click('Download workbook');

    expect(exportFeedback('alert')).toContain('Current business source state could not be exported to XLSX.');
    expect(capture.dispatches).toHaveLength(0);

    await click('Download workbook');

    expect(capture.dispatches).toHaveLength(1);
    expect(decodeCaptured(capture.bytes.at(-1)!)).toEqual(
      await session.completeSourceSnapshotService.snapshot(),
    );
    expect(exportFeedback('status')).toContain('new workbook copy');
  });

  it('reports browser artifact preparation failure without false success and succeeds on retry', async () => {
    await hydrate(representativeDataset('A'));
    const { capture, adapter } = createDownloadHarness({ failBlobOnce: true });
    await mount(realCommand(adapter));

    await click('Download workbook');

    expect(exportFeedback('alert')).toContain('browser download could not be prepared');
    expect(exportFeedback('status')).toBe('');
    expect(capture.dispatches).toHaveLength(0);

    await click('Download workbook');

    expect(capture.dispatches).toHaveLength(1);
    expect(capture.revoked).toEqual(['blob:phase-5-5b3-1']);
    expect(exportFeedback('status')).toContain('new workbook copy');
  });

  it('cleans up after a failed browser dispatch, reports failure, and permits a successful retry', async () => {
    await hydrate(representativeDataset('A'));
    const { capture, adapter } = createDownloadHarness({ failDispatchOnce: true });
    await mount(realCommand(adapter));

    await click('Download workbook');

    expect(exportFeedback('alert')).toContain('browser download could not be started');
    expect(exportFeedback('status')).toBe('');
    expect(capture.dispatches).toHaveLength(0);
    expect(capture.revoked).toEqual(['blob:phase-5-5b3-1']);

    await click('Download workbook');

    expect(capture.dispatches).toHaveLength(1);
    expect(capture.revoked).toEqual(['blob:phase-5-5b3-1', 'blob:phase-5-5b3-2']);
    expect(exportFeedback('status')).toContain('new workbook copy');
  });
});
