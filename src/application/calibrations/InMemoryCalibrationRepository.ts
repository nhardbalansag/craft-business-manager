import type { MaterialCalibrationEvidence } from '../../domain/materialCalibration';
import type { CalibrationRepository } from './CalibrationRepository';

function key(id: string): string {
  return id.trim().toLocaleLowerCase();
}

function clone(evidence: MaterialCalibrationEvidence): MaterialCalibrationEvidence {
  return { ...evidence };
}

export class InMemoryCalibrationRepository implements CalibrationRepository {
  private readonly calibrations = new Map<string, MaterialCalibrationEvidence>();

  constructor(seed: MaterialCalibrationEvidence[] = []) {
    for (const evidence of seed) {
      this.calibrations.set(key(evidence.id), clone(evidence));
    }
  }

  async list(): Promise<MaterialCalibrationEvidence[]> {
    return [...this.calibrations.values()].map(clone);
  }

  async findById(id: string): Promise<MaterialCalibrationEvidence | null> {
    const evidence = this.calibrations.get(key(id));
    return evidence ? clone(evidence) : null;
  }

  async insert(evidence: MaterialCalibrationEvidence): Promise<void> {
    this.calibrations.set(key(evidence.id), clone(evidence));
  }

  async delete(id: string): Promise<void> {
    this.calibrations.delete(key(id));
  }
}
