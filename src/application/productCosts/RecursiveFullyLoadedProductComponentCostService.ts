import {
  ProductCompositionGraphError,
  validateProductComponentSourceUniqueness,
} from '../../domain/productCompositionGraph';
import {
  ProductComponentError,
  type ProductComponent,
  type ProductComponentRole,
  validateProductComponentContract,
} from '../../domain/productComponents';
import type { ProductFinancialProfile } from '../../domain/productFinancialProfile';
import type { ProductRepository } from '../products/ProductRepository';
import type { ProductComponentRepository } from '../productComponents/ProductComponentRepository';
import type { MaterialBackedComponentCostLine } from '../productComponents/MaterialBackedComponentCostService';
import {
  WasteAdjustedDirectMaterialCostServiceError,
  type WasteAdjustedDirectMaterialCostResult,
} from './WasteAdjustedDirectMaterialCostService';

export type RecursiveFullyLoadedProductComponentCostStatus = 'ready' | 'partial' | 'not-ready';
export type RecursiveFullyLoadedDirectMaterialMode =
  | 'costed'
  | 'neutral-component-only'
  | 'unresolved';

export type RecursiveFullyLoadedProductComponentCostIssueCode =
  | 'INVALID_COMPONENT'
  | 'NOT_PRODUCT_BACKED_COMPONENT'
  | 'SOURCE_PRODUCT_NOT_FOUND'
  | 'SOURCE_PRODUCT_INACTIVE'
  | 'DIRECT_MATERIAL_COST_PARTIAL'
  | 'DIRECT_MATERIAL_COST_NOT_READY'
  | 'FINANCIAL_PROFILE_MISSING'
  | 'FINANCIAL_PROFILE_PRODUCT_MISMATCH'
  | 'FINANCIAL_PROFILE_COST_INVALID'
  | 'COMPONENT_GRAPH_INVALID'
  | 'MATERIAL_COMPONENT_NOT_READY'
  | 'NESTED_PRODUCT_COMPONENT_PARTIAL'
  | 'NESTED_PRODUCT_COMPONENT_NOT_READY'
  | 'CYCLE_DETECTED'
  | 'DERIVED_COST_INVALID';

export interface RecursiveFullyLoadedProductComponentCostIssue {
  code: RecursiveFullyLoadedProductComponentCostIssueCode;
  message: string;
  componentId?: string;
  productId?: string;
  path?: readonly string[];
  cyclePath?: readonly string[];
  underlyingCode?: string;
}

export interface RecursiveFullyLoadedMaterialBreakdown {
  sourceType: 'material';
  line: MaterialBackedComponentCostLine;
}

export interface RecursiveFullyLoadedProductBreakdown {
  sourceType: 'product';
  line: RecursiveFullyLoadedProductComponentCostLine;
}

export type RecursiveFullyLoadedComponentBreakdown =
  | RecursiveFullyLoadedMaterialBreakdown
  | RecursiveFullyLoadedProductBreakdown;

export interface RecursiveFullyLoadedProductComponentCostLine {
  componentId: string;
  parentProductId: string;
  role: ProductComponentRole;
  childProductId: string;
  childProductName: string | null;
  quantityPerParent: number;
  path: readonly string[];
  status: RecursiveFullyLoadedProductComponentCostStatus;
  childDirectMaterialCost: WasteAdjustedDirectMaterialCostResult | null;
  childDirectMaterialMode: RecursiveFullyLoadedDirectMaterialMode;
  childMaterialComponentCostSubtotal: number;
  childProductComponentCostSubtotal: number;
  childLaborCostPerUnit: number | null;
  childOverheadCostPerUnit: number | null;
  knownChildProductionCostSubtotal: number | null;
  childFullyLoadedUnitCost: number | null;
  knownComponentCostContribution: number | null;
  componentCostContribution: number | null;
  breakdown: RecursiveFullyLoadedComponentBreakdown[];
  issues: RecursiveFullyLoadedProductComponentCostIssue[];
}

export interface RecursiveWasteAdjustedDirectMaterialCostProvider {
  costProduct(productId: string): Promise<WasteAdjustedDirectMaterialCostResult>;
}

export interface RecursiveMaterialBackedComponentCostProvider {
  costComponent(component: ProductComponent): Promise<MaterialBackedComponentCostLine>;
}

