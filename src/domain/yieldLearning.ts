import type { MaterialCalibrationEvidence } from './materialCalibration';
import { selectLatestMaterialCupWeightCalibration } from './materialCalibration';
import type { Material } from './materials';
import { isMaterialCupWeightBridge } from './materials';
import { calculateMaterialPackageCosting } from './materialCosting';
import { areUnitsCompatible, getStandardConversionFactor } from './units';
import type { YieldSample, YieldSampleMaterialInput } from './yieldSamples';

export type YieldLearningConversionSource = 'standard' | 'calibration' | 'manual';

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

function calibrationsForMaterial(
  materialId: string,
  calibrations: readonly MaterialCalibrationEvidence[],
): MaterialCalibrationEvidence[] {
  const key = comparable(materialId);
  return calibrations.filter((record) => comparable(record.materialId) === key);
}

export function normalizeYieldSampleMaterialInput(
  sampleId: string,
  input: YieldSampleMaterialInput,
  material: Material,
  calibrations: readonly MaterialCalibrationEvidence[] = [],
): Omit<LearnedMaterialRequirement, 'baseQuantityPerGoodPiece'> {
  if (areUnitsCompatible(input.unit, material.baseUnit)) {
    const factor = getStandardConversionFactor(input.unit, material.baseUnit);
    return {
      materialId: material.id,
      sourceQuantity: input.quantity,
      sourceUnit: input.unit,
      baseUnit: material.baseUnit,
      normalizedBaseQuantityConsumed: input.quantity * factor,
      conversionSource: 'standard',
      calibrationId: null,
    };
  }

  if (isMaterialCupWeightBridge(input.unit, material.baseUnit)) {
    const materialCalibrations = calibrationsForMaterial(material.id, calibrations);
    if (materialCalibrations.length > 0) {
      const calibration = selectLatestMaterialCupWeightCalibration(material, materialCalibrations);
      return {
        materialId: material.id,
        sourceQuantity: input.quantity,
        sourceUnit: input.unit,
        baseUnit: material.baseUnit,
        normalizedBaseQuantityConsumed: input.quantity * calibration.gramsPerCup,
        conversionSource: 'calibration',
        calibrationId: calibration.evidence.id,
      };
    }

    if (material.purchaseUnit === 'cup' && material.manualBaseUnitsPerPurchaseUnit !== undefined) {
      const packageCosting = calculateMaterialPackageCosting(material, []);
      return {
        materialId: material.id,
        sourceQuantity: input.quantity,
        sourceUnit: input.unit,
        baseUnit: material.baseUnit,
        normalizedBaseQuantityConsumed:
          input.quantity * packageCosting.effectiveBaseUnitsPerPurchaseUnit,
        conversionSource: 'manual',
        calibrationId: null,
      };
    }

    throw new YieldLearningError(
      'MISSING_MATERIAL_CALIBRATION',
      `Yield sample ${sampleId} requires cup-to-weight calibration for ${material.name}.`,
      { sampleId, materialId: material.id },
    );
  }

  throw new YieldLearningError(
    'UNRESOLVED_CROSS_DIMENSION_UNIT',
    `Yield sample ${sampleId} cannot convert ${input.unit} to ${material.baseUnit} for ${material.name}.`,
    { sampleId, materialId: material.id },
  );
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
