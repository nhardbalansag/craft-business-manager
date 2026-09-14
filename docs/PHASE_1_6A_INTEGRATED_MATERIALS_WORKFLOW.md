# Phase 1.6A — Integrated Materials Workflow

## Status

**IMPLEMENTED — VALIDATION PENDING**

Branch: `feature/phase-1-6a-integrated-materials-workflow`

Base: corrected `develop` head after removal of accidental temporary probe files.

## Objective

Validate Phase 1 as one coherent materials workflow rather than a collection of isolated features.

The integrated workflow must prove that material identity/classification, measurement conversion, package costing, calibration, stock normalization, inventory valuation, supplier/source metadata, search, update, and archive behavior work together without breaking each other's contracts.

## Integrated scenarios

### Calibrated plaster workflow

The integration test now exercises:

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

A new application-level guard prevents deleting the final calibration evidence when a saved material currently depends on calibration for its cup-to-weight purchase or stock conversion. This avoids leaving persisted material data in a state that can no longer be normalized or valued.

Deletion remains allowed when:

- another valid calibration sample remains;
- a valid manual fallback resolves the saved conversion; or
- the material is first changed back to a standard unit that no longer requires calibration.

### Count-package workflow

The integration suite verifies a packaging material such as:

```text
1 pack = 100 pc
package cost = ₱120
on hand = 0.5 pack
```

Result:

```text
normalized stock = 50 pc
cost per piece = ₱1.20
inventory value = ₱60.00
```

### Standard volume workflow

The suite also validates ordinary same-dimension conversion independently of calibration:

```text
1 L fragrance oil = ₱400
on hand = 250 mL
```

Result:

```text
cost per mL = ₱0.40
inventory value = ₱100.00
```

### Supplier/source financial isolation

The workflow changes only supplier/source metadata and asserts that inventory valuation remains identical before and after the source edit.

This locks the architectural rule that vendor name, purchase link, contact details, social page, branch information, and source notes are informational only.

### Archive/filter integration

The count-package workflow is archived and the application filters are verified so active and archived materials remain distinct without hard deletion.

## Files

- `src/application/phase1MaterialsWorkflow.test.ts`
- `src/application/calibrations/CalibrationService.ts`

## Completion gate

Phase 1.6A is complete only after:

- TypeScript typecheck passes;
- all existing domain/application regression tests pass;
- the new integrated workflow tests pass;
- production build passes;
- feature PR CI passes;
- PR merges into `develop`;
- post-merge `develop` CI passes.

Next task after completion: **1.6B — Regression, Build & Completion**.
