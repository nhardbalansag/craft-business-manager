import {
  ProductionRequirementError,
  type ProductionRequirementErrorCode,
} from '../../domain/productionRequirements';
import {
  FullyLoadedProductUnitCostServiceError,
  type FullyLoadedProductUnitCostResult,
  type FullyLoadedProductUnitCostStatus,
  type FullyLoadedRootDirectMaterialMode,
} from '../productCosts/FullyLoadedProductUnitCostService';
import type { ProductionRequirementPlanResult } from './ProductionRequirementService';

export type PhysicalPlannedBatchProductionCostStatus = 'ready' | 'partial' | 'not-ready';
export type PhysicalPlannedBatchLineStatus = 'ready' | 'not-ready';

export type PhysicalPlannedBatchProductionCostIssueCode =
  | 'COST_PRODUCT_MISMATCH'
  | 'PRODUCTION_PLAN_PRODUCT_MISMATCH'
  | 'PRODUCT_ACTIVE_STATE_MISMATCH'
  | 'PRODUCTION_PLAN_QUANTITY_MISMATCH'
  | 'UPSTREAM_COST_PARTIAL'
  | 'UPSTREAM_COST_NOT_READY'
  | 'DIRECT_MATERIAL_PARTIAL'
  | 'DIRECT_MATERIAL_NOT_READY'
  | 'DIRECT_MATERIAL_EVIDENCE_MISSING'
  | 'DIRECT_MATERIAL_REQUIREMENT_MISSING'
  | 'DIRECT_MATERIAL_BASE_UNIT_MISMATCH'
  | 'DIRECT_MATERIAL_QUANTITY_INVALID'
  | 'DIRECT_MATERIAL_COST_INVALID'
  | 'NEUTRAL_DIRECT_MATERIAL_CONTRADICTION'
  | 'MATERIAL_COMPONENT_NOT_READY'
  | 'PRODUCT_COMPONENT_PARTIAL'
  | 'PRODUCT_COMPONENT_NOT_READY'
  | 'COMPONENT_COST_INVALID'
  | 'LABOR_COST_NOT_READY'
  | 'OVERHEAD_COST_NOT_READY'
  | 'DERIVED_COST_INVALID'
  | 'COST_RECONCILIATION_FAILED';

export interface PhysicalPlannedBatchProductionCostIssue {
  code: PhysicalPlannedBatchProductionCostIssueCode;
  message: string;
  productId: string;
  materialId?: string;
  componentId?: string;
  sourceId?: string;
  underlyingCode?: string;
}

export interface PhysicalPlannedBatchDirectMaterialCostLine {
  materialId: string;
  baseUnit: ProductionRequirementPlanResult['requirements'][number]['baseUnit'];
  source: ProductionRequirementPlanResult['requirements'][number]['source'];
  status: PhysicalPlannedBatchLineStatus;
  plannedBaseQuantityPerProduct: number;
  requestedQuantity: number;
  preciseBatchBaseQuantity: number;
  physicalBatchBaseQuantity: number;
  countRoundingExtraBaseQuantity: number;
  costPerBaseUnit: number | null;
  preciseBatchCost: number | null;
  countRoundingExtraCost: number | null;
  knownPlannedBatchCost: number | null;
  plannedBatchCost: number | null;
  issues: PhysicalPlannedBatchProductionCostIssue[];
}

export interface PhysicalPlannedBatchMaterialComponentCostLine {
  componentId: string;
  sourceMaterialId: string;
  sourceMaterialName: string | null;
  role: string;
  status: PhysicalPlannedBatchLineStatus;
  quantityPerParent: number;
  requestedQuantity: number;
  plannedComponentQuantity: number | null;
  costPerPc: number | null;
  perParentCostContribution: number | null;
  knownPlannedBatchCost: number | null;
  plannedBatchCost: number | null;
  issues: PhysicalPlannedBatchProductionCostIssue[];
}

export interface PhysicalPlannedBatchProductComponentCostLine {
  componentId: string;
  childProductId: string;
  childProductName: string | null;
  role: string;
  path: readonly string[];
  status: PhysicalPlannedBatchLineStatus;
  upstreamStatus: 'ready' | 'partial' | 'not-ready';
  quantityPerParent: number;
  requestedQuantity: number;
  plannedChildQuantity: number | null;
  childFullyLoadedUnitCost: number | null;
  knownPerParentCostContribution: number | null;
  perParentCostContribution: number | null;
  knownPlannedBatchCost: number | null;
  plannedBatchCost: number | null;
  issues: PhysicalPlannedBatchProductionCostIssue[];
}

