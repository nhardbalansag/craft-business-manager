import {
  deriveProductPriceTierEconomics,
  type ProductPriceTierEconomics,
} from '../../domain/productPriceTierEconomics';
import {
  cloneProductPriceTier,
  ProductPriceTierError,
  type ProductPriceTier,
} from '../../domain/productPriceTiers';
import { PricingError } from '../../domain/pricing';
import {
  FullyLoadedProductUnitCostServiceError,
  type FullyLoadedProductUnitCostResult,
  type FullyLoadedProductUnitCostStatus,
} from '../productCosts/FullyLoadedProductUnitCostService';

export type ProductPriceTierQuoteStatus = 'ready' | 'partial' | 'not-ready';
export type ProductPriceTierDefaultPricingStatus = 'ready' | 'partial' | 'not-ready';

export type ProductPriceTierQuoteIssueCode =
  | 'COST_PRODUCT_MISMATCH'
  | 'UPSTREAM_COST_PARTIAL'
  | 'UPSTREAM_COST_NOT_READY'
  | 'READY_COST_INVALID'
  | 'TIER_PRODUCT_MISMATCH'
  | 'ECONOMICS_DERIVATION_FAILED'
  | 'DEFAULT_QUOTE_PRODUCT_MISMATCH'
  | 'DEFAULT_QUOTE_PARTIAL'
  | 'DEFAULT_QUOTE_NOT_READY'
  | 'DEFAULT_SELLING_PRICE_INVALID'
  | 'DEFAULT_COMPARISON_INVALID';

export type ProductPriceTierQuoteWarningCode = 'BELOW_COST';

export interface ProductPriceTierQuoteIssue {
  code: ProductPriceTierQuoteIssueCode;
  message: string;
  productId: string;
  tierId?: string;
  underlyingCode?: string;
}

export interface ProductPriceTierQuoteWarning {
  code: ProductPriceTierQuoteWarningCode;
  message: string;
  productId: string;
  tierId: string;
}

export interface ProductPriceTierDefaultComparison {
  defaultSellingPrice: number;
  defaultEquivalentOfferPrice: number;
  discountAmountVsDefault: number;
  discountRateVsDefault: number | null;
}

export interface ProductPriceTierQuoteLine {
  tier: ProductPriceTier;
  status: ProductPriceTierQuoteStatus;
  economics: ProductPriceTierEconomics | null;
  defaultComparison: ProductPriceTierDefaultComparison | null;
  belowCost: boolean | null;
  warnings: ProductPriceTierQuoteWarning[];
  issues: ProductPriceTierQuoteIssue[];
}

export interface ProductPriceTierQuoteResult {
  productId: string;
  productName: string;
  productIsActive: boolean;
  status: ProductPriceTierQuoteStatus;
  costStatus: FullyLoadedProductUnitCostStatus;
  defaultPricingStatus: ProductPriceTierDefaultPricingStatus;
  defaultSellingPrice: number | null;
  knownFullyLoadedUnitCostSubtotal: number | null;
  totalFullyLoadedUnitCost: number | null;
  fullyLoadedUnitCost: FullyLoadedProductUnitCostResult;
  tiers: ProductPriceTierQuoteLine[];
  issues: ProductPriceTierQuoteIssue[];
}

export type ProductPriceTierQuoteServiceErrorCode = 'PRODUCT_NOT_FOUND';

export class ProductPriceTierQuoteServiceError extends Error {
  readonly code: ProductPriceTierQuoteServiceErrorCode;
  readonly productId: string;

  constructor(
    code: ProductPriceTierQuoteServiceErrorCode,
    message: string,
    productId: string,
  ) {
    super(message);
    this.name = 'ProductPriceTierQuoteServiceError';
    this.code = code;
    this.productId = productId;
  }
}

export interface ProductPriceTierQuoteCostProvider {
  costProduct(productId: string): Promise<FullyLoadedProductUnitCostResult>;
}

export interface ProductPriceTierQuoteTierProvider {
  listTiersByProduct(productId: string): Promise<ProductPriceTier[]>;
}

export interface ProductPriceTierDefaultPricingEvidence {
  productId: string;
  status: ProductPriceTierDefaultPricingStatus;
  sellingPrice: number | null;
}

