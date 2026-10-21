import type { Material } from '../../domain/materials';
import type { Mold } from '../../domain/molds';
import {
  clonePlasterMoldYieldProfile,
  normalizePlasterMoldYieldProfile,
  type PlasterMoldYieldProfile,
  validatePlasterMoldYieldProfileContract,
} from '../../domain/plasterMoldYieldProfiles';
import {
  type PlasterMoldYieldProfileReferenceIssue,
  type PlasterMoldYieldProfileReferenceIssueCode,
  validatePlasterMoldYieldProfileReferences,
} from '../../domain/plasterMoldYieldProfileValidation';
import type { MaterialRepository } from '../materials/MaterialRepository';
import type { MoldRepository } from '../molds/MoldRepository';
import type { PlasterMoldYieldProfileRelationshipGuard } from './PlasterMoldYieldProfileRelationshipGuard';
import type { PlasterMoldYieldProfileRepository } from './PlasterMoldYieldProfileRepository';

export interface PlasterMoldYieldProfileListFilter {
  moldId?: string;
  waterMaterialId?: string;
  plasterMaterialId?: string;
  glueMaterialId?: string;
  active?: boolean;
  query?: string;
}

export type PlasterMoldYieldProfileUpdate = Partial<
  Omit<PlasterMoldYieldProfile, 'id'>
>;

export type PlasterMoldYieldProfileApplicationErrorCode =
  | 'PROFILE_NOT_FOUND'
  | 'DUPLICATE_PROFILE_ID'
  | 'MOLD_IN_USE_BY_ACTIVE_PROFILE'
  | 'MATERIAL_IN_USE_BY_ACTIVE_PROFILE'
  | 'ACTIVE_PROFILE_REQUIRES_WEIGHT_MATERIAL'
  | PlasterMoldYieldProfileReferenceIssueCode;

export class PlasterMoldYieldProfileApplicationError extends Error {
  readonly code: PlasterMoldYieldProfileApplicationErrorCode;
  readonly profileId?: string;
  readonly moldId?: string;
  readonly materialId?: string;
  readonly field?: PlasterMoldYieldProfileReferenceIssue['field'];

  constructor(
    code: PlasterMoldYieldProfileApplicationErrorCode,
    message: string,
    context: {
      profileId?: string;
      moldId?: string;
      materialId?: string;
      field?: PlasterMoldYieldProfileReferenceIssue['field'];
    } = {},
  ) {
    super(message);
    this.name = 'PlasterMoldYieldProfileApplicationError';
    this.code = code;
    this.profileId = context.profileId;
    this.moldId = context.moldId;
    this.materialId = context.materialId;
    this.field = context.field;
  }
}

function comparable(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base' });
}

function matchesQuery(profile: PlasterMoldYieldProfile, query: string): boolean {
  const normalized = comparable(query);
  if (!normalized) return true;

  return [
    profile.id,
    profile.moldId,
    profile.waterMaterialId,
    profile.plasterMaterialId,
    profile.glueMaterialId,
    profile.notes ?? '',
  ].some((value) => comparable(value).includes(normalized));
}

function materialRoleForId(
  profile: PlasterMoldYieldProfile,
  materialId: string,
): 'waterMaterialId' | 'plasterMaterialId' | 'glueMaterialId' | undefined {
  const key = comparable(materialId);
  if (comparable(profile.waterMaterialId) === key) return 'waterMaterialId';
  if (comparable(profile.plasterMaterialId) === key) return 'plasterMaterialId';
  if (comparable(profile.glueMaterialId) === key) return 'glueMaterialId';
  return undefined;
}

