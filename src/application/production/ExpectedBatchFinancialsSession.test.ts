import { describe, expect, it } from 'vitest';
import {
  expectedBatchFinancialsService,
  physicalPlannedBatchProductionCostService,
  productPricingQuoteService,
} from '../session';
import { ExpectedBatchFinancialsService } from './ExpectedBatchFinancialsService';

describe('Phase 4.4B shared session wiring', () => {
  it('exposes expected batch financials over authoritative 4.3C and 4.4A dependencies', () => {
    expect(expectedBatchFinancialsService).toBeInstanceOf(ExpectedBatchFinancialsService);
    expect(productPricingQuoteService).toBeDefined();
    expect(physicalPlannedBatchProductionCostService).toBeDefined();
  });
});
