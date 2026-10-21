import type { MoldFormulaYieldRecipeSourceReference } from './yieldRecipeSource';

/**
 * Authoritative physical-domain provenance for a saved Yield Sample that began
 * from a configured Plaster Mold Formula.
 *
 * The YieldSample remains the actual measured production evidence. This source
 * stores only which physical Mold and saved formula profile were used as the
 * starting recipe reference. Formula quantities, requested pieces, pours,
 * capacity, cost, and other derived values are intentionally not persisted here.
 *
 * One-record-per-Yield-sample identity and all cross-record reference rules are
 * deliberately validated in YRS1C.
 */
export interface YieldMoldFormulaSource {
  yieldSampleId: string;
  moldId: string;
  moldYieldProfileId: string;
}

export type YieldMoldFormulaSourceErrorCode =
  | 'INVALID_YIELD_SAMPLE_ID'
  | 'INVALID_MOLD_ID'
  | 'INVALID_MOLD_YIELD_PROFILE_ID';

export class YieldMoldFormulaSourceError extends Error {
  readonly code: YieldMoldFormulaSourceErrorCode;
  readonly yieldSampleId?: string;
  readonly moldId?: string;
  readonly moldYieldProfileId?: string;
  readonly input?: unknown;

  constructor(
    code: YieldMoldFormulaSourceErrorCode,
    message: string,
    context: {
      yieldSampleId?: string;
      moldId?: string;
      moldYieldProfileId?: string;
      input?: unknown;
    } = {},
  ) {
    super(message);
    this.name = 'YieldMoldFormulaSourceError';
    this.code = code;
    this.yieldSampleId = context.yieldSampleId;
    this.moldId = context.moldId;
    this.moldYieldProfileId = context.moldYieldProfileId;
    this.input = context.input;
  }
}

export function cloneYieldMoldFormulaSource(
  source: YieldMoldFormulaSource,
): YieldMoldFormulaSource {
  return { ...source };
}

/**
 * Trims source identifiers without rewriting their case or business identity.
 */
export function normalizeYieldMoldFormulaSource(
  source: YieldMoldFormulaSource,
): YieldMoldFormulaSource {
  return {
    yieldSampleId: source.yieldSampleId.trim(),
    moldId: source.moldId.trim(),
    moldYieldProfileId: source.moldYieldProfileId.trim(),
  };
}

/**
 * Validates intrinsic source shape only.
 *
 * Deliberately deferred to YRS1C:
 * - referenced Yield Sample existence;
 * - referenced Mold existence;
 * - referenced profile existence;
 * - Mold/Product ownership;
 * - profile/Mold ownership;
 * - MixPreset + Mold Formula exclusivity;
 * - one Mold Formula source per Yield Sample;
 * - active-at-recording / historical archive policy.
 */
export function validateYieldMoldFormulaSourceContract(
  source: YieldMoldFormulaSource,
): void {
  const context = {
    yieldSampleId: source.yieldSampleId,
    moldId: source.moldId,
    moldYieldProfileId: source.moldYieldProfileId,
  };

  if (!source.yieldSampleId.trim()) {
    throw new YieldMoldFormulaSourceError(
      'INVALID_YIELD_SAMPLE_ID',
      'Yield Mold Formula source requires a Yield Sample ID.',
      { ...context, input: source.yieldSampleId },
    );
  }

  if (!source.moldId.trim()) {
    throw new YieldMoldFormulaSourceError(
      'INVALID_MOLD_ID',
      'Yield Mold Formula source requires a Mold ID.',
      { ...context, input: source.moldId },
    );
  }

  if (!source.moldYieldProfileId.trim()) {
    throw new YieldMoldFormulaSourceError(
      'INVALID_MOLD_YIELD_PROFILE_ID',
      'Yield Mold Formula source requires a Mold yield profile ID.',
      { ...context, input: source.moldYieldProfileId },
    );
  }
}

/**
 * Adapts authoritative provenance to the YRS1A read-side resolver projection.
 */
export function toMoldFormulaYieldRecipeSourceReference(
  source: YieldMoldFormulaSource,
): MoldFormulaYieldRecipeSourceReference {
  const normalized = normalizeYieldMoldFormulaSource(source);
  return {
    moldId: normalized.moldId,
    moldYieldProfileId: normalized.moldYieldProfileId,
  };
}
