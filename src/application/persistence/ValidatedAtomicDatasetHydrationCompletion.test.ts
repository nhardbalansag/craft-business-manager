import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createEmptyBusinessDataset,
  CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
} from '../../domain/businessDataset';
import type { BusinessDataset } from '../../domain/types';
import { InMemoryCalibrationRepository } from '../calibrations/InMemoryCalibrationRepository';
import { InMemoryMaterialRepository } from '../materials/InMemoryMaterialRepository';
import { MaterialService } from '../materials/MaterialService';
import { InMemoryMixPresetRepository } from '../mixPresets/InMemoryMixPresetRepository';
import { InMemoryProductComponentRepository } from '../productComponents/InMemoryProductComponentRepository';
import { InMemoryProductFinancialProfileRepository } from '../productFinancialProfiles/InMemoryProductFinancialProfileRepository';
import { InMemoryProductRepository } from '../products/InMemoryProductRepository';
import { InMemoryProductStockRepository } from '../productStocks/InMemoryProductStockRepository';
import { InMemoryFixedRecipeItemRepository } from '../recipeItems/InMemoryFixedRecipeItemRepository';
import { validatedAtomicDatasetHydrationService as sharedHydrationService } from '../session';
import { InMemoryYieldSampleRepository } from '../yieldSamples/InMemoryYieldSampleRepository';
import { CompleteSourceSnapshotService } from './CompleteSourceSnapshotService';
import {
  DatasetHydrationError,
  ValidatedAtomicDatasetHydrationService,
} from './ValidatedAtomicDatasetHydrationService';

function makeDataset(prefix: string): BusinessDataset {
  const materialPlasterId = `${prefix}-mat-plaster`;
  const materialVesselId = `${prefix}-mat-vessel`;
  const mixId = `${prefix}-mix-plaster`;
  const candleId = `${prefix}-prod-candle`;
  const potId = `${prefix}-prod-pot`;

  return {
    schemaVersion: CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
    materials: [
      {
        id: materialPlasterId,
        name: `${prefix} Plaster`,
        group: 'plaster',
        baseUnit: 'g',
        purchaseQuantity: 1000,
        purchaseUnit: 'g',
        packageCost: 66,
        onHandQuantity: 750,
        onHandUnit: 'g',
        isActive: true,
      },
      {
        id: materialVesselId,
        name: `${prefix} Glass vessel`,
        group: 'container',
        baseUnit: 'pc',
        purchaseQuantity: 12,
        purchaseUnit: 'pc',
        packageCost: 120,
        onHandQuantity: 8,
        onHandUnit: 'pc',
        source: {
          vendorName: `${prefix} Vendor`,
          notes: 'Nested source evidence',
        },
        isActive: true,
      },
    ],
    materialCalibrations: [
      {
        id: `${prefix}-cal-plaster-1`,
        materialId: materialPlasterId,
        measuredVolume: 5,
        volumeUnit: 'cup',
        knownWeight: 1000,
        weightUnit: 'g',
        recordedAt: '2026-09-15T10:00:00.000Z',
      },
    ],
    mixPresets: [
      {
        id: mixId,
        name: `${prefix} Plaster mix`,
        compatibleCategories: ['candle-pot'],
        basis: 'weight',
        lines: [{ materialId: materialPlasterId, role: 'primary', parts: 1 }],
        isActive: true,
      },
    ],
    products: [
      {
        id: candleId,
        name: `${prefix} Event candle`,
        category: 'candle',
        safetyWasteRate: 0.03,
        isActive: true,
      },
      {
        id: potId,
        name: `${prefix} Candle pot`,
        category: 'candle-pot',
        mixPresetId: mixId,
        safetyWasteRate: 0.05,
        isActive: true,
      },
    ],
    yieldSamples: [
      {
        id: `${prefix}-yield-pot-1`,
        productId: potId,
        mixPresetId: mixId,
        materialInputs: [{ materialId: materialPlasterId, quantity: 500, unit: 'g' }],
        goodPieces: 5,
        rejectedPieces: 1,
        recordedAt: '2026-09-15T11:00:00.000Z',
      },
    ],
    recipeItems: [
      {
        id: `${prefix}-recipe-pot-finish`,
        productId: potId,
        materialId: materialPlasterId,
        quantityPerProduct: 5,
        unit: 'g',
        role: 'finish',
      },
    ],
    productComponents: [
      {
        id: `${prefix}-component-candle-pot`,
        parentProductId: candleId,
        sourceType: 'product',
        sourceId: potId,
        role: 'vessel',
        quantityPerParent: 1,
      },
      {
        id: `${prefix}-component-pot-vessel`,
        parentProductId: potId,
        sourceType: 'material',
        sourceId: materialVesselId,
        role: 'vessel',
        quantityPerParent: 1,
      },
    ],
    productStocks: [
      {
        productId: potId,
        onHandQuantity: 0,
      },
    ],
    productFinancialProfiles: [
      {
        productId: candleId,
        laborCostPerUnit: 0,
        overheadCostPerUnit: 0,
        pricingPolicy: null,
      },
    ],
  };
}

