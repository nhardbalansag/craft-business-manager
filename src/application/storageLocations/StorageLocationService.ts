import {
  cloneStorageLocation,
  validateStorageLocationContract,
  type StorageLocation,
  type StorageLocationType,
} from '../../domain/storageLocations';
import type { StorageLocationRepository } from './StorageLocationRepository';

export interface StorageLocationAssignmentGuard {
  assertStorageLocationCanArchive(id: string): Promise<void>;
}

export interface StorageLocationListFilter {
  type?: StorageLocationType;
  active?: boolean;
  query?: string;
}

export type StorageLocationUpdate = Partial<Omit<StorageLocation, 'id'>>;

export type StorageLocationApplicationErrorCode =
  | 'LOCATION_NOT_FOUND'
  | 'DUPLICATE_LOCATION_ID'
  | 'DUPLICATE_SIBLING_NAME'
  | 'PARENT_REQUIRED'
  | 'PARENT_NOT_ALLOWED'
  | 'PARENT_NOT_FOUND'
  | 'PARENT_INACTIVE'
  | 'INVALID_PARENT_TYPE'
  | 'LOCATION_CYCLE'
  | 'ACTIVE_CHILDREN_EXIST';

export class StorageLocationApplicationError extends Error {
  readonly code: StorageLocationApplicationErrorCode;
  readonly locationId?: string;
  readonly parentId?: string;

  constructor(
    code: StorageLocationApplicationErrorCode,
    message: string,
    context: { locationId?: string; parentId?: string } = {},
  ) {
    super(message);
    this.name = 'StorageLocationApplicationError';
    this.code = code;
    this.locationId = context.locationId;
    this.parentId = context.parentId;
  }
}

function comparable(value: string): string {
  return value.trim().toLowerCase();
}

function normalize(location: StorageLocation): StorageLocation {
  return {
    ...location,
    id: location.id.trim(),
    name: location.name.trim(),
    parentId: location.parentId?.trim() || undefined,
    notes: location.notes?.trim() || undefined,
  };
}

function expectedParentType(type: StorageLocationType): StorageLocationType | null {
  if (type === 'shelf') return 'rack';
  if (type === 'bin') return 'shelf';
  return null;
}

export class StorageLocationService {
  constructor(
    private readonly repository: StorageLocationRepository,
    private readonly assignmentGuard?: StorageLocationAssignmentGuard,
  ) {}

  async createLocation(input: StorageLocation): Promise<StorageLocation> {
    const candidate = normalize(input);
    validateStorageLocationContract(candidate);
    const all = await this.repository.list();
    this.assertUnique(candidate, all);
    await this.validateHierarchy(candidate, all);
    await this.repository.insert(candidate);
    return cloneStorageLocation(candidate);
  }

  async updateLocation(id: string, changes: StorageLocationUpdate): Promise<StorageLocation> {
    const existing = await this.requireLocation(id);
    const candidate = normalize({ ...existing, ...changes, id: existing.id });
    validateStorageLocationContract(candidate);
    const all = await this.repository.list();
    this.assertUnique(candidate, all, existing.id);
    await this.validateHierarchy(candidate, all, existing.id);

    if (existing.isActive && !candidate.isActive) await this.assertCanArchive(existing.id, all);

    await this.repository.replace(candidate);
    return cloneStorageLocation(candidate);
  }

  async archiveLocation(id: string): Promise<StorageLocation> {
    const existing = await this.requireLocation(id);
    if (!existing.isActive) return cloneStorageLocation(existing);
    const all = await this.repository.list();
    await this.assertCanArchive(existing.id, all);
    const archived = { ...existing, isActive: false };
    await this.repository.replace(archived);
    return cloneStorageLocation(archived);
  }

  async getLocation(id: string): Promise<StorageLocation | null> {
    const location = await this.repository.findById(id);
    return location ? cloneStorageLocation(location) : null;
  }

