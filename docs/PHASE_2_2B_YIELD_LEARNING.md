# Phase 2.2B — Good / Rejected Output & Learned Requirements

## Status

**COMPLETE**

Implementation PR: **#34**

Implementation merge commit: `f36322c434cacbf0f3c7486a1b4bb4e2c394183d`

Post-merge CI run: `34833286721` — **SUCCESS**

## Objective

Derive learned per-good-piece material requirements from immutable `YieldSample` evidence without changing the recorded evidence itself.

## Core rule

For every material in a valid yield sample:

```text
learned base quantity per good piece
= normalized total material consumed / good pieces
```

Rejected pieces are deliberately **not** included in the denominator. Their material consumption is already present in total batch consumption, so the learned requirement already absorbs observed defect loss without applying a second waste multiplier.

## Canonical normalization

Every material input is normalized to its Phase 1 canonical base unit before learning:

- weight -> `g`;
- volume -> `mL`;
- count -> `pc`;
- material-specific dry `cup -> g` uses the latest valid calibration;
- when no calibration exists, an explicit configured manual `g/cup` fallback may be used;
- arbitrary cross-dimension conversions remain invalid.

Each learned result preserves traceability to the original source quantity/unit and reports its conversion source plus calibration ID when applicable.

## Example

```text
Yield sample
plaster = 3 cups
water = 1.5 cups
good pieces = 8
rejected pieces = 1

Plaster calibration
5 cups = 1000 g
=> 200 g/cup

Plaster
3 cups = 600 g
600 / 8 = 75 g per good piece

Water
1.5 cups = 360 mL
360 / 8 = 45 mL per good piece
```

## Defect metric

Defect rate remains separate from `safetyWasteRate`:

```text
defect rate
= rejected pieces / (good pieces + rejected pieces)
```

For 8 good and 1 rejected, defect rate is `1 / 9 = 11.11%`.

The defect rate is diagnostic only and is not automatically added to learned material requirements.

## Delivered files

- `src/domain/yieldLearning.ts`
- `src/domain/yieldLearning.test.ts`
- `src/application/yieldSamples/YieldLearningService.ts`
- `src/application/yieldSamples/YieldLearningService.test.ts`
- `src/application/session.ts`

## Deferred

- effective/latest yield-sample selection and history/deletion safeguards: **2.2C**
- fixed recipe synthesis: **2.3**
- safety-waste application: **2.4**
- yield UI: **2.5B**

## Validation evidence

- feature CI passed typecheck, all tests, and production build;
- implementation PR #34 merged into `develop`;
- post-merge CI run `34833286721` passed on `f36322c434cacbf0f3c7486a1b4bb4e2c394183d`.

Next task: **2.2C — Effective Yield Selection & History Rules**.
