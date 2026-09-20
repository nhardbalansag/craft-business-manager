import { describe, expect, it } from 'vitest';
import {
  productPricingQuoteIntegrationService,
  productPricingQuoteService,
  profitMarkupMarginMetricsService,
  fullyLoadedProductUnitCostService,
  productFinancialProfileService,
} from '../session';
import { ProductPricingQuoteIntegrationService } from './ProductPricingQuoteIntegrationService';
import { ProductPricingQuoteService } from './ProductPricingQuoteService';

describe('Phase 4.3C shared session wiring', () => {
  it('exposes the consolidated Product pricing quote service over authoritative Phase 4 dependencies', () => {
    expect(productPricingQuoteService).toBeInstanceOf(ProductPricingQuoteService);
    expect(productPricingQuoteIntegrationService).toBeInstanceOf(
      ProductPricingQuoteIntegrationService,
    );
    expect(profitMarkupMarginMetricsService).toBeDefined();
    expect(fullyLoadedProductUnitCostService).toBeDefined();
    expect(productFinancialProfileService).toBeDefined();
  });
});
