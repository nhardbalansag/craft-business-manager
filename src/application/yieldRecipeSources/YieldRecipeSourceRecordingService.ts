import {
  cloneYieldMoldFormulaSource,
  toMoldFormulaYieldRecipeSourceReference,
  type YieldMoldFormulaSource,
} from '../../domain/yieldMoldFormulaSource';
import {
  resolveYieldRecipeSource,
  type ResolvedYieldRecipeSource,
} from '../../domain/yieldRecipeSource';
import {
  cloneYieldSample,
  YieldSampleContractError,
  type YieldSample,
} from '../../domain/yieldSamples';
import type { YieldSampleEvidenceService } from '../yieldSamples/YieldSampleEvidenceService';
import type { YieldSampleRepository } from '../yieldSamples/YieldSampleRepository';
import type { YieldMoldFormulaSourceRepository } from '../yieldMoldFormulaSources/YieldMoldFormulaSourceRepository';
import type { YieldMoldFormulaSourceService } from '../yieldMoldFormulaSources/YieldMoldFormulaSourceService';

export type YieldRecipeSourceRecordingSelection =
  | { kind: 'manual' }
  | {
      kind: 'mix-preset';
      mixPresetId: string;
    }
  | {
      kind: 'mold-formula';
      moldId: string;
      moldYieldProfileId: string;
    };

export interface YieldRecipeSourceRecordingInput {
  sample: Omit<YieldSample, 'mixPresetId'>;
  source: YieldRecipeSourceRecordingSelection;
}

export interface YieldRecipeSourceRecordingResult {
  sample: YieldSample;
  recipeSource: ResolvedYieldRecipeSource;
  moldFormulaSource?: YieldMoldFormulaSource;
}

export type YieldRecipeSourceRecordingErrorCode =
  | 'APPLY_FAILED_RESTORED'
  | 'ROLLBACK_FAILED';

export class YieldRecipeSourceRecordingError extends Error {
  readonly code: YieldRecipeSourceRecordingErrorCode;
  readonly sampleId: string;
  readonly operationCause: unknown;
  readonly rollbackCause?: unknown;

  constructor(
    code: YieldRecipeSourceRecordingErrorCode,
    message: string,
    context: {
      sampleId: string;
      operationCause: unknown;
      rollbackCause?: unknown;
    },
  ) {
    super(message);
    this.name = 'YieldRecipeSourceRecordingError';
    this.code = code;
    this.sampleId = context.sampleId;
    this.operationCause = context.operationCause;
    this.rollbackCause = context.rollbackCause;
  }
}

function composeYieldSample(
  input: YieldRecipeSourceRecordingInput,
): YieldSample {
  const {
    mixPresetId: _unexpectedMixPresetId,
    ...sampleWithoutPreset
  } = input.sample as YieldSample;

  if (input.source.kind === 'mix-preset') {
    if (!input.source.mixPresetId.trim()) {
      throw new YieldSampleContractError(
        'INVALID_MIX_PRESET_ID',
        'Mix preset recipe source requires a nonblank Mix preset ID.',
        input.source.mixPresetId,
      );
    }

    return {
      ...sampleWithoutPreset,
      mixPresetId: input.source.mixPresetId,
    };
  }

  return sampleWithoutPreset;
}

/**
 * Coordinated YRS recording boundary.
 *
 * Manual and Mix preset sources use only the existing YieldSample source.
 * Mold Formula recording preflights both source records before writing, then
 * applies YieldSample → provenance in dependency order. Any write failure
 * triggers compensating deletion of both newly reserved identities.
 *
 * The existing YieldSampleEvidenceService.recordSample(...) remains available
 * for backward compatibility until the Yield UI moves to this coordinator.
 */
export class YieldRecipeSourceRecordingService {
  constructor(
    private readonly yieldEvidence: YieldSampleEvidenceService,
    private readonly provenance: YieldMoldFormulaSourceService,
    private readonly yieldSamples: YieldSampleRepository,
    private readonly moldFormulaSources: YieldMoldFormulaSourceRepository,
  ) {}

  async record(
    input: YieldRecipeSourceRecordingInput,
  ): Promise<YieldRecipeSourceRecordingResult> {
    const preparedSample =
      await this.yieldEvidence.prepareSampleForRecording(
        composeYieldSample(input),
      );

    let preparedSource: YieldMoldFormulaSource | undefined;

    if (input.source.kind === 'mold-formula') {
      preparedSource =
        await this.provenance.prepareSourceForPendingYieldSample(
          {
            moldId: input.source.moldId,
            moldYieldProfileId: input.source.moldYieldProfileId,
          },
          preparedSample,
        );
    }

    try {
      await this.yieldSamples.insert(preparedSample);
      if (preparedSource) {
        await this.moldFormulaSources.insert(preparedSource);
      }
    } catch (operationCause) {
      await this.rollback(
        preparedSample.id,
        operationCause,
      );
    }

    if (preparedSource) {
      return {
        sample: cloneYieldSample(preparedSample),
        recipeSource: resolveYieldRecipeSource(
          preparedSample,
          toMoldFormulaYieldRecipeSourceReference(preparedSource),
        ),
        moldFormulaSource:
          cloneYieldMoldFormulaSource(preparedSource),
      };
    }

    return {
      sample: cloneYieldSample(preparedSample),
      recipeSource: resolveYieldRecipeSource(preparedSample),
    };
  }

  private async rollback(
    sampleId: string,
    operationCause: unknown,
  ): Promise<never> {
    const rollbackFailures: unknown[] = [];

    try {
      await this.moldFormulaSources.delete(sampleId);
    } catch (error) {
      rollbackFailures.push(error);
    }

    try {
      await this.yieldSamples.delete(sampleId);
    } catch (error) {
      rollbackFailures.push(error);
    }

    if (rollbackFailures.length > 0) {
      throw new YieldRecipeSourceRecordingError(
        'ROLLBACK_FAILED',
        `Yield recipe-source recording failed and rollback could not fully clear sample ${sampleId}.`,
        {
          sampleId,
          operationCause,
          rollbackCause:
            rollbackFailures.length === 1
              ? rollbackFailures[0]
              : rollbackFailures,
        },
      );
    }

    throw new YieldRecipeSourceRecordingError(
      'APPLY_FAILED_RESTORED',
      `Yield recipe-source recording failed; partial state for sample ${sampleId} was rolled back.`,
      {
        sampleId,
        operationCause,
      },
    );
  }
}
