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

function cloneIssue(
  issue: PhysicalPlannedBatchProductionCostIssue,
): PhysicalPlannedBatchProductionCostIssue {
  return { ...issue };
}

function sortedById<T>(values: readonly T[], id: (value: T) => string): T[] {
  return [...values].sort((left, right) => comparable(id(left)).localeCompare(comparable(id(right))));
}

function validNeutralDirectPlan(plan: ProductionRequirementPlanResult): boolean {
  return (
    plan.requirements.length === 0 &&
    plan.status === 'not-ready' &&
    plan.issues.length > 0 &&
    plan.issues.every((issue) => issue.code === 'NO_REQUIREMENTS')
  );
}

/** Phase 4.4A authoritative physical planned-batch production cost. */
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
    const addIssue = (issue: PhysicalPlannedBatchProductionCostIssue) => issues.push(issue);

    if (comparable(requestedProductId) !== comparable(canonicalProductId)) {
      contradiction = true;
      addIssue({
        code: 'COST_PRODUCT_MISMATCH',
        message: `Requested Product ${requestedProductId}, but fully loaded cost evidence belongs to ${canonicalProductId}.`,
        productId: requestedProductId,
      });
    }
    if (comparable(plan.productId) !== comparable(canonicalProductId)) {
      contradiction = true;
      addIssue({
        code: 'PRODUCTION_PLAN_PRODUCT_MISMATCH',
        message: `Physical production plan belongs to ${plan.productId}, not Product ${canonicalProductId}.`,
        productId: canonicalProductId,
      });
    }
    if (plan.productIsActive !== cost.productIsActive) {
      contradiction = true;
      addIssue({
        code: 'PRODUCT_ACTIVE_STATE_MISMATCH',
        message: `Physical production plan and fully loaded cost evidence disagree on active state for Product ${canonicalProductId}.`,
        productId: canonicalProductId,
      });
    }
    if (plan.plannedQuantity !== plannedQuantity) {
      contradiction = true;
      addIssue({
        code: 'PRODUCTION_PLAN_QUANTITY_MISMATCH',
        message: `Requested quantity ${plannedQuantity}, but physical production plan returned ${plan.plannedQuantity}.`,
        productId: canonicalProductId,
      });
    }

    if (cost.status === 'partial') {
      addIssue({
        code: 'UPSTREAM_COST_PARTIAL',
        message: `Product ${canonicalProductId} has only partial Phase 4.2C fully loaded cost evidence.`,
        productId: canonicalProductId,
      });
    } else if (cost.status === 'not-ready') {
      addIssue({
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
        addIssue({
          code: 'NEUTRAL_DIRECT_MATERIAL_CONTRADICTION',
          message: `Product ${canonicalProductId} is marked component-only by 4.2C, but its physical direct-material plan is not a matching NO_REQUIREMENTS result.`,
          productId: canonicalProductId,
        });
      }
    } else {
      const directEvidence = cost.directMaterialCost;
      if (!directEvidence) {
        if (cost.directMaterialMode === 'costed') contradiction = true;
        addIssue({
          code: 'DIRECT_MATERIAL_EVIDENCE_MISSING',
          message: `Product ${canonicalProductId} has no Phase 4 direct-material cost evidence for physical batch costing.`,
          productId: canonicalProductId,
        });
      } else {
        if (plan.status === 'partial' || directEvidence.status === 'partial') {
          addIssue({
            code: 'DIRECT_MATERIAL_PARTIAL',
            message: `Product ${canonicalProductId} has only partial direct-material evidence for the requested physical batch.`,
            productId: canonicalProductId,
          });
        } else if (plan.status === 'not-ready' || directEvidence.status === 'not-ready') {
          addIssue({
            code: 'DIRECT_MATERIAL_NOT_READY',
            message: `Product ${canonicalProductId} does not have ready direct-material evidence for the requested physical batch.`,
            productId: canonicalProductId,
          });
        }

        const costByMaterial = new Map(
          directEvidence.lines.map((line) => [comparable(line.materialId), line] as const),
        );
        const matched = new Set<string>();
        let allLinesReady = true;

        for (const requirement of sortedById(plan.requirements, (line) => line.materialId)) {
          const key = comparable(requirement.materialId);
          const evidence = costByMaterial.get(key);
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
            allLinesReady = false;
            const issue: PhysicalPlannedBatchProductionCostIssue = {
              code: 'DIRECT_MATERIAL_QUANTITY_INVALID',
              message: `Material ${requirement.materialId} produced an invalid physical batch quantity.`,
              productId: canonicalProductId,
              materialId: requirement.materialId,
            };
            addIssue(issue);
            lineIssues.push(issue);
          }

          if (!evidence) {
            contradiction = true;
            allLinesReady = false;
            const issue: PhysicalPlannedBatchProductionCostIssue = {
              code: 'DIRECT_MATERIAL_EVIDENCE_MISSING',
              message: `Material ${requirement.materialId} is required by the physical plan but has no matching 4.2C direct-material cost evidence.`,
              productId: canonicalProductId,
              materialId: requirement.materialId,
            };
            addIssue(issue);
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

          if (evidence.baseUnit !== requirement.baseUnit) {
            contradiction = true;
            allLinesReady = false;
            const issue: PhysicalPlannedBatchProductionCostIssue = {
              code: 'DIRECT_MATERIAL_BASE_UNIT_MISMATCH',
              message: `Material ${requirement.materialId} physical plan uses ${requirement.baseUnit}, but cost evidence uses ${evidence.baseUnit}.`,
              productId: canonicalProductId,
              materialId: requirement.materialId,
            };
            addIssue(issue);
            lineIssues.push(issue);
          }

          let costPerBaseUnit: number | null = null;
          let preciseBatchCost: number | null = null;
          let countRoundingExtraCost: number | null = null;
          let knownPlannedBatchCost: number | null = null;

          if (evidence.costPerBaseUnit === null) {
            allLinesReady = false;
            const issue: PhysicalPlannedBatchProductionCostIssue = {
              code: 'DIRECT_MATERIAL_COST_INVALID',
              message: `Material ${requirement.materialId} has no resolved cost-per-base-unit evidence.`,
              productId: canonicalProductId,
              materialId: requirement.materialId,
            };
            addIssue(issue);
            lineIssues.push(issue);
          } else if (!finiteNonNegative(evidence.costPerBaseUnit)) {
            contradiction = true;
            allLinesReady = false;
            const issue: PhysicalPlannedBatchProductionCostIssue = {
              code: 'DIRECT_MATERIAL_COST_INVALID',
              message: `Material ${requirement.materialId} has invalid non-finite or negative cost-per-base-unit evidence.`,
              productId: canonicalProductId,
              materialId: requirement.materialId,
            };
            addIssue(issue);
            lineIssues.push(issue);
          } else if (
            finiteNonNegative(preciseBatchBaseQuantity) &&
            finiteNonNegative(physicalBatchBaseQuantity) &&
            finiteNonNegative(countRoundingExtraBaseQuantity)
          ) {
            costPerBaseUnit = evidence.costPerBaseUnit;
            preciseBatchCost = preciseBatchBaseQuantity * costPerBaseUnit;
            countRoundingExtraCost = countRoundingExtraBaseQuantity * costPerBaseUnit;
            knownPlannedBatchCost = physicalBatchBaseQuantity * costPerBaseUnit;
            if (
              !finiteNonNegative(preciseBatchCost) ||
              !finiteNonNegative(countRoundingExtraCost) ||
              !finiteNonNegative(knownPlannedBatchCost)
            ) {
              contradiction = true;
              allLinesReady = false;
              preciseBatchCost = null;
              countRoundingExtraCost = null;
              knownPlannedBatchCost = null;
              const issue: PhysicalPlannedBatchProductionCostIssue = {
                code: 'DERIVED_COST_INVALID',
                message: `Material ${requirement.materialId} produced an invalid physical batch cost.`,
                productId: canonicalProductId,
                materialId: requirement.materialId,
              };
              addIssue(issue);
              lineIssues.push(issue);
            } else {
              directKnown = true;
              directKnownSubtotal += knownPlannedBatchCost;
            }
          }

          if (evidence.status !== 'ready') allLinesReady = false;
          const lineReady =
            lineIssues.length === 0 &&
            evidence.status === 'ready' &&
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
            costPerBaseUnit,
            preciseBatchCost,
            countRoundingExtraCost,
            knownPlannedBatchCost,
            plannedBatchCost: lineReady ? knownPlannedBatchCost : null,
            issues: lineIssues.map(cloneIssue),
          });
        }

        for (const evidence of directEvidence.lines) {
          if (matched.has(comparable(evidence.materialId))) continue;
          contradiction = true;
          allLinesReady = false;
          addIssue({
            code: 'DIRECT_MATERIAL_REQUIREMENT_MISSING',
            message: `Material ${evidence.materialId} has 4.2C direct-material cost evidence but is absent from the current physical production plan.`,
            productId: canonicalProductId,
            materialId: evidence.materialId,
          });
        }

        directComplete =
          cost.directMaterialMode === 'costed' &&
          plan.status === 'ready' &&
          directEvidence.status === 'ready' &&
          allLinesReady &&
          plan.requirements.length === directEvidence.lines.length;
      }
    }

    const materialComponentLines: PhysicalPlannedBatchMaterialComponentCostLine[] = [];
    const productComponentLines: PhysicalPlannedBatchProductComponentCostLine[] = [];
    let materialKnownSubtotal = 0;
    let productKnownSubtotal = 0;
    let materialKnown = false;
    let productKnown = false;
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
          addIssue(issue);
          lineIssues.push(issue);
        } else {
          plannedComponentQuantity = line.quantityPerParent * plannedQuantity;
          if (!finiteNonNegative(plannedComponentQuantity)) {
            contradiction = true;
            componentsComplete = false;
            plannedComponentQuantity = null;
          }
        }

        const contribution = line.componentCostContribution;
        if (contribution !== null && finiteNonNegative(contribution)) {
          knownPlannedBatchCost = contribution * plannedQuantity;
          if (finiteNonNegative(knownPlannedBatchCost)) {
            materialKnown = true;
            materialKnownSubtotal += knownPlannedBatchCost;
          } else {
            contradiction = true;
            componentsComplete = false;
            knownPlannedBatchCost = null;
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
          addIssue(issue);
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
          addIssue(issue);
          lineIssues.push(issue);
        }

        const ready =
          lineIssues.length === 0 &&
          line.status === 'ready' &&
          plannedComponentQuantity !== null &&
          knownPlannedBatchCost !== null;
        materialComponentLines.push({
          componentId: line.componentId,
          sourceMaterialId: line.sourceMaterialId,
          sourceMaterialName: line.sourceMaterialName,
          role: line.role,
          status: ready ? 'ready' : 'not-ready',
          quantityPerParent: line.quantityPerParent,
          requestedQuantity: plannedQuantity,
          plannedComponentQuantity,
          costPerPc: line.costPerPc !== null && finiteNonNegative(line.costPerPc) ? line.costPerPc : null,
          perParentCostContribution:
            contribution !== null && finiteNonNegative(contribution) ? contribution : null,
          knownPlannedBatchCost,
          plannedBatchCost: ready ? knownPlannedBatchCost : null,
          issues: lineIssues.map(cloneIssue),
        });
      } else {
        const line = entry.line;
        const lineIssues: PhysicalPlannedBatchProductionCostIssue[] = [];
        let plannedChildQuantity: number | null = null;
        let knownPlannedBatchCost: number | null = null;
        let authoritativeBatchCost: number | null = null;

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
          addIssue(issue);
          lineIssues.push(issue);
        } else {
          plannedChildQuantity = line.quantityPerParent * plannedQuantity;
          if (!finiteNonNegative(plannedChildQuantity)) {
            contradiction = true;
            componentsComplete = false;
            plannedChildQuantity = null;
          }
        }

        const knownContribution = line.knownComponentCostContribution;
        if (knownContribution !== null && finiteNonNegative(knownContribution)) {
          knownPlannedBatchCost = knownContribution * plannedQuantity;
          if (finiteNonNegative(knownPlannedBatchCost)) {
            productKnown = true;
            productKnownSubtotal += knownPlannedBatchCost;
          } else {
            contradiction = true;
            componentsComplete = false;
            knownPlannedBatchCost = null;
          }
        } else if (knownContribution !== null) {
          contradiction = true;
          componentsComplete = false;
        }

        const authoritativeContribution = line.componentCostContribution;
        if (authoritativeContribution !== null && !finiteNonNegative(authoritativeContribution)) {
          contradiction = true;
          componentsComplete = false;
          const issue: PhysicalPlannedBatchProductionCostIssue = {
            code: 'COMPONENT_COST_INVALID',
            message: `Product-backed component ${line.componentId} has an invalid authoritative per-parent cost contribution.`,
            productId: canonicalProductId,
            componentId: line.componentId,
            sourceId: line.childProductId,
          };
          addIssue(issue);
          lineIssues.push(issue);
        }

        if (line.status === 'ready' && authoritativeContribution !== null && finiteNonNegative(authoritativeContribution)) {
          authoritativeBatchCost = authoritativeContribution * plannedQuantity;
          if (!finiteNonNegative(authoritativeBatchCost)) {
            contradiction = true;
            componentsComplete = false;
            authoritativeBatchCost = null;
          }
        }

        if (line.status !== 'ready' || authoritativeContribution === null) {
          componentsComplete = false;
          const issue: PhysicalPlannedBatchProductionCostIssue = {
            code: line.status === 'partial' ? 'PRODUCT_COMPONENT_PARTIAL' : 'PRODUCT_COMPONENT_NOT_READY',
            message:
              line.status === 'partial'
                ? `Product-backed component ${line.componentId} has only partial fully loaded cost evidence.`
                : `Product-backed component ${line.componentId} is not ready for physical batch costing.`,
            productId: canonicalProductId,
            componentId: line.componentId,
            sourceId: line.childProductId,
            underlyingCode: line.issues[0]?.code,
          };
          addIssue(issue);
          lineIssues.push(issue);
        }

        const ready =
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
          status: ready ? 'ready' : 'not-ready',
          upstreamStatus: line.status,
          quantityPerParent: line.quantityPerParent,
          requestedQuantity: plannedQuantity,
          plannedChildQuantity,
          childFullyLoadedUnitCost:
            line.childFullyLoadedUnitCost !== null && finiteNonNegative(line.childFullyLoadedUnitCost)
              ? line.childFullyLoadedUnitCost
              : null,
          knownPerParentCostContribution:
            knownContribution !== null && finiteNonNegative(knownContribution) ? knownContribution : null,
          perParentCostContribution:
            authoritativeContribution !== null && finiteNonNegative(authoritativeContribution)
              ? authoritativeContribution
              : null,
          knownPlannedBatchCost,
          plannedBatchCost: ready ? authoritativeBatchCost : null,
          issues: lineIssues.map(cloneIssue),
        });
      }
    }

    const laborKnown = cost.laborCostPerUnit !== null && finiteNonNegative(cost.laborCostPerUnit);
    const overheadKnown = cost.overheadCostPerUnit !== null && finiteNonNegative(cost.overheadCostPerUnit);
    let laborBatchCost = laborKnown ? cost.laborCostPerUnit! * plannedQuantity : null;
    let overheadBatchCost = overheadKnown ? cost.overheadCostPerUnit! * plannedQuantity : null;

    if (cost.laborCostPerUnit === null) {
      addIssue({
        code: 'LABOR_COST_NOT_READY',
        message: `Product ${canonicalProductId} has no ready root labor cost evidence.`,
        productId: canonicalProductId,
      });
    } else if (!laborKnown || laborBatchCost === null || !finiteNonNegative(laborBatchCost)) {
      contradiction = true;
      laborBatchCost = null;
      addIssue({
        code: 'DERIVED_COST_INVALID',
        message: `Product ${canonicalProductId} produced an invalid root labor batch cost.`,
        productId: canonicalProductId,
      });
    }

    if (cost.overheadCostPerUnit === null) {
      addIssue({
        code: 'OVERHEAD_COST_NOT_READY',
        message: `Product ${canonicalProductId} has no ready root overhead cost evidence.`,
        productId: canonicalProductId,
      });
    } else if (!overheadKnown || overheadBatchCost === null || !finiteNonNegative(overheadBatchCost)) {
      contradiction = true;
      overheadBatchCost = null;
      addIssue({
        code: 'DERIVED_COST_INVALID',
        message: `Product ${canonicalProductId} produced an invalid root overhead batch cost.`,
        productId: canonicalProductId,
      });
    }

    const hasKnownEvidence = directKnown || materialKnown || productKnown || laborKnown || overheadKnown;
    let knownPlannedProductionCostSubtotal: number | null = hasKnownEvidence
      ? directKnownSubtotal +
        materialKnownSubtotal +
        productKnownSubtotal +
        (laborBatchCost ?? 0) +
        (overheadBatchCost ?? 0)
      : null;

    if (knownPlannedProductionCostSubtotal !== null && !finiteNonNegative(knownPlannedProductionCostSubtotal)) {
      contradiction = true;
      knownPlannedProductionCostSubtotal = null;
      addIssue({
        code: 'DERIVED_COST_INVALID',
        message: `Product ${canonicalProductId} produced an invalid known physical batch cost subtotal.`,
        productId: canonicalProductId,
      });
    }

    const financialComplete = laborKnown && overheadKnown && laborBatchCost !== null && overheadBatchCost !== null;
    const allEvidenceComplete = cost.status === 'ready' && directComplete && componentsComplete && financialComplete;

    let status: PhysicalPlannedBatchProductionCostStatus = contradiction || cost.status === 'not-ready'
      ? 'not-ready'
      : allEvidenceComplete
        ? 'ready'
        : hasKnownEvidence
          ? 'partial'
          : 'not-ready';

    let plannedProductionCost = status === 'ready' ? knownPlannedProductionCostSubtotal : null;
    if (status === 'ready' && plannedProductionCost === null) {
      contradiction = true;
      status = 'not-ready';
      addIssue({
        code: 'DERIVED_COST_INVALID',
        message: `Product ${canonicalProductId} reached ready state without an authoritative physical batch cost.`,
        productId: canonicalProductId,
      });
    }

    if (plannedProductionCost !== null) {
      const recomposed =
        directKnownSubtotal +
        materialKnownSubtotal +
        productKnownSubtotal +
        (laborBatchCost ?? 0) +
        (overheadBatchCost ?? 0);
      if (!finiteNonNegative(recomposed) || recomposed !== plannedProductionCost) {
        contradiction = true;
        status = 'not-ready';
        plannedProductionCost = null;
        addIssue({
          code: 'COST_RECONCILIATION_FAILED',
          message: `Product ${canonicalProductId} physical batch subtotals do not reconcile to the authoritative planned production cost.`,
          productId: canonicalProductId,
        });
      }
    }

    let standardUnitCostTimesQuantity: number | null = null;
    if (cost.totalFullyLoadedUnitCost !== null && finiteNonNegative(cost.totalFullyLoadedUnitCost)) {
      standardUnitCostTimesQuantity = cost.totalFullyLoadedUnitCost * plannedQuantity;
      if (!finiteNonNegative(standardUnitCostTimesQuantity)) {
        contradiction = true;
        standardUnitCostTimesQuantity = null;
        status = 'not-ready';
        plannedProductionCost = null;
        addIssue({
          code: 'DERIVED_COST_INVALID',
          message: `Product ${canonicalProductId} produced an invalid standard unit-cost batch comparison.`,
          productId: canonicalProductId,
        });
      }
    } else if (cost.totalFullyLoadedUnitCost !== null) {
      contradiction = true;
      status = 'not-ready';
      plannedProductionCost = null;
      addIssue({
        code: 'DERIVED_COST_INVALID',
        message: `Product ${canonicalProductId} has invalid authoritative unit-cost evidence.`,
        productId: canonicalProductId,
      });
    }

    let physicalVsStandardCostDifference: number | null = null;
    if (plannedProductionCost !== null && standardUnitCostTimesQuantity !== null) {
      physicalVsStandardCostDifference = plannedProductionCost - standardUnitCostTimesQuantity;
      if (!Number.isFinite(physicalVsStandardCostDifference)) {
        contradiction = true;
        status = 'not-ready';
        plannedProductionCost = null;
        physicalVsStandardCostDifference = null;
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
      productionRequirements: structuredClone(plan),
      unitCostEvidence: structuredClone(cost),
      directMaterialMode: cost.directMaterialMode,
      directMaterialLines: directMaterialLines.map((line) => ({ ...line, issues: line.issues.map(cloneIssue) })),
      materialComponentLines: materialComponentLines.map((line) => ({ ...line, issues: line.issues.map(cloneIssue) })),
      productComponentLines: productComponentLines.map((line) => ({ ...line, path: [...line.path], issues: line.issues.map(cloneIssue) })),
      plannedDirectMaterialCostSubtotal: directKnownSubtotal,
      plannedMaterialComponentCostSubtotal: materialKnownSubtotal,
      plannedProductComponentCostSubtotal: productKnownSubtotal,
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
