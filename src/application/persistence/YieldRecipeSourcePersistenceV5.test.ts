import { describe, expect, it, vi } from 'vitest';
import { createEmptyBusinessDatasetV2 } from '../../domain/businessDatasetV2';
import { extendBusinessDatasetV2 } from '../../domain/physicalBusinessDatasetV3';
import { extendPhysicalBusinessDatasetV3 } from '../../domain/physicalBusinessDatasetV4';
import {
  extendPhysicalBusinessDatasetV4,
  type PhysicalBusinessDatasetV5,
} from '../../domain/physicalBusinessDatasetV5';
import type { YieldMoldFormulaSource } from '../../domain/yieldMoldFormulaSource';
import { exportPhysicalBusinessDatasetV4ToXlsx } from '../../storage/physicalBusinessDatasetV4Workbook';
import {
  PHYSICAL_WORKBOOK_V5_CANONICAL_SHEET_NAMES,
} from '../../storage/physicalBusinessDatasetV5Workbook';
import { SheetJsWorkbookCodec } from '../../storage/sheetJsWorkbookCodec';
import { InMemoryCalibrationRepository } from '../calibrations/InMemoryCalibrationRepository';
import { InMemoryMaterialRepository } from '../materials/InMemoryMaterialRepository';
import { InMemoryMixPresetRepository } from '../mixPresets/InMemoryMixPresetRepository';
import { InMemoryMoldRepository } from '../molds/InMemoryMoldRepository';
import { InMemoryPlasterMoldYieldProfileRepository } from '../plasterMoldYieldProfiles/InMemoryPlasterMoldYieldProfileRepository';
import { InMemoryProductComponentRepository } from '../productComponents/InMemoryProductComponentRepository';
import { InMemoryProductFinancialProfileRepository } from '../productFinancialProfiles/InMemoryProductFinancialProfileRepository';
import { InMemoryProductPriceTierRepository } from '../productPriceTiers/InMemoryProductPriceTierRepository';
import { InMemoryProductRepository } from '../products/InMemoryProductRepository';
import { InMemoryProductStockRepository } from '../productStocks/InMemoryProductStockRepository';
import { InMemoryFixedRecipeItemRepository } from '../recipeItems/InMemoryFixedRecipeItemRepository';
import { InMemoryStorageLocationRepository } from '../storageLocations/InMemoryStorageLocationRepository';
import { InMemoryYieldMoldFormulaSourceRepository } from '../yieldMoldFormulaSources/InMemoryYieldMoldFormulaSourceRepository';
import { InMemoryYieldSampleRepository } from '../yieldSamples/InMemoryYieldSampleRepository';
import { CompleteSourceSnapshotService } from './CompleteSourceSnapshotService';
import { CompleteSourceSnapshotServiceV2 } from './CompleteSourceSnapshotServiceV2';
import { PersistenceCoordinator } from './PersistenceCoordinator';
import { PhysicalDatasetHydrationServiceV3 } from './PhysicalDatasetHydrationServiceV3';
import { PhysicalDatasetHydrationServiceV4 } from './PhysicalDatasetHydrationServiceV4';
import { PhysicalDatasetHydrationServiceV5 } from './PhysicalDatasetHydrationServiceV5';
import { PhysicalSourceSnapshotServiceV3 } from './PhysicalSourceSnapshotServiceV3';
import { PhysicalSourceSnapshotServiceV4 } from './PhysicalSourceSnapshotServiceV4';
import { PhysicalSourceSnapshotServiceV5 } from './PhysicalSourceSnapshotServiceV5';
import {
  PublicGoogleSheetsImportCommand,
  type PublicGoogleSheetsFetch,
} from './PublicGoogleSheetsImportCommand';
import {
  DatasetHydrationError,
  ValidatedAtomicDatasetHydrationService,
} from './ValidatedAtomicDatasetHydrationService';
import { ValidatedAtomicDatasetHydrationServiceV2 } from './ValidatedAtomicDatasetHydrationServiceV2';

