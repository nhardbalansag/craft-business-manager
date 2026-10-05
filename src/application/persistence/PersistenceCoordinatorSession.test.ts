import { afterEach, describe, expect, it } from 'vitest';
import { createEmptyBusinessDataset } from '../../domain/businessDataset';
import { createEmptyBusinessDatasetV2 } from '../../domain/businessDatasetV2';
import { extendBusinessDatasetV2 } from '../../domain/physicalBusinessDatasetV3';
import { extendPhysicalBusinessDatasetV3 } from '../../domain/physicalBusinessDatasetV4';
import { extendPhysicalBusinessDatasetV4 } from '../../domain/physicalBusinessDatasetV5';
import {
  persistenceCoordinator,
  physicalDatasetHydrationServiceV3,
  physicalDatasetHydrationServiceV4,
  physicalDatasetHydrationServiceV5,
  plasterMoldYieldProfileService,
  productPriceTierService,
  productStockService,
  validatedAtomicDatasetHydrationService,
  yieldMoldFormulaSourceService,
} from '../session';
import { PersistenceCoordinator } from './PersistenceCoordinator';

afterEach(async () => {
  const result = await physicalDatasetHydrationServiceV5.hydrate(
    extendPhysicalBusinessDatasetV4(
      extendPhysicalBusinessDatasetV3(
        extendBusinessDatasetV2(createEmptyBusinessDatasetV2()),
      ),
    ),
  );
  if (result.status !== 'hydrated') {
    throw new Error('provenance-aware session cleanup hydration was rejected');
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
      pricingMethod: 'fixed-price',
      pricingValue: 45,
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


  it('round-trips PlasterMoldYieldProfiles through physical workbook v5 in the shared session', async () => {
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
        workbookFormatVersion: 5,
        datasetSchemaVersion: 5,
      },
    });
    expect(
      await plasterMoldYieldProfileService.getProfile('pmyp-session-0001'),
    ).toEqual(dataset.plasterMoldYieldProfiles[0]);
  });


  it('round-trips Mold Formula provenance through physical workbook v5 in the shared session', async () => {
    const core = createEmptyBusinessDatasetV2();
    core.materials.push(
      {
        id: 'session-v5-water',
        name: 'Session V5 Water',
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
        id: 'session-v5-plaster',
        name: 'Session V5 Plaster',
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
        id: 'session-v5-glue',
        name: 'Session V5 Glue',
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
      id: 'session-v5-product',
      name: 'Session V5 Product',
      category: 'paintable-art',
      safetyWasteRate: 0,
      isActive: true,
    });
    core.yieldSamples.push({
      id: 'YLD-SESSION-V5',
      productId: 'session-v5-product',
      materialInputs: [
        {
          materialId: 'session-v5-plaster',
          quantity: 100,
          unit: 'g',
        },
      ],
      goodPieces: 4,
      rejectedPieces: 0,
      recordedAt: '2026-09-29T13:00:00.000Z',
    });

    const dataset = extendPhysicalBusinessDatasetV4(
      extendPhysicalBusinessDatasetV3(
        extendBusinessDatasetV2(
          core,
          [],
          [
            {
              id: 'session-v5-mold',
              productId: 'session-v5-product',
              name: 'Session V5 Mold',
              isActive: true,
            },
          ],
        ),
        [
          {
            id: 'PMYP-SESSION-V5',
            moldId: 'session-v5-mold',
            waterMaterialId: 'session-v5-water',
            plasterMaterialId: 'session-v5-plaster',
            glueMaterialId: 'session-v5-glue',
            waterFillWeightGrams: 50,
            waterAdjustmentRate: 0.3,
            plasterFactor: 0.75,
            glueFactor: 0.05,
            piecesPerPour: 4,
            isActive: true,
          },
        ],
      ),
      [
        {
          yieldSampleId: 'YLD-SESSION-V5',
          moldId: 'session-v5-mold',
          moldYieldProfileId: 'PMYP-SESSION-V5',
        },
      ],
    );

    expect(await physicalDatasetHydrationServiceV5.hydrate(dataset)).toEqual({
      status: 'hydrated',
    });

    const exported = await persistenceCoordinator.exportCurrentWorkbook();

    expect(
      await physicalDatasetHydrationServiceV5.hydrate(
        extendPhysicalBusinessDatasetV4(
          extendPhysicalBusinessDatasetV3(
            extendBusinessDatasetV2(createEmptyBusinessDatasetV2()),
          ),
        ),
      ),
    ).toEqual({ status: 'hydrated' });
    expect(
      await yieldMoldFormulaSourceService.getSourceForYieldSample(
        'YLD-SESSION-V5',
      ),
    ).toBeNull();

    const restored = await persistenceCoordinator.importAndApplyWorkbook(
      exported.bytes,
    );

    expect(restored).toMatchObject({
      status: 'hydrated',
      metadata: {
        workbookFormatVersion: 5,
        datasetSchemaVersion: 5,
      },
    });
    expect(
      await yieldMoldFormulaSourceService.getSourceForYieldSample(
        'yld-session-v5',
      ),
    ).toEqual(dataset.yieldMoldFormulaSources[0]);
  });

});
