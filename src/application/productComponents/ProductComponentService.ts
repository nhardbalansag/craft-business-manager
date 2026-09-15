import type { Material } from '../../domain/materials';
import {
  cloneProductComponent,
  normalizeProductComponent,
  type ProductComponent,
  type ProductComponentRole,
  type ProductComponentSourceType,
  validateMaterialBackedProductComponent,
  validateProductComponentContract,
} from '../../domain/productComponents';
import { validateProductCompositionGraph } from '../../domain/productCompositionGraph';
import type { MaterialRepository } from '../materials/MaterialRepository';
import type { ProductRepository } from '../products/ProductRepository';
import type { ProductComponentRelationshipGuard } from './ProductComponentRelationshipGuard';
import type { ProductComponentRepository } from './ProductComponentRepository';

export interface ProductComponentListFilter {
  parentProductId?: string;
  sourceType?: ProductComponentSourceType;
  sourceId?: string;
  role?: ProductComponentRole;
  query?: string;
}

export type ProductComponentUpdate = Partial<Omit<ProductComponent, 'id'>>;

export type ProductComponentApplicationErrorCode =
  | 'COMPONENT_NOT_FOUND'
  | 'DUPLICATE_COMPONENT_ID'
  | 'PARENT_PRODUCT_NOT_FOUND'
  | 'PARENT_PRODUCT_INACTIVE'
  | 'SOURCE_MATERIAL_NOT_FOUND'
  | 'SOURCE_MATERIAL_INACTIVE'
  | 'SOURCE_PRODUCT_NOT_FOUND'
  | 'SOURCE_PRODUCT_INACTIVE'
  | 'ACTIVE_PARENT_DEPENDS_ON_MATERIAL'
  | 'ACTIVE_PARENT_DEPENDS_ON_PRODUCT'
  | 'ACTIVE_PARENT_REQUIRES_COUNT_MATERIAL';

export class ProductComponentApplicationError extends Error {
  readonly code: ProductComponentApplicationErrorCode;
  readonly componentId?: string;
  readonly parentProductId?: string;
  readonly sourceType?: ProductComponentSourceType;
  readonly sourceId?: string;
  readonly dependentParentProductIds?: readonly string[];

  constructor(
    code: ProductComponentApplicationErrorCode,
    message: string,
    context: {
      componentId?: string;
      parentProductId?: string;
      sourceType?: ProductComponentSourceType;
      sourceId?: string;
      dependentParentProductIds?: readonly string[];
    } = {},
  ) {
    super(message);
    this.name = 'ProductComponentApplicationError';
    this.code = code;
    this.componentId = context.componentId;
    this.parentProductId = context.parentProductId;
    this.sourceType = context.sourceType;
    this.sourceId = context.sourceId;
    this.dependentParentProductIds = context.dependentParentProductIds;
  }
}

