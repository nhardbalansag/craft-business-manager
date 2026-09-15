import type { ComponentAwareProductCostResult } from '../../application/productComponents/ComponentAwareProductCostService';
import type { RecursiveComponentCostBreakdown } from '../../application/productComponents/ProductBackedComponentCostService';
import type { AssemblyCapacityTraceResult, LimitingResource } from '../../application/production/AssemblyCapacityTraceService';
import type { ProductionRequirementPlanResult } from '../../application/production/ProductionRequirementService';
import type { Material } from '../../domain/materials';
import type { ProductComponentRole, ProductComponentSourceType } from '../../domain/productComponents';
import type { Product } from '../../domain/products';

export type ComponentAvailabilityState = 'missing' | 'zero' | 'available' | 'unresolved';

export interface ComponentRequirementRow {
  componentId: string;
  sourceType: ProductComponentSourceType;
  sourceId: string;
  sourceName: string;
  role: ProductComponentRole;
  quantityPerParent: number;
  plannedQuantity: number;
  availableQuantity: number | null;
  availabilityState: ComponentAvailabilityState;
  availabilityStatus: 'ready' | 'partial' | 'not-ready';
  capacityPieces: number | null;
  capacityStatus: 'ready' | 'partial' | 'not-ready';
  unit: 'pc';
  unitCost: number | null;
  costContributionPerParent: number | null;
  plannedCostContribution: number | null;
  costStatus: 'ready' | 'partial' | 'not-ready';
  issues: string[];
}

export interface ComponentCostBreakdownRow {
  componentId: string;
  sourceType: ProductComponentSourceType;
  sourceId: string;
  sourceName: string;
  role: ProductComponentRole;
  depth: number;
  pathLabel: string;
  quantityPerParent: number;
  status: 'ready' | 'partial' | 'not-ready';
  unitCost: number | null;
  contribution: number | null;
  issues: string[];
}

export interface LimitingResourceRow {
  resourceType: LimitingResource['resourceType'];
  typeLabel: string;
  sourceId: string;
  sourceName: string;
  capacityPieces: number;
  pathLabel: string;
  evidence: string;
}

export interface ProductionIssueRow {
  source: 'Direct requirement' | 'Cost' | 'Assembly capacity' | 'Component capacity' | 'Availability';
  message: string;
}

function canonical(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function finiteNonNegative(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0;
}

function uniqueMessages(messages: readonly (string | undefined)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const message of messages) {
    if (!message) continue;
    const key = message.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(key);
  }
  return result;
}

function catalogMaps(materials: readonly Material[], products: readonly Product[]) {
  return {
    materials: new Map(materials.map((material) => [canonical(material.id), material.name])),
    products: new Map(products.map((product) => [canonical(product.id), product.name])),
  };
}

function availabilityState(
  sourceType: ProductComponentSourceType,
  availableQuantity: number | null,
  availabilityIssues: readonly { code: string }[],
): ComponentAvailabilityState {
  if (
    sourceType === 'product' &&
    availableQuantity === null &&
    availabilityIssues.some((issue) => issue.code === 'SOURCE_PRODUCT_STOCK_MISSING')
  ) {
    return 'missing';
  }
  if (availableQuantity === 0) return 'zero';
  if (availableQuantity !== null && availableQuantity > 0) return 'available';
  return 'unresolved';
}