const codec = new SheetJsWorkbookCodec();

class FaultInjectingYieldMoldFormulaSourceRepository extends InMemoryYieldMoldFormulaSourceRepository {
  failuresRemaining = 0;

  override async replaceAll(
    records: readonly YieldMoldFormulaSource[],
  ): Promise<void> {
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      throw new Error('synthetic provenance replacement failure');
    }
    await super.replaceAll(records);
  }
}

function emptyV5(): PhysicalBusinessDatasetV5 {
  return extendPhysicalBusinessDatasetV4(
    extendPhysicalBusinessDatasetV3(
      extendBusinessDatasetV2(createEmptyBusinessDatasetV2()),
    ),
  );
}

function candidate(options: {
  piecesPerPour?: number;
  recordedAt?: string;
} = {}): PhysicalBusinessDatasetV5 {
  const core = createEmptyBusinessDatasetV2();

  core.materials.push(
    {
      id: 'WATER',
      name: 'Water',
      group: 'liquid',
      baseUnit: 'g',
      purchaseQuantity: 1000,
      purchaseUnit: 'g',
      packageCost: 10,
      onHandQuantity: 1000,
      onHandUnit: 'g',
      isActive: true,
    },
    {
      id: 'PLASTER',
      name: 'Plaster',
      group: 'plaster',
      baseUnit: 'g',
      purchaseQuantity: 1000,
      purchaseUnit: 'g',
      packageCost: 100,
      onHandQuantity: 1000,
      onHandUnit: 'g',
      isActive: true,
    },
    {
      id: 'GLUE',
      name: 'Glue',
      group: 'other',
      baseUnit: 'g',
      purchaseQuantity: 1000,
      purchaseUnit: 'g',
      packageCost: 50,
      onHandQuantity: 1000,
      onHandUnit: 'g',
      isActive: true,
    },
  );

  core.products.push({
    id: 'PROD-001',
    name: 'Paintable Dino',
    category: 'paintable-art',
    safetyWasteRate: 0.05,
    isActive: true,
  });

  core.yieldSamples.push({
    id: 'YLD-001',
    productId: 'PROD-001',
    materialInputs: [
      {
        materialId: 'PLASTER',
        quantity: 100,
        unit: 'g',
      },
    ],
    goodPieces: 4,
    rejectedPieces: 0,
    recordedAt: options.recordedAt ?? '2026-09-29T12:00:00.000Z',
  });

  const v3 = extendBusinessDatasetV2(
    core,
    [],
    [
      {
        id: 'MOLD-001',
        productId: 'PROD-001',
        name: 'Dino Mold',
        isActive: true,
      },
    ],
  );

  const v4 = extendPhysicalBusinessDatasetV3(v3, [
    {
      id: 'PMYP-001',
      moldId: 'MOLD-001',
      waterMaterialId: 'WATER',
      plasterMaterialId: 'PLASTER',
      glueMaterialId: 'GLUE',
      waterFillWeightGrams: 50,
      waterAdjustmentRate: 0.3,
      plasterFactor: 0.75,
      glueFactor: 0.05,
      piecesPerPour: options.piecesPerPour ?? 4,
      notes: 'YRS2E test profile',
      isActive: true,
    },
  ]);

  return extendPhysicalBusinessDatasetV4(v4, [
    {
      yieldSampleId: 'YLD-001',
      moldId: 'MOLD-001',
      moldYieldProfileId: 'PMYP-001',
    },
  ]);
}

