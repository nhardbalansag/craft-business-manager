import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createEmptyBusinessDataset,
  CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
} from '../../domain/businessDataset';
import type { BusinessDataset } from '../../domain/types';
import {
  CORE_WORKBOOK_V3_CANONICAL_SHEET_NAMES,
  PRODUCT_PRICE_TIERS_SHEET_NAME,
  PRODUCT_PRICE_TIERS_WORKBOOK_COLUMNS,
} from '../../storage/businessDatasetV2Workbook';
import { SheetJsWorkbookCodec } from '../../storage/sheetJsWorkbookCodec';
import {
  WORKBOOK_SHEETS,
  type WorkbookNeutralDocument,
} from '../../storage/workbookSchema';
import {
  calibrationRepository,
  completeSourceSnapshotService,
  fixedRecipeItemRepository,
  materialRepository,
  mixPresetRepository,
  persistenceCoordinator,
  productComponentRepository,
  productFinancialProfileRepository,
  productRepository,
  productStockRepository,
  validatedAtomicDatasetHydrationService,
  yieldSampleRepository,
} from '../session';

function completeSourceFixture(): BusinessDataset {
  return {
    schemaVersion: CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
    materials: [
      {
        id: 'mat-plaster',
        name: 'Casting Plaster',
        group: 'plaster',
        baseUnit: 'g',
        purchaseQuantity: 1,
        purchaseUnit: 'kg',
        packageCost: 66,
        onHandQuantity: 2.5,
        onHandUnit: 'kg',
        source: {
          vendorName: 'Divisoria Craft Supply',
          source: 'Main wholesale stall',
          purchaseLink: 'https://example.com/plaster',
          contactNumber: '+63 900 000 0001',
          socialPage: '@divisoriacraft',
          notes: 'Preferred 1 kg bag.',
        },
        notes: 'Primary casting material.',
        isActive: true,
      },
      {
        id: 'mat-pigment',
        name: 'Dry Pigment',
        group: 'colorant',
        baseUnit: 'g',
        purchaseQuantity: 100,
        purchaseUnit: 'g',
        packageCost: 35,
        onHandQuantity: 50,
        onHandUnit: 'g',
        isActive: true,
      },
      {
        id: 'mat-box',
        name: 'Small Packaging Box',
        group: 'packaging',
        baseUnit: 'pc',
        purchaseQuantity: 10,
        purchaseUnit: 'pc',
        packageCost: 30,
        onHandQuantity: 20,
        onHandUnit: 'pc',
        isActive: true,
      },
    ],
    materialCalibrations: [
      {
        id: 'cal-plaster-cup-1',
        materialId: 'mat-plaster',
        measuredVolume: 1,
        volumeUnit: 'cup',
        knownWeight: 200,
        weightUnit: 'g',
        recordedAt: '2026-09-01T08:00:00.000Z',
        notes: 'Level cup measurement.',
      },
      {
        id: 'cal-plaster-cup-2',
        materialId: 'mat-plaster',
        measuredVolume: 2,
        volumeUnit: 'cup',
        knownWeight: 405,
        weightUnit: 'g',
        recordedAt: '2026-09-02T08:00:00.000Z',
      },
    ],
    mixPresets: [
      {
        id: 'mix-plaster-art',
        name: 'Paintable Art Plaster Mix',
        compatibleCategories: ['paintable-art'],
        basis: 'weight',
        lines: [
          { materialId: 'mat-plaster', role: 'primary', parts: 10 },
          { materialId: 'mat-pigment', role: 'additive', parts: 1 },
        ],
        notes: 'Production ratio preset.',
        isActive: true,
      },
    ],
    products: [
      {
        id: 'product-small',
        name: 'Small Paintable Figure',
        category: 'paintable-art',
        mixPresetId: 'mix-plaster-art',
        safetyWasteRate: 0.05,
        notes: 'Child molded product.',
        isActive: true,
      },
      {
        id: 'product-large',
        name: 'Large Paintable Set',
        category: 'paintable-art',
        mixPresetId: 'mix-plaster-art',
        safetyWasteRate: 0.1,
        isActive: true,
      },
      {
        id: 'product-standalone',
        name: 'Standalone Candle',
        category: 'candle',
        safetyWasteRate: 0,
        isActive: true,
      },
    ],
    yieldSamples: [
      {
        id: 'yield-small-1',
        productId: 'product-small',
        mixPresetId: 'mix-plaster-art',
        materialInputs: [
          { materialId: 'mat-plaster', quantity: 400, unit: 'g' },
          { materialId: 'mat-pigment', quantity: 40, unit: 'g' },
        ],
        goodPieces: 4,
        rejectedPieces: 1,
        recordedAt: '2026-09-03T09:00:00.000Z',
        notes: 'First production sample.',
      },
      {
        id: 'yield-small-2',
        productId: 'product-small',
        mixPresetId: 'mix-plaster-art',
        materialInputs: [
          { materialId: 'mat-plaster', quantity: 510, unit: 'g' },
          { materialId: 'mat-pigment', quantity: 51, unit: 'g' },
        ],
        goodPieces: 5,
        rejectedPieces: 0,
        recordedAt: '2026-09-04T09:00:00.000Z',
      },
    ],
    recipeItems: [
      {
        id: 'recipe-small-box',
        productId: 'product-small',
        materialId: 'mat-box',
        quantityPerProduct: 1,
        unit: 'pc',
        role: 'packaging',
        notes: 'One retail box per finished piece.',
      },
    ],
    productComponents: [
      {
        id: 'component-large-box',
        parentProductId: 'product-large',
        sourceType: 'material',
        sourceId: 'mat-box',
        role: 'vessel',
        quantityPerParent: 1,
        notes: 'Outer presentation box.',
      },
      {
        id: 'component-large-small',
        parentProductId: 'product-large',
        sourceType: 'product',
        sourceId: 'product-small',
        role: 'molded-component',
        quantityPerParent: 2,
      },
    ],
    productStocks: [
      { productId: 'product-large', onHandQuantity: 3, notes: 'Ready sets.' },
      { productId: 'product-small', onHandQuantity: 0 },
    ],
    productFinancialProfiles: [
      {
        productId: 'product-large',
        laborCostPerUnit: 0,
        overheadCostPerUnit: 0,
        pricingPolicy: null,
        notes: 'Configured zero-cost profile for persistence semantics.',
      },
    ],
  };
}

