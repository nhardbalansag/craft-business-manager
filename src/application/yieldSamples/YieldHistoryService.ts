import { MaterialCalibrationError } from '../../domain/materialCalibration';
import { MaterialCostingError } from '../../domain/materialCosting';
import { sortYieldSampleHistory } from '../../domain/yieldHistory';
import {
  deriveYieldSampleLearning,
  YieldLearningError,
  type YieldSampleLearning,
} from '../../domain/yieldLearning';
import type { YieldSample } from '../../domain/yieldSamples';
import type { CalibrationRepository } from '../calibrations/CalibrationRepository';
import type { MaterialRepository } from '../materials/MaterialRepository';
import type { ProductRepository } from '../products/ProductRepository';
import type { YieldSampleRepository } from './YieldSampleRepository';

export interface EffectiveYieldSelection {
  sample: YieldSample;
  learning: YieldSampleLearning;
  /** Newer history records skipped because they could not currently be derived. */
  skippedInvalidSampleIds: string[];
  selectionMode: 'preferred' | 'automatic';
  preferredSampleId?: string;
  preferredSampleUnavailable?: boolean;
}

export type YieldHistoryServiceErrorCode =
  | 'PRODUCT_NOT_FOUND'
  | 'SAMPLE_NOT_FOUND'
  | 'NO_SAMPLES'
  | 'NO_VALID_SAMPLES'
  | 'SAMPLE_NOT_DERIVABLE'
  | 'LAST_EFFECTIVE_SAMPLE';

export class YieldHistoryServiceError extends Error {
  readonly code: YieldHistoryServiceErrorCode;
  readonly productId?: string;
  readonly sampleId?: string;

  constructor(
    code: YieldHistoryServiceErrorCode,
    message: string,
    context: { productId?: string; sampleId?: string } = {},
  ) {
    super(message);
    this.name = 'YieldHistoryServiceError';
    this.code = code;
    this.productId = context.productId;
    this.sampleId = context.sampleId;
  }
}

function comparable(value: string): string {
  return value.trim().toLowerCase();
}

function isExpectedLearningFailure(error: unknown): boolean {
  return (
    error instanceof YieldLearningError ||
    error instanceof MaterialCalibrationError ||
    error instanceof MaterialCostingError
  );
}

/**
 * Application boundary for Phase 2 yield history.
 *
 * Baseline effective-sample policy:
 *   latest currently derivable sample wins.
 *
 * History is ordered by recordedAt descending, then sample identity descending.
 * Samples that cannot currently be derived (for example, a missing required
 * calibration) remain historical evidence but are skipped for effective learning.
 */
export class YieldHistoryService {
  constructor(
    private readonly samples: YieldSampleRepository,
    private readonly products: ProductRepository,
    private readonly materials: MaterialRepository,
    private readonly calibrations: CalibrationRepository,
  ) {}

  private async requireProduct(productId: string) {
    const product = await this.products.findById(productId);
    if (!product) {
      throw new YieldHistoryServiceError(
        'PRODUCT_NOT_FOUND',
        `Product ${productId} was not found.`,
        { productId },
      );
    }
    return product;
  }

  async listHistory(productId: string): Promise<YieldSample[]> {
    await this.requireProduct(productId);
    const key = comparable(productId);
    const history = (await this.samples.list()).filter(
      (sample) => comparable(sample.productId) === key,
    );
    return sortYieldSampleHistory(history);
  }

  private async selectEffectiveFromHistory(history: readonly YieldSample[]): Promise<EffectiveYieldSelection> {
    if (history.length === 0) {
      throw new YieldHistoryServiceError('NO_SAMPLES', 'No yield samples are available.');
    }

    const [materials, calibrations] = await Promise.all([
      this.materials.list(),
      this.calibrations.list(),
    ]);
    const skippedInvalidSampleIds: string[] = [];

    for (const sample of sortYieldSampleHistory(history)) {
      try {
        const learning = deriveYieldSampleLearning(sample, materials, calibrations);
        return {
          sample,
          learning,
          skippedInvalidSampleIds,
          selectionMode: 'automatic',
        };
      } catch (error) {
        if (!isExpectedLearningFailure(error)) throw error;
        skippedInvalidSampleIds.push(sample.id);
      }
    }

    throw new YieldHistoryServiceError(
      'NO_VALID_SAMPLES',
      'Yield history exists, but none of the samples can currently produce learned requirements.',
      { productId: history[0]?.productId },
    );
  }

  private async derivePreferredSelection(
    productId: string,
    sample: YieldSample,
  ): Promise<EffectiveYieldSelection> {
    const [materials, calibrations] = await Promise.all([
      this.materials.list(),
      this.calibrations.list(),
    ]);

    try {
      const learning = deriveYieldSampleLearning(sample, materials, calibrations);
      return {
        sample,
        learning,
        skippedInvalidSampleIds: [],
        selectionMode: 'preferred',
        preferredSampleId: sample.id,
      };
    } catch (error) {
      if (!isExpectedLearningFailure(error)) throw error;
      throw new YieldHistoryServiceError(
        'SAMPLE_NOT_DERIVABLE',
        `Preferred Yield sample ${sample.id} cannot currently produce learned requirements.`,
        { productId, sampleId: sample.id },
      );
    }
  }

