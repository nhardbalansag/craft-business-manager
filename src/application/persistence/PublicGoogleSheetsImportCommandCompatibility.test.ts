import { describe, expect, it, vi } from 'vitest';
import { createEmptyBusinessDataset } from '../../domain/businessDataset';
import { extendLegacyBusinessDataset } from '../../domain/physicalBusinessDataset';
import type { PhysicalBusinessDatasetV3 } from '../../domain/physicalBusinessDatasetV3';
import { createPhysicalBusinessDatasetWorkbookDocument } from '../../storage/physicalBusinessDatasetWorkbook';
import { importPhysicalBusinessDatasetV3FromXlsx } from '../../storage/physicalBusinessDatasetV3Workbook';
import { SheetJsWorkbookCodec } from '../../storage/sheetJsWorkbookCodec';
import type { WorkbookNeutralDocument } from '../../storage/workbookSchema';
import {
  PublicGoogleSheetsImportCommand,
  type PublicGoogleSheetsFetch,
} from './PublicGoogleSheetsImportCommand';
import type {
  PersistenceWorkbookApplyResult,
} from './PersistenceCoordinator';

const codec = new SheetJsWorkbookCodec();

const publishedId = '2PACX-1vTp5fLegacyPhysicalSnapshot123456789';
const publishedUrl =
  `https://docs.google.com/spreadsheets/d/e/${publishedId}/pubhtml?gid=0&single=true`;
const expectedExportUrl =
  `https://docs.google.com/spreadsheets/d/e/${publishedId}/pub?output=xlsx`;

const metadata = {
  exportedAt: '2026-09-20T05:30:00.000Z',
  applicationVersion: 'tp5f',
} as const;

function exactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function createPublishedPrePreferredPhysicalV2Bytes(): Uint8Array {
  const base = createEmptyBusinessDataset();

  base.products = [
    {
      id: 'PRD-GS-LEGACY',
      name: 'Published Legacy Dinosaur',
      category: 'paintable-art',
      safetyWasteRate: 0.05,
      notes: 'published product note',
      isActive: true,
    },
  ];

  base.productFinancialProfiles = [
    {
      productId: 'PRD-GS-LEGACY',
      laborCostPerUnit: 18.25,
      overheadCostPerUnit: 6.75,
      pricingPolicy: { method: 'profit-amount', value: 35 },
      notes: 'published Default / Single pricing',
    },
  ];

  const physical = extendLegacyBusinessDataset(
    base,
    [
      {
        id: 'LOC-GS-RACK',
        name: 'Published Rack',
        type: 'rack',
        notes: 'published rack note',
        isActive: true,
      },
      {
        id: 'LOC-GS-SHELF',
        name: 'Published Shelf',
        type: 'shelf',
        parentId: 'LOC-GS-RACK',
        isActive: true,
      },
      {
        id: 'LOC-GS-BIN',
        name: 'Published Bin',
        type: 'bin',
        parentId: 'LOC-GS-SHELF',
        notes: 'published bin note',
        isActive: true,
      },
    ],
    [
      {
        id: 'MOLD-GS-0001',
        productId: 'PRD-GS-LEGACY',
        name: 'Published Legacy Mold',
        storageLocationId: 'LOC-GS-BIN',
        notes: 'published mold note',
        isActive: true,
      },
    ],
  );

  const current = createPhysicalBusinessDatasetWorkbookDocument(
    physical,
    metadata,
  );

  const legacy = structuredClone(current) as unknown as {
    sheets: Array<{
      name: string;
      columns: string[];
      rows: Array<Record<string, unknown>>;
    }>;
  };

  const products = legacy.sheets.find(
    (sheet) => sheet.name === 'Products',
  );
  if (!products) throw new Error('Products sheet missing from TP5F fixture.');

  products.columns = products.columns.filter(
    (column) => column !== 'preferredYieldSampleId',
  );
  products.rows = products.rows.map((row) => {
    const {
      preferredYieldSampleId: _preferredYieldSampleId,
      ...legacyRow
    } = row;
    return legacyRow;
  });

  const document = legacy as unknown as WorkbookNeutralDocument;
  expect(
    document.sheets.some((sheet) => sheet.name === 'ProductPriceTiers'),
  ).toBe(false);

  return codec.encode(document);
}

