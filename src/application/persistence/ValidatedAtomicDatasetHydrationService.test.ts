import { describe, expect, it, vi } from 'vitest';
import { createEmptyBusinessDataset } from '../../domain/businessDataset';
import type { BusinessDataset } from '../../domain/types';
import { InMemoryCalibrationRepository } from '../calibrations/InMemoryCalibrationRepository';
import { InMemoryMaterialRepository } from '../materials/InMemoryMaterialRepository';
import { InMemoryMixPresetRepository } from '../mixPresets/InMemoryMixPresetRepository';
import { InMemoryProductComponentRepository } from '../productComponents/InMemoryProductComponentRepository';
import { InMemoryProductFinancialProfileRepository } from '../productFinancialProfiles/InMemoryProductFinancialProfileRepository';
import { InMemoryProductRepository } from '../products/InMemoryProductRepository';
import { InMemoryProductStockRepository } from '../productStocks/InMemoryProductStockRepository';
import { InMemoryFixedRecipeItemRepository } from '../recipeItems/InMemoryFixedRecipeItemRepository';
import { InMemoryYieldSampleRepository } from '../yieldSamples/InMemoryYieldSampleRepository';
import { CompleteSourceSnapshotService } from './CompleteSourceSnapshotService';
import {
  DatasetHydrationError,
  ValidatedAtomicDatasetHydrationService,
} from './ValidatedAtomicDatasetHydrationService';

function makeMaterial(
  id: string,
  name: string,
): BusinessDataset['materials'][number] {
  return {
    id,
    name,
    group: 'plaster',
    baseUnit: 'g',
    purchaseQuantity: 1000,
    purchaseUnit: 'g',
    packageCost: 66,
    onHandQuantity: 0,
    onHandUnit: 'g',
    isActive: true,
  };
}

function makeDataset(materialId = 'mat-new'): BusinessDataset {
  const dataset = createEmptyBusinessDataset();
  dataset.materials = [makeMaterial(materialId, `Material ${materialId}`)];
  return dataset;
}

function makeHarness(seedMaterials: BusinessDataset['materials'] = []) {
  const repositories = {
    materials: new InMemoryMaterialRepository(seedMaterials),
    calibrations: new InMemoryCalibrationRepository(),
    mixPresets: new InMemoryMixPresetRepository(),
    products: new InMemoryProductRepository(),
    yieldSamples: new InMemoryYieldSampleRepository(),
    recipeItems: new InMemoryFixedRecipeItemRepository(),
    productComponents: new InMemoryProductComponentRepository(),
    productStocks: new InMemoryProductStockRepository(),
    productFinancialProfiles: new InMemoryProductFinancialProfileRepository(),
  };

  const snapshotService = new CompleteSourceSnapshotService(repositories);
  const hydrationService = new ValidatedAtomicDatasetHydrationService(
    repositories,
    snapshotService,
  );

  return { repositories, snapshotService, hydrationService };
}

function replacementSpies(repositories: ReturnType<typeof makeHarness>['repositories']) {
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

describe('ValidatedAtomicDatasetHydrationService', () => {
  it('rejects an invalid candidate before snapshotting or writing live repositories', async () => {
    const { repositories, snapshotService, hydrationService } = makeHarness([
      makeMaterial('mat-old', 'Old material'),
    ]);
    const candidate = makeDataset();
    candidate.materials[0].packageCost = -1;

    const snapshotSpy = vi.spyOn(snapshotService, 'snapshot');
    const writeSpies = replacementSpies(repositories);

    const result = await hydrationService.hydrate(candidate);

    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'INVALID_RECORD',
            path: 'materials[0].packageCost',
          }),
        ]),
      );
    }
    expect(snapshotSpy).not.toHaveBeenCalled();
    for (const writeSpy of writeSpies) expect(writeSpy).not.toHaveBeenCalled();
    expect(await repositories.materials.list()).toEqual([
      makeMaterial('mat-old', 'Old material'),
    ]);
  });

  it('hydrates one valid complete dataset through all nine repositories in dependency order', async () => {
    const { repositories, snapshotService, hydrationService } = makeHarness([
      makeMaterial('mat-old', 'Old material'),
    ]);
    const candidate = makeDataset();
    const writeSpies = replacementSpies(repositories);

    await expect(hydrationService.hydrate(candidate)).resolves.toEqual({ status: 'hydrated' });

    for (const writeSpy of writeSpies) expect(writeSpy).toHaveBeenCalledTimes(1);
    const callOrders = writeSpies.map((spy) => spy.mock.invocationCallOrder[0]);
    expect(callOrders).toEqual([...callOrders].sort((left, right) => left - right));
    expect(await snapshotService.snapshot()).toEqual(candidate);
    expect(await repositories.materials.findById('mat-old')).toBeNull();
  });

  it('fails before writes when the pre-hydration snapshot cannot be captured', async () => {
    const { repositories, snapshotService, hydrationService } = makeHarness();
    const writeSpies = replacementSpies(repositories);
    const snapshotFailure = new Error('snapshot failed');
    vi.spyOn(snapshotService, 'snapshot').mockRejectedValueOnce(snapshotFailure);

    const promise = hydrationService.hydrate(makeDataset());

    await expect(promise).rejects.toMatchObject({
      name: 'DatasetHydrationError',
      code: 'SNAPSHOT_FAILED',
      operationCause: snapshotFailure,
    });
    for (const writeSpy of writeSpies) expect(writeSpy).not.toHaveBeenCalled();
  });

  it('restores the previous complete dataset when forward application fails', async () => {
    const previous = makeMaterial('mat-old', 'Old material');
    const { repositories, snapshotService, hydrationService } = makeHarness([previous]);
    const applyFailure = new Error('product replacement failed');
    vi.spyOn(repositories.products, 'replaceAll').mockRejectedValueOnce(applyFailure);

    let error: unknown;
    try {
      await hydrationService.hydrate(makeDataset());
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(DatasetHydrationError);
    expect(error).toMatchObject({
      code: 'APPLY_FAILED_RESTORED',
      operationCause: applyFailure,
    });
    expect(await snapshotService.snapshot()).toEqual({
      ...createEmptyBusinessDataset(),
      materials: [previous],
    });
  });

  it('reports rollback failure distinctly when live-state certainty cannot be restored', async () => {
    const previous = makeMaterial('mat-old', 'Old material');
    const { repositories, hydrationService } = makeHarness([previous]);
    const applyFailure = new Error('product replacement failed');
    const rollbackFailure = new Error('material rollback failed');

    const originalMaterialReplaceAll = repositories.materials.replaceAll.bind(
      repositories.materials,
    );
    vi.spyOn(repositories.materials, 'replaceAll')
      .mockImplementationOnce((records) => originalMaterialReplaceAll(records))
      .mockRejectedValueOnce(rollbackFailure);
    vi.spyOn(repositories.products, 'replaceAll').mockRejectedValueOnce(applyFailure);

    let error: unknown;
    try {
      await hydrationService.hydrate(makeDataset());
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
});
