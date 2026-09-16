import { afterEach, describe, expect, it } from 'vitest';
import { createEmptyBusinessDataset } from '../../domain/businessDataset';
import {
  persistenceCoordinator,
  productStockService,
  validatedAtomicDatasetHydrationService,
} from '../session';
import { PersistenceCoordinator } from './PersistenceCoordinator';

afterEach(async () => {
  const result = await validatedAtomicDatasetHydrationService.hydrate(createEmptyBusinessDataset());
  if (result.status !== 'hydrated') throw new Error('session cleanup hydration was rejected');
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
});
