import type { Material } from '../../domain/materials';
import type { ProductComponentRole } from '../../domain/productComponents';
import type { MaterialRepository } from '../materials/MaterialRepository';
import type { ProductRepository } from '../products/ProductRepository';
import type { ComponentCapacityResult } from '../productComponents/ComponentCapacityService';
import type {
  AssemblyCapacitySynthesisResult,
  AssemblyCapacitySynthesisStatus,
} from './AssemblyCapacitySynthesisService';
import type { ProductionCapacityResult } from './ProductionCapacityService';

export type AssemblyCapacityTraceStatus = 'ready' | 'partial' | 'not-ready';

export type AssemblyCapacityTraceIssueCode =
  | 'UPSTREAM_CAPACITY_PARTIAL'
  | 'UPSTREAM_CAPACITY_NOT_READY'
  | 'OVERALL_CAPACITY_INVALID'
  | 'PARENT_PRODUCT_NOT_FOUND'
  | 'DIRECT_LIMITER_LINE_MISSING'
  | 'DIRECT_LIMITER_CAPACITY_MISMATCH'
  | 'LIMITER_SOURCE_NOT_FOUND'
  | 'LIMITER_CAPACITY_INVALID'
  | 'NO_LIMITING_RESOURCES';

export interface AssemblyCapacityTraceIssue {
  code: AssemblyCapacityTraceIssueCode;
  message: string;
  productId: string;
  materialId?: string;
  componentId?: string;
  sourceId?: string;
  underlyingCode?: string;
}

export interface LimitingResourcePathNode {
  kind: 'product' | 'material';
  id: string;
  name: string;
}

export interface MaterialRequirementLimitingResource {
  resourceType: 'material-requirement';
  capacityPieces: number;
  materialId: string;
  materialName: string;
  baseUnit: Material['baseUnit'];
  normalizedOnHandBaseQuantity: number;
  plannedBaseQuantityPerProduct: number;
  path: LimitingResourcePathNode[];
}

export interface MaterialComponentLimitingResource {
  resourceType: 'material-backed-component';
  capacityPieces: number;
  componentId: string;
  parentProductId: string;
  parentProductName: string;
  role: ProductComponentRole;
  materialId: string;
  materialName: string;
  availableQuantity: number;
  quantityPerParent: number;
  path: LimitingResourcePathNode[];
}

export interface ProductComponentLimitingResource {
  resourceType: 'product-backed-component';
  capacityPieces: number;
  componentId: string;
  parentProductId: string;
  parentProductName: string;
  role: ProductComponentRole;
  productId: string;
  productName: string;
  availableQuantity: number;
  quantityPerParent: number;
  path: LimitingResourcePathNode[];
}

export type LimitingResource =
  | MaterialRequirementLimitingResource
  | MaterialComponentLimitingResource
  | ProductComponentLimitingResource;

export interface AssemblyCapacityTraceResult {
  productId: string;
  productName: string | null;
  productIsActive: boolean;
  status: AssemblyCapacityTraceStatus;
  overallAssemblyCapacity: number | null;
  capacitySynthesis: AssemblyCapacitySynthesisResult;
  limitingResources: LimitingResource[];
  issues: AssemblyCapacityTraceIssue[];
}

export interface AssemblyCapacityTraceProvider {
  estimate(productId: string): Promise<AssemblyCapacitySynthesisResult>;
}

