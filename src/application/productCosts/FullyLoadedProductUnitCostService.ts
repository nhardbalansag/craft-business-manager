import {
  ProductCompositionGraphError,
  validateProductComponentSourceUniqueness,
} from '../../domain/productCompositionGraph';
import {
  ProductComponentError,
  type ProductComponent,
  type ProductComponentSourceType,
} from '../../domain/productComponents';
import type { ProductFinancialProfile } from '../../domain/productFinancialProfile';
import type { ProductRepository } from '../products/ProductRepository';
import type { ProductComponentRepository } from '../productComponents/ProductComponentRepository';
import type { MaterialBackedComponentCostLine } from '../productComponents/MaterialBackedComponentCostService';
import type {
  RecursiveFullyLoadedProductComponentCostIssue,
  RecursiveFullyLoadedProductComponentCostLine,
} from './RecursiveFullyLoadedProductComponentCostService';
import {
  WasteAdjustedDirectMaterialCostServiceError,
  type WasteAdjustedDirectMaterialCostResult,
} from './WasteAdjustedDirectMaterialCostService';

export type FullyLoadedProductUnitCostStatus = 'ready' | 'partial' | 'not-ready';
export type FullyLoadedRootDirectMaterialMode =
  | 'costed'
  | 'neutral-component-only'
  | 'unresolved';

export type FullyLoadedProductUnitCostIssueCode =
  | 'DIRECT_MATERIAL_COST_PARTIAL'
  | 'DIRECT_MATERIAL_COST_NOT_READY'
  | 'FINANCIAL_PROFILE_MISSING'
  | 'FINANCIAL_PROFILE_PRODUCT_MISMATCH'
  | 'FINANCIAL_PROFILE_COST_INVALID'
  | 'COMPONENT_GRAPH_INVALID'
  | 'MATERIAL_COMPONENT_NOT_READY'
  | 'PRODUCT_COMPONENT_PARTIAL'
  | 'PRODUCT_COMPONENT_NOT_READY'
  | 'DERIVED_COST_INVALID';

export interface FullyLoadedProductUnitCostIssue {
  code: FullyLoadedProductUnitCostIssueCode;
  message: string;
  productId: string;
  componentId?: string;
  sourceType?: ProductComponentSourceType;
  sourceId?: string;
  underlyingCode?: string;
}

export interface FullyLoadedMaterialComponentLine {
  sourceType: 'material';
  line: MaterialBackedComponentCostLine;
}

export interface FullyLoadedProductComponentLine {
  sourceType: 'product';
  line: RecursiveFullyLoadedProductComponentCostLine;
}

export type FullyLoadedProductUnitCostComponentLine =
  | FullyLoadedMaterialComponentLine
  | FullyLoadedProductComponentLine;

export interface FullyLoadedProductUnitCostResult {
  productId: string;
  productName: string;
  productIsActive: boolean;
  status: FullyLoadedProductUnitCostStatus;
  directMaterialCost: WasteAdjustedDirectMaterialCostResult | null;
  directMaterialMode: FullyLoadedRootDirectMaterialMode;
  directMaterialCostSubtotal: number;
  materialComponentCostSubtotal: number;
  productComponentCostSubtotal: number;
  inputMaterialComponentSubtotal: number | null;
  laborCostPerUnit: number | null;
  overheadCostPerUnit: number | null;
  knownFullyLoadedUnitCostSubtotal: number | null;
  totalFullyLoadedUnitCost: number | null;
  componentLines: FullyLoadedProductUnitCostComponentLine[];
  issues: FullyLoadedProductUnitCostIssue[];
}

export type FullyLoadedProductUnitCostServiceErrorCode = 'PRODUCT_NOT_FOUND';

export class FullyLoadedProductUnitCostServiceError extends Error {
  readonly code: FullyLoadedProductUnitCostServiceErrorCode;
  readonly productId: string;

  constructor(code: FullyLoadedProductUnitCostServiceErrorCode, message: string, productId: string) {
    super(message);
    this.name = 'FullyLoadedProductUnitCostServiceError';
    this.code = code;
    this.productId = productId;
  }
}

export interface FullyLoadedDirectMaterialCostProvider {
  costProduct(productId: string): Promise<WasteAdjustedDirectMaterialCostResult>;
}

export interface FullyLoadedMaterialComponentCostProvider {
  costComponent(component: ProductComponent): Promise<MaterialBackedComponentCostLine>;
}

export interface FullyLoadedProductComponentCostProvider {
  costComponent(component: ProductComponent): Promise<RecursiveFullyLoadedProductComponentCostLine>;
}

export interface FullyLoadedProductFinancialProfileProvider {
  getProfile(productId: string): Promise<ProductFinancialProfile | null>;
}