function comparable(value: string): string {
  return value.trim().toLowerCase();
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function matchesQuery(component: ProductComponent, query: string): boolean {
  const normalized = comparable(query);
  if (!normalized) return true;

  return [
    component.id,
    component.parentProductId,
    component.sourceType,
    component.sourceId,
    component.role,
    component.notes ?? '',
  ].some((value) => value.toLowerCase().includes(normalized));
}

export class ProductComponentService implements ProductComponentRelationshipGuard {
  constructor(
    private readonly repository: ProductComponentRepository,
    private readonly products: ProductRepository,
    private readonly materials: MaterialRepository,
  ) {}

  async createComponent(input: ProductComponent): Promise<ProductComponent> {
    const component = normalizeProductComponent(input);
    validateProductComponentContract(component);
    await this.validateWritableRelationship(component);

    const all = await this.repository.list();
    this.assertUniqueComponentId(component, all);
    validateProductCompositionGraph([...all, component]);

    await this.repository.insert(component);
    return cloneProductComponent(component);
  }

  async updateComponent(id: string, changes: ProductComponentUpdate): Promise<ProductComponent> {
    const existing = await this.requireComponent(id);
    const candidate = normalizeProductComponent({ ...existing, ...changes, id: existing.id });
    validateProductComponentContract(candidate);
    await this.validateWritableRelationship(candidate);

    const all = await this.repository.list();
    this.assertUniqueComponentId(candidate, all, existing.id);
    const currentKey = comparable(existing.id);
    const proposed = all.map((component) =>
      comparable(component.id) === currentKey ? candidate : component,
    );
    validateProductCompositionGraph(proposed);

    await this.repository.replace(candidate);
    return cloneProductComponent(candidate);
  }

  async getComponent(id: string): Promise<ProductComponent | null> {
    const component = await this.repository.findById(id);
    return component ? cloneProductComponent(component) : null;
  }

  async listComponents(filter: ProductComponentListFilter = {}): Promise<ProductComponent[]> {
    const components = await this.repository.list();

    return components
      .filter(
        (component) =>
          filter.parentProductId === undefined ||
          comparable(component.parentProductId) === comparable(filter.parentProductId),
      )
      .filter(
        (component) => filter.sourceType === undefined || component.sourceType === filter.sourceType,
      )
      .filter(
        (component) =>
          filter.sourceId === undefined || comparable(component.sourceId) === comparable(filter.sourceId),
      )
      .filter((component) => filter.role === undefined || component.role === filter.role)
      .filter((component) => filter.query === undefined || matchesQuery(component, filter.query))
      .sort((left, right) => {
        const byParent = compareText(comparable(left.parentProductId), comparable(right.parentProductId));
        if (byParent) return byParent;
        const bySourceType = compareText(left.sourceType, right.sourceType);
        if (bySourceType) return bySourceType;
        const bySource = compareText(comparable(left.sourceId), comparable(right.sourceId));
        if (bySource) return bySource;
        return compareText(comparable(left.id), comparable(right.id));
      })
      .map(cloneProductComponent);
  }

  async listComponentsByParent(parentProductId: string): Promise<ProductComponent[]> {
    return this.listComponents({ parentProductId });
  }

  async removeComponent(id: string): Promise<void> {
    const existing = await this.requireComponent(id);
    await this.repository.delete(existing.id);
  }

  async assertMaterialCanArchive(materialId: string): Promise<void> {
    const parentIds = await this.getActiveDependentParentIds('material', materialId);
    if (parentIds.length === 0) return;

    throw new ProductComponentApplicationError(
      'ACTIVE_PARENT_DEPENDS_ON_MATERIAL',
      `Material ${materialId.trim()} cannot be archived because active product composition(s) depend on it: ${parentIds.join(', ')}.`,
      {
        sourceType: 'material',
        sourceId: materialId.trim(),
        dependentParentProductIds: parentIds,
      },
    );
  }

  async assertProductCanArchive(productId: string): Promise<void> {
    const parentIds = await this.getActiveDependentParentIds('product', productId);
    if (parentIds.length === 0) return;

    throw new ProductComponentApplicationError(
      'ACTIVE_PARENT_DEPENDS_ON_PRODUCT',
      `Product ${productId.trim()} cannot be archived because active product composition(s) depend on it: ${parentIds.join(', ')}.`,
      {
        sourceType: 'product',
        sourceId: productId.trim(),
        dependentParentProductIds: parentIds,
      },
    );
  }

  async assertProductCanActivate(productId: string): Promise<void> {
    const parent = await this.products.findById(productId);
    if (!parent) {
      throw new ProductComponentApplicationError(
        'PARENT_PRODUCT_NOT_FOUND',
        `Parent product not found: ${productId.trim()}.`,
        { parentProductId: productId.trim() },
      );
    }

    const all = await this.repository.list();
    const parentKey = comparable(parent.id);
    const parentComponents = all.filter(
      (component) => comparable(component.parentProductId) === parentKey,
    );

    for (const component of parentComponents) {
      validateProductComponentContract(component);
      await this.validateActiveSource(component);
    }

    validateProductCompositionGraph(all);
  }

  async assertMaterialUpdatePreservesActiveComponents(material: Material): Promise<void> {
    const parentIds = await this.getActiveDependentParentIds('material', material.id);
    if (parentIds.length === 0) return;

    if (!material.isActive) {
      await this.assertMaterialCanArchive(material.id);
      return;
    }

    if (material.baseUnit !== 'pc') {
      throw new ProductComponentApplicationError(
        'ACTIVE_PARENT_REQUIRES_COUNT_MATERIAL',
        `Material ${material.id} must keep base unit pc while active product composition(s) depend on it: ${parentIds.join(', ')}.`,
        {
          sourceType: 'material',
          sourceId: material.id,
          dependentParentProductIds: parentIds,
        },
      );
    }
  }

  private async validateWritableRelationship(component: ProductComponent): Promise<void> {
    const parent = await this.products.findById(component.parentProductId);
    if (!parent) {
      throw new ProductComponentApplicationError(
        'PARENT_PRODUCT_NOT_FOUND',
        `Parent product not found: ${component.parentProductId}.`,
        { componentId: component.id, parentProductId: component.parentProductId },
      );
    }

    if (!parent.isActive) {
      throw new ProductComponentApplicationError(
        'PARENT_PRODUCT_INACTIVE',
        `Components cannot be added to or changed on archived product ${parent.id}.`,
        { componentId: component.id, parentProductId: parent.id },
      );
    }

    await this.validateActiveSource(component);
  }

  private async validateActiveSource(component: ProductComponent): Promise<void> {
    if (component.sourceType === 'material') {
      const material = await this.materials.findById(component.sourceId);
      if (!material) {
        throw new ProductComponentApplicationError(
          'SOURCE_MATERIAL_NOT_FOUND',
          `Component material source not found: ${component.sourceId}.`,
          {
            componentId: component.id,
            parentProductId: component.parentProductId,
            sourceType: component.sourceType,
            sourceId: component.sourceId,
          },
        );
      }

      if (!material.isActive) {
        throw new ProductComponentApplicationError(
          'SOURCE_MATERIAL_INACTIVE',
          `Active product ${component.parentProductId} cannot use archived component material ${material.id}.`,
          {
            componentId: component.id,
            parentProductId: component.parentProductId,
            sourceType: component.sourceType,
            sourceId: material.id,
          },
        );
      }

      validateMaterialBackedProductComponent(component, material);
      return;
    }

    const sourceProduct = await this.products.findById(component.sourceId);
    if (!sourceProduct) {
      throw new ProductComponentApplicationError(
        'SOURCE_PRODUCT_NOT_FOUND',
        `Component product source not found: ${component.sourceId}.`,
        {
          componentId: component.id,
          parentProductId: component.parentProductId,
          sourceType: component.sourceType,
          sourceId: component.sourceId,
        },
      );
    }

    if (!sourceProduct.isActive) {
      throw new ProductComponentApplicationError(
        'SOURCE_PRODUCT_INACTIVE',
        `Active product ${component.parentProductId} cannot use archived child product ${sourceProduct.id}.`,
        {
          componentId: component.id,
          parentProductId: component.parentProductId,
          sourceType: component.sourceType,
          sourceId: sourceProduct.id,
        },
      );
    }
  }

  private async getActiveDependentParentIds(
    sourceType: ProductComponentSourceType,
    sourceId: string,
  ): Promise<string[]> {
    const [components, products] = await Promise.all([
      this.repository.list(),
      this.products.list(),
    ]);
    const activeParents = new Map(
      products.filter((product) => product.isActive).map((product) => [comparable(product.id), product.id]),
    );
    const sourceKey = comparable(sourceId);
    const parentIds = new Set<string>();

    for (const component of components) {
      if (component.sourceType !== sourceType || comparable(component.sourceId) !== sourceKey) continue;
      const parentId = activeParents.get(comparable(component.parentProductId));
      if (parentId) parentIds.add(parentId);
    }

    return [...parentIds].sort((left, right) => compareText(comparable(left), comparable(right)));
  }

  private async requireComponent(id: string): Promise<ProductComponent> {
    const component = await this.repository.findById(id);
    if (!component) {
      throw new ProductComponentApplicationError(
        'COMPONENT_NOT_FOUND',
        `Product component not found: ${id.trim()}.`,
        { componentId: id.trim() },
      );
    }
    return component;
  }

  private assertUniqueComponentId(
    candidate: ProductComponent,
    all: ProductComponent[],
    currentId?: string,
  ): void {
    const candidateId = comparable(candidate.id);
    const currentKey = currentId ? comparable(currentId) : undefined;

    if (
      all.some(
        (component) => comparable(component.id) === candidateId && comparable(component.id) !== currentKey,
      )
    ) {
      throw new ProductComponentApplicationError(
        'DUPLICATE_COMPONENT_ID',
        `Product component ID already exists: ${candidate.id}.`,
        {
          componentId: candidate.id,
          parentProductId: candidate.parentProductId,
          sourceType: candidate.sourceType,
          sourceId: candidate.sourceId,
        },
      );
    }
  }
}
