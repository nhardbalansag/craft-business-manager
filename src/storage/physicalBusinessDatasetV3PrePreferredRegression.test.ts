import { describe, expect, it } from 'vitest';
import { createEmptyBusinessDataset } from '../domain/businessDataset';
import { extendLegacyBusinessDataset } from '../domain/physicalBusinessDataset';
import { createPhysicalBusinessDatasetWorkbookDocument } from './physicalBusinessDatasetWorkbook';
import {
  PRODUCT_PRICE_TIERS_SHEET_NAME,
} from './businessDatasetV2Workbook';
import {
  importPhysicalBusinessDatasetV3FromXlsx,
} from './physicalBusinessDatasetV3Workbook';
import { SheetJsWorkbookCodec } from './sheetJsWorkbookCodec';
import type { WorkbookNeutralDocument } from './workbookSchema';

const codec = new SheetJsWorkbookCodec();
const metadata = {
  exportedAt: '2026-09-20T05:00:00.000Z',
  applicationVersion: 'tp5e',
} as const;

function createPrePreferredPhysicalV2Document(): WorkbookNeutralDocument {
  const base = createEmptyBusinessDataset();
  base.products = [
    {
      id: 'PRD-LEGACY',
      name: 'Legacy Dinosaur',
      category: 'paintable-art',
      mixPresetId: undefined,
      safetyWasteRate: 0.05,
      notes: 'existing product record',
      isActive: true,
    },
  ];
  base.productFinancialProfiles = [
    {
      productId: 'PRD-LEGACY',
      laborCostPerUnit: 12.5,
      overheadCostPerUnit: 7.5,
      pricingPolicy: { method: 'profit-amount', value: 25 },
      notes: 'existing Default / Single pricing',
    },
  ];

  const physical = extendLegacyBusinessDataset(
    base,
    [
      {
        id: 'LOC-RACK-A',
        name: 'Rack A',
        type: 'rack',
        notes: 'existing rack',
        isActive: true,
      },
      {
        id: 'LOC-SHELF-1',
        name: 'Shelf 1',
        type: 'shelf',
        parentId: 'LOC-RACK-A',
        isActive: true,
      },
      {
        id: 'LOC-BIN-01',
        name: 'Bin 01',
        type: 'bin',
        parentId: 'LOC-SHELF-1',
        notes: 'existing bin',
        isActive: true,
      },
    ],
    [
      {
        id: 'MOLD-0001',
        productId: 'PRD-LEGACY',
        name: 'Legacy Dinosaur Mold',
        storageLocationId: 'LOC-BIN-01',
        notes: 'existing mold record',
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
  if (!products) throw new Error('Products sheet missing from fixture.');

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

  return legacy;
}

describe('TP5E pre-Preferred physical v2 regression', () => {
  it('migrates the oldest recognized physical v2 Products shape to physical v3 without changing existing records', () => {
    const source = createPrePreferredPhysicalV2Document();

    const result = importPhysicalBusinessDatasetV3FromXlsx(
      codec.encode(source),
      codec,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));

    expect(result.metadata).toMatchObject({
      workbookFormatVersion: 3,
      datasetSchemaVersion: 3,
    });

    expect(result.dataset.schemaVersion).toBe(3);
    expect(result.dataset.productPriceTiers).toEqual([]);

    expect(result.dataset.products).toEqual([
      {
        id: 'PRD-LEGACY',
        name: 'Legacy Dinosaur',
        category: 'paintable-art',
        mixPresetId: undefined,
        preferredYieldSampleId: undefined,
        safetyWasteRate: 0.05,
        notes: 'existing product record',
        isActive: true,
      },
    ]);

    expect(result.dataset.productFinancialProfiles).toEqual([
      {
        productId: 'PRD-LEGACY',
        laborCostPerUnit: 12.5,
        overheadCostPerUnit: 7.5,
        pricingPolicy: { method: 'profit-amount', value: 25 },
        notes: 'existing Default / Single pricing',
      },
    ]);

    expect(result.dataset.storageLocations).toEqual([
      {
        id: 'LOC-BIN-01',
        name: 'Bin 01',
        type: 'bin',
        parentId: 'LOC-SHELF-1',
        notes: 'existing bin',
        isActive: true,
      },
      {
        id: 'LOC-RACK-A',
        name: 'Rack A',
        type: 'rack',
        notes: 'existing rack',
        isActive: true,
      },
      {
        id: 'LOC-SHELF-1',
        name: 'Shelf 1',
        type: 'shelf',
        parentId: 'LOC-RACK-A',
        isActive: true,
      },
    ]);

    expect(result.dataset.molds).toEqual([
      {
        id: 'MOLD-0001',
        productId: 'PRD-LEGACY',
        name: 'Legacy Dinosaur Mold',
        storageLocationId: 'LOC-BIN-01',
        notes: 'existing mold record',
        isActive: true,
      },
    ]);
  });

  it('does not synthesize ProductPriceTiers from the existing Default / Single pricing profile', () => {
    const result = importPhysicalBusinessDatasetV3FromXlsx(
      codec.encode(createPrePreferredPhysicalV2Document()),
      codec,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));

    expect(result.dataset.productPriceTiers).toEqual([]);
    expect(result.dataset.productFinancialProfiles[0]?.pricingPolicy).toEqual({
      method: 'profit-amount',
      value: 25,
    });
  });

  it('normalizes only the recognized pre-Preferred Products column shape and fails closed for an unknown legacy shape', () => {
    const source = structuredClone(
      createPrePreferredPhysicalV2Document(),
    ) as unknown as {
      sheets: Array<{
        name: string;
        columns: string[];
        rows: Array<Record<string, unknown>>;
      }>;
    };

    const products = source.sheets.find(
      (sheet) => sheet.name === 'Products',
    )!;
    products.columns = products.columns.filter(
      (column) => column !== 'safetyWasteRate',
    );
    products.rows = products.rows.map((row) => {
      const { safetyWasteRate: _safetyWasteRate, ...unknownRow } = row;
      return unknownRow;
    });

    const result = importPhysicalBusinessDatasetV3FromXlsx(
      codec.encode(source),
      codec,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected unknown legacy shape rejection.');

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: 'schema',
          sheetName: 'Products',
        }),
      ]),
    );
  });

  it('still rejects a pre-Preferred physical v2 workbook that already contains the reserved tier sheet', () => {
    const source = structuredClone(
      createPrePreferredPhysicalV2Document(),
    ) as unknown as {
      sheets: Array<{
        name: string;
        columns: string[];
        rows: Array<Record<string, unknown>>;
      }>;
    };

    source.sheets.push({
      name: PRODUCT_PRICE_TIERS_SHEET_NAME,
      columns: ['unexpected'],
      rows: [],
    });

    const result = importPhysicalBusinessDatasetV3FromXlsx(
      codec.encode(source),
      codec,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected reserved-sheet rejection.');

    expect(result.issues).toEqual([
      expect.objectContaining({
        stage: 'migration',
        code: 'MIGRATION_STEP_FAILED',
        stepIndex: 0,
      }),
    ]);
  });
});
