import type { YieldSample } from './yieldSamples';

/**
 * Deterministic Phase 2 yield-history ordering.
 *
 * Newest recordedAt wins. When timestamps are equal, the case-insensitive
 * sample identity is used as a stable descending tie-breaker, matching the
 * deterministic latest-evidence strategy used by material calibration.
 */
export function compareYieldSamplesNewestFirst(a: YieldSample, b: YieldSample): number {
  const byRecordedAt = Date.parse(b.recordedAt) - Date.parse(a.recordedAt);
  if (byRecordedAt !== 0) return byRecordedAt;

  const aKey = a.id.trim().toLowerCase();
  const bKey = b.id.trim().toLowerCase();
  if (aKey === bKey) return 0;
  return bKey < aKey ? -1 : 1;
}

export function sortYieldSampleHistory(samples: readonly YieldSample[]): YieldSample[] {
  return [...samples].sort(compareYieldSamplesNewestFirst);
}
