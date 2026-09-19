import type { MaterialCalibrationEvidence } from './materialCalibration';
import type { Material } from './materials';
import {
  MaterialQuantityError,
  normalizeMaterialQuantity,
  type MaterialQuantityConversionSource,
} from './materialQuantity';
import type { YieldSample, YieldSampleMaterialInput } from './yieldSamples';

export type YieldLearningConversionSource = MaterialQuantityConversionSource;

export interface LearnedMaterialRequirement {
  materialId: string;
  sourceQuantity: number;
  sourceUnit: YieldSampleMaterialInput['unit'];
  baseUnit: Material['baseUnit'];
  normalizedBaseQuantityConsumed: number;
  baseQuantityPerGoodPiece: number;
  conversionSource: YieldLearningConversionSource;
  calibrationId: string | null;
}

export interface YieldSampleLearning {
  sampleId: string;
  productId: string;
  goodPieces: number;
  rejectedPieces: number;
  totalPieces: number;
  defectRate: number;
  materialRequirements: LearnedMaterialRequirement[];
}

export type YieldLearningErrorCode =
  | 'MATERIAL_NOT_FOUND'
  | 'MISSING_MATERIAL_CALIBRATION'
  | 'UNRESOLVED_CROSS_DIMENSION_UNIT';

export class YieldLearningError extends Error {
  readonly code: YieldLearningErrorCode;
  readonly sampleId: string;
  readonly materialId?: string;

  constructor(
    code: YieldLearningErrorCode,
    message: string,
    context: { sampleId: string; materialId?: string },
  ) {
    super(message);
    this.name = 'YieldLearningError';
    this.code = code;
    this.sampleId = context.sampleId;
    this.materialId = context.materialId;
  }
}

function comparable(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeYieldSampleMaterialInput(
  sampleId: string,
  input: YieldSampleMaterialInput,
  material: Material,
  calibrations: readonly MaterialCalibrationEvidence[] = [],
): Omit<LearnedMaterialRequirement, 'baseQuantityPerGoodPiece'> {
  try {
    const normalized = normalizeMaterialQuantity(
      material,
      input.quantity,
      input.unit,
      calibrations,
    );

    return {
      materialId: material.id,
      sourceQuantity: normalized.sourceQuantity,
      sourceUnit: input.unit,
      baseUnit: normalized.baseUnit,
      normalizedBaseQuantityConsumed: normalized.normalizedBaseQuantity,
      conversionSource: normalized.conversionSource,
      calibrationId: normalized.calibrationId,
    };
  } catch (error) {
    if (error instanceof MaterialQuantityError) {
      if (error.code === 'MISSING_MATERIAL_CALIBRATION') {
        throw new YieldLearningError(
          'MISSING_MATERIAL_CALIBRATION',
          `Yield sample ${sampleId} requires cup-to-weight calibration for ${material.name}.`,
          { sampleId, materialId: material.id },
        );
      }

      if (error.code === 'UNRESOLVED_CROSS_DIMENSION_UNIT') {
        throw new YieldLearningError(
          'UNRESOLVED_CROSS_DIMENSION_UNIT',
          `Yield sample ${sampleId} cannot convert ${input.unit} to ${material.baseUnit} for ${material.name}.`,
          { sampleId, materialId: material.id },
        );
      }
    }

    throw error;
  }
}

/**
 * Derives learned material consumption from immutable yield evidence.
 *
 * observed requirement per good piece = total material consumed / good pieces
 *
 * Rejected pieces are intentionally not included in the denominator. Their consumed
 * material is already present in total batch consumption, so dividing by good pieces
 * naturally absorbs the observed defect loss without applying a second waste factor.
 */
export function deriveYieldSampleLearning(
  sample: YieldSample,
  materials: readonly Material[],
  calibrations: readonly MaterialCalibrationEvidence[] = [],
): YieldSampleLearning {
  const materialById = new Map(materials.map((material) => [comparable(material.id), material]));

  const materialRequirements = sample.materialInputs.map((input) => {
    const material = materialById.get(comparable(input.materialId));
    if (!material) {
      throw new YieldLearningError(
        'MATERIAL_NOT_FOUND',
        `Material ${input.materialId} referenced by yield sample ${sample.id} was not found.`,
        { sampleId: sample.id, materialId: input.materialId },
      );
    }

    const normalized = normalizeYieldSampleMaterialInput(sample.id, input, material, calibrations);
    return {
      ...normalized,
      baseQuantityPerGoodPiece: normalized.normalizedBaseQuantityConsumed / sample.goodPieces,
    };
  });

  const totalPieces = sample.goodPieces + sample.rejectedPieces;

  return {
    sampleId: sample.id,
    productId: sample.productId,
    goodPieces: sample.goodPieces,
    rejectedPieces: sample.rejectedPieces,
    totalPieces,
    defectRate: totalPieces > 0 ? sample.rejectedPieces / totalPieces : 0,
    materialRequirements,
  };
}
