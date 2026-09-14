# Phase 1.4C — Calibration UI & Tests

## Status

**COMPLETE — MERGED — POST-MERGE CI PASSED**

Implementation branch: `feature/phase-1-4c-calibration-ui`

PR: `#15`

Merge commit: `a4ca2dd406fd90e8640fdf4011eb8bf684a2ccfb`

Post-merge CI: `34823193266` — SUCCESS

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

Materials and calibration records use shared in-memory application services instead of page-local repositories.

```text
React Materials UI ─┐
                    ├─ shared session services
React Calibration UI┘       ├─ MaterialService
                            └─ CalibrationService
```

Persistence remains session-only. Excel storage is still Phase 5.

## Calibration application service

`CalibrationService` provides:

- create calibration evidence
- list calibration history
- resolve effective/latest valid calibration
- delete erroneous calibration evidence
- duplicate calibration-ID protection
- material existence validation

Calibration records remain evidence objects. `gramsPerCup` is derived from recorded measurements rather than stored as an independent authoritative material field.

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

Effective strategy:

```text
latest valid calibration wins
```

## Materials integration

The Materials workspace reads calibration history from the shared session and passes material-specific evidence into package costing, stock normalization, and inventory valuation.

For gram-based materials, `cup` is an available purchase/on-hand source unit.

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

`MaterialService` receives calibration evidence through an injected provider before persistence validation. This keeps React previews and application-level save validation consistent.

Existing MaterialService usage remains compatible because the provider defaults to no calibration evidence.

## Automated coverage

Tests cover:

- calibration create/list/effective selection
- duplicate calibration ID rejection
- missing material rejection
- deletion behavior
- calibrated cup stock passing MaterialService persistence validation
- uncalibrated cup stock remaining invalid
- existing derivation, precedence, costing, normalization, and valuation regressions

## Completion evidence

PR #15 passed:

- dependency installation
- TypeScript typecheck
- calibration application tests
- calibrated MaterialService integration tests
- full regression suite
- production build
- final PR-head CI
- merge into `develop`
- post-merge `develop` CI

**Phase 1.4 — Material-Specific Calibration is complete.**

Next task: **1.5A — Supplier / Source Contract**.
