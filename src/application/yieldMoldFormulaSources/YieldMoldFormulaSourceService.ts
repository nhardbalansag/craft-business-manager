import {
  cloneYieldMoldFormulaSource,
  normalizeYieldMoldFormulaSource,
  validateYieldMoldFormulaSourceContract,
  toMoldFormulaYieldRecipeSourceReference,
  type YieldMoldFormulaSource,
} from '../../domain/yieldMoldFormulaSource';
import {
  type YieldMoldFormulaSourceReferenceIssue,
  type YieldMoldFormulaSourceReferenceIssueCode,
  validateYieldMoldFormulaSourceReferences,
} from '../../domain/yieldMoldFormulaSourceValidation';
import {
  resolveYieldRecipeSource,
  type ResolvedYieldRecipeSource,
} from '../../domain/yieldRecipeSource';
import type { MoldRepository } from '../molds/MoldRepository';
import type { PlasterMoldYieldProfileRepository } from '../plasterMoldYieldProfiles/PlasterMoldYieldProfileRepository';
import type { YieldSampleRepository } from '../yieldSamples/YieldSampleRepository';
import type { YieldMoldFormulaSourceRepository } from './YieldMoldFormulaSourceRepository';

export interface YieldMoldFormulaSourceListFilter {
  yieldSampleId?: string;
  moldId?: string;
  moldYieldProfileId?: string;
}

export type YieldMoldFormulaSourceApplicationErrorCode =
  | 'SOURCE_ALREADY_EXISTS'
  | 'YIELD_SAMPLE_NOT_FOUND'
  | YieldMoldFormulaSourceReferenceIssueCode;

export class YieldMoldFormulaSourceApplicationError extends Error {
  readonly code: YieldMoldFormulaSourceApplicationErrorCode;
  readonly yieldSampleId?: string;
  readonly moldId?: string;
  readonly moldYieldProfileId?: string;
  readonly field?: YieldMoldFormulaSourceReferenceIssue['field'];

  constructor(
    code: YieldMoldFormulaSourceApplicationErrorCode,
    message: string,
    context: {
      yieldSampleId?: string;
      moldId?: string;
      moldYieldProfileId?: string;
      field?: YieldMoldFormulaSourceReferenceIssue['field'];
    } = {},
  ) {
    super(message);
    this.name = 'YieldMoldFormulaSourceApplicationError';
    this.code = code;
    Object.assign(this, context);
  }
}

function comparable(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base' });
}

/**
 * Application boundary for YRS Mold Formula provenance.
 *
 * Provenance is immutable here: create once, then query/resolve. Correction,
 * rollback and coordinated Yield-evidence deletion are intentionally deferred to
 * YRS2B even though the repository exposes a delete infrastructure seam.
 */
export class YieldMoldFormulaSourceService {
  constructor(
    private readonly repository: YieldMoldFormulaSourceRepository,
    private readonly yieldSamples: YieldSampleRepository,
    private readonly molds: MoldRepository,
    private readonly profiles: PlasterMoldYieldProfileRepository,
  ) {}

  async prepareSourceForPendingYieldSample(
    input: YieldMoldFormulaSource,
    pendingSample: import('../../domain/yieldSamples').YieldSample,
  ): Promise<YieldMoldFormulaSource> {
    let candidate = normalizeYieldMoldFormulaSource({
      ...input,
      yieldSampleId: pendingSample.id,
    });
    validateYieldMoldFormulaSourceContract(candidate);

    const existing = await this.repository.findByYieldSampleId(
      candidate.yieldSampleId,
    );
    if (existing) {
      throw new YieldMoldFormulaSourceApplicationError(
        'SOURCE_ALREADY_EXISTS',
        `Mold Formula provenance already exists for Yield Sample ${existing.yieldSampleId}.`,
        {
          yieldSampleId: existing.yieldSampleId,
          moldId: existing.moldId,
          moldYieldProfileId: existing.moldYieldProfileId,
          field: 'yieldSampleId',
        },
      );
    }

    candidate = await this.canonicalizePendingReferences(
      candidate,
      pendingSample,
    );
    await this.assertCreateReferences(candidate, pendingSample);
    return cloneYieldMoldFormulaSource(candidate);
  }

  async createSource(
    input: YieldMoldFormulaSource,
  ): Promise<YieldMoldFormulaSource> {
    const existingSample = await this.yieldSamples.findById(
      input.yieldSampleId,
    );

    if (!existingSample) {
      throw new YieldMoldFormulaSourceApplicationError(
        'YIELD_SAMPLE_NOT_FOUND',
        `Yield Sample not found: ${input.yieldSampleId.trim()}.`,
        {
          yieldSampleId: input.yieldSampleId.trim(),
          field: 'yieldSampleId',
        },
      );
    }

    const candidate =
      await this.prepareSourceForPendingYieldSample(
        input,
        existingSample,
      );

    await this.repository.insert(candidate);
    return cloneYieldMoldFormulaSource(candidate);
  }

