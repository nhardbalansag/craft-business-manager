# Phase 3.4A — Per-Component Availability & Capacity

## Status

**IMPLEMENTATION COMPLETE — MERGE GATE PENDING**

Feature branch:

`feature/phase-3-4a-per-component-capacity`

Authoritative implementation base:

`develop` @ `7889846430ce672de232c8b9942ff7ce5bde7ffb`

Development plan:

`docs/PHASE_3_4A_PER_COMPONENT_CAPACITY_PLAN.md`

## Implementation

Added pure capacity math:

`src/domain/componentCapacity.ts`

Added application service:

`src/application/productComponents/ComponentCapacityService.ts`

Primary operation:

```text
capacityForComponent(component: ProductComponent)
```

## Capacity formula

For a reliable component source:

```text
component parent capacity
= floor(available component quantity / quantityPerParent)
```

Examples:

```text
10 pc available / 2 per parent -> 5
10 pc available / 3 per parent -> 3
2 pc available / 3 per parent  -> 0
0 pc available / 4 per parent  -> 0
```

Capacity is derived only and is never persisted.

## Authoritative availability reuse

`ComponentCapacityService` delegates all source quantity/readiness resolution to Phase 3.2C:

`ComponentSourceAvailabilityService.resolveComponent()`

Therefore 3.4A does not directly read Material inventory or ProductStock.

3.2C remains authoritative for:

- source existence and active state;
- count-based Material compatibility;
- Material inventory normalization/conversion evidence;
- ProductStock existence and validation;
- explicit zero versus missing stock;
- `ready | partial | not-ready` source availability.

## Result contract

Each result preserves:

```text
componentId
parentProductId
role
sourceType
sourceId
quantityPerParent
status: ready | partial | not-ready
availableQuantity
unit = pc
capacityPieces
sourceAvailability
issues
```

The complete 3.2C availability snapshot remains attached for diagnostics.

## Readiness behavior

### Ready

A line is ready when the ProductComponent contract is valid, 3.2C availability is ready, the available quantity is finite/non-negative, and capacity can be derived safely.

Explicit zero remains valid:

```text
availableQuantity = 0
capacityPieces = 0
status = ready
```

### Partial

A line is partial when the source relationship is recognized but current quantity is unresolved or a supposedly ready provider returns unusable quantity evidence.

Examples:

- missing ProductStock;
- invalid ProductStock;
- unresolved Material inventory conversion;
- negative Material on-hand normalization;
- corrupted ready availability with null/non-finite quantity.

For partial lines:

```text
capacityPieces = null
```

### Not ready

A line is not-ready when the component/source relationship cannot validly participate in current capacity calculation.

Examples:

- invalid ProductComponent contract;
- missing/inactive source Material;
- non-count Material source;
- missing/inactive source Product.

For not-ready lines:

```text
capacityPieces = null
```

## Product-backed stock policy

Product-backed capacity uses **current explicit ProductStock only**.

3.4A does not add recursive raw-material buildable quantity to ProductStock and does not manufacture missing children virtually.

This preserves the Phase 3 baseline definition of current assembly capacity and avoids double-counting shared raw materials.

## Controlled issues

Implemented summary issue codes:

```text
INVALID_COMPONENT
SOURCE_AVAILABILITY_PARTIAL
SOURCE_AVAILABILITY_NOT_READY
AVAILABLE_QUANTITY_INVALID
DERIVED_CAPACITY_INVALID
```

Underlying ProductComponent and 3.2C availability issue codes are preserved where available.

## Pure domain helper

`deriveComponentCapacity()` validates:

- finite non-negative available quantity;
- finite positive whole `quantityPerParent`;
- finite non-negative integer derived capacity.

It then applies the floor formula exactly once.

## Shared session wiring

`src/application/session.ts` now exports:

```text
componentCapacityService
```

It reuses:

```text
componentSourceAvailabilityService
```

No new repository or BusinessDataset collection was introduced.

## Validation coverage

Added:

- `src/application/productComponents/ComponentCapacityService.test.ts` — **23 tests**;
- `src/domain/componentCapacity.test.ts` — **12 tests**.

Coverage includes:

- Material-backed capacity;
- Product-backed ProductStock capacity;
- floor/remainder behavior;
- zero and below-one-parent capacity;
- explicit zero Material/ProductStock;
- missing/invalid ProductStock;
- unresolved/negative Material inventory;
- missing/inactive/non-count sources;
- invalid ProductComponent contract;
- source identity and `pc` unit preservation;
- 3.2C trace preservation;
- defensive corrupted-provider handling;
- source immutability;
- explicit exclusion of overall Product capacity and limiting-resource semantics.

Test-bearing feature CI:

```text
run 34919279213 — SUCCESS
```

Fully wired feature CI:

```text
run 34919300250 — SUCCESS
49 test files passed
524 tests passed
TypeScript typecheck passed
production build passed
```

## Explicit deferrals

Not implemented in 3.4A:

- Product-level component-capacity aggregation;
- direct-material + component capacity synthesis;
- overall assembly capacity;
- limiting-resource trace/ties;
- recursive make-to-order capacity;
- inventory reservation/deduction/transactions;
- cost/pricing changes;
- UI;
- Excel persistence.

These remain 3.4B, 3.4C, later Phase 3, Phase 4, and Phase 5 work.

## Completion gate state

Feature implementation gates passed:

- per-component capacity view exists;
- Material/Product availability delegates to 3.2C;
- floor formula is applied exactly once;
- explicit zero produces ready zero capacity;
- unresolved quantity remains null rather than silent zero;
- readiness is deterministic;
- source identity and availability trace are preserved;
- ProductStock is not recursively augmented;
- no Product-level synthesis or limiting-resource logic leaked into 3.4A;
- no source data is mutated or capacity persisted;
- shared session wiring exists;
- 49 test files / 524 tests pass;
- TypeScript typecheck passes;
- production build passes.

Remaining before 3.4A may be marked fully complete:

- implementation PR must merge to `develop`;
- exact post-merge `develop` CI must pass.

## Next task after closeout

**3.4B — Direct-Material + Component Capacity Synthesis**

Do not begin 3.4B until 3.4A is merged, exact post-merge `develop` CI is green, and a dedicated 3.4B development plan/scope review is established.
