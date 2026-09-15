import { describe, expect, it } from 'vitest';
import { RecursiveFullyLoadedProductComponentCostService } from './RecursiveFullyLoadedProductComponentCostService';
import { recursiveFullyLoadedProductComponentCostService } from '../session';

describe('Phase 4.2B shared session wiring', () => {
  it('exposes the recursive fully loaded Product component cost service', () => {
    expect(recursiveFullyLoadedProductComponentCostService).toBeInstanceOf(
      RecursiveFullyLoadedProductComponentCostService,
    );
  });
});
