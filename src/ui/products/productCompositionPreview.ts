import type { Material } from '../../domain/materials';
import type {
  ProductComponent,
  ProductComponentRole,
  ProductComponentSourceType,
} from '../../domain/productComponents';
import type { Product } from '../../domain/products';

export type CompositionPreviewIssue = 'missing-source' | 'cycle';

export interface ProductCompositionPreviewNode {
  componentId: string;
  parentProductId: string;
  sourceType: ProductComponentSourceType;
  sourceId: string;
  sourceName: string;
  role: ProductComponentRole;
  quantityPerParent: number;
  notes?: string;
  sourceIsActive: boolean | null;
  issue?: CompositionPreviewIssue;
  children: ProductCompositionPreviewNode[];
}

function comparable(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base' });
}

function deterministicLines(lines: readonly ProductComponent[]): ProductComponent[] {
  return [...lines].sort((left, right) => {
    const byType = compareText(left.sourceType, right.sourceType);
    if (byType !== 0) return byType;

    const bySource = compareText(comparable(left.sourceId), comparable(right.sourceId));
    if (bySource !== 0) return bySource;

    return compareText(comparable(left.id), comparable(right.id));
  });
}

export function buildProductCompositionPreview(
  rootProductId: string,
  products: readonly Product[],
  materials: readonly Material[],
  components: readonly ProductComponent[],
): ProductCompositionPreviewNode[] {
  const productById = new Map(products.map((product) => [comparable(product.id), product]));
  const materialById = new Map(materials.map((material) => [comparable(material.id), material]));
  const componentsByParent = new Map<string, ProductComponent[]>();

  for (const component of components) {
    const key = comparable(component.parentProductId);
    const bucket = componentsByParent.get(key) ?? [];
    bucket.push(component);
    componentsByParent.set(key, bucket);
  }

  function expand(parentProductId: string, activePath: readonly string[]): ProductCompositionPreviewNode[] {
    const lines = deterministicLines(componentsByParent.get(comparable(parentProductId)) ?? []);

    return lines.map((component) => {
      const base = {
        componentId: component.id,
        parentProductId: component.parentProductId,
        sourceType: component.sourceType,
        sourceId: component.sourceId,
        role: component.role,
        quantityPerParent: component.quantityPerParent,
        notes: component.notes,
      };

      if (component.sourceType === 'material') {
        const material = materialById.get(comparable(component.sourceId));
        return {
          ...base,
          sourceName: material?.name ?? component.sourceId,
          sourceIsActive: material?.isActive ?? null,
          issue: material ? undefined : 'missing-source',
          children: [],
        };
      }

      const product = productById.get(comparable(component.sourceId));
      if (!product) {
        return {
          ...base,
          sourceName: component.sourceId,
          sourceIsActive: null,
          issue: 'missing-source',
          children: [],
        };
      }

      const sourceKey = comparable(product.id);
      if (activePath.includes(sourceKey)) {
        return {
          ...base,
          sourceName: product.name,
          sourceIsActive: product.isActive,
          issue: 'cycle',
          children: [],
        };
      }

      return {
        ...base,
        sourceName: product.name,
        sourceIsActive: product.isActive,
        children: expand(product.id, [...activePath, sourceKey]),
      };
    });
  }

  const rootKey = comparable(rootProductId);
  return expand(rootProductId, rootKey ? [rootKey] : []);
}
