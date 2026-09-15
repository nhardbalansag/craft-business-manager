import {
  PricingError,
  calculateEffectiveMargin,
  calculateEffectiveMarkup,
  calculateProfitPerUnit,
  clonePricingPolicy,
  validatePricingPolicy,
  type PricingPolicy,
} from '../../domain/pricing';
import type { FullyLoadedProductUnitCostStatus } from '../productCosts/FullyLoadedProductUnitCostService';
import type {
  SellingPriceDerivationIssue,
  SellingPriceDerivationResult,
  SellingPriceDerivationStatus,
} from './SellingPriceDerivationService';

export type ProfitMarkupMarginMetricsStatus = 'ready' | 'partial' | 'not-ready';

export type ProfitMarkupMarginMetricsIssueCode =
  | 'UPSTREAM_PARTIAL'
  | 'UPSTREAM_NOT_READY'
  | 'UPSTREAM_PRODUCT_MISMATCH'
  | 'UNIT_COST_INVALID'
  | 'SELLING_PRICE_INVALID'
  | 'PRICING_POLICY_MISSING'
  | 'PRICING_POLICY_INVALID'
  | 'METRICS_DERIVATION_FAILED'
  | 'EFFECTIVE_MARKUP_UNAVAILABLE_ZERO_COST'
  | 'EFFECTIVE_MARGIN_UNAVAILABLE_ZERO_PRICE'
  | 'RECONCILIATION_INVALID';

export interface ProfitMarkupMarginMetricsIssue {
  code: ProfitMarkupMarginMetricsIssueCode;
  message: string;
  productId: string;
  underlyingCode?: string;
}

export interface CostToPriceReconciliation {
  totalFullyLoadedUnitCost: number;
  profitPerUnit: number;
  recomposedSellingPrice: number;
  sellingPrice: number;
  reconciliationDifference: number;
}

export interface ProfitMarkupMarginMetricsResult {
  productId: string;
  productName: string;
  productIsActive: boolean;
  status: ProfitMarkupMarginMetricsStatus;
  sellingPriceStatus: SellingPriceDerivationStatus;
  costStatus: FullyLoadedProductUnitCostStatus;
  totalFullyLoadedUnitCost: number | null;
  knownFullyLoadedUnitCostSubtotal: number | null;
  sellingPrice: number | null;
  pricingPolicy: PricingPolicy | null;
  profitPerUnit: number | null;
  effectiveMarkup: number | null;
  effectiveMargin: number | null;
  reconciliation: CostToPriceReconciliation | null;
  upstreamIssues: SellingPriceDerivationIssue[];
  issues: ProfitMarkupMarginMetricsIssue[];
}

export interface ProfitMarkupMarginMetricsSellingPriceProvider {
  deriveForProduct(productId: string): Promise<SellingPriceDerivationResult>;
}

function comparable(value: string): string {
  return value.trim().toLowerCase();
}

function finiteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function cloneUpstreamIssues(issues: SellingPriceDerivationIssue[]): SellingPriceDerivationIssue[] {
  return issues.map((issue) => ({ ...issue }));
}

function clonePolicy(policy: PricingPolicy | null): PricingPolicy | null {
  return policy ? clonePricingPolicy(policy) : null;
}

function unresolvedResult(
  upstream: SellingPriceDerivationResult,
  status: ProfitMarkupMarginMetricsStatus,
  issues: ProfitMarkupMarginMetricsIssue[],
): ProfitMarkupMarginMetricsResult {
  return {
    productId: upstream.productId,
    productName: upstream.productName,
    productIsActive: upstream.productIsActive,
    status,
    sellingPriceStatus: upstream.status,
    costStatus: upstream.costStatus,
    totalFullyLoadedUnitCost: upstream.totalFullyLoadedUnitCost,
    knownFullyLoadedUnitCostSubtotal: upstream.knownFullyLoadedUnitCostSubtotal,
    sellingPrice: upstream.sellingPrice,
    pricingPolicy: clonePolicy(upstream.pricingPolicy),
    profitPerUnit: null,
    effectiveMarkup: null,
    effectiveMargin: null,
    reconciliation: null,
    upstreamIssues: cloneUpstreamIssues(upstream.issues),
    issues: issues.map((issue) => ({ ...issue })),
  };
}

/**
 * Phase 4.3B authoritative Product-level profit/markup/margin diagnostics.
 *
 * The service consumes the completed 4.3A selling-price result and deliberately
 * does not re-derive selling price. Unit-economics formulas remain owned by the
 * Phase 4.1B pricing domain.
 */
export class ProfitMarkupMarginMetricsService {
  constructor(private readonly sellingPrices: ProfitMarkupMarginMetricsSellingPriceProvider) {}

