# Phase 2.2C — Effective Yield Selection & History Rules

## Status

**COMPLETE**

Implementation PR: **#36**

Implementation merge commit: `20757f540afb9d08a3ecd505521fc8af64013bb5`

Post-merge CI run: `34834211687` — **SUCCESS**

## Objective

Make historical yield evidence usable as a deterministic learning source without overwriting or automatically averaging real production samples.

## Baseline selection rule

```text
latest currently valid / derivable yield sample wins
```

History ordering is deterministic:

1. `recordedAt` descending;
2. sample ID descending as a stable case-insensitive tie-breaker.

No automatic averaging, weighted averaging, confidence scoring, or manual preferred-sample flag is introduced in Phase 2.

## What “valid” means for effective learning

A recorded sample remains historical evidence even when it cannot currently produce learned requirements.

For effective selection, the history service evaluates newest-first and chooses the first sample whose learning can be derived using the current Phase 1 material and calibration rules.

Examples of a temporarily non-derivable sample:

- a cup-based plaster sample whose required cup-to-weight calibration is unavailable;
- a historical material identity is missing;
- a required conversion cannot currently be resolved.

A newer invalid sample therefore does not hide an older valid sample.

The effective result reports:

- the selected source sample;
- the derived `YieldSampleLearning` result;
- any newer sample IDs skipped because they were not currently derivable.

This preserves traceability for later recipe synthesis.

## History rules

- all evidence remains immutable after recording;
- history can be listed by product, newest first;
- archived products retain readable history;
- evidence is not automatically averaged or rewritten;
- correction is explicit deletion followed by a replacement recording when needed.

## Safe deletion rule

Deleting evidence is controlled through `YieldHistoryService`, not direct UI/storage mutation.

For an **active product**:

- deleting a non-effective or invalid history sample is allowed;
- deleting the current effective sample is allowed only when another currently valid sample can immediately take over;
- deleting the final/current effective sample with no valid replacement is rejected with `LAST_EFFECTIVE_SAMPLE`.

This prevents active production planning from silently losing its learned requirement source.

For an **archived product**, the final sample may be removed because the product is no longer expected to support active production planning.

The repository remains append-oriented: it has insert and controlled delete, but no evidence replace/update operation.

## Files

- `src/domain/yieldHistory.ts`
- `src/domain/yieldHistory.test.ts`
- `src/application/yieldSamples/YieldHistoryService.ts`
- `src/application/yieldSamples/YieldHistoryService.test.ts`
- `src/application/yieldSamples/YieldSampleRepository.ts`
- `src/application/yieldSamples/InMemoryYieldSampleRepository.ts`
- `src/application/session.ts`

## Validation evidence

The completed implementation passed:

- deterministic history-order tests;
- effective latest-valid selection tests;
- invalid-newer fallback tests;
- safe deletion / final-effective-sample protection tests;
- full regression suite;
- TypeScript typecheck;
- production build;
- feature PR CI;
- post-merge `develop` CI.

## Deferred

- combining yield-derived requirements with fixed recipe inputs: **2.3**
- safety-waste planning: **2.4**
- yield history UI/correction workflow: **2.5B**
- alternate statistical selection strategies: future enhancement only if real production usage justifies them.

Next task: **2.3A — Fixed Recipe Item Contract & Material Roles**.
