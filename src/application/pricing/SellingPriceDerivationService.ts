import type { ProductFinancialProfile } from '../../domain/productFinancialProfile';
import {
  PricingError,
  clonePricingPolicy,
  deriveSellingPrice,
  validatePricingPolicy,
  type PricingPolicy,
} from '../../domain/pricing';
import type {
  FullyLoadedProductUnitCostResult,
  FullyLoadedProductUnitCostStatus,
} from '../productCosts/FullyLoadedProductUnitCostService';

export type SellingPriceDerivationStatus = 'ready' | 'partial' | 'not-ready';

export type SellingPriceDerivationIssueCode =
  | 'COST_PARTIAL'
  | 'COST_NOT_READY'
  | 'COST_PRODUCT_MISMATCH'
  | 'COST_TOTAL_INVALID'
  | 'FINANCIAL_PROFILE_MISSING'
  | 'FINANCIAL_PROFILE_PRODUCT_MISMATCH'
  | 'PRICING_POLICY_MISSING'
  | 'PRICING_POLICY_INVALID'
  | 'SELLING_PRICE_DERIVATION_FAILED';

export interface SellingPriceDerivationIssue {
  code: SellingPriceDerivationIssueCode;
  message: string;
  productId: string;
  underlyingCode?: string;
}

export interface SellingPriceDerivationResult {
  productId: string;
  productName: string;
  productIsActive: boolean;
  status: SellingPriceDerivationStatus;
  costStatus: FullyLoadedProductUnitCostStatus;
  totalFullyLoadedUnitCost: number | null;
  knownFullyLoadedUnitCostSubtotal: number | null;
  pricingPolicy: PricingPolicy | null;
  sellingPrice: number | null;
  issues: SellingPriceDerivationIssue[];
}

export interface SellingPriceCostProvider {
  costProduct(productId: string): Promise<FullyLoadedProductUnitCostResult>;
}

export interface SellingPriceFinancialProfileProvider {
  getProfile(productId: string): Promise<ProductFinancialProfile | null>;
}

function comparable(value: string): string {
  return value.trim().toLowerCase();
}

function finiteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

/**
 * Phase 4.3A authoritative Product selling-price derivation.
 *
 * Only a ready Phase 4.2C totalFullyLoadedUnitCost may be priced. Formula and
 * policy validation remain owned by the Phase 4.1B pricing domain.
 */
export class SellingPriceDerivationService {
  constructor(
    private readonly costs: SellingPriceCostProvider,
    private readonly financialProfiles: SellingPriceFinancialProfileProvider,
  ) {}

  async deriveForProduct(productId: string): Promise<SellingPriceDerivationResult> {
    const requestedProductId = productId.trim();
    const cost = await this.costs.costProduct(requestedProductId);
    const issues: SellingPriceDerivationIssue[] = [];

    const costIdentityMatches = comparable(cost.productId) === comparable(requestedProductId);
    if (!costIdentityMatches) {
      issues.push({
        code: 'COST_PRODUCT_MISMATCH',
        message: `Requested Product ${requestedProductId}, but fully loaded cost evidence belongs to ${cost.productId}.`,
        productId: requestedProductId,
      });

      return {
        productId: cost.productId,
        productName: cost.productName,
        productIsActive: cost.productIsActive,
        status: 'not-ready',
        costStatus: cost.status,
        totalFullyLoadedUnitCost: cost.totalFullyLoadedUnitCost,
        knownFullyLoadedUnitCostSubtotal: cost.knownFullyLoadedUnitCostSubtotal,
        pricingPolicy: null,
        sellingPrice: null,
        issues,
      };
    }

    if (cost.status === 'partial') {
      issues.push({
        code: 'COST_PARTIAL',
        message: `Product ${cost.productId} has only partial fully loaded unit-cost evidence.`,
        productId: cost.productId,
      });
    } else if (cost.status === 'not-ready') {
      issues.push({
        code: 'COST_NOT_READY',
        message: `Product ${cost.productId} has no ready fully loaded unit-cost basis for pricing.`,
        productId: cost.productId,
      });
    }

    const priceableCost =
      cost.status === 'ready' &&
      cost.totalFullyLoadedUnitCost !== null &&
      finiteNonNegative(cost.totalFullyLoadedUnitCost)
        ? cost.totalFullyLoadedUnitCost
        : null;

    if (cost.status === 'ready' && priceableCost === null) {
      issues.push({
        code: 'COST_TOTAL_INVALID',
        message: `Product ${cost.productId} reports ready cost status without a valid authoritative fully loaded unit cost.`,
        productId: cost.productId,
      });
    }

    const profile = await this.financialProfiles.getProfile(cost.productId);
    let pricingPolicy: PricingPolicy | null = null;
    let pricingPolicyReady = false;

    if (!profile) {
      issues.push({
        code: 'FINANCIAL_PROFILE_MISSING',
        message: `Product ${cost.productId} has no financial profile for pricing.`,
        productId: cost.productId,
      });
    } else if (comparable(profile.productId) !== comparable(cost.productId)) {
      issues.push({
        code: 'FINANCIAL_PROFILE_PRODUCT_MISMATCH',
        message: `Financial profile belongs to ${profile.productId}, not Product ${cost.productId}.`,
        productId: cost.productId,
      });
    } else if (profile.pricingPolicy === null) {
      issues.push({
        code: 'PRICING_POLICY_MISSING',
        message: `Product ${cost.productId} has no configured pricing policy.`,
        productId: cost.productId,
      });
    } else {
      try {
        validatePricingPolicy(profile.pricingPolicy);
        pricingPolicy = clonePricingPolicy(profile.pricingPolicy);
        pricingPolicyReady = true;
      } catch (error) {
        if (error instanceof PricingError) {
          issues.push({
            code: 'PRICING_POLICY_INVALID',
            message: error.message,
            productId: cost.productId,
            underlyingCode: error.code,
          });
        } else {
          throw error;
        }
      }
    }

    let sellingPrice: number | null = null;
    if (priceableCost !== null && pricingPolicyReady && pricingPolicy !== null) {
      try {
        sellingPrice = deriveSellingPrice(priceableCost, pricingPolicy);
      } catch (error) {
        if (error instanceof PricingError) {
          issues.push({
            code: 'SELLING_PRICE_DERIVATION_FAILED',
            message: error.message,
            productId: cost.productId,
            underlyingCode: error.code,
          });
          sellingPrice = null;
        } else {
          throw error;
        }
      }
    }

    let status: SellingPriceDerivationStatus;
    if (sellingPrice !== null) {
      status = 'ready';
    } else if (cost.status === 'not-ready' || (cost.status === 'ready' && priceableCost === null)) {
      status = 'not-ready';
    } else {
      status = 'partial';
    }

    return {
      productId: cost.productId,
      productName: cost.productName,
      productIsActive: cost.productIsActive,
      status,
      costStatus: cost.status,
      totalFullyLoadedUnitCost: cost.totalFullyLoadedUnitCost,
      knownFullyLoadedUnitCostSubtotal: cost.knownFullyLoadedUnitCostSubtotal,
      pricingPolicy: pricingPolicy ? clonePricingPolicy(pricingPolicy) : null,
      sellingPrice,
      issues: issues.map((issue) => ({ ...issue })),
    };
  }
}