function createHarness(
  sources: FaultInjectingYieldMoldFormulaSourceRepository =
    new FaultInjectingYieldMoldFormulaSourceRepository(),
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
  const productPriceTiers = new InMemoryProductPriceTierRepository();
  const storageLocations = new InMemoryStorageLocationRepository();
  const molds = new InMemoryMoldRepository();
  const profiles = new InMemoryPlasterMoldYieldProfileRepository();

  const snapshotV1 = new CompleteSourceSnapshotService({
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
  const hydrateV1 = new ValidatedAtomicDatasetHydrationService(
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
    },
    snapshotV1,
  );
  const snapshotV2 = new CompleteSourceSnapshotServiceV2(
    snapshotV1,
    productPriceTiers,
  );
  const hydrateV2 = new ValidatedAtomicDatasetHydrationServiceV2(
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
  const hydrateV3 = new PhysicalDatasetHydrationServiceV3(
    hydrateV2,
    snapshotV3,
    storageLocations,
    molds,
  );
  const snapshotV4 = new PhysicalSourceSnapshotServiceV4(
    snapshotV3,
    profiles,
  );
  const hydrateV4 = new PhysicalDatasetHydrationServiceV4(
    hydrateV3,
    snapshotV4,
    profiles,
  );
  const snapshotV5 = new PhysicalSourceSnapshotServiceV5(
    snapshotV4,
    sources,
  );
  const hydrateV5 = new PhysicalDatasetHydrationServiceV5(
    hydrateV4,
    snapshotV5,
    sources,
  );
  const coordinator = new PersistenceCoordinator(
    snapshotV5,
    hydrateV5,
    codec,
    {
      clock: () => new Date('2026-09-29T12:30:00.000Z'),
      applicationVersion: 'yrs2e',
    },
  );

  return {
    sources,
    profiles,
    snapshotV5,
    hydrateV5,
    coordinator,
  };
}

function exactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

describe('YRS2E physical v5 runtime persistence', () => {
  it('hydrates and snapshots Mold Formula provenance atomically with physical v4 state', async () => {
    const harness = createHarness();
    const source = candidate();

    expect(await harness.hydrateV5.hydrate(source)).toEqual({
      status: 'hydrated',
    });

    const snapshot = await harness.snapshotV5.snapshot();
    expect(snapshot).toEqual(source);
    expect(snapshot.schemaVersion).toBe(5);
    expect(snapshot.yieldMoldFormulaSources).toEqual([
      {
        yieldSampleId: 'YLD-001',
        moldId: 'MOLD-001',
        moldYieldProfileId: 'PMYP-001',
      },
    ]);
  });

  it('rejects invalid provenance before mutating live repositories', async () => {
    const harness = createHarness();
    const source = candidate();

    expect(await harness.hydrateV5.hydrate(source)).toEqual({
      status: 'hydrated',
    });
    const before = await harness.snapshotV5.snapshot();

    const bad = structuredClone(source);
    bad.yieldMoldFormulaSources[0].moldId = 'MOLD-MISSING';

    const result = await harness.hydrateV5.hydrate(bad);
    expect(result.status).toBe('rejected');
    expect(await harness.snapshotV5.snapshot()).toEqual(before);
  });

  it('restores the complete previous v5 graph when provenance replacement fails after v4 writes', async () => {
    const sources = new FaultInjectingYieldMoldFormulaSourceRepository();
    const harness = createHarness(sources);
    const previous = candidate({ piecesPerPour: 4 });
    const next = candidate({
      piecesPerPour: 8,
      recordedAt: '2026-09-29T12:15:00.000Z',
    });

    expect(await harness.hydrateV5.hydrate(previous)).toEqual({
      status: 'hydrated',
    });
    const before = await harness.snapshotV5.snapshot();

    sources.failuresRemaining = 1;

    await expect(harness.hydrateV5.hydrate(next)).rejects.toMatchObject({
      code: 'APPLY_FAILED_RESTORED',
    } satisfies Partial<DatasetHydrationError>);

    expect(await harness.snapshotV5.snapshot()).toEqual(before);
  });

  it('exports and restores physical workbook v5 through the live coordinator', async () => {
    const harness = createHarness();
    const source = candidate();

    expect(await harness.hydrateV5.hydrate(source)).toEqual({
      status: 'hydrated',
    });

    const exported = await harness.coordinator.exportCurrentWorkbook();
    const document = codec.decode(exported.bytes);

    expect(document.sheets.map((sheet) => sheet.name)).toEqual(
      PHYSICAL_WORKBOOK_V5_CANONICAL_SHEET_NAMES,
    );
    expect(
      document.sheets.find((sheet) => sheet.name === '_Meta')?.rows[0],
    ).toMatchObject({
      workbookFormatVersion: 5,
      datasetSchemaVersion: 5,
    });

    expect(await harness.hydrateV5.hydrate(emptyV5())).toEqual({
      status: 'hydrated',
    });

    const restored = await harness.coordinator.importAndApplyWorkbook(
      exported.bytes,
    );

    expect(restored).toMatchObject({
      status: 'hydrated',
      metadata: {
        workbookFormatVersion: 5,
        datasetSchemaVersion: 5,
      },
    });
    expect(await harness.snapshotV5.snapshot()).toEqual(source);
  });

  it('migrates a physical-v4 workbook through the live v5 coordinator and clears stale provenance', async () => {
    const harness = createHarness();
    const source = candidate();

    expect(await harness.hydrateV5.hydrate(source)).toEqual({
      status: 'hydrated',
    });
    expect((await harness.snapshotV5.snapshot()).yieldMoldFormulaSources).toHaveLength(1);

    const v4Bytes = exportPhysicalBusinessDatasetV4ToXlsx(
      {
        ...source,
        schemaVersion: 4,
      },
      {
        exportedAt: '2026-09-29T12:20:00.000Z',
        applicationVersion: 'yrs2e-v4-compat',
      },
      codec,
    );

    const result = await harness.coordinator.importAndApplyWorkbook(v4Bytes);

    expect(result).toMatchObject({
      status: 'hydrated',
      metadata: {
        workbookFormatVersion: 5,
        datasetSchemaVersion: 5,
      },
    });

    const migrated = await harness.snapshotV5.snapshot();
    expect(migrated.yieldMoldFormulaSources).toEqual([]);
    expect(migrated.plasterMoldYieldProfiles).toEqual(
      source.plasterMoldYieldProfiles,
    );
    expect(migrated.molds).toEqual(source.molds);
  });

  it('imports a published Google Sheets physical-v5 snapshot through the same coordinator and preserves provenance', async () => {
    const harness = createHarness();
    const source = candidate();

    expect(await harness.hydrateV5.hydrate(source)).toEqual({
      status: 'hydrated',
    });
    const exported = await harness.coordinator.exportCurrentWorkbook();

    expect(await harness.hydrateV5.hydrate(emptyV5())).toEqual({
      status: 'hydrated',
    });

    const publishedId = '2PACX-1vYRS2EPhysicalV5Snapshot123456789';
    const publishedUrl =
      `https://docs.google.com/spreadsheets/d/e/${publishedId}/pubhtml`;
    const expectedExportUrl =
      `https://docs.google.com/spreadsheets/d/e/${publishedId}/pub?output=xlsx`;

    const fetchPublishedSheet = vi.fn<PublicGoogleSheetsFetch>(
      async (url) => ({
        ok: true,
        status: 200,
        async arrayBuffer() {
          expect(url).toBe(expectedExportUrl);
          return exactArrayBuffer(exported.bytes);
        },
      }),
    );

    const command = new PublicGoogleSheetsImportCommand(
      harness.coordinator,
      fetchPublishedSheet,
    );

    await command.loadPublishedSheet(publishedUrl);
    const result = await command.applyPendingSelection();

    expect(fetchPublishedSheet).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      status: 'hydrated',
      metadata: {
        workbookFormatVersion: 5,
        datasetSchemaVersion: 5,
      },
    });
    expect(await harness.snapshotV5.snapshot()).toEqual(source);
  });
});