export interface RecursiveProductFinancialProfileProvider {
  getProfile(productId: string): Promise<ProductFinancialProfile | null>;
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

function finiteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function cloneDirectCost(value: WasteAdjustedDirectMaterialCostResult): WasteAdjustedDirectMaterialCostResult {
  return {
    ...value,
    lines: value.lines.map((line) => ({
      ...line,
      requirementContributions: line.requirementContributions.map((contribution) => ({ ...contribution })),
      costContributions: line.costContributions.map((contribution) => ({ ...contribution })),
      issues: line.issues.map((issue) => ({ ...issue })),
    })),
    requirementIssues: value.requirementIssues.map((issue) => ({ ...issue })),
    costIssues: value.costIssues.map((issue) => ({ ...issue })),
    issues: value.issues.map((issue) => ({ ...issue })),
  };
}

function cloneMaterialLine(line: MaterialBackedComponentCostLine): MaterialBackedComponentCostLine {
  return {
    ...line,
    costingTrace: line.costingTrace ? { ...line.costingTrace } : null,
    sourceAvailability: line.sourceAvailability
      ? {
          ...line.sourceAvailability,
          issues: line.sourceAvailability.issues.map((issue) => ({ ...issue })),
          materialInventoryNormalization: line.sourceAvailability.materialInventoryNormalization
            ? { ...line.sourceAvailability.materialInventoryNormalization }
            : undefined,
          productStock: line.sourceAvailability.productStock
            ? { ...line.sourceAvailability.productStock }
            : line.sourceAvailability.productStock,
        }
      : null,
    issues: line.issues.map((issue) => ({ ...issue })),
  };
}

function cloneIssue(
  issue: RecursiveFullyLoadedProductComponentCostIssue,
): RecursiveFullyLoadedProductComponentCostIssue {
  return {
    ...issue,
    path: issue.path ? [...issue.path] : undefined,
    cyclePath: issue.cyclePath ? [...issue.cyclePath] : undefined,
  };
}

function baseLine(
  component: ProductComponent,
  path: readonly string[],
): Pick<
  RecursiveFullyLoadedProductComponentCostLine,
  | 'componentId'
  | 'parentProductId'
  | 'role'
  | 'childProductId'
  | 'childProductName'
  | 'quantityPerParent'
  | 'path'
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
  issues: readonly RecursiveFullyLoadedProductComponentCostIssue[],
  context: {
    childProductId?: string;
    childProductName?: string | null;
    directCost?: WasteAdjustedDirectMaterialCostResult | null;
    directMode?: RecursiveFullyLoadedDirectMaterialMode;
    materialSubtotal?: number;
    productSubtotal?: number;
    labor?: number | null;
    overhead?: number | null;
    knownSubtotal?: number | null;
    knownContribution?: number | null;
    breakdown?: RecursiveFullyLoadedComponentBreakdown[];
  } = {},
): RecursiveFullyLoadedProductComponentCostLine {
  return {
    ...baseLine(component, path),
    childProductId: context.childProductId ?? component.sourceId.trim(),
    childProductName: context.childProductName ?? null,
    status: 'not-ready',
    childDirectMaterialCost: context.directCost ? cloneDirectCost(context.directCost) : null,
    childDirectMaterialMode: context.directMode ?? 'unresolved',
    childMaterialComponentCostSubtotal: context.materialSubtotal ?? 0,
    childProductComponentCostSubtotal: context.productSubtotal ?? 0,
    childLaborCostPerUnit: context.labor ?? null,
    childOverheadCostPerUnit: context.overhead ?? null,
    knownChildProductionCostSubtotal: context.knownSubtotal ?? null,
    childFullyLoadedUnitCost: null,
    knownComponentCostContribution: context.knownContribution ?? null,
    componentCostContribution: null,
    breakdown: context.breakdown ? [...context.breakdown] : [],
    issues: issues.map(cloneIssue),
  };
}

function closedCyclePath(activePath: readonly string[], childId: string): readonly string[] {
  const child = canonicalProductId(childId);
  const start = activePath.findIndex((item) => canonicalProductId(item) === child);
  if (start < 0) return [...activePath.map(canonicalProductId), child];
  return [...activePath.slice(start).map(canonicalProductId), child];
}

