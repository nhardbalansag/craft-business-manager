import type { Material } from './materials';
import {
  convertQuantity,
  getUnitDimension,
  isSupportedUnit,
  type Unit,
  type VolumeUnit,
  type WeightUnit,
} from './units';

/**
 * Source evidence captured from a real material-specific measurement.
 * Derived values such as gramsPerCup are deliberately not authoritative fields.
 */
export interface MaterialCalibrationEvidence {
  id: string;
  materialId: string;
  measuredVolume: number;
  volumeUnit: VolumeUnit;
  knownWeight: number;
  weightUnit: WeightUnit;
  recordedAt: string;
  notes?: string;
}

export interface MaterialCupWeightCalibration {
  evidence: MaterialCalibrationEvidence;
  measuredCups: number;
  knownWeightGrams: number;
  gramsPerCup: number;
}

export type MaterialCalibrationErrorCode =
  | 'INVALID_CALIBRATION_ID'
  | 'INVALID_MATERIAL_ID'
  | 'MATERIAL_MISMATCH'
  | 'MATERIAL_NOT_WEIGHT_BASED'
  | 'NON_FINITE_VOLUME'
  | 'NON_POSITIVE_VOLUME'
  | 'INVALID_VOLUME_UNIT'
  | 'NON_FINITE_WEIGHT'
  | 'NON_POSITIVE_WEIGHT'
  | 'INVALID_WEIGHT_UNIT'
  | 'INVALID_RECORDED_AT'
  | 'NO_CALIBRATIONS';

export class MaterialCalibrationError extends Error {
  readonly code: MaterialCalibrationErrorCode;
  readonly calibrationId?: string;
  readonly materialId?: string;
  readonly input?: unknown;

  constructor(
    code: MaterialCalibrationErrorCode,
    message: string,
    context: { calibrationId?: string; materialId?: string; input?: unknown } = {},
  ) {
    super(message);
    this.name = 'MaterialCalibrationError';
    this.code = code;
    this.calibrationId = context.calibrationId;
    this.materialId = context.materialId;
    this.input = context.input;
  }
}

function validateUnitDimension(
  unit: unknown,
  expected: 'volume' | 'weight',
  code: 'INVALID_VOLUME_UNIT' | 'INVALID_WEIGHT_UNIT',
  evidence: Pick<MaterialCalibrationEvidence, 'id' | 'materialId'>,
): asserts unit is Unit {
  if (!isSupportedUnit(unit) || getUnitDimension(unit) !== expected) {
    throw new MaterialCalibrationError(
      code,
      `Calibration ${expected} unit must be a supported ${expected} unit. Received: ${String(unit)}.`,
      { calibrationId: evidence.id, materialId: evidence.materialId, input: unit },
    );
  }
}

function validateMaterialCalibrationEvidenceIdentity(
  evidence: MaterialCalibrationEvidence,
): void {
  if (!evidence.id.trim()) {
    throw new MaterialCalibrationError('INVALID_CALIBRATION_ID', 'Calibration ID is required.', {
      materialId: evidence.materialId,
      input: evidence.id,
    });
  }

  if (!evidence.materialId.trim()) {
    throw new MaterialCalibrationError('INVALID_MATERIAL_ID', 'Calibration material ID is required.', {
      calibrationId: evidence.id,
      input: evidence.materialId,
    });
  }
}

function validateMaterialCalibrationEvidenceMeasurements(
  evidence: MaterialCalibrationEvidence,
): void {
  if (!Number.isFinite(evidence.measuredVolume)) {
    throw new MaterialCalibrationError(
      'NON_FINITE_VOLUME',
      `Measured volume for calibration ${evidence.id} must be finite.`,
      {
        calibrationId: evidence.id,
        materialId: evidence.materialId,
        input: evidence.measuredVolume,
      },
    );
  }

  if (evidence.measuredVolume <= 0) {
    throw new MaterialCalibrationError(
      'NON_POSITIVE_VOLUME',
      `Measured volume for calibration ${evidence.id} must be greater than zero.`,
      {
        calibrationId: evidence.id,
        materialId: evidence.materialId,
        input: evidence.measuredVolume,
      },
    );
  }

  validateUnitDimension(evidence.volumeUnit, 'volume', 'INVALID_VOLUME_UNIT', evidence);

  if (!Number.isFinite(evidence.knownWeight)) {
    throw new MaterialCalibrationError(
      'NON_FINITE_WEIGHT',
      `Known weight for calibration ${evidence.id} must be finite.`,
      {
        calibrationId: evidence.id,
        materialId: evidence.materialId,
        input: evidence.knownWeight,
      },
    );
  }

  if (evidence.knownWeight <= 0) {
    throw new MaterialCalibrationError(
      'NON_POSITIVE_WEIGHT',
      `Known weight for calibration ${evidence.id} must be greater than zero.`,
      {
        calibrationId: evidence.id,
        materialId: evidence.materialId,
        input: evidence.knownWeight,
      },
    );
  }

  validateUnitDimension(evidence.weightUnit, 'weight', 'INVALID_WEIGHT_UNIT', evidence);

  if (!evidence.recordedAt.trim() || Number.isNaN(Date.parse(evidence.recordedAt))) {
    throw new MaterialCalibrationError(
      'INVALID_RECORDED_AT',
      `Calibration ${evidence.id} must have a valid recordedAt date/time.`,
      {
        calibrationId: evidence.id,
        materialId: evidence.materialId,
        input: evidence.recordedAt,
      },
    );
  }
}

