import {
  ProductCompositionGraphError,
  type ProductCompositionGraphErrorCode,
  validateProductComponentSourceUniqueness,
} from '../../domain/productCompositionGraph';
import {
  ProductComponentError,
  type ProductComponent,
  type ProductComponentErrorCode,
  type ProductComponentRole,
  validateProductComponentContract,
} from '../../domain/productComponents';
import type { ProductRepository } from '../products/ProductRepository';
import type { RecipeMaterialCostPreviewResult } from '../recipeCosts/RecipeMaterialCostPreviewService';
import {
  EffectiveRecipeRequirementServiceError,
} from '../recipeRequirements/EffectiveRecipeRequirementService';
import type { MaterialBackedComponentCostLine } from './MaterialBackedComponentCostService';
import type { ProductComponentRepository } from './ProductComponentRepository';

export type ProductBackedComponentCostStatus = 'ready' | 'partial' | 'not-ready';

export type ProductBackedComponentCostIssueCode =
  | 'INVALID_COMPONENT'
  | 'NOT_PRODUCT_BACKED_COMPONENT'
  | 'SOURCE_PRODUCT_NOT_FOUND'
  | 'SOURCE_PRODUCT_INACTIVE'
  | 'DIRECT_MATERIAL_COST_PARTIAL'
  | 'DIRECT_MATERIAL_COST_NOT_READY'
  | 'COMPONENT_GRAPH_INVALID'
  | 'NESTED_COMPONENT_PARTIAL'
  | 'NESTED_COMPONENT_NOT_READY'
  | 'CYCLE_DETECTED'
  | 'DERIVED_COST_INVALID';

export type ProductBackedComponentCostUnderlyingCode =
  | ProductComponentErrorCode
  | ProductCompositionGraphErrorCode
  | 'PRODUCT_NOT_FOUND';

export interface ProductBackedComponentCostIssue {
  code: ProductBackedComponentCostIssueCode;
  message: string;
  componentId?: string;
  productId?: string;
  path?: readonly string[];
  cyclePath?: readonly string[];
  underlyingCode?: ProductBackedComponentCostUnderlyingCode | string;
}

export interface MaterialRecursiveComponentCostBreakdown {
  sourceType: 'material';
  line: MaterialBackedComponentCostLine;
}

export interface ProductRecursiveComponentCostBreakdown {
  sourceType: 'product';
  line: ProductBackedComponentCostLine;
}

export type RecursiveComponentCostBreakdown =
  | MaterialRecursiveComponentCostBreakdown
  | ProductRecursiveComponentCostBreakdown;

export interface ProductBackedComponentCostLine {
  componentId: string;
  parentProductId: string;
  role: ProductComponentRole;
  childProductId: string;
  childProductName: string | null;
  quantityPerParent: number;
  path: readonly string[];
  status: ProductBackedComponentCostStatus;
  childDirectMaterialCost: RecipeMaterialCostPreviewResult | null;
  childComponentCostSubtotal: number;
  childComponentAwareUnitCost: number | null;
  componentCostContribution: number | null;
  breakdown: RecursiveComponentCostBreakdown[];
  issues: ProductBackedComponentCostIssue[];
}

export interface ProductDirectMaterialCostProvider {
  previewForProduct(productId: string): Promise<RecipeMaterialCostPreviewResult>;
}

export interface MaterialBackedComponentCostProvider {
  costComponent(component: ProductComponent): Promise<MaterialBackedComponentCostLine>;
}

