import { describe, expect, it, vi } from 'vitest';
import { createEmptyBusinessDataset } from '../../domain/businessDataset';
import {
  extendLegacyBusinessDataset,
  type PhysicalBusinessDataset,
} from '../../domain/physicalBusinessDataset';
import type { Product } from '../../domain/products';
import { InMemoryMoldRepository } from '../molds/InMemoryMoldRepository';
import { InMemoryStorageLocationRepository } from '../storageLocations/InMemoryStorageLocationRepository';
import { DatasetHydrationError } from './ValidatedAtomicDatasetHydrationService';
import { PhysicalDatasetHydrationService } from './PhysicalDatasetHydrationService';
import { PhysicalSourceSnapshotService } from './PhysicalSourceSnapshotService';

function product(id: string): Product {
  return {
    id,
    name: `Product ${id}`,
    category: 'paintable-art',
    safetyWasteRate: 0.05,
    isActive: true,
  };
}

function dataset(productId = 'PRD-1'): PhysicalBusinessDataset {
  const base = createEmptyBusinessDataset();
  base.products.push(product(productId));
  return extendLegacyBusinessDataset(
    base,
    [
      { id: 'RACK-A', name: 'Rack A', type: 'rack', isActive: true },
      { id: 'SHELF-1', name: 'Shelf 1', type: 'shelf', parentId: 'RACK-A', isActive: true },
      { id: 'BIN-1', name: 'Bin 1', type: 'bin', parentId: 'SHELF-1', isActive: true },
    ],
    [
      {
        id: 'MOLD-1',
        productId,
        name: 'Dinosaur Mold',
        storageLocationId: 'BIN-1',
        isActive: true,
      },
    ],
  );
}

describe('physical dataset persistence', () => {
  it('snapshots base sources, storage locations, and molds in deterministic ID order', async () => {
    const base = createEmptyBusinessDataset();
    base.products.push(product('PRD-1'));
    const storage = new InMemoryStorageLocationRepository([
      { id: 'Z-RACK', name: 'Z Rack', type: 'rack', isActive: true },
      { id: 'A-RACK', name: 'A Rack', type: 'rack', isActive: true },
    ]);
    const molds = new InMemoryMoldRepository([
      { id: 'MOLD-Z', productId: 'PRD-1', name: 'Z Mold', isActive: true },
      { id: 'MOLD-A', productId: 'PRD-1', name: 'A Mold', isActive: true },
    ]);
    const service = new PhysicalSourceSnapshotService(
      { snapshot: async () => base },
      storage,
      molds,
    );

    const snapshot = await service.snapshot();

    expect(snapshot.schemaVersion).toBe(2);
    expect(snapshot.storageLocations.map((item) => item.id)).toEqual(['A-RACK', 'Z-RACK']);
    expect(snapshot.molds.map((item) => item.id)).toEqual(['MOLD-A', 'MOLD-Z']);
    expect(snapshot.products).toEqual(base.products);
  });

  it('hydrates valid physical collections after the base dataset succeeds', async () => {
    const storage = new InMemoryStorageLocationRepository();
    const molds = new InMemoryMoldRepository();
    const next = dataset();
    const baseHydration = { hydrate: vi.fn(async () => ({ status: 'hydrated' as const })) };
    const snapshotService = { snapshot: vi.fn(async () => extendLegacyBusinessDataset(createEmptyBusinessDataset())) };
    const service = new PhysicalDatasetHydrationService(baseHydration, snapshotService, storage, molds);

    await expect(service.hydrate(next)).resolves.toEqual({ status: 'hydrated' });
    expect(baseHydration.hydrate).toHaveBeenCalledOnce();
    expect((await storage.list()).map((item) => item.id)).toEqual(['RACK-A', 'SHELF-1', 'BIN-1']);
    expect(await molds.findById('MOLD-1')).toMatchObject({
      productId: 'PRD-1',
      storageLocationId: 'BIN-1',
    });
  });

  it('rejects invalid physical references before replacing any live repositories', async () => {
    const storage = new InMemoryStorageLocationRepository([
      { id: 'LIVE-RACK', name: 'Live Rack', type: 'rack', isActive: true },
    ]);
    const molds = new InMemoryMoldRepository([
      { id: 'LIVE-MOLD', productId: 'LIVE-PRD', name: 'Live Mold', isActive: true },
    ]);
    const baseHydration = { hydrate: vi.fn(async () => ({ status: 'hydrated' as const })) };
    const snapshotService = { snapshot: vi.fn(async () => dataset('LIVE-PRD')) };
    const service = new PhysicalDatasetHydrationService(baseHydration, snapshotService, storage, molds);
    const invalid = dataset();
    invalid.molds[0] = { ...invalid.molds[0]!, productId: 'MISSING' };

    const result = await service.hydrate(invalid);

    expect(result.status).toBe('rejected');
    expect(baseHydration.hydrate).not.toHaveBeenCalled();
    expect(await storage.list()).toEqual([
      { id: 'LIVE-RACK', name: 'Live Rack', type: 'rack', isActive: true },
    ]);
    expect(await molds.list()).toEqual([
      { id: 'LIVE-MOLD', productId: 'LIVE-PRD', name: 'Live Mold', isActive: true },
    ]);
  });

  it('rolls back physical collections when applying the new storage collection fails', async () => {
    const previous = dataset('OLD-PRD');
    const storage = new InMemoryStorageLocationRepository(previous.storageLocations);
    const molds = new InMemoryMoldRepository(previous.molds);
    const baseHydration = { hydrate: vi.fn(async () => ({ status: 'hydrated' as const })) };
    const snapshotService = { snapshot: vi.fn(async () => previous) };
    const service = new PhysicalDatasetHydrationService(baseHydration, snapshotService, storage, molds);
    const originalReplaceAll = storage.replaceAll.bind(storage);
    let failNextReplacement = true;
    vi.spyOn(storage, 'replaceAll').mockImplementation(async (records) => {
      if (failNextReplacement) {
        failNextReplacement = false;
        throw new Error('simulated storage write failure');
      }
      await originalReplaceAll(records);
    });

    const next = dataset('NEW-PRD');
    await expect(service.hydrate(next)).rejects.toMatchObject({
      code: 'APPLY_FAILED_RESTORED',
    } satisfies Partial<DatasetHydrationError>);

    expect(await storage.list()).toEqual(previous.storageLocations);
    expect(await molds.list()).toEqual(previous.molds);
    expect(baseHydration.hydrate).toHaveBeenCalledTimes(2);
  });
});
