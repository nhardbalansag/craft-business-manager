import type { YieldSample } from './yieldSamples';

export const YIELD_RECIPE_SOURCE_KINDS = [
  'manual',
  'mix-preset',
  'mold-formula',
] as const;

export type YieldRecipeSourceKind =
  (typeof YIELD_RECIPE_SOURCE_KINDS)[number];

export interface ManualYieldRecipeSource {
  kind: 'manual';
}

export interface MixPresetYieldRecipeSource {
  kind: 'mix-preset';
  mixPresetId: string;
}

/**
 * Read-side projection used by the YRS1A source resolver.
 *
 * This is intentionally not the authoritative persisted Mold Formula provenance
 * source record. YRS1B owns that source contract.
 */
export interface MoldFormulaYieldRecipeSourceReference {
  moldId: string;
  moldYieldProfileId: string;
}

export interface MoldFormulaYieldRecipeSource {
  kind: 'mold-formula';
  moldId: string;
  moldYieldProfileId: string;
}

export type ResolvedYieldRecipeSource =
  | ManualYieldRecipeSource
  | MixPresetYieldRecipeSource
  | MoldFormulaYieldRecipeSource;

export type YieldRecipeSourceResolutionErrorCode =
  | 'AMBIGUOUS_RECIPE_SOURCE'
  | 'INVALID_MOLD_ID'
  | 'INVALID_MOLD_YIELD_PROFILE_ID';

export class YieldRecipeSourceResolutionError extends Error {
  readonly code: YieldRecipeSourceResolutionErrorCode;
  readonly sampleId: string;
  readonly input?: unknown;

  constructor(
    code: YieldRecipeSourceResolutionErrorCode,
    message: string,
    context: {
      sampleId: string;
      input?: unknown;
    },
  ) {
    super(message);
    this.name = 'YieldRecipeSourceResolutionError';
    this.code = code;
    this.sampleId = context.sampleId;
    this.input = context.input;
  }
}

const YIELD_RECIPE_SOURCE_KIND_SET: ReadonlySet<string> = new Set(
  YIELD_RECIPE_SOURCE_KINDS,
);

export function isYieldRecipeSourceKind(
  value: unknown,
): value is YieldRecipeSourceKind {
  return (
    typeof value === 'string' &&
    YIELD_RECIPE_SOURCE_KIND_SET.has(value)
  );
}

export function cloneResolvedYieldRecipeSource(
  source: ResolvedYieldRecipeSource,
): ResolvedYieldRecipeSource {
  return { ...source };
}

/**
 * Resolves the user-facing recipe source for one persisted Yield Sample.
 *
 * Resolution rules:
 * - explicit Mold Formula provenance wins only when MixPreset provenance is absent;
 * - otherwise mixPresetId means Mix preset;
 * - otherwise the sample is Manual.
 *
 * An input carrying both MixPreset and Mold Formula provenance is rejected rather
 * than silently choosing one. Referential ownership of mold/profile IDs belongs to
 * YRS1C; this resolver validates only the minimum intrinsic shape it needs.
 */
export function resolveYieldRecipeSource(
  sample: Pick<YieldSample, 'id' | 'mixPresetId'>,
  moldFormulaReference?: MoldFormulaYieldRecipeSourceReference | null,
): ResolvedYieldRecipeSource {
  const sampleId = sample.id.trim();
  const mixPresetId = sample.mixPresetId?.trim() || undefined;

  if (moldFormulaReference !== undefined && moldFormulaReference !== null) {
    const moldId = moldFormulaReference.moldId.trim();
    const moldYieldProfileId =
      moldFormulaReference.moldYieldProfileId.trim();

    if (!moldId) {
      throw new YieldRecipeSourceResolutionError(
        'INVALID_MOLD_ID',
        'Mold Formula recipe source requires a nonblank Mold ID.',
        { sampleId, input: moldFormulaReference.moldId },
      );
    }

    if (!moldYieldProfileId) {
      throw new YieldRecipeSourceResolutionError(
        'INVALID_MOLD_YIELD_PROFILE_ID',
        'Mold Formula recipe source requires a nonblank Mold yield profile ID.',
        { sampleId, input: moldFormulaReference.moldYieldProfileId },
      );
    }

    if (mixPresetId !== undefined) {
      throw new YieldRecipeSourceResolutionError(
        'AMBIGUOUS_RECIPE_SOURCE',
        `Yield sample ${sampleId || '(blank ID)'} cannot resolve both Mix preset and Mold Formula provenance.`,
        {
          sampleId,
          input: {
            mixPresetId,
            moldId,
            moldYieldProfileId,
          },
        },
      );
    }

    return {
      kind: 'mold-formula',
      moldId,
      moldYieldProfileId,
    };
  }

  if (mixPresetId !== undefined) {
    return {
      kind: 'mix-preset',
      mixPresetId,
    };
  }

  return { kind: 'manual' };
}
