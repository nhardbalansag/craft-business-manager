import { describe, expect, it } from 'vitest';
import {
  fullyLoadedProductUnitCostService,
  productFinancialProfileService,
  sellingPriceDerivationService,
} from '../session';
import { SellingPriceDerivationService } from './SellingPriceDerivationService';

describe('Phase 4.3A shared session wiring', () => {
  it('exposes the shared selling-price derivation service and its prerequisite services', () => {
    expect(sellingPriceDerivationService).toBeInstanceOf(SellingPriceDerivationService);
    expect(fullyLoadedProductUnitCostService).toBeDefined();
    expect(productFinancialProfileService).toBeDefined();
  });
});
