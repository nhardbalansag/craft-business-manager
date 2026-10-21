import {
  clonePhysicalBusinessDatasetV4,
  validatePhysicalBusinessDatasetV4Integrity,
  type PhysicalBusinessDatasetV4,
} from './physicalBusinessDatasetV4';
import {
  cloneYieldMoldFormulaSource,
  validateYieldMoldFormulaSourceContract,
  type YieldMoldFormulaSource,
} from './yieldMoldFormulaSource';
import { validateYieldMoldFormulaSourceReferences } from './yieldMoldFormulaSourceValidation';

export const PHYSICAL_BUSINESS_DATASET_V5_SCHEMA_VERSION = 5 as const;

export interface PhysicalBusinessDatasetV5
  extends Omit<PhysicalBusinessDatasetV4, 'schemaVersion'> {
  schemaVersion: typeof PHYSICAL_BUSINESS_DATASET_V5_SCHEMA_VERSION;
  yieldMoldFormulaSources: YieldMoldFormulaSource[];
}

export interface PhysicalBusinessDatasetV5ValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface PhysicalBusinessDatasetV5ValidationResult {
  valid: boolean;
  issues: readonly PhysicalBusinessDatasetV5ValidationIssue[];
}

export function toPhysicalBusinessDatasetV4(
  dataset: PhysicalBusinessDatasetV5,
): PhysicalBusinessDatasetV4 {
  return clonePhysicalBusinessDatasetV4({
    ...dataset,
    schemaVersion: 4,
  });
}

export function extendPhysicalBusinessDatasetV4(
  dataset: PhysicalBusinessDatasetV4,
  yieldMoldFormulaSources: readonly YieldMoldFormulaSource[] = [],
): PhysicalBusinessDatasetV5 {
  const base = clonePhysicalBusinessDatasetV4(dataset);

  return {
    ...base,
    schemaVersion: PHYSICAL_BUSINESS_DATASET_V5_SCHEMA_VERSION,
    yieldMoldFormulaSources:
      yieldMoldFormulaSources.map(cloneYieldMoldFormulaSource),
  };
}

export function clonePhysicalBusinessDatasetV5(
  dataset: PhysicalBusinessDatasetV5,
): PhysicalBusinessDatasetV5 {
  return extendPhysicalBusinessDatasetV4(
    toPhysicalBusinessDatasetV4(dataset),
    dataset.yieldMoldFormulaSources,
  );
}

/**
 * Validates the complete physical-v5 source graph.
 *
 * Yield Mold Formula provenance is historical source metadata. Dataset
 * validation therefore uses YRS1C historical mode: archived Mold/profile
 * references remain valid as long as all referenced records still exist and
 * their ownership/exclusivity relationships remain coherent.
 */
export function validatePhysicalBusinessDatasetV5Integrity(
  input: unknown,
): PhysicalBusinessDatasetV5ValidationResult {
  if (
    typeof input !== 'object' ||
    input === null ||
    !Array.isArray(
      (input as Partial<PhysicalBusinessDatasetV5>)
        .yieldMoldFormulaSources,
    )
  ) {
    return {
      valid: false,
      issues: [
        {
          code: 'INVALID_DATASET',
          path: '$',
          message:
            'Physical business dataset v5 must include a yieldMoldFormulaSources array.',
        },
      ],
    };
  }

  const dataset = input as PhysicalBusinessDatasetV5;

  if (
    dataset.schemaVersion !==
    PHYSICAL_BUSINESS_DATASET_V5_SCHEMA_VERSION
  ) {
    return {
      valid: false,
      issues: [
        {
          code: 'UNSUPPORTED_SCHEMA_VERSION',
          path: 'schemaVersion',
          message:
            `Physical business dataset schema version must be ${PHYSICAL_BUSINESS_DATASET_V5_SCHEMA_VERSION}.`,
        },
      ],
    };
  }

  const base = validatePhysicalBusinessDatasetV4Integrity({
    ...dataset,
    schemaVersion: 4,
  });

  const issues: PhysicalBusinessDatasetV5ValidationIssue[] =
    base.issues.map((issue) => ({ ...issue }));

  let allSourcesIntrinsicallyValid = true;

  dataset.yieldMoldFormulaSources.forEach((source, index) => {
    try {
      validateYieldMoldFormulaSourceContract(source);
    } catch (error) {
      allSourcesIntrinsicallyValid = false;
      issues.push({
        code:
          error instanceof Error &&
          typeof (error as Error & { code?: unknown }).code ===
            'string'
            ? (error as Error & { code: string }).code
            : 'INVALID_YIELD_MOLD_FORMULA_SOURCE',
        path: `yieldMoldFormulaSources[${index}]`,
        message:
          error instanceof Error
            ? error.message
            : 'Invalid Yield Mold Formula provenance source.',
      });
    }
  });

  if (allSourcesIntrinsicallyValid) {
    const references =
      validateYieldMoldFormulaSourceReferences({
        sources: dataset.yieldMoldFormulaSources,
        yieldSamples: dataset.yieldSamples,
        molds: dataset.molds,
        profiles: dataset.plasterMoldYieldProfiles,
        mode: 'historical',
      });

    issues.push(
      ...references.issues.map((issue) => ({
        code: issue.code,
        path: issue.path,
        message: issue.message,
      })),
    );
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
