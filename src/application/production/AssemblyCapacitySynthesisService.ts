import {
  ProductCompositionGraphError,
  validateProductComponentSourceUniqueness,
} from '../../domain/productCompositionGraph';
import {
  ProductComponentError,
  type ProductComponent,
  type ProductComponentSourceType,
} from '../../domain/productComponents';
import type {
  ComponentCapacityResult,
  ComponentCapacityStatus,
} from '../productComponents/ComponentCapacityService';
import type { ProductionCapacityResult } from './ProductionCapacityService';

export type AssemblyCapacitySynthesisStatus = 'ready' | 'partial' | 'not-ready';

export type AssemblyCapacitySynthesisIssueCode =
  | 'DIRECT_MATERIAL_CAPACITY_PARTIAL'
  | 'DIRECT_MATERIAL_CAPACITY_NOT_READY'
  | 'COMPONENT_GRAPH_INVALID'
  | 'COMPONENT_CAPACITY_PARTIAL'
  | 'COMPONENT_CAPACITY_NOT_READY'
  | 'CAPACITY_CANDIDATE_INVALID'
  | 'NO_CAPACITY_RESOURCES';

export interface AssemblyCapacitySynthesisIssue {
  code: AssemblyCapacitySynthesisIssueCode;
  message: string;
  productId: string;
  componentId?: string;
  sourceType?: ProductComponentSourceType;
  sourceId?: string;
  underlyingCode?: string;
}

export interface AssemblyCapacitySynthesisResult {
  productId: string;
  productIsActive: boolean;
  status: AssemblyCapacitySynthesisStatus;
  directMaterialApplicable: boolean;
  directMaterialCapacity: ProductionCapacityResult;
  componentCapacities: ComponentCapacityResult[];
  overallAssemblyCapacity: number | null;
  issues: AssemblyCapacitySynthesisIssue[];
}

export interface DirectMaterialCapacityProvider {
  estimate(productId: string): Promise<ProductionCapacityResult>;
}

export interface ProductComponentCapacityListProvider {
  listComponentsByParent(parentProductId: string): Promise<ProductComponent[]>;
}

export interface PerComponentCapacityProvider {
  capacityForComponent(component: ProductComponent): Promise<ComponentCapacityResult>;
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
    const bySourceType = compareText(String(left.sourceType), String(right.sourceType));
    if (bySourceType !== 0) return bySourceType;

    const bySourceId = compareText(comparable(left.sourceId), comparable(right.sourceId));
    if (bySourceId !== 0) return bySourceId;

    return compareText(comparable(left.id), comparable(right.id));
  });
}

function cloneDirectCapacity(value: ProductionCapacityResult): ProductionCapacityResult {
  return {
    ...value,
    skippedInvalidYieldSampleIds: [...value.skippedInvalidYieldSampleIds],
    limitingMaterialIds: [...value.limitingMaterialIds],
    materials: value.materials.map((entry) => ({ ...entry })),
    issues: value.issues.map((issue) => ({ ...issue })),
  };
}

function cloneComponentCapacity(value: ComponentCapacityResult): ComponentCapacityResult {
  return {
    ...value,
    sourceAvailability: value.sourceAvailability
      ? {
          ...value.sourceAvailability,
          issues: value.sourceAvailability.issues.map((issue) => ({ ...issue })),
          materialInventoryNormalization: value.sourceAvailability.materialInventoryNormalization
            ? { ...value.sourceAvailability.materialInventoryNormalization }
            : undefined,
          productStock: value.sourceAvailability.productStock
            ? { ...value.sourceAvailability.productStock }
            : value.sourceAvailability.productStock,
        }
      : null,
    issues: value.issues.map((issue) => ({ ...issue })),
  };
}

function isValidCapacityCandidate(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0 && Number.isInteger(value);
}

function isNeutralNoDirectMaterials(value: ProductionCapacityResult): boolean {
  return (
    value.materials.length === 0 &&
    value.produciblePieces === null &&
    value.requirementStatus === 'not-ready' &&
    value.issues.length === 1 &&
    value.issues[0]?.code === 'UPSTREAM_REQUIREMENT_ISSUE' &&
    value.issues[0]?.sourceCode === 'NO_REQUIREMENTS'
  );
}

