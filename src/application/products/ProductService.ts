import type { MixPreset } from '../../domain/mixPresets';
import { isMixPresetCompatibleWithCategory } from '../../domain/mixPresets';
import type { Product, ProductCategory } from '../../domain/products';
import { cloneProduct, validateProductContract } from '../../domain/products';
import {
  deriveProductSafetyWastePolicy,
  type ProductSafetyWastePolicy,
} from '../../domain/safetyWastePolicy';
import type { MixPresetRepository } from '../mixPresets/MixPresetRepository';
import type { ProductComponentRelationshipGuard } from '../productComponents/ProductComponentRelationshipGuard';
import type { ProductRepository } from './ProductRepository';

export interface ProductListFilter {
  category?: ProductCategory;
  active?: boolean;
  query?: string;
}

export type ProductUpdate = Partial<Omit<Product, 'id'>>;
type ProductRelationshipGuard = Pick<
  ProductComponentRelationshipGuard,
  'assertProductCanArchive' | 'assertProductCanActivate'
>;

export type ProductApplicationErrorCode =
  | 'PRODUCT_NOT_FOUND'
  | 'DUPLICATE_PRODUCT_ID'
  | 'DUPLICATE_PRODUCT_NAME'
  | 'MIX_PRESET_NOT_FOUND'
  | 'MIX_PRESET_INACTIVE'
  | 'MIX_PRESET_CATEGORY_MISMATCH';

export class ProductApplicationError extends Error {
  readonly code: ProductApplicationErrorCode;
  readonly productId?: string;
  readonly mixPresetId?: string;

  constructor(
    code: ProductApplicationErrorCode,
    message: string,
    context: { productId?: string; mixPresetId?: string } = {},
  ) {
    super(message);
    this.name = 'ProductApplicationError';
    this.code = code;
    this.productId = context.productId;
    this.mixPresetId = context.mixPresetId;
  }
}

function comparable(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeProduct(product: Product): Product {
  return {
    ...product,
    id: product.id.trim(),
    name: product.name.trim(),
    mixPresetId: product.mixPresetId?.trim() || undefined,
    preferredYieldSampleId: product.preferredYieldSampleId?.trim() || undefined,
    notes: product.notes?.trim() || undefined,
  };
}

function matchesQuery(product: Product, query: string): boolean {
  const normalized = comparable(query);
  if (!normalized) return true;
  return [product.id, product.name, product.notes ?? '', product.mixPresetId ?? ''].some((value) =>
    value.toLowerCase().includes(normalized),
  );
}

export class ProductService {
  constructor(
    private readonly repository: ProductRepository,
    private readonly mixPresetRepository: MixPresetRepository,
    private readonly componentRelationshipGuard?: ProductRelationshipGuard,
  ) {}

  async createProduct(input: Product): Promise<Product> {
    const product = normalizeProduct(input);
    validateProductContract(product);
    await this.validateMixReference(product);

    const all = await this.repository.list();
    this.assertUniqueIdentity(product, all);

    await this.repository.insert(product);
    return cloneProduct(product);
  }

  async updateProduct(id: string, changes: ProductUpdate): Promise<Product> {
    const existing = await this.requireProduct(id);
    const candidate = normalizeProduct({ ...existing, ...changes, id: existing.id });
    validateProductContract(candidate);
    await this.validateMixReference(candidate);

    const all = await this.repository.list();
    this.assertUniqueIdentity(candidate, all, existing.id);

    if (existing.isActive && !candidate.isActive) {
      await this.componentRelationshipGuard?.assertProductCanArchive(existing.id);
    }
    if (!existing.isActive && candidate.isActive) {
      await this.componentRelationshipGuard?.assertProductCanActivate(candidate.id);
    }

    await this.repository.replace(candidate);
    return cloneProduct(candidate);
  }

  async getProduct(id: string): Promise<Product | null> {
    const product = await this.repository.findById(id);
    return product ? cloneProduct(product) : null;
  }

  async getSafetyWastePolicy(id: string): Promise<ProductSafetyWastePolicy> {
    const product = await this.requireProduct(id);
    return deriveProductSafetyWastePolicy(product);
  }

  async listProducts(filter: ProductListFilter = {}): Promise<Product[]> {
    const products = await this.repository.list();
    return products
      .filter((product) => filter.category === undefined || product.category === filter.category)
      .filter((product) => filter.active === undefined || product.isActive === filter.active)
      .filter((product) => filter.query === undefined || matchesQuery(product, filter.query))
      .sort((a, b) => {
        const byName = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        return byName || a.id.localeCompare(b.id, undefined, { sensitivity: 'base' });
      })
      .map(cloneProduct);
  }

  async archiveProduct(id: string): Promise<Product> {
    const existing = await this.requireProduct(id);
    if (!existing.isActive) return cloneProduct(existing);

    await this.componentRelationshipGuard?.assertProductCanArchive(existing.id);
    const archived = { ...existing, isActive: false };
    await this.repository.replace(archived);
    return cloneProduct(archived);
  }

  private async validateMixReference(product: Product): Promise<void> {
    if (!product.mixPresetId) return;

    const preset = await this.mixPresetRepository.findById(product.mixPresetId);
    if (!preset) {
      throw new ProductApplicationError(
        'MIX_PRESET_NOT_FOUND',
        `Mix preset not found: ${product.mixPresetId}.`,
        { productId: product.id, mixPresetId: product.mixPresetId },
      );
    }

    if (!isMixPresetCompatibleWithCategory(preset, product.category)) {
      throw new ProductApplicationError(
        'MIX_PRESET_CATEGORY_MISMATCH',
        `Mix preset ${preset.id} is not compatible with product category ${product.category}.`,
        { productId: product.id, mixPresetId: preset.id },
      );
    }

    if (product.isActive && !preset.isActive) {
      throw new ProductApplicationError(
        'MIX_PRESET_INACTIVE',
        `Active product ${product.id} cannot use archived mix preset ${preset.id}.`,
        { productId: product.id, mixPresetId: preset.id },
      );
    }
  }

  private async requireProduct(id: string): Promise<Product> {
    const product = await this.repository.findById(id);
    if (!product) {
      throw new ProductApplicationError('PRODUCT_NOT_FOUND', `Product not found: ${id.trim()}.`, {
        productId: id.trim(),
      });
    }
    return product;
  }

  private assertUniqueIdentity(candidate: Product, all: Product[], currentId?: string): void {
    const currentKey = currentId ? comparable(currentId) : undefined;
    const candidateId = comparable(candidate.id);
    const candidateName = comparable(candidate.name);

    if (
      all.some(
        (product) => comparable(product.id) === candidateId && comparable(product.id) !== currentKey,
      )
    ) {
      throw new ProductApplicationError(
        'DUPLICATE_PRODUCT_ID',
        `Product ID already exists: ${candidate.id}.`,
        { productId: candidate.id },
      );
    }

    if (
      all.some(
        (product) => comparable(product.name) === candidateName && comparable(product.id) !== currentKey,
      )
    ) {
      throw new ProductApplicationError(
        'DUPLICATE_PRODUCT_NAME',
        `Product name already exists: ${candidate.name}.`,
        { productId: candidate.id },
      );
    }
  }
}

export type ProductMixReference = Pick<MixPreset, 'id' | 'isActive' | 'compatibleCategories'>;