export interface ProductPriceTierDefaultPricingProvider {
  quoteProduct(productId: string): Promise<ProductPriceTierDefaultPricingEvidence>;
}

function comparable(value: string): string {
  return value.trim().toLowerCase();
}

function finiteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function cloneEconomics(
  economics: ProductPriceTierEconomics | null,
): ProductPriceTierEconomics | null {
  return economics ? { ...economics } : null;
}

function cloneComparison(
  comparison: ProductPriceTierDefaultComparison | null,
): ProductPriceTierDefaultComparison | null {
  return comparison ? { ...comparison } : null;
}

function unresolvedLine(
  tier: ProductPriceTier,
  status: ProductPriceTierQuoteStatus,
  issue: ProductPriceTierQuoteIssue,
): ProductPriceTierQuoteLine {
  return {
    tier: cloneProductPriceTier(tier),
    status,
    economics: null,
    defaultComparison: null,
    belowCost: null,
    warnings: [],
    issues: [{ ...issue }],
  };
}

function deriveDefaultComparison(
  defaultSellingPrice: number,
  economics: ProductPriceTierEconomics,
): ProductPriceTierDefaultComparison | null {
  const defaultEquivalentOfferPrice =
    defaultSellingPrice * economics.unitsPerOffer;
  const discountAmountVsDefault =
    defaultEquivalentOfferPrice - economics.offerSellingPrice;

  if (
    !Number.isFinite(defaultEquivalentOfferPrice) ||
    !Number.isFinite(discountAmountVsDefault)
  ) {
    return null;
  }

  const discountRateVsDefault =
    defaultEquivalentOfferPrice === 0
      ? null
      : discountAmountVsDefault / defaultEquivalentOfferPrice;

  if (
    discountRateVsDefault !== null &&
    !Number.isFinite(discountRateVsDefault)
  ) {
    return null;
  }

  return {
    defaultSellingPrice,
    defaultEquivalentOfferPrice,
    discountAmountVsDefault,
    discountRateVsDefault,
  };
}

/**
 * TP3C complete tier quote orchestration.
 *
 * Tier economics continue to use the authoritative fully loaded unit cost.
 * Default / Single pricing is consumed only as additive comparison evidence and
 * never changes ProductPricingQuoteService semantics.
 */
export class ProductPriceTierQuoteService {
  constructor(
    private readonly costs: ProductPriceTierQuoteCostProvider,
    private readonly tiers: ProductPriceTierQuoteTierProvider,
    private readonly defaultPricing: ProductPriceTierDefaultPricingProvider,
  ) {}

