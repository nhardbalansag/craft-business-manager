import {
  getProductComponentSourceKey,
  type ProductComponent,
  validateProductComponentContract,
} from './productComponents';

export type ProductCompositionGraphErrorCode =
  | 'INVALID_ROOT_PRODUCT_ID'
  | 'DUPLICATE_COMPONENT_SOURCE'
  | 'DIRECT_SELF_REFERENCE'
  | 'CYCLE_DETECTED';

export class ProductCompositionGraphError extends Error {
  readonly code: ProductCompositionGraphErrorCode;
  readonly componentId?: string;
  readonly duplicateComponentId?: string;
  readonly parentProductId?: string;
  readonly sourceId?: string;
  readonly sourceKey?: string;
  readonly cyclePath?: readonly string[];

  constructor(
    code: ProductCompositionGraphErrorCode,
    message: string,
    context: {
      componentId?: string;
      duplicateComponentId?: string;
      parentProductId?: string;
      sourceId?: string;
      sourceKey?: string;
      cyclePath?: readonly string[];
    } = {},
  ) {
    super(message);
    this.name = 'ProductCompositionGraphError';
    this.code = code;
    this.componentId = context.componentId;
    this.duplicateComponentId = context.duplicateComponentId;
    this.parentProductId = context.parentProductId;
    this.sourceId = context.sourceId;
    this.sourceKey = context.sourceKey;
    this.cyclePath = context.cyclePath;
  }
}

