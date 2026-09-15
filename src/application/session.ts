import { CalibrationService } from './calibrations/CalibrationService';
import { InMemoryCalibrationRepository } from './calibrations/InMemoryCalibrationRepository';
import { InMemoryMaterialRepository } from './materials/InMemoryMaterialRepository';
import { MaterialService } from './materials/MaterialService';
import { InMemoryMixPresetRepository } from './mixPresets/InMemoryMixPresetRepository';
import { MixPresetService } from './mixPresets/MixPresetService';
import { ProductionCapacityService } from './production/ProductionCapacityService';
import { ProductionRequirementService } from './production/ProductionRequirementService';
import { ComponentSourceAvailabilityService } from './productComponents/ComponentSourceAvailabilityService';
import { InMemoryProductComponentRepository } from './productComponents/InMemoryProductComponentRepository';
import { MaterialBackedComponentCostService } from './productComponents/MaterialBackedComponentCostService';
import { ProductComponentService } from './productComponents/ProductComponentService';
import { InMemoryProductRepository } from './products/InMemoryProductRepository';
import { ProductService } from './products/ProductService';
import { InMemoryProductStockRepository } from './productStocks/InMemoryProductStockRepository';
import { ProductStockService } from './productStocks/ProductStockService';
import { RecipeMaterialCostPreviewService } from './recipeCosts/RecipeMaterialCostPreviewService';
import { EffectiveRecipeRequirementService } from './recipeRequirements/EffectiveRecipeRequirementService';
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
export const productComponentRepository = new InMemoryProductComponentRepository();
export const productStockRepository = new InMemoryProductStockRepository();
export const yieldSampleRepository = new InMemoryYieldSampleRepository();
export const fixedRecipeItemRepository = new InMemoryFixedRecipeItemRepository();

export const materialCalibrationEvidenceProvider = async (materialId: string) => {
  const records = await calibrationRepository.list();
  const key = materialId.trim().toLocaleLowerCase();
  return records.filter((record) => record.materialId.trim().toLocaleLowerCase() === key);
};

export const productComponentService = new ProductComponentService(
  productComponentRepository,
  productRepository,
  materialRepository,
);
export const productStockService = new ProductStockService(
  productStockRepository,
  productRepository,
);
export const componentSourceAvailabilityService = new ComponentSourceAvailabilityService(
  materialRepository,
  productRepository,
  productStockRepository,
  materialCalibrationEvidenceProvider,
);
export const materialBackedComponentCostService = new MaterialBackedComponentCostService(
  materialRepository,
  componentSourceAvailabilityService,
  materialCalibrationEvidenceProvider,
);

export const materialService = new MaterialService(
  materialRepository,
  materialCalibrationEvidenceProvider,
  productComponentService,
);

export const calibrationService = new CalibrationService(calibrationRepository, materialRepository);
export const productService = new ProductService(
  productRepository,
  mixPresetRepository,
  productComponentService,
);
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
export const effectiveRecipeRequirementService = new EffectiveRecipeRequirementService(
  productRepository,
  yieldHistoryService,
  fixedRecipeItemService,
);
export const recipeMaterialCostPreviewService = new RecipeMaterialCostPreviewService(
  effectiveRecipeRequirementService,
  materialRepository,
  calibrationRepository,
);
export const productionRequirementService = new ProductionRequirementService(
  effectiveRecipeRequirementService,
  productService,
);
export const productionCapacityService = new ProductionCapacityService(
  productionRequirementService,
  materialRepository,
  calibrationRepository,
);
