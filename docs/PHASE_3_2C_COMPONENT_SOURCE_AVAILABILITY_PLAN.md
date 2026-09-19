# Phase 3.2C — Component Source Availability & Relationship Guards Development Plan

## Status

**COMPLETE**

Authoritative base:

`develop` @ `b9e7a03ed285486db50fb2c34ab9f3f82b58d41a`

Feature branch:

`feature/phase-3-2c-component-source-availability`

Implementation PR:

`#71`

Implementation merge commit:

`8142820762885a4093574ccc7cb48f1f9d0b5661`

## Objective

Define one storage-agnostic application resolver that returns current component-source availability for either `material` or `product` sources while preserving the lifecycle relationship rules established in Phase 3.1C.

3.2C makes current source readiness explicit without introducing assembly capacity, reservations, automatic deductions, stock transactions, costing, UI, or Excel persistence.

## Split assessment

No deeper formal split was required.

3.2C was implemented as one cohesive task:

1. controlled readiness contract;
2. Material-backed availability;
3. Product-backed availability;
4. Phase 1 inventory conversion evidence;
5. missing-versus-zero ProductStock semantics;
6. 3.1C relationship-guard regression coverage;
7. shared application-session wiring;
8. focused/full validation.

## Controlled availability contract

One status vocabulary serves both source kinds:

```text
ready
partial
not-ready
```

- `ready`: relationship eligible and current canonical `pc` quantity resolved, including explicit zero;
- `partial`: relationship valid but current availability evidence unresolved/invalid;
- `not-ready`: source relationship missing, inactive, or incompatible.

Derived result fields:

```text
sourceType
sourceId
status
availableQuantity: number | null
unit: pc
issues[]
materialInventoryNormalization?
productStock?
```

The result is derived and is not persisted in `BusinessDataset`.

## Material-backed source rules

Implemented rules:

- Material must exist and be active;
- canonical base unit must be `pc`;
- current on-hand stock is normalized through Phase 1 `normalizeMaterialOnHand()`;
- full successful `MaterialOnHandNormalization` evidence is preserved;
- controlled `MaterialInventoryError` / `MaterialCostingError` conversion failures become `partial` with underlying codes;
- negative normalized stock is treated as corrupted/unresolved `partial` availability;
- no cost/inventory valuation is required merely to answer availability.

## Product-backed source rules

Implemented rules:

- Product must exist and be active;
- current ProductStock is read from the Phase 3.2B repository;
- existing ProductStock is revalidated through the 3.2A contract as a corruption guard;
- missing ProductStock is `partial`, not zero;
- explicit zero ProductStock is resolved `ready` availability;
- archived Product remains `not-ready` even when historical ProductStock exists.

## Relationship guard policy

Phase 3.1C remains the single lifecycle-guard authority:

- active Material dependencies block Material archive;
- active child Product dependencies block Product archive;
- active component Material must remain count-based;
- Product reactivation revalidates retained source relationships.

3.2C reuses these guards and adds regression tests rather than duplicating write-time lifecycle logic.

## Issue contract

Stable issue codes:

```text
SOURCE_MATERIAL_NOT_FOUND
SOURCE_MATERIAL_INACTIVE
SOURCE_MATERIAL_NOT_COUNT_BASED
SOURCE_MATERIAL_INVENTORY_UNRESOLVED
SOURCE_MATERIAL_NEGATIVE_ON_HAND
SOURCE_PRODUCT_NOT_FOUND
SOURCE_PRODUCT_INACTIVE
SOURCE_PRODUCT_STOCK_MISSING
SOURCE_PRODUCT_STOCK_INVALID
```

## Shared application session

Added:

```text
componentSourceAvailabilityService
materialCalibrationEvidenceProvider
```

The Material service and availability resolver reuse the same calibration-evidence provider.

## Validation result

Dedicated 3.2C suite: 18 tests.

Full validation:

- 44 test files passed;
- 422 tests passed;
- TypeScript typecheck passed;
- production build passed.

Evidence:

- test-bearing feature CI `34914060282` — SUCCESS;
- final feature-head CI `34914196908` — SUCCESS;
- PR CI `34914254157` — SUCCESS;
- post-merge `develop` CI `34914309862` — SUCCESS.

## Explicit deferrals

Not part of 3.2C:

- per-component assembly capacity calculations;
- quantity-per-parent division/flooring;
- limiting component selection;
- recursive Product manufacture assumptions;
- component cost roll-up;
- stock reservations;
- automatic deductions;
- stock transaction ledger;
- production history;
- React UI;
- Excel persistence.

These remain Phase 3.3+, 3.4+, 3.5, or Phase 5.

## Completion gate

**PASSED.**

Implementation PR #71 merged to `develop`, and exact post-merge `develop` CI is green.

## Next task

**3.3A — Material-Backed Component Cost — NEXT / NOT STARTED**

Do not begin 3.3A until its dedicated development plan/scope review is established.