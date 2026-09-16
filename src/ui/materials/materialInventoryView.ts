import type { Material } from '../../domain/materials';
import type { MaterialCalibrationEvidence } from '../../domain/materialCalibration';
import { calculateMaterialPackageCosting } from '../../domain/materialCosting';
import { calculateMaterialInventoryValuation, normalizeMaterialOnHand } from '../../domain/materialInventory';

export type MaterialStockFilter = 'all' | 'in-stock' | 'out-of-stock' | 'needs-attention';

export function materialInventoryRow(material: Material, evidence: readonly MaterialCalibrationEvidence[]) {
  const issues: string[] = [];
  function read<T>(derive: () => T): T | null {
    try {
      return derive();
    } catch (error) {
      issues.push(error instanceof Error ? error.message : 'Check material conversion data.');
      return null;
    }
  }
  const costing = read(() => calculateMaterialPackageCosting(material, evidence));
  const stock = read(() => normalizeMaterialOnHand(material, evidence));
  const valuation = read(() => calculateMaterialInventoryValuation(material, evidence));
  const stockState: Exclude<MaterialStockFilter, 'all'> =
    issues.length > 0 ? 'needs-attention' : stock?.normalizedBaseQuantity === 0 ? 'out-of-stock' : 'in-stock';
  return { material, costing, stock, valuation, stockState, issues: [...new Set(issues)] };
}

export type MaterialInventoryRow = ReturnType<typeof materialInventoryRow>;

export function inventoryOverview(rows: readonly MaterialInventoryRow[]) {
  const active = rows.filter((row) => row.material.isActive);
  const knownValue = active.reduce((sum, row) => sum + (row.valuation?.inventoryValue ?? 0), 0);
  return {
    activeCount: active.length,
    outOfStock: active.filter((row) => row.stockState === 'out-of-stock').length,
    needsAttention: active.filter((row) => row.stockState === 'needs-attention').length,
    // Keep unvalued materials visible instead of representing the known subtotal as a complete total.
    unvalued: active.filter((row) => row.valuation === null).length,
    knownValue: Number.isFinite(knownValue) ? knownValue : null,
  };
}

export function matchesMaterialSearch(material: Material, query: string): boolean {
  const search = query.trim().toLocaleLowerCase();
  return [
    material.id,
    material.name,
    material.group,
    material.notes ?? '',
    ...Object.values(material.source ?? {}),
  ].some((value) => value?.toLocaleLowerCase().includes(search));
}
