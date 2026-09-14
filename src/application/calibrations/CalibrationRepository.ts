import type { MaterialCalibrationEvidence } from '../../domain/materialCalibration';

export interface CalibrationRepository {
  list(): Promise<MaterialCalibrationEvidence[]>;
  findById(id: string): Promise<MaterialCalibrationEvidence | null>;
  insert(evidence: MaterialCalibrationEvidence): Promise<void>;
  delete(id: string): Promise<void>;
}
