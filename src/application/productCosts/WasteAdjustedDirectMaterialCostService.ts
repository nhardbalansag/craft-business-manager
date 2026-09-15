import type {
  WasteAdjustedMaterialRequirement,
  WasteAdjustedRequirementContribution,
} from '../../domain/productionRequirements';
import type {
  CostedRequirementContribution,
  RecipeMaterialCostLine,
} from '../../domain/recipeMaterialCostPreview';
import type { ProductionRequirementPlanResult } from '../production/ProductionRequirementService';
import type {
  RecipeMaterialCostIssue,
  RecipeMaterialCostPreviewResult,
} from '../recipeCosts/RecipeMaterialCostPreviewService';
import type { RecipeRequirementIssue } from '../recipeRequirements/EffectiveRecipeRequirementService';

export type WasteAdjustedDirectMaterialCostStatus = 'ready' | 'partial' | 'not-ready';
export type WasteAdjustedDirectMaterialCostLineStatus = 'ready' | 'not-ready';

export type WasteAdjustedDirectMaterialCostIssueCode =
  | 'REQUIREMENT_PARTIAL'
  | 'REQUIREMENT_NOT_READY'
  | 'COST_PARTIAL'
  | 'COST_NOT_READY'
  | 'MATERIAL_COST_EVIDENCE_MISSING'
  | 'MATERIAL_REQUIREMENT_EVIDENCE_MISSING'
  | 'MATERIAL_BASE_UNIT_MISMATCH'
  | 'DERIVED_COST_INVALID'
  | 'DERIVED_COST_RECONCILIATION_FAILED';

export interface WasteAdjustedDirectMaterialCostIssue {
  code: WasteAdjustedDirectMaterialCostIssueCode;
  message: string;
  materialId?: string;
}

export interface WasteAdjustedDirectMaterialCostLine {
  materialId: string;
  baseUnit: WasteAdjustedMaterialRequirement['baseUnit'];
  source: WasteAdjustedMaterialRequirement['source'];
  status: WasteAdjustedDirectMaterialCostLineStatus;
  effectiveBaseQuantityPerProduct: number;
  wasteReserveBaseQuantityPerProduct: number;
  plannedBaseQuantityPerProduct: number;
  costPerBaseUnit: number | null;
  baseDirectMaterialCostPerUnit: number | null;
  safetyWasteReserveCostPerUnit: number | null;
  pricingDirectMaterialCostPerUnit: number | null;
  packageCost: number | null;
  packageBaseQuantity: number | null;
  packageConversionSource: RecipeMaterialCostLine['packageConversionSource'] | null;
  costingCalibrationId: string | null;
  requirementContributions: WasteAdjustedRequirementContribution[];
  costContributions: CostedRequirementContribution[];
  issues: WasteAdjustedDirectMaterialCostIssue[];
}

export interface WasteAdjustedDirectMaterialCostResult {
  productId: string;
  productIsActive: boolean;
  status: WasteAdjustedDirectMaterialCostStatus;
  planningBasisQuantity: 1;
  safetyWasteRate: number;
  safetyWastePercentage: number;
  safetyWasteMultiplier: number;
  observedDefectRateIncluded: false;
  baseDirectMaterialCostSubtotal: number | null;
  safetyWasteReserveCostSubtotal: number | null;
  pricingDirectMaterialCostPerUnit: number | null;
  lines: WasteAdjustedDirectMaterialCostLine[];
  requirementIssues: RecipeRequirementIssue[];
  costIssues: RecipeMaterialCostIssue[];
  issues: WasteAdjustedDirectMaterialCostIssue[];
}

export interface WasteAdjustedRequirementProvider {
  plan(productId: string, plannedQuantity: number): Promise<ProductionRequirementPlanResult>;
}

export interface DirectMaterialCostEvidenceProvider {
  previewForProduct(productId: string): Promise<RecipeMaterialCostPreviewResult>;
}

export type WasteAdjustedDirectMaterialCostServiceErrorCode = 'PRODUCT_EVIDENCE_MISMATCH';