export class PlasterMoldYieldProfileService
  implements PlasterMoldYieldProfileRelationshipGuard
{
  constructor(
    private readonly repository: PlasterMoldYieldProfileRepository,
    private readonly molds: MoldRepository,
    private readonly materials: MaterialRepository,
  ) {}

  async createProfile(
    input: PlasterMoldYieldProfile,
  ): Promise<PlasterMoldYieldProfile> {
    let candidate = normalizePlasterMoldYieldProfile(input);
    validatePlasterMoldYieldProfileContract(candidate);

    const all = await this.repository.list();
    this.assertUniqueId(candidate, all);
    candidate = await this.canonicalizeReferences(candidate);
    await this.assertReferences(candidate, [...all, candidate]);

    await this.repository.insert(candidate);
    return clonePlasterMoldYieldProfile(candidate);
  }

  async updateProfile(
    id: string,
    changes: PlasterMoldYieldProfileUpdate,
  ): Promise<PlasterMoldYieldProfile> {
    const existing = await this.requireProfile(id);
    let candidate = normalizePlasterMoldYieldProfile({
      ...existing,
      ...changes,
      id: existing.id,
    });
    validatePlasterMoldYieldProfileContract(candidate);

    const all = await this.repository.list();
    candidate = await this.canonicalizeReferences(candidate);
    const currentKey = comparable(existing.id);
    const proposed = all.map((profile) =>
      comparable(profile.id) === currentKey ? candidate : profile,
    );
    await this.assertReferences(candidate, proposed);

    await this.repository.replace(candidate);
    return clonePlasterMoldYieldProfile(candidate);
  }

  async getProfile(id: string): Promise<PlasterMoldYieldProfile | null> {
    const profile = await this.repository.findById(id);
    return profile ? clonePlasterMoldYieldProfile(profile) : null;
  }

  async listProfiles(
    filter: PlasterMoldYieldProfileListFilter = {},
  ): Promise<PlasterMoldYieldProfile[]> {
    const profiles = await this.repository.list();

    return profiles
      .filter(
        (profile) =>
          filter.moldId === undefined ||
          comparable(profile.moldId) === comparable(filter.moldId),
      )
      .filter(
        (profile) =>
          filter.waterMaterialId === undefined ||
          comparable(profile.waterMaterialId) === comparable(filter.waterMaterialId),
      )
      .filter(
        (profile) =>
          filter.plasterMaterialId === undefined ||
          comparable(profile.plasterMaterialId) === comparable(filter.plasterMaterialId),
      )
      .filter(
        (profile) =>
          filter.glueMaterialId === undefined ||
          comparable(profile.glueMaterialId) === comparable(filter.glueMaterialId),
      )
      .filter(
        (profile) =>
          filter.active === undefined || profile.isActive === filter.active,
      )
      .filter(
        (profile) =>
          filter.query === undefined || matchesQuery(profile, filter.query),
      )
      .sort((left, right) => {
        const byMold = compareText(left.moldId, right.moldId);
        if (byMold) return byMold;
        if (left.isActive !== right.isActive) return left.isActive ? -1 : 1;
        return compareText(left.id, right.id);
      })
      .map(clonePlasterMoldYieldProfile);
  }

  async getActiveProfileForMold(
    moldId: string,
  ): Promise<PlasterMoldYieldProfile | null> {
    const profiles = await this.listProfiles({ moldId, active: true });
    return profiles[0] ?? null;
  }

  async archiveProfile(id: string): Promise<PlasterMoldYieldProfile> {
    const existing = await this.requireProfile(id);
    if (!existing.isActive) return clonePlasterMoldYieldProfile(existing);

    const archived = normalizePlasterMoldYieldProfile({
      ...existing,
      isActive: false,
    });
    validatePlasterMoldYieldProfileContract(archived);
    await this.repository.replace(archived);
    return clonePlasterMoldYieldProfile(archived);
  }

  async restoreProfile(id: string): Promise<PlasterMoldYieldProfile> {
    const existing = await this.requireProfile(id);
    if (existing.isActive) return clonePlasterMoldYieldProfile(existing);
    return this.updateProfile(existing.id, { isActive: true });
  }

  async assertMoldCanArchive(moldId: string): Promise<void> {
    const active = (await this.repository.list()).find(
      (profile) =>
        profile.isActive && comparable(profile.moldId) === comparable(moldId),
    );
    if (!active) return;

    throw new PlasterMoldYieldProfileApplicationError(
      'MOLD_IN_USE_BY_ACTIVE_PROFILE',
      `Mold ${moldId.trim()} cannot be archived because active plaster mold yield profile ${active.id} depends on it.`,
      { profileId: active.id, moldId: moldId.trim(), field: 'moldId' },
    );
  }

  async assertMaterialCanArchive(materialId: string): Promise<void> {
    const active = (await this.repository.list()).find(
      (profile) =>
        profile.isActive && materialRoleForId(profile, materialId) !== undefined,
    );
    if (!active) return;

    const field = materialRoleForId(active, materialId);
    throw new PlasterMoldYieldProfileApplicationError(
      'MATERIAL_IN_USE_BY_ACTIVE_PROFILE',
      `Material ${materialId.trim()} cannot be archived because active plaster mold yield profile ${active.id} depends on it.`,
      {
        profileId: active.id,
        moldId: active.moldId,
        materialId: materialId.trim(),
        field,
      },
    );
  }

  async assertMaterialUpdatePreservesActiveProfiles(
    material: Material,
  ): Promise<void> {
    const active = (await this.repository.list()).find(
      (profile) =>
        profile.isActive && materialRoleForId(profile, material.id) !== undefined,
    );
    if (!active) return;

    if (!material.isActive) {
      await this.assertMaterialCanArchive(material.id);
      return;
    }

    if (material.baseUnit !== 'g') {
      throw new PlasterMoldYieldProfileApplicationError(
        'ACTIVE_PROFILE_REQUIRES_WEIGHT_MATERIAL',
        `Material ${material.id} must keep base unit g while active plaster mold yield profile ${active.id} depends on it.`,
        {
          profileId: active.id,
          moldId: active.moldId,
          materialId: material.id,
          field: materialRoleForId(active, material.id),
        },
      );
    }
  }

  private async requireProfile(id: string): Promise<PlasterMoldYieldProfile> {
    const profile = await this.repository.findById(id);
    if (!profile) {
      throw new PlasterMoldYieldProfileApplicationError(
        'PROFILE_NOT_FOUND',
        `Plaster mold yield profile not found: ${id.trim()}.`,
        { profileId: id.trim() },
      );
    }
    return profile;
  }

  private assertUniqueId(
    candidate: PlasterMoldYieldProfile,
    all: readonly PlasterMoldYieldProfile[],
  ): void {
    if (all.some((profile) => comparable(profile.id) === comparable(candidate.id))) {
      throw new PlasterMoldYieldProfileApplicationError(
        'DUPLICATE_PROFILE_ID',
        `Plaster mold yield profile ID already exists: ${candidate.id}.`,
        { profileId: candidate.id, moldId: candidate.moldId },
      );
    }
  }

  private async canonicalizeReferences(
    profile: PlasterMoldYieldProfile,
  ): Promise<PlasterMoldYieldProfile> {
    const [mold, water, plaster, glue] = await Promise.all([
      this.molds.findById(profile.moldId),
      this.materials.findById(profile.waterMaterialId),
      this.materials.findById(profile.plasterMaterialId),
      this.materials.findById(profile.glueMaterialId),
    ]);

    return normalizePlasterMoldYieldProfile({
      ...profile,
      moldId: mold?.id ?? profile.moldId,
      waterMaterialId: water?.id ?? profile.waterMaterialId,
      plasterMaterialId: plaster?.id ?? profile.plasterMaterialId,
      glueMaterialId: glue?.id ?? profile.glueMaterialId,
    });
  }

  private async assertReferences(
    candidate: PlasterMoldYieldProfile,
    proposedProfiles: readonly PlasterMoldYieldProfile[],
  ): Promise<void> {
    const [molds, materials] = await Promise.all([
      this.molds.list(),
      this.materials.list(),
    ]);

    const result = validatePlasterMoldYieldProfileReferences({
      profiles: proposedProfiles,
      molds,
      materials,
    });

    if (result.valid) return;

    const candidateKey = comparable(candidate.id);
    const issue =
      result.issues.find(
        (item) => comparable(item.profileId) === candidateKey,
      ) ?? result.issues[0];

    throw new PlasterMoldYieldProfileApplicationError(
      issue.code,
      issue.message,
      {
        profileId: issue.profileId,
        moldId: issue.moldId,
        field: issue.field,
        materialId:
          issue.field === 'waterMaterialId'
            ? candidate.waterMaterialId
            : issue.field === 'plasterMaterialId'
              ? candidate.plasterMaterialId
              : issue.field === 'glueMaterialId'
                ? candidate.glueMaterialId
                : undefined,
      },
    );
  }
}