function makeRepositories(seed: BusinessDataset) {
  return {
    materials: new InMemoryMaterialRepository(seed.materials),
    calibrations: new InMemoryCalibrationRepository(seed.materialCalibrations),
    mixPresets: new InMemoryMixPresetRepository(seed.mixPresets),
    products: new InMemoryProductRepository(seed.products),
    yieldSamples: new InMemoryYieldSampleRepository(seed.yieldSamples),
    recipeItems: new InMemoryFixedRecipeItemRepository(seed.recipeItems),
    productComponents: new InMemoryProductComponentRepository(seed.productComponents),
    productStocks: new InMemoryProductStockRepository(seed.productStocks),
    productFinancialProfiles: new InMemoryProductFinancialProfileRepository(
      seed.productFinancialProfiles,
    ),
  };
}

type Repositories = ReturnType<typeof makeRepositories>;

function makeHarness(seed = makeDataset('old')) {
  const repositories = makeRepositories(seed);
  const snapshotService = new CompleteSourceSnapshotService(repositories);
  const hydrationService = new ValidatedAtomicDatasetHydrationService(
    repositories,
    snapshotService,
  );

  return { repositories, snapshotService, hydrationService };
}

function replacementSpies(repositories: Repositories) {
  return [
    vi.spyOn(repositories.materials, 'replaceAll'),
    vi.spyOn(repositories.calibrations, 'replaceAll'),
    vi.spyOn(repositories.mixPresets, 'replaceAll'),
    vi.spyOn(repositories.products, 'replaceAll'),
    vi.spyOn(repositories.yieldSamples, 'replaceAll'),
    vi.spyOn(repositories.recipeItems, 'replaceAll'),
    vi.spyOn(repositories.productComponents, 'replaceAll'),
    vi.spyOn(repositories.productStocks, 'replaceAll'),
    vi.spyOn(repositories.productFinancialProfiles, 'replaceAll'),
  ] as const;
}

