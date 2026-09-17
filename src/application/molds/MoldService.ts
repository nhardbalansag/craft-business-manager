import { cloneMold, validateMoldContract, type Mold } from '../../domain/molds';
import type { ProductRepository } from '../products/ProductRepository';
import type { StorageLocationRepository } from '../storageLocations/StorageLocationRepository';
import type { MoldRepository } from './MoldRepository';

export interface MoldListFilter {
  productId?: string;
  storageLocationId?: string;
  active?: boolean;
  query?: string;
}

export type MoldUpdate = Partial<Omit<Mold, 'id'>>;

export type MoldApplicationErrorCode =
  | 'MOLD_NOT_FOUND'
  | 'DUPLICATE_MOLD_ID'
  | 'DUPLICATE_MOLD_NAME'
  | 'PRODUCT_NOT_FOUND'
  | 'PRODUCT_INACTIVE'
  | 'STORAGE_LOCATION_NOT_FOUND'
  | 'STORAGE_LOCATION_INACTIVE';

export class MoldApplicationError extends Error {
  readonly code: MoldApplicationErrorCode;
  readonly moldId?: string;
  readonly productId?: string;
  readonly storageLocationId?: string;

  constructor(
    code: MoldApplicationErrorCode,
    message: string,
    context: { moldId?: string; productId?: string; storageLocationId?: string } = {},
  ) {
    super(message);
    this.name = 'MoldApplicationError';
    this.code = code;
    this.moldId = context.moldId;
    this.productId = context.productId;
    this.storageLocationId = context.storageLocationId;
  }
}

function comparable(value: string): string {
  return value.trim().toLowerCase();
}

function normalize(mold: Mold): Mold {
  return {
    ...mold,
    id: mold.id.trim(),
    productId: mold.productId.trim(),
    name: mold.name.trim(),
    storageLocationId: mold.storageLocationId?.trim() || undefined,
    notes: mold.notes?.trim() || undefined,
  };
}

export class MoldService {
  constructor(
    private readonly repository: MoldRepository,
    private readonly productRepository: ProductRepository,
    private readonly storageLocationRepository: StorageLocationRepository,
  ) {}

  async createMold(input: Mold): Promise<Mold> {
    const candidate = normalize(input);
    validateMoldContract(candidate);
    const all = await this.repository.list();
    this.assertUnique(candidate, all);
    await this.validateReferences(candidate);
    await this.repository.insert(candidate);
    return cloneMold(candidate);
  }

  async updateMold(id: string, changes: MoldUpdate): Promise<Mold> {
    const existing = await this.requireMold(id);
    const candidate = normalize({ ...existing, ...changes, id: existing.id });
    validateMoldContract(candidate);
    const all = await this.repository.list();
    this.assertUnique(candidate, all, existing.id);
    await this.validateReferences(candidate);
    await this.repository.replace(candidate);
    return cloneMold(candidate);
  }

  async moveMold(id: string, storageLocationId?: string): Promise<Mold> {
    return this.updateMold(id, { storageLocationId: storageLocationId?.trim() || undefined });
  }

  async archiveMold(id: string): Promise<Mold> {
    const existing = await this.requireMold(id);
    if (!existing.isActive) return cloneMold(existing);
    const archived = { ...existing, isActive: false };
    await this.repository.replace(archived);
    return cloneMold(archived);
  }

  async getMold(id: string): Promise<Mold | null> {
    const mold = await this.repository.findById(id);
    return mold ? cloneMold(mold) : null;
  }