  async getSourceForYieldSample(
    yieldSampleId: string,
  ): Promise<YieldMoldFormulaSource | null> {
    const source = await this.repository.findByYieldSampleId(yieldSampleId);
    return source ? cloneYieldMoldFormulaSource(source) : null;
  }

  async listSources(
    filter: YieldMoldFormulaSourceListFilter = {},
  ): Promise<YieldMoldFormulaSource[]> {
    return (await this.repository.list())
      .filter(
        (source) =>
          filter.yieldSampleId === undefined ||
          comparable(source.yieldSampleId) ===
            comparable(filter.yieldSampleId),
      )
      .filter(
        (source) =>
          filter.moldId === undefined ||
          comparable(source.moldId) === comparable(filter.moldId),
      )
      .filter(
        (source) =>
          filter.moldYieldProfileId === undefined ||
          comparable(source.moldYieldProfileId) ===
            comparable(filter.moldYieldProfileId),
      )
      .sort((left, right) =>
        compareText(left.yieldSampleId, right.yieldSampleId),
      )
      .map(cloneYieldMoldFormulaSource);
  }

  async resolveRecipeSourceForYieldSample(
    yieldSampleId: string,
  ): Promise<ResolvedYieldRecipeSource> {
    const sample = await this.yieldSamples.findById(yieldSampleId);
    if (!sample) {
      throw new YieldMoldFormulaSourceApplicationError(
        'YIELD_SAMPLE_NOT_FOUND',
        `Yield Sample not found: ${yieldSampleId.trim()}.`,
        { yieldSampleId: yieldSampleId.trim(), field: 'yieldSampleId' },
      );
    }

    const source = await this.repository.findByYieldSampleId(sample.id);
    return resolveYieldRecipeSource(
      sample,
      source
        ? toMoldFormulaYieldRecipeSourceReference(source)
        : undefined,
    );
  }

  private async canonicalizePendingReferences(
    source: YieldMoldFormulaSource,
    pendingSample: import('../../domain/yieldSamples').YieldSample,
  ): Promise<YieldMoldFormulaSource> {
    const [mold, profile] = await Promise.all([
      this.molds.findById(source.moldId),
      this.profiles.findById(source.moldYieldProfileId),
    ]);

    return normalizeYieldMoldFormulaSource({
      yieldSampleId: pendingSample.id,
      moldId: mold?.id ?? source.moldId,
      moldYieldProfileId: profile?.id ?? source.moldYieldProfileId,
    });
  }

  private async assertCreateReferences(
    candidate: YieldMoldFormulaSource,
    pendingSample: import('../../domain/yieldSamples').YieldSample,
  ): Promise<void> {
    const [sources, yieldSamples, molds, profiles] = await Promise.all([
      this.repository.list(),
      this.yieldSamples.list(),
      this.molds.list(),
      this.profiles.list(),
    ]);

    const pendingKey = comparable(pendingSample.id);
    const proposedYieldSamples = [
      ...yieldSamples.filter(
        (sample) => comparable(sample.id) !== pendingKey,
      ),
      pendingSample,
    ];

    const historical = validateYieldMoldFormulaSourceReferences({
      sources: [...sources, candidate],
      yieldSamples: proposedYieldSamples,
      molds,
      profiles,
      mode: 'historical',
    });

    if (!historical.valid) {
      this.throwReferenceIssue(candidate, historical.issues);
    }

    const recording = validateYieldMoldFormulaSourceReferences({
      sources: [candidate],
      yieldSamples: proposedYieldSamples,
      molds,
      profiles,
      mode: 'recording',
    });

    if (!recording.valid) {
      this.throwReferenceIssue(candidate, recording.issues);
    }
  }

  private throwReferenceIssue(
    candidate: YieldMoldFormulaSource,
    issues: readonly YieldMoldFormulaSourceReferenceIssue[],
  ): never {
    const candidateKey = comparable(candidate.yieldSampleId);
    const issue =
      issues.find(
        (item) => comparable(item.yieldSampleId) === candidateKey,
      ) ?? issues[0];

    throw new YieldMoldFormulaSourceApplicationError(
      issue.code,
      issue.message,
      {
        yieldSampleId: issue.yieldSampleId,
        moldId: issue.moldId,
        moldYieldProfileId: issue.moldYieldProfileId,
        field: issue.field,
      },
    );
  }
}
