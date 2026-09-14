import { FixedRecipeItemError } from '../../domain/fixedRecipeItems';
import {
  synthesizeEffectiveRecipeRequirements,
  type EffectiveMaterialRequirement,
} from '../../domain/effectiveRecipeRequirements';
import { MaterialCalibrationError } from '../../domain/materialCalibration';
import { MaterialCostingError } from '../../domain/materialCosting';
import { MaterialQuantityError } from '../../domain/materialQuantity';
import type { ProductRepository } from '../products/ProductRepository';
import {
  FixedRecipeItemApplicationError,
  type FixedRecipeItemService,
} from '../recipeItems/FixedRecipeItemService';
import {
  YieldHistoryServiceError,
  type YieldHistoryService,
} from '../yieldSamples/YieldHistoryService';

export type RecipeRequirementReadinessStatus = 'ready' | 'partial' | 'not-ready';

export type RecipeRequirementIssueCode =
  | 'YIELD_HISTORY_NOT_DERIVABLE'
  | 'FIXED_ITEM_NOT_DERIVABLE'
  | 'NO_REQUIREMENTS';

export interface RecipeRequirementIssue {
  code: RecipeRequirementIssueCode;
  message: string;
  sourceId?: string;
}

export interface EffectiveRecipeRequirementResult {
  productId: string;
  productIsActive: boolean;
  status: RecipeRequirementReadinessStatus;
  effectiveYieldSampleId: string | null;
  skippedInvalidYieldSampleIds: string[];
  requirements: EffectiveMaterialRequirement[];
  issues: RecipeRequirementIssue[];
}

export type EffectiveRecipeRequirementServiceErrorCode = 'PRODUCT_NOT_FOUND';

export class EffectiveRecipeRequirementServiceError extends Error {
  readonly code: EffectiveRecipeRequirementServiceErrorCode;
  readonly productId: string;

  constructor(code: EffectiveRecipeRequirementServiceErrorCode, message: string, productId: string) {
    super(message);
    this.name = 'EffectiveRecipeRequirementServiceError';
    this.code = code;
    this.productId = productId;
  }
}

function isExpectedFixedRequirementFailure(error: unknown): boolean {
  return (
    error instanceof FixedRecipeItemApplicationError ||
    error instanceof FixedRecipeItemError ||
    error instanceof MaterialQuantityError ||
    error instanceof MaterialCalibrationError ||
    error instanceof MaterialCostingError
  );
}

/**
 * Application boundary for one derived per-product material requirement view.
 *
 * Products may be yield-only, fixed-only, or combined. Missing yield history is not
 * itself an error. Existing-but-non-derivable yield history and broken fixed lines are
 * surfaced as readiness issues while valid contributions remain available.
 */
export class EffectiveRecipeRequirementService {
  constructor(
    private readonly products: ProductRepository,
    private readonly yieldHistory: YieldHistoryService,
    private readonly fixedRecipes: FixedRecipeItemService,
  ) {}

  async deriveForProduct(productId: string): Promise<EffectiveRecipeRequirementResult> {
    const product = await this.products.findById(productId);
    if (!product) {
      throw new EffectiveRecipeRequirementServiceError(
        'PRODUCT_NOT_FOUND',
        `Product ${productId.trim()} was not found.`,
        productId.trim(),
      );
    }

    const issues: RecipeRequirementIssue[] = [];
    let yieldLearning = null;
    let skippedInvalidYieldSampleIds: string[] = [];

    try {
      const effective = await this.yieldHistory.getEffective(product.id);
      yieldLearning = effective.learning;
      skippedInvalidYieldSampleIds = [...effective.skippedInvalidSampleIds];
    } catch (error) {
      if (error instanceof YieldHistoryServiceError && error.code === 'NO_SAMPLES') {
        // A fixed-only recipe is valid; absence of yield evidence is not automatically a problem.
      } else if (error instanceof YieldHistoryServiceError && error.code === 'NO_VALID_SAMPLES') {
        issues.push({
          code: 'YIELD_HISTORY_NOT_DERIVABLE',
          message: error.message,
        });
      } else {
        throw error;
      }
    }

    const fixedItems = await this.fixedRecipes.listItems({ productId: product.id });
    const fixedRequirements = [];

    for (const item of fixedItems) {
      try {
        fixedRequirements.push(await this.fixedRecipes.deriveItemRequirement(item.id));
      } catch (error) {
        if (!isExpectedFixedRequirementFailure(error)) throw error;
        issues.push({
          code: 'FIXED_ITEM_NOT_DERIVABLE',
          sourceId: item.id,
          message: error instanceof Error ? error.message : `Recipe item ${item.id} cannot be derived.`,
        });
      }
    }

    const synthesized = synthesizeEffectiveRecipeRequirements(
      product.id,
      yieldLearning,
      fixedRequirements,
    );

    if (synthesized.requirements.length === 0) {
      issues.push({
        code: 'NO_REQUIREMENTS',
        message: `Product ${product.id} has no currently derivable material requirements.`,
      });
    }

    const status: RecipeRequirementReadinessStatus =
      synthesized.requirements.length === 0 ? 'not-ready' : issues.length > 0 ? 'partial' : 'ready';

    return {
      productId: product.id,
      productIsActive: product.isActive,
      status,
      effectiveYieldSampleId: synthesized.effectiveYieldSampleId,
      skippedInvalidYieldSampleIds,
      requirements: synthesized.requirements,
      issues,
    };
  }
}
