import { CalibrationService } from './calibrations/CalibrationService';
import { InMemoryCalibrationRepository } from './calibrations/InMemoryCalibrationRepository';
import { InMemoryMaterialRepository } from './materials/InMemoryMaterialRepository';
import { MaterialService } from './materials/MaterialService';

export const materialRepository = new InMemoryMaterialRepository();
export const calibrationRepository = new InMemoryCalibrationRepository();

export const materialService = new MaterialService(materialRepository, async (materialId) => {
  const records = await calibrationRepository.list();
  const key = materialId.trim().toLocaleLowerCase();
  return records.filter((record) => record.materialId.trim().toLocaleLowerCase() === key);
});

export const calibrationService = new CalibrationService(calibrationRepository, materialRepository);
