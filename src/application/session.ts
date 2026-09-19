import { SheetJsWorkbookCodec } from '../storage/sheetJsWorkbookCodec';
import { CalibrationService } from './calibrations/CalibrationService';
import { InMemoryCalibrationRepository } from './calibrations/InMemoryCalibrationRepository';
import { InMemoryMaterialRepository } from './materials/InMemoryMaterialRepository';
import { MaterialService } from './materials/MaterialService';
import { InMemoryMixPresetRepository } from './mixPresets/InMemoryMixPresetRepository';
import { MixPresetService } from './mixPresets/MixPresetService';
import { InMemoryMoldRepository } from './molds/InMemoryMoldRepository';
import { MoldService } from './molds/MoldService';
import { CompleteSourceSnapshotService } from './persistence/CompleteSourceSnapshotService';
import { PersistenceCoordinator } from './persistence/PersistenceCoordinator';
import { PhysicalDatasetHydrationService } from './persistence/PhysicalDatasetHydrationService';
import { PhysicalSourceSnapshotService } from './persistence/PhysicalSourceSnapshotService';
import { ValidatedAtomicDatasetHydrationService } from './persistence/ValidatedAtomicDatasetHydrationService';
import { FullyLoadedProductUnitCostService } from './productCosts/FullyLoadedProductUnitCostService';
import { RecursiveFullyLoadedProductComponentCostService } from './productCosts/RecursiveFullyLoadedProductComponentCostService';
import { WasteAdjustedDirectMaterialCostService } from './productCosts/WasteAdjustedDirectMaterialCostService';
import { AssemblyCapacitySynthesisService } from './production/AssemblyCapacitySynthesisService';
import { AssemblyCapacityTraceService } from './production/AssemblyCapacityTraceService';
import { ExpectedBatchFinancialsService } from './production/ExpectedBatchFinancialsService';
import { PhysicalPlannedBatchProductionCostService } from './production/PhysicalPlannedBatchProductionCostService';
import { PlannedBatchCapacityFeasibilityService } from './production/PlannedBatchCapacityFeasibilityService';
import { ProductionCapacityService } from './production/ProductionCapacityService';
import { ProductionRequirementService } from './production/ProductionRequirementService';
import { ComponentAwareProductCostService } from './productComponents/ComponentAwareProductCostService';
import { ComponentCapacityService } from './productComponents/ComponentCapacityService';
import { ComponentSourceAvailabilityService } from './productComponents/ComponentSourceAvailabilityService';
import { InMemoryProductComponentRepository } from './productComponents/InMemoryProductComponentRepository';
import { MaterialBackedComponentCostService } from './productComponents/MaterialBackedComponentCostService';
import { ProductBackedComponentCostService } from './productComponents/ProductBackedComponentCostService';
import { ProductComponentService } from './productComponents/ProductComponentService';
import { InMemoryProductFinancialProfileRepository } from './productFinancialProfiles/InMemoryProductFinancialProfileRepository';
import { ProductFinancialProfileService } from './productFinancialProfiles/ProductFinancialProfileService';
import { InMemoryProductPriceTierRepository } from './productPriceTiers/InMemoryProductPriceTierRepository';
import { ProductPriceTierQuoteService } from './productPriceTiers/ProductPriceTierQuoteService';
import { ProductPriceTierService } from './productPriceTiers/ProductPriceTierService';
import { InMemoryProductRepository } from './products/InMemoryProductRepository';
import { ProductService } from './products/ProductService';
import { InMemoryProductStockRepository } from './productStocks/InMemoryProductStockRepository';
import { ProductStockService } from './productStocks/ProductStockService';
import { ProductPricingQuoteService } from './pricing/ProductPricingQuoteService';
import { ProfitMarkupMarginMetricsService } from './pricing/ProfitMarkupMarginMetricsService';
import { SellingPriceDerivationService } from './pricing/SellingPriceDerivationService';
import { RecipeMaterialCostPreviewService } from './recipeCosts/RecipeMaterialCostPreviewService';
import { EffectiveRecipeRequirementService } from './recipeRequirements/EffectiveRecipeRequirementService';
import { FixedRecipeItemService } from './recipeItems/FixedRecipeItemService';
import { InMemoryFixedRecipeItemRepository } from './recipeItems/InMemoryFixedRecipeItemRepository';
import { InMemoryStorageLocationRepository } from './storageLocations/InMemoryStorageLocationRepository';
import { StorageLocationService } from './storageLocations/StorageLocationService';
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
export const productFinancialProfileRepository = new InMemoryProductFinancialProfileRepository();
export const productPriceTierRepository = new InMemoryProductPriceTierRepository();
export const yieldSampleRepository = new InMemoryYieldSampleRepository();
export const fixedRecipeItemRepository = new InMemoryFixedRecipeItemRepository();
export const storageLocationRepository = new InMemoryStorageLocationRepository();
export const moldRepository = new InMemoryMoldRepository();

export const completeSourceSnapshotService = new CompleteSourceSnapshotService({
  materials: materialRepository,
  calibrations: calibrationRepository,
  mixPresets: mixPresetRepository,
  products: productRepository,
  yieldSamples: yieldSampleRepository,
  recipeItems: fixedRecipeItemRepository,
  productComponents: productComponentRepository,
  productStocks: productStockRepository,
  productFinancialProfiles: productFinancialProfileRepository,
});

