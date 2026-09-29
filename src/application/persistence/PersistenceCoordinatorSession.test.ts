import { afterEach, describe, expect, it } from 'vitest';
import { createEmptyBusinessDataset } from '../../domain/businessDataset';
import { createEmptyBusinessDatasetV2 } from '../../domain/businessDatasetV2';
import { extendBusinessDatasetV2 } from '../../domain/physicalBusinessDatasetV3';
import { extendPhysicalBusinessDatasetV3 } from '../../domain/physicalBusinessDatasetV4';
import {
  persistenceCoordinator,
  physicalDatasetHydrationServiceV3,
  physicalDatasetHydrationServiceV4,
  plasterMoldYieldProfileService,
  productPriceTierService,
  productStockService,
  validatedAtomicDatasetHydrationService,
} from '../session';
import { PersistenceCoordinator } from './PersistenceCoordinator';

afterEach(async () => {
  const result = await physicalDatasetHydrationServiceV4.hydrate(
    extendPhysicalBusinessDatasetV3(
      extendBusinessDatasetV2(createEmptyBusinessDatasetV2()),
    ),
  );
  if (result.status !== 'hydrated') {
    throw new Error('profile-aware session cleanup hydration was rejected');
  }
});

describe('Phase 5.3C3 shared session coordinator', () => {
  it('exposes one concrete PersistenceCoordinator from the application session', () => {
    expect(persistenceCoordinator).toBeInstanceOf(PersistenceCoordinator);
  });

  it('restores shared repositories so already-wired session services observe loaded state', async () => {
    const dataset = createEmptyBusinessDataset();
    dataset.products.push({
      id: 'session-product',
      name: 'Session Product',
      category: 'paintable-art',
      safetyWasteRate: 0,
      isActive: true,
    });
    dataset.productStocks.push({ productId: 'session-product', onHandQuantity: 0 });

    expect(await validatedAtomicDatasetHydrationService.hydrate(dataset)).toEqual({
      status: 'hydrated',
    });
    const exported = await persistenceCoordinator.exportCurrentWorkbook();

    expect(
      await validatedAtomicDatasetHydrationService.hydrate(createEmptyBusinessDataset()),
    ).toEqual({ status: 'hydrated' });
    expect(await productStockService.getStock('session-product')).toBeNull();

    const restored = await persistenceCoordinator.importAndApplyWorkbook(exported.bytes);

    expect(restored.status).toBe('hydrated');
    expect(await productStockService.getStock('session-product')).toEqual({
      productId: 'session-product',
      onHandQuantity: 0,
    });
  });
  it('round-trips ProductPriceTiers through the shared live persistence coordinator', async () => {
    const core = createEmptyBusinessDatasetV2();
    core.products.push({
      id: 'session-tier-product',
      name: 'Session Tier Product',
      category: 'paintable-art',
      safetyWasteRate: 0,
      isActive: true,
    });
    core.productPriceTiers.push({
      id: 'TIER-SESSION-0001',
      productId: 'session-tier-product',
      name: 'Session Bulk',
      kind: 'bulk',
      priceBasis: 'per-unit',
      priceAmount: 45,
      unitsPerOffer: 1,
      minimumOrderQuantity: 10,
      additionalCostPerOffer: 0,
      isActive: true,
    });

    expect(
      await physicalDatasetHydrationServiceV3.hydrate(
        extendBusinessDatasetV2(core),
      ),
    ).toEqual({ status: 'hydrated' });

    const exported = await persistenceCoordinator.exportCurrentWorkbook();

    expect(
      await physicalDatasetHydrationServiceV3.hydrate(
        extendBusinessDatasetV2(createEmptyBusinessDatasetV2()),
      ),
    ).toEqual({ status: 'hydrated' });
    expect(await productPriceTierService.listTiers()).toEqual([]);

    const restored = await persistenceCoordinator.importAndApplyWorkbook(
      exported.bytes,
    );

    expect(restored).toMatchObject({
      status: 'hydrated',
      metadata: {
        workbookFormatVersion: 3,
        datasetSchemaVersion: 2,
      },
    });
    expect(await productPriceTierService.getTier('tier-session-0001')).toEqual(
      core.productPriceTiers[0],
    );
  });


  it('round-trips PlasterMoldYieldProfiles through physical workbook v4 in the shared session', async () => {
    const core = createEmptyBusinessDatasetV2();
    core.materials.push(
      {
        id: 'session-water',
        name: 'Session Water',
        group: 'liquid',
        baseUnit: 'g',
        purchaseQuantity: 1000,
        purchaseUnit: 'g',
        packageCost: 25,
        onHandQuantity: 1000,
        onHandUnit: 'g',
        isActive: true,
      },
      {
        id: 'session-plaster',
        name: 'Session Plaster',
        group: 'plaster',
        baseUnit: 'g',
        purchaseQuantity: 1000,
        purchaseUnit: 'g',
        packageCost: 70,
        onHandQuantity: 1000,
        onHandUnit: 'g',
        isActive: true,
      },
      {
        id: 'session-glue',
        name: 'Session Glue',
        group: 'other',
        baseUnit: 'g',
        purchaseQuantity: 500,
        purchaseUnit: 'g',
        packageCost: 90,
        onHandQuantity: 500,
        onHandUnit: 'g',
        isActive: true,
      },
    );
    core.products.push({
      id: 'session-profile-product',
      name: 'Session Profile Product',
      category: 'paintable-art',
      safetyWasteRate: 0,
      isActive: true,
    });

    const dataset = extendPhysicalBusinessDatasetV3(
      extendBusinessDatasetV2(
        core,
        [],
        [
          {
            id: 'session-profile-mold',
            productId: 'session-profile-product',
            name: 'Session Profile Mold',
            isActive: true,
          },
        ],
      ),
      [
        {
          id: 'PMYP-SESSION-0001',
          moldId: 'session-profile-mold',
          waterMaterialId: 'session-water',
          plasterMaterialId: 'session-plaster',
          glueMaterialId: 'session-glue',
          waterFillWeightGrams: 50,
          waterAdjustmentRate: 0.3,
          plasterFactor: 0.75,
          glueFactor: 0.05,
          piecesPerPour: 4,
          notes: 'session persisted profile',
          isActive: true,
        },
      ],
    );

    expect(await physicalDatasetHydrationServiceV4.hydrate(dataset)).toEqual({
      status: 'hydrated',
    });

    const exported = await persistenceCoordinator.exportCurrentWorkbook();

    expect(
      await physicalDatasetHydrationServiceV4.hydrate(
        extendPhysicalBusinessDatasetV3(
          extendBusinessDatasetV2(createEmptyBusinessDatasetV2()),
        ),
      ),
    ).toEqual({ status: 'hydrated' });
    expect(
      await plasterMoldYieldProfileService.getProfile('PMYP-SESSION-0001'),
    ).toBeNull();

    const restored = await persistenceCoordinator.importAndApplyWorkbook(
      exported.bytes,
    );

    expect(restored).toMatchObject({
      status: 'hydrated',
      metadata: {
        workbookFormatVersion: 4,
        datasetSchemaVersion: 4,
      },
    });
    expect(
      await plasterMoldYieldProfileService.getProfile('pmyp-session-0001'),
    ).toEqual(dataset.plasterMoldYieldProfiles[0]);
  });

});