  async deriveForProduct(productId: string): Promise<ProfitMarkupMarginMetricsResult> {
    const requestedProductId = productId.trim();
    const upstream = await this.sellingPrices.deriveForProduct(requestedProductId);
    const issues: ProfitMarkupMarginMetricsIssue[] = [];

    if (comparable(upstream.productId) !== comparable(requestedProductId)) {
      issues.push({
        code: 'UPSTREAM_PRODUCT_MISMATCH',
        message: `Requested Product ${requestedProductId}, but selling-price evidence belongs to ${upstream.productId}.`,
        productId: requestedProductId,
      });
      return unresolvedResult(upstream, 'not-ready', issues);
    }

    if (upstream.status === 'partial') {
      issues.push({
        code: 'UPSTREAM_PARTIAL',
        message: `Product ${upstream.productId} has only partial selling-price evidence.`,
        productId: upstream.productId,
      });
      return unresolvedResult(upstream, 'partial', issues);
    }

    if (upstream.status === 'not-ready') {
      issues.push({
        code: 'UPSTREAM_NOT_READY',
        message: `Product ${upstream.productId} has no ready selling-price basis for unit-economics metrics.`,
        productId: upstream.productId,
      });
      return unresolvedResult(upstream, 'not-ready', issues);
    }

    const unitCost = upstream.totalFullyLoadedUnitCost;
    if (unitCost === null || !finiteNonNegative(unitCost)) {
      issues.push({
        code: 'UNIT_COST_INVALID',
        message: `Product ${upstream.productId} reports ready selling-price status without a valid authoritative fully loaded unit cost.`,
        productId: upstream.productId,
      });
      return unresolvedResult(upstream, 'not-ready', issues);
    }

    const sellingPrice = upstream.sellingPrice;
    if (sellingPrice === null || !finiteNonNegative(sellingPrice)) {
      issues.push({
        code: 'SELLING_PRICE_INVALID',
        message: `Product ${upstream.productId} reports ready selling-price status without a valid authoritative selling price.`,
        productId: upstream.productId,
      });
      return unresolvedResult(upstream, 'not-ready', issues);
    }

    if (upstream.pricingPolicy === null) {
      issues.push({
        code: 'PRICING_POLICY_MISSING',
        message: `Product ${upstream.productId} reports ready selling-price status without a configured pricing policy.`,
        productId: upstream.productId,
      });
      return unresolvedResult(upstream, 'not-ready', issues);
    }

    try {
      validatePricingPolicy(upstream.pricingPolicy);
    } catch (error) {
      if (error instanceof PricingError) {
        issues.push({
          code: 'PRICING_POLICY_INVALID',
          message: error.message,
          productId: upstream.productId,
          underlyingCode: error.code,
        });
        return unresolvedResult(upstream, 'not-ready', issues);
      }
      throw error;
    }

    let profitPerUnit: number;
    let effectiveMarkup: number | null;
    let effectiveMargin: number | null;

    try {
      profitPerUnit = calculateProfitPerUnit(unitCost, sellingPrice);
      effectiveMarkup = calculateEffectiveMarkup(unitCost, sellingPrice);
      effectiveMargin = calculateEffectiveMargin(unitCost, sellingPrice);
    } catch (error) {
      if (error instanceof PricingError) {
        issues.push({
          code: 'METRICS_DERIVATION_FAILED',
          message: error.message,
          productId: upstream.productId,
          underlyingCode: error.code,
        });
        return unresolvedResult(upstream, 'not-ready', issues);
      }
      throw error;
    }

    const derivedMetricsAreFinite =
      Number.isFinite(profitPerUnit) &&
      (effectiveMarkup === null || Number.isFinite(effectiveMarkup)) &&
      (effectiveMargin === null || Number.isFinite(effectiveMargin));

    if (!derivedMetricsAreFinite) {
      issues.push({
        code: 'METRICS_DERIVATION_FAILED',
        message: `Product ${upstream.productId} produced non-finite unit-economics diagnostics.`,
        productId: upstream.productId,
      });
      return unresolvedResult(upstream, 'not-ready', issues);
    }

    const recomposedSellingPrice = unitCost + profitPerUnit;
    const reconciliationDifference = sellingPrice - recomposedSellingPrice;

    if (!Number.isFinite(recomposedSellingPrice) || !Number.isFinite(reconciliationDifference)) {
      issues.push({
        code: 'RECONCILIATION_INVALID',
        message: `Product ${upstream.productId} produced non-finite cost-to-price reconciliation evidence.`,
        productId: upstream.productId,
      });
      return unresolvedResult(upstream, 'not-ready', issues);
    }

    if (unitCost === 0) {
      issues.push({
        code: 'EFFECTIVE_MARKUP_UNAVAILABLE_ZERO_COST',
        message: `Product ${upstream.productId} has zero fully loaded unit cost, so effective markup is unavailable.`,
        productId: upstream.productId,
      });
    }

    if (sellingPrice === 0) {
      issues.push({
        code: 'EFFECTIVE_MARGIN_UNAVAILABLE_ZERO_PRICE',
        message: `Product ${upstream.productId} has zero selling price, so effective margin is unavailable.`,
        productId: upstream.productId,
      });
    }

    return {
      productId: upstream.productId,
      productName: upstream.productName,
      productIsActive: upstream.productIsActive,
      status: 'ready',
      sellingPriceStatus: upstream.status,
      costStatus: upstream.costStatus,
      totalFullyLoadedUnitCost: unitCost,
      knownFullyLoadedUnitCostSubtotal: upstream.knownFullyLoadedUnitCostSubtotal,
      sellingPrice,
      pricingPolicy: clonePricingPolicy(upstream.pricingPolicy),
      profitPerUnit,
      effectiveMarkup,
      effectiveMargin,
      reconciliation: {
        totalFullyLoadedUnitCost: unitCost,
        profitPerUnit,
        recomposedSellingPrice,
        sellingPrice,
        reconciliationDifference,
      },
      upstreamIssues: cloneUpstreamIssues(upstream.issues),
      issues: issues.map((issue) => ({ ...issue })),
    };
  }
}
