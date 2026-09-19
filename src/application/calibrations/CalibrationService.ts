import {
  deriveMaterialCupWeightCalibration,
  selectLatestMaterialCupWeightCalibration,
  type MaterialCalibrationEvidence,
  type MaterialCupWeightCalibration,
} from '../../domain/materialCalibration';
import { MaterialCostingError } from '../../domain/materialCosting';
import { calculateMaterialInventoryValuation, MaterialInventoryError } from '../../domain/materialInventory';
import type { MaterialRepository } from '../materials/MaterialRepository';
import type { CalibrationRepository } from './CalibrationRepository';

export type CalibrationApplicationErrorCode =
  | 'MATERIAL_NOT_FOUND'
  | 'CALIBRATION_NOT_FOUND'
  | 'DUPLICATE_CALIBRATION_ID'
  | 'CALIBRATION_IN_USE';

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

function sameIdentity(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
}

function isMissingCalibrationError(error: unknown): boolean {
  return (
    (error instanceof MaterialInventoryError || error instanceof MaterialCostingError) &&
    error.code === 'MISSING_MATERIAL_CALIBRATION'
  );
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

    const material = await this.materialRepository.findById(existing.materialId);
    if (material) {
      const remaining = (await this.repository.list()).filter(
        (record) =>
          sameIdentity(record.materialId, existing.materialId) && !sameIdentity(record.id, existing.id),
      );

      try {
        calculateMaterialInventoryValuation(material, remaining);
      } catch (error) {
        if (isMissingCalibrationError(error)) {
          throw new CalibrationApplicationError(
            'CALIBRATION_IN_USE',
            `Calibration ${existing.id} cannot be deleted because ${material.name} currently depends on calibration evidence for its saved cup-to-weight conversion. Add another calibration, provide a valid manual fallback, or change the material to a standard unit first.`,
            { calibrationId: existing.id, materialId: material.id },
          );
        }
        throw error;
      }
    }

    await this.repository.delete(id);
  }
}
