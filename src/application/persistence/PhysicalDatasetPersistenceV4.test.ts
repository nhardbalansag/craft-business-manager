import { describe, expect, it } from 'vitest';
import { createEmptyBusinessDatasetV2 } from '../../domain/businessDatasetV2';
import { extendBusinessDatasetV2 } from '../../domain/physicalBusinessDatasetV3';
import { extendPhysicalBusinessDatasetV3 } from '../../domain/physicalBusinessDatasetV4';
import type { PlasterMoldYieldProfile } from '../../domain/plasterMoldYieldProfiles';
import { InMemoryMaterialRepository } from '../materials/InMemoryMaterialRepository';
import { InMemoryMoldRepository } from '../molds/InMemoryMoldRepository';
import { InMemoryPlasterMoldYieldProfileRepository } from '../plasterMoldYieldProfiles/InMemoryPlasterMoldYieldProfileRepository';
import { InMemoryStorageLocationRepository } from '../storageLocations/InMemoryStorageLocationRepository';
import { CompleteSourceSnapshotService } from './CompleteSourceSnapshotService';
import { CompleteSourceSnapshotServiceV2 } from './CompleteSourceSnapshotServiceV2';
import { PhysicalDatasetHydrationServiceV3 } from './PhysicalDatasetHydrationServiceV3';
import { PhysicalDatasetHydrationServiceV4 } from './PhysicalDatasetHydrationServiceV4';
import { PhysicalSourceSnapshotServiceV3 } from './PhysicalSourceSnapshotServiceV3';
import { PhysicalSourceSnapshotServiceV4 } from './PhysicalSourceSnapshotServiceV4';
import { ValidatedAtomicDatasetHydrationService } from './ValidatedAtomicDatasetHydrationService';
import { ValidatedAtomicDatasetHydrationServiceV2 } from './ValidatedAtomicDatasetHydrationServiceV2';
import { InMemoryCalibrationRepository } from '../calibrations/InMemoryCalibrationRepository';
import { InMemoryMixPresetRepository } from '../mixPresets/InMemoryMixPresetRepository';
import { InMemoryProductRepository } from '../products/InMemoryProductRepository';
import { InMemoryYieldSampleRepository } from '../yieldSamples/InMemoryYieldSampleRepository';
import { InMemoryFixedRecipeItemRepository } from '../recipeItems/InMemoryFixedRecipeItemRepository';
import { InMemoryProductComponentRepository } from '../productComponents/InMemoryProductComponentRepository';
import { InMemoryProductStockRepository } from '../productStocks/InMemoryProductStockRepository';
import { InMemoryProductFinancialProfileRepository } from '../productFinancialProfiles/InMemoryProductFinancialProfileRepository';
import { InMemoryProductPriceTierRepository } from '../productPriceTiers/InMemoryProductPriceTierRepository';

function createGraph() {
  const materials = new InMemoryMaterialRepository();
  const calibrations = new InMemoryCalibrationRepository();
  const mixPresets = new InMemoryMixPresetRepository();
  const products = new InMemoryProductRepository();
  const yieldSamples = new InMemoryYieldSampleRepository();
  const recipeItems = new InMemoryFixedRecipeItemRepository();
  const productComponents = new InMemoryProductComponentRepository();
  const productStocks = new InMemoryProductStockRepository();
  const productFinancialProfiles = new InMemoryProductFinancialProfileRepository();
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
  const snapshotV2 = new CompleteSourceSnapshotServiceV2(snapshotV1, productPriceTiers);
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
  const snapshotV4 = new PhysicalSourceSnapshotServiceV4(snapshotV3, profiles);
  const hydrateV4 = new PhysicalDatasetHydrationServiceV4(
    hydrateV3,
    snapshotV4,
    profiles,
  );

  return { snapshotV4, hydrateV4, profiles };
}

function candidate(profile: PlasterMoldYieldProfile) {
  const core = createEmptyBusinessDatasetV2();
  core.materials = [
    {
      id: 'WATER',
      name: 'Water',
      group: 'liquid',
      baseUnit: 'g',
      purchaseQuantity: 1,
      purchaseUnit: 'g',
      packageCost: 1,
      onHandQuantity: 1,
      onHandUnit: 'g',
      isActive: true,
    },
    {
      id: 'PLASTER',
      name: 'Plaster',
      group: 'plaster',
      baseUnit: 'g',
      purchaseQuantity: 1,
      purchaseUnit: 'g',
      packageCost: 1,
      onHandQuantity: 1,
      onHandUnit: 'g',
      isActive: true,
    },
    {
      id: 'GLUE',
      name: 'Glue',
      group: 'other',
      baseUnit: 'g',
      purchaseQuantity: 1,
      purchaseUnit: 'g',
      packageCost: 1,
      onHandQuantity: 1,
      onHandUnit: 'g',
      isActive: true,
    },
  ];
  core.products = [
    {
      id: 'PROD',
      name: 'Product',
      category: 'paintable-art',
      safetyWasteRate: 0,
      isActive: true,
    },
  ];

  return extendPhysicalBusinessDatasetV3(
    extendBusinessDatasetV2(core, [], [
      {
        id: 'MOLD',
        productId: 'PROD',
        name: 'Mold',
        isActive: true,
      },
    ]),
    [profile],
  );
}

describe('MY3 physical dataset v4 snapshot/hydration', () => {
  it('hydrates and snapshots profile sources atomically with physical v3 state', async () => {
    const { snapshotV4, hydrateV4 } = createGraph();
    const source = candidate({
      id: 'PMYP-1',
      moldId: 'MOLD',
      waterMaterialId: 'WATER',
      plasterMaterialId: 'PLASTER',
      glueMaterialId: 'GLUE',
      waterFillWeightGrams: 50,
      waterAdjustmentRate: 0.3,
      plasterFactor: 0.75,
      glueFactor: 0.05,
      piecesPerPour: 2,
      isActive: true,
    });

    expect(await hydrateV4.hydrate(source)).toEqual({ status: 'hydrated' });
    const snapshot = await snapshotV4.snapshot();
    expect(snapshot.schemaVersion).toBe(4);
    expect(snapshot.plasterMoldYieldProfiles).toEqual(
      source.plasterMoldYieldProfiles,
    );
    expect(snapshot.molds).toEqual(source.molds);
  });

  it('rejects invalid v4 before mutating live repositories', async () => {
    const { snapshotV4, hydrateV4 } = createGraph();
    const good = candidate({
      id: 'PMYP-GOOD',
      moldId: 'MOLD',
      waterMaterialId: 'WATER',
      plasterMaterialId: 'PLASTER',
      glueMaterialId: 'GLUE',
      waterFillWeightGrams: 50,
      waterAdjustmentRate: 0.3,
      plasterFactor: 0.75,
      glueFactor: 0.05,
      piecesPerPour: 1,
      isActive: true,
    });
    expect(await hydrateV4.hydrate(good)).toEqual({ status: 'hydrated' });
    const before = await snapshotV4.snapshot();

    const bad = structuredClone(good);
    bad.plasterMoldYieldProfiles[0].glueMaterialId = 'MISSING';

    const result = await hydrateV4.hydrate(bad);
    expect(result.status).toBe('rejected');
    expect(await snapshotV4.snapshot()).toEqual(before);
  });
});
