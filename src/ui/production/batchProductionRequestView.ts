import type { PlannedBatchCapacityFeasibilityResult } from '../../application/production/PlannedBatchCapacityFeasibilityService';
import type { ProductionRequirementPlanResult } from '../../application/production/ProductionRequirementService';
import type { Material } from '../../domain/materials';
import { getProductCategoryRule, type Product } from '../../domain/products';
import type {
  ComponentRequirementRow,
  LimitingResourceRow,
  ProductionIssueRow,
} from './componentAwareProductionView';

export type BatchRequestReadinessStatus = 'ready' | 'partial' | 'not-ready';
export type BatchRequestMaterialStatus = 'covered' | 'shortage' | 'unresolved';

export interface BatchRequestMaterialRow {
  materialId: string;
  materialName: string;
  requiredQuantity: number;
  baseUnit: Material['baseUnit'];
  normalizedOnHandQuantity: number | null;
  shortageQuantity: number | null;
  capacityPieces: number | null;
  status: BatchRequestMaterialStatus;
}

export interface BatchRequestComponentRow {
  componentId: string;
  sourceType: ComponentRequirementRow['sourceType'];
  sourceId: string;
  sourceName: string;
  role: ComponentRequirementRow['role'];
  quantityPerParent: number;
  plannedQuantity: number;
  availableQuantity: number | null;
  capacityPieces: number | null;
  status: ComponentRequirementRow['capacityStatus'];
  issues: string[];
}

export interface BatchRequestIssue {
  source: string;
  message: string;
}

export interface BatchRequestFinancials {
  status: PlannedBatchCapacityFeasibilityResult['financials']['status'];
  plannedProductionCost: number | null;
  expectedRevenue: number | null;
  expectedProfit: number | null;
  batchMargin: number | null;
  averageCostPerFinishedUnit: number | null;
  sellingPrice: number | null;
  profitPerUnit: number | null;
}

export interface BatchProductionRequestView {
  requestReference: string;
  generatedAtIso: string;
  product: {
    id: string;
    name: string;
    category: Product['category'];
    categoryLabel: string;
    isActive: boolean;
    notes?: string;
  };
  plannedQuantity: number;
  safetyWastePercentage: number;
  effectiveYieldSampleId: string | null;
  readinessStatus: BatchRequestReadinessStatus;
  feasibility: PlannedBatchCapacityFeasibilityResult['feasibility'];
  currentAssemblyCapacity: number | null;
  overageQuantity: number | null;
  materials: BatchRequestMaterialRow[];
  components: BatchRequestComponentRow[];
  limitingResources: LimitingResourceRow[];
  warnings: string[];
  issues: BatchRequestIssue[];
  financials: BatchRequestFinancials;
}

export interface BuildBatchProductionRequestViewInput {
  product: Product;
  materials: readonly Material[];
  plan: ProductionRequirementPlanResult;
  feasibility: PlannedBatchCapacityFeasibilityResult;
  componentRows: readonly ComponentRequirementRow[];
  limitingRows: readonly LimitingResourceRow[];
  productionIssues: readonly ProductionIssueRow[];
  generatedAt?: Date;
}

function canonical(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function requestReference(productId: string, generatedAt: Date): string {
  const compactTimestamp = generatedAt
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
    .replace('T', '-');
  const compactProduct = productId
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'PRODUCT';
  return `PR-${compactTimestamp}-${compactProduct}`;
}

function uniqueMessages(messages: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of messages) {
    const message = value.trim();
    if (!message || seen.has(message)) continue;
    seen.add(message);
    result.push(message);
  }
  return result;
}

function buildMaterialRows(
  materials: readonly Material[],
  plan: ProductionRequirementPlanResult,
  feasibility: PlannedBatchCapacityFeasibilityResult,
): BatchRequestMaterialRow[] {
  const materialById = new Map(materials.map((material) => [canonical(material.id), material]));
  const capacityById = new Map(
    feasibility.capacityTrace.capacitySynthesis.directMaterialCapacity.materials.map((entry) => [
      canonical(entry.materialId),
      entry,
    ]),
  );

  return plan.requirements.map((requirement) => {
    const material = materialById.get(canonical(requirement.materialId));
    const capacity = capacityById.get(canonical(requirement.materialId));
    const onHand = capacity?.normalizedOnHandBaseQuantity ?? null;
    const shortage = onHand === null
      ? null
      : Math.max(requirement.plannedBatchBaseQuantity - onHand, 0);

    return {
      materialId: requirement.materialId,
      materialName: material?.name ?? requirement.materialId,
      requiredQuantity: requirement.plannedBatchBaseQuantity,
      baseUnit: requirement.baseUnit,
      normalizedOnHandQuantity: onHand,
      shortageQuantity: shortage,
      capacityPieces: capacity?.capacityPieces ?? null,
      status: onHand === null ? 'unresolved' : shortage > 0 ? 'shortage' : 'covered',
    };
  });
}

