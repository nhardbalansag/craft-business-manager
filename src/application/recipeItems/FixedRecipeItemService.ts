import type { FixedRecipeItem, FixedRecipeItemRequirement, FixedRecipeItemRole } from '../../domain/fixedRecipeItems';
import {
  cloneFixedRecipeItem,
  deriveFixedRecipeItemRequirement,
  validateFixedRecipeItemContract,
} from '../../domain/fixedRecipeItems';
import type { CalibrationRepository } from '../calibrations/CalibrationRepository';
import type { MaterialRepository } from '../materials/MaterialRepository';
import type { ProductRepository } from '../products/ProductRepository';
import type { FixedRecipeItemRepository } from './FixedRecipeItemRepository';

export interface FixedRecipeItemListFilter {
  productId?: string;
  role?: FixedRecipeItemRole;
  query?: string;
}

export type FixedRecipeItemUpdate = Partial<Omit<FixedRecipeItem, 'id'>>;

export type FixedRecipeItemApplicationErrorCode =
  | 'ITEM_NOT_FOUND'
  | 'DUPLICATE_ITEM_ID'
  | 'DUPLICATE_PRODUCT_MATERIAL'
  | 'PRODUCT_NOT_FOUND'
  | 'PRODUCT_INACTIVE'
  | 'MATERIAL_NOT_FOUND'
  | 'MATERIAL_INACTIVE';

export class FixedRecipeItemApplicationError extends Error {
  readonly code: FixedRecipeItemApplicationErrorCode;
  readonly itemId?: string;
  readonly productId?: string;
  readonly materialId?: string;

  constructor(
    code: FixedRecipeItemApplicationErrorCode,
    message: string,
    context: { itemId?: string; productId?: string; materialId?: string } = {},
  ) {
    super(message);
    this.name = 'FixedRecipeItemApplicationError';
    this.code = code;
    this.itemId = context.itemId;
    this.productId = context.productId;
    this.materialId = context.materialId;
  }
}

