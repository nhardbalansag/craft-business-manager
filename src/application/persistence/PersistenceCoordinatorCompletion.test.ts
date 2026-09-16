import { describe, expect, it } from 'vitest';
import { createEmptyBusinessDataset } from '../../domain/businessDataset';
import type { Product } from '../../domain/products';
import type { BusinessDataset } from '../../domain/types';
import { exportBusinessDatasetToXlsx } from '../../storage/businessDatasetWorkbookExport';
import { InMemoryWorkbookTransport } from '../../storage/InMemoryWorkbookTransport';
import { SheetJsWorkbookCodec } from '../../storage/sheetJsWorkbookCodec';
import { CANONICAL_WORKBOOK_SHEET_NAMES } from '../../storage/workbookSchema';
import type { WorkbookTransport } from '../../storage/WorkbookTransport';
import { InMemoryCalibrationRepository } from '../calibrations/InMemoryCalibrationRepository';
import { InMemoryMaterialRepository } from '../materials/InMemoryMaterialRepository';
import { InMemoryMixPresetRepository } from '../mixPresets/InMemoryMixPresetRepository';
import { InMemoryProductComponentRepository } from '../productComponents/InMemoryProductComponentRepository';
import { InMemoryProductFinancialProfileRepository } from '../productFinancialProfiles/InMemoryProductFinancialProfileRepository';
import { InMemoryProductRepository } from '../products/InMemoryProductRepository';
import { InMemoryProductStockRepository } from '../productStocks/InMemoryProductStockRepository';
import { ProductStockService } from '../productStocks/ProductStockService';
import { InMemoryFixedRecipeItemRepository } from '../recipeItems/InMemoryFixedRecipeItemRepository';
import { InMemoryYieldSampleRepository } from '../yieldSamples/InMemoryYieldSampleRepository';
import { CompleteSourceSnapshotService } from './CompleteSourceSnapshotService';
import { PersistenceLifecycleOperationalError } from './PersistenceLifecycle';
import { PersistenceCoordinator } from './PersistenceCoordinator';
import { ValidatedAtomicDatasetHydrationService } from './ValidatedAtomicDatasetHydrationService';

function datasetA(): BusinessDataset {
  return {
    schemaVersion: 1,
    materials: [
      {
        id: 'mat-a',
        name: 'Plaster',
        group: 'plaster',
        baseUnit: 'g',
        purchaseQuantity: 1,
        purchaseUnit: 'kg',
        packageCost: 66,
        onHandQuantity: 2,
        onHandUnit: 'kg',
        isActive: true,
      },
      {
        id: 'mat-b',
        name: 'Glass vessel',
        group: 'container',
        baseUnit: 'pc',
        purchaseQuantity: 12,
        purchaseUnit: 'pc',
        packageCost: 240,
        onHandQuantity: 12,
        onHandUnit: 'pc',
        source: { vendorName: 'Supplier B', notes: 'authoritative source evidence' },
        isActive: true,
      },
    ],
    materialCalibrations: [],
    mixPresets: [],
    products: [
      {
        id: 'product-a',
        name: 'Paintable figure',
        category: 'paintable-art',
        safetyWasteRate: 0.05,
        isActive: true,
      },
      {
        id: 'product-b',
        name: 'Candle display',
        category: 'candle',
        safetyWasteRate: 0,
        isActive: true,
      },
    ],
    yieldSamples: [],
    recipeItems: [],
    productComponents: [],
    productStocks: [{ productId: 'product-a', onHandQuantity: 0 }],
    productFinancialProfiles: [
      {
        productId: 'product-a',
        laborCostPerUnit: 0,
        overheadCostPerUnit: 0,
        pricingPolicy: null,
      },
    ],
  };
}

class FaultInjectingProductRepository extends InMemoryProductRepository {
  failuresRemaining = 0;

  override async replaceAll(records: readonly Product[]): Promise<void> {
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      throw new Error('synthetic product replacement failure');
    }
    await super.replaceAll(records);
  }
}

