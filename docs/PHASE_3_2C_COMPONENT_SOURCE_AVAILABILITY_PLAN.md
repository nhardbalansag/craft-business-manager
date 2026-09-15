# Phase 3.2C — Component Source Availability & Relationship Guards Development Plan

## Status

**IN PROGRESS**

Authoritative base:

`develop` @ `b9e7a03ed285486db50fb2c34ab9f3f82b58d41a`

Feature branch:

`feature/phase-3-2c-component-source-availability`

## Objective

Define one storage-agnostic application resolver that returns current component-source availability for either `material` or `product` sources while preserving the lifecycle relationship rules already established in Phase 3.1C.

3.2C must make current source readiness explicit without introducing assembly capacity, reservations, automatic deductions, stock transactions, costing, UI, or Excel persistence.

## Split assessment

No deeper formal split is required.

3.2C is cohesive enough to implement as one task. Internal implementation order:

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

Semantics:

### `ready`

The source relationship is eligible and current availability is resolved.

`availableQuantity` is a finite non-negative quantity in canonical `pc` units.

Explicit zero is **ready** availability with `availableQuantity = 0`; it is not an unresolved state.

### `partial`

The source relationship itself is valid/eligible, but current availability cannot be fully resolved from source evidence.

Baseline examples:

- active Product exists but has no ProductStock record;
- active count-based Material exists but its current on-hand quantity cannot be normalized because required inventory conversion evidence is unresolved;
- a persisted/corrupted ProductStock record exists but fails the 3.2A ProductStock contract.

`availableQuantity` is `null` for unresolved partial results.

### `not-ready`

The source relationship itself is invalid for active composition availability.

Baseline examples:

- source Material/Product is missing;
- source Material/Product is archived/inactive;
- Material source is not canonical count inventory (`baseUnit !== 'pc'`).

`availableQuantity` is `null`.

## Result shape

Recommended derived application contract:

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

This is a derived application view and must **not** be added to `BusinessDataset`.

Issue records use stable codes/messages so later 3.3/3.4/UI work can consume readiness without parsing exception text.

## Material-backed source rules

Material availability resolution must:

1. resolve Material by source ID;
2. require the Material to exist;
3. require `isActive === true`;
4. require canonical `baseUnit === 'pc'`;
5. obtain Material calibration evidence through the existing application evidence provider;
6. normalize current on-hand quantity using Phase 1 `normalizeMaterialOnHand()` rules;
7. reject negative normalized availability as unresolved/corrupted inventory data;
8. return the normalized base quantity as available `pc` quantity;
9. preserve the full `MaterialOnHandNormalization` evidence when resolution succeeds.

If Phase 1 inventory normalization raises a controlled `MaterialInventoryError`, the relationship remains valid but availability becomes `partial` with the underlying error code preserved in an availability issue.

The resolver must not calculate cost or inventory value merely to answer availability.

## Product-backed source rules

Product availability resolution must:

1. resolve Product by source ID;
2. require the Product to exist;
3. require `isActive === true`;
4. retrieve ProductStock by Product identity;
5. treat a missing ProductStock record as `partial`, not zero;
6. validate an existing ProductStock through the 3.2A contract as a corruption guard;
7. return existing valid `onHandQuantity` as available `pc` quantity.

Explicit ProductStock zero is a resolved `ready` result.

Archived ProductStock remains historical source data but does not make an archived child Product eligible for active-parent availability.

## Relationship guard policy

Phase 3.1C already established the authoritative lifecycle guards:

- active parent composition blocks Material archive;
- active parent composition blocks child Product archive;
- active component Material cannot be changed away from `pc`;
- Product reactivation revalidates retained component sources.

3.2C must **reuse**, not duplicate, those lifecycle guards.

Focused 3.2C regression tests must prove that the availability resolver and existing guards stay consistent across both source kinds.

No new stock-reservation or quantity-dependent archive guard is introduced.

## Issue contract

Baseline issue codes:

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

For Material inventory normalization failures, the issue also retains the underlying Phase 1 `MaterialInventoryError.code`.

For invalid ProductStock, the issue retains the underlying 3.2A `ProductStockError.code`.

## Shared application session

Add a shared resolver instance:

```text
componentSourceAvailabilityService
```

Dependencies:

- `materialRepository`
- `productRepository`
- `productStockRepository`
- shared Material calibration-evidence provider

The session should reuse one calibration-evidence provider rather than duplicate filtering logic.

## Test plan

Focused tests must cover at minimum:

- active `pc` Material with direct `pc` on-hand -> ready;
- packaged/count Material on-hand -> ready with preserved conversion evidence;
- explicit zero Material stock -> ready zero;
- missing Material -> not-ready;
- inactive Material -> not-ready;
- non-`pc` Material -> not-ready;
- unresolved Material package conversion -> partial with Phase 1 error evidence;
- negative/corrupted Material normalized stock -> partial;
- active Product with valid ProductStock -> ready;
- active Product with explicit zero ProductStock -> ready zero;
- active Product with missing ProductStock -> partial;
- missing Product -> not-ready;
- inactive Product -> not-ready even if historical ProductStock exists;
- corrupted ProductStock -> partial with 3.2A error evidence;
- Material archive remains blocked while an active parent depends on it;
- Product archive remains blocked while an active parent depends on it;
- archived parent history does not create an active dependency guard.

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

These remain Phase 3.3+, 3.4+, 3.5, or Phase 5 according to the roadmap.

## Completion gate

3.2C is complete only when:

- one controlled `ready | partial | not-ready` contract serves both source types;
- Material-backed availability uses Phase 1 inventory normalization and preserves conversion evidence;
- Product-backed availability uses authoritative ProductStock;
- explicit zero is distinguishable from missing stock;
- missing/inactive/incompatible sources are controlled `not-ready` results;
- unresolved availability evidence is a controlled `partial` result;
- existing active dependency guards remain correct across Material and Product sources;
- shared application-session wiring exists;
- focused tests pass;
- full repository tests pass;
- TypeScript typecheck passes;
- production build passes;
- implementation PR merges to `develop`;
- exact post-merge `develop` CI is green.

## Next task after closeout

**3.3A — Material-Backed Component Cost**

Do not begin 3.3A until 3.2C is merged, exact post-merge `develop` CI is green, and the 3.2 closeout tracker has been updated.