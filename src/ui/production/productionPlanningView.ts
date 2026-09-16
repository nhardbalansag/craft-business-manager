import type { PlannedBatchCapacityFeasibilityResult } from '../../application/production/PlannedBatchCapacityFeasibilityService';

export function parsePlannedQuantity(value: string): number | null {
  const quantity = Number(value);
  return value.trim() !== '' && Number.isSafeInteger(quantity) && quantity >= 0 ? quantity : null;
}

export function stockShortfall(required: number, available: number | null | undefined): number | null {
  if (available == null || !Number.isFinite(available) || available < 0 || !Number.isFinite(required) || required < 0)
    return null;
  return Math.max(0, required - available);
}

export function capacityPlan(result: PlannedBatchCapacityFeasibilityResult | null) {
  const capacity = result?.currentAssemblyCapacity;
  if (
    !result ||
    result.feasibility === 'capacity-unresolved' ||
    capacity == null ||
    !Number.isSafeInteger(capacity) ||
    capacity < 0
  )
    return null;
  return {
    capacity,
    // A zero-capacity plan has no usable stock; avoid dividing by zero.
    percentage:
      capacity === 0
        ? result.plannedQuantity > 0
          ? 100
          : 0
        : Math.min(100, (result.plannedQuantity / capacity) * 100),
    remaining: Math.max(0, capacity - result.plannedQuantity),
  };
}
