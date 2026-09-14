# Phase 2.2B — Good / Rejected Output & Learned Requirements

## Status

**IMPLEMENTED — VALIDATION PENDING**

Branch: `feature/phase-2-2b-yield-learning`

Base: corrected `develop` after the 2.2A closeout.

## Objective

Derive learned per-good-piece material requirements from immutable `YieldSample` evidence without changing the recorded evidence itself.

## Core rule

For every material in a valid yield sample:

```text
learned base quantity per good piece
= normalized total material consumed / good pieces
```

Rejected pieces are deliberately **not** included in the denominator.

Their material consumption is already included in the recorded total batch input. Dividing that total by only the good output naturally absorbs the observed defect loss.

No second rejection/defect waste multiplier is applied.

## Canonical normalization

Every material input is normalized to its Phase 1 canonical base unit before learning:

- weight -> `g`;
- volume -> `mL`;
- count -> `pc`;
- material-specific dry `cup -> g` uses the latest valid calibration;
- when no calibration exists, an explicit configured manual `g/cup` fallback may be used;
- arbitrary cross-dimension conversions remain invalid.

Each learned material result reports:

- original source quantity;
- original source unit;
- canonical base unit;
- normalized batch quantity consumed;
- learned base quantity per good piece;
- conversion source;
- calibration ID when calibration supplied the conversion.

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

Derived plaster consumption
3 cups = 600 g
600 / 8 = 75 g per good piece

Derived water consumption
1.5 cups = 360 mL
360 / 8 = 45 mL per good piece
```

## Defect metric

Defect rate remains diagnostic and separate from `safetyWasteRate`:

```text
defect rate
= rejected pieces / (good pieces + rejected pieces)
```

For 8 good and 1 rejected:

```text
1 / 9 = 11.11%
```

This value is not automatically added to learned material requirements.

## Historical learning

`YieldLearningService` derives results from already-recorded evidence. Archived materials remain valid historical references as long as the referenced material identity and any required calibration evidence still exist.

Effective-sample selection and evidence deletion/history safeguards remain Phase 2.2C.

## Files

- `src/domain/yieldLearning.ts`
- `src/domain/yieldLearning.test.ts`
- `src/application/yieldSamples/YieldLearningService.ts`
- `src/application/yieldSamples/YieldLearningService.test.ts`
- `src/application/session.ts`

## Deferred

- latest/effective yield-sample selection: **2.2C**
- yield history/deletion safeguards: **2.2C**
- fixed recipe synthesis: **2.3**
- safety-waste application: **2.4**
- yield UI: **2.5B**

## Completion gate

2.2B may be marked complete after:

- TypeScript typecheck passes;
- learning-domain tests pass;
- service tests pass;
- calibration/manual/standard normalization cases pass;
- rejected-output/no-double-count regression passes;
- full regression suite passes;
- production build passes;
- feature PR merges into `develop`;
- post-merge `develop` CI passes.

Next task after completion: **2.2C — Effective Yield Selection & History Rules**.