export class WasteAdjustedDirectMaterialCostServiceError extends Error {
  readonly code: WasteAdjustedDirectMaterialCostServiceErrorCode;
  readonly requestedProductId: string;
  readonly requirementProductId: string;
  readonly costProductId: string;

  constructor(
    code: WasteAdjustedDirectMaterialCostServiceErrorCode,
    message: string,
    context: {
      requestedProductId: string;
      requirementProductId: string;
      costProductId: string;
    },
  ) {
    super(message);
    this.name = 'WasteAdjustedDirectMaterialCostServiceError';
    this.code = code;
    this.requestedProductId = context.requestedProductId;
    this.requirementProductId = context.requirementProductId;
    this.costProductId = context.costProductId;
  }
}

function comparable(value: string): string {
  return value.trim().toLowerCase();
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function nearlyEqual(left: number, right: number): boolean {
  const scale = Math.max(1, Math.abs(left), Math.abs(right));
  return Math.abs(left - right) <= Number.EPSILON * 64 * scale;
}

function finiteNonNegative(...values: number[]): boolean {
  return values.every((value) => Number.isFinite(value) && value >= 0);
}

function cloneRequirementContribution(
  contribution: WasteAdjustedRequirementContribution,
): WasteAdjustedRequirementContribution {
  return { ...contribution };
}

function cloneCostContribution(
  contribution: CostedRequirementContribution,
): CostedRequirementContribution {
  return { ...contribution };
}

function cloneIssue(issue: WasteAdjustedDirectMaterialCostIssue): WasteAdjustedDirectMaterialCostIssue {
  return { ...issue };
}

function unresolvedLine(
  requirement: WasteAdjustedMaterialRequirement,
  issues: WasteAdjustedDirectMaterialCostIssue[],
): WasteAdjustedDirectMaterialCostLine {
  return {
    materialId: requirement.materialId,
    baseUnit: requirement.baseUnit,
    source: requirement.source,
    status: 'not-ready',
    effectiveBaseQuantityPerProduct: requirement.effectiveBaseQuantityPerProduct,
    wasteReserveBaseQuantityPerProduct: requirement.wasteReserveBaseQuantityPerProduct,
    plannedBaseQuantityPerProduct: requirement.plannedBaseQuantityPerProduct,
    costPerBaseUnit: null,
    baseDirectMaterialCostPerUnit: null,
    safetyWasteReserveCostPerUnit: null,
    pricingDirectMaterialCostPerUnit: null,
    packageCost: null,
    packageBaseQuantity: null,
    packageConversionSource: null,
    costingCalibrationId: null,
    requirementContributions: requirement.contributions.map(cloneRequirementContribution),
    costContributions: [],
    issues: issues.map(cloneIssue),
  };
}

/**
 * Phase 4.2A standard direct-material pricing cost.
 *
 * This service composes authoritative Phase 2 waste-adjusted requirement quantities
 * with the existing direct-material cost-per-base-unit evidence used by Phase 3.
 * It intentionally uses precise plannedBaseQuantityPerProduct and never physical
 * plannedBatchBaseQuantity, so count-unit rounding remains a batch-financial concern.
 */
export class WasteAdjustedDirectMaterialCostService {
  constructor(
    private readonly requirements: WasteAdjustedRequirementProvider,
    private readonly costs: DirectMaterialCostEvidenceProvider,
  ) {}

  async costProduct(productId: string): Promise<WasteAdjustedDirectMaterialCostResult> {
    const requestedProductId = productId.trim();
    const [requirementPlan, costPreview] = await Promise.all([
      this.requirements.plan(requestedProductId, 1),
      this.costs.previewForProduct(requestedProductId),
    ]);

    if (comparable(requirementPlan.productId) !== comparable(costPreview.productId)) {
      throw new WasteAdjustedDirectMaterialCostServiceError(
        'PRODUCT_EVIDENCE_MISMATCH',
        `Direct-material requirement evidence belongs to ${requirementPlan.productId}, but cost evidence belongs to ${costPreview.productId}.`,
        {
          requestedProductId,
          requirementProductId: requirementPlan.productId,
          costProductId: costPreview.productId,
        },
      );
    }

    const issues: WasteAdjustedDirectMaterialCostIssue[] = [];
    if (requirementPlan.status === 'partial') {
      issues.push({
        code: 'REQUIREMENT_PARTIAL',
        message: `Product ${requirementPlan.productId} has only partial direct-material requirement evidence.`,
      });
    } else if (requirementPlan.status === 'not-ready') {
      issues.push({
        code: 'REQUIREMENT_NOT_READY',
        message: `Product ${requirementPlan.productId} has no ready direct-material requirement evidence.`,
      });
    }

    if (costPreview.status === 'partial') {
      issues.push({
        code: 'COST_PARTIAL',
        message: `Product ${requirementPlan.productId} has only partial direct-material cost evidence.`,
      });
    } else if (costPreview.status === 'not-ready') {
      issues.push({
        code: 'COST_NOT_READY',
        message: `Product ${requirementPlan.productId} has no ready direct-material cost evidence.`,
      });
    }

    const costByMaterial = new Map(
      costPreview.lines.map((line) => [comparable(line.materialId), line] as const),
    );
    const matchedCostKeys = new Set<string>();
    const sortedRequirements = [...requirementPlan.requirements].sort((left, right) =>
      compareText(comparable(left.materialId), comparable(right.materialId)),
    );

    const lines: WasteAdjustedDirectMaterialCostLine[] = [];

    for (const requirement of sortedRequirements) {
      const materialKey = comparable(requirement.materialId);
      const costLine = costByMaterial.get(materialKey);

      if (!costLine) {
        const lineIssue: WasteAdjustedDirectMaterialCostIssue = {
          code: 'MATERIAL_COST_EVIDENCE_MISSING',
          materialId: requirement.materialId,
          message: `Material ${requirement.materialId} has a planned direct requirement but no compatible cost evidence.`,
        };
        issues.push(lineIssue);
        lines.push(unresolvedLine(requirement, [lineIssue]));
        continue;
      }

      matchedCostKeys.add(materialKey);

      if (costLine.baseUnit !== requirement.baseUnit) {
        const lineIssue: WasteAdjustedDirectMaterialCostIssue = {
          code: 'MATERIAL_BASE_UNIT_MISMATCH',
          materialId: requirement.materialId,
          message: `Material ${requirement.materialId} requirement uses ${requirement.baseUnit}, but cost evidence uses ${costLine.baseUnit}.`,
        };
        issues.push(lineIssue);
        lines.push(unresolvedLine(requirement, [lineIssue]));
        continue;
      }

      const costPerBaseUnit = costLine.costPerBaseUnit;
      const baseCost = requirement.effectiveBaseQuantityPerProduct * costPerBaseUnit;
      const reserveCost = requirement.wasteReserveBaseQuantityPerProduct * costPerBaseUnit;
      const pricingCost = requirement.plannedBaseQuantityPerProduct * costPerBaseUnit;

      if (!finiteNonNegative(costPerBaseUnit, baseCost, reserveCost, pricingCost)) {
        const lineIssue: WasteAdjustedDirectMaterialCostIssue = {
          code: 'DERIVED_COST_INVALID',
          materialId: requirement.materialId,
          message: `Material ${requirement.materialId} produced a non-finite or negative direct-material cost.`,
        };
        issues.push(lineIssue);
        lines.push(unresolvedLine(requirement, [lineIssue]));
        continue;
      }

      if (!nearlyEqual(baseCost + reserveCost, pricingCost)) {
        const lineIssue: WasteAdjustedDirectMaterialCostIssue = {
          code: 'DERIVED_COST_RECONCILIATION_FAILED',
          materialId: requirement.materialId,
          message: `Material ${requirement.materialId} base cost plus safety reserve does not reconcile to its pricing direct cost.`,
        };
        issues.push(lineIssue);
        lines.push(unresolvedLine(requirement, [lineIssue]));
        continue;
      }

      lines.push({
        materialId: requirement.materialId,
        baseUnit: requirement.baseUnit,
        source: requirement.source,
        status: 'ready',
        effectiveBaseQuantityPerProduct: requirement.effectiveBaseQuantityPerProduct,
        wasteReserveBaseQuantityPerProduct: requirement.wasteReserveBaseQuantityPerProduct,
        plannedBaseQuantityPerProduct: requirement.plannedBaseQuantityPerProduct,
        costPerBaseUnit,
        baseDirectMaterialCostPerUnit: baseCost,
        safetyWasteReserveCostPerUnit: reserveCost,
        pricingDirectMaterialCostPerUnit: pricingCost,
        packageCost: costLine.packageCost,
        packageBaseQuantity: costLine.packageBaseQuantity,
        packageConversionSource: costLine.packageConversionSource,
        costingCalibrationId: costLine.costingCalibrationId,
        requirementContributions: requirement.contributions.map(cloneRequirementContribution),
        costContributions: costLine.contributions.map(cloneCostContribution),
        issues: [],
      });
    }

    const unmatchedCostLines = costPreview.lines
      .filter((line) => !matchedCostKeys.has(comparable(line.materialId)))
      .sort((left, right) => compareText(comparable(left.materialId), comparable(right.materialId)));

    for (const costLine of unmatchedCostLines) {
      issues.push({
        code: 'MATERIAL_REQUIREMENT_EVIDENCE_MISSING',
        materialId: costLine.materialId,
        message: `Material ${costLine.materialId} has direct cost evidence but no matching waste-adjusted requirement.`,
      });
    }

    const readyLines = lines.filter(
      (line): line is WasteAdjustedDirectMaterialCostLine & {
        baseDirectMaterialCostPerUnit: number;
        safetyWasteReserveCostPerUnit: number;
        pricingDirectMaterialCostPerUnit: number;
      } =>
        line.status === 'ready' &&
        line.baseDirectMaterialCostPerUnit !== null &&
        line.safetyWasteReserveCostPerUnit !== null &&
        line.pricingDirectMaterialCostPerUnit !== null,
    );

    const hasKnownCost = readyLines.length > 0;
    const baseSubtotal = hasKnownCost
      ? readyLines.reduce((sum, line) => sum + line.baseDirectMaterialCostPerUnit, 0)
      : null;
    const reserveSubtotal = hasKnownCost
      ? readyLines.reduce((sum, line) => sum + line.safetyWasteReserveCostPerUnit, 0)
      : null;
    const pricingSubtotal = hasKnownCost
      ? readyLines.reduce((sum, line) => sum + line.pricingDirectMaterialCostPerUnit, 0)
      : null;

    const unresolved =
      requirementPlan.status !== 'ready' ||
      costPreview.status !== 'ready' ||
      issues.length > 0 ||
      lines.some((line) => line.status !== 'ready');

    const status: WasteAdjustedDirectMaterialCostStatus = !hasKnownCost
      ? 'not-ready'
      : unresolved
        ? 'partial'
        : 'ready';

    return {
      productId: requirementPlan.productId,
      productIsActive: requirementPlan.productIsActive,
      status,
      planningBasisQuantity: 1,
      safetyWasteRate: requirementPlan.safetyWasteRate,
      safetyWastePercentage: requirementPlan.safetyWastePercentage,
      safetyWasteMultiplier: requirementPlan.safetyWasteMultiplier,
      observedDefectRateIncluded: false,
      baseDirectMaterialCostSubtotal: baseSubtotal,
      safetyWasteReserveCostSubtotal: reserveSubtotal,
      pricingDirectMaterialCostPerUnit: pricingSubtotal,
      lines: lines.map((line) => ({
        ...line,
        requirementContributions: line.requirementContributions.map(cloneRequirementContribution),
        costContributions: line.costContributions.map(cloneCostContribution),
        issues: line.issues.map(cloneIssue),
      })),
      requirementIssues: requirementPlan.issues.map((issue) => ({ ...issue })),
      costIssues: costPreview.costIssues.map((issue) => ({ ...issue })),
      issues: issues.map(cloneIssue),
    };
  }
}
