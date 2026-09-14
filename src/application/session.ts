import { CalibrationService } from './calibrations/CalibrationService';
import { InMemoryCalibrationRepository } from './calibrations/InMemoryCalibrationRepository';
import { InMemoryMaterialRepository } from './materials/InMemoryMaterialRepository';
import { MaterialService } from './materials/MaterialService';
import { InMemoryMixPresetRepository } from './mixPresets/InMemoryMixPresetRepository';
import { MixPresetService } from './mixPresets/MixPresetService';
import { InMemoryProductRepository } from './products/InMemoryProductRepository';
import { ProductService } from './products/ProductService';

export const materialRepository = new InMemoryMaterialRepository();
export const calibrationRepository = new InMemoryCalibrationRepository();
export const mixPresetRepository = new InMemoryMixPresetRepository();
export const productRepository = new InMemoryProductRepository();

export const materialService = new MaterialService(materialRepository, async (materialId) => {
  const records = await calibrationRepository.list();
  const key = materialId.trim().toLocaleLowerCase();
  return records.filter((record) => record.materialId.trim().toLocaleLowerCase() === key);
});

export const calibrationService = new CalibrationService(calibrationRepository, materialRepository);
export const productService = new ProductService(productRepository, mixPresetRepository);
export const mixPresetService = new MixPresetService(
  mixPresetRepository,
  materialRepository,
  productRepository,
);
