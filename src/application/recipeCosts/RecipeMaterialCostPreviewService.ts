import { MaterialCalibrationError } from '../../domain/materialCalibration';
import { calculateMaterialPackageCosting, MaterialCostingError } from '../../domain/materialCosting';
import {
  buildRecipeMaterialCostPreview,
  priceEffectiveMaterialRequirement,
  RecipeMaterialCostPreviewError,
  type RecipeMaterialCostLine,
} from '../../domain/recipeMaterialCostPreview';
import type { CalibrationRepository } from '../calibrations/CalibrationRepository';
import type { MaterialRepository } from '../materials/MaterialRepository';
import type {
  EffectiveRecipeRequirementResult,
  RecipeRequirementIssue,
  RecipeRequirementReadinessStatus,
} from '../recipeRequirements/EffectiveRecipeRequirementService';

export interface EffectiveRecipeRequirementProvider {
  deriveForProduct(productId: string): Promise<EffectiveRecipeRequirementResult>;
}

export type RecipeMaterialCostIssueCode =
  | 'MATERIAL_NOT_FOUND'
  | 'MATERIAL_COST_NOT_DERIVABLE'
  | 'REQUIREMENT_VALIDATION_FAILED';

export interface RecipeMaterialCostIssue {
  code: RecipeMaterialCostIssueCode;
  materialId: string;
  message: string;
}

export interface RecipeMaterialCostPreviewResult {
  productId: string;
  productIsActive: boolean;
  status: RecipeRequirementReadinessStatus;
  requirementStatus: RecipeRequirementReadinessStatus;
  effectiveYieldSampleId: string | null;
  skippedInvalidYieldSampleIds: string[];
  lines: RecipeMaterialCostLine[];
  totalMaterialCostPerProduct: number;
  requirementIssues: RecipeRequirementIssue[];
  costIssues: RecipeMaterialCostIssue[];
}

function comparable(value: string): string {
  return value.trim().toLowerCase();
}

function isExpectedCostFailure(error: unknown): boolean {
  return (
    error instanceof MaterialCostingError ||
    error instanceof MaterialCalibrationError ||
    error instanceof RecipeMaterialCostPreviewError
  );
}

/**
 * Derived material-cost preview for one product.
 *
 * Cost preview never mutates source data. It consumes the canonical requirement view
 * from 2.3B and the Phase 1 material package-cost engine. Safety waste, labor,
 * overhead, vessels/components, selling price, and profit are intentionally excluded.
 */
export class RecipeMaterialCostPreviewService {
  constructor(
    private readonly requirements: EffectiveRecipeRequirementProvider,
    private readonly materials: MaterialRepository,
    private readonly calibrations: CalibrationRepository,
  ) {}

  async previewForProduct(productId: string): Promise<RecipeMaterialCostPreviewResult> {
    const requirementResult = await this.requirements.deriveForProduct(productId);
    const [materials, calibrations] = await Promise.all([
      this.materials.list(),
      this.calibrations.list(),
    ]);

    const materialById = new Map(materials.map((material) => [comparable(material.id), material]));
    const costIssues: RecipeMaterialCostIssue[] = [];
    const lines: RecipeMaterialCostLine[] = [];

    for (const requirement of requirementResult.requirements) {
      const material = materialById.get(comparable(requirement.materialId));
      if (!material) {
        costIssues.push({
          code: 'MATERIAL_NOT_FOUND',
          materialId: requirement.materialId,
          message: `Material ${requirement.materialId} was not found for cost preview.`,
        });
        continue;
      }

      const materialCalibrations = calibrations.filter(
        (record) => comparable(record.materialId) === comparable(material.id),
      );

      try {
        const costing = calculateMaterialPackageCosting(material, materialCalibrations);
        lines.push(
          priceEffectiveMaterialRequirement(requirement, {
            materialId: material.id,
            baseUnit: material.baseUnit,
            costPerBaseUnit: costing.costPerBaseUnit,
            packageCost: material.packageCost,
            packageBaseQuantity: costing.packageBaseQuantity,
            packageConversionSource: costing.effectiveConversionSource,
            costingCalibrationId: costing.effectiveCalibrationId,
          }),
        );
      } catch (error) {
        if (!isExpectedCostFailure(error)) throw error;
        costIssues.push({
          code:
            error instanceof RecipeMaterialCostPreviewError
              ? 'REQUIREMENT_VALIDATION_FAILED'
              : 'MATERIAL_COST_NOT_DERIVABLE',
          materialId: requirement.materialId,
          message: error instanceof Error ? error.message : `Material ${requirement.materialId} cannot be costed.`,
        });
      }
    }

    const preview = buildRecipeMaterialCostPreview(requirementResult.productId, lines);
    const status: RecipeRequirementReadinessStatus =
      preview.lines.length === 0
        ? 'not-ready'
        : requirementResult.status !== 'ready' || costIssues.length > 0
          ? 'partial'
          : 'ready';

    return {
      productId: requirementResult.productId,
      productIsActive: requirementResult.productIsActive,
      status,
      requirementStatus: requirementResult.status,
      effectiveYieldSampleId: requirementResult.effectiveYieldSampleId,
      skippedInvalidYieldSampleIds: [...requirementResult.skippedInvalidYieldSampleIds],
      lines: preview.lines,
      totalMaterialCostPerProduct: preview.totalMaterialCostPerProduct,
      requirementIssues: requirementResult.issues.map((issue) => ({ ...issue })),
      costIssues,
    };
  }
}
