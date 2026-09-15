import {
  cloneProductFinancialProfile,
  normalizeProductFinancialProfile,
  type ProductFinancialProfile,
  validateProductFinancialProfileContract,
} from '../../domain/productFinancialProfile';
import { validatePricingPolicy } from '../../domain/pricing';
import type { ProductRepository } from '../products/ProductRepository';
import type { ProductFinancialProfileRepository } from './ProductFinancialProfileRepository';

export interface ProductFinancialProfileListFilter {
  productId?: string;
  query?: string;
}

export type ProductFinancialProfileApplicationErrorCode = 'PRODUCT_NOT_FOUND';

export class ProductFinancialProfileApplicationError extends Error {
  readonly code: ProductFinancialProfileApplicationErrorCode;
  readonly productId?: string;

  constructor(
    code: ProductFinancialProfileApplicationErrorCode,
    message: string,
    context: { productId?: string } = {},
  ) {
    super(message);
    this.name = 'ProductFinancialProfileApplicationError';
    this.code = code;
    this.productId = context.productId;
  }
}

function comparable(value: string): string {
  return value.trim().toLowerCase();
}

function matchesQuery(profile: ProductFinancialProfile, query: string): boolean {
  const normalized = comparable(query);
  if (!normalized) return true;

  return [
    profile.productId,
    profile.notes ?? '',
    profile.pricingPolicy?.method ?? '',
  ].some((value) => value.toLowerCase().includes(normalized));
}

export class ProductFinancialProfileService {
  constructor(
    private readonly repository: ProductFinancialProfileRepository,
    private readonly products: ProductRepository,
  ) {}

  async upsertProfile(input: ProductFinancialProfile): Promise<ProductFinancialProfile> {
    const normalized = normalizeProductFinancialProfile(input);
    validateProductFinancialProfileContract(normalized);
    if (normalized.pricingPolicy !== null) {
      validatePricingPolicy(normalized.pricingPolicy);
    }

    const product = await this.products.findById(normalized.productId);
    if (!product) {
      throw new ProductFinancialProfileApplicationError(
        'PRODUCT_NOT_FOUND',
        `Product not found for ProductFinancialProfile: ${normalized.productId}.`,
        { productId: normalized.productId },
      );
    }

    const profile = normalizeProductFinancialProfile({
      ...normalized,
      productId: product.id,
    });

    await this.repository.upsert(profile);
    return cloneProductFinancialProfile(profile);
  }

  async getProfile(productId: string): Promise<ProductFinancialProfile | null> {
    const profile = await this.repository.findByProductId(productId);
    return profile ? cloneProductFinancialProfile(profile) : null;
  }

  async listProfiles(
    filter: ProductFinancialProfileListFilter = {},
  ): Promise<ProductFinancialProfile[]> {
    const productKey = filter.productId ? comparable(filter.productId) : undefined;

    return (await this.repository.list())
      .filter(
        (profile) =>
          productKey === undefined || comparable(profile.productId) === productKey,
      )
      .filter(
        (profile) => filter.query === undefined || matchesQuery(profile, filter.query),
      )
      .sort((left, right) =>
        left.productId.localeCompare(right.productId, undefined, { sensitivity: 'base' }),
      )
      .map(cloneProductFinancialProfile);
  }
}
