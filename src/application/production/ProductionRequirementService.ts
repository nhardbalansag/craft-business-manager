import {
  deriveWasteAdjustedProductionRequirements,
  type WasteAdjustedMaterialRequirement,
} from '../../domain/productionRequirements';
import type { ProductSafetyWastePolicy } from '../../domain/safetyWastePolicy';
import type {
  EffectiveRecipeRequirementResult,
  RecipeRequirementIssue,
  RecipeRequirementReadinessStatus,
} from '../recipeRequirements/EffectiveRecipeRequirementService';

export interface EffectiveRequirementProvider {
  deriveForProduct(productId: string): Promise<EffectiveRecipeRequirementResult>;
}

export interface SafetyWastePolicyProvider {
  getSafetyWastePolicy(productId: string): Promise<ProductSafetyWastePolicy>;
}

export interface ProductionRequirementPlanResult {
  productId: string;
  productIsActive: boolean;
  status: RecipeRequirementReadinessStatus;
  effectiveYieldSampleId: string | null;
  skippedInvalidYieldSampleIds: string[];
  issues: RecipeRequirementIssue[];
  plannedQuantity: number;
  safetyWasteRate: number;
  safetyWastePercentage: number;
  safetyWasteMultiplier: number;
  observedDefectRateIncluded: false;
  requirements: WasteAdjustedMaterialRequirement[];
}

/**
 * Application boundary for waste-adjusted production planning.
 *
 * The 2.3B readiness result remains authoritative. 2.4B scales only the currently
 * derivable canonical requirements and does not inspect inventory; capacity belongs
 * to Phase 2.4C.
 */
export class ProductionRequirementService {
  constructor(
    private readonly effectiveRequirements: EffectiveRequirementProvider,
    private readonly safetyWastePolicies: SafetyWastePolicyProvider,
  ) {}

  async plan(productId: string, plannedQuantity: number): Promise<ProductionRequirementPlanResult> {
    const [effective, policy] = await Promise.all([
      this.effectiveRequirements.deriveForProduct(productId),
      this.safetyWastePolicies.getSafetyWastePolicy(productId),
    ]);

    const plan = deriveWasteAdjustedProductionRequirements(
      effective.productId,
      effective.requirements,
      policy,
      plannedQuantity,
    );

    return {
      productId: effective.productId,
      productIsActive: effective.productIsActive,
      status: effective.status,
      effectiveYieldSampleId: effective.effectiveYieldSampleId,
      skippedInvalidYieldSampleIds: [...effective.skippedInvalidYieldSampleIds],
      issues: effective.issues.map((issue) => ({ ...issue })),
      plannedQuantity: plan.plannedQuantity,
      safetyWasteRate: plan.safetyWasteRate,
      safetyWastePercentage: plan.safetyWastePercentage,
      safetyWasteMultiplier: plan.safetyWasteMultiplier,
      observedDefectRateIncluded: false,
      requirements: plan.requirements,
    };
  }
}