function isNeutralComponentOnlyDirectCost(
  directCost: WasteAdjustedDirectMaterialCostResult,
  childComponents: readonly ProductComponent[],
): boolean {
  if (childComponents.length === 0) return false;
  if (directCost.status !== 'not-ready') return false;
  if (directCost.lines.length !== 0) return false;
  if (directCost.pricingDirectMaterialCostPerUnit !== null) return false;
  if (directCost.costIssues.length !== 0) return false;
  if (
    directCost.requirementIssues.length === 0 ||
    directCost.requirementIssues.some((issue) => issue.code !== 'NO_REQUIREMENTS')
  ) {
    return false;
  }

  return directCost.issues.every(
    (issue) => issue.code === 'REQUIREMENT_NOT_READY' || issue.code === 'COST_NOT_READY',
  );
}

/**
 * Phase 4.2B recursive fully loaded Product-backed component costing.
 *
 * Child direct material delegates to 4.2A, purchased Material-backed components
 * delegate to 3.3A, and child labor/overhead comes from the Phase 4 financial
 * profile. Child pricing policy is deliberately ignored. ProductStock/current
 * availability does not participate in production-cost mathematics.
 */
export class RecursiveFullyLoadedProductComponentCostService {
  constructor(
    private readonly products: ProductRepository,
    private readonly components: ProductComponentRepository,
    private readonly directMaterialCosts: RecursiveWasteAdjustedDirectMaterialCostProvider,
    private readonly materialComponentCosts: RecursiveMaterialBackedComponentCostProvider,
    private readonly financialProfiles: RecursiveProductFinancialProfileProvider,
  ) {}

  async costComponent(
    component: ProductComponent,
  ): Promise<RecursiveFullyLoadedProductComponentCostLine> {
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
          message: `Component ${component.id.trim()} is ${component.sourceType}-backed and is outside Phase 4.2B Product-backed costing.`,
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
  ): Promise<RecursiveFullyLoadedProductComponentCostLine> {
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
      return notReadyLine(component, [...activePath], [
        {
          code: 'NOT_PRODUCT_BACKED_COMPONENT',
          message: `Component ${component.id.trim()} is not Product-backed.`,
          componentId: component.id.trim(),
          productId: component.sourceId.trim(),
          path: [...activePath],
        },
      ]);
    }

    const childKey = canonicalProductId(component.sourceId);
    const path = [...activePath, childKey];
    const cycleIndex = activePath.findIndex((item) => canonicalProductId(item) === childKey);

    if (cycleIndex >= 0) {
      const cyclePath = closedCyclePath(activePath, childKey);
      return notReadyLine(component, path, [
        {
          code: 'CYCLE_DETECTED',
          message: `Product component cycle detected: ${cyclePath.join(' -> ')}.`,
          componentId: component.id.trim(),
          productId: component.sourceId.trim(),
          path,
          cyclePath,
          underlyingCode: 'CYCLE_DETECTED',
        },
      ]);
    }

    const childProduct = await this.products.findById(component.sourceId);
    if (!childProduct) {
      return notReadyLine(component, path, [
        {
          code: 'SOURCE_PRODUCT_NOT_FOUND',
          message: `Product ${component.sourceId.trim()} was not found for recursive fully loaded costing.`,
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
            message: `Product ${childProduct.id} is archived/inactive and cannot be used for current recursive fully loaded costing.`,
            componentId: component.id.trim(),
            productId: childProduct.id,
            path,
          },
        ],
        { childProductId: childProduct.id, childProductName: childProduct.name },
      );
    }

    const childComponents = deterministicComponents(
      allComponents.filter(
        (candidate) => canonicalProductId(candidate.parentProductId) === canonicalProductId(childProduct.id),
      ),
    );