function createHarness(products = new InMemoryProductRepository()) {
  const repositories = {
    materials: new InMemoryMaterialRepository(),
    calibrations: new InMemoryCalibrationRepository(),
    mixPresets: new InMemoryMixPresetRepository(),
    products,
    yieldSamples: new InMemoryYieldSampleRepository(),
    recipeItems: new InMemoryFixedRecipeItemRepository(),
    productComponents: new InMemoryProductComponentRepository(),
    productStocks: new InMemoryProductStockRepository(),
    productFinancialProfiles: new InMemoryProductFinancialProfileRepository(),
  };

  const snapshot = new CompleteSourceSnapshotService(repositories);
  const hydration = new ValidatedAtomicDatasetHydrationService(repositories, snapshot);
  const codec = new SheetJsWorkbookCodec();
  const coordinator = new PersistenceCoordinator(snapshot, hydration, codec, {
    clock: () => new Date('2026-09-16T08:30:00.000Z'),
    applicationVersion: '5.3c3-completion',
  });
  const stockService = new ProductStockService(repositories.productStocks, repositories.products);

  return { repositories, snapshot, hydration, codec, coordinator, stockService };
}

async function expectHydrated(result: Awaited<ReturnType<ValidatedAtomicDatasetHydrationService['hydrate']>>) {
  expect(result).toEqual({ status: 'hydrated' });
}

