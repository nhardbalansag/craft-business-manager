import type { Material } from './materials';
import type { Mold } from './molds';
import type { PlasterMoldYieldProfile } from './plasterMoldYieldProfiles';

export type PlasterMoldYieldProfileReferenceIssueCode =
  | 'MISSING_MOLD_REFERENCE'
  | 'MISSING_WATER_MATERIAL_REFERENCE'
  | 'MISSING_PLASTER_MATERIAL_REFERENCE'
  | 'MISSING_GLUE_MATERIAL_REFERENCE'
  | 'DUPLICATE_MATERIAL_ROLE'
  | 'MOLD_INACTIVE'
  | 'WATER_MATERIAL_INACTIVE'
  | 'PLASTER_MATERIAL_INACTIVE'
  | 'GLUE_MATERIAL_INACTIVE'
  | 'WATER_MATERIAL_NOT_WEIGHT_COMPATIBLE'
  | 'PLASTER_MATERIAL_NOT_WEIGHT_COMPATIBLE'
  | 'GLUE_MATERIAL_NOT_WEIGHT_COMPATIBLE'
  | 'MULTIPLE_ACTIVE_PROFILES_FOR_MOLD';

export interface PlasterMoldYieldProfileReferenceIssue {
  code: PlasterMoldYieldProfileReferenceIssueCode;
  profileIndex: number;
  profileId: string;
  moldId: string;
  field: 'moldId' | 'waterMaterialId' | 'plasterMaterialId' | 'glueMaterialId';
  path: string;
  message: string;
}

export interface PlasterMoldYieldProfileReferenceValidationResult {
  valid: boolean;
  issues: readonly PlasterMoldYieldProfileReferenceIssue[];
}

