import type { CalibrationRepository } from '../calibrations/CalibrationRepository';
import type { MaterialRepository } from '../materials/MaterialRepository';
import {
  deriveYieldSampleLearning,
  type YieldSampleLearning,
} from '../../domain/yieldLearning';
import type { YieldSampleRepository } from './YieldSampleRepository';

export type YieldLearningServiceErrorCode = 'SAMPLE_NOT_FOUND';

export class YieldLearningServiceError extends Error {
  readonly code: YieldLearningServiceErrorCode;
  readonly sampleId: string;

  constructor(code: YieldLearningServiceErrorCode, message: string, sampleId: string) {
    super(message);
    this.name = 'YieldLearningServiceError';
    this.code = code;
    this.sampleId = sampleId;
  }
}

/** Application boundary for deriving learned requirements from recorded evidence. */
export class YieldLearningService {
  constructor(
    private readonly samples: YieldSampleRepository,
    private readonly materials: MaterialRepository,
    private readonly calibrations: CalibrationRepository,
  ) {}

  async deriveBySampleId(sampleId: string): Promise<YieldSampleLearning> {
    const sample = await this.samples.findById(sampleId);
    if (!sample) {
      throw new YieldLearningServiceError(
        'SAMPLE_NOT_FOUND',
        `Yield sample ${sampleId} was not found.`,
        sampleId,
      );
    }

    const [materials, calibrations] = await Promise.all([
      this.materials.list(),
      this.calibrations.list(),
    ]);

    return deriveYieldSampleLearning(sample, materials, calibrations);
  }
}
