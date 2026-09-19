import { describe, expect, it, vi } from 'vitest';
import { createEmptyBusinessDataset } from '../../domain/businessDataset';
import { createEmptyBusinessDatasetV2 } from '../../domain/businessDatasetV2';
import {
  extendBusinessDatasetV2,
  type PhysicalBusinessDatasetV3,
} from '../../domain/physicalBusinessDatasetV3';
import type { ProductPriceTier } from '../../domain/productPriceTiers';
import { exportBusinessDatasetToXlsx } from '../../storage/businessDatasetWorkbookExport';
import {
  CORE_WORKBOOK_V3_CANONICAL_SHEET_NAMES,
} from '../../storage/businessDatasetV2Workbook';
import {
  PHYSICAL_WORKBOOK_V3_CANONICAL_SHEET_NAMES,
} from '../../storage/physicalBusinessDatasetV3Workbook';
import { SheetJsWorkbookCodec } from '../../storage/sheetJsWorkbookCodec';
import { InMemoryCalibrationRepository } from '../calibrations/InMemoryCalibrationRepository';
import { InMemoryMaterialRepository } from '../materials/InMemoryMaterialRepository';
import { InMemoryMixPresetRepository } from '../mixPresets/InMemoryMixPresetRepository';
import { InMemoryMoldRepository } from '../molds/InMemoryMoldRepository';
import { InMemoryProductComponentRepository } from '../productComponents/InMemoryProductComponentRepository';
import { InMemoryProductFinancialProfileRepository } from '../productFinancialProfiles/InMemoryProductFinancialProfileRepository';
import { InMemoryProductPriceTierRepository } from '../productPriceTiers/InMemoryProductPriceTierRepository';
import { InMemoryProductRepository } from '../products/InMemoryProductRepository';
import { InMemoryProductStockRepository } from '../productStocks/InMemoryProductStockRepository';
import { InMemoryFixedRecipeItemRepository } from '../recipeItems/InMemoryFixedRecipeItemRepository';
import { InMemoryStorageLocationRepository } from '../storageLocations/InMemoryStorageLocationRepository';
import { InMemoryYieldSampleRepository } from '../yieldSamples/InMemoryYieldSampleRepository';
import { CompleteSourceSnapshotService } from './CompleteSourceSnapshotService';
import { CompleteSourceSnapshotServiceV2 } from './CompleteSourceSnapshotServiceV2';
import { PersistenceCoordinator } from './PersistenceCoordinator';
import { PhysicalDatasetHydrationServiceV3 } from './PhysicalDatasetHydrationServiceV3';
import { PhysicalSourceSnapshotServiceV3 } from './PhysicalSourceSnapshotServiceV3';
import { DatasetHydrationError } from './ValidatedAtomicDatasetHydrationService';
import { ValidatedAtomicDatasetHydrationServiceV2 } from './ValidatedAtomicDatasetHydrationServiceV2';

const codec = new SheetJsWorkbookCodec();

function tier(
  id: string,
  productId: string,
  priceAmount: number,
): ProductPriceTier {
  return {
    id,
    productId,
    name: `Tier ${id}`,
    kind: 'bulk',
    priceBasis: 'per-unit',
    priceAmount,
    unitsPerOffer: 1,
    minimumOrderQuantity: 10,
    additionalCostPerOffer: 0,
    isActive: true,
  };
}

function coreDataset(
  productId: string,
  tierId: string,
  priceAmount: number,
) {
  const dataset = createEmptyBusinessDatasetV2();
  dataset.products.push({
    id: productId,
    name: `Product ${productId}`,
    category: 'paintable-art',
    safetyWasteRate: 0.05,
    isActive: true,
  });
  dataset.productFinancialProfiles.push({
    productId,
    laborCostPerUnit: 10,
    overheadCostPerUnit: 5,
    pricingPolicy: { method: 'profit-amount', value: 20 },
  });
  dataset.productPriceTiers.push(tier(tierId, productId, priceAmount));
  return dataset;
}

function physicalDataset(
  productId: string,
  tierId: string,
  priceAmount: number,
): PhysicalBusinessDatasetV3 {
  return extendBusinessDatasetV2(
    coreDataset(productId, tierId, priceAmount),
    [
      {
        id: `RACK-${productId}`,
        name: 'Rack',
        type: 'rack',
        isActive: true,
      },
      {
        id: `SHELF-${productId}`,
        name: 'Shelf',
        type: 'shelf',
        parentId: `RACK-${productId}`,
        isActive: true,
      },
      {
        id: `BIN-${productId}`,
        name: 'Bin',
        type: 'bin',
        parentId: `SHELF-${productId}`,
        isActive: true,
      },
    ],
    [
      {
        id: `MOLD-${productId}`,
        productId,
        name: 'Mold',
        storageLocationId: `BIN-${productId}`,
        isActive: true,
      },
    ],
  );
}