function comparable(value: string): string {
  return value.trim().toLowerCase();
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function isValidCapacity(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0 && Number.isInteger(value);
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

function cloneSynthesis(value: AssemblyCapacitySynthesisResult): AssemblyCapacitySynthesisResult {
  return {
    ...value,
    directMaterialCapacity: cloneDirectCapacity(value.directMaterialCapacity),
    componentCapacities: value.componentCapacities.map(cloneComponentCapacity),
    issues: value.issues.map((issue) => ({ ...issue })),
  };
}

function clonePath(path: readonly LimitingResourcePathNode[]): LimitingResourcePathNode[] {
  return path.map((node) => ({ ...node }));
}

function cloneLimiter(resource: LimitingResource): LimitingResource {
  return { ...resource, path: clonePath(resource.path) };
}

function typeOrder(resource: LimitingResource): number {
  switch (resource.resourceType) {
    case 'material-requirement':
      return 0;
    case 'material-backed-component':
      return 1;
    case 'product-backed-component':
      return 2;
  }
}

function resourceSourceId(resource: LimitingResource): string {
  if (resource.resourceType === 'material-requirement') return resource.materialId;
  if (resource.resourceType === 'material-backed-component') return resource.materialId;
  return resource.productId;
}

function resourceComponentId(resource: LimitingResource): string {
  return resource.resourceType === 'material-requirement' ? '' : resource.componentId;
}

function deterministicLimiters(resources: readonly LimitingResource[]): LimitingResource[] {
  return [...resources]
    .sort((left, right) => {
      const byType = typeOrder(left) - typeOrder(right);
      if (byType !== 0) return byType;

      const bySource = compareText(comparable(resourceSourceId(left)), comparable(resourceSourceId(right)));
      if (bySource !== 0) return bySource;

      return compareText(
        comparable(resourceComponentId(left)),
        comparable(resourceComponentId(right)),
      );
    })
    .map(cloneLimiter);
}

function upstreamIssue(
  status: Exclude<AssemblyCapacitySynthesisStatus, 'ready'>,
  synthesis: AssemblyCapacitySynthesisResult,
): AssemblyCapacityTraceIssue {
  return {
    code: status === 'partial' ? 'UPSTREAM_CAPACITY_PARTIAL' : 'UPSTREAM_CAPACITY_NOT_READY',
    message:
      status === 'partial'
        ? `Product ${synthesis.productId} has only partial current assembly-capacity evidence.`
        : `Product ${synthesis.productId} is not ready for current assembly-capacity tracing.`,
    productId: synthesis.productId,
    underlyingCode: synthesis.issues[0]?.underlyingCode ?? synthesis.issues[0]?.code,
  };
}

/**
 * Phase 3.4C typed limiting-resource trace.
 *
 * Phase 3.4B remains authoritative for readiness and the final capacity minimum.
 * This service only explains which current parent inputs are tied at that minimum.
 * Product-backed capacity continues to mean explicit current ProductStock only;
 * nested child manufacture is deliberately not traversed here.
 */
export class AssemblyCapacityTraceService {
  constructor(
    private readonly capacity: AssemblyCapacityTraceProvider,
    private readonly products: ProductRepository,
    private readonly materials: MaterialRepository,
  ) {}

  async trace(productId: string): Promise<AssemblyCapacityTraceResult> {
    const synthesis = await this.capacity.estimate(productId.trim());
    const snapshot = cloneSynthesis(synthesis);
    const parent = await this.products.findById(synthesis.productId);
    const issues: AssemblyCapacityTraceIssue[] = [];

    if (!parent) {
      issues.push({
        code: 'PARENT_PRODUCT_NOT_FOUND',
        message: `Product ${synthesis.productId} was not found while resolving limiting-resource trace labels.`,
        productId: synthesis.productId,
      });
    }

    if (synthesis.status !== 'ready') {
      issues.unshift(upstreamIssue(synthesis.status, synthesis));
      return this.result(
        synthesis,
        parent?.name ?? null,
        synthesis.status,
        [],
        issues,
        snapshot,
      );
    }

    const overall = synthesis.overallAssemblyCapacity;
    if (!isValidCapacity(overall)) {
      issues.push({
        code: 'OVERALL_CAPACITY_INVALID',
        message: `Ready assembly-capacity synthesis for Product ${synthesis.productId} did not provide a valid final capacity.`,
        productId: synthesis.productId,
      });
    }

    if (!parent || !isValidCapacity(overall)) {
      return this.result(
        synthesis,
        parent?.name ?? null,
        'partial',
        [],
        issues,
        snapshot,
      );
    }

    // A ready 3.4B result must itself remain internally reliable. These guards protect
    // custom/corrupted providers without re-running any capacity formula.
    if (
      synthesis.directMaterialApplicable &&
      (synthesis.directMaterialCapacity.status !== 'ready' ||
        !isValidCapacity(synthesis.directMaterialCapacity.produciblePieces))
    ) {
      issues.push({
        code: 'LIMITER_CAPACITY_INVALID',
        message: `Ready synthesis for Product ${synthesis.productId} contains an invalid direct-material capacity candidate.`,
        productId: synthesis.productId,
      });
    }

    for (const component of synthesis.componentCapacities) {
      if (component.status !== 'ready' || !isValidCapacity(component.capacityPieces)) {
        issues.push({
          code: 'LIMITER_CAPACITY_INVALID',
          message: `Ready synthesis for Product ${synthesis.productId} contains an invalid component capacity candidate ${component.componentId}.`,
          productId: synthesis.productId,
          componentId: component.componentId,
          sourceId: component.sourceId,
          underlyingCode: component.issues[0]?.underlyingCode ?? component.issues[0]?.code,
        });
      }
    }

    const limiters: LimitingResource[] = [];

    if (
      synthesis.directMaterialApplicable &&
      synthesis.directMaterialCapacity.status === 'ready' &&
      synthesis.directMaterialCapacity.produciblePieces === overall
    ) {
      const limitingIds = [...synthesis.directMaterialCapacity.limitingMaterialIds].sort((a, b) =>
        compareText(comparable(a), comparable(b)),
      );

      if (limitingIds.length === 0) {
        issues.push({
          code: 'DIRECT_LIMITER_LINE_MISSING',
          message: `Direct-material capacity is tied at ${overall} pieces but no limiting Material IDs were provided for Product ${synthesis.productId}.`,
          productId: synthesis.productId,
        });
      }

      for (const materialId of limitingIds) {
        const line = synthesis.directMaterialCapacity.materials.find(
          (entry) => comparable(entry.materialId) === comparable(materialId),
        );

        if (!line) {
          issues.push({
            code: 'DIRECT_LIMITER_LINE_MISSING',
            message: `Limiting Material ${materialId} has no matching direct-capacity line for Product ${synthesis.productId}.`,
            productId: synthesis.productId,
            materialId,
            sourceId: materialId,
          });
          continue;
        }

        if (!isValidCapacity(line.capacityPieces) || line.capacityPieces !== overall) {
          issues.push({
            code: 'DIRECT_LIMITER_CAPACITY_MISMATCH',
            message: `Limiting Material ${materialId} does not match the final assembly capacity ${overall}.`,
            productId: synthesis.productId,
            materialId: line.materialId,
            sourceId: line.materialId,
          });
          continue;
        }

        const material = await this.materials.findById(line.materialId);
        if (!material) {
          issues.push({
            code: 'LIMITER_SOURCE_NOT_FOUND',
            message: `Limiting Material ${line.materialId} could not be resolved for trace output.`,
            productId: synthesis.productId,
            materialId: line.materialId,
            sourceId: line.materialId,
          });
          continue;
        }

        limiters.push({
          resourceType: 'material-requirement',
          capacityPieces: line.capacityPieces,
          materialId: material.id,
          materialName: material.name,
          baseUnit: line.baseUnit,
          normalizedOnHandBaseQuantity: line.normalizedOnHandBaseQuantity,
          plannedBaseQuantityPerProduct: line.plannedBaseQuantityPerProduct,
          path: [
            { kind: 'product', id: parent.id, name: parent.name },
            { kind: 'material', id: material.id, name: material.name },
          ],
        });
      }
    }

    for (const component of synthesis.componentCapacities) {
      if (
        component.status !== 'ready' ||
        !isValidCapacity(component.capacityPieces) ||
        component.capacityPieces !== overall
      ) {
        continue;
      }

      if (!isValidCapacity(component.availableQuantity)) {
        issues.push({
          code: 'LIMITER_CAPACITY_INVALID',
          message: `Limiting component ${component.componentId} has invalid current availability evidence.`,
          productId: synthesis.productId,
          componentId: component.componentId,
          sourceId: component.sourceId,
        });
        continue;
      }

      if (component.sourceType === 'material') {
        const material = await this.materials.findById(component.sourceId);
        if (!material) {
          issues.push({
            code: 'LIMITER_SOURCE_NOT_FOUND',
            message: `Limiting Material component source ${component.sourceId} could not be resolved for trace output.`,
            productId: synthesis.productId,
            componentId: component.componentId,
            sourceId: component.sourceId,
          });
          continue;
        }

        limiters.push({
          resourceType: 'material-backed-component',
          capacityPieces: component.capacityPieces,
          componentId: component.componentId,
          parentProductId: parent.id,
          parentProductName: parent.name,
          role: component.role,
          materialId: material.id,
          materialName: material.name,
          availableQuantity: component.availableQuantity,
          quantityPerParent: component.quantityPerParent,
          path: [
            { kind: 'product', id: parent.id, name: parent.name },
            { kind: 'material', id: material.id, name: material.name },
          ],
        });
        continue;
      }

      const child = await this.products.findById(component.sourceId);
      if (!child) {
        issues.push({
          code: 'LIMITER_SOURCE_NOT_FOUND',
          message: `Limiting Product component source ${component.sourceId} could not be resolved for trace output.`,
          productId: synthesis.productId,
          componentId: component.componentId,
          sourceId: component.sourceId,
        });
        continue;
      }

      limiters.push({
        resourceType: 'product-backed-component',
        capacityPieces: component.capacityPieces,
        componentId: component.componentId,
        parentProductId: parent.id,
        parentProductName: parent.name,
        role: component.role,
        productId: child.id,
        productName: child.name,
        availableQuantity: component.availableQuantity,
        quantityPerParent: component.quantityPerParent,
        path: [
          { kind: 'product', id: parent.id, name: parent.name },
          { kind: 'product', id: child.id, name: child.name },
        ],
      });
    }

    if (issues.length > 0) {
      return this.result(synthesis, parent.name, 'partial', [], issues, snapshot);
    }

    if (limiters.length === 0) {
      return this.result(
        synthesis,
        parent.name,
        'partial',
        [],
        [
          {
            code: 'NO_LIMITING_RESOURCES',
            message: `Ready assembly capacity ${overall} for Product ${synthesis.productId} produced no typed limiting resources.`,
            productId: synthesis.productId,
          },
        ],
        snapshot,
      );
    }

    return this.result(
      synthesis,
      parent.name,
      'ready',
      deterministicLimiters(limiters),
      [],
      snapshot,
    );
  }

  private result(
    synthesis: AssemblyCapacitySynthesisResult,
    productName: string | null,
    status: AssemblyCapacityTraceStatus,
    limitingResources: readonly LimitingResource[],
    issues: readonly AssemblyCapacityTraceIssue[],
    snapshot: AssemblyCapacitySynthesisResult = cloneSynthesis(synthesis),
  ): AssemblyCapacityTraceResult {
    return {
      productId: synthesis.productId,
      productName,
      productIsActive: synthesis.productIsActive,
      status,
      overallAssemblyCapacity: synthesis.overallAssemblyCapacity,
      capacitySynthesis: cloneSynthesis(snapshot),
      limitingResources: deterministicLimiters(limitingResources),
      issues: issues.map((issue) => ({ ...issue })),
    };
  }
}