function comparable(value: string): string {
  return value.trim().toLowerCase();
}

function finiteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function deterministicComponents(components: readonly ProductComponent[]): ProductComponent[] {
  return [...components].sort((left, right) => {
    const leftType = String(left.sourceType);
    const rightType = String(right.sourceType);
    if (leftType !== rightType) return leftType < rightType ? -1 : 1;

    const leftSource = comparable(left.sourceId);
    const rightSource = comparable(right.sourceId);
    if (leftSource !== rightSource) return leftSource < rightSource ? -1 : 1;

    return comparable(left.id).localeCompare(comparable(right.id));
  });
}

function cloneDirectCost(value: WasteAdjustedDirectMaterialCostResult): WasteAdjustedDirectMaterialCostResult {
  return {
    ...value,
    lines: value.lines.map((line) => ({
      ...line,
      requirementContributions: line.requirementContributions.map((entry) => ({ ...entry })),
      costContributions: line.costContributions.map((entry) => ({ ...entry })),
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

function cloneRecursiveIssue(
  issue: RecursiveFullyLoadedProductComponentCostIssue,
): RecursiveFullyLoadedProductComponentCostIssue {
  return {
    ...issue,
    path: issue.path ? [...issue.path] : undefined,
    cyclePath: issue.cyclePath ? [...issue.cyclePath] : undefined,
  };
}

function cloneRecursiveLine(
  line: RecursiveFullyLoadedProductComponentCostLine,
): RecursiveFullyLoadedProductComponentCostLine {
  return {
    ...line,
    path: [...line.path],
    childDirectMaterialCost: line.childDirectMaterialCost
      ? cloneDirectCost(line.childDirectMaterialCost)
      : null,
    breakdown: line.breakdown.map((entry) =>
      entry.sourceType === 'material'
        ? { sourceType: 'material' as const, line: cloneMaterialLine(entry.line) }
        : { sourceType: 'product' as const, line: cloneRecursiveLine(entry.line) },
    ),
    issues: line.issues.map(cloneRecursiveIssue),
  };
}

function isNeutralComponentOnlyDirectCost(
  directCost: WasteAdjustedDirectMaterialCostResult,
  components: readonly ProductComponent[],
): boolean {
  return (
    components.length > 0 &&
    directCost.status === 'not-ready' &&
    directCost.lines.length === 0 &&
    directCost.pricingDirectMaterialCostPerUnit === null &&
    directCost.costIssues.length === 0 &&
    directCost.requirementIssues.length > 0 &&
    directCost.requirementIssues.every((issue) => issue.code === 'NO_REQUIREMENTS') &&
    directCost.issues.every(
      (issue) => issue.code === 'REQUIREMENT_NOT_READY' || issue.code === 'COST_NOT_READY',
    )
  );
}

/** Phase 4.2C authoritative root-Product fully loaded unit cost. */
export class FullyLoadedProductUnitCostService {
  constructor(
    private readonly products: ProductRepository,
    private readonly components: ProductComponentRepository,
    private readonly directMaterialCosts: FullyLoadedDirectMaterialCostProvider,
    private readonly materialComponentCosts: FullyLoadedMaterialComponentCostProvider,
    private readonly productComponentCosts: FullyLoadedProductComponentCostProvider,
    private readonly financialProfiles: FullyLoadedProductFinancialProfileProvider,
  ) {}

  async costProduct(productId: string): Promise<FullyLoadedProductUnitCostResult> {
    const requestedId = productId.trim();
    const product = await this.products.findById(requestedId);
    if (!product) {
      throw new FullyLoadedProductUnitCostServiceError(
        'PRODUCT_NOT_FOUND',
        `Product ${requestedId} was not found for fully loaded unit costing.`,
        requestedId,
      );
    }

    const rootComponents = deterministicComponents(
      (await this.components.list()).filter(
        (component) => comparable(component.parentProductId) === comparable(product.id),
      ),
    );
    const issues: FullyLoadedProductUnitCostIssue[] = [];

    let directMaterialCost: WasteAdjustedDirectMaterialCostResult | null = null;
    let directMaterialMode: FullyLoadedRootDirectMaterialMode = 'unresolved';
    let directKnownCost: number | null = null;
    let directResolved = false;

    try {
      directMaterialCost = await this.directMaterialCosts.costProduct(product.id);
    } catch (error) {
      if (error instanceof WasteAdjustedDirectMaterialCostServiceError) {
        issues.push({
          code: 'DIRECT_MATERIAL_COST_NOT_READY',
          message: error.message,
          productId: product.id,
          underlyingCode: error.code,
        });
      } else {
        throw error;
      }
    }

    if (directMaterialCost) {
      if (isNeutralComponentOnlyDirectCost(directMaterialCost, rootComponents)) {
        directMaterialMode = 'neutral-component-only';
        directKnownCost = 0;
        directResolved = true;
      } else if (
        directMaterialCost.pricingDirectMaterialCostPerUnit !== null &&
        finiteNonNegative(directMaterialCost.pricingDirectMaterialCostPerUnit)
      ) {
        directMaterialMode = 'costed';
        directKnownCost = directMaterialCost.pricingDirectMaterialCostPerUnit;
        directResolved = directMaterialCost.status === 'ready';
        if (!directResolved) {
          issues.push({
            code:
              directMaterialCost.status === 'partial'
                ? 'DIRECT_MATERIAL_COST_PARTIAL'
                : 'DIRECT_MATERIAL_COST_NOT_READY',
            message:
              directMaterialCost.status === 'partial'
                ? `Product ${product.id} has only partial Phase 4.2A direct-material cost evidence.`
                : `Product ${product.id} has no ready Phase 4.2A direct-material cost.`,
            productId: product.id,
          });
        }
      } else {
        issues.push({
          code:
            directMaterialCost.pricingDirectMaterialCostPerUnit !== null
              ? 'DERIVED_COST_INVALID'
              : directMaterialCost.status === 'partial'
                ? 'DIRECT_MATERIAL_COST_PARTIAL'
                : 'DIRECT_MATERIAL_COST_NOT_READY',
          message:
            directMaterialCost.pricingDirectMaterialCostPerUnit !== null
              ? `Product ${product.id} produced an invalid direct-material cost subtotal.`
              : directMaterialCost.status === 'partial'
                ? `Product ${product.id} has only partial Phase 4.2A direct-material cost evidence.`
                : `Product ${product.id} has no ready Phase 4.2A direct-material cost.`,
          productId: product.id,
        });
      }
    }

    const profile = await this.financialProfiles.getProfile(product.id);
    let profileResolved = false;
    let labor: number | null = null;
    let overhead: number | null = null;

    if (!profile) {
      issues.push({
        code: 'FINANCIAL_PROFILE_MISSING',
        message: `Product ${product.id} has no financial profile, so labor and overhead are unresolved.`,
        productId: product.id,
      });
    } else if (comparable(profile.productId) !== comparable(product.id)) {
      issues.push({
        code: 'FINANCIAL_PROFILE_PRODUCT_MISMATCH',
        message: `Financial profile belongs to ${profile.productId}, not Product ${product.id}.`,
        productId: product.id,
      });
    } else if (
      !finiteNonNegative(profile.laborCostPerUnit) ||
      !finiteNonNegative(profile.overheadCostPerUnit)
    ) {
      issues.push({
        code: 'FINANCIAL_PROFILE_COST_INVALID',
        message: `Product ${product.id} financial profile has invalid labor or overhead cost.`,
        productId: product.id,
      });
    } else {
      profileResolved = true;
      labor = profile.laborCostPerUnit;
      overhead = profile.overheadCostPerUnit;
    }

    let graphInvalid = false;
    try {
      validateProductComponentSourceUniqueness(rootComponents);
    } catch (error) {
      if (error instanceof ProductCompositionGraphError || error instanceof ProductComponentError) {
        graphInvalid = true;
        issues.push({
          code: 'COMPONENT_GRAPH_INVALID',
          message: error.message,
          productId: product.id,
          componentId: 'componentId' in error ? error.componentId : undefined,
          underlyingCode: error.code,
        });
      } else {
        throw error;
      }
    }

    const componentLines: FullyLoadedProductUnitCostComponentLine[] = [];
    let materialSubtotal = 0;
    let productSubtotal = 0;
    let materialKnown = false;
    let productKnown = false;
    let componentUnresolved = graphInvalid;

    if (!graphInvalid) {
      for (const component of rootComponents) {
        if (component.sourceType === 'material') {
          const rawLine = await this.materialComponentCosts.costComponent(component);
          componentLines.push({ sourceType: 'material', line: cloneMaterialLine(rawLine) });

          const contribution = rawLine.componentCostContribution;
          if (contribution !== null && finiteNonNegative(contribution)) {
            materialKnown = true;
            materialSubtotal += contribution;
          }

          if (contribution !== null && !finiteNonNegative(contribution)) {
            componentUnresolved = true;
            issues.push({
              code: 'DERIVED_COST_INVALID',
              message: `Material-backed component ${rawLine.componentId} produced an invalid cost contribution.`,
              productId: product.id,
              componentId: rawLine.componentId,
              sourceType: 'material',
              sourceId: rawLine.sourceMaterialId,
            });
          } else if (rawLine.status !== 'ready' || contribution === null) {
            componentUnresolved = true;
            issues.push({
              code: 'MATERIAL_COMPONENT_NOT_READY',
              message: `Material-backed component ${rawLine.componentId} is not ready for fully loaded costing.`,
              productId: product.id,
              componentId: rawLine.componentId,
              sourceType: 'material',
              sourceId: rawLine.sourceMaterialId,
              underlyingCode: rawLine.issues[0]?.code,
            });
          }
        } else {
          const rawLine = await this.productComponentCosts.costComponent(component);
          componentLines.push({ sourceType: 'product', line: cloneRecursiveLine(rawLine) });

          const knownContribution = rawLine.knownComponentCostContribution;
          if (knownContribution !== null && finiteNonNegative(knownContribution)) {
            productKnown = true;
            productSubtotal += knownContribution;
          }

          if (knownContribution !== null && !finiteNonNegative(knownContribution)) {
            componentUnresolved = true;
            issues.push({
              code: 'DERIVED_COST_INVALID',
              message: `Product-backed component ${rawLine.componentId} produced an invalid known cost contribution.`,
              productId: product.id,
              componentId: rawLine.componentId,
              sourceType: 'product',
              sourceId: rawLine.childProductId,
            });
          } else if (rawLine.status !== 'ready' || rawLine.componentCostContribution === null) {
            componentUnresolved = true;
            issues.push({
              code:
                rawLine.status === 'partial'
                  ? 'PRODUCT_COMPONENT_PARTIAL'
                  : 'PRODUCT_COMPONENT_NOT_READY',
              message:
                rawLine.status === 'partial'
                  ? `Product-backed component ${rawLine.componentId} has only partial fully loaded cost evidence.`
                  : `Product-backed component ${rawLine.componentId} is not ready for fully loaded costing.`,
              productId: product.id,
              componentId: rawLine.componentId,
              sourceType: 'product',
              sourceId: rawLine.childProductId,
              underlyingCode: rawLine.issues[0]?.code,
            });
          }
        }
      }
    }

    const hasProductionInputEvidence = directKnownCost !== null || materialKnown || productKnown;
    const inputSubtotal = hasProductionInputEvidence
      ? (directKnownCost ?? 0) + materialSubtotal + productSubtotal
      : null;
    const hasKnownEvidence = hasProductionInputEvidence || profileResolved;
    const knownTotal = hasKnownEvidence
      ? (inputSubtotal ?? 0) + (profileResolved ? (labor ?? 0) + (overhead ?? 0) : 0)
      : null;

    if (
      (inputSubtotal !== null && !finiteNonNegative(inputSubtotal)) ||
      (knownTotal !== null && !finiteNonNegative(knownTotal))
    ) {
      issues.push({
        code: 'DERIVED_COST_INVALID',
        message: `Product ${product.id} produced an invalid fully loaded unit-cost subtotal.`,
        productId: product.id,
      });
      return {
        productId: product.id,
        productName: product.name,
        productIsActive: product.isActive,
        status: 'not-ready',
        directMaterialCost: directMaterialCost ? cloneDirectCost(directMaterialCost) : null,
        directMaterialMode,
        directMaterialCostSubtotal: directKnownCost ?? 0,
        materialComponentCostSubtotal: materialSubtotal,
        productComponentCostSubtotal: productSubtotal,
        inputMaterialComponentSubtotal: inputSubtotal,
        laborCostPerUnit: labor,
        overheadCostPerUnit: overhead,
        knownFullyLoadedUnitCostSubtotal: null,
        totalFullyLoadedUnitCost: null,
        componentLines: [...componentLines],
        issues: issues.map((issue) => ({ ...issue })),
      };
    }

    const unresolved = !directResolved || !profileResolved || componentUnresolved;
    const status: FullyLoadedProductUnitCostStatus = !hasKnownEvidence
      ? 'not-ready'
      : unresolved
        ? 'partial'
        : 'ready';

    return {
      productId: product.id,
      productName: product.name,
      productIsActive: product.isActive,
      status,
      directMaterialCost: directMaterialCost ? cloneDirectCost(directMaterialCost) : null,
      directMaterialMode,
      directMaterialCostSubtotal: directKnownCost ?? 0,
      materialComponentCostSubtotal: materialSubtotal,
      productComponentCostSubtotal: productSubtotal,
      inputMaterialComponentSubtotal: inputSubtotal,
      laborCostPerUnit: labor,
      overheadCostPerUnit: overhead,
      knownFullyLoadedUnitCostSubtotal: knownTotal,
      totalFullyLoadedUnitCost: status === 'ready' ? knownTotal : null,
      componentLines: [...componentLines],
      issues: issues.map((issue) => ({ ...issue })),
    };
  }
}
