import type { Material } from '../../domain/materials';

export interface PlasterMoldYieldProfileRelationshipGuard {
  assertMoldCanArchive(moldId: string): Promise<void>;
  assertMaterialCanArchive(materialId: string): Promise<void>;
  assertMaterialUpdatePreservesActiveProfiles(material: Material): Promise<void>;
}
