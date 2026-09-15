import {
  cloneProductFinancialProfile,
  type ProductFinancialProfile,
} from '../../domain/productFinancialProfile';
import { clonePricingPolicy, type PricingPolicy } from '../../domain/pricing';
import {
  FullyLoadedProductUnitCostServiceError,
  type FullyLoadedProductUnitCostResult,
  type FullyLoadedProductUnitCostStatus,
} from '../productCosts/FullyLoadedProductUnitCostService';
import type {
  ProfitMarkupMarginMetricsResult,
  ProfitMarkupMarginMetricsStatus,
} from './ProfitMarkupMarginMetricsService';
import type { SellingPriceDerivationStatus } from './SellingPriceDerivationService';

export type ProductPricingQuoteStatus = 'ready' | 'partial' | 'not-ready';

export type ProductPricingQuoteIssueCode =
  | 'COST_PRODUCT_MISMATCH'
  | 'FINANCIAL_PROFILE_MISSING'
  | 'FINANCIAL_PROFILE_PRODUCT_MISMATCH'
  | 'METRICS_PRODUCT_MISMATCH'
  | 'COST_STATUS_MISMATCH'
  | 'TOTAL_COST_MISMATCH'
  | 'KNOWN_SUBTOTAL_MISMATCH'
  | 'PRICING_POLICY_MISMATCH'
  | 'READY_STATE_INCONSISTENT'
  | 'UPSTREAM_PARTIAL'
  | 'UPSTREAM_NOT_READY';

export interface ProductPricingQuoteIssue {
  code: ProductPricingQuoteIssueCode;
  message: string;
  productId: string;
}

export interface ProductPricingQuoteResult {
  productId: string;
  productName: string;
  productIsActive: boolean;
  status: ProductPricingQuoteStatus;
  costStatus: FullyLoadedProductUnitCostStatus;
  sellingPriceStatus: SellingPriceDerivationStatus;
  metricsStatus: ProfitMarkupMarginMetricsStatus;
  financialProfile: ProductFinancialProfile | null;
  fullyLoadedUnitCost: FullyLoadedProductUnitCostResult;
  unitEconomics: ProfitMarkupMarginMetricsResult;
  knownFullyLoadedUnitCostSubtotal: number | null;
  totalFullyLoadedUnitCost: number | null;
  pricingPolicy: PricingPolicy | null;
  sellingPrice: number | null;
  profitPerUnit: number | null;
  effectiveMarkup: number | null;
  effectiveMargin: number | null;
  issues: ProductPricingQuoteIssue[];
}

export type ProductPricingQuoteServiceErrorCode = 'PRODUCT_NOT_FOUND';

export class ProductPricingQuoteServiceError extends Error {
  readonly code: ProductPricingQuoteServiceErrorCode;
  readonly productId: string;

  constructor(code: ProductPricingQuoteServiceErrorCode, message: string, productId: string) {
    super(message);
    this.name = 'ProductPricingQuoteServiceError';
    this.code = code;
    this.productId = productId;
  }
}

export interface ProductPricingQuoteCostProvider {
  costProduct(productId: string): Promise<FullyLoadedProductUnitCostResult>;
}

export interface ProductPricingQuoteFinancialProfileProvider {
  getProfile(productId: string): Promise<ProductFinancialProfile | null>;
}

export interface ProductPricingQuoteMetricsProvider {
  deriveForProduct(productId: string): Promise<ProfitMarkupMarginMetricsResult>;
}

function comparable(value: string): string {
  return value.trim().toLowerCase();
}

function valuesMatch(left: number | null, right: number | null): boolean {
  return left === right;
}

function pricingPoliciesMatch(left: PricingPolicy | null, right: PricingPolicy | null): boolean {
  if (left === null || right === null) return left === right;
  return left.method === right.method && left.value === right.value;
}

function cloneCostResult(value: FullyLoadedProductUnitCostResult): FullyLoadedProductUnitCostResult {
  return structuredClone(value);
}

function cloneMetricsResult(value: ProfitMarkupMarginMetricsResult): ProfitMarkupMarginMetricsResult {
  return structuredClone(value);
}

/**
 * Phase 4.3C consolidated Product pricing quote/readiness view.
 *
 * This service is intentionally orchestration-only. It consumes the authoritative
 * 4.2C cost result, 4.1C financial profile, and 4.3B unit-economics result without
 * recomputing cost, selling price, profit, markup, or margin.
 */
export class ProductPricingQuoteService {
  constructor(
    private readonly costs: ProductPricingQuoteCostProvider,
    private readonly financialProfiles: ProductPricingQuoteFinancialProfileProvider,
    private readonly metrics: ProductPricingQuoteMetricsProvider,
  ) {}