  async quoteProduct(productId: string): Promise<ProductPriceTierQuoteResult> {
    const requestedProductId = productId.trim();

    let cost: FullyLoadedProductUnitCostResult;
    try {
      cost = await this.costs.costProduct(requestedProductId);
    } catch (error) {
      if (error instanceof FullyLoadedProductUnitCostServiceError) {
        throw new ProductPriceTierQuoteServiceError(
          'PRODUCT_NOT_FOUND',
          error.message,
          error.productId,
        );
      }
      throw error;
    }

    const canonicalProductId = cost.productId;
    const [sourceTiers, defaultQuote] = await Promise.all([
      this.tiers.listTiersByProduct(canonicalProductId),
      this.defaultPricing.quoteProduct(canonicalProductId),
    ]);

    const issues: ProductPriceTierQuoteIssue[] = [];
    let contradiction = false;

    if (comparable(requestedProductId) !== comparable(canonicalProductId)) {
      contradiction = true;
      issues.push({
        code: 'COST_PRODUCT_MISMATCH',
        message: `Requested Product ${requestedProductId}, but fully loaded cost evidence belongs to ${canonicalProductId}.`,
        productId: requestedProductId,
      });
    }

    const authoritativeCost =
      cost.status === 'ready' &&
      cost.totalFullyLoadedUnitCost !== null &&
      finiteNonNegative(cost.totalFullyLoadedUnitCost)
        ? cost.totalFullyLoadedUnitCost
        : null;

    if (cost.status === 'partial') {
      issues.push({
        code: 'UPSTREAM_COST_PARTIAL',
        message: `Product ${canonicalProductId} has only partial fully loaded unit-cost evidence for tier pricing.`,
        productId: canonicalProductId,
      });
    } else if (cost.status === 'not-ready') {
      issues.push({
        code: 'UPSTREAM_COST_NOT_READY',
        message: `Product ${canonicalProductId} has no ready fully loaded unit-cost basis for tier pricing.`,
        productId: canonicalProductId,
      });
    } else if (authoritativeCost === null) {
      contradiction = true;
      issues.push({
        code: 'READY_COST_INVALID',
        message: `Product ${canonicalProductId} reports ready cost status without a valid authoritative fully loaded unit cost.`,
        productId: canonicalProductId,
      });
    }

    let defaultSellingPrice: number | null = null;
    let defaultEvidenceContradictory = false;

    if (comparable(defaultQuote.productId) !== comparable(canonicalProductId)) {
      contradiction = true;
      defaultEvidenceContradictory = true;
      issues.push({
        code: 'DEFAULT_QUOTE_PRODUCT_MISMATCH',
        message: `Default / Single pricing evidence belongs to ${defaultQuote.productId}, not Product ${canonicalProductId}.`,
        productId: canonicalProductId,
      });
    } else if (defaultQuote.status === 'ready') {
      if (
        defaultQuote.sellingPrice === null ||
        !finiteNonNegative(defaultQuote.sellingPrice)
      ) {
        contradiction = true;
        defaultEvidenceContradictory = true;
        issues.push({
          code: 'DEFAULT_SELLING_PRICE_INVALID',
          message: `Product ${canonicalProductId} reports ready Default / Single pricing without a valid selling price.`,
          productId: canonicalProductId,
        });
      } else {
        defaultSellingPrice = defaultQuote.sellingPrice;
      }
    }

    const quotedTiers = sourceTiers.map((tier): ProductPriceTierQuoteLine => {
      if (comparable(tier.productId) !== comparable(canonicalProductId)) {
        contradiction = true;
        const issue: ProductPriceTierQuoteIssue = {
          code: 'TIER_PRODUCT_MISMATCH',
          message: `Product price tier ${tier.id} belongs to ${tier.productId}, not Product ${canonicalProductId}.`,
          productId: canonicalProductId,
          tierId: tier.id,
        };
        issues.push({ ...issue });
        return unresolvedLine(tier, 'not-ready', issue);
      }

      if (cost.status === 'partial') {
        return unresolvedLine(tier, 'partial', {
          code: 'UPSTREAM_COST_PARTIAL',
          message: `Product price tier ${tier.id} cannot derive authoritative economics until Product ${canonicalProductId} has ready fully loaded unit cost.`,
          productId: canonicalProductId,
          tierId: tier.id,
        });
      }

      if (cost.status === 'not-ready') {
        return unresolvedLine(tier, 'not-ready', {
          code: 'UPSTREAM_COST_NOT_READY',
          message: `Product price tier ${tier.id} has no authoritative fully loaded unit cost for economics derivation.`,
          productId: canonicalProductId,
          tierId: tier.id,
        });
      }

      if (authoritativeCost === null) {
        return unresolvedLine(tier, 'not-ready', {
          code: 'READY_COST_INVALID',
          message: `Product price tier ${tier.id} cannot derive economics from an invalid ready-state unit cost.`,
          productId: canonicalProductId,
          tierId: tier.id,
        });
      }

      let economics: ProductPriceTierEconomics;
      try {
        economics = deriveProductPriceTierEconomics(authoritativeCost, tier);
      } catch (error) {
        if (error instanceof PricingError || error instanceof ProductPriceTierError) {
          contradiction = true;
          const issue: ProductPriceTierQuoteIssue = {
            code: 'ECONOMICS_DERIVATION_FAILED',
            message: error.message,
            productId: canonicalProductId,
            tierId: tier.id,
            underlyingCode: error.code,
          };
          issues.push({ ...issue });
          return unresolvedLine(tier, 'not-ready', issue);
        }
        throw error;
      }

      const belowCost = economics.profitPerOffer < 0;
      const warnings: ProductPriceTierQuoteWarning[] = belowCost
        ? [{
            code: 'BELOW_COST',
            message: `Product price tier ${tier.id} sells below its current fully loaded offer cost.`,
            productId: canonicalProductId,
            tierId: tier.id,
          }]
        : [];

      if (defaultEvidenceContradictory) {
        return {
          tier: cloneProductPriceTier(tier),
          status: 'not-ready',
          economics: cloneEconomics(economics),
          defaultComparison: null,
          belowCost,
          warnings,
          issues: [{
            code: comparable(defaultQuote.productId) !== comparable(canonicalProductId)
              ? 'DEFAULT_QUOTE_PRODUCT_MISMATCH'
              : 'DEFAULT_SELLING_PRICE_INVALID',
            message: comparable(defaultQuote.productId) !== comparable(canonicalProductId)
              ? `Default / Single pricing evidence does not belong to Product ${canonicalProductId}.`
              : `Default / Single selling price is invalid for Product ${canonicalProductId}.`,
            productId: canonicalProductId,
            tierId: tier.id,
          }],
        };
      }

      if (defaultQuote.status === 'partial') {
        return {
          tier: cloneProductPriceTier(tier),
          status: 'partial',
          economics: cloneEconomics(economics),
          defaultComparison: null,
          belowCost,
          warnings,
          issues: [{
            code: 'DEFAULT_QUOTE_PARTIAL',
            message: `Product price tier ${tier.id} has ready tier economics, but Default / Single pricing is only partial so discount comparison is unavailable.`,
            productId: canonicalProductId,
            tierId: tier.id,
          }],
        };
      }

      if (defaultQuote.status === 'not-ready') {
        return {
          tier: cloneProductPriceTier(tier),
          status: 'partial',
          economics: cloneEconomics(economics),
          defaultComparison: null,
          belowCost,
          warnings,
          issues: [{
            code: 'DEFAULT_QUOTE_NOT_READY',
            message: `Product price tier ${tier.id} has ready tier economics, but Default / Single pricing is not ready so discount comparison is unavailable.`,
            productId: canonicalProductId,
            tierId: tier.id,
          }],
        };
      }

      const comparison = deriveDefaultComparison(defaultSellingPrice!, economics);
      if (!comparison) {
        contradiction = true;
        const issue: ProductPriceTierQuoteIssue = {
          code: 'DEFAULT_COMPARISON_INVALID',
          message: `Product price tier ${tier.id} produced invalid Default / Single comparison values.`,
          productId: canonicalProductId,
          tierId: tier.id,
        };
        issues.push({ ...issue });
        return {
          tier: cloneProductPriceTier(tier),
          status: 'not-ready',
          economics: cloneEconomics(economics),
          defaultComparison: null,
          belowCost,
          warnings,
          issues: [{ ...issue }],
        };
      }

      return {
        tier: cloneProductPriceTier(tier),
        status: 'ready',
        economics: cloneEconomics(economics),
        defaultComparison: cloneComparison(comparison),
        belowCost,
        warnings,
        issues: [],
      };
    });

    let status: ProductPriceTierQuoteStatus;
    if (contradiction || quotedTiers.some((line) => line.status === 'not-ready')) {
      status = 'not-ready';
    } else if (
      cost.status === 'partial' ||
      quotedTiers.some((line) => line.status === 'partial')
    ) {
      status = 'partial';
    } else if (cost.status === 'not-ready') {
      status = 'not-ready';
    } else {
      status = 'ready';
    }

    return {
      productId: canonicalProductId,
      productName: cost.productName,
      productIsActive: cost.productIsActive,
      status,
      costStatus: cost.status,
      defaultPricingStatus: defaultQuote.status,
      defaultSellingPrice,
      knownFullyLoadedUnitCostSubtotal: cost.knownFullyLoadedUnitCostSubtotal,
      totalFullyLoadedUnitCost: cost.totalFullyLoadedUnitCost,
      fullyLoadedUnitCost: structuredClone(cost),
      tiers: quotedTiers.map((line) => ({
        tier: cloneProductPriceTier(line.tier),
        status: line.status,
        economics: cloneEconomics(line.economics),
        defaultComparison: cloneComparison(line.defaultComparison),
        belowCost: line.belowCost,
        warnings: line.warnings.map((warning) => ({ ...warning })),
        issues: line.issues.map((issue) => ({ ...issue })),
      })),
      issues: issues.map((issue) => ({ ...issue })),
    };
  }
}
