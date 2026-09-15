# Phase 3.6B — Regression, Build & Phase 3 Completion Development Plan

## Status

**IN PROGRESS — PLAN ESTABLISHED BEFORE COMPLETION WORK**

Authoritative base:

`develop` @ `6899f7a50ce25ff4744862fbf3af76b66b1862b4`

Starting exact `develop` CI:

`34929784348 — SUCCESS`

Feature branch:

`feature/phase-3-6b-regression-build-completion`

## Objective

Close Phase 3 only after the full Phase 1/2/3 automated surface, React smoke coverage, TypeScript typecheck, and production build pass on the final completion branch and again on the exact merged `develop` commit, while the repository's global roadmap/documentation is reconciled to the actual delivered Phase 3 state.

3.6B is a completion/validation phase. It must not invent new Phase 3 product behavior merely to create implementation work.

## Authoritative master-plan gate

The Phase 3 master plan requires:

- all Phase 1/2 regressions remain green;
- all Phase 3 domain/application/integration tests pass;
- React smoke coverage includes component and component-aware Production paths;
- TypeScript typecheck passes;
- production build passes;
- exact merged `develop` CI passes;
- global roadmap/documentation is reconciled.

## Split assessment

No deeper formal roadmap split is required.

3.6B is one cohesive final completion gate with three internal validation slices:

1. **Automated regression audit** — confirm the current test/smoke/typecheck/build surface covers the required Phase 3 completion criteria and run it without weakening expectations.
2. **Documentation reconciliation** — remove stale Phase 2-era roadmap/status text and make the global project documentation accurately describe the completed Phase 3 behavior and the next Phase 4 boundary.
3. **Exact merge validation** — require feature-head CI, PR CI, exact post-merge `develop` CI, and final closeout `develop` CI before Phase 3 is marked complete.

These are completion slices only, not separate sub-phases.

## Baseline audit findings

### React smoke coverage

`src/App.smoke.test.tsx` already contains explicit smoke coverage for:

- Product Composition editor (`ProductComponentsView`);
- Finished Component Stock (`ProductStockView`);
- component-aware Production estimate (`ProductionPage`);
- Materials, Calibration, Products/Mix Presets, Yield, and the application shell.

This satisfies the master-plan requirement that React smoke coverage include component and component-aware Production paths.

No new React smoke test should be added unless the final regression run exposes a concrete missing completion path.

### CI gate

`.github/workflows/ci.yml` already runs, on feature pushes and PRs to `develop`:

```text
npm install --no-audit --no-fund
npm run typecheck
npm run test:run
npm run build
```

No CI workflow change is required for 3.6B.

### Current regression surface

The completed 3.6A closeout reports:

```text
55 test files
628 tests
5 dedicated Phase 3.6A integration tests
7 React smoke tests
TypeScript typecheck passed
production build passed
```

3.6B must re-run the complete current surface. The final observed test count may increase only if a genuine defect or missing required regression is discovered and fixed.

## Documentation reconciliation findings

### `docs/DEVELOPMENT_PLAN.md`

This global roadmap is materially stale and currently states:

- Phase 3 is `PLANNED — IMPLEMENTATION NOT STARTED`;
- every Phase 3 sub-phase is not started;
- `3.1A` is the current Phase 3 task.

3.6B must reconcile it to the delivered reality:

```text
Phase 3 — COMPLETE
3.1 through 3.6 — COMPLETE
```

The Phase 3 section should summarize the completed architecture/behavior and final completion evidence, then identify Phase 4 as the next planned phase.

### `README.md`

README is also materially stale and currently says:

- `Implemented through Phase 2`;
- purchased vessel composition, nested child products, and multi-component cost/capacity are not implemented;
- Phase 3 is next and should be planned before development.

3.6B must reconcile README to:

- implemented through Phase 3;
- Phase 3 component/composition/finished-stock/recursive-cost/assembly-capacity behavior is delivered;
- Phase 4 pricing/profit planning is the next planned functional phase;
- Phase 5 Excel persistence and Phase 6 Tauri filesystem integration remain deferred.

### `docs/PHASE_3_PROGRESS.md`

This tracker is current through 3.6A and correctly shows:

```text
3.6A COMPLETE
3.6B NEXT
Phase 3 IN PROGRESS
```

It must not be marked Phase 3 COMPLETE until the 3.6B implementation PR has merged and the exact post-merge `develop` CI passes.

### `docs/DATA_MODEL.md`

The data-model overview already describes Product components and combined component/vessel production capacity without contradicting the delivered Phase 3 contracts.

No edit is required unless the final documentation audit finds a specific inaccurate statement.

## Expected implementation shape

3.6B is expected to require **no production source-code change**.

Expected feature-branch files before implementation PR:

- `docs/PHASE_3_6B_REGRESSION_BUILD_COMPLETION_PLAN.md`;
- `docs/PHASE_3_6B_REGRESSION_BUILD_COMPLETION.md`.

The feature branch should validate the complete automated surface and record evidence while keeping Phase 3 status at `IN PROGRESS` until the exact implementation merge is validated.

After exact post-merge `develop` CI passes, a documentation-only closeout branch should reconcile:

- `docs/PHASE_3_6B_REGRESSION_BUILD_COMPLETION.md`;
- `docs/PHASE_3_6B_REGRESSION_BUILD_COMPLETION_PLAN.md`;
- `docs/PHASE_3_PROGRESS.md`;
- `docs/DEVELOPMENT_PLAN.md`;
- `README.md`;
- any other global documentation only if the final audit proves it is stale or contradictory.

## Regression validation surface

The final gate must cover the repository's complete current automated surface, including at minimum:

### Phase 1

- units and same-dimension conversions;
- material validation, CRUD, archive/source metadata;
- package costing and inventory valuation;
- calibration/manual conversion behavior;
- integrated materials workflow.

### Phase 2

- Product and Mix Preset contracts/services;
- yield sample evidence, learning, effective-history fallback;
- fixed recipe items;
- effective direct-material requirement synthesis;
- material-cost preview;
- safety-waste policy and waste-adjusted planning;
- current-stock direct-material capacity and tied limiters;
- integrated Product/Yield/Production workflow.

### Phase 3

- ProductComponent validation and role/count semantics;
- composition graph uniqueness and cycle prevention;
- ProductComponent application services and dependency guards;
- ProductStock validation/repository/service semantics;
- missing-vs-zero ProductStock availability;
- Material-backed component cost;
- recursive Product-backed component cost;
- total component-aware Product cost/readiness;
- per-component availability/capacity;
- direct-material + component assembly-capacity synthesis;
- typed limiting-resource trace/readiness;
- Product composition/stock/Production presentation helpers;
- five real-service Phase 3.6A integration scenarios;
- React smoke paths for Components, Finished stock, and component-aware Production.

## Phase 3 completion invariants to preserve

3.6B should confirm, not redefine, these completed boundaries:

1. Component sources are explicitly Material-backed or Product-backed.
2. Component quantities are positive whole `pc` counts.
3. Material-backed component inventory/cost uses Phase 1 Material rules.
4. Product-backed component assembly availability uses explicit current ProductStock.
5. Missing ProductStock remains unresolved; explicit zero remains known zero.
6. Direct and transitive Product composition cycles are prohibited before persistence.
7. Recursive readers retain path/cycle guards for corrupted/imported data.
8. Product-backed component cost recursively derives from the child Product and is independent of ProductStock quantity.
9. Phase 2 direct-material cost and Phase 3 component cost remain distinguishable and synthesize into component-aware Product cost.
10. Parent assembly capacity combines current direct-material availability with current immediate component availability.
11. Parent assembly capacity does not recursively manufacture missing child stock.
12. All resources tied at final assembly capacity remain visible with typed identity.
13. Direct parent materials and discrete assembly components remain visibly separate in Production UI.
14. Component planned counts do not inherit parent direct-material safety waste.
15. No stock reservation, automatic deduction, stock transaction history, or production posting is introduced by Phase 3.
16. Labor/overhead/selling price/markup/margin/profit remain Phase 4.
17. Excel persistence remains Phase 5.
18. Tauri filesystem/native packaging remains Phase 6.

## Implementation behavior if a regression fails

If final validation exposes a genuine defect:

- do not weaken or remove an authoritative test merely to make CI pass;
- isolate the defect to the smallest Phase 1/2/3 contract affected;
- apply the narrowest production-source fix;
- add or strengthen a focused regression test;
- document the defect/fix in the 3.6B completion record;
- re-run the entire completion gate.

If no defect appears, 3.6B should remain documentation/validation-only.

## Lifecycle

1. Establish this plan before completion changes. ✅
2. Run feature-branch full CI.
3. Create the 3.6B completion record with exact regression evidence.
4. Require a clean documented feature-head CI.
5. Verify the feature diff contains only 3.6B validation/docs unless a real defect fix was necessary.
6. Open implementation/completion PR to `develop`.
7. Require independent PR CI on the unchanged expected head.
8. Merge with exact expected head SHA.
9. Require exact post-merge `develop` CI.
10. Create a documentation-only Phase 3 closeout branch.
11. Reconcile Phase 3 tracker, global development plan, README, and completion record/plan.
12. Open/merge documentation-only closeout PR after its own PR CI.
13. Require exact final closeout `develop` CI.
14. Only then declare **Phase 3 COMPLETE** and identify **Phase 4 — Pricing & Production Planning** as next/planned.

## Completion gate

3.6B and Phase 3 are complete only when all of the following are true:

```text
all Phase 1/2 regressions                      PASS
all Phase 3 domain/application/integration     PASS
React smoke: component paths                   PASS
React smoke: component-aware Production        PASS
TypeScript typecheck                           PASS
production build                               PASS
implementation/completion PR CI                PASS
exact implementation merge develop CI          PASS
global roadmap/documentation reconciled        PASS
documentation closeout PR CI                   PASS
exact final closeout develop CI                 PASS
```

Final tracker target:

```text
Phase 3 — Product Components, Vessels & Nested Molded Products COMPLETE

3.6 — Integration & Completion Gate             COMPLETE
    3.6A — Integrated Multi-Component Workflow   COMPLETE
    3.6B — Regression / Build / Completion       COMPLETE
```

## Next phase after completion

**Phase 4 — Pricing & Production Planning — PLANNED / NOT STARTED**

Do not begin Phase 4 implementation as part of 3.6B.