export interface PhysicalPlannedBatchProductionCostResult {
  productId: string;
  productName: string;
  productIsActive: boolean;
  status: PhysicalPlannedBatchProductionCostStatus;
  unitCostStatus: FullyLoadedProductUnitCostStatus;
  requirementStatus: ProductionRequirementPlanResult['status'];
  plannedQuantity: number;
  productionRequirements: ProductionRequirementPlanResult;
  unitCostEvidence: FullyLoadedProductUnitCostResult;
  directMaterialMode: FullyLoadedRootDirectMaterialMode;
  directMaterialLines: PhysicalPlannedBatchDirectMaterialCostLine[];
  materialComponentLines: PhysicalPlannedBatchMaterialComponentCostLine[];
  productComponentLines: PhysicalPlannedBatchProductComponentCostLine[];
  plannedDirectMaterialCostSubtotal: number;
  plannedMaterialComponentCostSubtotal: number;
  plannedProductComponentCostSubtotal: number;
  laborCostPerUnit: number | null;
  laborBatchCost: number | null;
  overheadCostPerUnit: number | null;
  overheadBatchCost: number | null;
  knownPlannedProductionCostSubtotal: number | null;
  plannedProductionCost: number | null;
  standardUnitCostTimesQuantity: number | null;
  physicalVsStandardCostDifference: number | null;
  issues: PhysicalPlannedBatchProductionCostIssue[];
}

export type PhysicalPlannedBatchProductionCostServiceErrorCode =
  | 'PRODUCT_NOT_FOUND'
  | 'INVALID_PLANNED_QUANTITY'
  | 'PRODUCTION_REQUIREMENT_INVALID';

export class PhysicalPlannedBatchProductionCostServiceError extends Error {
  readonly code: PhysicalPlannedBatchProductionCostServiceErrorCode;
  readonly productId: string;
  readonly plannedQuantity: number;
  readonly underlyingCode?: ProductionRequirementErrorCode;

  constructor(
    code: PhysicalPlannedBatchProductionCostServiceErrorCode,
    message: string,
    context: {
      productId: string;
      plannedQuantity: number;
      underlyingCode?: ProductionRequirementErrorCode;
    },
  ) {
    super(message);
    this.name = 'PhysicalPlannedBatchProductionCostServiceError';
    this.code = code;
    this.productId = context.productId;
    this.plannedQuantity = context.plannedQuantity;
    this.underlyingCode = context.underlyingCode;
  }
}

export interface PhysicalPlannedBatchProductionRequirementProvider {
  plan(productId: string, plannedQuantity: number): Promise<ProductionRequirementPlanResult>;
}

export interface PhysicalPlannedBatchFullyLoadedCostProvider {
  costProduct(productId: string): Promise<FullyLoadedProductUnitCostResult>;
}

function comparable(value: string): string {
  return value.trim().toLowerCase();
}

function finiteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function finitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function invalidQuantityCode(code: ProductionRequirementErrorCode): boolean {
  return (
    code === 'NON_FINITE_PLANNED_QUANTITY' ||
    code === 'NEGATIVE_PLANNED_QUANTITY' ||
    code === 'NON_INTEGER_PLANNED_QUANTITY'
  );
}

function cloneRequirementPlan(value: ProductionRequirementPlanResult): ProductionRequirementPlanResult {
  return structuredClone(value);
}

function cloneUnitCost(value: FullyLoadedProductUnitCostResult): FullyLoadedProductUnitCostResult {
  return structuredClone(value);
}

function cloneIssue(
  issue: PhysicalPlannedBatchProductionCostIssue,
): PhysicalPlannedBatchProductionCostIssue {
  return { ...issue };
}

function sortedById<T>(values: readonly T[], getId: (value: T) => string): T[] {
  return [...values].sort((left, right) => comparable(getId(left)).localeCompare(comparable(getId(right))));
}

function validNeutralDirectPlan(plan: ProductionRequirementPlanResult): boolean {
  return (
    plan.requirements.length === 0 &&
    plan.status === 'not-ready' &&
    plan.issues.length > 0 &&
    plan.issues.every((issue) => issue.code === 'NO_REQUIREMENTS')
  );
}

/**
 * Phase 4.4A authoritative physical planned-batch production cost.
 *
 * Direct materials deliberately use the Phase 2 physical batch plan so indivisible
 * count materials round only at the final batch boundary. Component, labor, and
 * overhead cost evidence comes from the completed Phase 4.2C fully loaded cost view.
 * Selling price, revenue, profit, and capacity are intentionally outside this service.
 */
export class PhysicalPlannedBatchProductionCostService {
  constructor(
    private readonly requirements: PhysicalPlannedBatchProductionRequirementProvider,
    private readonly unitCosts: PhysicalPlannedBatchFullyLoadedCostProvider,
  ) {}