describe('Phase 5.3C3 complete persistence lifecycle', () => {
  it('round-trips source state A through save, live mutation to B, load, and exact restored snapshot A', async () => {
    const harness = createHarness();
    await expectHydrated(await harness.hydration.hydrate(datasetA()));
    const expectedA = await harness.snapshot.snapshot();
    const transport = new InMemoryWorkbookTransport();

    const save = await harness.coordinator.saveCurrentWorkbook(transport);
    expect(save.status).toBe('saved');

    await expectHydrated(await harness.hydration.hydrate(createEmptyBusinessDataset()));
    expect(await harness.snapshot.snapshot()).toEqual(createEmptyBusinessDataset());

    const load = await harness.coordinator.loadCurrentWorkbook(transport);
    expect(load.status).toBe('hydrated');
    expect(await harness.snapshot.snapshot()).toEqual(expectedA);
  });

  it('already-wired application services observe restored state without reconstruction', async () => {
    const harness = createHarness();
    const serviceBeforeHydration = harness.stockService;
    await expectHydrated(await harness.hydration.hydrate(datasetA()));
    const exported = await harness.coordinator.exportCurrentWorkbook();

    await expectHydrated(await harness.hydration.hydrate(createEmptyBusinessDataset()));
    expect(await serviceBeforeHydration.getStock('product-a')).toBeNull();

    const restored = await harness.coordinator.importAndApplyWorkbook(exported.bytes);
    expect(restored.status).toBe('hydrated');
    expect(await serviceBeforeHydration.getStock('product-a')).toEqual({
      productId: 'product-a',
      onHandQuantity: 0,
    });
  });

  it('invalid workbook rejection performs zero live writes', async () => {
    const harness = createHarness();
    await expectHydrated(await harness.hydration.hydrate(datasetA()));
    const before = await harness.snapshot.snapshot();

    const result = await harness.coordinator.importAndApplyWorkbook(new Uint8Array([1, 2, 3]));

    expect(result).toMatchObject({ status: 'rejected', stage: 'import' });
    expect(await harness.snapshot.snapshot()).toEqual(before);
  });

  it('transport-load failure performs zero live writes', async () => {
    const harness = createHarness();
    await expectHydrated(await harness.hydration.hydrate(datasetA()));
    const before = await harness.snapshot.snapshot();
    const transportFailure = new Error('synthetic load failure');
    const transport: WorkbookTransport = {
      loadWorkbook: async () => {
        throw transportFailure;
      },
      saveWorkbook: async () => ({ backup: { status: 'not-requested' } }),
    };

    await expect(harness.coordinator.loadCurrentWorkbook(transport)).rejects.toMatchObject({
      stage: 'transport-load',
      code: 'TRANSPORT_LOAD_FAILED',
      causeValue: transportFailure,
    });
    expect(await harness.snapshot.snapshot()).toEqual(before);
  });

  it('hydration apply failure restores exact previous live dataset through the coordinator', async () => {
    const products = new FaultInjectingProductRepository();
    const harness = createHarness(products);
    await expectHydrated(await harness.hydration.hydrate(datasetA()));
    const before = await harness.snapshot.snapshot();
    const emptyBytes = exportBusinessDatasetToXlsx(
      createEmptyBusinessDataset(),
      { exportedAt: '2026-09-16T09:00:00.000Z' },
      harness.codec,
    );

    products.failuresRemaining = 1;
    await expect(harness.coordinator.importAndApplyWorkbook(emptyBytes)).rejects.toMatchObject({
      stage: 'hydrate',
      code: 'HYDRATION_APPLY_FAILED_RESTORED',
    });
    expect(await harness.snapshot.snapshot()).toEqual(before);
  });

  it('rollback failure remains a distinct severe coordinator outcome with original hydration context', async () => {
    const products = new FaultInjectingProductRepository();
    const harness = createHarness(products);
    await expectHydrated(await harness.hydration.hydrate(datasetA()));
    const emptyBytes = exportBusinessDatasetToXlsx(
      createEmptyBusinessDataset(),
      { exportedAt: '2026-09-16T09:05:00.000Z' },
      harness.codec,
    );

    products.failuresRemaining = 2;
    try {
      await harness.coordinator.importAndApplyWorkbook(emptyBytes);
      throw new Error('expected rollback failure');
    } catch (error) {
      expect(error).toBeInstanceOf(PersistenceLifecycleOperationalError);
      expect(error).toMatchObject({ stage: 'hydrate', code: 'HYDRATION_ROLLBACK_FAILED' });
      const hydrationError = (error as PersistenceLifecycleOperationalError).causeValue;
      expect(hydrationError).toMatchObject({ code: 'ROLLBACK_FAILED' });
      expect((hydrationError as { operationCause?: unknown }).operationCause).toBeDefined();
      expect((hydrationError as { rollbackCause?: unknown }).rollbackCause).toBeDefined();
    }
  });

  it('a valid empty workbook dataset clears every authoritative source collection', async () => {
    const harness = createHarness();
    await expectHydrated(await harness.hydration.hydrate(datasetA()));
    const emptyBytes = exportBusinessDatasetToXlsx(
      createEmptyBusinessDataset(),
      { exportedAt: '2026-09-16T09:10:00.000Z' },
      harness.codec,
    );

    const result = await harness.coordinator.importAndApplyWorkbook(emptyBytes);

    expect(result.status).toBe('hydrated');
    expect(await harness.snapshot.snapshot()).toEqual(createEmptyBusinessDataset());
  });

  it('preserves missing-vs-zero/null evidence and true optional source-field absence', async () => {
    const harness = createHarness();
    const bytes = exportBusinessDatasetToXlsx(
      datasetA(),
      { exportedAt: '2026-09-16T09:15:00.000Z' },
      harness.codec,
    );

    const result = await harness.coordinator.importAndApplyWorkbook(bytes);
    expect(result.status).toBe('hydrated');
    const restored = await harness.snapshot.snapshot();

    expect(restored.productStocks).toEqual([{ productId: 'product-a', onHandQuantity: 0 }]);
    expect(restored.productStocks.some((stock) => stock.productId === 'product-b')).toBe(false);
    expect(restored.productFinancialProfiles).toEqual([
      {
        productId: 'product-a',
        laborCostPerUnit: 0,
        overheadCostPerUnit: 0,
        pricingPolicy: null,
      },
    ]);
    expect(Object.prototype.hasOwnProperty.call(restored.materials[0], 'source')).toBe(false);
    expect(restored.materials[1].source).toEqual({
      vendorName: 'Supplier B',
      notes: 'authoritative source evidence',
    });
  });

  it('caller-owned workbook bytes cannot alter live state after import completion', async () => {
    const harness = createHarness();
    const bytes = exportBusinessDatasetToXlsx(
      datasetA(),
      { exportedAt: '2026-09-16T09:20:00.000Z' },
      harness.codec,
    );

    const result = await harness.coordinator.importAndApplyWorkbook(bytes);
    expect(result.status).toBe('hydrated');
    const restored = await harness.snapshot.snapshot();

    bytes.fill(0);
    expect(await harness.snapshot.snapshot()).toEqual(restored);
  });

  it('persists only the canonical source workbook sheets and no derived calculation outputs', async () => {
    const harness = createHarness();
    await expectHydrated(await harness.hydration.hydrate(datasetA()));

    const exported = await harness.coordinator.exportCurrentWorkbook();
    const document = harness.codec.decode(exported.bytes);

    expect(document.sheets.map((sheet) => sheet.name)).toEqual(CANONICAL_WORKBOOK_SHEET_NAMES);
    expect(document.sheets.map((sheet) => sheet.name)).not.toEqual(
      expect.arrayContaining(['Costing', 'Capacity', 'Pricing', 'Profit', 'DerivedResults']),
    );
  });
});