function canonicalProductId(value: string): string {
  return value.trim().toLowerCase();
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function sortedValidatedComponents(
  components: readonly ProductComponent[],
): ProductComponent[] {
  const validated = components.map((component) => {
    validateProductComponentContract(component);
    return component;
  });

  return [...validated].sort((left, right) => {
    const sourceKeyComparison = compareText(
      getProductComponentSourceKey(left),
      getProductComponentSourceKey(right),
    );
    if (sourceKeyComparison !== 0) return sourceKeyComparison;

    return compareText(
      canonicalProductId(left.id),
      canonicalProductId(right.id),
    );
  });
}

/**
 * Enforces the Phase 3 collection-level duplicate identity rule.
 *
 * One parent may contain only one line for parent + source kind + source ID.
 * Role and quantity do not create a second legitimate source identity.
 */
export function validateProductComponentSourceUniqueness(
  components: readonly ProductComponent[],
): void {
  const seen = new Map<string, ProductComponent>();

  for (const component of sortedValidatedComponents(components)) {
    const sourceKey = getProductComponentSourceKey(component);
    const existing = seen.get(sourceKey);

    if (existing) {
      throw new ProductCompositionGraphError(
        'DUPLICATE_COMPONENT_SOURCE',
        `Parent ${component.parentProductId.trim()} contains duplicate component source ${component.sourceType}:${component.sourceId.trim()}.`,
        {
          componentId: component.id.trim(),
          duplicateComponentId: existing.id.trim(),
          parentProductId: component.parentProductId.trim(),
          sourceId: component.sourceId.trim(),
          sourceKey,
        },
      );
    }

    seen.set(sourceKey, component);
  }
}

type ProductAdjacency = ReadonlyMap<string, readonly string[]>;

function buildProductAdjacency(
  components: readonly ProductComponent[],
): ProductAdjacency {
  const adjacency = new Map<string, Set<string>>();

  for (const component of sortedValidatedComponents(components)) {
    if (component.sourceType !== 'product') continue;

    const parent = canonicalProductId(component.parentProductId);
    const source = canonicalProductId(component.sourceId);

    if (parent === source) {
      throw new ProductCompositionGraphError(
        'DIRECT_SELF_REFERENCE',
        `Product ${component.parentProductId.trim()} cannot contain itself as component ${component.id.trim()}.`,
        {
          componentId: component.id.trim(),
          parentProductId: component.parentProductId.trim(),
          sourceId: component.sourceId.trim(),
          cyclePath: [parent, parent],
        },
      );
    }

    let children = adjacency.get(parent);
    if (!children) {
      children = new Set<string>();
      adjacency.set(parent, children);
    }
    children.add(source);

    if (!adjacency.has(source)) {
      adjacency.set(source, new Set<string>());
    }
  }

  return new Map(
    [...adjacency.entries()]
      .sort(([left], [right]) => compareText(left, right))
      .map(([productId, children]) => [
        productId,
        [...children].sort(compareText),
      ]),
  );
}

function cycleError(cyclePath: readonly string[]): ProductCompositionGraphError {
  return new ProductCompositionGraphError(
    'CYCLE_DETECTED',
    `Product composition cycle detected: ${cyclePath.join(' -> ')}.`,
    { cyclePath },
  );
}

/**
 * Returns the first deterministic product-backed cycle, or null when the graph is acyclic.
 *
 * IDs in the path are canonical (trimmed/lowercase) so error output remains stable even
 * when source records use inconsistent case.
 */
export function findProductCompositionCycle(
  components: readonly ProductComponent[],
): readonly string[] | null {
  validateProductComponentSourceUniqueness(components);
  const adjacency = buildProductAdjacency(components);
  const state = new Map<string, 'visiting' | 'visited'>();
  const path: string[] = [];
  const pathIndex = new Map<string, number>();

  const visit = (productId: string): readonly string[] | null => {
    state.set(productId, 'visiting');
    pathIndex.set(productId, path.length);
    path.push(productId);

    for (const child of adjacency.get(productId) ?? []) {
      const childState = state.get(child);

      if (childState === 'visiting') {
        const start = pathIndex.get(child);
        if (start === undefined) {
          return [child, child];
        }
        return [...path.slice(start), child];
      }

      if (childState !== 'visited') {
        const cycle = visit(child);
        if (cycle) return cycle;
      }
    }

    path.pop();
    pathIndex.delete(productId);
    state.set(productId, 'visited');
    return null;
  };

  for (const productId of [...adjacency.keys()].sort(compareText)) {
    if (state.has(productId)) continue;
    const cycle = visit(productId);
    if (cycle) return cycle;
  }

  return null;
}

/**
 * Full Phase 3.1B composition-graph gate.
 *
 * Material-backed components participate in duplicate-source validation but do not
 * create graph edges. Product-backed components must form a finite directed acyclic
 * graph with no direct self-reference.
 */
export function validateProductCompositionGraph(
  components: readonly ProductComponent[],
): void {
  const cycle = findProductCompositionCycle(components);
  if (cycle) throw cycleError(cycle);
}

/**
 * Deterministic depth-first product descendant traversal for future recursive services.
 *
 * This traversal guards its active path itself instead of trusting write-time validation,
 * so corrupted/imported cyclic data cannot cause infinite recursion. Unrelated cycles do
 * not block traversal of a safe root; only cycles reachable from the requested root do.
 */
export function getProductCompositionDescendants(
  components: readonly ProductComponent[],
  rootProductId: string,
): readonly string[] {
  const root = canonicalProductId(rootProductId);
  if (!root) {
    throw new ProductCompositionGraphError(
      'INVALID_ROOT_PRODUCT_ID',
      'Root product ID is required for composition traversal.',
    );
  }

  validateProductComponentSourceUniqueness(components);
  const adjacency = buildProductAdjacency(components);
  const visited = new Set<string>();
  const activePath: string[] = [];
  const activeIndex = new Map<string, number>();
  const descendants: string[] = [];

  const visit = (productId: string): void => {
    activeIndex.set(productId, activePath.length);
    activePath.push(productId);

    for (const child of adjacency.get(productId) ?? []) {
      const cycleStart = activeIndex.get(child);
      if (cycleStart !== undefined) {
        throw cycleError([...activePath.slice(cycleStart), child]);
      }

      if (visited.has(child)) continue;
      visited.add(child);
      descendants.push(child);
      visit(child);
    }

    activePath.pop();
    activeIndex.delete(productId);
  };

  visit(root);
  return descendants;
}