  async listMolds(filter: MoldListFilter = {}): Promise<Mold[]> {
    const query = comparable(filter.query ?? '');
    const productKey = filter.productId ? comparable(filter.productId) : undefined;
    const locationKey = filter.storageLocationId ? comparable(filter.storageLocationId) : undefined;
    return (await this.repository.list())
      .filter((mold) => productKey === undefined || comparable(mold.productId) === productKey)
      .filter((mold) => locationKey === undefined || comparable(mold.storageLocationId ?? '') === locationKey)
      .filter((mold) => filter.active === undefined || mold.isActive === filter.active)
      .filter((mold) => !query || [mold.id, mold.name, mold.productId, mold.storageLocationId ?? '', mold.notes ?? ''].some((value) => comparable(value).includes(query)))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || a.id.localeCompare(b.id))
      .map(cloneMold);
  }

  async assertStorageLocationCanArchive(storageLocationId: string): Promise<void> {
    const assigned = (await this.repository.list()).find(
      (mold) => mold.isActive && mold.storageLocationId && comparable(mold.storageLocationId) === comparable(storageLocationId),
    );
    if (assigned) {
      throw new MoldApplicationError(
        'STORAGE_LOCATION_INACTIVE',
        `Storage location ${storageLocationId} is assigned to active mold ${assigned.id}. Move or archive the mold first.`,
        { moldId: assigned.id, storageLocationId },
      );
    }
  }

  async assertProductCanArchive(productId: string): Promise<void> {
    const assigned = (await this.repository.list()).find(
      (mold) => mold.isActive && comparable(mold.productId) === comparable(productId),
    );
    if (assigned) {
      throw new MoldApplicationError(
        'PRODUCT_INACTIVE',
        `Product ${productId} still has active mold ${assigned.id}. Archive the mold first.`,
        { moldId: assigned.id, productId },
      );
    }
  }

  async assertProductCanActivate(_productId?: string): Promise<void> {
    return;
  }

  private async requireMold(id: string): Promise<Mold> {
    const mold = await this.repository.findById(id);
    if (!mold) throw new MoldApplicationError('MOLD_NOT_FOUND', `Mold not found: ${id.trim()}.`, { moldId: id.trim() });
    return mold;
  }

  private assertUnique(candidate: Mold, all: Mold[], currentId?: string): void {
    const currentKey = currentId ? comparable(currentId) : undefined;
    if (all.some((mold) => comparable(mold.id) === comparable(candidate.id) && comparable(mold.id) !== currentKey)) {
      throw new MoldApplicationError('DUPLICATE_MOLD_ID', `Mold ID already exists: ${candidate.id}.`, { moldId: candidate.id });
    }
    if (all.some((mold) => comparable(mold.id) !== currentKey && comparable(mold.productId) === comparable(candidate.productId) && comparable(mold.name) === comparable(candidate.name))) {
      throw new MoldApplicationError('DUPLICATE_MOLD_NAME', `Product ${candidate.productId} already has a mold named ${candidate.name}.`, { moldId: candidate.id, productId: candidate.productId });
    }
  }

  private async validateReferences(candidate: Mold): Promise<void> {
    const product = await this.productRepository.findById(candidate.productId);
    if (!product) throw new MoldApplicationError('PRODUCT_NOT_FOUND', `Product not found: ${candidate.productId}.`, { moldId: candidate.id, productId: candidate.productId });
    if (candidate.isActive && !product.isActive) throw new MoldApplicationError('PRODUCT_INACTIVE', `Active mold ${candidate.id} cannot belong to archived product ${product.id}.`, { moldId: candidate.id, productId: product.id });

    if (!candidate.storageLocationId) return;
    const location = await this.storageLocationRepository.findById(candidate.storageLocationId);
    if (!location) throw new MoldApplicationError('STORAGE_LOCATION_NOT_FOUND', `Storage location not found: ${candidate.storageLocationId}.`, { moldId: candidate.id, storageLocationId: candidate.storageLocationId });
    if (candidate.isActive && !location.isActive) throw new MoldApplicationError('STORAGE_LOCATION_INACTIVE', `Active mold ${candidate.id} cannot be assigned to archived storage location ${location.id}.`, { moldId: candidate.id, storageLocationId: location.id });
  }
}