  async quoteProduct(productId: string): Promise<ProductPricingQuoteResult> {
    const requestedProductId = productId.trim();

    let cost: FullyLoadedProductUnitCostResult;
    try {
      cost = await this.costs.costProduct(requestedProductId);
    } catch (error) {
      if (error instanceof FullyLoadedProductUnitCostServiceError) {
        throw new ProductPricingQuoteServiceError(
          'PRODUCT_NOT_FOUND',
          error.message,
          error.productId,
        );
      }
      throw error;
    }

    const canonicalProductId = cost.productId;
    const [profile, metrics] = await Promise.all([
      this.financialProfiles.getProfile(canonicalProductId),
      this.metrics.deriveForProduct(canonicalProductId),
    ]);

    const issues: ProductPricingQuoteIssue[] = [];
    let contradiction = false;

    if (comparable(requestedProductId) !== comparable(canonicalProductId)) {
      contradiction = true;
      issues.push({
        code: 'COST_PRODUCT_MISMATCH',
        message: `Requested Product ${requestedProductId}, but fully loaded cost evidence belongs to ${canonicalProductId}.`,
        productId: requestedProductId,
      });
    }

    if (profile === null) {
      issues.push({
        code: 'FINANCIAL_PROFILE_MISSING',
        message: `Product ${canonicalProductId} has no financial profile for the pricing quote.`,
        productId: canonicalProductId,
      });
    } else if (comparable(profile.productId) !== comparable(canonicalProductId)) {
      contradiction = true;
      issues.push({
        code: 'FINANCIAL_PROFILE_PRODUCT_MISMATCH',
        message: `Financial profile belongs to ${profile.productId}, not Product ${canonicalProductId}.`,
        productId: canonicalProductId,
      });
    }

    if (comparable(metrics.productId) !== comparable(canonicalProductId)) {
      contradiction = true;
      issues.push({
        code: 'METRICS_PRODUCT_MISMATCH',
        message: `Unit-economics evidence belongs to ${metrics.productId}, not Product ${canonicalProductId}.`,
        productId: canonicalProductId,
      });
    }

    if (metrics.costStatus !== cost.status) {
      contradiction = true;
      issues.push({
        code: 'COST_STATUS_MISMATCH',
        message: `Phase 4.2C cost status (${cost.status}) does not match the 4.3B cost status (${metrics.costStatus}) for Product ${canonicalProductId}.`,
        productId: canonicalProductId,
      });
    }

    if (!valuesMatch(metrics.totalFullyLoadedUnitCost, cost.totalFullyLoadedUnitCost)) {
      contradiction = true;
      issues.push({
        code: 'TOTAL_COST_MISMATCH',
        message: `Phase 4.2C total fully loaded unit cost does not match 4.3B evidence for Product ${canonicalProductId}.`,
        productId: canonicalProductId,
      });
    }

    if (!valuesMatch(metrics.knownFullyLoadedUnitCostSubtotal, cost.knownFullyLoadedUnitCostSubtotal)) {
      contradiction = true;
      issues.push({
        code: 'KNOWN_SUBTOTAL_MISMATCH',
        message: `Phase 4.2C known fully loaded subtotal does not match 4.3B evidence for Product ${canonicalProductId}.`,
        productId: canonicalProductId,
      });
    }

    if (profile !== null && !pricingPoliciesMatch(profile.pricingPolicy, metrics.pricingPolicy)) {
      contradiction = true;
      issues.push({
        code: 'PRICING_POLICY_MISMATCH',
        message: `Financial-profile pricing policy does not match 4.3B pricing evidence for Product ${canonicalProductId}.`,
        productId: canonicalProductId,
      });
    }

    if (metrics.status === 'partial') {
      issues.push({
        code: 'UPSTREAM_PARTIAL',
        message: `Product ${canonicalProductId} has only partial unit-economics evidence.`,
        productId: canonicalProductId,
      });
    } else if (metrics.status === 'not-ready') {
      issues.push({
        code: 'UPSTREAM_NOT_READY',
        message: `Product ${canonicalProductId} has no ready unit-economics basis for a pricing quote.`,
        productId: canonicalProductId,
      });
    }

    if (metrics.status === 'ready' && (cost.status !== 'ready' || profile === null)) {
      contradiction = true;
      issues.push({
        code: 'READY_STATE_INCONSISTENT',
        message: `Product ${canonicalProductId} reports ready 4.3B metrics without all required ready quote evidence.`,
        productId: canonicalProductId,
      });
    }

    let status: ProductPricingQuoteStatus;
    if (contradiction || profile === null || metrics.status === 'not-ready') {
      status = 'not-ready';
    } else if (metrics.status === 'partial') {
      status = 'partial';
    } else if (cost.status === 'ready') {
      status = 'ready';
    } else {
      status = 'not-ready';
    }

    const clonedCost = cloneCostResult(cost);
    const clonedMetrics = cloneMetricsResult(metrics);
    const clonedProfile = profile ? cloneProductFinancialProfile(profile) : null;

    return {
      productId: canonicalProductId,
      productName: cost.productName,
      productIsActive: cost.productIsActive,
      status,
      costStatus: cost.status,
      sellingPriceStatus: metrics.sellingPriceStatus,
      metricsStatus: metrics.status,
      financialProfile: clonedProfile,
      fullyLoadedUnitCost: clonedCost,
      unitEconomics: clonedMetrics,
      knownFullyLoadedUnitCostSubtotal: cost.knownFullyLoadedUnitCostSubtotal,
      totalFullyLoadedUnitCost: cost.totalFullyLoadedUnitCost,
      pricingPolicy: metrics.pricingPolicy ? clonePricingPolicy(metrics.pricingPolicy) : null,
      sellingPrice: metrics.sellingPrice,
      profitPerUnit: metrics.profitPerUnit,
      effectiveMarkup: metrics.effectiveMarkup,
      effectiveMargin: metrics.effectiveMargin,
      issues: issues.map((issue) => ({ ...issue })),
    };
  }
}
