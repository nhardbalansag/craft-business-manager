import type { Mold } from './molds';
import type { PlasterMoldYieldProfile } from './plasterMoldYieldProfiles';
import type { YieldMoldFormulaSource } from './yieldMoldFormulaSource';
import type { YieldSample } from './yieldSamples';

export type YieldMoldFormulaSourceValidationMode =
  | 'historical'
  | 'recording';

export type YieldMoldFormulaSourceReferenceIssueCode =
  | 'MISSING_YIELD_SAMPLE_REFERENCE'
  | 'MISSING_MOLD_REFERENCE'
  | 'MISSING_MOLD_YIELD_PROFILE_REFERENCE'
  | 'MIX_PRESET_SOURCE_CONFLICT'
  | 'MOLD_PRODUCT_MISMATCH'
  | 'PROFILE_MOLD_MISMATCH'
  | 'DUPLICATE_YIELD_MOLD_FORMULA_SOURCE'
  | 'MOLD_INACTIVE_AT_RECORDING'
  | 'PROFILE_INACTIVE_AT_RECORDING';

export interface YieldMoldFormulaSourceReferenceIssue {
  code: YieldMoldFormulaSourceReferenceIssueCode;
  sourceIndex: number;
  yieldSampleId: string;
  moldId: string;
  moldYieldProfileId: string;
  field: 'yieldSampleId' | 'moldId' | 'moldYieldProfileId';
  path: string;
  message: string;
}

export interface YieldMoldFormulaSourceReferenceValidationResult {
  valid: boolean;
  issues: readonly YieldMoldFormulaSourceReferenceIssue[];
}

