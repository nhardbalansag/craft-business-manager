import type { Material, MaterialGroup } from '../../domain/materials';
import { validateMaterialContract } from '../../domain/materials';
import type { MaterialRepository } from './MaterialRepository';

export interface MaterialListFilter {
  group?: MaterialGroup;
  active?: boolean;
  query?: string;
}

export type MaterialUpdate = Partial<Omit<Material, 'id'>>;

export type MaterialApplicationErrorCode =
  | 'MATERIAL_NOT_FOUND'
  | 'DUPLICATE_MATERIAL_ID'
  | 'DUPLICATE_MATERIAL_NAME';

export class MaterialApplicationError extends Error {
  readonly code: MaterialApplicationErrorCode;
  readonly materialId?: string;

  constructor(code: MaterialApplicationErrorCode, message: string, materialId?: string) {
    super(message);
    this.name = 'MaterialApplicationError';
    this.code = code;
    this.materialId = materialId;
  }
}

function normalizeComparable(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function normalizeMaterial(material: Material): Material {
  return {
    ...material,
    id: material.id.trim(),
    name: material.name.trim(),
    notes: material.notes?.trim() || undefined,
  };
}

function matchesQuery(material: Material, query: string): boolean {
  const normalized = normalizeComparable(query);
  if (!normalized) return true;

  return [material.id, material.name, material.notes ?? ''].some((value) =>
    value.toLocaleLowerCase().includes(normalized),
  );
}

export class MaterialService {
  constructor(private readonly repository: MaterialRepository) {}

  async createMaterial(input: Material): Promise<Material> {
    const material = normalizeMaterial(input);
    validateMaterialContract(material);

    const all = await this.repository.list();
    this.assertUniqueIdentity(material, all);

    await this.repository.insert(material);
    return { ...material };
  }

  async updateMaterial(id: string, changes: MaterialUpdate): Promise<Material> {
    const existing = await this.requireMaterial(id);
    const candidate = normalizeMaterial({ ...existing, ...changes, id: existing.id });
    validateMaterialContract(candidate);

    const all = await this.repository.list();
    this.assertUniqueIdentity(candidate, all, existing.id);

    await this.repository.replace(candidate);
    return { ...candidate };
  }

  async getMaterial(id: string): Promise<Material | null> {
    const material = await this.repository.findById(id);
    return material ? { ...material } : null;
  }

  async listMaterials(filter: MaterialListFilter = {}): Promise<Material[]> {
    const materials = await this.repository.list();

    return materials
      .filter((material) => filter.group === undefined || material.group === filter.group)
      .filter((material) => filter.active === undefined || material.isActive === filter.active)
      .filter((material) => filter.query === undefined || matchesQuery(material, filter.query))
      .sort((a, b) => {
        const byName = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        return byName || a.id.localeCompare(b.id, undefined, { sensitivity: 'base' });
      })
      .map((material) => ({ ...material }));
  }

  async archiveMaterial(id: string): Promise<Material> {
    const existing = await this.requireMaterial(id);
    if (!existing.isActive) return { ...existing };

    const archived = { ...existing, isActive: false };
    await this.repository.replace(archived);
    return { ...archived };
  }

  private async requireMaterial(id: string): Promise<Material> {
    const material = await this.repository.findById(id);
    if (!material) {
      throw new MaterialApplicationError(
        'MATERIAL_NOT_FOUND',
        `Material not found: ${id.trim()}.`,
        id.trim(),
      );
    }
    return material;
  }

  private assertUniqueIdentity(candidate: Material, all: Material[], currentId?: string): void {
    const currentKey = currentId ? normalizeComparable(currentId) : undefined;
    const candidateId = normalizeComparable(candidate.id);
    const candidateName = normalizeComparable(candidate.name);

    const duplicateId = all.find(
      (material) =>
        normalizeComparable(material.id) === candidateId &&
        normalizeComparable(material.id) !== currentKey,
    );

    if (duplicateId) {
      throw new MaterialApplicationError(
        'DUPLICATE_MATERIAL_ID',
        `Material ID already exists: ${candidate.id}.`,
        candidate.id,
      );
    }

    const duplicateName = all.find(
      (material) =>
        normalizeComparable(material.name) === candidateName &&
        normalizeComparable(material.id) !== currentKey,
    );

    if (duplicateName) {
      throw new MaterialApplicationError(
        'DUPLICATE_MATERIAL_NAME',
        `Material name already exists: ${candidate.name}.`,
        candidate.id,
      );
    }
  }
}
