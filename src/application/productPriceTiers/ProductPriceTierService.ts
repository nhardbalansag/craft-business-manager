import {
  cloneProductPriceTier,
  nextProductPriceTierId,
  normalizeProductPriceTier,
  type ProductPriceTier,
  type ProductPriceTierKind,
  type ProductPriceTierPriceBasis,
  validateProductPriceTierContract,
} from '../../domain/productPriceTiers';
import type { Product } from '../../domain/products';
import type { ProductRepository } from '../products/ProductRepository';
import type { ProductPriceTierRepository } from './ProductPriceTierRepository';

export interface ProductPriceTierListFilter {
  productId?: string;
  kind?: ProductPriceTierKind;
  priceBasis?: ProductPriceTierPriceBasis;
  active?: boolean;
  query?: string;
}

export type ProductPriceTierCreate = Omit<ProductPriceTier, 'id'>;
export type ProductPriceTierUpdate = Partial<Omit<ProductPriceTier, 'id'>>;

export type ProductPriceTierApplicationErrorCode =
  | 'TIER_NOT_FOUND'
  | 'PRODUCT_NOT_FOUND'
  | 'PRODUCT_INACTIVE';

export class ProductPriceTierApplicationError extends Error {
  readonly code: ProductPriceTierApplicationErrorCode;
  readonly tierId?: string;
  readonly productId?: string;

  constructor(
    code: ProductPriceTierApplicationErrorCode,
    message: string,
    context: { tierId?: string; productId?: string } = {},
  ) {
    super(message);
    this.name = 'ProductPriceTierApplicationError';
    this.code = code;
    this.tierId = context.tierId;
    this.productId = context.productId;
  }
}

function comparable(value: string): string {
  return value.trim().toLowerCase();
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base' });
}

function matchesQuery(tier: ProductPriceTier, query: string): boolean {
  const normalized = comparable(query);
  if (!normalized) return true;

  return [
    tier.id,
    tier.productId,
    tier.name,
    tier.kind,
    tier.priceBasis,
    tier.notes ?? '',
  ].some((value) => value.toLowerCase().includes(normalized));
}

export class ProductPriceTierService {
  constructor(
    private readonly repository: ProductPriceTierRepository,
    private readonly products: ProductRepository,
  ) {}

  async createTier(input: ProductPriceTierCreate): Promise<ProductPriceTier> {
    const all = await this.repository.list();
    const candidate = normalizeProductPriceTier({
      ...input,
      id: nextProductPriceTierId(all.map((tier) => tier.id)),
    });
    validateProductPriceTierContract(candidate);

    const product = await this.requireProduct(candidate.productId, candidate.id);
    if (!product.isActive) {
      throw new ProductPriceTierApplicationError(
        'PRODUCT_INACTIVE',
        `Product price tiers cannot be created for archived Product ${product.id}.`,
        { tierId: candidate.id, productId: product.id },
      );
    }

    const tier = normalizeProductPriceTier({ ...candidate, productId: product.id });
    await this.repository.insert(tier);
    return cloneProductPriceTier(tier);
  }

  async updateTier(id: string, changes: ProductPriceTierUpdate): Promise<ProductPriceTier> {
    const existing = await this.requireTier(id);
    const candidate = normalizeProductPriceTier({ ...existing, ...changes, id: existing.id });
    validateProductPriceTierContract(candidate);

    const product = await this.requireProduct(candidate.productId, existing.id);
    const relationshipChanged =
      comparable(candidate.productId) !== comparable(existing.productId);
    const restoring = !existing.isActive && candidate.isActive;

    if (!product.isActive && (relationshipChanged || restoring)) {
      throw new ProductPriceTierApplicationError(
        'PRODUCT_INACTIVE',
        `Archived Product ${product.id} cannot receive or reactivate a Product price tier.`,
        { tierId: existing.id, productId: product.id },
      );
    }

    const tier = normalizeProductPriceTier({ ...candidate, productId: product.id });
    await this.repository.replace(tier);
    return cloneProductPriceTier(tier);
  }

  async getTier(id: string): Promise<ProductPriceTier | null> {
    const tier = await this.repository.findById(id);
    return tier ? cloneProductPriceTier(tier) : null;
  }

  async listTiers(filter: ProductPriceTierListFilter = {}): Promise<ProductPriceTier[]> {
    const tiers = await this.repository.list();

    return tiers
      .filter(
        (tier) =>
          filter.productId === undefined ||
          comparable(tier.productId) === comparable(filter.productId),
      )
      .filter((tier) => filter.kind === undefined || tier.kind === filter.kind)
      .filter(
        (tier) => filter.priceBasis === undefined || tier.priceBasis === filter.priceBasis,
      )
      .filter((tier) => filter.active === undefined || tier.isActive === filter.active)
      .filter((tier) => filter.query === undefined || matchesQuery(tier, filter.query))
      .sort((left, right) => {
        const byProduct = compareText(left.productId, right.productId);
        if (byProduct) return byProduct;
        if (left.minimumOrderQuantity !== right.minimumOrderQuantity) {
          return left.minimumOrderQuantity - right.minimumOrderQuantity;
        }
        const byName = compareText(left.name, right.name);
        return byName || compareText(left.id, right.id);
      })
      .map(cloneProductPriceTier);
  }

  async listTiersByProduct(productId: string): Promise<ProductPriceTier[]> {
    return this.listTiers({ productId });
  }

  async archiveTier(id: string): Promise<ProductPriceTier> {
    const existing = await this.requireTier(id);
    if (!existing.isActive) return cloneProductPriceTier(existing);

    const archived = { ...existing, isActive: false };
    validateProductPriceTierContract(archived);
    await this.repository.replace(archived);
    return cloneProductPriceTier(archived);
  }

  async restoreTier(id: string): Promise<ProductPriceTier> {
    const existing = await this.requireTier(id);
    if (existing.isActive) return cloneProductPriceTier(existing);

    const product = await this.requireProduct(existing.productId, existing.id);
    if (!product.isActive) {
      throw new ProductPriceTierApplicationError(
        'PRODUCT_INACTIVE',
        `Product price tier ${existing.id} cannot be restored because Product ${product.id} is archived.`,
        { tierId: existing.id, productId: product.id },
      );
    }

    const restored = normalizeProductPriceTier({
      ...existing,
      productId: product.id,
      isActive: true,
    });
    validateProductPriceTierContract(restored);
    await this.repository.replace(restored);
    return cloneProductPriceTier(restored);
  }

  private async requireTier(id: string): Promise<ProductPriceTier> {
    const tier = await this.repository.findById(id);
    if (!tier) {
      throw new ProductPriceTierApplicationError(
        'TIER_NOT_FOUND',
        `Product price tier not found: ${id.trim()}.`,
        { tierId: id.trim() },
      );
    }
    return tier;
  }

  private async requireProduct(productId: string, tierId?: string): Promise<Product> {
    const product = await this.products.findById(productId);
    if (!product) {
      throw new ProductPriceTierApplicationError(
        'PRODUCT_NOT_FOUND',
        `Product not found for Product price tier: ${productId.trim()}.`,
        { tierId, productId: productId.trim() },
      );
    }
    return product;
  }
}