function canonical(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function pathFor(
  profileIndex: number,
  field: PlasterMoldYieldProfileReferenceIssue['field'],
): string {
  return `plasterMoldYieldProfiles[${profileIndex}].${field}`;
}

function profileContext(
  profile: PlasterMoldYieldProfile,
  profileIndex: number,
  field: PlasterMoldYieldProfileReferenceIssue['field'],
) {
  return {
    profileIndex,
    profileId: profile.id,
    moldId: profile.moldId,
    field,
    path: pathFor(profileIndex, field),
  };
}

function byCanonicalId<T extends { id: string }>(rows: readonly T[]): Map<string, T> {
  const result = new Map<string, T>();

  for (const row of rows) {
    const key = canonical(row.id);
    if (key && !result.has(key)) result.set(key, row);
  }

  return result;
}

function addMissingReference(
  issues: PlasterMoldYieldProfileReferenceIssue[],
  profile: PlasterMoldYieldProfile,
  profileIndex: number,
  field: 'moldId' | 'waterMaterialId' | 'plasterMaterialId' | 'glueMaterialId',
  code: Extract<
    PlasterMoldYieldProfileReferenceIssueCode,
    | 'MISSING_MOLD_REFERENCE'
    | 'MISSING_WATER_MATERIAL_REFERENCE'
    | 'MISSING_PLASTER_MATERIAL_REFERENCE'
    | 'MISSING_GLUE_MATERIAL_REFERENCE'
  >,
  label: string,
  referencedId: string,
): void {
  issues.push({
    code,
    ...profileContext(profile, profileIndex, field),
    message: `Referenced ${label} does not exist: ${referencedId.trim()}.`,
  });
}

function addInactiveReference(
  issues: PlasterMoldYieldProfileReferenceIssue[],
  profile: PlasterMoldYieldProfile,
  profileIndex: number,
  field: 'moldId' | 'waterMaterialId' | 'plasterMaterialId' | 'glueMaterialId',
  code: Extract<
    PlasterMoldYieldProfileReferenceIssueCode,
    | 'MOLD_INACTIVE'
    | 'WATER_MATERIAL_INACTIVE'
    | 'PLASTER_MATERIAL_INACTIVE'
    | 'GLUE_MATERIAL_INACTIVE'
  >,
  label: string,
  referencedId: string,
): void {
  issues.push({
    code,
    ...profileContext(profile, profileIndex, field),
    message: `Active plaster mold yield profile cannot reference archived ${label}: ${referencedId.trim()}.`,
  });
}

function addNonWeightMaterial(
  issues: PlasterMoldYieldProfileReferenceIssue[],
  profile: PlasterMoldYieldProfile,
  profileIndex: number,
  field: 'waterMaterialId' | 'plasterMaterialId' | 'glueMaterialId',
  code: Extract<
    PlasterMoldYieldProfileReferenceIssueCode,
    | 'WATER_MATERIAL_NOT_WEIGHT_COMPATIBLE'
    | 'PLASTER_MATERIAL_NOT_WEIGHT_COMPATIBLE'
    | 'GLUE_MATERIAL_NOT_WEIGHT_COMPATIBLE'
  >,
  roleLabel: string,
  material: Material,
): void {
  issues.push({
    code,
    ...profileContext(profile, profileIndex, field),
    message:
      `${roleLabel} Material ${material.id} must use weight-compatible base unit g; ` +
      `received ${material.baseUnit}.`,
  });
}

/**
 * Validates MY1C cross-source rules for plaster mold yield profiles.
 *
 * This function deliberately does not change persistence schemas. It expects MY1B
 * intrinsic profile validation to be applied separately and focuses only on
 * Mold/Material relationships and collection-level active-profile uniqueness.
 */
export function validatePlasterMoldYieldProfileReferences(input: {
  profiles: readonly PlasterMoldYieldProfile[];
  molds: readonly Mold[];
  materials: readonly Material[];
}): PlasterMoldYieldProfileReferenceValidationResult {
  const issues: PlasterMoldYieldProfileReferenceIssue[] = [];
  const moldsById = byCanonicalId(input.molds);
  const materialsById = byCanonicalId(input.materials);
  const firstActiveProfileByMold = new Map<string, number>();

  for (let profileIndex = 0; profileIndex < input.profiles.length; profileIndex += 1) {
    const profile = input.profiles[profileIndex];
    const moldKey = canonical(profile.moldId);
    const waterKey = canonical(profile.waterMaterialId);
    const plasterKey = canonical(profile.plasterMaterialId);
    const glueKey = canonical(profile.glueMaterialId);

    const mold = moldKey ? moldsById.get(moldKey) : undefined;
    if (moldKey && !mold) {
      addMissingReference(
        issues,
        profile,
        profileIndex,
        'moldId',
        'MISSING_MOLD_REFERENCE',
        'Mold',
        profile.moldId,
      );
    } else if (profile.isActive && mold && !mold.isActive) {
      addInactiveReference(
        issues,
        profile,
        profileIndex,
        'moldId',
        'MOLD_INACTIVE',
        'Mold',
        mold.id,
      );
    }

    const waterMaterial = waterKey ? materialsById.get(waterKey) : undefined;
    if (waterKey && !waterMaterial) {
      addMissingReference(
        issues,
        profile,
        profileIndex,
        'waterMaterialId',
        'MISSING_WATER_MATERIAL_REFERENCE',
        'Water Material',
        profile.waterMaterialId,
      );
    } else if (waterMaterial) {
      if (profile.isActive && !waterMaterial.isActive) {
        addInactiveReference(
          issues,
          profile,
          profileIndex,
          'waterMaterialId',
          'WATER_MATERIAL_INACTIVE',
          'Water Material',
          waterMaterial.id,
        );
      }
      if (waterMaterial.baseUnit !== 'g') {
        addNonWeightMaterial(
          issues,
          profile,
          profileIndex,
          'waterMaterialId',
          'WATER_MATERIAL_NOT_WEIGHT_COMPATIBLE',
          'Water',
          waterMaterial,
        );
      }
    }

    const plasterMaterial = plasterKey ? materialsById.get(plasterKey) : undefined;
    if (plasterKey && !plasterMaterial) {
      addMissingReference(
        issues,
        profile,
        profileIndex,
        'plasterMaterialId',
        'MISSING_PLASTER_MATERIAL_REFERENCE',
        'Plaster Material',
        profile.plasterMaterialId,
      );
    } else if (plasterMaterial) {
      if (profile.isActive && !plasterMaterial.isActive) {
        addInactiveReference(
          issues,
          profile,
          profileIndex,
          'plasterMaterialId',
          'PLASTER_MATERIAL_INACTIVE',
          'Plaster Material',
          plasterMaterial.id,
        );
      }
      if (plasterMaterial.baseUnit !== 'g') {
        addNonWeightMaterial(
          issues,
          profile,
          profileIndex,
          'plasterMaterialId',
          'PLASTER_MATERIAL_NOT_WEIGHT_COMPATIBLE',
          'Plaster',
          plasterMaterial,
        );
      }
    }

    const glueMaterial = glueKey ? materialsById.get(glueKey) : undefined;
    if (glueKey && !glueMaterial) {
      addMissingReference(
        issues,
        profile,
        profileIndex,
        'glueMaterialId',
        'MISSING_GLUE_MATERIAL_REFERENCE',
        'Glue Material',
        profile.glueMaterialId,
      );
    } else if (glueMaterial) {
      if (profile.isActive && !glueMaterial.isActive) {
        addInactiveReference(
          issues,
          profile,
          profileIndex,
          'glueMaterialId',
          'GLUE_MATERIAL_INACTIVE',
          'Glue Material',
          glueMaterial.id,
        );
      }
      if (glueMaterial.baseUnit !== 'g') {
        addNonWeightMaterial(
          issues,
          profile,
          profileIndex,
          'glueMaterialId',
          'GLUE_MATERIAL_NOT_WEIGHT_COMPATIBLE',
          'Glue',
          glueMaterial,
        );
      }
    }

    if (waterKey && plasterKey && waterKey === plasterKey) {
      issues.push({
        code: 'DUPLICATE_MATERIAL_ROLE',
        ...profileContext(profile, profileIndex, 'plasterMaterialId'),
        message:
          'Water, Plaster, and Glue Material references must use distinct Material IDs.',
      });
    }

    if (glueKey && ((waterKey && glueKey === waterKey) || (plasterKey && glueKey === plasterKey))) {
      issues.push({
        code: 'DUPLICATE_MATERIAL_ROLE',
        ...profileContext(profile, profileIndex, 'glueMaterialId'),
        message:
          'Water, Plaster, and Glue Material references must use distinct Material IDs.',
      });
    }

    if (profile.isActive && moldKey) {
      const firstIndex = firstActiveProfileByMold.get(moldKey);
      if (firstIndex === undefined) {
        firstActiveProfileByMold.set(moldKey, profileIndex);
      } else {
        issues.push({
          code: 'MULTIPLE_ACTIVE_PROFILES_FOR_MOLD',
          ...profileContext(profile, profileIndex, 'moldId'),
          message:
            `Only one active PlasterMoldYieldProfile is allowed per Mold; ` +
            `this profile conflicts with plasterMoldYieldProfiles[${firstIndex}].moldId.`,
        });
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
