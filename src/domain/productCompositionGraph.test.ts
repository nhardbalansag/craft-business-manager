import { describe, expect, it } from 'vitest';
import type { ProductComponent } from './productComponents';
import {
  findProductCompositionCycle,
  getProductCompositionDescendants,
  ProductCompositionGraphError,
  validateProductComponentSourceUniqueness,
  validateProductCompositionGraph,
} from './productCompositionGraph';

function productEdge(
  id: string,
  parentProductId: string,
  sourceId: string,
  quantityPerParent = 1,
): ProductComponent {
  return {
    id,
    parentProductId,
    sourceType: 'product',
    sourceId,
    role: 'molded-component',
    quantityPerParent,
  };
}

function materialEdge(
  id: string,
  parentProductId: string,
  sourceId: string,
): ProductComponent {
  return {
    id,
    parentProductId,
    sourceType: 'material',
    sourceId,
    role: 'vessel',
    quantityPerParent: 1,
  };
}

describe('product composition graph integrity', () => {
  it('accepts a deep finite acyclic composition graph', () => {
    const components = [
      productEdge('PC-A-B', 'A', 'B'),
      productEdge('PC-B-C', 'B', 'C'),
      productEdge('PC-C-D', 'C', 'D'),
      materialEdge('PC-A-GLASS', 'A', 'MAT-GLASS'),
    ];

    expect(() => validateProductCompositionGraph(components)).not.toThrow();
    expect(findProductCompositionCycle(components)).toBeNull();
  });

  it('rejects direct self-reference with a specific error and canonical path', () => {
    expect(() =>
      validateProductCompositionGraph([
        productEdge('PC-SELF', ' Gift-Box ', 'gift-box'),
      ]),
    ).toThrowError(
      expect.objectContaining<Partial<ProductCompositionGraphError>>({
        code: 'DIRECT_SELF_REFERENCE',
        componentId: 'PC-SELF',
        cyclePath: ['gift-box', 'gift-box'],
      }),
    );
  });

  it('rejects a two-product cycle', () => {
    expect(() =>
      validateProductCompositionGraph([
        productEdge('PC-A-B', 'A', 'B'),
        productEdge('PC-B-A', 'B', 'A'),
      ]),
    ).toThrowError(
      expect.objectContaining<Partial<ProductCompositionGraphError>>({
        code: 'CYCLE_DETECTED',
        cyclePath: ['a', 'b', 'a'],
      }),
    );
  });

  it('rejects a deeper transitive cycle with deterministic path reporting', () => {
    const components = [
      productEdge('PC-C-A', 'C', 'A'),
      productEdge('PC-B-C', 'B', 'C'),
      productEdge('PC-A-B', 'A', 'B'),
    ];

    expect(findProductCompositionCycle(components)).toEqual(['a', 'b', 'c', 'a']);

    expect(() => validateProductCompositionGraph(components)).toThrowError(
      expect.objectContaining<Partial<ProductCompositionGraphError>>({
        code: 'CYCLE_DETECTED',
        cyclePath: ['a', 'b', 'c', 'a'],
      }),
    );
  });

  it('reports the same first cycle regardless of input ordering', () => {
    const first = [
      productEdge('PC-X-Y', 'X', 'Y'),
      productEdge('PC-Y-X', 'Y', 'X'),
      productEdge('PC-A-B', 'A', 'B'),
      productEdge('PC-B-A', 'B', 'A'),
    ];
    const reversed = [...first].reverse();

    expect(findProductCompositionCycle(first)).toEqual(['a', 'b', 'a']);
    expect(findProductCompositionCycle(reversed)).toEqual(['a', 'b', 'a']);
  });

  it('rejects duplicate source identity for the same parent case-insensitively', () => {
    const components: ProductComponent[] = [
      materialEdge('PC-1', 'CND-001', 'MAT-GLASS'),
      {
        ...materialEdge('PC-2', ' cnd-001 ', ' mat-glass '),
        role: 'accessory',
        quantityPerParent: 2,
      },
    ];

    expect(() => validateProductComponentSourceUniqueness(components)).toThrowError(
      expect.objectContaining<Partial<ProductCompositionGraphError>>({
        code: 'DUPLICATE_COMPONENT_SOURCE',
        sourceKey: 'cnd-001::material::mat-glass',
      }),
    );
  });

  it('allows the same source identity under different parents or source kinds', () => {
    const components: ProductComponent[] = [
      materialEdge('PC-1', 'PARENT-A', 'SHARED-ID'),
      materialEdge('PC-2', 'PARENT-B', 'SHARED-ID'),
      productEdge('PC-3', 'PARENT-A', 'SHARED-ID'),
    ];

    expect(() => validateProductComponentSourceUniqueness(components)).not.toThrow();
  });

  it('ignores material-backed lines when detecting product graph cycles', () => {
    const components = [
      materialEdge('PC-A-MAT', 'A', 'A'),
      productEdge('PC-A-B', 'A', 'B'),
    ];

    expect(() => validateProductCompositionGraph(components)).not.toThrow();
  });

  it('returns deterministic depth-first descendants for a safe root', () => {
    const components = [
      productEdge('PC-A-C', 'A', 'C'),
      productEdge('PC-B-D', 'B', 'D'),
      productEdge('PC-A-B', 'A', 'B'),
      productEdge('PC-C-E', 'C', 'E'),
      productEdge('PC-D-F', 'D', 'F'),
    ];

    expect(getProductCompositionDescendants(components, ' A ')).toEqual([
      'b',
      'd',
      'f',
      'c',
      'e',
    ]);
  });

  it('guards recursive traversal against a reachable corrupted cycle', () => {
    const components = [
      productEdge('PC-A-B', 'A', 'B'),
      productEdge('PC-B-C', 'B', 'C'),
      productEdge('PC-C-B', 'C', 'B'),
    ];

    expect(() => getProductCompositionDescendants(components, 'A')).toThrowError(
      expect.objectContaining<Partial<ProductCompositionGraphError>>({
        code: 'CYCLE_DETECTED',
        cyclePath: ['b', 'c', 'b'],
      }),
    );
  });

  it('does not let an unrelated corrupted cycle block traversal of a safe root', () => {
    const components = [
      productEdge('PC-A-B', 'A', 'B'),
      productEdge('PC-X-Y', 'X', 'Y'),
      productEdge('PC-Y-X', 'Y', 'X'),
    ];

    expect(getProductCompositionDescendants(components, 'A')).toEqual(['b']);
  });

  it('rejects a blank traversal root', () => {
    expect(() => getProductCompositionDescendants([], '   ')).toThrowError(
      expect.objectContaining<Partial<ProductCompositionGraphError>>({
        code: 'INVALID_ROOT_PRODUCT_ID',
      }),
    );
  });
});
