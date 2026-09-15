import {
  ProductPricingQuoteServiceError,
  type ProductPricingQuoteResult,
} from '../pricing/ProductPricingQuoteService';
import {
  PhysicalPlannedBatchProductionCostServiceError,
  type PhysicalPlannedBatchProductionCostResult,
} from './PhysicalPlannedBatchProductionCostService';

export type ExpectedBatchFinancialsStatus = 'ready' | 'partial' | 'not-ready';

export type ExpectedBatchFinancialsIssueCode =
  | 'QUOTE_BATCH_PRODUCT_MISMATCH'
  | 'PRODUCT_ACTIVE_STATE_MISMATCH'
  | 'BATCH_QUANTITY_MISMATCH'
  | 'UNIT_COST_STATUS_MISMATCH'
  | 'TOTAL_UNIT_COST_MISMATCH'
  | 'PRICING_PARTIAL'
  | 'PRICING_NOT_READY'
  | 'BATCH_COST_PARTIAL'
  | 'BATCH_COST_NOT_READY'
  | 'SELLING_PRICE_INVALID'
  | 'UNIT_PROFIT_INVALID'
  | 'PLANNED_PRODUCTION_COST_INVALID'
  | 'READY_STATE_INCONSISTENT'
  | 'DERIVED_FINANCIAL_INVALID'
  | 'FINANCIAL_RECONCILIATION_FAILED'
  | 'ZERO_REVENUE_BATCH_MARGIN_UNAVAILABLE'
  | 'ZERO_QUANTITY_AVERAGE_COST_UNAVAILABLE';

export interface ExpectedBatchFinancialsIssue {
  code: ExpectedBatchFinancialsIssueCode;
  message: string;
  productId: string;
}

export interface ExpectedBatchFinancialReconciliation {
  expectedRevenue: number;
  plannedProductionCost: number;
  expectedProfit: number;
  recomposedRevenue: number;
  reconciliationDifference: number;
}

export interface ExpectedBatchFinancialsResult {
  productId: string;
  productName: string;
  productIsActive: boolean;
  status: ExpectedBatchFinancialsStatus;
  plannedQuantity: number;
  pricingQuote: ProductPricingQuoteResult;
  physicalBatchCost: PhysicalPlannedBatchProductionCostResult;
  sellingPrice: number | null;
  profitPerUnit: number | null;
  plannedProductionCost: number | null;
  expectedRevenue: number | null;
  expectedProfit: number | null;
  batchMargin: number | null;
  plannedAverageCostPerFinishedUnit: number | null;
  unitProfitTimesQuantity: number | null;
  physicalVsUnitProfitDifference: number | null;
  reconciliation: ExpectedBatchFinancialReconciliation | null;
  issues: ExpectedBatchFinancialsIssue[];
}

export type ExpectedBatchFinancialsServiceErrorCode =
  | 'PRODUCT_NOT_FOUND'
  | 'INVALID_PLANNED_QUANTITY'
  | 'PRODUCTION_REQUIREMENT_INVALID';

export class ExpectedBatchFinancialsServiceError extends Error {
  readonly code: ExpectedBatchFinancialsServiceErrorCode;
  readonly productId: string;
  readonly plannedQuantity: number;
  readonly underlyingCode?: string;

  constructor(
    code: ExpectedBatchFinancialsServiceErrorCode,
    message: string,
    context: {
      productId: string;
      plannedQuantity: number;
      underlyingCode?: string;
    },
  ) {
    super(message);
    this.name = 'ExpectedBatchFinancialsServiceError';
    this.code = code;
    this.productId = context.productId;
    this.plannedQuantity = context.plannedQuantity;
    this.underlyingCode = context.underlyingCode;
  }
}

export interface ExpectedBatchFinancialsPricingQuoteProvider {
  quoteProduct(productId: string): Promise<ProductPricingQuoteResult>;
}

export interface ExpectedBatchFinancialsPhysicalCostProvider {
  costPlannedBatch(
    productId: string,
    plannedQuantity: number,
  ): Promise<PhysicalPlannedBatchProductionCostResult>;
}

function comparable(value: string): string {
  return value.trim().toLowerCase();
}

function finiteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function valuesMatch(left: number | null, right: number | null): boolean {
  return left === right;
}

function cloneIssue(issue: ExpectedBatchFinancialsIssue): ExpectedBatchFinancialsIssue {
  return { ...issue };
}

