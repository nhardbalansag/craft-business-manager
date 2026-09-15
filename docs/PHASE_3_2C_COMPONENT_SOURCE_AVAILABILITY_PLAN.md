# Phase 3.2C — Component Source Availability & Relationship Guards Development Plan

## Status

**IMPLEMENTED — MERGE GATE PENDING**

Authoritative base:

`develop` @ `b9e7a03ed285486db50fb2c34ab9f3f82b58d41a`

Feature branch:

`feature/phase-3-2c-component-source-availability`

## Objective

Define one storage-agnostic application resolver that returns current component-source availability for either `material` or `product` sources while preserving the lifecycle relationship rules already established in Phase 3.1C.

3.2C makes current source readiness explicit without introducing assembly capacity, reservations, automatic deductions, stock transactions, costing, UI, or Excel persistence.

## Split assessment

No deeper formal split is required.

3.2C is cohesive enough to implement as one task. Implementation order:

1. define the controlled availability/readiness result contract;
2. implement Material-backed source resolution;
3. implement Product-backed source resolution;
4. preserve Phase 1 material inventory conversion evidence;
5. preserve the distinction between missing ProductStock and explicit zero ProductStock;
6. reuse/regression-test the existing 3.1C cross-source lifecycle guards;
7. wire the resolver into the shared application session;
8. add focused tests and run the full repository validation gate.

These are implementation steps, not new sub-phases.

## Controlled availability contract

The resolver exposes one status vocabulary for both source kinds:

```text
ready
partial
not-ready
```

### `ready`

The source relationship is eligible and current availability is resolved. `availableQuantity` is a finite non-negative quantity in canonical `pc` units. Explicit zero is **ready** availability with `availableQuantity = 0`.

### `partial`

The source relationship itself is valid/eligible, but current availability cannot be fully resolved from source evidence. Examples include missing ProductStock, unresolved Material conversion evidence, or corrupted persisted ProductStock. `availableQuantity` is `null`.

### `not-ready`

The source relationship itself is invalid for active composition availability. Examples include missing/inactive sources or a Material source whose canonical base unit is not `pc`. `availableQuantity` is `null`.

## Result shape

```text
ComponentSourceAvailability
- sourceType: material | product
- sourceId
- status: ready | partial | not-ready
- availableQuantity: number | null
- unit: pc
- issues[]
- materialInventoryNormalization?: MaterialOnHandNormalization
- productStock?: ProductStock | null
```

This is a derived application view and is not added to `BusinessDataset`.

## Material-backed source rules

Material availability resolution:

1. resolves Material by source ID;
2. requires the Material to exist and be active;
3. requires canonical `baseUnit === 'pc'`;
4. obtains Material calibration evidence through the shared application evidence provider;
5. normalizes current on-hand quantity through Phase 1 `normalizeMaterialOnHand()` rules;
6. treats negative normalized availability as corrupted/unresolved source data;
7. returns the normalized base quantity as available `pc` quantity;
8. preserves full `MaterialOnHandNormalization` evidence on success.

Controlled Phase 1 `MaterialInventoryError` or package-conversion `MaterialCostingError` failures become `partial` availability with the underlying error code preserved.

The resolver does not calculate cost or inventory value merely to answer availability.

## Product-backed source rules

Product availability resolution:

1. resolves Product by source ID;
2. requires the Product to exist and be active;
3. retrieves ProductStock by Product identity;
4. treats a missing ProductStock record as `partial`, not zero;
5. validates persisted ProductStock through the 3.2A contract as a corruption guard;
6. returns valid `onHandQuantity` as available `pc` quantity.

Explicit ProductStock zero is a resolved `ready` result. Archived ProductStock remains historical source data but does not make an archived Product eligible for active-parent availability.

## Relationship guard policy

Phase 3.1C already established the authoritative lifecycle guards:

- active parent composition blocks Material archive;
- active parent composition blocks child Product archive;
- active component Material cannot be changed away from `pc`;
- Product reactivation revalidates retained component sources.

3.2C reuses rather than duplicates these lifecycle guards. Dedicated regression tests prove availability eligibility and lifecycle protection remain aligned across both source kinds.

No stock-reservation or quantity-dependent archive guard is introduced.

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

Material availability issues may retain underlying Phase 1 `MaterialInventoryError.code` or `MaterialCostingError.code`. Invalid ProductStock issues retain the underlying 3.2A `ProductStockError.code`.

## Shared application session

Shared resolver:

```text
componentSourceAvailabilityService
```

Dependencies:

- `materialRepository`
- `productRepository`
- `productStockRepository`
- shared Material calibration-evidence provider

`materialCalibrationEvidenceProvider` is reused by both MaterialService and ComponentSourceAvailabilityService.

## Test result

The focused suite adds 18 tests covering:

- direct/package/zero Material availability;
- missing/inactive/non-count Material sources;
- unresolved/negative Material inventory;
- positive/zero/missing/invalid ProductStock;
- missing/inactive Product sources;
- ProductComponent source delegation;
- Material/Product active dependency archive guards;
- archived-parent historical relationship behavior.

Feature-head validation:

- CI run `34914060282` — SUCCESS;
- 44 test files passed;
- 422 tests passed;
- TypeScript typecheck passed;
- production build passed.

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

Implemented feature gates passed:

- one controlled `ready | partial | not-ready` contract serves both source types;
- Material-backed availability uses Phase 1 inventory normalization and preserves conversion evidence;
- Product-backed availability uses authoritative ProductStock;
- explicit zero is distinguishable from missing stock;
- missing/inactive/incompatible sources are controlled `not-ready` results;
- unresolved availability evidence is controlled `partial`;
- existing active dependency guards remain correct across Material and Product sources;
- shared application-session wiring exists;
- focused/full tests, TypeScript typecheck, and production build pass.

Remaining gate:

- implementation PR merges to `develop`;
- exact post-merge `develop` CI is green.

## Next task after closeout

**3.3A — Material-Backed Component Cost**

Do not begin 3.3A until 3.2C is merged, exact post-merge `develop` CI is green, and the Phase 3.2 closeout tracker is updated.