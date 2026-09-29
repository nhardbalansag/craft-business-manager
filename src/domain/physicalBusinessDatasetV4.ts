import {
  clonePhysicalBusinessDatasetV3,
  validatePhysicalBusinessDatasetV3Integrity,
  type PhysicalBusinessDatasetV3,
} from './physicalBusinessDatasetV3';
import {
  clonePlasterMoldYieldProfile,
  validatePlasterMoldYieldProfileContract,
  type PlasterMoldYieldProfile,
} from './plasterMoldYieldProfiles';
import { validatePlasterMoldYieldProfileReferences } from './plasterMoldYieldProfileValidation';

export const PHYSICAL_BUSINESS_DATASET_V4_SCHEMA_VERSION = 4 as const;

export interface PhysicalBusinessDatasetV4
  extends Omit<PhysicalBusinessDatasetV3, 'schemaVersion'> {
  schemaVersion: typeof PHYSICAL_BUSINESS_DATASET_V4_SCHEMA_VERSION;
  plasterMoldYieldProfiles: PlasterMoldYieldProfile[];
}

export interface PhysicalBusinessDatasetV4ValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface PhysicalBusinessDatasetV4ValidationResult {
  valid: boolean;
  issues: readonly PhysicalBusinessDatasetV4ValidationIssue[];
}

function canonical(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function toPhysicalBusinessDatasetV3(
  dataset: PhysicalBusinessDatasetV4,
): PhysicalBusinessDatasetV3 {
  return clonePhysicalBusinessDatasetV3({
    ...dataset,
    schemaVersion: 3,
  });
}

export function extendPhysicalBusinessDatasetV3(
  dataset: PhysicalBusinessDatasetV3,
  plasterMoldYieldProfiles: readonly PlasterMoldYieldProfile[] = [],
): PhysicalBusinessDatasetV4 {
  const base = clonePhysicalBusinessDatasetV3(dataset);
  return {
    ...base,
    schemaVersion: PHYSICAL_BUSINESS_DATASET_V4_SCHEMA_VERSION,
    plasterMoldYieldProfiles: plasterMoldYieldProfiles.map(
      clonePlasterMoldYieldProfile,
    ),
  };
}

export function clonePhysicalBusinessDatasetV4(
  dataset: PhysicalBusinessDatasetV4,
): PhysicalBusinessDatasetV4 {
  return extendPhysicalBusinessDatasetV3(
    toPhysicalBusinessDatasetV3(dataset),
    dataset.plasterMoldYieldProfiles,
  );
}

export function validatePhysicalBusinessDatasetV4Integrity(
  input: unknown,
): PhysicalBusinessDatasetV4ValidationResult {
  if (
    typeof input !== 'object' ||
    input === null ||
    !Array.isArray(
      (input as Partial<PhysicalBusinessDatasetV4>).plasterMoldYieldProfiles,
    )
  ) {
    return {
      valid: false,
      issues: [
        {
          code: 'INVALID_DATASET',
          path: '$',
          message:
            'Physical business dataset v4 must include a plasterMoldYieldProfiles array.',
        },
      ],
    };
  }

  const dataset = input as PhysicalBusinessDatasetV4;
  if (
    dataset.schemaVersion !== PHYSICAL_BUSINESS_DATASET_V4_SCHEMA_VERSION
  ) {
    return {
      valid: false,
      issues: [
        {
          code: 'UNSUPPORTED_SCHEMA_VERSION',
          path: 'schemaVersion',
          message:
            `Physical business dataset schema version must be ${PHYSICAL_BUSINESS_DATASET_V4_SCHEMA_VERSION}.`,
        },
      ],
    };
  }

  const base = validatePhysicalBusinessDatasetV3Integrity({
    ...dataset,
    schemaVersion: 3,
  });
  const issues: PhysicalBusinessDatasetV4ValidationIssue[] =
    base.issues.map((issue) => ({ ...issue }));

  const firstProfileById = new Map<string, number>();

  dataset.plasterMoldYieldProfiles.forEach((profile, index) => {
    try {
      validatePlasterMoldYieldProfileContract(profile);
    } catch (error) {
      issues.push({
        code:
          error instanceof Error &&
          typeof (error as Error & { code?: unknown }).code === 'string'
            ? (error as Error & { code: string }).code
            : 'INVALID_PROFILE',
        path: `plasterMoldYieldProfiles[${index}]`,
        message:
          error instanceof Error
            ? error.message
            : 'Invalid plaster mold yield profile.',
      });
    }

    if (typeof profile?.id !== 'string' || !profile.id.trim()) return;
    const key = canonical(profile.id);
    const first = firstProfileById.get(key);
    if (first === undefined) {
      firstProfileById.set(key, index);
      return;
    }

    issues.push({
      code: 'DUPLICATE_IDENTITY',
      path: `plasterMoldYieldProfiles[${index}].id`,
      message:
        `Plaster mold yield profile ID duplicates plasterMoldYieldProfiles[${first}].id.`,
    });
  });

  const references = validatePlasterMoldYieldProfileReferences({
    profiles: dataset.plasterMoldYieldProfiles,
    molds: dataset.molds,
    materials: dataset.materials,
  });

  issues.push(
    ...references.issues.map((issue) => ({
      code: issue.code,
      path: issue.path,
      message: issue.message,
    })),
  );

  return {
    valid: issues.length === 0,
    issues,
  };
}
