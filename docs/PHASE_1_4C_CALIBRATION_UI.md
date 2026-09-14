# Phase 1.4C — Calibration UI & Tests

## Status

**FEATURE CI PASSED — MERGE GATE**

Branch: `feature/phase-1-4c-calibration-ui`

Base: `develop`

PR: `#15`

## Objective

Make the material-specific calibration model operational through the React application while preserving the Phase 1 source-data architecture.

A user can now:

1. create a weight-based material,
2. open Calibration,
3. select that material,
4. enter measured volume and known weight,
5. preview grams per cup,
6. save the evidence,
7. see calibration history and the effective/latest sample,
8. return to Materials and use cups for that calibrated material.

## Shared session boundary

Materials and calibration records now use shared in-memory application services instead of page-local repositories.

```text
React Materials UI ─┐
                    ├─ shared session services
React Calibration UI┘       ├─ MaterialService
                            └─ CalibrationService
```

Persistence is still session-only. Excel storage remains Phase 5.

## Calibration application service

`CalibrationService` provides:

- create calibration evidence
- list calibration history
- resolve the effective/latest valid calibration
- delete an erroneous calibration sample
- duplicate calibration-ID protection
- material existence validation

Calibration records remain evidence objects. `gramsPerCup` continues to be derived from the recorded measurement rather than stored as an independent authoritative field.

## Calibration workspace

The Calibration tab provides:

- active gram-based material selector
- calibration ID
- measured volume quantity/unit
- known weight quantity/unit
- measured timestamp
- notes
- live normalized cup/gram preview
- live derived `g/cup` preview
- history table
- effective-sample badge
- delete action for erroneous evidence

The effective strategy remains:

```text
latest valid calibration wins
```

## Materials integration

The Materials workspace reads calibration history from the shared session and passes material-specific evidence into package costing, stock normalization, and inventory valuation.

For gram-based materials, `cup` is now an available purchase/on-hand source unit.

Example:

```text
Material: Plaster Brand A
Calibration: 5 cups = 1,000 g
Effective: 200 g/cup
On hand: 3 cups
Normalized: 600 g
```

The UI identifies the effective conversion source. Calibration continues to outrank a manual dry `g/cup` fallback.

## Application validation boundary

`MaterialService` receives calibration evidence through an injected provider before persistence validation.

This prevents a mismatch where React could preview calibrated cup stock but the application service rejected the same material when saving it.

Existing MaterialService usage remains compatible because the provider defaults to no calibration evidence.

## Automated coverage

New tests cover:

- calibration create/list/effective selection
- duplicate calibration ID rejection
- missing material rejection
- deletion behavior
- calibrated cup stock passing MaterialService persistence validation
- uncalibrated cup stock remaining invalid

Existing domain tests continue to cover derivation, effective precedence, costing, normalization, and inventory valuation.

## Feature validation evidence

PR #15 feature CI passed:

- dependency installation
- TypeScript typecheck
- calibration application tests
- calibrated MaterialService integration tests
- full regression suite
- production build

## Remaining completion gate

- final PR-head CI after documentation status updates
- merge PR #15 into `develop`
- post-merge `develop` CI

After those gates pass, **Phase 1.4 — Material-Specific Calibration** is complete.

Next task: **1.5A — Supplier / Source Contract**.