function canonicalProductId(value: string): string {
  return value.trim().toLowerCase();
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function deterministicComponents(components: readonly ProductComponent[]): ProductComponent[] {
  return [...components].sort((left, right) => {
    const sourceType = compareText(String(left.sourceType), String(right.sourceType));
    if (sourceType !== 0) return sourceType;

    const sourceId = compareText(canonicalProductId(left.sourceId), canonicalProductId(right.sourceId));
    if (sourceId !== 0) return sourceId;

    return compareText(canonicalProductId(left.id), canonicalProductId(right.id));
  });
}

function cloneDirectMaterialCost(
  value: RecipeMaterialCostPreviewResult,
): RecipeMaterialCostPreviewResult {
  return {
    ...value,
    skippedInvalidYieldSampleIds: [...value.skippedInvalidYieldSampleIds],
    lines: value.lines.map((line) => ({
      ...line,
      contributions: line.contributions.map((contribution) => ({ ...contribution })),
    })),
    requirementIssues: value.requirementIssues.map((issue) => ({ ...issue })),
    costIssues: value.costIssues.map((issue) => ({ ...issue })),
  };
}

function breakdownStatus(entry: RecursiveComponentCostBreakdown): ProductBackedComponentCostStatus {
  return entry.line.status;
}

function breakdownContribution(entry: RecursiveComponentCostBreakdown): number | null {
  return entry.line.componentCostContribution;
}

function baseLine(component: ProductComponent, path: readonly string[]): Pick<
  ProductBackedComponentCostLine,
  'componentId' | 'parentProductId' | 'role' | 'childProductId' | 'childProductName' | 'quantityPerParent' | 'path'
> {
  return {
    componentId: component.id.trim(),
    parentProductId: component.parentProductId.trim(),
    role: component.role,
    childProductId: component.sourceId.trim(),
    childProductName: null,
    quantityPerParent: component.quantityPerParent,
    path: [...path],
  };
}

function notReadyLine(
  component: ProductComponent,
  path: readonly string[],
  issues: ProductBackedComponentCostIssue[],
  context: {
    childProductId?: string;
    childProductName?: string | null;
    directCost?: RecipeMaterialCostPreviewResult | null;
    componentSubtotal?: number;
    breakdown?: RecursiveComponentCostBreakdown[];
  } = {},
): ProductBackedComponentCostLine {
  return {
    ...baseLine(component, path),
    childProductId: context.childProductId ?? component.sourceId.trim(),
    childProductName: context.childProductName ?? null,
    status: 'not-ready',
    childDirectMaterialCost: context.directCost ? cloneDirectMaterialCost(context.directCost) : null,
    childComponentCostSubtotal: context.componentSubtotal ?? 0,
    childComponentAwareUnitCost: null,
    componentCostContribution: null,
    breakdown: context.breakdown ? [...context.breakdown] : [],
    issues: issues.map((issue) => ({
      ...issue,
      path: issue.path ? [...issue.path] : undefined,
      cyclePath: issue.cyclePath ? [...issue.cyclePath] : undefined,
    })),
  };
}

function directHasCostEvidence(preview: RecipeMaterialCostPreviewResult): boolean {
  return (
    preview.lines.length > 0 &&
    Number.isFinite(preview.totalMaterialCostPerProduct) &&
    preview.totalMaterialCostPerProduct >= 0
  );
}

function closedCyclePath(activePath: readonly string[], childId: string): readonly string[] {
  const child = canonicalProductId(childId);
  const start = activePath.findIndex((item) => canonicalProductId(item) === child);
  if (start < 0) return [...activePath.map(canonicalProductId), child];
  return [...activePath.slice(start).map(canonicalProductId), child];
}

/**
 * Phase 3.3B recursive Product-backed component costing.
 *
 * Product cost is deliberately independent of ProductStock/current availability.
 * Direct-material cost delegates to Phase 2, material-backed components delegate
 * to 3.3A, and Product-backed components recurse through this service.
 */
export class ProductBackedComponentCostService {
  constructor(
    private readonly products: ProductRepository,
    private readonly components: ProductComponentRepository,
    private readonly directMaterialCosts: ProductDirectMaterialCostProvider,
    private readonly materialComponentCosts: MaterialBackedComponentCostProvider,
  ) {}

  async costComponent(component: ProductComponent): Promise<ProductBackedComponentCostLine> {
    try {
      validateProductComponentContract(component);
    } catch (error) {
      if (error instanceof ProductComponentError) {
        const path = [canonicalProductId(component.parentProductId), canonicalProductId(component.sourceId)]
          .filter(Boolean);
        return notReadyLine(component, path, [
          {
            code: 'INVALID_COMPONENT',
            message: error.message,
            componentId: component.id.trim() || undefined,
            productId: component.sourceId.trim() || undefined,
            path,
            underlyingCode: error.code,
          },
        ]);
      }
      throw error;
    }

    if (component.sourceType !== 'product') {
      const path = [canonicalProductId(component.parentProductId)].filter(Boolean);
      return notReadyLine(component, path, [
        {
          code: 'NOT_PRODUCT_BACKED_COMPONENT',
          message: `Component ${component.id.trim()} is ${component.sourceType}-backed and is outside Phase 3.3B Product-backed costing.`,
          componentId: component.id.trim(),
          productId: component.sourceId.trim(),
          path,
        },
      ]);
    }

    const allComponents = await this.components.list();
    const parentPath = [canonicalProductId(component.parentProductId)].filter(Boolean);
    return this.costProductEdge(component, allComponents, parentPath);
  }

  private async costProductEdge(
    component: ProductComponent,
    allComponents: readonly ProductComponent[],
    activePath: readonly string[],
  ): Promise<ProductBackedComponentCostLine> {
    try {
      validateProductComponentContract(component);
    } catch (error) {
      if (error instanceof ProductComponentError) {
        const path = [...activePath, canonicalProductId(component.sourceId)].filter(Boolean);
        return notReadyLine(component, path, [
          {
            code: 'INVALID_COMPONENT',
            message: error.message,
            componentId: component.id.trim() || undefined,
            productId: component.sourceId.trim() || undefined,
            path,
            underlyingCode: error.code,
          },
        ]);
      }
      throw error;
    }

    if (component.sourceType !== 'product') {
      const path = [...activePath];
      return notReadyLine(component, path, [
        {
          code: 'NOT_PRODUCT_BACKED_COMPONENT',
          message: `Component ${component.id.trim()} is not Product-backed.`,
          componentId: component.id.trim(),
          productId: component.sourceId.trim(),
          path,
        },
      ]);
    }

    const childKey = canonicalProductId(component.sourceId);
    const path = [...activePath, childKey];
    const childProduct = await this.products.findById(component.sourceId);

    const cycleIndex = activePath.findIndex((item) => canonicalProductId(item) === childKey);
    if (cycleIndex >= 0) {
      const cyclePath = closedCyclePath(activePath, childKey);
      return notReadyLine(
        component,
        path,
        [
          {
            code: 'CYCLE_DETECTED',
            message: `Product component cycle detected: ${cyclePath.join(' -> ')}.`,
            componentId: component.id.trim(),
            productId: childProduct?.id ?? component.sourceId.trim(),
            path,
            cyclePath,
            underlyingCode: 'CYCLE_DETECTED',
          },
        ],
        {
          childProductId: childProduct?.id ?? component.sourceId.trim(),
          childProductName: childProduct?.name ?? null,
        },
      );
    }

    if (!childProduct) {
      return notReadyLine(component, path, [
        {
          code: 'SOURCE_PRODUCT_NOT_FOUND',
          message: `Product ${component.sourceId.trim()} was not found for recursive component costing.`,
          componentId: component.id.trim(),
          productId: component.sourceId.trim(),
          path,
        },
      ]);
    }

    if (!childProduct.isActive) {
      return notReadyLine(
        component,
        path,
        [
          {
            code: 'SOURCE_PRODUCT_INACTIVE',
            message: `Product ${childProduct.id} is archived/inactive and cannot be used for current recursive component costing.`,
            componentId: component.id.trim(),
            productId: childProduct.id,
            path,
          },
        ],
        {
          childProductId: childProduct.id,
          childProductName: childProduct.name,
        },
      );
    }

    let directCost: RecipeMaterialCostPreviewResult;
    try {
      directCost = await this.directMaterialCosts.previewForProduct(childProduct.id);
    } catch (error) {
      if (error instanceof EffectiveRecipeRequirementServiceError) {
        return notReadyLine(
          component,
          path,
          [
            {
              code: 'DIRECT_MATERIAL_COST_NOT_READY',
              message: error.message,
              componentId: component.id.trim(),
              productId: childProduct.id,
              path,
              underlyingCode: error.code,
            },
          ],
          {
            childProductId: childProduct.id,
            childProductName: childProduct.name,
          },
        );
      }
      throw error;
    }

    const childComponents = deterministicComponents(
      allComponents.filter(
        (candidate) => canonicalProductId(candidate.parentProductId) === canonicalProductId(childProduct.id),
      ),
    );

    const issues: ProductBackedComponentCostIssue[] = [];
    if (directCost.status === 'partial') {
      issues.push({
        code: 'DIRECT_MATERIAL_COST_PARTIAL',
        message: `Product ${childProduct.id} has only a partial Phase 2 direct-material cost.`,
        componentId: component.id.trim(),
        productId: childProduct.id,
        path,
      });
    } else if (directCost.status === 'not-ready') {
      issues.push({
        code: 'DIRECT_MATERIAL_COST_NOT_READY',
        message: `Product ${childProduct.id} has no complete Phase 2 direct-material cost.`,
        componentId: component.id.trim(),
        productId: childProduct.id,
        path,
      });
    }

    try {
      validateProductComponentSourceUniqueness(childComponents);
    } catch (error) {
      if (error instanceof ProductCompositionGraphError || error instanceof ProductComponentError) {
        const directEvidence = directHasCostEvidence(directCost);
        const graphIssue: ProductBackedComponentCostIssue = {
          code: 'COMPONENT_GRAPH_INVALID',
          message: error.message,
          componentId: component.id.trim(),
          productId: childProduct.id,
          path,
          underlyingCode: error.code,
        };
        const allIssues = [...issues, graphIssue];

        if (!directEvidence) {
          return notReadyLine(component, path, allIssues, {
            childProductId: childProduct.id,
            childProductName: childProduct.name,
            directCost,
          });
        }

        const unitCost = directCost.totalMaterialCostPerProduct;
        const contribution = unitCost * component.quantityPerParent;
        if (!Number.isFinite(contribution) || contribution < 0) {
          return notReadyLine(
            component,
            path,
            [
              ...allIssues,
              {
                code: 'DERIVED_COST_INVALID',
                message: `Product ${childProduct.id} produced an invalid partial cost contribution.`,
                componentId: component.id.trim(),
                productId: childProduct.id,
                path,
              },
            ],
            {
              childProductId: childProduct.id,
              childProductName: childProduct.name,
              directCost,
            },
          );
        }

        return {
          ...baseLine(component, path),
          childProductId: childProduct.id,
          childProductName: childProduct.name,
          status: 'partial',
          childDirectMaterialCost: cloneDirectMaterialCost(directCost),
          childComponentCostSubtotal: 0,
          childComponentAwareUnitCost: unitCost,
          componentCostContribution: contribution,
          breakdown: [],
          issues: allIssues,
        };
      }
      throw error;
    }

    const breakdown: RecursiveComponentCostBreakdown[] = [];

    for (const childComponent of childComponents) {
      if (childComponent.sourceType === 'material') {
        breakdown.push({
          sourceType: 'material',
          line: await this.materialComponentCosts.costComponent(childComponent),
        });
      } else {
        breakdown.push({
          sourceType: 'product',
          line: await this.costProductEdge(childComponent, allComponents, path),
        });
      }
    }

    let componentSubtotal = 0;
    let nestedHasCostEvidence = false;
    let nestedUnresolved = false;
    let invalidNestedContribution = false;

    for (const entry of breakdown) {
      const status = breakdownStatus(entry);
      const contribution = breakdownContribution(entry);

      if (status === 'partial') {
        nestedUnresolved = true;
        issues.push({
          code: 'NESTED_COMPONENT_PARTIAL',
          message: `Nested component ${entry.line.componentId} under Product ${childProduct.id} has only a partial cost.`,
          componentId: entry.line.componentId,
          productId: childProduct.id,
          path,
        });
      } else if (status === 'not-ready') {
        nestedUnresolved = true;
        issues.push({
          code: 'NESTED_COMPONENT_NOT_READY',
          message: `Nested component ${entry.line.componentId} under Product ${childProduct.id} is not ready for costing.`,
          componentId: entry.line.componentId,
          productId: childProduct.id,
          path,
        });
      }

      if (contribution === null) continue;

      if (!Number.isFinite(contribution) || contribution < 0) {
        invalidNestedContribution = true;
        nestedUnresolved = true;
        issues.push({
          code: 'DERIVED_COST_INVALID',
          message: `Nested component ${entry.line.componentId} produced an invalid contribution.`,
          componentId: entry.line.componentId,
          productId: childProduct.id,
          path,
        });
        continue;
      }

      nestedHasCostEvidence = true;
      componentSubtotal += contribution;
    }

    const directEvidence = directHasCostEvidence(directCost);
    const knownDirectCost = directEvidence ? directCost.totalMaterialCostPerProduct : 0;
    const hasCostEvidence = directEvidence || nestedHasCostEvidence;
    const unresolved = directCost.status !== 'ready' || nestedUnresolved;

    if (!hasCostEvidence) {
      return notReadyLine(component, path, issues, {
        childProductId: childProduct.id,
        childProductName: childProduct.name,
        directCost,
        componentSubtotal,
        breakdown,
      });
    }

    const unitCost = knownDirectCost + componentSubtotal;
    const contribution = unitCost * component.quantityPerParent;

    if (
      invalidNestedContribution ||
      !Number.isFinite(unitCost) ||
      unitCost < 0 ||
      !Number.isFinite(contribution) ||
      contribution < 0
    ) {
      return notReadyLine(
        component,
        path,
        [
          ...issues,
          {
            code: 'DERIVED_COST_INVALID',
            message: `Product ${childProduct.id} produced an invalid recursive component-aware cost.`,
            componentId: component.id.trim(),
            productId: childProduct.id,
            path,
          },
        ],
        {
          childProductId: childProduct.id,
          childProductName: childProduct.name,
          directCost,
          componentSubtotal,
          breakdown,
        },
      );
    }

    return {
      ...baseLine(component, path),
      childProductId: childProduct.id,
      childProductName: childProduct.name,
      status: unresolved ? 'partial' : 'ready',
      childDirectMaterialCost: cloneDirectMaterialCost(directCost),
      childComponentCostSubtotal: componentSubtotal,
      childComponentAwareUnitCost: unitCost,
      componentCostContribution: contribution,
      breakdown: [...breakdown],
      issues: issues.map((issue) => ({
        ...issue,
        path: issue.path ? [...issue.path] : undefined,
        cyclePath: issue.cyclePath ? [...issue.cyclePath] : undefined,
      })),
    };
  }
}
