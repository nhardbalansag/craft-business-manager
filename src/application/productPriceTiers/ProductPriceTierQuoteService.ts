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

export type ProductPriceTierQuoteIssueCode =
  | 'COST_PRODUCT_MISMATCH'
  | 'UPSTREAM_COST_PARTIAL'
  | 'UPSTREAM_COST_NOT_READY'
  | 'READY_COST_INVALID'
  | 'TIER_PRODUCT_MISMATCH'
  | 'ECONOMICS_DERIVATION_FAILED';

export interface ProductPriceTierQuoteIssue {
  code: ProductPriceTierQuoteIssueCode;
  message: string;
  productId: string;
  tierId?: string;
  underlyingCode?: string;
}

export interface ProductPriceTierQuoteLine {
  tier: ProductPriceTier;
  status: ProductPriceTierQuoteStatus;
  economics: ProductPriceTierEconomics | null;
  issues: ProductPriceTierQuoteIssue[];
}

export interface ProductPriceTierQuoteResult {
  productId: string;
  productName: string;
  productIsActive: boolean;
  status: ProductPriceTierQuoteStatus;
  costStatus: FullyLoadedProductUnitCostStatus;
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

function unresolvedLine(
  tier: ProductPriceTier,
  status: ProductPriceTierQuoteStatus,
  issue: ProductPriceTierQuoteIssue,
): ProductPriceTierQuoteLine {
  return {
    tier: cloneProductPriceTier(tier),
    status,
    economics: null,
    issues: [{ ...issue }],
  };
}

/**
 * TP3B tier quote orchestration.
 *
 * This service intentionally does not compare tiers with Default / Single pricing
 * and does not emit below-cost warnings. Those diagnostics are added in TP3C.
 */
export class ProductPriceTierQuoteService {
  constructor(
    private readonly costs: ProductPriceTierQuoteCostProvider,
    private readonly tiers: ProductPriceTierQuoteTierProvider,
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
    const sourceTiers = await this.tiers.listTiersByProduct(canonicalProductId);
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

      try {
        return {
          tier: cloneProductPriceTier(tier),
          status: 'ready',
          economics: cloneEconomics(
            deriveProductPriceTierEconomics(authoritativeCost, tier),
          ),
          issues: [],
        };
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
    });

    let status: ProductPriceTierQuoteStatus;
    if (contradiction) {
      status = 'not-ready';
    } else if (cost.status === 'partial') {
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
      knownFullyLoadedUnitCostSubtotal: cost.knownFullyLoadedUnitCostSubtotal,
      totalFullyLoadedUnitCost: cost.totalFullyLoadedUnitCost,
      fullyLoadedUnitCost: structuredClone(cost),
      tiers: quotedTiers.map((line) => ({
        tier: cloneProductPriceTier(line.tier),
        status: line.status,
        economics: cloneEconomics(line.economics),
        issues: line.issues.map((issue) => ({ ...issue })),
      })),
      issues: issues.map((issue) => ({ ...issue })),
    };
  }
}