  async costPlannedBatch(
    productId: string,
    plannedQuantity: number,
  ): Promise<PhysicalPlannedBatchProductionCostResult> {
    const requestedProductId = productId.trim();

    let cost: FullyLoadedProductUnitCostResult;
    try {
      cost = await this.unitCosts.costProduct(requestedProductId);
    } catch (error) {
      if (error instanceof FullyLoadedProductUnitCostServiceError) {
        throw new PhysicalPlannedBatchProductionCostServiceError(
          'PRODUCT_NOT_FOUND',
          error.message,
          { productId: error.productId, plannedQuantity },
        );
      }
      throw error;
    }

    const canonicalProductId = cost.productId;
    let plan: ProductionRequirementPlanResult;
    try {
      plan = await this.requirements.plan(canonicalProductId, plannedQuantity);
    } catch (error) {
      if (error instanceof ProductionRequirementError) {
        throw new PhysicalPlannedBatchProductionCostServiceError(
          invalidQuantityCode(error.code) ? 'INVALID_PLANNED_QUANTITY' : 'PRODUCTION_REQUIREMENT_INVALID',
          error.message,
          {
            productId: canonicalProductId,
            plannedQuantity,
            underlyingCode: error.code,
          },
        );
      }
      throw error;
    }

    const issues: PhysicalPlannedBatchProductionCostIssue[] = [];
    let contradiction = false;

    if (comparable(requestedProductId) !== comparable(canonicalProductId)) {
      contradiction = true;
      issues.push({
        code: 'COST_PRODUCT_MISMATCH',
        message: `Requested Product ${requestedProductId}, but fully loaded cost evidence belongs to ${canonicalProductId}.`,
        productId: requestedProductId,
      });
    }

    if (comparable(plan.productId) !== comparable(canonicalProductId)) {
      contradiction = true;
      issues.push({
        code: 'PRODUCTION_PLAN_PRODUCT_MISMATCH',
        message: `Physical production plan belongs to ${plan.productId}, not Product ${canonicalProductId}.`,
        productId: canonicalProductId,
      });
    }

    if (plan.productIsActive !== cost.productIsActive) {
      contradiction = true;
      issues.push({
        code: 'PRODUCT_ACTIVE_STATE_MISMATCH',
        message: `Physical production plan and fully loaded cost evidence disagree on active state for Product ${canonicalProductId}.`,
        productId: canonicalProductId,
      });
    }

    if (plan.plannedQuantity !== plannedQuantity) {
      contradiction = true;
      issues.push({
        code: 'PRODUCTION_PLAN_QUANTITY_MISMATCH',
        message: `Requested quantity ${plannedQuantity}, but physical production plan returned ${plan.plannedQuantity}.`,
        productId: canonicalProductId,
      });
    }

    if (cost.status === 'partial') {
      issues.push({
        code: 'UPSTREAM_COST_PARTIAL',
        message: `Product ${canonicalProductId} has only partial Phase 4.2C fully loaded cost evidence.`,
        productId: canonicalProductId,
      });
    } else if (cost.status === 'not-ready') {
      issues.push({
        code: 'UPSTREAM_COST_NOT_READY',
        message: `Product ${canonicalProductId} has no ready Phase 4.2C fully loaded cost basis.`,
        productId: canonicalProductId,
      });
    }

    const directMaterialLines: PhysicalPlannedBatchDirectMaterialCostLine[] = [];
    let directKnownSubtotal = 0;
    let directKnown = false;
    let directComplete = false;

    if (cost.directMaterialMode === 'neutral-component-only') {
      directKnown = true;
      directComplete = validNeutralDirectPlan(plan);
      if (!directComplete) {
        contradiction = true;
        issues.push({
          code: 'NEUTRAL_DIRECT_MATERIAL_CONTRADICTION',
          message: `Product ${canonicalProductId} is marked component-only by 4.2C, but its current physical direct-material plan is not a matching NO_REQUIREMENTS result.`,
          productId: canonicalProductId,
        });
      }
    } else {
      const directEvidence = cost.directMaterialCost;
      if (!directEvidence) {
        issues.push({
          code: 'DIRECT_MATERIAL_EVIDENCE_MISSING',
          message: `Product ${canonicalProductId} has no Phase 4 direct-material cost evidence for physical batch costing.`,
          productId: canonicalProductId,
        });
      } else {
        if (plan.status === 'partial' || directEvidence.status === 'partial') {
          issues.push({
            code: 'DIRECT_MATERIAL_PARTIAL',
            message: `Product ${canonicalProductId} has only partial direct-material evidence for the requested physical batch.`,
            productId: canonicalProductId,
          });
        } else if (plan.status === 'not-ready' || directEvidence.status === 'not-ready') {
          issues.push({
            code: 'DIRECT_MATERIAL_NOT_READY',
            message: `Product ${canonicalProductId} does not have ready direct-material evidence for the requested physical batch.`,
            productId: canonicalProductId,
          });
        }

        const costByMaterial = new Map(
          directEvidence.lines.map((line) => [comparable(line.materialId), line] as const),
        );
        const matched = new Set<string>();
        let allDirectLinesReady = true;

        for (const requirement of sortedById(plan.requirements, (line) => line.materialId)) {
          const key = comparable(requirement.materialId);
          const costLine = costByMaterial.get(key);
          const lineIssues: PhysicalPlannedBatchProductionCostIssue[] = [];

          const preciseBatchBaseQuantity = requirement.plannedBaseQuantityPerProduct * plannedQuantity;
          const physicalBatchBaseQuantity = requirement.plannedBatchBaseQuantity;
          const countRoundingExtraBaseQuantity = physicalBatchBaseQuantity - preciseBatchBaseQuantity;

          if (
            !finiteNonNegative(requirement.plannedBaseQuantityPerProduct) ||
            !finiteNonNegative(preciseBatchBaseQuantity) ||
            !finiteNonNegative(physicalBatchBaseQuantity) ||
            !finiteNonNegative(countRoundingExtraBaseQuantity)
          ) {
            contradiction = true;
            allDirectLinesReady = false;
            const issue: PhysicalPlannedBatchProductionCostIssue = {
              code: 'DIRECT_MATERIAL_QUANTITY_INVALID',
              message: `Material ${requirement.materialId} produced an invalid physical batch quantity.`,
              productId: canonicalProductId,
              materialId: requirement.materialId,
            };
            issues.push(issue);
            lineIssues.push(issue);
          }

          if (!costLine) {
            contradiction = true;
            allDirectLinesReady = false;
            const issue: PhysicalPlannedBatchProductionCostIssue = {
              code: 'DIRECT_MATERIAL_EVIDENCE_MISSING',
              message: `Material ${requirement.materialId} is required by the physical plan but has no matching 4.2C direct-material cost evidence.`,
              productId: canonicalProductId,
              materialId: requirement.materialId,
            };
            issues.push(issue);
            lineIssues.push(issue);
            directMaterialLines.push({
              materialId: requirement.materialId,
              baseUnit: requirement.baseUnit,
              source: requirement.source,
              status: 'not-ready',
              plannedBaseQuantityPerProduct: requirement.plannedBaseQuantityPerProduct,
              requestedQuantity: plannedQuantity,
              preciseBatchBaseQuantity,
              physicalBatchBaseQuantity,
              countRoundingExtraBaseQuantity,
              costPerBaseUnit: null,
              preciseBatchCost: null,
              countRoundingExtraCost: null,
              knownPlannedBatchCost: null,
              plannedBatchCost: null,
              issues: lineIssues.map(cloneIssue),
            });
            continue;
          }

          matched.add(key);

          if (costLine.baseUnit !== requirement.baseUnit) {
            contradiction = true;
            allDirectLinesReady = false;
            const issue: PhysicalPlannedBatchProductionCostIssue = {
              code: 'DIRECT_MATERIAL_BASE_UNIT_MISMATCH',
              message: `Material ${requirement.materialId} physical plan uses ${requirement.baseUnit}, but cost evidence uses ${costLine.baseUnit}.`,
              productId: canonicalProductId,
              materialId: requirement.materialId,
            };
            issues.push(issue);
            lineIssues.push(issue);
          }

          const costPerBaseUnit = costLine.costPerBaseUnit;
          let preciseBatchCost: number | null = null;
          let countRoundingExtraCost: number | null = null;
          let knownPlannedBatchCost: number | null = null;

          if (costPerBaseUnit === null || !finiteNonNegative(costPerBaseUnit)) {
            allDirectLinesReady = false;
            const issue: PhysicalPlannedBatchProductionCostIssue = {
              code: 'DIRECT_MATERIAL_COST_INVALID',
              message: `Material ${requirement.materialId} has no finite non-negative cost-per-base-unit evidence.`,
              productId: canonicalProductId,
              materialId: requirement.materialId,
            };
            issues.push(issue);
            lineIssues.push(issue);
          } else if (
            finiteNonNegative(preciseBatchBaseQuantity) &&
            finiteNonNegative(physicalBatchBaseQuantity) &&
            finiteNonNegative(countRoundingExtraBaseQuantity)
          ) {
            preciseBatchCost = preciseBatchBaseQuantity * costPerBaseUnit;
            countRoundingExtraCost = countRoundingExtraBaseQuantity * costPerBaseUnit;
            knownPlannedBatchCost = physicalBatchBaseQuantity * costPerBaseUnit;

            if (
              !finiteNonNegative(preciseBatchCost) ||
              !finiteNonNegative(countRoundingExtraCost) ||
              !finiteNonNegative(knownPlannedBatchCost)
            ) {
              contradiction = true;
              allDirectLinesReady = false;
              preciseBatchCost = null;
              countRoundingExtraCost = null;
              knownPlannedBatchCost = null;
              const issue: PhysicalPlannedBatchProductionCostIssue = {
                code: 'DERIVED_COST_INVALID',
                message: `Material ${requirement.materialId} produced an invalid physical batch cost.`,
                productId: canonicalProductId,
                materialId: requirement.materialId,
              };
              issues.push(issue);
              lineIssues.push(issue);
            } else {
              directKnown = true;
              directKnownSubtotal += knownPlannedBatchCost;
            }
          }

          if (costLine.status !== 'ready') {
            allDirectLinesReady = false;
          }

          const lineReady =
            lineIssues.length === 0 &&
            costLine.status === 'ready' &&
            knownPlannedBatchCost !== null;

          directMaterialLines.push({
            materialId: requirement.materialId,
            baseUnit: requirement.baseUnit,
            source: requirement.source,
            status: lineReady ? 'ready' : 'not-ready',
            plannedBaseQuantityPerProduct: requirement.plannedBaseQuantityPerProduct,
            requestedQuantity: plannedQuantity,
            preciseBatchBaseQuantity,
            physicalBatchBaseQuantity,
            countRoundingExtraBaseQuantity,
            costPerBaseUnit: costPerBaseUnit !== null && finiteNonNegative(costPerBaseUnit) ? costPerBaseUnit : null,
            preciseBatchCost,
            countRoundingExtraCost,
            knownPlannedBatchCost,
            plannedBatchCost: lineReady ? knownPlannedBatchCost : null,
            issues: lineIssues.map(cloneIssue),
          });
        }

        for (const costLine of directEvidence.lines) {
          const key = comparable(costLine.materialId);
          if (matched.has(key)) continue;
          contradiction = true;
          allDirectLinesReady = false;
          issues.push({
            code: 'DIRECT_MATERIAL_REQUIREMENT_MISSING',
            message: `Material ${costLine.materialId} has 4.2C direct-material cost evidence but is absent from the current physical production plan.`,
            productId: canonicalProductId,
            materialId: costLine.materialId,
          });
        }

        directComplete =
          cost.directMaterialMode === 'costed' &&
          plan.status === 'ready' &&
          directEvidence.status === 'ready' &&
          allDirectLinesReady &&
          plan.requirements.length === directEvidence.lines.length;
      }
    }

    const materialComponentLines: PhysicalPlannedBatchMaterialComponentCostLine[] = [];
    const productComponentLines: PhysicalPlannedBatchProductComponentCostLine[] = [];
    let materialComponentKnownSubtotal = 0;
    let productComponentKnownSubtotal = 0;
    let materialComponentKnown = false;
    let productComponentKnown = false;
    let componentsComplete = true;

    for (const entry of cost.componentLines) {
      if (entry.sourceType === 'material') {
        const line = entry.line;
        const lineIssues: PhysicalPlannedBatchProductionCostIssue[] = [];
        let plannedComponentQuantity: number | null = null;
        let knownPlannedBatchCost: number | null = null;

        if (!finitePositive(line.quantityPerParent)) {
          contradiction = true;
          componentsComplete = false;
          const issue: PhysicalPlannedBatchProductionCostIssue = {
            code: 'COMPONENT_COST_INVALID',
            message: `Material-backed component ${line.componentId} has an invalid quantity-per-parent.`,
            productId: canonicalProductId,
            componentId: line.componentId,
            sourceId: line.sourceMaterialId,
          };
          issues.push(issue);
          lineIssues.push(issue);
        } else {
          plannedComponentQuantity = line.quantityPerParent * plannedQuantity;
          if (!finiteNonNegative(plannedComponentQuantity)) {
            contradiction = true;
            componentsComplete = false;
            plannedComponentQuantity = null;
            const issue: PhysicalPlannedBatchProductionCostIssue = {
              code: 'DERIVED_COST_INVALID',
              message: `Material-backed component ${line.componentId} produced an invalid planned batch quantity.`,
              productId: canonicalProductId,
              componentId: line.componentId,
              sourceId: line.sourceMaterialId,
            };
            issues.push(issue);
            lineIssues.push(issue);
          }
        }

        const contribution = line.componentCostContribution;
        if (contribution !== null && finiteNonNegative(contribution)) {
          knownPlannedBatchCost = contribution * plannedQuantity;
          if (finiteNonNegative(knownPlannedBatchCost)) {
            materialComponentKnown = true;
            materialComponentKnownSubtotal += knownPlannedBatchCost;
          } else {
            contradiction = true;
            componentsComplete = false;
            knownPlannedBatchCost = null;
            const issue: PhysicalPlannedBatchProductionCostIssue = {
              code: 'DERIVED_COST_INVALID',
              message: `Material-backed component ${line.componentId} produced an invalid planned batch cost.`,
              productId: canonicalProductId,
              componentId: line.componentId,
              sourceId: line.sourceMaterialId,
            };
            issues.push(issue);
            lineIssues.push(issue);
          }
        } else if (contribution !== null) {
          contradiction = true;
          componentsComplete = false;
          const issue: PhysicalPlannedBatchProductionCostIssue = {
            code: 'COMPONENT_COST_INVALID',
            message: `Material-backed component ${line.componentId} has an invalid per-parent cost contribution.`,
            productId: canonicalProductId,
            componentId: line.componentId,
            sourceId: line.sourceMaterialId,
          };
          issues.push(issue);
          lineIssues.push(issue);
        }

        if (line.status !== 'ready' || contribution === null) {
          componentsComplete = false;
          const issue: PhysicalPlannedBatchProductionCostIssue = {
            code: 'MATERIAL_COMPONENT_NOT_READY',
            message: `Material-backed component ${line.componentId} is not ready for physical batch costing.`,
            productId: canonicalProductId,
            componentId: line.componentId,
            sourceId: line.sourceMaterialId,
            underlyingCode: line.issues[0]?.code,
          };
          issues.push(issue);
          lineIssues.push(issue);
        }

        const lineReady =
          lineIssues.length === 0 &&
          line.status === 'ready' &&
          plannedComponentQuantity !== null &&
          knownPlannedBatchCost !== null;

        materialComponentLines.push({
          componentId: line.componentId,
          sourceMaterialId: line.sourceMaterialId,
          sourceMaterialName: line.sourceMaterialName,
          role: line.role,
          status: lineReady ? 'ready' : 'not-ready',
          quantityPerParent: line.quantityPerParent,
          requestedQuantity: plannedQuantity,
          plannedComponentQuantity,
          costPerPc: line.costPerPc !== null && finiteNonNegative(line.costPerPc) ? line.costPerPc : null,
          perParentCostContribution:
            contribution !== null && finiteNonNegative(contribution) ? contribution : null,
          knownPlannedBatchCost,
          plannedBatchCost: lineReady ? knownPlannedBatchCost : null,
          issues: lineIssues.map(cloneIssue),
        });
      } else {
        const line = entry.line;
        const lineIssues: PhysicalPlannedBatchProductionCostIssue[] = [];
        let plannedChildQuantity: number | null = null;
        let knownPlannedBatchCost: number | null = null;

        if (!finitePositive(line.quantityPerParent)) {
          contradiction = true;
          componentsComplete = false;
          const issue: PhysicalPlannedBatchProductionCostIssue = {
            code: 'COMPONENT_COST_INVALID',
            message: `Product-backed component ${line.componentId} has an invalid quantity-per-parent.`,
            productId: canonicalProductId,
            componentId: line.componentId,
            sourceId: line.childProductId,
          };
          issues.push(issue);
          lineIssues.push(issue);
        } else {
          plannedChildQuantity = line.quantityPerParent * plannedQuantity;
          if (!finiteNonNegative(plannedChildQuantity)) {
            contradiction = true;
            componentsComplete = false;
            plannedChildQuantity = null;
            const issue: PhysicalPlannedBatchProductionCostIssue = {
              code: 'DERIVED_COST_INVALID',
              message: `Product-backed component ${line.componentId} produced an invalid planned child quantity.`,
              productId: canonicalProductId,
              componentId: line.componentId,
              sourceId: line.childProductId,
            };
            issues.push(issue);
            lineIssues.push(issue);
          }
        }

        const knownContribution = line.knownComponentCostContribution;
        if (knownContribution !== null && finiteNonNegative(knownContribution)) {
          knownPlannedBatchCost = knownContribution * plannedQuantity;
          if (finiteNonNegative(knownPlannedBatchCost)) {
            productComponentKnown = true;
            productComponentKnownSubtotal += knownPlannedBatchCost;
          } else {
            contradiction = true;
            componentsComplete = false;
            knownPlannedBatchCost = null;
            const issue: PhysicalPlannedBatchProductionCostIssue = {
              code: 'DERIVED_COST_INVALID',
              message: `Product-backed component ${line.componentId} produced an invalid known planned batch cost.`,
              productId: canonicalProductId,
              componentId: line.componentId,
              sourceId: line.childProductId,
            };
            issues.push(issue);
            lineIssues.push(issue);
          }
        } else if (knownContribution !== null) {
          contradiction = true;
          componentsComplete = false;
          const issue: PhysicalPlannedBatchProductionCostIssue = {
            code: 'COMPONENT_COST_INVALID',
            message: `Product-backed component ${line.componentId} has an invalid known per-parent cost contribution.`,
            productId: canonicalProductId,
            componentId: line.componentId,
            sourceId: line.childProductId,
          };
          issues.push(issue);
          lineIssues.push(issue);
        }

        const authoritativeContribution = line.componentCostContribution;
        if (
          authoritativeContribution !== null &&
          !finiteNonNegative(authoritativeContribution)
        ) {
          contradiction = true;
          componentsComplete = false;
          const issue: PhysicalPlannedBatchProductionCostIssue = {
            code: 'COMPONENT_COST_INVALID',
            message: `Product-backed component ${line.componentId} has an invalid authoritative per-parent cost contribution.`,
            productId: canonicalProductId,
            componentId: line.componentId,
            sourceId: line.childProductId,
          };
          issues.push(issue);
          lineIssues.push(issue);
        }

        if (line.status !== 'ready' || authoritativeContribution === null) {
          componentsComplete = false;
          const issue: PhysicalPlannedBatchProductionCostIssue = {
            code:
              line.status === 'partial'
                ? 'PRODUCT_COMPONENT_PARTIAL'
                : 'PRODUCT_COMPONENT_NOT_READY',
            message:
              line.status === 'partial'
                ? `Product-backed component ${line.componentId} has only partial fully loaded cost evidence.`
                : `Product-backed component ${line.componentId} is not ready for physical batch costing.`,
            productId: canonicalProductId,
            componentId: line.componentId,
            sourceId: line.childProductId,
            underlyingCode: line.issues[0]?.code,
          };
          issues.push(issue);
          lineIssues.push(issue);
        }

        let authoritativeBatchCost: number | null = null;
        if (
          line.status === 'ready' &&
          authoritativeContribution !== null &&
          finiteNonNegative(authoritativeContribution)
        ) {
          authoritativeBatchCost = authoritativeContribution * plannedQuantity;
          if (!finiteNonNegative(authoritativeBatchCost)) {
            contradiction = true;
            componentsComplete = false;
            authoritativeBatchCost = null;
            const issue: PhysicalPlannedBatchProductionCostIssue = {
              code: 'DERIVED_COST_INVALID',
              message: `Product-backed component ${line.componentId} produced an invalid authoritative batch cost.`,
              productId: canonicalProductId,
              componentId: line.componentId,
              sourceId: line.childProductId,
            };
            issues.push(issue);
            lineIssues.push(issue);
          }
        }

        const lineReady =
          lineIssues.length === 0 &&
          line.status === 'ready' &&
          plannedChildQuantity !== null &&
          authoritativeBatchCost !== null;

        productComponentLines.push({
          componentId: line.componentId,
          childProductId: line.childProductId,
          childProductName: line.childProductName,
          role: line.role,
          path: [...line.path],
          status: lineReady ? 'ready' : 'not-ready',
          upstreamStatus: line.status,
          quantityPerParent: line.quantityPerParent,
          requestedQuantity: plannedQuantity,
          plannedChildQuantity,
          childFullyLoadedUnitCost:
            line.childFullyLoadedUnitCost !== null && finiteNonNegative(line.childFullyLoadedUnitCost)
              ? line.childFullyLoadedUnitCost
              : null,
          knownPerParentCostContribution:
            knownContribution !== null && finiteNonNegative(knownContribution)
              ? knownContribution
              : null,
          perParentCostContribution:
            authoritativeContribution !== null && finiteNonNegative(authoritativeContribution)
              ? authoritativeContribution
              : null,
          knownPlannedBatchCost,
          plannedBatchCost: lineReady ? authoritativeBatchCost : null,
          issues: lineIssues.map(cloneIssue),
        });
      }
    }

    const laborKnown = cost.laborCostPerUnit !== null && finiteNonNegative(cost.laborCostPerUnit);
    const overheadKnown =
      cost.overheadCostPerUnit !== null && finiteNonNegative(cost.overheadCostPerUnit);

    let laborBatchCost: number | null = laborKnown ? cost.laborCostPerUnit! * plannedQuantity : null;
    let overheadBatchCost: number | null = overheadKnown
      ? cost.overheadCostPerUnit! * plannedQuantity
      : null;

    if (cost.laborCostPerUnit === null) {
      issues.push({
        code: 'LABOR_COST_NOT_READY',
        message: `Product ${canonicalProductId} has no ready root labor cost evidence.`,
        productId: canonicalProductId,
      });
    } else if (!laborKnown || laborBatchCost === null || !finiteNonNegative(laborBatchCost)) {
      contradiction = true;
      laborBatchCost = null;
      issues.push({
        code: 'DERIVED_COST_INVALID',
        message: `Product ${canonicalProductId} produced an invalid root labor batch cost.`,
        productId: canonicalProductId,
      });
    }

    if (cost.overheadCostPerUnit === null) {
      issues.push({
        code: 'OVERHEAD_COST_NOT_READY',
        message: `Product ${canonicalProductId} has no ready root overhead cost evidence.`,
        productId: canonicalProductId,
      });
    } else if (!overheadKnown || overheadBatchCost === null || !finiteNonNegative(overheadBatchCost)) {
      contradiction = true;
      overheadBatchCost = null;
      issues.push({
        code: 'DERIVED_COST_INVALID',
        message: `Product ${canonicalProductId} produced an invalid root overhead batch cost.`,
        productId: canonicalProductId,
      });
    }

    const hasKnownEvidence =
      directKnown ||
      materialComponentKnown ||
      productComponentKnown ||
      laborKnown ||
      overheadKnown;

    let knownPlannedProductionCostSubtotal: number | null = hasKnownEvidence
      ? directKnownSubtotal +
        materialComponentKnownSubtotal +
        productComponentKnownSubtotal +
        (laborBatchCost ?? 0) +
        (overheadBatchCost ?? 0)
      : null;

    if (
      knownPlannedProductionCostSubtotal !== null &&
      !finiteNonNegative(knownPlannedProductionCostSubtotal)
    ) {
      contradiction = true;
      knownPlannedProductionCostSubtotal = null;
      issues.push({
        code: 'DERIVED_COST_INVALID',
        message: `Product ${canonicalProductId} produced an invalid known physical batch cost subtotal.`,
        productId: canonicalProductId,
      });
    }

    const financialComplete = laborKnown && overheadKnown && laborBatchCost !== null && overheadBatchCost !== null;
    const allEvidenceComplete =
      cost.status === 'ready' && directComplete && componentsComplete && financialComplete;

    let status: PhysicalPlannedBatchProductionCostStatus;
    if (contradiction || cost.status === 'not-ready') {
      status = 'not-ready';
    } else if (allEvidenceComplete) {
      status = 'ready';
    } else if (hasKnownEvidence) {
      status = 'partial';
    } else {
      status = 'not-ready';
    }

    let plannedProductionCost =
      status === 'ready' ? knownPlannedProductionCostSubtotal : null;

    if (status === 'ready' && plannedProductionCost === null) {
      contradiction = true;
      status = 'not-ready';
      issues.push({
        code: 'DERIVED_COST_INVALID',
        message: `Product ${canonicalProductId} reached ready state without an authoritative physical batch cost.`,
        productId: canonicalProductId,
      });
    }

    if (plannedProductionCost !== null) {
      const recomposed =
        directKnownSubtotal +
        materialComponentKnownSubtotal +
        productComponentKnownSubtotal +
        (laborBatchCost ?? 0) +
        (overheadBatchCost ?? 0);
      if (!finiteNonNegative(recomposed) || recomposed !== plannedProductionCost) {
        contradiction = true;
        plannedProductionCost = null;
        status = 'not-ready';
        issues.push({
          code: 'COST_RECONCILIATION_FAILED',
          message: `Product ${canonicalProductId} physical batch subtotals do not reconcile to the authoritative planned production cost.`,
          productId: canonicalProductId,
        });
      }
    }

    let standardUnitCostTimesQuantity: number | null = null;
    if (
      cost.totalFullyLoadedUnitCost !== null &&
      finiteNonNegative(cost.totalFullyLoadedUnitCost)
    ) {
      standardUnitCostTimesQuantity = cost.totalFullyLoadedUnitCost * plannedQuantity;
      if (!finiteNonNegative(standardUnitCostTimesQuantity)) {
        contradiction = true;
        standardUnitCostTimesQuantity = null;
        plannedProductionCost = null;
        status = 'not-ready';
        issues.push({
          code: 'DERIVED_COST_INVALID',
          message: `Product ${canonicalProductId} produced an invalid standard unit-cost batch comparison.`,
          productId: canonicalProductId,
        });
      }
    }

    let physicalVsStandardCostDifference: number | null = null;
    if (plannedProductionCost !== null && standardUnitCostTimesQuantity !== null) {
      physicalVsStandardCostDifference = plannedProductionCost - standardUnitCostTimesQuantity;
      if (!Number.isFinite(physicalVsStandardCostDifference)) {
        contradiction = true;
        physicalVsStandardCostDifference = null;
        plannedProductionCost = null;
        status = 'not-ready';
        issues.push({
          code: 'DERIVED_COST_INVALID',
          message: `Product ${canonicalProductId} produced an invalid physical-versus-standard cost difference.`,
          productId: canonicalProductId,
        });
      }
    }

    if (contradiction) {
      status = 'not-ready';
      plannedProductionCost = null;
      physicalVsStandardCostDifference = null;
    }

    return {
      productId: canonicalProductId,
      productName: cost.productName,
      productIsActive: cost.productIsActive,
      status,
      unitCostStatus: cost.status,
      requirementStatus: plan.status,
      plannedQuantity,
      productionRequirements: cloneRequirementPlan(plan),
      unitCostEvidence: cloneUnitCost(cost),
      directMaterialMode: cost.directMaterialMode,
      directMaterialLines: directMaterialLines.map((line) => ({
        ...line,
        issues: line.issues.map(cloneIssue),
      })),
      materialComponentLines: materialComponentLines.map((line) => ({
        ...line,
        issues: line.issues.map(cloneIssue),
      })),
      productComponentLines: productComponentLines.map((line) => ({
        ...line,
        path: [...line.path],
        issues: line.issues.map(cloneIssue),
      })),
      plannedDirectMaterialCostSubtotal: directKnownSubtotal,
      plannedMaterialComponentCostSubtotal: materialComponentKnownSubtotal,
      plannedProductComponentCostSubtotal: productComponentKnownSubtotal,
      laborCostPerUnit: laborKnown ? cost.laborCostPerUnit : null,
      laborBatchCost,
      overheadCostPerUnit: overheadKnown ? cost.overheadCostPerUnit : null,
      overheadBatchCost,
      knownPlannedProductionCostSubtotal,
      plannedProductionCost,
      standardUnitCostTimesQuantity,
      physicalVsStandardCostDifference,
      issues: issues.map(cloneIssue),
    };
  }
}