  async listLocations(filter: StorageLocationListFilter = {}): Promise<StorageLocation[]> {
    const query = comparable(filter.query ?? '');
    return (await this.repository.list())
      .filter((item) => filter.type === undefined || item.type === filter.type)
      .filter((item) => filter.active === undefined || item.isActive === filter.active)
      .filter((item) => !query || [item.id, item.name, item.notes ?? '', item.parentId ?? ''].some((value) => comparable(value).includes(query)))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || a.id.localeCompare(b.id))
      .map(cloneStorageLocation);
  }

  async resolvePath(id: string): Promise<StorageLocation[]> {
    const all = await this.repository.list();
    const byId = new Map(all.map((item) => [comparable(item.id), item]));
    const start = byId.get(comparable(id));
    if (!start) throw new StorageLocationApplicationError('LOCATION_NOT_FOUND', `Storage location not found: ${id.trim()}.`, { locationId: id.trim() });

    const path: StorageLocation[] = [];
    const seen = new Set<string>();
    let current: StorageLocation | undefined = start;
    while (current) {
      const currentKey = comparable(current.id);
      if (seen.has(currentKey)) {
        throw new StorageLocationApplicationError('LOCATION_CYCLE', `Storage hierarchy contains a cycle at ${current.id}.`, { locationId: current.id });
      }
      seen.add(currentKey);
      path.unshift(cloneStorageLocation(current));
      current = current.parentId ? byId.get(comparable(current.parentId)) : undefined;
    }
    return path;
  }

  async formatPath(id: string): Promise<string> {
    return (await this.resolvePath(id)).map((item) => item.name).join(' / ');
  }

  private async requireLocation(id: string): Promise<StorageLocation> {
    const location = await this.repository.findById(id);
    if (!location) throw new StorageLocationApplicationError('LOCATION_NOT_FOUND', `Storage location not found: ${id.trim()}.`, { locationId: id.trim() });
    return location;
  }

  private assertUnique(candidate: StorageLocation, all: StorageLocation[], currentId?: string): void {
    const currentKey = currentId ? comparable(currentId) : undefined;
    if (all.some((item) => comparable(item.id) === comparable(candidate.id) && comparable(item.id) !== currentKey)) {
      throw new StorageLocationApplicationError('DUPLICATE_LOCATION_ID', `Storage location ID already exists: ${candidate.id}.`, { locationId: candidate.id });
    }
    const parentKey = comparable(candidate.parentId ?? '');
    if (all.some((item) => comparable(item.id) !== currentKey && item.type === candidate.type && comparable(item.parentId ?? '') === parentKey && comparable(item.name) === comparable(candidate.name))) {
      throw new StorageLocationApplicationError('DUPLICATE_SIBLING_NAME', `A ${candidate.type} named ${candidate.name} already exists at this level.`, { locationId: candidate.id, parentId: candidate.parentId });
    }
  }

  private async validateHierarchy(candidate: StorageLocation, all: StorageLocation[], currentId?: string): Promise<void> {
    const expected = expectedParentType(candidate.type);
    if (!expected) {
      if (candidate.parentId) throw new StorageLocationApplicationError('PARENT_NOT_ALLOWED', 'Rack locations cannot have a parent.', { locationId: candidate.id, parentId: candidate.parentId });
      return;
    }
    if (!candidate.parentId) throw new StorageLocationApplicationError('PARENT_REQUIRED', `${candidate.type} locations require a ${expected} parent.`, { locationId: candidate.id });
    const parent = all.find((item) => comparable(item.id) === comparable(candidate.parentId!));
    if (!parent) throw new StorageLocationApplicationError('PARENT_NOT_FOUND', `Storage parent not found: ${candidate.parentId}.`, { locationId: candidate.id, parentId: candidate.parentId });
    if (parent.type !== expected) throw new StorageLocationApplicationError('INVALID_PARENT_TYPE', `${candidate.type} locations must belong to a ${expected}.`, { locationId: candidate.id, parentId: parent.id });
    if (candidate.isActive && !parent.isActive) throw new StorageLocationApplicationError('PARENT_INACTIVE', `Active ${candidate.type} ${candidate.id} cannot belong to archived ${expected} ${parent.id}.`, { locationId: candidate.id, parentId: parent.id });
    if (currentId && comparable(parent.id) === comparable(currentId)) throw new StorageLocationApplicationError('LOCATION_CYCLE', `Storage location ${candidate.id} cannot be its own parent.`, { locationId: candidate.id, parentId: parent.id });
  }

  private async assertCanArchive(id: string, all: StorageLocation[]): Promise<void> {
    const child = all.find((item) => item.isActive && item.parentId && comparable(item.parentId) === comparable(id));
    if (child) throw new StorageLocationApplicationError('ACTIVE_CHILDREN_EXIST', `Storage location ${id} still contains active ${child.type} ${child.id}.`, { locationId: id });
    await this.assignmentGuard?.assertStorageLocationCanArchive(id);
  }
}