export function buildComponentRequirementRows(
  cost: ComponentAwareProductCostResult | null,
  trace: AssemblyCapacityTraceResult | null,
  plannedQuantity: number,
  materials: readonly Material[],
  products: readonly Product[],
): ComponentRequirementRow[] {
  const { materials: materialNames, products: productNames } = catalogMaps(materials, products);
  const capacityById = new Map(
    (trace?.capacitySynthesis.componentCapacities ?? []).map((entry) => [canonical(entry.componentId), entry]),
  );
  const costById = new Map(
    (cost?.componentLines ?? []).map((entry) => [canonical(entry.line.componentId), entry]),
  );
  const ids = new Set([...capacityById.keys(), ...costById.keys()]);
  const rows: ComponentRequirementRow[] = [];

  for (const id of ids) {
    const capacity = capacityById.get(id);
    const costEntry = costById.get(id);
    if (!capacity && !costEntry) continue;

    const sourceType = capacity?.sourceType ?? costEntry!.sourceType;
    const sourceId = capacity?.sourceId ?? (
      costEntry!.sourceType === 'material'
        ? costEntry!.line.sourceMaterialId
        : costEntry!.line.childProductId
    );
    const role = capacity?.role ?? costEntry!.line.role;
    const quantityPerParent = capacity?.quantityPerParent ?? costEntry!.line.quantityPerParent;
    const availability = capacity?.sourceAvailability;
    const costLine = costEntry?.line;
    const authoritativeName = costEntry?.sourceType === 'material'
      ? costEntry.line.sourceMaterialName
      : costEntry?.sourceType === 'product'
        ? costEntry.line.childProductName
        : null;
    const catalogName = sourceType === 'material'
      ? materialNames.get(canonical(sourceId))
      : productNames.get(canonical(sourceId));
    const unitCost = costEntry?.sourceType === 'material'
      ? costEntry.line.costPerPc
      : costEntry?.sourceType === 'product'
        ? costEntry.line.childComponentAwareUnitCost
        : null;
    const contribution = costLine?.componentCostContribution ?? null;
    const costStatus = costLine?.status ?? 'not-ready';
    const availabilityIssues = availability?.issues ?? [];

    rows.push({
      componentId: capacity?.componentId ?? costLine!.componentId,
      sourceType,
      sourceId,
      sourceName: authoritativeName ?? catalogName ?? sourceId,
      role,
      quantityPerParent,
      plannedQuantity: quantityPerParent * plannedQuantity,
      availableQuantity: capacity?.availableQuantity ?? null,
      availabilityState: availabilityState(sourceType, capacity?.availableQuantity ?? null, availabilityIssues),
      availabilityStatus: availability?.status ?? capacity?.status ?? 'not-ready',
      capacityPieces: capacity?.capacityPieces ?? null,
      capacityStatus: capacity?.status ?? 'not-ready',
      unit: 'pc',
      unitCost,
      costContributionPerParent: contribution,
      plannedCostContribution: finiteNonNegative(contribution) ? contribution * plannedQuantity : null,
      costStatus,
      issues: uniqueMessages([
        ...(costLine?.issues.map((issue) => issue.message) ?? []),
        ...(capacity?.issues.map((issue) => issue.message) ?? []),
        ...availabilityIssues.map((issue) => issue.message),
      ]),
    });
  }

  return rows.sort((left, right) => {
    const byType = compareText(left.sourceType, right.sourceType);
    if (byType !== 0) return byType;
    const bySource = compareText(canonical(left.sourceId), canonical(right.sourceId));
    if (bySource !== 0) return bySource;
    return compareText(canonical(left.componentId), canonical(right.componentId));
  });
}

function readableProductPath(path: readonly string[], productNames: Map<string, string>): string[] {
  return path.map((id) => productNames.get(canonical(id)) ?? id);
}

