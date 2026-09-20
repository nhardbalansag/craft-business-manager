import type {
  ProductPriceTierQuoteResult,
} from '../productPriceTiers/ProductPriceTierQuoteService';
import type {
  ProductPricingQuoteResult,
} from './ProductPricingQuoteService';

export type ProductPricingQuoteIntegrationIssueCode =
  | 'TIER_PRICING_UNAVAILABLE'
  | 'TIER_PRICING_PRODUCT_MISMATCH';

export interface ProductPricingQuoteIntegrationIssue {
  code: ProductPricingQuoteIntegrationIssueCode;
  message: string;
  productId: string;
}

export interface IntegratedProductPricingQuoteResult
  extends ProductPricingQuoteResult {
  /**
   * Additive Package / Bulk / Custom alternatives.
   *
   * Null means the tier quote boundary failed or returned contradictory Product
   * identity. The inherited Default / Single fields remain authoritative and
   * keep exactly the same meaning as ProductPricingQuoteResult.
   */
  tierPricing: ProductPriceTierQuoteResult | null;
  integrationIssues: ProductPricingQuoteIntegrationIssue[];
}

export interface ProductPricingQuoteIntegrationDefaultProvider {
  quoteProduct(productId: string): Promise<ProductPricingQuoteResult>;
}

export interface ProductPricingQuoteIntegrationTierProvider {
  quoteProduct(productId: string): Promise<ProductPriceTierQuoteResult>;
}

function comparable(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'The saved Product price-tier alternatives could not be loaded.';
}

/**
 * TP7 additive pricing quote integration.
 *
 * This service deliberately wraps, rather than replaces or changes,
 * ProductPricingQuoteService. All inherited fields are the existing
 * Default / Single quote. Tier pricing is exposed only as a nested additive
 * alternative set. No tier is selected for Production or order calculations.
 */
export class ProductPricingQuoteIntegrationService {
  constructor(
    private readonly defaultPricing: ProductPricingQuoteIntegrationDefaultProvider,
    private readonly tierPricing: ProductPricingQuoteIntegrationTierProvider,
  ) {}

  async quoteProduct(productId: string): Promise<IntegratedProductPricingQuoteResult> {
    const defaultQuote = await this.defaultPricing.quoteProduct(productId);
    const integrationIssues: ProductPricingQuoteIntegrationIssue[] = [];
    let tierPricing: ProductPriceTierQuoteResult | null = null;

    try {
      const candidate = await this.tierPricing.quoteProduct(defaultQuote.productId);

      if (comparable(candidate.productId) !== comparable(defaultQuote.productId)) {
        integrationIssues.push({
          code: 'TIER_PRICING_PRODUCT_MISMATCH',
          message:
            `Tier pricing evidence belongs to Product ${candidate.productId}, not Default / Single Product ${defaultQuote.productId}.`,
          productId: defaultQuote.productId,
        });
      } else {
        tierPricing = structuredClone(candidate);
      }
    } catch (error) {
      integrationIssues.push({
        code: 'TIER_PRICING_UNAVAILABLE',
        message: errorMessage(error),
        productId: defaultQuote.productId,
      });
    }

    return {
      ...structuredClone(defaultQuote),
      tierPricing,
      integrationIssues: integrationIssues.map((issue) => ({ ...issue })),
    };
  }
}
