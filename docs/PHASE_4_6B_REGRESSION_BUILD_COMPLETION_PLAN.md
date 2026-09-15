# Phase 4.6B — Regression / Build / Phase 4 Completion Plan

Status: **PLAN ESTABLISHED — VALIDATION NOT YET EXECUTED**

Repository: `nhardbalansag/craft-business-manager`

Integration branch: `develop`

Feature branch: `feature/phase-4-6b-regression-build-completion`

Authoritative starting `develop`:

`9b0856c2a3d8ebad9fc1693063ecc54a6c95422c`

Starting exact `develop` CI:

`34977978707 — SUCCESS`

Previous task:

`4.6A — Integrated Pricing / Production Workflow — COMPLETE`

Current task:

`4.6B — Regression / Build / Completion — IN PROGRESS`

---

## 1. Purpose

Phase 4.6B is the final acceptance gate for **Phase 4 — Pricing & Production Planning**.

It does not introduce new pricing, costing, production, capacity, persistence, or UI behavior. Its responsibility is to prove that the completed Phase 4 implementation remains compatible with all earlier phases, that the final React pricing/production paths are smoke-covered, that strict TypeScript and the production build remain healthy, and that the repository roadmap/documentation is reconciled only after exact merged `develop` validation succeeds.

The authoritative Phase 4 master-plan completion criteria are:

- all Phase 1/2/3 regressions remain green;
- all Phase 4 domain/application/integration tests pass;
- React smoke coverage includes Pricing and financial Production paths;
- TypeScript typecheck passes;
- production build passes;
- exact merged `develop` CI passes;
- global roadmap/documentation is reconciled.

---

## 2. Split assessment

**No deeper numbered split is required.**

4.6B is one cohesive completion gate rather than a feature-development stream. Splitting it into additional roadmap phases would add ceremony without introducing independent business contracts.

Use internal checkpoints only:

1. baseline and completion-scope audit;
2. full regression/typecheck/build validation;
3. completion evidence record;
4. validation PR + exact PR CI;
5. guarded merge + exact post-merge `develop` CI;
6. documentation-only Phase 4 final closeout;
7. final closeout PR + exact final `develop` CI;
8. re-read global roadmap and advance to Phase 5 planning only.

---

## 3. Locked baseline evidence

Before 4.6B execution:

- `develop` = `9b0856c2a3d8ebad9fc1693063ecc54a6c95422c`;
- exact baseline CI = `34977978707 — SUCCESS`;
- 4.1 through 4.5 are complete;
- 4.6A is complete;
- 4.6B is next;
- the existing CI workflow already runs install, strict typecheck, the entire Vitest suite, and the production Vite build;
- `src/App.smoke.test.tsx` already includes explicit Phase 4 Pricing and Phase 3 + Phase 4 Production financial-path smoke coverage;
- `docs/DEVELOPMENT_PLAN.md` and `README.md` are intentionally stale at the Phase 3 / pre-Phase-4 roadmap state and must be reconciled only after the 4.6B validation merge is proven green.

---

## 4. Validation strategy

### 4.1 Full repository regression

Use the repository's existing authoritative CI commands:

```text
npm run typecheck
npm run test:run
npm run build
```

The full test suite must remain green. The final evidence must explicitly retain the aggregate test-file and test counts reported by Vitest.

No selective test-only success is sufficient for completion.

### 4.2 Earlier-phase regression requirement

Because the repository test suite includes the retained Phase 1, Phase 2, and Phase 3 domain/application/integration/UI tests, a green full-suite run is the authoritative regression gate for the earlier phases.

At minimum, completion evidence should note retained integrated coverage including:

- Phase 1 materials workflow;
- Phase 2 product/yield/production workflow;
- Phase 3 multi-component workflow;
- Phase 4 pricing/production workflow.

Do not remove or bypass earlier-phase tests to make Phase 4 pass.

### 4.3 Phase 4 regression requirement

The full suite must retain coverage across the completed Phase 4 layers:

- financial-profile contract/service;
- pricing formula validation;
- waste-adjusted direct-material unit cost;
- recursive fully loaded Product component cost;
- total fully loaded unit cost/readiness;
- selling-price derivation;
- profit/markup/margin metrics;
- pricing quote/readiness;
- physical planned batch production cost;
- expected revenue/profit/batch margin;
- capacity feasibility/warning synthesis;
- Pricing UI view/form helpers;
- Production financial-plan view helpers;
- seven Phase 4.6A real-service integration scenarios.

### 4.4 React smoke requirement

`src/App.smoke.test.tsx` must continue to prove at least:

- the Pricing workspace is navigable/renderable;
- the financial profile editor shell renders;
- the unit-economics calculator shell renders;
- the Production workspace renders its Phase 4 batch financial plan;
- planned production cost, revenue, profit, margin, capacity feasibility, warnings, limiters, and readiness sections remain present;
- the existing Phase 3 Production detail remains present.

If this coverage is already sufficient and green, 4.6B must not change UI code merely to create artificial work.

### 4.5 Build requirement

The production Vite build must pass.

The existing chunk-size warning may be recorded as a non-blocking optimization note if it remains a warning and the build succeeds. It is not a Phase 4 financial-correctness failure.

