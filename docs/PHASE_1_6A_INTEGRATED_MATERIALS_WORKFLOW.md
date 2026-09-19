# Phase 1.6A — Integrated Materials Workflow

## Status

**COMPLETE**

Implementation branch: `feature/phase-1-6a-integrated-materials-workflow`

PR: `#21`

Merge commit: `a0e3a605eb0a137613e583b0711229088f9c61fd`

Post-merge CI run: `34826188230` — SUCCESS

## Objective

Validate Phase 1 as one coherent materials workflow rather than a collection of isolated features.

The integrated workflow proves that material identity/classification, measurement conversion, package costing, calibration, stock normalization, inventory valuation, supplier/source metadata, search, update, and archive behavior work together without breaking each other's contracts.

## Integrated scenarios

### Calibrated plaster workflow

The integration test exercises:

1. create a gram-based plaster material purchased by kilogram;
2. save supplier/source metadata;
3. record a real calibration such as `5 cups = 1 kg`;
4. update saved stock to cups;
5. normalize `3 cups` using the effective `200 g/cup` calibration;
6. calculate `600 g` normalized inventory;
7. calculate `₱0.066/g` from a `₱66 / 1 kg` purchase;
8. calculate `₱39.60` inventory value;
9. find the material through supplier/source search.

### Calibration replacement and deletion safety

Multiple calibration samples remain evidence records and the latest valid sample wins.

The workflow verifies that a newer `210 g/cup` sample becomes effective automatically.

An application-level guard prevents deleting the final calibration evidence when a saved material currently depends on calibration for its cup-to-weight purchase or stock conversion. This avoids leaving persisted material data in a state that can no longer be normalized or valued.

Deletion remains allowed when another valid calibration sample remains, a valid manual fallback resolves the saved conversion, or the material is first changed back to a standard unit that no longer requires calibration.

### Count-package workflow

```text
1 pack = 100 pc
package cost = ₱120
on hand = 0.5 pack

normalized stock = 50 pc
cost per piece = ₱1.20
inventory value = ₱60.00
```

### Standard volume workflow

```text
1 L fragrance oil = ₱400
on hand = 250 mL

cost per mL = ₱0.40
inventory value = ₱100.00
```

### Supplier/source financial isolation

The workflow changes only supplier/source metadata and asserts that inventory valuation remains identical before and after the source edit.

### Archive/filter integration

The count-package workflow is archived and active/archived application filters are verified without hard deletion.

## Files

- `src/application/phase1MaterialsWorkflow.test.ts`
- `src/application/calibrations/CalibrationService.ts`

## Validation evidence

PR #21 passed:

- dependency installation
- TypeScript typecheck
- all existing regression tests
- new integrated workflow tests
- production build
- final PR-head CI
- post-merge `develop` CI

## Next task

**1.6B — Regression, Build & Completion**.
