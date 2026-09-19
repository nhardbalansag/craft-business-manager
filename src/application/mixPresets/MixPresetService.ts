import type { MixPreset, RatioBasis } from '../../domain/mixPresets';
import {
  cloneMixPreset,
  isMixPresetCompatibleWithCategory,
  validateMixPresetContract,
} from '../../domain/mixPresets';
import type { ProductCategory } from '../../domain/products';
import type { MaterialRepository } from '../materials/MaterialRepository';
import type { ProductRepository } from '../products/ProductRepository';
import type { MixPresetRepository } from './MixPresetRepository';

export interface MixPresetListFilter {
  basis?: RatioBasis;
  category?: ProductCategory;
  active?: boolean;
  query?: string;
}

export type MixPresetUpdate = Partial<Omit<MixPreset, 'id'>>;

export type MixPresetApplicationErrorCode =
  | 'MIX_PRESET_NOT_FOUND'
  | 'DUPLICATE_MIX_PRESET_ID'
  | 'DUPLICATE_MIX_PRESET_NAME'
  | 'MATERIAL_NOT_FOUND'
  | 'MATERIAL_INACTIVE'
  | 'ACTIVE_PRODUCT_DEPENDENCY';

export class MixPresetApplicationError extends Error {
  readonly code: MixPresetApplicationErrorCode;
  readonly mixPresetId?: string;
  readonly materialId?: string;
  readonly productId?: string;

  constructor(
    code: MixPresetApplicationErrorCode,
    message: string,
    context: { mixPresetId?: string; materialId?: string; productId?: string } = {},
  ) {
    super(message);
    this.name = 'MixPresetApplicationError';
    this.code = code;
    this.mixPresetId = context.mixPresetId;
    this.materialId = context.materialId;
    this.productId = context.productId;
  }
}

