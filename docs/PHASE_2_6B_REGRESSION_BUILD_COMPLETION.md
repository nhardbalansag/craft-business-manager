# Phase 2.6B — Regression, Build & Phase 2 Completion Validation

## Status

**COMPLETE — MERGED + POST-MERGE CI PASSED**

Implementation PR: **#58**

Implementation merge commit: `e79303fdcad4fb298154be957f938584f164a61b`

Post-merge CI: **34908149932 — SUCCESS**

## Objective

Close Phase 2 only after the complete Phase 1 + Phase 2 application surface passes one final regression, typecheck, integration, React smoke, and production-build gate on an exact feature head and then again on the exact merged `develop` commit.

No new Phase 2 business behavior was introduced here. Phase 2.6A already completed the end-to-end workflow and fixed the final integration gap around indivisible count-material batch rounding and physical batch-cost reconciliation.

## Completion validation surface

The final gate covered all current automated suites, including:

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

## Final validation evidence

The exact starting `develop` commit passed CI run `34849497544` before the completion branch was created.

The completion feature head then passed CI run `34908067484`.

PR #58 merged to `develop` as:

`e79303fdcad4fb298154be957f938584f164a61b`

The exact merge commit passed post-merge CI run `34908149932`.

Observed complete regression surface:

```text
Test files: 38 passed
Tests:      349 passed
Typecheck:  passed
Build:      passed
```

The production build transformed 76 modules and emitted the Vite production bundle successfully.

## Phase 2 completion invariants

The completion gate confirms these stable Phase 2 boundaries:

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

## Completion result

**Phase 2 — Product Recipes & Mold Yield is complete.**

The product, mix, yield-evidence, learned-requirement, fixed-recipe, cost-preview, safety-waste, inventory-capacity, UI, integrated-workflow, and final regression/build gates all passed.

## Next phase

**Phase 3 — Product Components, Vessels & Nested Molded Products**

Phase 3 should be assessed and split into implementation sub-phases before development begins.
