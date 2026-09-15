import { describe, expect, it } from 'vitest';
import {
  fullyLoadedProductUnitCostService,
  materialBackedComponentCostService,
  productFinancialProfileService,
  recursiveFullyLoadedProductComponentCostService,
  wasteAdjustedDirectMaterialCostService,
} from '../session';
import { FullyLoadedProductUnitCostService } from './FullyLoadedProductUnitCostService';

describe('Phase 4.2C shared session wiring', () => {
  it('exposes the shared fully loaded Product unit cost service and its prerequisite services', () => {
    expect(fullyLoadedProductUnitCostService).toBeInstanceOf(FullyLoadedProductUnitCostService);
    expect(wasteAdjustedDirectMaterialCostService).toBeDefined();
    expect(materialBackedComponentCostService).toBeDefined();
    expect(recursiveFullyLoadedProductComponentCostService).toBeDefined();
    expect(productFinancialProfileService).toBeDefined();
  });
});