function reverseTopLevelInsertionOrder(dataset: BusinessDataset): BusinessDataset {
  return {
    schemaVersion: dataset.schemaVersion,
    materials: [...dataset.materials].reverse(),
    materialCalibrations: [...dataset.materialCalibrations].reverse(),
    mixPresets: [...dataset.mixPresets].reverse(),
    products: [...dataset.products].reverse(),
    yieldSamples: [...dataset.yieldSamples].reverse(),
    recipeItems: [...dataset.recipeItems].reverse(),
    productComponents: [...dataset.productComponents].reverse(),
    productStocks: [...dataset.productStocks].reverse(),
    productFinancialProfiles: [...dataset.productFinancialProfiles].reverse(),
  };
}

async function hydrate(dataset: BusinessDataset): Promise<void> {
  const result = await validatedAtomicDatasetHydrationService.hydrate(dataset);
  expect(result).toEqual({ status: 'hydrated' });
}

function withoutVariableExportMetadata(
  document: WorkbookNeutralDocument,
): WorkbookNeutralDocument {
  return {
    sheets: document.sheets.map((sheet) => ({
      name: sheet.name,
      columns: [...sheet.columns],
      rows: sheet.rows.map((row) => {
        const stableRow = { ...row };
        if (sheet.name === '_Meta') delete stableRow.exportedAt;
        return stableRow;
      }),
    })),
  };
}

function repositoryIdentities() {
  return [
    materialRepository,
    calibrationRepository,
    mixPresetRepository,
    productRepository,
    yieldSampleRepository,
    fixedRecipeItemRepository,
    productComponentRepository,
    productStockRepository,
    productFinancialProfileRepository,
  ] as const;
}

beforeEach(async () => {
  await hydrate(createEmptyBusinessDataset());
});

afterEach(async () => {
  await hydrate(createEmptyBusinessDataset());
});