function directHasDiagnosticCapacity(value: ProductionCapacityResult): boolean {
  if (value.status === 'ready' && isValidCapacityCandidate(value.produciblePieces)) return true;
  return value.materials.some((entry) => isValidCapacityCandidate(entry.capacityPieces));
}

function componentHasDiagnosticCapacity(value: ComponentCapacityResult): boolean {
  return value.status === 'ready' && isValidCapacityCandidate(value.capacityPieces);
}

function componentSourceType(value: ComponentCapacityResult): ProductComponentSourceType {
  return value.sourceType;
}

function graphIssue(
  productId: string,
  error: ProductCompositionGraphError | ProductComponentError,
): AssemblyCapacitySynthesisIssue {
  return {
    code: 'COMPONENT_GRAPH_INVALID',
    message: error.message,
    productId,
    componentId: 'componentId' in error ? error.componentId : undefined,
    sourceId: 'sourceId' in error ? error.sourceId : undefined,
    underlyingCode: error.code,
  };
}

/**
 * Phase 3.4B Product-level current assembly-capacity synthesis.
 *
 * Phase 2.4C remains authoritative for direct-material capacity and Phase 3.4A
 * remains authoritative for each immediate component line. This service only decides
 * whether those upstream views form a complete current assembly picture and, when
 * they do, publishes their minimum. Typed overall limiting-resource identity remains
 * Phase 3.4C.
 */
export class AssemblyCapacitySynthesisService {
  constructor(
    private readonly directMaterialCapacity: DirectMaterialCapacityProvider,
    private readonly components: ProductComponentCapacityListProvider,
    private readonly componentCapacity: PerComponentCapacityProvider,
  ) {}