const forwardFailureBoundaries: Array<{
  name: string;
  inject: (repositories: Repositories, failure: Error) => void;
}> = [
  {
    name: 'materials',
    inject: (repositories, failure) => {
      vi.spyOn(repositories.materials, 'replaceAll').mockRejectedValueOnce(failure);
    },
  },
  {
    name: 'material calibrations',
    inject: (repositories, failure) => {
      vi.spyOn(repositories.calibrations, 'replaceAll').mockRejectedValueOnce(failure);
    },
  },
  {
    name: 'mix presets',
    inject: (repositories, failure) => {
      vi.spyOn(repositories.mixPresets, 'replaceAll').mockRejectedValueOnce(failure);
    },
  },
  {
    name: 'products',
    inject: (repositories, failure) => {
      vi.spyOn(repositories.products, 'replaceAll').mockRejectedValueOnce(failure);
    },
  },
  {
    name: 'yield samples',
    inject: (repositories, failure) => {
      vi.spyOn(repositories.yieldSamples, 'replaceAll').mockRejectedValueOnce(failure);
    },
  },
  {
    name: 'recipe items',
    inject: (repositories, failure) => {
      vi.spyOn(repositories.recipeItems, 'replaceAll').mockRejectedValueOnce(failure);
    },
  },
  {
    name: 'product components',
    inject: (repositories, failure) => {
      vi.spyOn(repositories.productComponents, 'replaceAll').mockRejectedValueOnce(failure);
    },
  },
  {
    name: 'product stocks',
    inject: (repositories, failure) => {
      vi.spyOn(repositories.productStocks, 'replaceAll').mockRejectedValueOnce(failure);
    },
  },
  {
    name: 'product financial profiles',
    inject: (repositories, failure) => {
      vi.spyOn(repositories.productFinancialProfiles, 'replaceAll').mockRejectedValueOnce(failure);
    },
  },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Phase 5.3B3 hydration completion gate', () => {
  it('exposes one validated atomic hydration boundary from the shared application session', () => {
    expect(sharedHydrationService).toBeInstanceOf(ValidatedAtomicDatasetHydrationService);
  });

  it('rejects invalid data with zero writes and leaves the exact live snapshot unchanged', async () => {
    const previous = makeDataset('old');
    const { repositories, snapshotService, hydrationService } = makeHarness(previous);
    const before = await snapshotService.snapshot();
    const candidate = makeDataset('new');
    candidate.materials[0].packageCost = -1;
    const writes = replacementSpies(repositories);

    const result = await hydrationService.hydrate(candidate);

    expect(result.status).toBe('rejected');
    for (const write of writes) expect(write).not.toHaveBeenCalled();
    expect(await snapshotService.snapshot()).toEqual(before);
  });

  it('surfaces snapshot failure before mutation with zero replacement calls', async () => {
    const { repositories, snapshotService, hydrationService } = makeHarness();
    const writes = replacementSpies(repositories);
    const failure = new Error('snapshot injection failure');
    vi.spyOn(snapshotService, 'snapshot').mockRejectedValueOnce(failure);

    await expect(hydrationService.hydrate(makeDataset('new'))).rejects.toMatchObject({
      name: 'DatasetHydrationError',
      code: 'SNAPSHOT_FAILED',
      operationCause: failure,
    });
    for (const write of writes) expect(write).not.toHaveBeenCalled();
  });

  for (const boundary of forwardFailureBoundaries) {
    it(`restores the exact pre-hydration snapshot after a ${boundary.name} apply failure`, async () => {
      const previous = makeDataset('old');
      const { repositories, snapshotService, hydrationService } = makeHarness(previous);
      const before = await snapshotService.snapshot();
      const failure = new Error(`${boundary.name} forward failure`);
      boundary.inject(repositories, failure);

      await expect(hydrationService.hydrate(makeDataset('new'))).rejects.toMatchObject({
        name: 'DatasetHydrationError',
        code: 'APPLY_FAILED_RESTORED',
        operationCause: failure,
      });

      expect(await snapshotService.snapshot()).toEqual(before);
    });
  }

  it('surfaces rollback failure distinctly and retains both apply and rollback causes', async () => {
    const { repositories, hydrationService } = makeHarness();
    const applyFailure = new Error('products forward failure');
    const rollbackFailure = new Error('materials rollback failure');
    const originalMaterialReplaceAll = repositories.materials.replaceAll.bind(
      repositories.materials,
    );

    vi.spyOn(repositories.materials, 'replaceAll')
      .mockImplementationOnce((records) => originalMaterialReplaceAll(records))
      .mockRejectedValueOnce(rollbackFailure);
    vi.spyOn(repositories.products, 'replaceAll').mockRejectedValueOnce(applyFailure);

    let error: unknown;
    try {
      await hydrationService.hydrate(makeDataset('new'));
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(DatasetHydrationError);
    expect(error).toMatchObject({
      code: 'ROLLBACK_FAILED',
      operationCause: applyFailure,
      rollbackCause: rollbackFailure,
    });
  });

  it('fully replaces populated state across all nine repositories and removes stale rows', async () => {
    const previous = makeDataset('old');
    const candidate = makeDataset('new');
    const { repositories, snapshotService, hydrationService } = makeHarness(previous);

    await expect(hydrationService.hydrate(candidate)).resolves.toEqual({ status: 'hydrated' });

    expect(await snapshotService.snapshot()).toEqual(candidate);
    expect(await repositories.materials.findById(previous.materials[0].id)).toBeNull();
    expect(await repositories.products.findById(previous.products[0].id)).toBeNull();
  });

  it('hydrates a valid empty dataset by clearing all nine live repositories', async () => {
    const { snapshotService, hydrationService } = makeHarness();
    const empty = createEmptyBusinessDataset();

    await expect(hydrationService.hydrate(empty)).resolves.toEqual({ status: 'hydrated' });

    expect(await snapshotService.snapshot()).toEqual(empty);
  });

  it('preserves missing evidence separately from explicit zero and null evidence', async () => {
    const candidate = makeDataset('new');
    const { snapshotService, hydrationService } = makeHarness();

    await hydrationService.hydrate(candidate);
    const hydrated = await snapshotService.snapshot();
    const candleId = 'new-prod-candle';
    const potId = 'new-prod-pot';

    expect(hydrated.productStocks).toEqual([{ productId: potId, onHandQuantity: 0 }]);
    expect(hydrated.productStocks.some((stock) => stock.productId === candleId)).toBe(false);

    expect(hydrated.productFinancialProfiles).toEqual([
      {
        productId: candleId,
        laborCostPerUnit: 0,
        overheadCostPerUnit: 0,
        pricingPolicy: null,
      },
    ]);
    expect(
      hydrated.productFinancialProfiles.some((profile) => profile.productId === potId),
    ).toBe(false);

    const plaster = hydrated.materials.find((material) => material.id === 'new-mat-plaster');
    expect(plaster).toBeDefined();
    expect(plaster).not.toHaveProperty('source');
  });

  it('keeps hydrated state isolated from candidate mutation and repository list-result mutation', async () => {
    const candidate = makeDataset('new');
    const { repositories, snapshotService, hydrationService } = makeHarness();

    await hydrationService.hydrate(candidate);
    const expected = await snapshotService.snapshot();

    candidate.materials[1].source!.vendorName = 'Caller changed vendor';
    candidate.mixPresets[0].compatibleCategories.push('candle');
    candidate.mixPresets[0].lines[0].parts = 999;
    candidate.yieldSamples[0].materialInputs[0].quantity = 999;

    expect(await snapshotService.snapshot()).toEqual(expected);

    const listedMixPresets = await repositories.mixPresets.list();
    listedMixPresets[0].compatibleCategories.push('paintable-art');
    listedMixPresets[0].lines[0].parts = 777;

    expect(await snapshotService.snapshot()).toEqual(expected);
  });

  it('lets an already-constructed application service observe hydrated state without rebuilding', async () => {
    const previous = makeDataset('old');
    const candidate = makeDataset('new');
    const { repositories, hydrationService } = makeHarness(previous);
    const preExistingMaterialService = new MaterialService(repositories.materials);

    expect(await preExistingMaterialService.getMaterial('old-mat-plaster')).not.toBeNull();

    await hydrationService.hydrate(candidate);

    expect(await preExistingMaterialService.getMaterial('old-mat-plaster')).toBeNull();
    expect(await preExistingMaterialService.getMaterial('new-mat-plaster')).toEqual(
      candidate.materials[0],
    );
  });
});
