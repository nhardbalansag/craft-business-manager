import { describe, expect, it } from 'vitest';
import { yieldRecipeSourceRecordingService } from '../session';
import { YieldRecipeSourceRecordingService } from './YieldRecipeSourceRecordingService';

describe('YRS2B shared recipe source recording session wiring', () => {
  it('exposes one coordinated recording service over the shared Yield/provenance graph', () => {
    expect(yieldRecipeSourceRecordingService).toBeInstanceOf(
      YieldRecipeSourceRecordingService,
    );
  });
});