  async estimate(productId: string): Promise<AssemblyCapacitySynthesisResult> {
    const requestedId = productId.trim();
    const direct = await this.directMaterialCapacity.estimate(requestedId);
    const directSnapshot = cloneDirectCapacity(direct);
    const directNeutral = isNeutralNoDirectMaterials(direct);
    const directApplicable = !directNeutral;

    const listed = await this.components.listComponentsByParent(direct.productId);
    const rootComponents = deterministicComponents(listed);
    const issues: AssemblyCapacitySynthesisIssue[] = [];

    if (directApplicable) {
      if (direct.status === 'partial') {
        issues.push({
          code: 'DIRECT_MATERIAL_CAPACITY_PARTIAL',
          message: `Product ${direct.productId} has only partial direct-material capacity evidence.`,
          productId: direct.productId,
          underlyingCode: direct.issues[0]?.sourceCode ?? direct.issues[0]?.code,
        });
      } else if (direct.status === 'not-ready') {
        issues.push({
          code: 'DIRECT_MATERIAL_CAPACITY_NOT_READY',
          message: `Product ${direct.productId} has no complete direct-material capacity.`,
          productId: direct.productId,
          underlyingCode: direct.issues[0]?.sourceCode ?? direct.issues[0]?.code,
        });
      }
    }

    if (!directApplicable && rootComponents.length === 0) {
      return this.result(
        direct,
        false,
        [],
        'not-ready',
        null,
        [
          {
            code: 'NO_CAPACITY_RESOURCES',
            message: `Product ${direct.productId} has no direct-material requirements or component requirements to evaluate for assembly capacity.`,
            productId: direct.productId,
          },
        ],
      );
    }

    try {
      const foreignParent = rootComponents.find(
        (component) => comparable(component.parentProductId) !== comparable(direct.productId),
      );
      if (foreignParent) {
        throw new ProductCompositionGraphError(
          'DUPLICATE_COMPONENT_SOURCE',
          `Component ${foreignParent.id.trim()} does not belong to requested parent ${direct.productId}.`,
          {
            componentId: foreignParent.id.trim(),
            parentProductId: foreignParent.parentProductId.trim(),
            sourceId: foreignParent.sourceId.trim(),
          },
        );
      }

      validateProductComponentSourceUniqueness(rootComponents);
    } catch (error) {
      if (error instanceof ProductCompositionGraphError || error instanceof ProductComponentError) {
        const combinedIssues = [...issues, graphIssue(direct.productId, error)];
        const status: AssemblyCapacitySynthesisStatus = directHasDiagnosticCapacity(direct)
          ? 'partial'
          : 'not-ready';

        return this.result(
          direct,
          directApplicable,
          [],
          status,
          null,
          combinedIssues,
        );
      }
      throw error;
    }

    const componentResults: ComponentCapacityResult[] = [];
    for (const component of rootComponents) {
      const capacity = await this.componentCapacity.capacityForComponent(component);
      componentResults.push(cloneComponentCapacity(capacity));

      if (capacity.status === 'partial') {
        issues.push({
          code: 'COMPONENT_CAPACITY_PARTIAL',
          message: `Component ${capacity.componentId} has unresolved current capacity.`,
          productId: direct.productId,
          componentId: capacity.componentId,
          sourceType: componentSourceType(capacity),
          sourceId: capacity.sourceId,
          underlyingCode: capacity.issues[0]?.underlyingCode ?? capacity.issues[0]?.code,
        });
      } else if (capacity.status === 'not-ready') {
        issues.push({
          code: 'COMPONENT_CAPACITY_NOT_READY',
          message: `Component ${capacity.componentId} is not ready for current assembly-capacity synthesis.`,
          productId: direct.productId,
          componentId: capacity.componentId,
          sourceType: componentSourceType(capacity),
          sourceId: capacity.sourceId,
          underlyingCode: capacity.issues[0]?.underlyingCode ?? capacity.issues[0]?.code,
        });
      }
    }

    let directReliable = !directApplicable;
    if (directApplicable && direct.status === 'ready') {
      if (isValidCapacityCandidate(direct.produciblePieces)) {
        directReliable = true;
      } else {
        issues.push({
          code: 'CAPACITY_CANDIDATE_INVALID',
          message: `Ready direct-material capacity for Product ${direct.productId} did not provide a valid non-negative integer capacity.`,
          productId: direct.productId,
        });
      }
    }

    let componentsReliable = true;
    for (const capacity of componentResults) {
      if (capacity.status !== 'ready') {
        componentsReliable = false;
        continue;
      }

      if (!isValidCapacityCandidate(capacity.capacityPieces)) {
        componentsReliable = false;
        issues.push({
          code: 'CAPACITY_CANDIDATE_INVALID',
          message: `Ready component ${capacity.componentId} did not provide a valid non-negative integer capacity.`,
          productId: direct.productId,
          componentId: capacity.componentId,
          sourceType: capacity.sourceType,
          sourceId: capacity.sourceId,
        });
      }
    }

    if (directReliable && componentsReliable) {
      const candidates: number[] = [];
      if (directApplicable && direct.produciblePieces !== null) {
        candidates.push(direct.produciblePieces);
      }
      for (const capacity of componentResults) {
        if (capacity.capacityPieces !== null) candidates.push(capacity.capacityPieces);
      }

      if (candidates.length === 0) {
        return this.result(
          direct,
          directApplicable,
          componentResults,
          'not-ready',
          null,
          [
            ...issues,
            {
              code: 'NO_CAPACITY_RESOURCES',
              message: `Product ${direct.productId} has no reliable capacity candidates.`,
              productId: direct.productId,
            },
          ],
        );
      }

      const overall = Math.min(...candidates);
      if (isValidCapacityCandidate(overall)) {
        return this.result(
          direct,
          directApplicable,
          componentResults,
          'ready',
          overall,
          issues,
        );
      }

      issues.push({
        code: 'CAPACITY_CANDIDATE_INVALID',
        message: `Product ${direct.productId} produced an invalid overall assembly-capacity minimum.`,
        productId: direct.productId,
      });
    }

    const hasDiagnosticEvidence =
      directHasDiagnosticCapacity(direct) ||
      componentResults.some(componentHasDiagnosticCapacity);

    return this.result(
      direct,
      directApplicable,
      componentResults,
      hasDiagnosticEvidence ? 'partial' : 'not-ready',
      null,
      issues,
    );
  }

  private result(
    direct: ProductionCapacityResult,
    directMaterialApplicable: boolean,
    componentCapacities: readonly ComponentCapacityResult[],
    status: AssemblyCapacitySynthesisStatus,
    overallAssemblyCapacity: number | null,
    issues: readonly AssemblyCapacitySynthesisIssue[],
  ): AssemblyCapacitySynthesisResult {
    return {
      productId: direct.productId,
      productIsActive: direct.productIsActive,
      status,
      directMaterialApplicable,
      directMaterialCapacity: cloneDirectCapacity(direct),
      componentCapacities: componentCapacities.map(cloneComponentCapacity),
      overallAssemblyCapacity,
      issues: issues.map((issue) => ({ ...issue })),
    };
  }
}
