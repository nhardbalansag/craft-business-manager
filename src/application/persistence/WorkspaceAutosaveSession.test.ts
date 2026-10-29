import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { createEmptyBusinessDatasetV2 } from '../../domain/businessDatasetV2';
import { extendBusinessDatasetV2 } from '../../domain/physicalBusinessDatasetV3';
import { extendPhysicalBusinessDatasetV3 } from '../../domain/physicalBusinessDatasetV4';
import { extendPhysicalBusinessDatasetV4 } from '../../domain/physicalBusinessDatasetV5';
import { BrowserWorkspaceStore } from '../../storage/BrowserWorkspaceStore';
import * as session from '../session';
import { WorkspaceAutosave } from './WorkspaceAutosave';
import { WorkspaceChangeTracker } from './WorkspaceChangeTracker';

describe('shared session refresh recovery', () => {
  it('autosaves service edits and real workbook imports, then restores every source collection', async () => {
    const newFactory = new IDBFactory();
    const store = new BrowserWorkspaceStore(() => newFactory);
    const autosave = new WorkspaceAutosave(session.physicalSourceSnapshotServiceV5,
      session.physicalDatasetHydrationServiceV5, store, session.workspaceChanges);
    await autosave.start();
    await session.materialService.createMaterial({ id: 'PLASTER', name: 'Plaster', group: 'plaster',
      baseUnit: 'g', purchaseQuantity: 1000, purchaseUnit: 'g', packageCost: 80,
      onHandQuantity: 100, onHandUnit: 'g', isActive: true });
    await session.productService.createProduct({ id: 'PHOTO', name: 'Photo product', category: 'paintable-art',
      safetyWasteRate: 0, isActive: true, imageDataUrl: 'data:image/jpeg;base64,AAAA',
      brochureImageDataUrl: `data:image/jpeg;base64,${'A'.repeat(40_000)}` });
    await session.productStockService.setStock('PHOTO', 7);
    await autosave.flush();
    const expected = await session.physicalSourceSnapshotServiceV5.snapshot();
    const workbook = await session.persistenceCoordinator.exportCurrentWorkbook();
    const empty = extendPhysicalBusinessDatasetV4(extendPhysicalBusinessDatasetV3(
      extendBusinessDatasetV2(createEmptyBusinessDatasetV2()),
    ));
    await session.physicalDatasetHydrationServiceV5.hydrate(empty);
    expect(await session.persistenceCoordinator.importAndApplyWorkbook(workbook.bytes)).toMatchObject({ status: 'hydrated' });
    await autosave.flush();
    expect((await store.load() as { dataset: unknown }).dataset).toEqual(expected);
    autosave.dispose();

    // Simulate a fresh JavaScript session with empty repositories and the same IndexedDB.
    await session.physicalDatasetHydrationServiceV5.hydrate(empty);
    const fresh = new WorkspaceAutosave(session.physicalSourceSnapshotServiceV5,
      session.physicalDatasetHydrationServiceV5, store, new WorkspaceChangeTracker());
    await fresh.start();
    expect(await session.physicalSourceSnapshotServiceV5.snapshot()).toEqual(expected);
    expect(await session.productStockService.getStock('PHOTO')).toEqual({ productId: 'PHOTO', onHandQuantity: 7 });
    expect(fresh.getStatus().restored).toBe(true);
    fresh.dispose();
  });
});