function canonical(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function pathFor(
  sourceIndex: number,
  field: YieldMoldFormulaSourceReferenceIssue['field'],
): string {
  return `yieldMoldFormulaSources[${sourceIndex}].${field}`;
}

function context(
  source: YieldMoldFormulaSource,
  sourceIndex: number,
  field: YieldMoldFormulaSourceReferenceIssue['field'],
) {
  return {
    sourceIndex,
    yieldSampleId: source.yieldSampleId,
    moldId: source.moldId,
    moldYieldProfileId: source.moldYieldProfileId,
    field,
    path: pathFor(sourceIndex, field),
  };
}

function byCanonicalId<T extends { id: string }>(
  rows: readonly T[],
): Map<string, T> {
  const result = new Map<string, T>();
  for (const row of rows) {
    const key = canonical(row.id);
    if (key && !result.has(key)) result.set(key, row);
  }
  return result;
}

/**
 * Validates YRS1C cross-source provenance rules.
 *
 * Intrinsic blank-field validation belongs to YRS1B and should be applied
 * separately. This validator intentionally skips missing-reference checks for
 * blank identifiers so callers do not receive duplicate diagnostics for the
 * same intrinsic failure.
 *
 * Historical mode is the persistence/import-safe default. Archived Mold/profile
 * references remain valid historical provenance.
 *
 * Recording mode additionally requires the referenced Mold and formula profile
 * to be active at the time the new Yield evidence is recorded.
 */
export function validateYieldMoldFormulaSourceReferences(input: {
  sources: readonly YieldMoldFormulaSource[];
  yieldSamples: readonly YieldSample[];
  molds: readonly Mold[];
  profiles: readonly PlasterMoldYieldProfile[];
  mode?: YieldMoldFormulaSourceValidationMode;
}): YieldMoldFormulaSourceReferenceValidationResult {
  const mode = input.mode ?? 'historical';
  const issues: YieldMoldFormulaSourceReferenceIssue[] = [];
  const yieldsById = byCanonicalId(input.yieldSamples);
  const moldsById = byCanonicalId(input.molds);
  const profilesById = byCanonicalId(input.profiles);
  const firstSourceByYield = new Map<string, number>();

  for (
    let sourceIndex = 0;
    sourceIndex < input.sources.length;
    sourceIndex += 1
  ) {
    const source = input.sources[sourceIndex];
    const yieldKey = canonical(source.yieldSampleId);
    const moldKey = canonical(source.moldId);
    const profileKey = canonical(source.moldYieldProfileId);

    if (yieldKey) {
      const firstIndex = firstSourceByYield.get(yieldKey);
      if (firstIndex === undefined) {
        firstSourceByYield.set(yieldKey, sourceIndex);
      } else {
        issues.push({
          code: 'DUPLICATE_YIELD_MOLD_FORMULA_SOURCE',
          ...context(source, sourceIndex, 'yieldSampleId'),
          message:
            `Only one Mold Formula provenance source is allowed per Yield Sample; ` +
            `this row conflicts with yieldMoldFormulaSources[${firstIndex}].yieldSampleId.`,
        });
      }
    }

    const yieldSample = yieldKey ? yieldsById.get(yieldKey) : undefined;
    if (yieldKey && !yieldSample) {
      issues.push({
        code: 'MISSING_YIELD_SAMPLE_REFERENCE',
        ...context(source, sourceIndex, 'yieldSampleId'),
        message:
          `Referenced Yield Sample does not exist: ${source.yieldSampleId.trim()}.`,
      });
    } else if (yieldSample?.mixPresetId?.trim()) {
      issues.push({
        code: 'MIX_PRESET_SOURCE_CONFLICT',
        ...context(source, sourceIndex, 'yieldSampleId'),
        message:
          `Yield Sample ${yieldSample.id} cannot claim both Mix preset ` +
          `provenance (${yieldSample.mixPresetId.trim()}) and Mold Formula provenance.`,
      });
    }

    const mold = moldKey ? moldsById.get(moldKey) : undefined;
    if (moldKey && !mold) {
      issues.push({
        code: 'MISSING_MOLD_REFERENCE',
        ...context(source, sourceIndex, 'moldId'),
        message: `Referenced Mold does not exist: ${source.moldId.trim()}.`,
      });
    } else if (mold && mode === 'recording' && !mold.isActive) {
      issues.push({
        code: 'MOLD_INACTIVE_AT_RECORDING',
        ...context(source, sourceIndex, 'moldId'),
        message:
          `New Mold Formula Yield provenance cannot use archived Mold ${mold.id}.`,
      });
    }

    const profile = profileKey ? profilesById.get(profileKey) : undefined;
    if (profileKey && !profile) {
      issues.push({
        code: 'MISSING_MOLD_YIELD_PROFILE_REFERENCE',
        ...context(source, sourceIndex, 'moldYieldProfileId'),
        message:
          `Referenced PlasterMoldYieldProfile does not exist: ` +
          `${source.moldYieldProfileId.trim()}.`,
      });
    } else if (profile && mode === 'recording' && !profile.isActive) {
      issues.push({
        code: 'PROFILE_INACTIVE_AT_RECORDING',
        ...context(source, sourceIndex, 'moldYieldProfileId'),
        message:
          `New Mold Formula Yield provenance cannot use archived profile ${profile.id}.`,
      });
    }

    if (
      yieldSample &&
      mold &&
      canonical(yieldSample.productId) !== canonical(mold.productId)
    ) {
      issues.push({
        code: 'MOLD_PRODUCT_MISMATCH',
        ...context(source, sourceIndex, 'moldId'),
        message:
          `Mold ${mold.id} belongs to Product ${mold.productId}, but Yield Sample ` +
          `${yieldSample.id} belongs to Product ${yieldSample.productId}.`,
      });
    }

    if (
      profile &&
      moldKey &&
      canonical(profile.moldId) !== moldKey
    ) {
      issues.push({
        code: 'PROFILE_MOLD_MISMATCH',
        ...context(source, sourceIndex, 'moldYieldProfileId'),
        message:
          `PlasterMoldYieldProfile ${profile.id} belongs to Mold ${profile.moldId}, ` +
          `not provenance Mold ${source.moldId.trim()}.`,
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