function comparable(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeMixPreset(preset: MixPreset): MixPreset {
  return {
    ...preset,
    id: preset.id.trim(),
    name: preset.name.trim(),
    compatibleCategories: [...preset.compatibleCategories],
    lines: preset.lines.map((line) => ({ ...line, materialId: line.materialId.trim() })),
    notes: preset.notes?.trim() || undefined,
  };
}

function matchesQuery(preset: MixPreset, query: string): boolean {
  const normalized = comparable(query);
  if (!normalized) return true;

  return [
    preset.id,
    preset.name,
    preset.notes ?? '',
    ...preset.compatibleCategories,
    ...preset.lines.map((line) => line.materialId),
  ].some((value) => value.toLowerCase().includes(normalized));
}

export class MixPresetService {
  constructor(
    private readonly repository: MixPresetRepository,
    private readonly materialRepository: MaterialRepository,
    private readonly productRepository: ProductRepository,
  ) {}

  async createMixPreset(input: MixPreset): Promise<MixPreset> {
    const preset = normalizeMixPreset(input);
    validateMixPresetContract(preset);
    await this.validateMaterialReferences(preset);
    await this.assertActiveProductRelationshipsRemainValid(preset);

    const all = await this.repository.list();
    this.assertUniqueIdentity(preset, all);

    await this.repository.insert(preset);
    return cloneMixPreset(preset);
  }

  async updateMixPreset(id: string, changes: MixPresetUpdate): Promise<MixPreset> {
    const existing = await this.requireMixPreset(id);
    const candidate = normalizeMixPreset({ ...existing, ...changes, id: existing.id });
    validateMixPresetContract(candidate);
    await this.validateMaterialReferences(candidate);
    await this.assertActiveProductRelationshipsRemainValid(candidate);

    const all = await this.repository.list();
    this.assertUniqueIdentity(candidate, all, existing.id);

    await this.repository.replace(candidate);
    return cloneMixPreset(candidate);
  }

  async getMixPreset(id: string): Promise<MixPreset | null> {
    const preset = await this.repository.findById(id);
    return preset ? cloneMixPreset(preset) : null;
  }

  async listMixPresets(filter: MixPresetListFilter = {}): Promise<MixPreset[]> {
    const presets = await this.repository.list();
    return presets
      .filter((preset) => filter.basis === undefined || preset.basis === filter.basis)
      .filter(
        (preset) =>
          filter.category === undefined || isMixPresetCompatibleWithCategory(preset, filter.category),
      )
      .filter((preset) => filter.active === undefined || preset.isActive === filter.active)
      .filter((preset) => filter.query === undefined || matchesQuery(preset, filter.query))
      .sort((a, b) => {
        const byName = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        return byName || a.id.localeCompare(b.id, undefined, { sensitivity: 'base' });
      })
      .map(cloneMixPreset);
  }

  async archiveMixPreset(id: string): Promise<MixPreset> {
    const existing = await this.requireMixPreset(id);
    if (!existing.isActive) return cloneMixPreset(existing);

    const archived = { ...existing, isActive: false };
    await this.assertActiveProductRelationshipsRemainValid(archived);
    await this.repository.replace(archived);
    return cloneMixPreset(archived);
  }

  private async validateMaterialReferences(preset: MixPreset): Promise<void> {
    for (const line of preset.lines) {
      const material = await this.materialRepository.findById(line.materialId);
      if (!material) {
        throw new MixPresetApplicationError(
          'MATERIAL_NOT_FOUND',
          `Material not found for mix preset ${preset.id}: ${line.materialId}.`,
          { mixPresetId: preset.id, materialId: line.materialId },
        );
      }

      if (preset.isActive && !material.isActive) {
        throw new MixPresetApplicationError(
          'MATERIAL_INACTIVE',
          `Active mix preset ${preset.id} cannot reference archived material ${material.id}.`,
          { mixPresetId: preset.id, materialId: material.id },
        );
      }
    }
  }

  private async assertActiveProductRelationshipsRemainValid(candidate: MixPreset): Promise<void> {
    const presetKey = comparable(candidate.id);
    const activeProducts = (await this.productRepository.list()).filter(
      (product) =>
        product.isActive && product.mixPresetId !== undefined && comparable(product.mixPresetId) === presetKey,
    );

    for (const product of activeProducts) {
      if (!candidate.isActive || !isMixPresetCompatibleWithCategory(candidate, product.category)) {
        throw new MixPresetApplicationError(
          'ACTIVE_PRODUCT_DEPENDENCY',
          `Mix preset ${candidate.id} cannot be archived or made incompatible while active product ${product.id} depends on it.`,
          { mixPresetId: candidate.id, productId: product.id },
        );
      }
    }
  }

  private async requireMixPreset(id: string): Promise<MixPreset> {
    const preset = await this.repository.findById(id);
    if (!preset) {
      throw new MixPresetApplicationError(
        'MIX_PRESET_NOT_FOUND',
        `Mix preset not found: ${id.trim()}.`,
        { mixPresetId: id.trim() },
      );
    }
    return preset;
  }

  private assertUniqueIdentity(candidate: MixPreset, all: MixPreset[], currentId?: string): void {
    const currentKey = currentId ? comparable(currentId) : undefined;
    const candidateId = comparable(candidate.id);
    const candidateName = comparable(candidate.name);

    if (
      all.some(
        (preset) => comparable(preset.id) === candidateId && comparable(preset.id) !== currentKey,
      )
    ) {
      throw new MixPresetApplicationError(
        'DUPLICATE_MIX_PRESET_ID',
        `Mix preset ID already exists: ${candidate.id}.`,
        { mixPresetId: candidate.id },
      );
    }

    if (
      all.some(
        (preset) => comparable(preset.name) === candidateName && comparable(preset.id) !== currentKey,
      )
    ) {
      throw new MixPresetApplicationError(
        'DUPLICATE_MIX_PRESET_NAME',
        `Mix preset name already exists: ${candidate.name}.`,
        { mixPresetId: candidate.id },
      );
    }
  }
}
