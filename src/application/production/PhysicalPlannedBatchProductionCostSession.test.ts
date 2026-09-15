import { describe, expect, it } from 'vitest';
import {
  fullyLoadedProductUnitCostService,
  physicalPlannedBatchProductionCostService,
  productionRequirementService,
} from '../session';
import { PhysicalPlannedBatchProductionCostService } from './PhysicalPlannedBatchProductionCostService';

describe('Phase 4.4A shared session wiring', () => {
  it('exposes physical planned batch production costing over authoritative Phase 2 and 4.2C dependencies', () => {
    expect(physicalPlannedBatchProductionCostService).toBeInstanceOf(
      PhysicalPlannedBatchProductionCostService,
    );
    expect(productionRequirementService).toBeDefined();
    expect(fullyLoadedProductUnitCostService).toBeDefined();
  });
});