class FaultInjectingTierRepository extends InMemoryProductPriceTierRepository {
  failuresRemaining = 0;

  override async replaceAll(records: readonly ProductPriceTier[]): Promise<void> {
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      throw new Error('synthetic tier replacement failure');
    }
    await super.replaceAll(records);
  }
}

function createHarness(
  productPriceTiers: InMemoryProductPriceTierRepository =
    new InMemoryProductPriceTierRepository(),
) {
  const materials = new InMemoryMaterialRepository();
  const calibrations = new InMemoryCalibrationRepository();
  const mixPresets = new InMemoryMixPresetRepository();
  const products = new InMemoryProductRepository();
  const yieldSamples = new InMemoryYieldSampleRepository();
  const recipeItems = new InMemoryFixedRecipeItemRepository();
  const productComponents = new InMemoryProductComponentRepository();
  const productStocks = new InMemoryProductStockRepository();
  const productFinancialProfiles =
    new InMemoryProductFinancialProfileRepository();
  const storageLocations = new InMemoryStorageLocationRepository();
  const molds = new InMemoryMoldRepository();

  const baseSnapshot = new CompleteSourceSnapshotService({
    materials,
    calibrations,
    mixPresets,
    products,
    yieldSamples,
    recipeItems,
    productComponents,
    productStocks,
    productFinancialProfiles,
  });

  const snapshotV2 = new CompleteSourceSnapshotServiceV2(
    baseSnapshot,
    productPriceTiers,
  );

  const hydrationV2 = new ValidatedAtomicDatasetHydrationServiceV2(
    {
      materials,
      calibrations,
      mixPresets,
      products,
      yieldSamples,
      recipeItems,
      productComponents,
      productStocks,
      productFinancialProfiles,
      productPriceTiers,
    },
    snapshotV2,
  );

  const snapshotV3 = new PhysicalSourceSnapshotServiceV3(
    snapshotV2,
    storageLocations,
    molds,
  );

  const hydrationV3 = new PhysicalDatasetHydrationServiceV3(
    hydrationV2,
    snapshotV3,
    storageLocations,
    molds,
  );

  const coordinator = new PersistenceCoordinator(
    snapshotV3,
    hydrationV3,
    codec,
    {
      clock: () => new Date('2026-09-20T06:00:00.000Z'),
      applicationVersion: 'tp5g',
    },
  );

  return {
    productPriceTiers,
    storageLocations,
    molds,
    snapshotV2,
    hydrationV2,
    snapshotV3,
    hydrationV3,
    coordinator,
  };
}

async function expectHydrated(
  promise: Promise<{ status: string }>,
): Promise<void> {
  await expect(promise).resolves.toMatchObject({ status: 'hydrated' });
}