export const validatedAtomicDatasetHydrationService =
  new ValidatedAtomicDatasetHydrationService(
    {
      materials: materialRepository,
      calibrations: calibrationRepository,
      mixPresets: mixPresetRepository,
      products: productRepository,
      yieldSamples: yieldSampleRepository,
      recipeItems: fixedRecipeItemRepository,
      productComponents: productComponentRepository,
      productStocks: productStockRepository,
      productFinancialProfiles: productFinancialProfileRepository,
    },
    completeSourceSnapshotService,
  );

export const physicalSourceSnapshotService = new PhysicalSourceSnapshotService(
  completeSourceSnapshotService,
  storageLocationRepository,
  moldRepository,
);

export const physicalDatasetHydrationService = new PhysicalDatasetHydrationService(
  validatedAtomicDatasetHydrationService,
  physicalSourceSnapshotService,
  storageLocationRepository,
  moldRepository,
);

const persistenceWorkbookCodec = new SheetJsWorkbookCodec();
export const persistenceCoordinator = new PersistenceCoordinator(
  physicalSourceSnapshotService,
  physicalDatasetHydrationService,
  persistenceWorkbookCodec,
);

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
export const productFinancialProfileService = new ProductFinancialProfileService(
  productFinancialProfileRepository,
  productRepository,
);
export const productPriceTierService = new ProductPriceTierService(
  productPriceTierRepository,
  productRepository,
);
export const moldService = new MoldService(
  moldRepository,
  productRepository,
  storageLocationRepository,
);
export const storageLocationService = new StorageLocationService(
  storageLocationRepository,
  moldService,
);
export const componentSourceAvailabilityService = new ComponentSourceAvailabilityService(
  materialRepository,
  productRepository,
  productStockRepository,
  materialCalibrationEvidenceProvider,
);
export const componentCapacityService = new ComponentCapacityService(
  componentSourceAvailabilityService,
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
  {
    async assertProductCanArchive(productId: string) {
      await productComponentService.assertProductCanArchive(productId);
      await moldService.assertProductCanArchive(productId);
    },
    async assertProductCanActivate(productId: string) {
      await productComponentService.assertProductCanActivate(productId);
      await moldService.assertProductCanActivate(productId);
    },
  },
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
export const productBackedComponentCostService = new ProductBackedComponentCostService(
  productRepository,
  productComponentRepository,
  recipeMaterialCostPreviewService,
  materialBackedComponentCostService,
);
export const componentAwareProductCostService = new ComponentAwareProductCostService(
  productRepository,
  productComponentRepository,
  recipeMaterialCostPreviewService,
  materialBackedComponentCostService,
  productBackedComponentCostService,
);
export const productionRequirementService = new ProductionRequirementService(
  effectiveRecipeRequirementService,
  productService,
);
export const wasteAdjustedDirectMaterialCostService = new WasteAdjustedDirectMaterialCostService(
  productionRequirementService,
  recipeMaterialCostPreviewService,
);
export const recursiveFullyLoadedProductComponentCostService =
  new RecursiveFullyLoadedProductComponentCostService(
    productRepository,
    productComponentRepository,
    wasteAdjustedDirectMaterialCostService,
    materialBackedComponentCostService,
    productFinancialProfileService,
  );
export const fullyLoadedProductUnitCostService = new FullyLoadedProductUnitCostService(
  productRepository,
  productComponentRepository,
  wasteAdjustedDirectMaterialCostService,
  materialBackedComponentCostService,
  recursiveFullyLoadedProductComponentCostService,
  productFinancialProfileService,
);
export const productPriceTierQuoteService = new ProductPriceTierQuoteService(
  fullyLoadedProductUnitCostService,
  productPriceTierService,
);
export const physicalPlannedBatchProductionCostService =
  new PhysicalPlannedBatchProductionCostService(
    productionRequirementService,
    fullyLoadedProductUnitCostService,
  );
export const sellingPriceDerivationService = new SellingPriceDerivationService(
  fullyLoadedProductUnitCostService,
  productFinancialProfileService,
);
export const profitMarkupMarginMetricsService = new ProfitMarkupMarginMetricsService(
  sellingPriceDerivationService,
);
export const productPricingQuoteService = new ProductPricingQuoteService(
  fullyLoadedProductUnitCostService,
  productFinancialProfileService,
  profitMarkupMarginMetricsService,
);
export const expectedBatchFinancialsService = new ExpectedBatchFinancialsService(
  productPricingQuoteService,
  physicalPlannedBatchProductionCostService,
);
export const productionCapacityService = new ProductionCapacityService(
  productionRequirementService,
  materialRepository,
  calibrationRepository,
);
export const assemblyCapacitySynthesisService = new AssemblyCapacitySynthesisService(
  productionCapacityService,
  productComponentService,
  componentCapacityService,
);
export const assemblyCapacityTraceService = new AssemblyCapacityTraceService(
  assemblyCapacitySynthesisService,
  productRepository,
  materialRepository,
);
export const plannedBatchCapacityFeasibilityService = new PlannedBatchCapacityFeasibilityService(
  expectedBatchFinancialsService,
  assemblyCapacityTraceService,
);