describe('TP5F public Google Sheets workbook compatibility', () => {
  it('routes an old published physical-v2 XLSX snapshot through the shared import boundary and physical-v3 migration', async () => {
    const publishedBytes = createPublishedPrePreferredPhysicalV2Bytes();

    const fetchPublishedSheet = vi.fn<PublicGoogleSheetsFetch>(
      async (url) => ({
        ok: true,
        status: 200,
        async arrayBuffer() {
          expect(url).toBe(expectedExportUrl);
          return exactArrayBuffer(publishedBytes);
        },
      }),
    );

    let importedDataset: PhysicalBusinessDatasetV3 | undefined;

    const importAndApplyWorkbook = vi.fn(
      async (receivedBytes: Uint8Array): Promise<PersistenceWorkbookApplyResult> => {
        expect(Array.from(receivedBytes)).toEqual(Array.from(publishedBytes));

        const imported = importPhysicalBusinessDatasetV3FromXlsx(
          receivedBytes,
          codec,
        );

        if (!imported.ok) {
          return {
            status: 'rejected',
            stage: 'import',
            issues: imported.issues,
          };
        }

        importedDataset = imported.dataset;
        return {
          status: 'hydrated',
          metadata: imported.metadata,
        };
      },
    );

    const command = new PublicGoogleSheetsImportCommand(
      { importAndApplyWorkbook },
      fetchPublishedSheet,
    );

    const selection = await command.loadPublishedSheet(publishedUrl);

    expect(fetchPublishedSheet).toHaveBeenCalledOnce();
    expect(fetchPublishedSheet).toHaveBeenCalledWith(expectedExportUrl);
    expect(selection.byteLength).toBe(publishedBytes.byteLength);
    expect(importAndApplyWorkbook).not.toHaveBeenCalled();

    const result = await command.applyPendingSelection();

    expect(importAndApplyWorkbook).toHaveBeenCalledOnce();
    expect(result).toEqual({
      status: 'hydrated',
      metadata: expect.objectContaining({
        workbookFormatVersion: 3,
        datasetSchemaVersion: 3,
      }),
    });

    expect(importedDataset).toBeDefined();
    expect(importedDataset?.productPriceTiers).toEqual([]);

    expect(importedDataset?.products).toEqual([
      {
        id: 'PRD-GS-LEGACY',
        name: 'Published Legacy Dinosaur',
        category: 'paintable-art',
        mixPresetId: undefined,
        preferredYieldSampleId: undefined,
        safetyWasteRate: 0.05,
        notes: 'published product note',
        isActive: true,
      },
    ]);

    expect(importedDataset?.productFinancialProfiles).toEqual([
      {
        productId: 'PRD-GS-LEGACY',
        laborCostPerUnit: 18.25,
        overheadCostPerUnit: 6.75,
        pricingPolicy: { method: 'profit-amount', value: 35 },
        notes: 'published Default / Single pricing',
      },
    ]);

    expect(importedDataset?.storageLocations).toEqual([
      {
        id: 'LOC-GS-BIN',
        name: 'Published Bin',
        type: 'bin',
        parentId: 'LOC-GS-SHELF',
        notes: 'published bin note',
        isActive: true,
      },
      {
        id: 'LOC-GS-RACK',
        name: 'Published Rack',
        type: 'rack',
        notes: 'published rack note',
        isActive: true,
      },
      {
        id: 'LOC-GS-SHELF',
        name: 'Published Shelf',
        type: 'shelf',
        parentId: 'LOC-GS-RACK',
        isActive: true,
      },
    ]);

    expect(importedDataset?.molds).toEqual([
      {
        id: 'MOLD-GS-0001',
        productId: 'PRD-GS-LEGACY',
        name: 'Published Legacy Mold',
        storageLocationId: 'LOC-GS-BIN',
        notes: 'published mold note',
        isActive: true,
      },
    ]);
  });
});
