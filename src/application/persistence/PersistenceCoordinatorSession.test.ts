import { afterEach, describe, expect, it } from 'vitest';
import { createEmptyBusinessDataset } from '../../domain/businessDataset';
import { createEmptyBusinessDatasetV2 } from '../../domain/businessDatasetV2';
import { extendBusinessDatasetV2 } from '../../domain/physicalBusinessDatasetV3';
import {
  persistenceCoordinator,
  physicalDatasetHydrationServiceV3,
  productPriceTierService,
  productStockService,
  validatedAtomicDatasetHydrationService,
} from '../session';
import { PersistenceCoordinator } from './PersistenceCoordinator';

afterEach(async () => {
  const result = await physicalDatasetHydrationServiceV3.hydrate(
    extendBusinessDatasetV2(createEmptyBusinessDatasetV2()),
  );
  if (result.status !== 'hydrated') {
    throw new Error('tier-aware session cleanup hydration was rejected');
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

});
