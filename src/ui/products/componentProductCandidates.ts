import { validateProductCompositionGraph } from '../../domain/productCompositionGraph';
import type { ProductComponent } from '../../domain/productComponents';
import type { Product } from '../../domain/products';
import { catalogNameCollator } from '../catalogSort';

function key(value: string): string { return value.trim().toLowerCase(); }

/** A child is unsafe exactly when it already reaches the parent, creating a cycle. */
export function componentProductCandidates(
  products: readonly Product[],
  components: readonly ProductComponent[],
  parentId: string,
  editingComponentId: string | null,
): Product[] {
  const parentKey = key(parentId);
  if (!parentKey) return [];
  const graph = components.filter((component) => !editingComponentId || key(component.id) !== key(editingComponentId));
  // Keep the existing fail-closed behavior for an invalid saved graph.
  try { validateProductCompositionGraph(graph); }
  catch { return []; }

  const parentsByChild = new Map<string, string[]>();
  const used = new Set<string>();
  for (const component of graph) {
    if (component.sourceType !== 'product') continue;
    const parent = key(component.parentProductId), child = key(component.sourceId);
    if (parent === parentKey) used.add(child);
    const parents = parentsByChild.get(child) ?? [];
    parents.push(parent);
    parentsByChild.set(child, parents);
  }
  const blocked = new Set([parentKey]);
  const pending = [parentKey];
  while (pending.length) {
    for (const parent of parentsByChild.get(pending.pop()!) ?? []) {
      if (blocked.has(parent)) continue;
      blocked.add(parent);
      pending.push(parent);
    }
  }
  return products.filter((product) => product.isActive && !blocked.has(key(product.id)) && !used.has(key(product.id)))
    .sort((a, b) => catalogNameCollator.compare(a.name, b.name));
}
