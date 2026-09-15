import {
  ProductCompositionGraphError,
  type ProductCompositionGraphErrorCode,
  validateProductComponentSourceUniqueness,
} from '../../domain/productCompositionGraph';
import {
  ProductComponentError,
  type ProductComponent,
  type ProductComponentErrorCode,
  type ProductComponentSourceType,
} from '../../domain/productComponents';
import type { ProductRepository } from '../products/ProductRepository';
import type { RecipeMaterialCostPreviewResult } from '../recipeCosts/RecipeMaterialCostPreviewService';
import type { MaterialBackedComponentCostLine } from './MaterialBackedComponentCostService';
import type { ProductBackedComponentCostLine } from './ProductBackedComponentCostService';
import type { ProductComponentRepository } from './ProductComponentRepository';

export type ComponentAwareProductCostStatus = 'ready' | 'partial' | 'not-ready';

export type ComponentAwareProductCostIssueCode =
  | 'DIRECT_MATERIAL_COST_PARTIAL'
  | 'DIRECT_MATERIAL_COST_NOT_READY'
  | 'COMPONENT_GRAPH_INVALID'
  | 'COMPONENT_COST_PARTIAL'
  | 'COMPONENT_COST_NOT_READY'
  | 'DERIVED_COST_INVALID';

export type ComponentAwareProductCostUnderlyingCode =
  | ProductCompositionGraphErrorCode
  | ProductComponentErrorCode
  | string;

export interface ComponentAwareProductCostIssue {
  code: ComponentAwareProductCostIssueCode;
  message: string;
  productId: string;
  componentId?: string;
  sourceType?: ProductComponentSourceType;
  sourceId?: string;
  underlyingCode?: ComponentAwareProductCostUnderlyingCode;
}

export interface MaterialComponentAwareProductCostLine {
  sourceType: 'material';
  line: MaterialBackedComponentCostLine;
}

export interface ProductComponentAwareProductCostLine {
  sourceType: 'product';
  line: ProductBackedComponentCostLine;
}

export type ComponentAwareProductCostLine =
  | MaterialComponentAwareProductCostLine
  | ProductComponentAwareProductCostLine;

export interface ComponentAwareProductCostResult {
  productId: string;
  productName: string;
  productIsActive: boolean;
  status: ComponentAwareProductCostStatus;
  directMaterialCost: RecipeMaterialCostPreviewResult;
  directMaterialCostSubtotal: number;
  componentCostSubtotal: number;
  totalComponentAwareCost: number | null;
  componentLines: ComponentAwareProductCostLine[];
  issues: ComponentAwareProductCostIssue[];
}

export type ComponentAwareProductCostServiceErrorCode = 'PRODUCT_NOT_FOUND';

export class ComponentAwareProductCostServiceError extends Error {
  readonly code: ComponentAwareProductCostServiceErrorCode;
  readonly productId: string;

  constructor(code: ComponentAwareProductCostServiceErrorCode, message: string, productId: string) {
    super(message);
    this.name = 'ComponentAwareProductCostServiceError';
    this.code = code;
    this.productId = productId;
  }
}

export interface ComponentAwareDirectMaterialCostProvider {
  previewForProduct(productId: string): Promise<RecipeMaterialCostPreviewResult>;
}

export interface ComponentAwareMaterialComponentCostProvider {
  costComponent(component: ProductComponent): Promise<MaterialBackedComponentCostLine>;
}

export interface ComponentAwareProductComponentCostProvider {
  costComponent(component: ProductComponent): Promise<ProductBackedComponentCostLine>;
}