  async getEffective(productId: string): Promise<EffectiveYieldSelection> {
    const product = await this.requireProduct(productId);
    const history = await this.listHistory(product.id);

    if (product.preferredYieldSampleId) {
      const preferredKey = comparable(product.preferredYieldSampleId);
      const preferred = history.find((sample) => comparable(sample.id) === preferredKey);

      if (preferred) {
        try {
          return await this.derivePreferredSelection(product.id, preferred);
        } catch (error) {
          if (!(error instanceof YieldHistoryServiceError) || error.code !== 'SAMPLE_NOT_DERIVABLE') {
            throw error;
          }
        }
      }

      try {
        const fallback = await this.selectEffectiveFromHistory(history);
        return {
          ...fallback,
          preferredSampleId: product.preferredYieldSampleId,
          preferredSampleUnavailable: true,
        };
      } catch (error) {
        if (error instanceof YieldHistoryServiceError && !error.productId) {
          throw new YieldHistoryServiceError(error.code, error.message, { productId: product.id });
        }
        throw error;
      }
    }

    try {
      return await this.selectEffectiveFromHistory(history);
    } catch (error) {
      if (error instanceof YieldHistoryServiceError && !error.productId) {
        throw new YieldHistoryServiceError(error.code, error.message, { productId: product.id });
      }
      throw error;
    }
  }

  async setPreferred(productId: string, sampleId: string): Promise<EffectiveYieldSelection> {
    const product = await this.requireProduct(productId);
    const history = await this.listHistory(product.id);
    const sample = history.find((candidate) => comparable(candidate.id) === comparable(sampleId));

    if (!sample) {
      throw new YieldHistoryServiceError(
        'SAMPLE_NOT_FOUND',
        `Yield sample ${sampleId.trim()} was not found for Product ${product.id}.`,
        { productId: product.id, sampleId: sampleId.trim() },
      );
    }

    const selection = await this.derivePreferredSelection(product.id, sample);
    await this.products.replace({ ...product, preferredYieldSampleId: sample.id });
    return selection;
  }

  async clearPreferred(productId: string): Promise<EffectiveYieldSelection> {
    const product = await this.requireProduct(productId);
    const { preferredYieldSampleId: _preferred, ...withoutPreferred } = product;
    await this.products.replace(withoutPreferred);
    const history = await this.listHistory(product.id);

    try {
      return await this.selectEffectiveFromHistory(history);
    } catch (error) {
      if (error instanceof YieldHistoryServiceError && !error.productId) {
        throw new YieldHistoryServiceError(error.code, error.message, { productId: product.id });
      }
      throw error;
    }
  }

  /**
   * Deletes an incorrect immutable evidence record as an explicit correction.
   *
   * For an active product, deleting its current effective sample is blocked when
   * no other currently valid sample can immediately become effective. This keeps
   * downstream learned requirements from silently becoming invalid.
   *
   * Archived products may have their final sample removed because they are no
   * longer expected to support active production planning.
   */
  async deleteSample(sampleId: string): Promise<void> {
    const target = await this.samples.findById(sampleId);
    if (!target) {
      throw new YieldHistoryServiceError(
        'SAMPLE_NOT_FOUND',
        `Yield sample ${sampleId} was not found.`,
        { sampleId },
      );
    }

    const product = await this.requireProduct(target.productId);
    const history = await this.listHistory(target.productId);
    const preferredTargetsDeletion =
      product.preferredYieldSampleId !== undefined &&
      comparable(product.preferredYieldSampleId) === comparable(target.id);

    if (product.isActive) {
      let currentEffective: EffectiveYieldSelection | null = null;
      try {
        currentEffective = await this.getEffective(product.id);
      } catch (error) {
        if (!(error instanceof YieldHistoryServiceError) || error.code !== 'NO_VALID_SAMPLES') {
          throw error;
        }
      }

      if (currentEffective && comparable(currentEffective.sample.id) === comparable(target.id)) {
        const remaining = history.filter(
          (sample) => comparable(sample.id) !== comparable(target.id),
        );

        let replacementExists = false;
        if (remaining.length > 0) {
          try {
            await this.selectEffectiveFromHistory(remaining);
            replacementExists = true;
          } catch (error) {
            if (
              !(error instanceof YieldHistoryServiceError) ||
              !['NO_SAMPLES', 'NO_VALID_SAMPLES'].includes(error.code)
            ) {
              throw error;
            }
          }
        }

        if (!replacementExists) {
          throw new YieldHistoryServiceError(
            'LAST_EFFECTIVE_SAMPLE',
            `Cannot delete yield sample ${target.id} because active product ${product.id} would have no valid effective yield sample. Record a valid replacement sample or archive the product first.`,
            { productId: product.id, sampleId: target.id },
          );
        }
      }
    }

    await this.samples.delete(target.id);

    if (preferredTargetsDeletion) {
      const { preferredYieldSampleId: _preferred, ...withoutPreferred } = product;
      await this.products.replace(withoutPreferred);
    }
  }
}