/**
 * Phase 4.4B authoritative expected batch financial projection.
 *
 * This service is intentionally orchestration-only. Selling price and unit
 * economics come from 4.3C; physical planned production cost comes from 4.4A.
 * The service adds only batch-level revenue/profit/margin/average diagnostics.
 */
export class ExpectedBatchFinancialsService {
  constructor(
    private readonly pricingQuotes: ExpectedBatchFinancialsPricingQuoteProvider,
    private readonly physicalCosts: ExpectedBatchFinancialsPhysicalCostProvider,
  ) {}

  async projectBatch(
    productId: string,
    plannedQuantity: number,
  ): Promise<ExpectedBatchFinancialsResult> {
    const requestedProductId = productId.trim();

    let quote: ProductPricingQuoteResult;
    try {
      quote = await this.pricingQuotes.quoteProduct(requestedProductId);
    } catch (error) {
      if (error instanceof ProductPricingQuoteServiceError) {
        throw new ExpectedBatchFinancialsServiceError(
          'PRODUCT_NOT_FOUND',
          error.message,
          {
            productId: error.productId,
            plannedQuantity,
          },
        );
      }
      throw error;
    }

    const canonicalProductId = quote.productId;
    let batch: PhysicalPlannedBatchProductionCostResult;
    try {
      batch = await this.physicalCosts.costPlannedBatch(canonicalProductId, plannedQuantity);
    } catch (error) {
      if (error instanceof PhysicalPlannedBatchProductionCostServiceError) {
        throw new ExpectedBatchFinancialsServiceError(
          error.code,
          error.message,
          {
            productId: error.productId,
            plannedQuantity: error.plannedQuantity,
            underlyingCode: error.underlyingCode,
          },
        );
      }
      throw error;
    }

    const issues: ExpectedBatchFinancialsIssue[] = [];
    let contradiction = false;
    const addIssue = (issue: ExpectedBatchFinancialsIssue) => issues.push(issue);

    if (comparable(quote.productId) !== comparable(batch.productId)) {
      contradiction = true;
      addIssue({
        code: 'QUOTE_BATCH_PRODUCT_MISMATCH',
        message: `Pricing quote belongs to Product ${quote.productId}, but physical batch cost belongs to ${batch.productId}.`,
        productId: canonicalProductId,
      });
    }

    if (quote.productIsActive !== batch.productIsActive) {
      contradiction = true;
      addIssue({
        code: 'PRODUCT_ACTIVE_STATE_MISMATCH',
        message: `Pricing quote and physical batch cost disagree on active state for Product ${canonicalProductId}.`,
        productId: canonicalProductId,
      });
    }

    if (batch.plannedQuantity !== plannedQuantity) {
      contradiction = true;
      addIssue({
        code: 'BATCH_QUANTITY_MISMATCH',
        message: `Requested quantity ${plannedQuantity}, but physical batch cost returned ${batch.plannedQuantity}.`,
        productId: canonicalProductId,
      });
    }

    if (quote.costStatus !== batch.unitCostStatus) {
      contradiction = true;
      addIssue({
        code: 'UNIT_COST_STATUS_MISMATCH',
        message: `Pricing quote cost status (${quote.costStatus}) does not match physical batch unit-cost status (${batch.unitCostStatus}) for Product ${canonicalProductId}.`,
        productId: canonicalProductId,
      });
    }

    if (
      !valuesMatch(
        quote.totalFullyLoadedUnitCost,
        batch.unitCostEvidence.totalFullyLoadedUnitCost,
      )
    ) {
      contradiction = true;
      addIssue({
        code: 'TOTAL_UNIT_COST_MISMATCH',
        message: `Pricing quote and physical batch evidence disagree on authoritative standard unit cost for Product ${canonicalProductId}.`,
        productId: canonicalProductId,
      });
    }

    if (quote.status === 'partial') {
      addIssue({
        code: 'PRICING_PARTIAL',
        message: `Product ${canonicalProductId} has only partial pricing-quote evidence.`,
        productId: canonicalProductId,
      });
    } else if (quote.status === 'not-ready') {
      addIssue({
        code: 'PRICING_NOT_READY',
        message: `Product ${canonicalProductId} has no ready authoritative selling-price basis.`,
        productId: canonicalProductId,
      });
    }

    if (batch.status === 'partial') {
      addIssue({
        code: 'BATCH_COST_PARTIAL',
        message: `Product ${canonicalProductId} has only partial physical planned production-cost evidence.`,
        productId: canonicalProductId,
      });
    } else if (batch.status === 'not-ready') {
      addIssue({
        code: 'BATCH_COST_NOT_READY',
        message: `Product ${canonicalProductId} has no ready authoritative physical planned production cost.`,
        productId: canonicalProductId,
      });
    }

    let sellingPrice: number | null = null;
    if (quote.status === 'ready') {
      if (quote.sellingPrice === null || !finiteNonNegative(quote.sellingPrice)) {
        contradiction = true;
        addIssue({
          code: 'SELLING_PRICE_INVALID',
          message: `Product ${canonicalProductId} reports a ready pricing quote without a valid finite/non-negative selling price.`,
          productId: canonicalProductId,
        });
      } else {
        sellingPrice = quote.sellingPrice;
      }
    } else if (quote.sellingPrice !== null && !finiteNonNegative(quote.sellingPrice)) {
      contradiction = true;
      addIssue({
        code: 'SELLING_PRICE_INVALID',
        message: `Product ${canonicalProductId} carries invalid selling-price evidence.`,
        productId: canonicalProductId,
      });
    }

    let profitPerUnit: number | null = null;
    if (quote.status === 'ready') {
      if (quote.profitPerUnit === null || !Number.isFinite(quote.profitPerUnit)) {
        contradiction = true;
        addIssue({
          code: 'UNIT_PROFIT_INVALID',
          message: `Product ${canonicalProductId} reports a ready pricing quote without finite profit-per-unit evidence.`,
          productId: canonicalProductId,
        });
      } else {
        profitPerUnit = quote.profitPerUnit;
      }
    } else if (quote.profitPerUnit !== null && !Number.isFinite(quote.profitPerUnit)) {
      contradiction = true;
      addIssue({
        code: 'UNIT_PROFIT_INVALID',
        message: `Product ${canonicalProductId} carries invalid profit-per-unit evidence.`,
        productId: canonicalProductId,
      });
    }

    let plannedProductionCost: number | null = null;
    if (batch.status === 'ready') {
      if (
        batch.plannedProductionCost === null ||
        !finiteNonNegative(batch.plannedProductionCost)
      ) {
        contradiction = true;
        addIssue({
          code: 'PLANNED_PRODUCTION_COST_INVALID',
          message: `Product ${canonicalProductId} reports ready physical batch cost without a valid finite/non-negative planned production cost.`,
          productId: canonicalProductId,
        });
      } else {
        plannedProductionCost = batch.plannedProductionCost;
      }
    } else if (batch.plannedProductionCost !== null) {
      contradiction = true;
      addIssue({
        code: 'READY_STATE_INCONSISTENT',
        message: `Product ${canonicalProductId} publishes an authoritative planned production cost while physical batch status is ${batch.status}.`,
        productId: canonicalProductId,
      });
    }

    let expectedRevenue: number | null = null;
    if (sellingPrice !== null) {
      const derived = sellingPrice * plannedQuantity;
      if (!finiteNonNegative(derived)) {
        contradiction = true;
        addIssue({
          code: 'DERIVED_FINANCIAL_INVALID',
          message: `Product ${canonicalProductId} produced invalid/non-finite expected revenue.`,
          productId: canonicalProductId,
        });
      } else {
        expectedRevenue = derived;
      }
    }

    let unitProfitTimesQuantity: number | null = null;
    if (profitPerUnit !== null) {
      const derived = profitPerUnit * plannedQuantity;
      if (!Number.isFinite(derived)) {
        contradiction = true;
        addIssue({
          code: 'DERIVED_FINANCIAL_INVALID',
          message: `Product ${canonicalProductId} produced invalid/non-finite standard unit-profit batch comparison.`,
          productId: canonicalProductId,
        });
      } else {
        unitProfitTimesQuantity = derived;
      }
    }

    let expectedProfit: number | null = null;
    if (expectedRevenue !== null && plannedProductionCost !== null) {
      const derived = expectedRevenue - plannedProductionCost;
      if (!Number.isFinite(derived)) {
        contradiction = true;
        addIssue({
          code: 'DERIVED_FINANCIAL_INVALID',
          message: `Product ${canonicalProductId} produced invalid/non-finite expected profit.`,
          productId: canonicalProductId,
        });
      } else {
        expectedProfit = derived;
      }
    }

    let batchMargin: number | null = null;
    if (expectedRevenue !== null && expectedProfit !== null) {
      if (expectedRevenue === 0) {
        addIssue({
          code: 'ZERO_REVENUE_BATCH_MARGIN_UNAVAILABLE',
          message: `Product ${canonicalProductId} has zero expected revenue, so effective batch margin is unavailable.`,
          productId: canonicalProductId,
        });
      } else {
        const derived = expectedProfit / expectedRevenue;
        if (!Number.isFinite(derived)) {
          contradiction = true;
          addIssue({
            code: 'DERIVED_FINANCIAL_INVALID',
            message: `Product ${canonicalProductId} produced invalid/non-finite effective batch margin.`,
            productId: canonicalProductId,
          });
        } else {
          batchMargin = derived;
        }
      }
    }

    let plannedAverageCostPerFinishedUnit: number | null = null;
    if (plannedProductionCost !== null) {
      if (plannedQuantity === 0) {
        addIssue({
          code: 'ZERO_QUANTITY_AVERAGE_COST_UNAVAILABLE',
          message: `Product ${canonicalProductId} has zero planned quantity, so physical average cost per finished unit is unavailable.`,
          productId: canonicalProductId,
        });
      } else {
        const derived = plannedProductionCost / plannedQuantity;
        if (!finiteNonNegative(derived)) {
          contradiction = true;
          addIssue({
            code: 'DERIVED_FINANCIAL_INVALID',
            message: `Product ${canonicalProductId} produced invalid/non-finite average physical cost per finished unit.`,
            productId: canonicalProductId,
          });
        } else {
          plannedAverageCostPerFinishedUnit = derived;
        }
      }
    }

    let physicalVsUnitProfitDifference: number | null = null;
    if (expectedProfit !== null && unitProfitTimesQuantity !== null) {
      const derived = expectedProfit - unitProfitTimesQuantity;
      if (!Number.isFinite(derived)) {
        contradiction = true;
        addIssue({
          code: 'DERIVED_FINANCIAL_INVALID',
          message: `Product ${canonicalProductId} produced invalid/non-finite physical-versus-unit-profit difference.`,
          productId: canonicalProductId,
        });
      } else {
        physicalVsUnitProfitDifference = derived;
      }
    }

    let reconciliation: ExpectedBatchFinancialReconciliation | null = null;
    if (
      expectedRevenue !== null &&
      expectedProfit !== null &&
      plannedProductionCost !== null
    ) {
      const recomposedRevenue = plannedProductionCost + expectedProfit;
      const reconciliationDifference = expectedRevenue - recomposedRevenue;
      if (!Number.isFinite(recomposedRevenue) || !Number.isFinite(reconciliationDifference)) {
        contradiction = true;
        addIssue({
          code: 'FINANCIAL_RECONCILIATION_FAILED',
          message: `Product ${canonicalProductId} produced non-finite expected-revenue/profit reconciliation evidence.`,
          productId: canonicalProductId,
        });
      } else {
        reconciliation = {
          expectedRevenue,
          plannedProductionCost,
          expectedProfit,
          recomposedRevenue,
          reconciliationDifference,
        };
      }
    }

    let status: ExpectedBatchFinancialsStatus;
    if (contradiction || quote.status === 'not-ready' || batch.status === 'not-ready') {
      status = 'not-ready';
    } else if (quote.status === 'partial' || batch.status === 'partial') {
      status = 'partial';
    } else if (
      quote.status === 'ready' &&
      batch.status === 'ready' &&
      expectedRevenue !== null &&
      expectedProfit !== null
    ) {
      status = 'ready';
    } else {
      status = 'not-ready';
      addIssue({
        code: 'READY_STATE_INCONSISTENT',
        message: `Product ${canonicalProductId} did not produce the authoritative values required for a ready batch financial projection.`,
        productId: canonicalProductId,
      });
    }

    if (contradiction) {
      sellingPrice = null;
      profitPerUnit = null;
      plannedProductionCost = null;
      expectedRevenue = null;
      expectedProfit = null;
      batchMargin = null;
      plannedAverageCostPerFinishedUnit = null;
      unitProfitTimesQuantity = null;
      physicalVsUnitProfitDifference = null;
      reconciliation = null;
    }

    return {
      productId: canonicalProductId,
      productName: quote.productName,
      productIsActive: quote.productIsActive,
      status,
      plannedQuantity,
      pricingQuote: structuredClone(quote),
      physicalBatchCost: structuredClone(batch),
      sellingPrice,
      profitPerUnit,
      plannedProductionCost,
      expectedRevenue,
      expectedProfit,
      batchMargin,
      plannedAverageCostPerFinishedUnit,
      unitProfitTimesQuantity,
      physicalVsUnitProfitDifference,
      reconciliation: reconciliation ? { ...reconciliation } : null,
      issues: issues.map(cloneIssue),
    };
  }
}
