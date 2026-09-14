import type { MoldYieldSample, PricingPolicy } from './types';

export function costPerBaseUnit(
  packageCost: number,
  purchaseQuantity: number,
  baseUnitsPerPurchaseUnit: number,
): number {
  const totalBaseUnits = purchaseQuantity * baseUnitsPerPurchaseUnit;
  return totalBaseUnits > 0 ? packageCost / totalBaseUnits : 0;
}

export function baseQuantityPerGoodPiece(sample: MoldYieldSample): number {
  return sample.goodPieces > 0 ? sample.primaryBaseQuantityUsed / sample.goodPieces : 0;
}

export function wasteAdjustedRequirement(baseQuantity: number, safetyWasteRate: number): number {
  return baseQuantity * (1 + Math.max(0, safetyWasteRate));
}

export function produciblePieces(
  onHandBaseQuantity: number,
  requiredBaseQuantityPerPiece: number,
  safetyWasteRate = 0,
): number {
  const requirement = wasteAdjustedRequirement(requiredBaseQuantityPerPiece, safetyWasteRate);
  return requirement > 0 ? Math.floor(onHandBaseQuantity / requirement) : 0;
}

export function limitingCapacity(capacities: Array<number | null | undefined>): number | null {
  const applicable = capacities.filter(
    (capacity): capacity is number => capacity !== null && capacity !== undefined && Number.isFinite(capacity),
  );

  return applicable.length ? Math.max(0, Math.min(...applicable)) : null;
}

export function totalUnitCost(costs: number[]): number {
  return costs.reduce((total, cost) => total + Math.max(0, cost || 0), 0);
}

export function sellingPrice(unitCost: number, pricing: PricingPolicy): number {
  const value = Math.max(0, pricing.value);

  switch (pricing.method) {
    case 'profit-amount':
      return unitCost + value;
    case 'markup-percent':
      return unitCost * (1 + value);
    case 'margin-percent':
      return value >= 1 ? 0 : unitCost / (1 - value);
  }
}

export function profitPerPiece(unitCost: number, price: number): number {
  return price - unitCost;
}

export function plannedTotals(unitCost: number, price: number, quantity: number) {
  const safeQuantity = Math.max(0, Math.floor(quantity));
  const productionCost = unitCost * safeQuantity;
  const revenue = price * safeQuantity;

  return {
    quantity: safeQuantity,
    productionCost,
    revenue,
    profit: revenue - productionCost,
  };
}
