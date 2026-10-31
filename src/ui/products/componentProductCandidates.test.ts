import { describe, expect, it } from 'vitest';
import type { Product } from '../../domain/products';
import type { ProductComponent } from '../../domain/productComponents';
import { validateProductCompositionGraph } from '../../domain/productCompositionGraph';
import { componentProductCandidates } from './componentProductCandidates';

function product(id: string, isActive = true): Product {
  return { id, name: id, isActive, category: 'candle', safetyWasteRate: 0 };
}
function edge(parent: string, child: string, id = parent + '-' + child): ProductComponent {
  return { id, parentProductId: parent, sourceId: child, sourceType: 'product', role: 'other', quantityPerParent: 1 };
}

function allowedBySaveGate(products: readonly Product[], graph: readonly ProductComponent[], parent: string, edit: string | null) {
  return products.filter((source) => {
    if (!source.isActive) return false;
    try {
      validateProductCompositionGraph([
        ...graph.filter((line) => line.id.trim().toLowerCase() !== edit?.trim().toLowerCase()),
        { ...edge(parent, source.id), id: edit ?? '__candidate__' },
      ]);
      return true;
    } catch { return false; }
  }).map((source) => source.id).sort();
}

describe('Component product candidate reachability', () => {
  it('excludes self, existing sources, ancestors and archived products while allowing safe descendants', () => {
    const products = ['ROOT', 'PARENT', 'CHILD', 'LEAF', 'FREE', 'GRAND'].map((id) => product(id));
    products.push(product('ARCHIVED', false));
    const graph = [edge('ROOT', 'GRAND'), edge('GRAND', 'PARENT'), edge('PARENT', 'CHILD'), edge('CHILD', 'LEAF')];
    const snapshot = structuredClone(graph);
    expect(componentProductCandidates(products, graph, ' parent ', null).map((p) => p.id)).toEqual(['FREE', 'LEAF']);
    expect(componentProductCandidates(products, graph, 'PARENT', 'PARENT-CHILD').map((p) => p.id)).toEqual(['CHILD', 'FREE', 'LEAF']);
    expect(graph).toEqual(snapshot);
  });

  it('preserves fail-closed behavior for invalid graphs and lets an edit repair its removed edge', () => {
    const products = ['A', 'B', 'C'].map((id) => product(id));
    const graph = [edge('A', 'B'), edge('B', 'A')];
    expect(componentProductCandidates(products, graph, 'C', null)).toEqual([]);
    expect(componentProductCandidates(products, graph, 'A', 'A-B').map((p) => p.id)).toEqual(['C']);
    expect(componentProductCandidates(products, [edge('A', 'B'), edge('A', 'B', 'duplicate')], 'C', null)).toEqual([]);
  });

  it('agrees with the authoritative save validator across branching graphs and edits', () => {
    const products = Array.from({ length: 24 }, (_, i) => product('P' + i, i !== 23));
    const graph: ProductComponent[] = [];
    for (let parent = 0; parent < products.length; parent++) {
      for (let child = parent + 1; child < products.length; child++) {
        if ((parent * 13 + child * 7) % 11 === 0) graph.push(edge(products[parent].id, products[child].id));
      }
    }
    for (const parent of products.filter((_, index) => index % 3 === 0)) {
      const editing = graph.find((line) => line.parentProductId === parent.id)?.id ?? null;
      for (const edit of [null, editing]) {
        expect(componentProductCandidates(products, graph, parent.id, edit).map((p) => p.id).sort())
          .toEqual(allowedBySaveGate(products, graph, parent.id, edit));
      }
    }
  });
});