describe('Phase 5.6A1 source round-trip fidelity and deterministic workbook semantics', () => {
  it('Scenario A: round-trips all nine authoritative source collections through real XLSX bytes and stable repositories', async () => {
    const fixture = completeSourceFixture();
    const identitiesBefore = repositoryIdentities();

    await hydrate(fixture);
    const before = await completeSourceSnapshotService.snapshot();

    const exported = await persistenceCoordinator.exportCurrentWorkbook();
    expect(exported.status).toBe('exported');
    expect(exported.bytes.byteLength).toBeGreaterThan(0);

    await hydrate(createEmptyBusinessDataset());
    await expect(completeSourceSnapshotService.snapshot()).resolves.toEqual(
      createEmptyBusinessDataset(),
    );

    const imported = await persistenceCoordinator.importAndApplyWorkbook(exported.bytes);
    expect(imported.status).toBe('hydrated');

    const after = await completeSourceSnapshotService.snapshot();
    expect(after).toEqual(before);

    const identitiesAfter = repositoryIdentities();
    identitiesBefore.forEach((repository, index) => {
      expect(identitiesAfter[index]).toBe(repository);
    });

    expect(after.materials).toHaveLength(3);
    expect(after.materialCalibrations).toHaveLength(2);
    expect(after.mixPresets).toHaveLength(1);
    expect(after.products).toHaveLength(3);
    expect(after.yieldSamples).toHaveLength(2);
    expect(after.recipeItems).toHaveLength(1);
    expect(after.productComponents).toHaveLength(2);
    expect(after.productStocks).toHaveLength(2);
    expect(after.productFinancialProfiles).toHaveLength(1);
  });

  it('Scenario E: preserves missing profile versus configured explicit-zero costs with null pricing policy', async () => {
    await hydrate(completeSourceFixture());
    const exported = await persistenceCoordinator.exportCurrentWorkbook();

    await hydrate(createEmptyBusinessDataset());
    const imported = await persistenceCoordinator.importAndApplyWorkbook(exported.bytes);
    expect(imported.status).toBe('hydrated');

    await expect(
      productFinancialProfileRepository.findByProductId('product-standalone'),
    ).resolves.toBeNull();
    await expect(
      productFinancialProfileRepository.findByProductId('product-small'),
    ).resolves.toBeNull();
    await expect(
      productFinancialProfileRepository.findByProductId('product-large'),
    ).resolves.toEqual({
      productId: 'product-large',
      laborCostPerUnit: 0,
      overheadCostPerUnit: 0,
      pricingPolicy: null,
      notes: 'Configured zero-cost profile for persistence semantics.',
    });
  });

  it('Scenario I: equivalent source insertion orders produce the same canonical workbook schema and row semantics', async () => {
    const fixture = completeSourceFixture();
    const codec = new SheetJsWorkbookCodec();

    await hydrate(fixture);
    const first = codec.decode((await persistenceCoordinator.exportCurrentWorkbook()).bytes);

    await hydrate(reverseTopLevelInsertionOrder(fixture));
    const second = codec.decode((await persistenceCoordinator.exportCurrentWorkbook()).bytes);

    expect(first.sheets.map((sheet) => sheet.name)).toEqual(
      CORE_WORKBOOK_V3_CANONICAL_SHEET_NAMES,
    );
    expect(second.sheets.map((sheet) => sheet.name)).toEqual(
      CORE_WORKBOOK_V3_CANONICAL_SHEET_NAMES,
    );

    for (const contract of WORKBOOK_SHEETS) {
      const firstSheet = first.sheets.find((sheet) => sheet.name === contract.name);
      const secondSheet = second.sheets.find((sheet) => sheet.name === contract.name);
      const expectedColumns = contract.columns.map((column) => column.key);

      expect(firstSheet?.columns).toEqual(expectedColumns);
      expect(secondSheet?.columns).toEqual(expectedColumns);
    }

    expect(
      first.sheets.find((sheet) => sheet.name === PRODUCT_PRICE_TIERS_SHEET_NAME)?.columns,
    ).toEqual(PRODUCT_PRICE_TIERS_WORKBOOK_COLUMNS);
    expect(
      second.sheets.find((sheet) => sheet.name === PRODUCT_PRICE_TIERS_SHEET_NAME)?.columns,
    ).toEqual(PRODUCT_PRICE_TIERS_WORKBOOK_COLUMNS);

    expect(withoutVariableExportMetadata(second)).toEqual(
      withoutVariableExportMetadata(first),
    );

    const materialRows = first.sheets.find((sheet) => sheet.name === 'Materials')?.rows ?? [];
    expect(materialRows.map((row) => row.id)).toEqual([
      'mat-box',
      'mat-pigment',
      'mat-plaster',
    ]);

    const productRows = first.sheets.find((sheet) => sheet.name === 'Products')?.rows ?? [];
    expect(productRows.map((row) => row.id)).toEqual([
      'product-large',
      'product-small',
      'product-standalone',
    ]);

    for (const childSheetName of [
      'MixPresetCategories',
      'MixPresetLines',
      'YieldSampleInputs',
    ] as const) {
      const firstRows = first.sheets.find((sheet) => sheet.name === childSheetName)?.rows;
      const secondRows = second.sheets.find((sheet) => sheet.name === childSheetName)?.rows;
      expect(secondRows).toEqual(firstRows);
    }
  });
});
