import { describe, expect, it, vi } from 'vitest';
import { InMemoryStorageLocationRepository } from './InMemoryStorageLocationRepository';
import {
  StorageLocationApplicationError,
  StorageLocationService,
  type StorageLocationAssignmentGuard,
} from './StorageLocationService';

function setup(
  seed: ConstructorParameters<typeof InMemoryStorageLocationRepository>[0] = [],
  assignmentGuard?: StorageLocationAssignmentGuard,
) {
  const repository = new InMemoryStorageLocationRepository(seed);
  const service = new StorageLocationService(repository, assignmentGuard);
  return { repository, service };
}

describe('StorageLocationService', () => {
  it('creates Rack → Shelf → Bin and resolves a deterministic human-readable path', async () => {
    const { service } = setup();

    await service.createLocation({ id: 'RACK-A', name: 'Rack A', type: 'rack', isActive: true });
    await service.createLocation({
      id: 'SHELF-2',
      name: 'Shelf 2',
      type: 'shelf',
      parentId: 'RACK-A',
      isActive: true,
    });
    await service.createLocation({
      id: 'BIN-04',
      name: 'Bin 04',
      type: 'bin',
      parentId: 'SHELF-2',
      isActive: true,
    });

    expect(await service.formatPath('bin-04')).toBe('Rack A / Shelf 2 / Bin 04');
    expect((await service.resolvePath('BIN-04')).map((location) => location.id)).toEqual([
      'RACK-A',
      'SHELF-2',
      'BIN-04',
    ]);
  });

  it('enforces parent requirements and parent types', async () => {
    const { service } = setup([
      { id: 'RACK-A', name: 'Rack A', type: 'rack', isActive: true },
      { id: 'SHELF-A', name: 'Shelf A', type: 'shelf', parentId: 'RACK-A', isActive: true },
    ]);

    await expect(
      service.createLocation({ id: 'SHELF-X', name: 'Shelf X', type: 'shelf', isActive: true }),
    ).rejects.toMatchObject({ code: 'PARENT_REQUIRED' });

    await expect(
      service.createLocation({
        id: 'BIN-X',
        name: 'Bin X',
        type: 'bin',
        parentId: 'RACK-A',
        isActive: true,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_PARENT_TYPE' });

    await expect(
      service.createLocation({
        id: 'RACK-X',
        name: 'Rack X',
        type: 'rack',
        parentId: 'SHELF-A',
        isActive: true,
      }),
    ).rejects.toMatchObject({ code: 'PARENT_NOT_ALLOWED' });
  });

  it('rejects inactive or missing parents for active descendants', async () => {
    const { service } = setup([
      { id: 'RACK-A', name: 'Rack A', type: 'rack', isActive: false },
    ]);

    await expect(
      service.createLocation({
        id: 'SHELF-A',
        name: 'Shelf A',
        type: 'shelf',
        parentId: 'RACK-A',
        isActive: true,
      }),
    ).rejects.toMatchObject({ code: 'PARENT_INACTIVE' });

    await expect(
      service.createLocation({
        id: 'SHELF-MISSING',
        name: 'Missing parent',
        type: 'shelf',
        parentId: 'RACK-404',
        isActive: true,
      }),
    ).rejects.toMatchObject({ code: 'PARENT_NOT_FOUND' });
  });

  it('rejects duplicate identities and duplicate sibling names case-insensitively', async () => {
    const { service } = setup([
      { id: 'RACK-A', name: 'Rack A', type: 'rack', isActive: true },
      { id: 'RACK-B', name: 'Rack B', type: 'rack', isActive: true },
      { id: 'SHELF-1', name: 'Shelf 1', type: 'shelf', parentId: 'RACK-A', isActive: true },
    ]);

    await expect(
      service.createLocation({ id: ' rack-a ', name: 'Other', type: 'rack', isActive: true }),
    ).rejects.toMatchObject({ code: 'DUPLICATE_LOCATION_ID' });

    await expect(
      service.createLocation({
        id: 'SHELF-2',
        name: ' shelf 1 ',
        type: 'shelf',
        parentId: 'RACK-A',
        isActive: true,
      }),
    ).rejects.toMatchObject({ code: 'DUPLICATE_SIBLING_NAME' });

    await expect(
      service.createLocation({
        id: 'SHELF-B-1',
        name: 'Shelf 1',
        type: 'shelf',
        parentId: 'RACK-B',
        isActive: true,
      }),
    ).resolves.toMatchObject({ id: 'SHELF-B-1' });
  });

  it('prevents archiving a location with active children', async () => {
    const { service } = setup([
      { id: 'RACK-A', name: 'Rack A', type: 'rack', isActive: true },
      { id: 'SHELF-A', name: 'Shelf A', type: 'shelf', parentId: 'RACK-A', isActive: true },
    ]);

    await expect(service.archiveLocation('RACK-A')).rejects.toBeInstanceOf(
      StorageLocationApplicationError,
    );
    await expect(service.archiveLocation('RACK-A')).rejects.toMatchObject({
      code: 'ACTIVE_CHILDREN_EXIST',
    });
  });

  it('delegates assignment safety before archiving a leaf location', async () => {
    const guard: StorageLocationAssignmentGuard = {
      assertStorageLocationCanArchive: vi.fn(async () => {
        throw new Error('assigned mold');
      }),
    };
    const { service } = setup(
      [{ id: 'RACK-A', name: 'Rack A', type: 'rack', isActive: true }],
      guard,
    );

    await expect(service.archiveLocation('RACK-A')).rejects.toThrow('assigned mold');
    expect(guard.assertStorageLocationCanArchive).toHaveBeenCalledWith('RACK-A');
  });

  it('detects cycles while resolving corrupted persisted hierarchy data', async () => {
    const { service } = setup([
      { id: 'A', name: 'A', type: 'rack', parentId: 'B', isActive: true },
      { id: 'B', name: 'B', type: 'rack', parentId: 'A', isActive: true },
    ]);

    await expect(service.resolvePath('A')).rejects.toMatchObject({ code: 'LOCATION_CYCLE' });
  });
});
