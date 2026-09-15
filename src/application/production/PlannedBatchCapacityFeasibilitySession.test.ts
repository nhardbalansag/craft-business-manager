import { describe, expect, it } from 'vitest';
import {
  assemblyCapacityTraceService,
  expectedBatchFinancialsService,
  plannedBatchCapacityFeasibilityService,
} from '../session';
import { PlannedBatchCapacityFeasibilityService } from './PlannedBatchCapacityFeasibilityService';

describe('Phase 4.4C shared session wiring', () => {
  it('exposes capacity feasibility over the completed 4.4B and Phase 3.4C boundaries', () => {
    expect(plannedBatchCapacityFeasibilityService).toBeInstanceOf(
      PlannedBatchCapacityFeasibilityService,
    );
    expect(expectedBatchFinancialsService).toBeDefined();
    expect(assemblyCapacityTraceService).toBeDefined();
  });
});
