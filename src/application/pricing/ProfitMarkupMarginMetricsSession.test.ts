import { describe, expect, it } from 'vitest';
import {
  profitMarkupMarginMetricsService,
  sellingPriceDerivationService,
} from '../session';
import { ProfitMarkupMarginMetricsService } from './ProfitMarkupMarginMetricsService';

describe('Phase 4.3B shared session wiring', () => {
  it('exposes the shared unit-economics metrics service over the 4.3A selling-price service', () => {
    expect(profitMarkupMarginMetricsService).toBeInstanceOf(ProfitMarkupMarginMetricsService);
    expect(sellingPriceDerivationService).toBeDefined();
  });
});
