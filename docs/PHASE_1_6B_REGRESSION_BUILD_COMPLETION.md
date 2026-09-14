# Phase 1.6B — Regression, Build & Completion Validation

## Status

**FEATURE CI PASSED — MERGE GATE**

Branch: `feature/phase-1-6b-regression-completion`

Base: `develop` at `b6d629bd6bf48c0a7dadfe45457c16ba5439be69`

PR: `#23`

## Objective

Close Phase 1 only after the complete materials, units, costing, calibration, inventory, supplier/source, application-service, and React workspace surface is validated together.

This phase is a release-readiness gate. It does not introduce a new business domain feature.

## Completion coverage

The final Phase 1 gate requires all of the following to remain green:

- unit catalog, compatibility, conversion, rounding, and runtime-validation tests;
- material contract/classification validation;
- MaterialService create/update/list/search/archive/duplicate rules;
- package costing and manual/standard/calibrated conversion precedence;
- on-hand normalization and inventory valuation validation;
- material-specific cup-to-weight calibration behavior;
- calibration application-service behavior and deletion safety;
- supplier/source normalization, search, validation, and financial isolation;
- Phase 1 integrated material workflows from 1.6A;
- React Materials workspace render smoke validation;
- React Calibration workspace render smoke validation;
- TypeScript typecheck;
- complete automated test run;
- production Vite build;
- feature PR GitHub Actions CI;
- post-merge `develop` GitHub Actions CI.

## React smoke validation

`src/App.smoke.test.tsx` adds a dependency-free React render smoke check using `react-dom/server`, which is already part of the application runtime dependencies.

The test verifies that the Materials workspace renders the major completed Phase 1 areas:

- application shell;
- Add Material workflow;
- calculated purchase costing;
- normalized stock and valuation;
- supplier/source inputs.

It separately renders the Calibration workspace to ensure its initial state can render without browser-side effects or missing runtime dependencies.

These smoke tests complement—not replace—the application/domain integration tests from Phase 1.6A.

## Feature validation evidence

PR #23 feature CI run `34826926034` passed:

- dependency installation;
- TypeScript typecheck;
- complete automated regression test run;
- Phase 1.6A integrated workflow tests;
- React Materials and Calibration render smoke tests;
- production build.

## Documentation reconciliation

The Phase 1 planning/status documents must be reconciled during closeout so they no longer claim Phase 1 development has not started.

Phase 1 may be marked **COMPLETE** only after the PR merge and post-merge `develop` validation gates pass.

## Remaining completion gate

- final PR-head CI after this status update;
- merge PR #23 into `develop`;
- post-merge `develop` CI passes;
- final documentation closeout records Phase 1 as COMPLETE and Phase 2 as next.

Next task after successful completion: **Phase 2 — Product Recipes & Mold Yield**.