function comparable(value: string): string {
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

    const sourceId = compareText(comparable(left.sourceId), comparable(right.sourceId));
    if (sourceId !== 0) return sourceId;

    return compareText(comparable(left.id), comparable(right.id));
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

function directHasCostEvidence(preview: RecipeMaterialCostPreviewResult): boolean {
  return (
    preview.lines.length > 0 &&
    Number.isFinite(preview.totalMaterialCostPerProduct) &&
    preview.totalMaterialCostPerProduct >= 0
  );
}

function componentContribution(line: ComponentAwareProductCostLine): number | null {
  return line.line.componentCostContribution;
}

function componentStatus(line: ComponentAwareProductCostLine): ComponentAwareProductCostStatus {
  return line.line.status;
}

function cloneIssues(issues: readonly ComponentAwareProductCostIssue[]): ComponentAwareProductCostIssue[] {
  return issues.map((issue) => ({ ...issue }));
}

/**
 * Phase 3.3C final Product-level material/component cost synthesis.
 *
 * Phase 2 remains authoritative for direct-material cost, 3.3A remains authoritative
 * for Material-backed component cost, and 3.3B remains authoritative for recursive
 * Product-backed component cost. This service only composes those derived views.
 */
export class ComponentAwareProductCostService {
  constructor(
    private readonly products: ProductRepository,
    private readonly components: ProductComponentRepository,
    private readonly directMaterialCosts: ComponentAwareDirectMaterialCostProvider,
    private readonly materialComponentCosts: ComponentAwareMaterialComponentCostProvider,
    private readonly productComponentCosts: ComponentAwareProductComponentCostProvider,
  ) {}

  async costProduct(productId: string): Promise<ComponentAwareProductCostResult> {
    const requestedId = productId.trim();
    const product = await this.products.findById(requestedId);
    if (!product) {
      throw new ComponentAwareProductCostServiceError(
        'PRODUCT_NOT_FOUND',
        `Product ${requestedId} was not found for component-aware costing.`,
        requestedId,
      );
    }

    const directMaterialCost = await this.directMaterialCosts.previewForProduct(product.id);
    const allComponents = await this.components.list();
    const rootComponents = deterministicComponents(
      allComponents.filter(
        (component) => comparable(component.parentProductId) === comparable(product.id),
      ),
    );

    const issues: ComponentAwareProductCostIssue[] = [];
    if (directMaterialCost.status === 'partial') {
      issues.push({
        code: 'DIRECT_MATERIAL_COST_PARTIAL',
        message: `Product ${product.id} has only a partial Phase 2 direct-material cost.`,
        productId: product.id,
      });
    } else if (directMaterialCost.status === 'not-ready') {
      issues.push({
        code: 'DIRECT_MATERIAL_COST_NOT_READY',
        message: `Product ${product.id} has no complete Phase 2 direct-material cost.`,
        productId: product.id,
      });
    }

    const directEvidence = directHasCostEvidence(directMaterialCost);
    const directSubtotal = directEvidence ? directMaterialCost.totalMaterialCostPerProduct : 0;

    try {
      validateProductComponentSourceUniqueness(rootComponents);
    } catch (error) {
      if (error instanceof ProductCompositionGraphError || error instanceof ProductComponentError) {
        const graphIssues = [
          ...issues,
          {
            code: 'COMPONENT_GRAPH_INVALID' as const,
            message: error.message,
            productId: product.id,
            componentId: 'componentId' in error ? error.componentId : undefined,
            underlyingCode: error.code,
          },
        ];

        return {
          productId: product.id,
          productName: product.name,
          productIsActive: product.isActive,
          status: directEvidence ? 'partial' : 'not-ready',
          directMaterialCost: cloneDirectMaterialCost(directMaterialCost),
          directMaterialCostSubtotal: directSubtotal,
          componentCostSubtotal: 0,
          totalComponentAwareCost: directEvidence ? directSubtotal : null,
          componentLines: [],
          issues: cloneIssues(graphIssues),
        };
      }
      throw error;
    }

    const componentLines: ComponentAwareProductCostLine[] = [];
    for (const component of rootComponents) {
      if (component.sourceType === 'material') {
        componentLines.push({
          sourceType: 'material',
          line: await this.materialComponentCosts.costComponent(component),
        });
      } else {
        componentLines.push({
          sourceType: 'product',
          line: await this.productComponentCosts.costComponent(component),
        });
      }
    }

    let componentSubtotal = 0;
    let componentHasCostEvidence = false;
    let componentUnresolved = false;

    for (const entry of componentLines) {
      const status = componentStatus(entry);
      const contribution = componentContribution(entry);

      if (status === 'partial') {
        componentUnresolved = true;
        issues.push({
          code: 'COMPONENT_COST_PARTIAL',
          message: `Component ${entry.line.componentId} has only a partial cost contribution.`,
          productId: product.id,
          componentId: entry.line.componentId,
          sourceType: entry.sourceType,
          sourceId:
            entry.sourceType === 'material'
              ? entry.line.sourceMaterialId
              : entry.line.childProductId,
          underlyingCode: entry.line.issues[0]?.code,
        });
      } else if (status === 'not-ready') {
        componentUnresolved = true;
        issues.push({
          code: 'COMPONENT_COST_NOT_READY',
          message: `Component ${entry.line.componentId} is not ready for costing.`,
          productId: product.id,
          componentId: entry.line.componentId,
          sourceType: entry.sourceType,
          sourceId:
            entry.sourceType === 'material'
              ? entry.line.sourceMaterialId
              : entry.line.childProductId,
          underlyingCode: entry.line.issues[0]?.code,
        });
      }

      if (contribution === null) continue;

      if (!Number.isFinite(contribution) || contribution < 0) {
        componentUnresolved = true;
        issues.push({
          code: 'DERIVED_COST_INVALID',
          message: `Component ${entry.line.componentId} produced an invalid cost contribution.`,
          productId: product.id,
          componentId: entry.line.componentId,
          sourceType: entry.sourceType,
          sourceId:
            entry.sourceType === 'material'
              ? entry.line.sourceMaterialId
              : entry.line.childProductId,
        });
        continue;
      }

      componentHasCostEvidence = true;
      componentSubtotal += contribution;
    }

    const hasCostEvidence = directEvidence || componentHasCostEvidence;
    if (!hasCostEvidence) {
      return {
        productId: product.id,
        productName: product.name,
        productIsActive: product.isActive,
        status: 'not-ready',
        directMaterialCost: cloneDirectMaterialCost(directMaterialCost),
        directMaterialCostSubtotal: 0,
        componentCostSubtotal: componentSubtotal,
        totalComponentAwareCost: null,
        componentLines: [...componentLines],
        issues: cloneIssues(issues),
      };
    }

    const total = directSubtotal + componentSubtotal;
    if (!Number.isFinite(total) || total < 0) {
      return {
        productId: product.id,
        productName: product.name,
        productIsActive: product.isActive,
        status: 'not-ready',
        directMaterialCost: cloneDirectMaterialCost(directMaterialCost),
        directMaterialCostSubtotal: directSubtotal,
        componentCostSubtotal: componentSubtotal,
        totalComponentAwareCost: null,
        componentLines: [...componentLines],
        issues: cloneIssues([
          ...issues,
          {
            code: 'DERIVED_COST_INVALID',
            message: `Product ${product.id} produced an invalid component-aware total cost.`,
            productId: product.id,
          },
        ]),
      };
    }

    const unresolved = directMaterialCost.status !== 'ready' || componentUnresolved;

    return {
      productId: product.id,
      productName: product.name,
      productIsActive: product.isActive,
      status: unresolved ? 'partial' : 'ready',
      directMaterialCost: cloneDirectMaterialCost(directMaterialCost),
      directMaterialCostSubtotal: directSubtotal,
      componentCostSubtotal: componentSubtotal,
      totalComponentAwareCost: total,
      componentLines: [...componentLines],
      issues: cloneIssues(issues),
    };
  }
}
