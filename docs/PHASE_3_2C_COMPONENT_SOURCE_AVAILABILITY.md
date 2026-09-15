# Phase 3.2C — Component Source Availability & Relationship Guards

## Status

**IMPLEMENTATION COMPLETE — MERGE GATE PENDING**

Feature branch:

`feature/phase-3-2c-component-source-availability`

Authoritative implementation base:

`develop` @ `b9e7a03ed285486db50fb2c34ab9f3f82b58d41a`

Development plan:

`docs/PHASE_3_2C_COMPONENT_SOURCE_AVAILABILITY_PLAN.md`

Feature validation evidence:

- CI run `34914060282` — SUCCESS;
- 44 test files passed;
- 422 tests passed;
- dedicated 3.2C suite: 18 tests;
- TypeScript typecheck passed;
- production build passed.

## Objective

Provide one derived application resolver for current component-source availability across both Phase 3 source kinds while preserving source eligibility and lifecycle relationships.

The implementation does not persist readiness and does not mutate stock/inventory.

## Controlled readiness contract

Added `ComponentSourceAvailabilityService` with a shared status vocabulary:

```text
ready
partial
not-ready
```

Semantics:

- `ready` — source relationship is eligible and current `pc` availability is resolved;
- `partial` — source relationship is valid, but current availability evidence is unresolved/invalid;
- `not-ready` — source relationship itself is missing, inactive, or incompatible.

Every result carries:

```text
sourceType
sourceId
status
availableQuantity: number | null
unit: pc
issues[]
```

Material results may carry `materialInventoryNormalization` evidence.

Product results may carry the resolved `productStock` record (or explicit `null` when missing).

This is a derived application view and is not stored in `BusinessDataset`.

## Material-backed availability

Material resolution:

1. resolves Material by identity;
2. requires the source to exist;
3. requires the source to be active;
4. requires canonical `baseUnit === 'pc'`;
5. retrieves existing Material calibration evidence;
6. normalizes on-hand quantity through Phase 1 `normalizeMaterialOnHand()` rules;
7. returns normalized base quantity as current available `pc` units.

Successful results preserve the full `MaterialOnHandNormalization` evidence, including conversion source, factor, calibration ID, and purchase-package conversion source where applicable.

Controlled Phase 1 `MaterialInventoryError` and `MaterialCostingError` failures become `partial` availability with their underlying error codes retained instead of leaking exceptions to downstream capacity/UI consumers.

Negative normalized inventory is also treated as corrupted/unresolved `partial` availability.

No material cost or inventory value is calculated merely to answer availability.

## Product-backed availability

Product resolution:

1. resolves child Product by identity;
2. requires the Product to exist;
3. requires the Product to be active;
4. retrieves current ProductStock;
5. validates any persisted ProductStock through the 3.2A contract;
6. returns valid on-hand ProductStock quantity as available `pc` units.

Critical distinction preserved:

```text
missing ProductStock -> partial / availableQuantity = null
explicit ProductStock zero -> ready / availableQuantity = 0
```

An archived Product remains `not-ready` for active composition availability even when historical ProductStock remains stored.

Corrupted ProductStock becomes controlled `partial` availability with the underlying 3.2A ProductStock error code retained.

## Availability issue contract

Stable issue codes introduced:

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

Issues may retain underlying Phase 1 inventory/costing conversion error codes or Phase 3.2A ProductStock error codes.

## Relationship guards

No duplicate lifecycle guard layer was added.

Phase 3.1C already owns the authoritative cross-aggregate guards:

- Material archive blocked while an active parent Product depends on it;
- child Product archive blocked while an active parent Product depends on it;
- active component Material must remain count-based;
- Product reactivation revalidates retained component sources.

3.2C reuses these guards and adds dedicated regression tests proving:

- active Material dependencies remain protected;
- active child Product dependencies remain protected;
- archived-parent history does not create an active dependency guard.

The resolver independently enforces current active-source eligibility at read time, so availability and write-time lifecycle rules remain consistent across both source types.

## Shared application session

`src/application/session.ts` now exports:

```text
componentSourceAvailabilityService
materialCalibrationEvidenceProvider
```

The Material service and availability resolver reuse the same calibration-evidence provider instead of duplicating repository filtering logic.

## Validation coverage

The dedicated 3.2C test suite adds 18 tests covering:

- ready direct count Material inventory;
- packaged count Material conversion evidence;
- explicit zero Material stock;
- missing Material;
- inactive Material;
- non-count Material;
- unresolved Material package conversion;
- corrupted negative Material stock;
- ready ProductStock availability;
- explicit zero ProductStock;
- missing ProductStock;
- missing Product;
- inactive Product with historical stock;
- corrupted ProductStock;
- ProductComponent source delegation;
- Material active-dependency archive guard;
- Product active-dependency archive guard;
- archived-parent historical relationship behavior.

Feature-head validation:

```text
44 test files
422 tests
TypeScript typecheck
production build
```

CI run: `34914060282`.

## Explicit deferrals

Not implemented in 3.2C:

- component quantity-per-parent capacity division;
- assembly capacity calculation;
- limiting component selection;
- recursive manufacture of missing child Products;
- component cost roll-up;
- reservations;
- automatic deductions;
- transaction ledger;
- production history;
- UI;
- Excel persistence.

These remain Phase 3.3+, 3.4+, 3.5, or Phase 5.

## Completion gate state

Feature-head gates passed:

- one controlled readiness contract serves both source types;
- Material availability uses Phase 1 normalization and preserves evidence;
- Product availability uses authoritative ProductStock;
- zero stock is distinguishable from missing stock;
- invalid source relationships are controlled `not-ready` results;
- unresolved availability evidence is controlled `partial`;
- existing active dependency guards remain correct across source types;
- shared session wiring exists;
- typecheck/tests/build are green.

Remaining before 3.2C may be marked fully complete:

- implementation PR must merge to `develop`;
- exact post-merge `develop` CI must pass.

## Next task after closeout

**3.3A — Material-Backed Component Cost**

Do not begin 3.3A until the 3.2C merge/post-merge gate is green and Phase 3.2 is formally closed.