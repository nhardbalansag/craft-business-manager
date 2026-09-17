import { describe, expect, it } from 'vitest';
import type { Product } from '../../domain/products';
import type { StorageLocation } from '../../domain/storageLocations';
import { InMemoryProductRepository } from '../products/InMemoryProductRepository';
import { InMemoryStorageLocationRepository } from '../storageLocations/InMemoryStorageLocationRepository';
import { InMemoryMoldRepository } from './InMemoryMoldRepository';
import { MoldApplicationError, MoldService } from './MoldService';

function product(id: string, isActive = true): Product {
  return {
    id,
    name: `Product ${id}`,
    category: 'paintable-art',
    safetyWasteRate: 0.05,
    isActive,
  };
}

function bin(id: string, isActive = true): StorageLocation {
  return { id, name: `Bin ${id}`, type: 'bin', parentId: 'SHELF-1', isActive };
}

function setup(
  products: Product[] = [product('PRD-1')],
  locations: StorageLocation[] = [bin('BIN-1')],
) {
  const moldRepository = new InMemoryMoldRepository();
  const productRepository = new InMemoryProductRepository(products);
  const storageLocationRepository = new InMemoryStorageLocationRepository(locations);
  const service = new MoldService(moldRepository, productRepository, storageLocationRepository);
  return { moldRepository, productRepository, storageLocationRepository, service };
}

describe('MoldService', () => {
  it('creates a mold linked to an existing Product and Storage Location', async () => {
    const { service } = setup();

    const saved = await service.createMold({
      id: 'MOLD-0012',
      productId: 'PRD-1',
      name: 'Dinosaur Mold #1',
      storageLocationId: 'BIN-1',
      isActive: true,
    });

    expect(saved).toEqual({
      id: 'MOLD-0012',
      productId: 'PRD-1',
      name: 'Dinosaur Mold #1',
      storageLocationId: 'BIN-1',
      notes: undefined,
      isActive: true,
    });
  });

  it('rejects missing or archived Products for active molds', async () => {
    const { service } = setup([product('ARCHIVED', false)]);

    await expect(
      service.createMold({ id: 'MOLD-404', productId: 'MISSING', name: 'Missing', isActive: true }),
    ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });

    await expect(
      service.createMold({ id: 'MOLD-A', productId: 'ARCHIVED', name: 'Archived', isActive: true }),
    ).rejects.toMatchObject({ code: 'PRODUCT_INACTIVE' });
  });

  it('rejects missing or archived Storage Locations for active molds', async () => {
    const { service } = setup([product('PRD-1')], [bin('ARCHIVED-BIN', false)]);

    await expect(
      service.createMold({
        id: 'MOLD-404',
        productId: 'PRD-1',
        name: 'Missing location',
        storageLocationId: 'BIN-404',
        isActive: true,
      }),
    ).rejects.toMatchObject({ code: 'STORAGE_LOCATION_NOT_FOUND' });

    await expect(
      service.createMold({
        id: 'MOLD-A',
        productId: 'PRD-1',
        name: 'Archived location',
        storageLocationId: 'ARCHIVED-BIN',
        isActive: true,
      }),
    ).rejects.toMatchObject({ code: 'STORAGE_LOCATION_INACTIVE' });
  });

  it('rejects duplicate Mold IDs and same-product Mold names case-insensitively', async () => {
    const { service } = setup([product('PRD-1'), product('PRD-2')]);
    await service.createMold({ id: 'MOLD-1', productId: 'PRD-1', name: 'Dinosaur', isActive: true });

    await expect(
      service.createMold({ id: ' mold-1 ', productId: 'PRD-2', name: 'Other', isActive: true }),
    ).rejects.toMatchObject({ code: 'DUPLICATE_MOLD_ID' });

    await expect(
      service.createMold({ id: 'MOLD-2', productId: 'PRD-1', name: ' dinosaur ', isActive: true }),
    ).rejects.toMatchObject({ code: 'DUPLICATE_MOLD_NAME' });

    await expect(
      service.createMold({ id: 'MOLD-3', productId: 'PRD-2', name: 'Dinosaur', isActive: true }),
    ).resolves.toMatchObject({ id: 'MOLD-3' });
  });

  it('moves and unassigns a mold without mutating its stable Mold ID', async () => {
    const { service, storageLocationRepository } = setup();
    await storageLocationRepository.insert(bin('BIN-2'));
    await service.createMold({
      id: 'MOLD-1',
      productId: 'PRD-1',
      name: 'Dinosaur',
      storageLocationId: 'BIN-1',
      isActive: true,
    });

    const moved = await service.moveMold('MOLD-1', 'BIN-2');
    expect(moved).toMatchObject({ id: 'MOLD-1', productId: 'PRD-1', storageLocationId: 'BIN-2' });

    const unassigned = await service.moveMold('MOLD-1');
    expect(unassigned.id).toBe('MOLD-1');
    expect(unassigned.productId).toBe('PRD-1');
    expect(unassigned.storageLocationId).toBeUndefined();
  });

  it('prevents archiving a Product that still owns an active mold', async () => {
    const { service } = setup();
    await service.createMold({ id: 'MOLD-1', productId: 'PRD-1', name: 'Dinosaur', isActive: true });

    await expect(service.assertProductCanArchive('PRD-1')).rejects.toBeInstanceOf(MoldApplicationError);
    await expect(service.assertProductCanArchive('PRD-1')).rejects.toMatchObject({
      code: 'PRODUCT_INACTIVE',
      moldId: 'MOLD-1',
    });

    await service.archiveMold('MOLD-1');
    await expect(service.assertProductCanArchive('PRD-1')).resolves.toBeUndefined();
  });

  it('prevents archiving a Storage Location assigned to an active mold', async () => {
    const { service } = setup();
    await service.createMold({
      id: 'MOLD-1',
      productId: 'PRD-1',
      name: 'Dinosaur',
      storageLocationId: 'BIN-1',
      isActive: true,
    });

    await expect(service.assertStorageLocationCanArchive('BIN-1')).rejects.toMatchObject({
      code: 'STORAGE_LOCATION_INACTIVE',
      moldId: 'MOLD-1',
    });

    await service.moveMold('MOLD-1');
    await expect(service.assertStorageLocationCanArchive('BIN-1')).resolves.toBeUndefined();
  });
});
