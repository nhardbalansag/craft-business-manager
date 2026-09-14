import {
  deriveMaterialCupWeightCalibration,
  selectLatestMaterialCupWeightCalibration,
  type MaterialCalibrationEvidence,
  type MaterialCupWeightCalibration,
} from '../../domain/materialCalibration';
import type { MaterialRepository } from '../materials/MaterialRepository';
import type { CalibrationRepository } from './CalibrationRepository';

export type CalibrationApplicationErrorCode =
  | 'MATERIAL_NOT_FOUND'
  | 'CALIBRATION_NOT_FOUND'
  | 'DUPLICATE_CALIBRATION_ID';

export class CalibrationApplicationError extends Error {
  readonly code: CalibrationApplicationErrorCode;
  readonly calibrationId?: string;
  readonly materialId?: string;

  constructor(
    code: CalibrationApplicationErrorCode,
    message: string,
    context: { calibrationId?: string; materialId?: string } = {},
  ) {
    super(message);
    this.name = 'CalibrationApplicationError';
    this.code = code;
    this.calibrationId = context.calibrationId;
    this.materialId = context.materialId;
  }
}

function normalizeEvidence(evidence: MaterialCalibrationEvidence): MaterialCalibrationEvidence {
  return {
    ...evidence,
    id: evidence.id.trim(),
    materialId: evidence.materialId.trim(),
    notes: evidence.notes?.trim() || undefined,
  };
}

export class CalibrationService {
  constructor(
    private readonly repository: CalibrationRepository,
    private readonly materialRepository: MaterialRepository,
  ) {}

  async createCalibration(input: MaterialCalibrationEvidence): Promise<MaterialCupWeightCalibration> {
    const evidence = normalizeEvidence(input);
    const material = await this.materialRepository.findById(evidence.materialId);
    if (!material) {
      throw new CalibrationApplicationError(
        'MATERIAL_NOT_FOUND',
        `Material not found: ${evidence.materialId}.`,
        { materialId: evidence.materialId, calibrationId: evidence.id },
      );
    }

    const existing = await this.repository.findById(evidence.id);
    if (existing) {
      throw new CalibrationApplicationError(
        'DUPLICATE_CALIBRATION_ID',
        `Calibration ID already exists: ${evidence.id}.`,
        { materialId: evidence.materialId, calibrationId: evidence.id },
      );
    }

    const derived = deriveMaterialCupWeightCalibration(material, evidence);
    await this.repository.insert(derived.evidence);
    return derived;
  }

  async listCalibrations(materialId?: string): Promise<MaterialCalibrationEvidence[]> {
    const records = await this.repository.list();
    const normalizedMaterialId = materialId?.trim().toLocaleLowerCase();

    return records
      .filter(
        (record) =>
          normalizedMaterialId === undefined ||
          record.materialId.trim().toLocaleLowerCase() === normalizedMaterialId,
      )
      .sort((a, b) => {
        const byDate = Date.parse(b.recordedAt) - Date.parse(a.recordedAt);
        if (byDate !== 0) return byDate;
        return b.id.localeCompare(a.id, undefined, { sensitivity: 'base' });
      })
      .map((record) => ({ ...record }));
  }

  async getEffectiveCalibration(materialId: string): Promise<MaterialCupWeightCalibration | null> {
    const material = await this.materialRepository.findById(materialId);
    if (!material) {
      throw new CalibrationApplicationError('MATERIAL_NOT_FOUND', `Material not found: ${materialId}.`, {
        materialId,
      });
    }

    const records = await this.listCalibrations(materialId);
    if (records.length === 0) return null;
    return selectLatestMaterialCupWeightCalibration(material, records);
  }

  async deleteCalibration(id: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new CalibrationApplicationError(
        'CALIBRATION_NOT_FOUND',
        `Calibration not found: ${id.trim()}.`,
        { calibrationId: id.trim() },
      );
    }
    await this.repository.delete(id);
  }
}