function comparable(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeItem(item: FixedRecipeItem): FixedRecipeItem {
  return {
    ...item,
    id: item.id.trim(),
    productId: item.productId.trim(),
    materialId: item.materialId.trim(),
    notes: item.notes?.trim() || undefined,
  };
}

function matchesQuery(item: FixedRecipeItem, query: string): boolean {
  const normalized = comparable(query);
  if (!normalized) return true;
  return [item.id, item.productId, item.materialId, item.role, item.notes ?? ''].some((value) =>
    value.toLowerCase().includes(normalized),
  );
}

export class FixedRecipeItemService {
  constructor(
    private readonly repository: FixedRecipeItemRepository,
    private readonly products: ProductRepository,
    private readonly materials: MaterialRepository,
    private readonly calibrations: CalibrationRepository,
  ) {}

  async createItem(input: FixedRecipeItem): Promise<FixedRecipeItem> {
    const item = normalizeItem(input);
    validateFixedRecipeItemContract(item);
    await this.validateReferencesAndQuantity(item);

    const all = await this.repository.list();
    this.assertUnique(item, all);

    await this.repository.insert(item);
    return cloneFixedRecipeItem(item);
  }

  async updateItem(id: string, changes: FixedRecipeItemUpdate): Promise<FixedRecipeItem> {
    const existing = await this.requireItem(id);
    const candidate = normalizeItem({ ...existing, ...changes, id: existing.id });
    validateFixedRecipeItemContract(candidate);
    await this.validateReferencesAndQuantity(candidate);

    const all = await this.repository.list();
    this.assertUnique(candidate, all, existing.id);

    await this.repository.replace(candidate);
    return cloneFixedRecipeItem(candidate);
  }

  async getItem(id: string): Promise<FixedRecipeItem | null> {
    const item = await this.repository.findById(id);
    return item ? cloneFixedRecipeItem(item) : null;
  }

  async listItems(filter: FixedRecipeItemListFilter = {}): Promise<FixedRecipeItem[]> {
    const items = await this.repository.list();
    return items
      .filter(
        (item) => filter.productId === undefined || comparable(item.productId) === comparable(filter.productId),
      )
      .filter((item) => filter.role === undefined || item.role === filter.role)
      .filter((item) => filter.query === undefined || matchesQuery(item, filter.query))
      .sort((a, b) => {
        const byProduct = a.productId.localeCompare(b.productId, undefined, { sensitivity: 'base' });
        if (byProduct) return byProduct;
        const byMaterial = a.materialId.localeCompare(b.materialId, undefined, { sensitivity: 'base' });
        return byMaterial || a.id.localeCompare(b.id, undefined, { sensitivity: 'base' });
      })
      .map(cloneFixedRecipeItem);
  }

  async removeItem(id: string): Promise<void> {
    const existing = await this.requireItem(id);
    await this.repository.delete(existing.id);
  }

  async deriveItemRequirement(id: string): Promise<FixedRecipeItemRequirement> {
    const item = await this.requireItem(id);
    const material = await this.materials.findById(item.materialId);
    if (!material) {
      throw new FixedRecipeItemApplicationError(
        'MATERIAL_NOT_FOUND',
        `Material not found: ${item.materialId}.`,
        { itemId: item.id, productId: item.productId, materialId: item.materialId },
      );
    }

    const calibrations = await this.calibrations.list();
    return deriveFixedRecipeItemRequirement(item, material, calibrations);
  }

  private async validateReferencesAndQuantity(item: FixedRecipeItem): Promise<void> {
    const [product, material, calibrations] = await Promise.all([
      this.products.findById(item.productId),
      this.materials.findById(item.materialId),
      this.calibrations.list(),
    ]);

    if (!product) {
      throw new FixedRecipeItemApplicationError(
        'PRODUCT_NOT_FOUND',
        `Product not found: ${item.productId}.`,
        { itemId: item.id, productId: item.productId, materialId: item.materialId },
      );
    }

    if (!product.isActive) {
      throw new FixedRecipeItemApplicationError(
        'PRODUCT_INACTIVE',
        `Fixed recipe items cannot be added to archived product ${product.id}.`,
        { itemId: item.id, productId: product.id, materialId: item.materialId },
      );
    }

    if (!material) {
      throw new FixedRecipeItemApplicationError(
        'MATERIAL_NOT_FOUND',
        `Material not found: ${item.materialId}.`,
        { itemId: item.id, productId: product.id, materialId: item.materialId },
      );
    }

    if (!material.isActive) {
      throw new FixedRecipeItemApplicationError(
        'MATERIAL_INACTIVE',
        `Active recipe for ${product.id} cannot use archived material ${material.id}.`,
        { itemId: item.id, productId: product.id, materialId: material.id },
      );
    }

    deriveFixedRecipeItemRequirement(item, material, calibrations);
  }

  private async requireItem(id: string): Promise<FixedRecipeItem> {
    const item = await this.repository.findById(id);
    if (!item) {
      throw new FixedRecipeItemApplicationError('ITEM_NOT_FOUND', `Recipe item not found: ${id.trim()}.`, {
        itemId: id.trim(),
      });
    }
    return item;
  }

  private assertUnique(candidate: FixedRecipeItem, all: FixedRecipeItem[], currentId?: string): void {
    const currentKey = currentId ? comparable(currentId) : undefined;
    const candidateId = comparable(candidate.id);
    const candidateProduct = comparable(candidate.productId);
    const candidateMaterial = comparable(candidate.materialId);

    if (
      all.some(
        (item) => comparable(item.id) === candidateId && comparable(item.id) !== currentKey,
      )
    ) {
      throw new FixedRecipeItemApplicationError(
        'DUPLICATE_ITEM_ID',
        `Recipe item ID already exists: ${candidate.id}.`,
        { itemId: candidate.id, productId: candidate.productId, materialId: candidate.materialId },
      );
    }

    if (
      all.some(
        (item) =>
          comparable(item.productId) === candidateProduct &&
          comparable(item.materialId) === candidateMaterial &&
          comparable(item.id) !== currentKey,
      )
    ) {
      throw new FixedRecipeItemApplicationError(
        'DUPLICATE_PRODUCT_MATERIAL',
        `Product ${candidate.productId} already has a fixed recipe line for material ${candidate.materialId}.`,
        { itemId: candidate.id, productId: candidate.productId, materialId: candidate.materialId },
      );
    }
  }
}
