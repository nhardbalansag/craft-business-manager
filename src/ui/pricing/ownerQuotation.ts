import type { ProductPriceResolutionResult } from '../../application/pricing/ProductPriceResolutionService';
import type { CustomerQuotationView } from './customerQuotation';

/**
 * Private reporting model. Never attach these values to CustomerQuotationView:
 * that model is intentionally safe to pass to the customer PDF renderer.
 */
export interface OwnerQuotationItem {
  productId: string;
  productName: string;
  quantity: number;
  sourceLabel: string;
  unitSellingPrice: number;
  totalSellingPrice: number;
  /** Actual quoted fully loaded cost per delivered piece, including tier extras. */
  unitProductCost: number | null;
  totalProductCost: number | null;
  profitPerUnit: number | null;
  totalProfit: number | null;
  grossMargin: number | null;
}

export interface OwnerQuotationView {
  businessName: string;
  quotationReference: string;
  generatedAtIso: string;
  validUntil: string | null;
  customer: CustomerQuotationView['customer'];
  items: OwnerQuotationItem[];
  totalSales: number;
  totalProductCost: number | null;
  totalProfit: number | null;
  grossMargin: number | null;
  unresolvedCostCount: number;
}

export class OwnerQuotationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OwnerQuotationError';
  }
}

function finiteNonNegative(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function finiteAmount(value: number): boolean {
  return Number.isFinite(value);
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(a), Math.abs(b));
}

/**
 * Uses exactly the same resolved products/quantities as the customer copy.
 * A selected tier may add per-offer preparation/packaging costs to the unit
 * cost. Cost resolution never silently substitutes a partial known subtotal.
 */
export function buildOwnerQuotationView(
  customer: CustomerQuotationView,
  resolutions: readonly ProductPriceResolutionResult[],
): OwnerQuotationView {
  if (customer.items.length === 0 || customer.items.length !== resolutions.length) {
    throw new OwnerQuotationError('Owner quotation items do not match the customer quotation.');
  }
  const items = customer.items.map((quoted, index): OwnerQuotationItem => {
    const resolved = resolutions[index]!;
    if (
      resolved.status !== 'ready' ||
      resolved.productId !== quoted.product.id ||
      resolved.quantity !== quoted.product.quantity ||
      resolved.selectedTierId !== quoted.pricing.tierId ||
      resolved.totalSellingPrice === null ||
      !nearlyEqual(resolved.totalSellingPrice, quoted.pricing.totalSellingPrice)
    ) {
      throw new OwnerQuotationError('Owner quotation pricing does not match the resolved customer quotation.');
    }

    const quantity = quoted.product.quantity;
    const sales = quoted.pricing.totalSellingPrice;
    const costBase = resolved.integratedQuote?.totalFullyLoadedUnitCost;
    const tier = resolved.mode === 'explicit-tier' ? resolved.selectedTier : null;
    const validTier = tier &&
      tier.tier.id === resolved.selectedTierId &&
      tier.tier.productId === resolved.productId &&
      tier.economics !== null &&
      finiteNonNegative(tier.economics.fullyLoadedUnitCost) &&
      finiteNonNegative(tier.economics.additionalCostPerOffer) &&
      Number.isSafeInteger(resolved.offerCount) &&
      (resolved.offerCount ?? 0) > 0;
    const baseUnitCost = finiteNonNegative(costBase)
      ? costBase
      : validTier ? tier.economics!.fullyLoadedUnitCost : null;
    // For explicitly selected tiers, the extra charge is a production cost
    // per offer, not a per-piece cost; factor in exactly the resolved offer count.
    const additional = tier
      ? validTier ? tier.economics!.additionalCostPerOffer * resolved.offerCount! : null
      : 0;
    const totalCostCandidate = baseUnitCost === null || additional === null
      ? null
      : baseUnitCost * quantity + additional;
    const totalProductCost = totalCostCandidate !== null && finiteNonNegative(totalCostCandidate)
      ? totalCostCandidate : null;
    const totalProfitCandidate = totalProductCost === null ? null : sales - totalProductCost;
    const totalProfit = totalProfitCandidate !== null && finiteAmount(totalProfitCandidate)
      ? totalProfitCandidate : null;
    const margin = totalProfit !== null && sales > 0 ? totalProfit / sales : null;

    return {
      productId: quoted.product.id,
      productName: quoted.product.name,
      quantity,
      sourceLabel: quoted.pricing.sourceLabel,
      unitSellingPrice: quoted.pricing.unitSellingPrice,
      totalSellingPrice: sales,
      unitProductCost: totalProductCost === null ? null : totalProductCost / quantity,
      totalProductCost,
      profitPerUnit: totalProfit === null ? null : totalProfit / quantity,
      totalProfit,
      grossMargin: margin,
    };
  });

  const unresolvedCostCount = items.filter((item) => item.totalProductCost === null).length;
  const totalSales = customer.total;
  const totalProductCost = unresolvedCostCount === 0
    ? items.reduce((sum, item) => sum + item.totalProductCost!, 0) : null;
  const totalProfit = totalProductCost === null ? null : totalSales - totalProductCost;
  return {
    businessName: customer.businessName,
    quotationReference: customer.quotationReference,
    generatedAtIso: customer.generatedAtIso,
    validUntil: customer.validUntil,
    customer: customer.customer,
    items,
    totalSales,
    totalProductCost,
    totalProfit,
    grossMargin: totalProfit !== null && totalSales > 0 ? totalProfit / totalSales : null,
    unresolvedCostCount,
  };
}
