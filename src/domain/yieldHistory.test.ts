import { describe, expect, it } from 'vitest';
import { sortYieldSampleHistory } from './yieldHistory';
import type { YieldSample } from './yieldSamples';

function sample(id: string, recordedAt: string): YieldSample {
  return {
    id,
    productId: 'PROD-1',
    materialInputs: [{ materialId: 'MAT-1', quantity: 1, unit: 'g' }],
    goodPieces: 1,
    rejectedPieces: 0,
    recordedAt,
  };
}

describe('yield history ordering', () => {
  it('sorts newest recorded sample first without mutating the source array', () => {
    const older = sample('YS-001', '2026-09-01T08:00:00.000Z');
    const newer = sample('YS-002', '2026-09-02T08:00:00.000Z');
    const input = [older, newer];

    expect(sortYieldSampleHistory(input).map((item) => item.id)).toEqual(['YS-002', 'YS-001']);
    expect(input.map((item) => item.id)).toEqual(['YS-001', 'YS-002']);
  });

  it('uses sample identity as a deterministic descending tie-breaker', () => {
    const recordedAt = '2026-09-02T08:00:00.000Z';
    const history = sortYieldSampleHistory([
      sample('YS-001', recordedAt),
      sample('YS-003', recordedAt),
      sample('YS-002', recordedAt),
    ]);

    expect(history.map((item) => item.id)).toEqual(['YS-003', 'YS-002', 'YS-001']);
  });
});
