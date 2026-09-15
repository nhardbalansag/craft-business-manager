import { describe, expect, it } from 'vitest';
import { wasteAdjustedDirectMaterialCostService } from '../session';
import { WasteAdjustedDirectMaterialCostService } from './WasteAdjustedDirectMaterialCostService';

describe('WasteAdjustedDirectMaterialCostService session wiring', () => {
  it('exposes the shared Phase 4.2A service through the application session', () => {
    expect(wasteAdjustedDirectMaterialCostService).toBeInstanceOf(
      WasteAdjustedDirectMaterialCostService,
    );
  });
});