/**
 * Validates one persisted calibration evidence record without requiring its current
 * Material definition. This keeps historical measurement evidence independently
 * round-trippable even when the Material is later edited.
 */
export function validateMaterialCalibrationEvidence(
  evidence: MaterialCalibrationEvidence,
): void {
  validateMaterialCalibrationEvidenceIdentity(evidence);
  validateMaterialCalibrationEvidenceMeasurements(evidence);
}

/**
 * Derives a material-specific grams-per-cup calibration from real measurement evidence.
 *
 * Example:
 * 5 cups of Plaster Brand A weigh 1 kg
 * -> measuredCups = 5
 * -> knownWeightGrams = 1000
 * -> gramsPerCup = 200
 *
 * This does not change global unit conversion. `cup = 240 mL` remains a volume rule;
 * the weight relationship here belongs only to the calibrated material.
 */
export function deriveMaterialCupWeightCalibration(
  material: Pick<Material, 'id' | 'name' | 'baseUnit'>,
  evidence: MaterialCalibrationEvidence,
): MaterialCupWeightCalibration {
  // Preserve the established derivation error precedence: evidence identity first,
  // then current Material compatibility, then measurement-field validation.
  validateMaterialCalibrationEvidenceIdentity(evidence);

  if (evidence.materialId.trim().toLocaleLowerCase() !== material.id.trim().toLocaleLowerCase()) {
    throw new MaterialCalibrationError(
      'MATERIAL_MISMATCH',
      `Calibration ${evidence.id} belongs to ${evidence.materialId}, not ${material.id}.`,
      { calibrationId: evidence.id, materialId: evidence.materialId },
    );
  }

  if (material.baseUnit !== 'g') {
    throw new MaterialCalibrationError(
      'MATERIAL_NOT_WEIGHT_BASED',
      `Cup-to-weight calibration requires a weight-based material. ${material.name} uses base unit ${material.baseUnit}.`,
      { calibrationId: evidence.id, materialId: material.id, input: material.baseUnit },
    );
  }

  validateMaterialCalibrationEvidenceMeasurements(evidence);

  const measuredCups = convertQuantity(evidence.measuredVolume, evidence.volumeUnit, 'cup');
  const knownWeightGrams = convertQuantity(evidence.knownWeight, evidence.weightUnit, 'g');

  return {
    evidence: {
      ...evidence,
      id: evidence.id.trim(),
      materialId: evidence.materialId.trim(),
      notes: evidence.notes?.trim() || undefined,
    },
    measuredCups,
    knownWeightGrams,
    gramsPerCup: knownWeightGrams / measuredCups,
  };
}

/**
 * Phase 1 deterministic sample strategy: latest valid calibration wins.
 *
 * Every supplied evidence record is validated for the target material first.
 * If timestamps are equal, calibration ID is used as a stable tie-breaker so
 * selection is deterministic across storage implementations.
 */
export function selectLatestMaterialCupWeightCalibration(
  material: Pick<Material, 'id' | 'name' | 'baseUnit'>,
  evidenceRecords: readonly MaterialCalibrationEvidence[],
): MaterialCupWeightCalibration {
  if (evidenceRecords.length === 0) {
    throw new MaterialCalibrationError(
      'NO_CALIBRATIONS',
      `No cup-to-weight calibrations are available for ${material.name}.`,
      { materialId: material.id },
    );
  }

  const derived = evidenceRecords.map((evidence) =>
    deriveMaterialCupWeightCalibration(material, evidence),
  );

  return derived.sort((a, b) => {
    const byRecordedAt = Date.parse(b.evidence.recordedAt) - Date.parse(a.evidence.recordedAt);
    if (byRecordedAt !== 0) return byRecordedAt;
    return b.evidence.id.localeCompare(a.evidence.id, undefined, { sensitivity: 'base' });
  })[0];
}
