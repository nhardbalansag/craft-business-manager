import type {
  CapacityFeasibilityStatus,
  PlannedBatchCapacityFeasibilityResult,
  PlannedBatchCapacityFeasibilityStatus,
} from '../../application/production/PlannedBatchCapacityFeasibilityService';
import type { LimitingResource } from '../../application/production/AssemblyCapacityTraceService';

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2,
});

export interface FinancialLimiterRow {
  resourceType: LimitingResource['resourceType'];
  typeLabel: string;
  sourceId: string;
  sourceName: string;
  capacityPieces: number;
  evidence: string;
  pathLabel: string;
}

export function formatBatchMoney(value: number | null): string {
  return value !== null && Number.isFinite(value) ? peso.format(value) : '—';
}

export function formatBatchPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${(value * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

export function financialReadinessLabel(
  status: PlannedBatchCapacityFeasibilityStatus | 'ready' | 'partial' | 'not-ready',
): string {
  return status === 'not-ready' ? 'Not ready' : status[0].toUpperCase() + status.slice(1);
}

export function capacityFeasibilityLabel(status: CapacityFeasibilityStatus): string {
  switch (status) {
    case 'within-current-capacity':
      return 'Within current capacity';
    case 'over-current-capacity':
      return 'Over current capacity';
    case 'capacity-unresolved':
      return 'Capacity unresolved';
  }
}

function pathLabel(resource: LimitingResource): string {
  return resource.path.map((node) => node.name).join(' → ');
}

function limiterRow(resource: LimitingResource): FinancialLimiterRow {
  switch (resource.resourceType) {
    case 'material-requirement':
      return {
        resourceType: resource.resourceType,
        typeLabel: 'Direct material',
        sourceId: resource.materialId,
        sourceName: resource.materialName,
        capacityPieces: resource.capacityPieces,
        evidence: `${resource.normalizedOnHandBaseQuantity} ${resource.baseUnit} on hand · ${resource.plannedBaseQuantityPerProduct} ${resource.baseUnit} required per parent`,
        pathLabel: pathLabel(resource),
      };
    case 'material-backed-component':
      return {
        resourceType: resource.resourceType,
        typeLabel: 'Purchased component',
        sourceId: resource.materialId,
        sourceName: resource.materialName,
        capacityPieces: resource.capacityPieces,
        evidence: `${resource.availableQuantity} pc available · ${resource.quantityPerParent} pc required per parent`,
        pathLabel: pathLabel(resource),
      };
    case 'product-backed-component':
      return {
        resourceType: resource.resourceType,
        typeLabel: 'Handmade Product component',
        sourceId: resource.productId,
        sourceName: resource.productName,
        capacityPieces: resource.capacityPieces,
        evidence: `${resource.availableQuantity} pc available · ${resource.quantityPerParent} pc required per parent`,
        pathLabel: pathLabel(resource),
      };
  }
}

/**
 * Phase 4.5C presentation-only mapping.
 *
 * The authoritative limiter set is the 4.4C top-level set. This helper never
 * falls back to nested Phase 3 candidate limiters when 4.4C deliberately
 * publishes no authoritative top-level limiter explanation.
 */
export function buildFinancialLimiterRows(
  result: PlannedBatchCapacityFeasibilityResult | null,
): FinancialLimiterRow[] {
  return result ? result.limitingResources.map(limiterRow) : [];
}
