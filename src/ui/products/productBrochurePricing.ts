import { productPriceResolutionService, productPriceTierService } from '../../application/session';
import type {
  ProductPriceResolutionRequest,
  ProductPriceResolutionResult,
} from '../../application/pricing/ProductPriceResolutionService';
import type { ProductPriceTier } from '../../domain/productPriceTiers';

export interface BrochurePriceOption {
  id: string;
  label: string;
  quantity: number;
  unitPrice: number;
  detail: string;
}

export interface BrochurePricingProvider {
  listTiersByProduct(productId: string): Promise<ProductPriceTier[]>;
  resolve(request: ProductPriceResolutionRequest): Promise<ProductPriceResolutionResult>;
  resolveMany?(requests: readonly ProductPriceResolutionRequest[]): Promise<ProductPriceResolutionResult[]>;
}

const defaultProvider: BrochurePricingProvider = {
  listTiersByProduct: (productId) => productPriceTierService.listTiersByProduct(productId),
  resolve: (request) => productPriceResolutionService.resolve(request),
  resolveMany: (requests) => productPriceResolutionService.resolveMany(requests),
};

function readyUnitPrice(result: ProductPriceResolutionResult | null): number | null {
  return result?.status === 'ready' &&
    result.unitSellingPrice !== null &&
    Number.isFinite(result.unitSellingPrice) &&
    result.unitSellingPrice >= 0
    ? result.unitSellingPrice
    : null;
}

/**
 * Brochure prices must come from the authoritative quantity-aware pricing
 * service, never directly from tier pricing source inputs or sample prices.
 */
export async function loadProductBrochurePrices(
  productId: string,
  provider: BrochurePricingProvider = defaultProvider,
): Promise<BrochurePriceOption[]> {
  const tiers = (await provider.listTiersByProduct(productId))
    .filter((tier) => tier.isActive)
    .sort((a, b) =>
      a.minimumOrderQuantity - b.minimumOrderQuantity ||
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  const requests: Array<{ id: string; label: string; quantity: number; detail: string; tierId?: string }> = [
    { id: 'single', label: 'SINGLE', quantity: 1, detail: 'Per piece' },
    ...tiers.map((tier) => ({
      id: tier.id,
      label: tier.minimumOrderQuantity <= 1
        ? tier.name.toUpperCase()
        : String(tier.minimumOrderQuantity) + '+ PCS',
      quantity: tier.minimumOrderQuantity,
      detail: tier.name,
      tierId: tier.id,
    })),
  ];

  const priceRequests = requests.map((candidate) => ({
    productId, quantity: candidate.quantity,
    ...(candidate.tierId ? { selectedTierId: candidate.tierId } : {}),
  }));
  const batch = provider.resolveMany ? await provider.resolveMany(priceRequests) : null;
  const results = await Promise.all(requests.map(async (candidate, index) => {
    try {
      const result = batch ? batch[index] : await provider.resolve(priceRequests[index]);
      const price = readyUnitPrice(result);
      return price === null ? null : {
        id: candidate.id,
        label: candidate.label,
        quantity: candidate.quantity,
        unitPrice: price,
        detail: candidate.detail,
      };
    } catch {
      return null;
    }
  }));

  return results.filter((result): result is BrochurePriceOption => result !== null);
}