---

## 5. Expected implementation scope

4.6B is expected to require **no production application/domain/UI behavior changes** when the completed implementation is healthy.

The validation feature branch should normally contain only:

- this dedicated 4.6B plan;
- a dedicated 4.6B validation/completion evidence record.

Do not change business formulas, readiness semantics, inventory behavior, UI workflows, or source-data contracts unless the full regression gate exposes a genuine defect. If a genuine defect is found, document the failure precisely and fix only the defect required to restore the already-approved Phase 4 contract before continuing.

---

## 6. Completion evidence record

After the validation feature head is green, create:

`docs/PHASE_4_6B_REGRESSION_BUILD_COMPLETION.md`

Before merge, that record should capture:

- authoritative starting `develop` and CI;
- plan-before-validation commit;
- validated feature head;
- feature-head CI;
- aggregate test-file/test counts;
- dedicated 4.6A scenario count;
- React smoke-test count;
- typecheck result;
- production build result;
- transformed-module count;
- any non-blocking build warning;
- confirmation whether production code changes were required.

It must **not** claim final Phase 4 completion before the validation PR is merged and exact merged `develop` CI succeeds.

---

## 7. Validation PR gate

Open the 4.6B validation PR to `develop` only after the documented feature head has its own exact green CI.

Before merge verify:

- PR head SHA is unchanged;
- branch is based on the exact locked baseline or a consciously revalidated newer baseline;
- no unplanned production/domain/UI changes are present;
- PR CI passes typecheck, the full test suite, and build;
- PR is mergeable.

Merge with an expected-head SHA guard.

---

## 8. Exact post-merge gate

After the validation PR merge:

1. read the exact new `develop` SHA;
2. require CI attached to that exact commit to finish `SUCCESS`;
3. only after success may Phase 4 be declared technically complete;
4. do not begin Phase 5 implementation yet.

---

## 9. Documentation-only Phase 4 final closeout

After the exact 4.6B validation merge is green, create a docs-only closeout branch from that exact `develop` commit.

Reconcile at minimum:

### `docs/PHASE_4_PROGRESS.md`

Set:

```text
Phase 4 — COMPLETE
4.6 — COMPLETE
4.6A — COMPLETE
4.6B — COMPLETE
```

Add the complete 4.6B evidence chain and remove/replace the active-task instruction that still points to 4.6B.

### `docs/DEVELOPMENT_PLAN.md`

Replace the stale pre-implementation Phase 4 section with the authoritative completed Phase 4 state and concise delivered behavior/final-gate evidence.

Update the overall roadmap position so:

- Phase 0 COMPLETE;
- Phase 1 COMPLETE;
- Phase 2 COMPLETE;
- Phase 3 COMPLETE;
- Phase 4 COMPLETE;
- Phase 5 remains PLANNED / NEXT FOR SCOPE REVIEW;
- Phase 6/7 remain planned.

Do not mark Phase 5 implementation started.

### `README.md`

Update the stale "Implemented through Phase 3" and Phase 4-not-implemented language.

The README should accurately summarize delivered Phase 4 capabilities:

- explicit Product labor/overhead source profile;
- fixed-profit, markup, and target-margin pricing;
- fully loaded recursive Product cost;
- safety-waste-aware unit economics;
- physical planned batch production cost;
- expected revenue/profit/margin;
- capacity feasibility/warnings;
- Pricing workspace;
- Phase 4 financial Production summary;
- Phase 4 regression/integration completion status.

Keep Excel persistence as Phase 5 and native Tauri filesystem integration as Phase 6.

### Final 4.6B record

Update the completion record with:

- validation PR number/CI;
- validation merge SHA;
- exact post-validation-merge CI;
- final closeout PR number/CI;
- final closeout merge SHA;
- exact final closeout `develop` CI.

---

## 10. Closeout PR gate

The final Phase 4 closeout PR must be documentation-only.

Require:

- exact closeout-head CI success;
- PR CI success;
- expected-head guarded merge;
- exact final `develop` CI success.

Only after the exact final closeout `develop` CI succeeds is Phase 4 globally closed.

---

## 11. Final roadmap state

Expected final repository state after successful closeout:

```text
Phase 0 — COMPLETE
Phase 1 — COMPLETE
Phase 2 — COMPLETE
Phase 3 — COMPLETE
Phase 4 — COMPLETE
Phase 5 — PLANNED / NEXT FOR SCOPE REVIEW
Phase 6 — PLANNED
Phase 7 — PLANNED
```

Current active task after Phase 4 completion should become:

**Phase 5 — Excel Persistence — NEXT FOR SCOPE REVIEW / NOT STARTED**

Do not start Phase 5 implementation automatically. Phase 5 must first receive its own authoritative scope review, decomposition assessment, and development plan.

---

## 12. Explicit non-goals

4.6B does not add:

- new pricing formulas;
- new Product financial fields;
- payroll/timekeeping;
- tax/VAT;
- discounts/promotions;
- shipping or marketplace fees;
- accounting entries;
- stock reservation/deduction or production posting;
- Excel persistence/import/export;
- Tauri filesystem integration;
- reporting/dashboard expansion.

Those remain outside the approved Phase 4 boundary.
