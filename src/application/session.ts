import { CalibrationService } from './calibrations/CalibrationService';
import { InMemoryCalibrationRepository } from './calibrations/InMemoryCalibrationRepository';
import { InMemoryMaterialRepository } from './materials/InMemoryMaterialRepository';
import { MaterialService } from './materials/MaterialService';

export const materialRepository = new InMemoryMaterialRepository();
export const materialService = new MaterialService(materialRepository);

export const calibrationRepository = new InMemoryCalibrationRepository();
export const calibrationService = new CalibrationService(calibrationRepository, materialRepository);
