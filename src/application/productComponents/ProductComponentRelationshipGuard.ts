import type { Material } from '../../domain/materials';

/**
 * Cross-aggregate guard used by Product/Material services so their lifecycle
 * changes cannot silently invalidate active product compositions.
 */
export interface ProductComponentRelationshipGuard {
  assertMaterialCanArchive(materialId: string): Promise<void>;
  assertProductCanArchive(productId: string): Promise<void>;
  assertProductCanActivate(productId: string): Promise<void>;
  assertMaterialUpdatePreservesActiveComponents(material: Material): Promise<void>;
}