function buildWarnings(
  product: Product,
  feasibility: PlannedBatchCapacityFeasibilityResult,
): string[] {
  return uniqueMessages([
    ...(product.isActive ? [] : ['This product is archived. The sheet is a planning snapshot only.']),
    ...(feasibility.status === 'ready'
      ? []
      : [`Batch estimate readiness is ${feasibility.status}; unresolved values remain marked unavailable.`]),
    ...feasibility.warnings.map((warning) => warning.message),
  ]);
}

function buildIssues(
  productionIssues: readonly ProductionIssueRow[],
  feasibility: PlannedBatchCapacityFeasibilityResult,
): BatchRequestIssue[] {
  const candidates: BatchRequestIssue[] = [
    ...productionIssues.map((issue) => ({ source: issue.source, message: issue.message })),
    ...feasibility.issues.map((issue) => ({ source: 'Batch feasibility', message: issue.message })),
    ...feasibility.financials.issues.map((issue) => ({ source: 'Financials', message: issue.message })),
  ];
  const seen = new Set<string>();
  return candidates.filter((issue) => {
    const key = `${issue.source}|${issue.message.trim()}`;
    if (!issue.message.trim() || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Presentation-only snapshot for the printable Production Request / Batch Sheet.
 *
 * All production, capacity, yield and financial values are copied from the existing
 * authoritative application results. The only derived value here is display shortage
 * (required batch quantity minus known normalized on-hand quantity, floored at zero).
 */
export function buildBatchProductionRequestView({
  product,
  materials,
  plan,
  feasibility,
  componentRows,
  limitingRows,
  productionIssues,
  generatedAt = new Date(),
}: BuildBatchProductionRequestViewInput): BatchProductionRequestView {
  const financials = feasibility.financials;

  return {
    requestReference: requestReference(product.id, generatedAt),
    generatedAtIso: generatedAt.toISOString(),
    product: {
      id: product.id,
      name: product.name,
      category: product.category,
      categoryLabel: getProductCategoryRule(product.category).label,
      isActive: product.isActive,
      ...(product.notes ? { notes: product.notes } : {}),
    },
    plannedQuantity: feasibility.plannedQuantity,
    safetyWastePercentage: plan.safetyWastePercentage,
    effectiveYieldSampleId: plan.effectiveYieldSampleId,
    readinessStatus: feasibility.status,
    feasibility: feasibility.feasibility,
    currentAssemblyCapacity: feasibility.currentAssemblyCapacity,
    overageQuantity: feasibility.overageQuantity,
    materials: buildMaterialRows(materials, plan, feasibility),
    components: componentRows.map((row) => ({
      componentId: row.componentId,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      sourceName: row.sourceName,
      role: row.role,
      quantityPerParent: row.quantityPerParent,
      plannedQuantity: row.plannedQuantity,
      availableQuantity: row.availableQuantity,
      capacityPieces: row.capacityPieces,
      status: row.capacityStatus,
      issues: [...row.issues],
    })),
    limitingResources: limitingRows.map((row) => ({ ...row })),
    warnings: buildWarnings(product, feasibility),
    issues: buildIssues(productionIssues, feasibility),
    financials: {
      status: financials.status,
      plannedProductionCost: financials.plannedProductionCost,
      expectedRevenue: financials.expectedRevenue,
      expectedProfit: financials.expectedProfit,
      batchMargin: financials.batchMargin,
      averageCostPerFinishedUnit: financials.plannedAverageCostPerFinishedUnit,
      sellingPrice: financials.sellingPrice,
      profitPerUnit: financials.profitPerUnit,
    },
  };
}
