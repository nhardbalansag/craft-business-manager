import { CalibrationService } from './calibrations/CalibrationService';
import { InMemoryCalibrationRepository } from './calibrations/InMemoryCalibrationRepository';
import { InMemoryMaterialRepository } from './materials/InMemoryMaterialRepository';
import { MaterialService } from './materials/MaterialService';
import { InMemoryMixPresetRepository } from './mixPresets/InMemoryMixPresetRepository';
import { MixPresetService } from './mixPresets/MixPresetService';
import { InMemoryProductRepository } from './products/InMemoryProductRepository';
import { ProductService } from './products/ProductService';
import { FixedRecipeItemService } from './recipeItems/FixedRecipeItemService';
import { InMemoryFixedRecipeItemRepository } from './recipeItems/InMemoryFixedRecipeItemRepository';
import { InMemoryYieldSampleRepository } from './yieldSamples/InMemoryYieldSampleRepository';
import { YieldHistoryService } from './yieldSamples/YieldHistoryService';
import { YieldLearningService } from './yieldSamples/YieldLearningService';
import { YieldSampleEvidenceService } from './yieldSamples/YieldSampleEvidenceService';

export const materialRepository = new InMemoryMaterialRepository();
export const calibrationRepository = new InMemoryCalibrationRepository();
export const mixPresetRepository = new InMemoryMixPresetRepository();
export const productRepository = new InMemoryProductRepository();
export const yieldSampleRepository = new InMemoryYieldSampleRepository();
export const fixedRecipeItemRepository = new InMemoryFixedRecipeItemRepository();

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
export const yieldSampleEvidenceService = new YieldSampleEvidenceService(
  yieldSampleRepository,
  productRepository,
  mixPresetRepository,
  materialRepository,
);
export const yieldLearningService = new YieldLearningService(
  yieldSampleRepository,
  materialRepository,
  calibrationRepository,
);
export const yieldHistoryService = new YieldHistoryService(
  yieldSampleRepository,
  productRepository,
  materialRepository,
  calibrationRepository,
);
export const fixedRecipeItemService = new FixedRecipeItemService(
  fixedRecipeItemRepository,
  productRepository,
  materialRepository,
  calibrationRepository,
);