describe('TP5G atomic tier-aware persistence completion gate', () => {
  it('exports and restores core workbook v3 when there are tiers but no physical records', async () => {
    const harness = createHarness();
    const source = extendBusinessDatasetV2(
      coreDataset('PROD-CORE', 'TIER-CORE', 42.5),
    );

    await expectHydrated(harness.hydrationV3.hydrate(source));
    const exported = await harness.coordinator.exportCurrentWorkbook();
    const document = codec.decode(exported.bytes);

    expect(document.sheets.map((sheet) => sheet.name)).toEqual(
      CORE_WORKBOOK_V3_CANONICAL_SHEET_NAMES,
    );
    expect(document.sheets.find((sheet) => sheet.name === '_Meta')?.rows[0]).toMatchObject({
      workbookFormatVersion: 3,
      datasetSchemaVersion: 2,
    });

    await expectHydrated(
      harness.hydrationV3.hydrate(
        extendBusinessDatasetV2(createEmptyBusinessDatasetV2()),
      ),
    );

    const restored = await harness.coordinator.importAndApplyWorkbook(
      exported.bytes,
    );
    expect(restored).toMatchObject({
      status: 'hydrated',
      metadata: {
        workbookFormatVersion: 3,
        datasetSchemaVersion: 2,
      },
    });

    expect(await harness.snapshotV3.snapshot()).toEqual(source);
  });

  it('exports and restores physical workbook v3 with tiers, storage locations, and molds', async () => {
    const harness = createHarness();
    const source = physicalDataset('PROD-PHYS', 'TIER-PHYS', 55);

    await expectHydrated(harness.hydrationV3.hydrate(source));
    const canonicalSource = await harness.snapshotV3.snapshot();
    const exported = await harness.coordinator.exportCurrentWorkbook();
    const document = codec.decode(exported.bytes);

    expect(document.sheets.map((sheet) => sheet.name)).toEqual(
      PHYSICAL_WORKBOOK_V3_CANONICAL_SHEET_NAMES,
    );
    expect(document.sheets.find((sheet) => sheet.name === '_Meta')?.rows[0]).toMatchObject({
      workbookFormatVersion: 3,
      datasetSchemaVersion: 3,
    });

    await expectHydrated(
      harness.hydrationV3.hydrate(
        extendBusinessDatasetV2(createEmptyBusinessDatasetV2()),
      ),
    );

    expect(
      await harness.coordinator.importAndApplyWorkbook(exported.bytes),
    ).toMatchObject({
      status: 'hydrated',
      metadata: {
        workbookFormatVersion: 3,
        datasetSchemaVersion: 3,
      },
    });

    expect(await harness.snapshotV3.snapshot()).toEqual(canonicalSource);
  });

  it('imports an old core workbook through the live coordinator and clears existing tiers instead of synthesizing them', async () => {
    const harness = createHarness();
    await expectHydrated(
      harness.hydrationV3.hydrate(
        extendBusinessDatasetV2(
          coreDataset('PROD-OLD', 'TIER-LIVE', 99),
        ),
      ),
    );

    const legacy = createEmptyBusinessDataset();
    legacy.products.push({
      id: 'PROD-OLD',
      name: 'Legacy Product',
      category: 'paintable-art',
      safetyWasteRate: 0.05,
      isActive: true,
    });
    legacy.productFinancialProfiles.push({
      productId: 'PROD-OLD',
      laborCostPerUnit: 10,
      overheadCostPerUnit: 5,
      pricingPolicy: { method: 'profit-amount', value: 20 },
    });

    const legacyBytes = exportBusinessDatasetToXlsx(
      legacy,
      { exportedAt: '2026-09-20T06:05:00.000Z' },
      codec,
    );

    expect(
      await harness.coordinator.importAndApplyWorkbook(legacyBytes),
    ).toMatchObject({ status: 'hydrated' });

    const restored = await harness.snapshotV3.snapshot();
    expect(restored.productPriceTiers).toEqual([]);
    expect(restored.productFinancialProfiles).toEqual(
      legacy.productFinancialProfiles,
    );
    expect(restored.storageLocations).toEqual([]);
    expect(restored.molds).toEqual([]);
  });

  it('restores the previous base collections and tiers when tier replacement fails after base writes', async () => {
    const tiers = new FaultInjectingTierRepository();
    const harness = createHarness(tiers);
    const previous = coreDataset('PROD-OLD', 'TIER-OLD', 40);
    const next = coreDataset('PROD-NEW', 'TIER-NEW', 60);

    await expectHydrated(harness.hydrationV2.hydrate(previous));
    const before = await harness.snapshotV2.snapshot();

    tiers.failuresRemaining = 1;

    await expect(harness.hydrationV2.hydrate(next)).rejects.toMatchObject({
      code: 'APPLY_FAILED_RESTORED',
    } satisfies Partial<DatasetHydrationError>);

    expect(await harness.snapshotV2.snapshot()).toEqual(before);
  });

  it('restores tiers together with physical sources when a later physical replacement fails', async () => {
    const harness = createHarness();
    const previous = physicalDataset('PROD-OLD', 'TIER-OLD', 40);
    const next = physicalDataset('PROD-NEW', 'TIER-NEW', 60);

    await expectHydrated(harness.hydrationV3.hydrate(previous));
    const before = await harness.snapshotV3.snapshot();

    const originalReplaceAll =
      harness.storageLocations.replaceAll.bind(harness.storageLocations);
    let failNext = true;
    vi.spyOn(harness.storageLocations, 'replaceAll').mockImplementation(
      async (records) => {
        if (failNext) {
          failNext = false;
          throw new Error('synthetic storage replacement failure');
        }
        await originalReplaceAll(records);
      },
    );

    await expect(harness.hydrationV3.hydrate(next)).rejects.toMatchObject({
      code: 'APPLY_FAILED_RESTORED',
    } satisfies Partial<DatasetHydrationError>);

    expect(await harness.snapshotV3.snapshot()).toEqual(before);
  });

  it('preserves severe rollback failure as a distinct error when tier restoration also fails', async () => {
    const tiers = new FaultInjectingTierRepository();
    const harness = createHarness(tiers);
    const previous = coreDataset('PROD-OLD', 'TIER-OLD', 40);
    const next = coreDataset('PROD-NEW', 'TIER-NEW', 60);

    await expectHydrated(harness.hydrationV2.hydrate(previous));
    tiers.failuresRemaining = 2;

    try {
      await harness.hydrationV2.hydrate(next);
      throw new Error('expected rollback failure');
    } catch (error) {
      expect(error).toBeInstanceOf(DatasetHydrationError);
      expect(error).toMatchObject({ code: 'ROLLBACK_FAILED' });
      expect((error as DatasetHydrationError).operationCause).toBeDefined();
      expect((error as DatasetHydrationError).rollbackCause).toBeDefined();
    }
  });
});
