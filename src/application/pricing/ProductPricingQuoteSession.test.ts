import { describe, expect, it } from 'vitest';
import {
  productPricingQuoteService,
  profitMarkupMarginMetricsService,
  fullyLoadedProductUnitCostService,
  productFinancialProfileService,
} from '../session';
import { ProductPricingQuoteService } from './ProductPricingQuoteService';

describe('Phase 4.3C shared session wiring', () => {
  it('exposes the consolidated Product pricing quote service over authoritative Phase 4 dependencies', () => {
    expect(productPricingQuoteService).toBeInstanceOf(ProductPricingQuoteService);
    expect(profitMarkupMarginMetricsService).toBeDefined();
    expect(fullyLoadedProductUnitCostService).toBeDefined();
    expect(productFinancialProfileService).toBeDefined();
  });
});