    let directCost: WasteAdjustedDirectMaterialCostResult;
    try {
      directCost = await this.directMaterialCosts.costProduct(childProduct.id);
    } catch (error) {
      if (error instanceof WasteAdjustedDirectMaterialCostServiceError) {
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
          { childProductId: childProduct.id, childProductName: childProduct.name },
        );
      }
      throw error;
    }

    const issues: RecursiveFullyLoadedProductComponentCostIssue[] = [];
    const neutralDirect = isNeutralComponentOnlyDirectCost(directCost, childComponents);
    let directMode: RecursiveFullyLoadedDirectMaterialMode = 'unresolved';
    let directKnownCost: number | null = null;
    let directResolved = false;

    if (neutralDirect) {
      directMode = 'neutral-component-only';
      directKnownCost = 0;
      directResolved = true;
    } else if (
      directCost.pricingDirectMaterialCostPerUnit !== null &&
      finiteNonNegative(directCost.pricingDirectMaterialCostPerUnit)
    ) {
      directMode = 'costed';
      directKnownCost = directCost.pricingDirectMaterialCostPerUnit;
      directResolved = directCost.status === 'ready';

      if (directCost.status === 'partial') {
        issues.push({
          code: 'DIRECT_MATERIAL_COST_PARTIAL',
          message: `Product ${childProduct.id} has only partial Phase 4.2A direct-material cost evidence.`,
          componentId: component.id.trim(),
          productId: childProduct.id,
          path,
        });
      } else if (directCost.status === 'not-ready') {
        issues.push({
          code: 'DIRECT_MATERIAL_COST_NOT_READY',
          message: `Product ${childProduct.id} has no ready Phase 4.2A direct-material cost.`,
          componentId: component.id.trim(),
          productId: childProduct.id,
          path,
        });
      }
    } else {
      if (
        directCost.pricingDirectMaterialCostPerUnit !== null &&
        !finiteNonNegative(directCost.pricingDirectMaterialCostPerUnit)
      ) {
        issues.push({
          code: 'DERIVED_COST_INVALID',
          message: `Product ${childProduct.id} produced an invalid direct-material cost subtotal.`,
          componentId: component.id.trim(),
          productId: childProduct.id,
          path,
        });
      } else {
        issues.push({
          code:
            directCost.status === 'partial'
              ? 'DIRECT_MATERIAL_COST_PARTIAL'
              : 'DIRECT_MATERIAL_COST_NOT_READY',
          message:
            directCost.status === 'partial'
              ? `Product ${childProduct.id} has only partial Phase 4.2A direct-material cost evidence.`
              : `Product ${childProduct.id} has no ready Phase 4.2A direct-material cost.`,
          componentId: component.id.trim(),
          productId: childProduct.id,
          path,
        });
      }
    }

    const profile = await this.financialProfiles.getProfile(childProduct.id);
    let profileResolved = false;
    let labor: number | null = null;
    let overhead: number | null = null;

    if (!profile) {
      issues.push({
        code: 'FINANCIAL_PROFILE_MISSING',
        message: `Product ${childProduct.id} has no financial profile, so labor and overhead are unresolved.`,
        componentId: component.id.trim(),
        productId: childProduct.id,
        path,
      });
    } else if (canonicalProductId(profile.productId) !== canonicalProductId(childProduct.id)) {
      issues.push({
        code: 'FINANCIAL_PROFILE_PRODUCT_MISMATCH',
        message: `Financial profile belongs to ${profile.productId}, not Product ${childProduct.id}.`,
        componentId: component.id.trim(),
        productId: childProduct.id,
        path,
      });
    } else if (
      !finiteNonNegative(profile.laborCostPerUnit) ||
      !finiteNonNegative(profile.overheadCostPerUnit)
    ) {
      issues.push({
        code: 'FINANCIAL_PROFILE_COST_INVALID',
        message: `Product ${childProduct.id} financial profile has invalid labor or overhead cost.`,
        componentId: component.id.trim(),
        productId: childProduct.id,
        path,
      });
    } else {
      profileResolved = true;
      labor = profile.laborCostPerUnit;
      overhead = profile.overheadCostPerUnit;
    }

    let graphInvalid = false;
    try {
      validateProductComponentSourceUniqueness(childComponents);
    } catch (error) {
      if (error instanceof ProductCompositionGraphError || error instanceof ProductComponentError) {
        graphInvalid = true;
        issues.push({
          code: 'COMPONENT_GRAPH_INVALID',
          message: error.message,
          componentId: component.id.trim(),
          productId: childProduct.id,
          path,
          underlyingCode: error.code,
        });
      } else {
        throw error;
      }
    }

    const breakdown: RecursiveFullyLoadedComponentBreakdown[] = [];
    let materialSubtotal = 0;
    let productSubtotal = 0;
    let materialKnown = false;
    let productKnown = false;
    let componentUnresolved = graphInvalid;

    if (!graphInvalid) {
      for (const childComponent of childComponents) {
        if (childComponent.sourceType === 'material') {
          const line = await this.materialComponentCosts.costComponent(childComponent);
          const cloned = cloneMaterialLine(line);
          breakdown.push({ sourceType: 'material', line: cloned });

          if (
            line.componentCostContribution !== null &&
            finiteNonNegative(line.componentCostContribution)
          ) {
            materialKnown = true;
            materialSubtotal += line.componentCostContribution;
          }

          if (
            line.status !== 'ready' ||
            line.componentCostContribution === null ||
            !finiteNonNegative(line.componentCostContribution)
          ) {
            componentUnresolved = true;
            issues.push({
              code: 'MATERIAL_COMPONENT_NOT_READY',
              message: `Material-backed component ${line.componentId} under Product ${childProduct.id} is not ready for fully loaded costing.`,
              componentId: line.componentId,
              productId: childProduct.id,
              path,
              underlyingCode: line.issues[0]?.code,
            });
          }
        } else {
          const line = await this.costProductEdge(childComponent, allComponents, path);
          breakdown.push({ sourceType: 'product', line });

          if (
            line.knownComponentCostContribution !== null &&
            finiteNonNegative(line.knownComponentCostContribution)
          ) {
            productKnown = true;
            productSubtotal += line.knownComponentCostContribution;
          }

          if (
            line.status !== 'ready' ||
            line.componentCostContribution === null ||
            !finiteNonNegative(line.componentCostContribution)
          ) {
            componentUnresolved = true;
            issues.push({
              code:
                line.status === 'partial'
                  ? 'NESTED_PRODUCT_COMPONENT_PARTIAL'
                  : 'NESTED_PRODUCT_COMPONENT_NOT_READY',
              message:
                line.status === 'partial'
                  ? `Nested Product-backed component ${line.componentId} under Product ${childProduct.id} has only partial fully loaded cost.`
                  : `Nested Product-backed component ${line.componentId} under Product ${childProduct.id} is not ready for fully loaded costing.`,
              componentId: line.componentId,
              productId: childProduct.id,
              path,
              underlyingCode: line.issues[0]?.code,
            });
          }
        }
      }
    }

    const hasKnownEvidence =
      directKnownCost !== null || profileResolved || materialKnown || productKnown;
    const knownSubtotal = hasKnownEvidence
      ? (directKnownCost ?? 0) +
        materialSubtotal +
        productSubtotal +
        (profileResolved ? (labor ?? 0) + (overhead ?? 0) : 0)
      : null;
    const knownContribution =
      knownSubtotal === null ? null : knownSubtotal * component.quantityPerParent;

    if (
      (knownSubtotal !== null && !finiteNonNegative(knownSubtotal)) ||
      (knownContribution !== null && !finiteNonNegative(knownContribution))
    ) {
      return notReadyLine(
        component,
        path,
        [
          ...issues,
          {
            code: 'DERIVED_COST_INVALID',
            message: `Product ${childProduct.id} produced an invalid recursive fully loaded cost subtotal.`,
            componentId: component.id.trim(),
            productId: childProduct.id,
            path,
          },
        ],
        {
          childProductId: childProduct.id,
          childProductName: childProduct.name,
          directCost,
          directMode,
          materialSubtotal,
          productSubtotal,
          labor,
          overhead,
          breakdown,
        },
      );
    }

    const unresolved = !directResolved || !profileResolved || componentUnresolved;
    const status: RecursiveFullyLoadedProductComponentCostStatus = !hasKnownEvidence
      ? 'not-ready'
      : unresolved
        ? 'partial'
        : 'ready';

    return {
      ...baseLine(component, path),
      childProductId: childProduct.id,
      childProductName: childProduct.name,
      status,
      childDirectMaterialCost: cloneDirectCost(directCost),
      childDirectMaterialMode: directMode,
      childMaterialComponentCostSubtotal: materialSubtotal,
      childProductComponentCostSubtotal: productSubtotal,
      childLaborCostPerUnit: labor,
      childOverheadCostPerUnit: overhead,
      knownChildProductionCostSubtotal: knownSubtotal,
      childFullyLoadedUnitCost: status === 'ready' ? knownSubtotal : null,
      knownComponentCostContribution: knownContribution,
      componentCostContribution: status === 'ready' ? knownContribution : null,
      breakdown: [...breakdown],
      issues: issues.map(cloneIssue),
    };
  }
}