export function buildComponentCostBreakdownRows(
  cost: ComponentAwareProductCostResult | null,
  materials: readonly Material[],
  products: readonly Product[],
): ComponentCostBreakdownRow[] {
  if (!cost) return [];
  const { materials: materialNames, products: productNames } = catalogMaps(materials, products);
  const rows: ComponentCostBreakdownRow[] = [];
  const active = new WeakSet<object>();

  const addMaterial = (
    line: Extract<RecursiveComponentCostBreakdown, { sourceType: 'material' }>['line'],
    depth: number,
    parentPath: readonly string[],
  ) => {
    const name = line.sourceMaterialName ?? materialNames.get(canonical(line.sourceMaterialId)) ?? line.sourceMaterialId;
    rows.push({
      componentId: line.componentId,
      sourceType: 'material',
      sourceId: line.sourceMaterialId,
      sourceName: name,
      role: line.role,
      depth,
      pathLabel: [...parentPath, name].join(' > '),
      quantityPerParent: line.quantityPerParent,
      status: line.status,
      unitCost: line.costPerPc,
      contribution: line.componentCostContribution,
      issues: uniqueMessages(line.issues.map((issue) => issue.message)),
    });
  };

  const addProduct = (
    line: Extract<RecursiveComponentCostBreakdown, { sourceType: 'product' }>['line'],
    depth: number,
    fallbackParentPath: readonly string[],
  ) => {
    const name = line.childProductName ?? productNames.get(canonical(line.childProductId)) ?? line.childProductId;
    const servicePath = readableProductPath(line.path, productNames);
    const path = servicePath.length ? servicePath : [...fallbackParentPath, name];
    const repeated = active.has(line as object);
    rows.push({
      componentId: line.componentId,
      sourceType: 'product',
      sourceId: line.childProductId,
      sourceName: name,
      role: line.role,
      depth,
      pathLabel: path.join(' > '),
      quantityPerParent: line.quantityPerParent,
      status: repeated ? 'not-ready' : line.status,
      unitCost: line.childComponentAwareUnitCost,
      contribution: line.componentCostContribution,
      issues: uniqueMessages([
        ...line.issues.map((issue) => issue.message),
        repeated ? `Nested cost display cycle stopped at ${name}.` : undefined,
      ]),
    });
    if (repeated) return;

    active.add(line as object);
    for (const child of line.breakdown) {
      if (child.sourceType === 'material') addMaterial(child.line, depth + 1, path);
      else addProduct(child.line, depth + 1, path);
    }
    active.delete(line as object);
  };

  const rootPath = [cost.productName];
  for (const entry of cost.componentLines) {
    if (entry.sourceType === 'material') addMaterial(entry.line, 0, rootPath);
    else addProduct(entry.line, 0, rootPath);
  }

  return rows;
}

export function buildLimitingResourceRows(trace: AssemblyCapacityTraceResult | null): LimitingResourceRow[] {
  if (!trace || trace.status !== 'ready') return [];
  return trace.limitingResources.map((resource) => {
    const pathLabel = resource.path.map((node) => node.name).join(' > ');
    if (resource.resourceType === 'material-requirement') {
      return {
        resourceType: resource.resourceType,
        typeLabel: 'Direct material',
        sourceId: resource.materialId,
        sourceName: resource.materialName,
        capacityPieces: resource.capacityPieces,
        pathLabel,
        evidence: `${resource.normalizedOnHandBaseQuantity} ${resource.baseUnit} on hand · ${resource.plannedBaseQuantityPerProduct} ${resource.baseUnit} / parent`,
      };
    }
    if (resource.resourceType === 'material-backed-component') {
      return {
        resourceType: resource.resourceType,
        typeLabel: 'Material component',
        sourceId: resource.materialId,
        sourceName: resource.materialName,
        capacityPieces: resource.capacityPieces,
        pathLabel,
        evidence: `${resource.availableQuantity} pc on hand · ${resource.quantityPerParent} pc / parent`,
      };
    }
    return {
      resourceType: resource.resourceType,
      typeLabel: 'Product component',
      sourceId: resource.productId,
      sourceName: resource.productName,
      capacityPieces: resource.capacityPieces,
      pathLabel,
      evidence: `${resource.availableQuantity} pc finished stock · ${resource.quantityPerParent} pc / parent`,
    };
  });
}

export function buildProductionIssueRows(
  plan: ProductionRequirementPlanResult | null,
  cost: ComponentAwareProductCostResult | null,
  trace: AssemblyCapacityTraceResult | null,
): ProductionIssueRow[] {
  const rows: ProductionIssueRow[] = [];
  const seen = new Set<string>();
  const add = (source: ProductionIssueRow['source'], message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    const key = `${source}|${trimmed}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ source, message: trimmed });
  };

  for (const issue of plan?.issues ?? []) add('Direct requirement', issue.message);
  for (const issue of cost?.issues ?? []) add('Cost', issue.message);
  for (const issue of trace?.issues ?? []) add('Assembly capacity', issue.message);

  for (const component of trace?.capacitySynthesis.componentCapacities ?? []) {
    for (const issue of component.issues) add('Component capacity', issue.message);
    for (const issue of component.sourceAvailability?.issues ?? []) add('Availability', issue.message);
  }

  return rows;
}
