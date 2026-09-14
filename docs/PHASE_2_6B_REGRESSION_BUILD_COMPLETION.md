# Phase 2.6B — Regression, Build & Phase 2 Completion Validation

## Status

**VALIDATION / MERGE GATE**

Feature branch: `feature/phase-2-6b-completion-validation`

Authoritative base:

`develop` @ `e053d5812bcd6b9f5e24839f4e2d4e2121dd6ce2`

## Objective

Close Phase 2 only after the complete Phase 1 + Phase 2 application surface passes one final regression, typecheck, integration, React smoke, and production-build gate on an exact feature head and then again on the exact merged `develop` commit.

No new Phase 2 business behavior is intentionally introduced here. Phase 2.6A already completed the end-to-end workflow and fixed the final integration gap around indivisible count-material batch rounding and physical batch-cost reconciliation.

## Completion validation surface

The final gate covers all current automated suites, including:

- standard measurement/unit conversion and validation;
- material master, costing, inventory, supplier/source, and calibration behavior;
- Phase 1 integrated materials workflow;
- product contract/category rules;
- mix-preset ratios and application services;
- immutable yield evidence, learning, history, fallback selection, and deletion safeguards;
- fixed recipe items and Phase 3 container/component boundary protection;
- effective yield + fixed requirement synthesis;
- direct-material cost preview and contribution reconciliation;
- safety-waste policy;
- waste-adjusted planning, including physical whole-count batch rounding;
- normalized-inventory capacity and tied limiting-material detection;
- integrated Phase 2 product/yield/production workflow;
- React smoke rendering for Materials, Calibration, Products, Yield, and Production workspaces;
- TypeScript typecheck;
- production Vite build.

## Baseline evidence before the final feature gate

The exact starting `develop` commit already passed CI run `34849497544`.

Observed baseline:

```text
Test files: 38 passed
Tests:      349 passed
Typecheck:  passed
Build:      passed
```

The build transformed 76 modules and emitted the production bundle successfully.

## Phase 2 completion invariants

The completion gate confirms that Phase 2 delivers these stable boundaries:

1. Real production sample evidence is authoritative; mold volume is optional.
2. Learned material usage divides total batch consumption by good pieces only.
3. Rejected-piece loss is diagnostic and is not applied again as a second waste multiplier.
4. Safety waste remains a forward-looking planning reserve.
5. Effective yield selection is deterministic and can safely fall back past newer non-derivable evidence.
6. Fixed recipe inputs preserve source quantity/unit while canonical requirements remain derived.
7. Direct-material requirements merge yield and fixed contributions with source traceability.
8. Direct-material cost preview is allowed, but selling price/profit remains Phase 4.
9. Waste-adjusted count materials preserve precise per-piece math and round only the final physical batch quantity upward.
10. Overall producible pieces are published only when the full direct-material inventory picture is reliable.
11. All tied limiting materials are preserved.
12. Purchased vessels, molded child products, nested products, and component-limited capacity remain Phase 3.
13. Excel persistence remains Phase 5.
14. React continues to use application services rather than duplicating domain calculations.

## Final validation requirements

Before Phase 2 may be marked complete:

- feature-head dependency installation must succeed;
- `npm run typecheck` must succeed;
- `npm run test:run` must pass the complete suite;
- `npm run build` must succeed;
- the completion PR must merge to `develop`;
- CI on the exact merge commit must complete successfully;
- only then may `PHASE_2_PROGRESS.md`, `DEVELOPMENT_PLAN.md`, and README status be advanced to Phase 3.

## Deferred work remains intentional

Phase 2 completion does **not** include:

- purchased vessel composition;
- molded/nested child components;
- multi-component quantity requirements;
- component inventory/cost roll-up;
- component-limited capacity;
- selling price, markup, margin, expected revenue, or profit;
- Excel persistence/import/export;
- native Tauri file dialogs/storage;
- inventory reservation or production stock deduction.

## Next phase after successful completion

**Phase 3 — Product Components, Vessels & Nested Molded Products**

Phase 3 should be assessed and split into implementation sub-phases before development begins.
