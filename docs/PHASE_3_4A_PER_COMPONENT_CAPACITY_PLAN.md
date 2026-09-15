# Phase 3.4A — Per-Component Availability & Capacity Development Plan

## Status

**IMPLEMENTED — MERGE GATE PENDING**

Authoritative base:

`develop` @ `7889846430ce672de232c8b9942ff7ce5bde7ffb`

Feature branch:

`feature/phase-3-4a-per-component-capacity`

Implementation record:

`docs/PHASE_3_4A_PER_COMPONENT_CAPACITY.md`

## Objective

Derive current assembly capacity for one Phase 3 ProductComponent line from authoritative current availability.

```text
component parent capacity
= floor(available component quantity / quantityPerParent)
```

Material-backed availability comes from normalized Material inventory through Phase 3.2C. Product-backed availability comes from explicit ProductStock through Phase 3.2C.

## Split assessment

No deeper formal split was required.

3.4A remained one cohesive per-line capacity task: validate ProductComponent, delegate source availability to 3.2C, apply the floor formula when reliable, preserve readiness/trace evidence, and expose controlled issues.

## Scope boundary

3.4A calculates capacity for one component line only.

Explicitly excluded:

- multi-component Product aggregation;
- direct-material + component capacity synthesis;
- overall assembly capacity;
- limiting-resource identification;
- recursive manufacture/buildable child quantity;
- inventory reservation/deduction/transactions;
- cost/pricing changes;
- UI;
- Excel persistence.

These remain 3.4B, 3.4C, later Phase 3, Phase 4, and Phase 5 work.

## Authoritative availability

Implemented capacity delegates to:

`ComponentSourceAvailabilityService.resolveComponent()`

3.2C remains authoritative for Material/Product existence/activity, count-unit compatibility, Material on-hand normalization, ProductStock existence/validation, explicit zero versus missing stock, and availability readiness.

3.4A does not directly read Material or ProductStock repositories.

## Result contract

Implemented `ComponentCapacityResult` preserves:

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

## Capacity mathematics

A pure `deriveComponentCapacity()` helper validates the arithmetic boundary and applies:

```text
floor(availableQuantity / quantityPerParent)
```

No safety-waste factor applies to discrete component counts.

No recursive raw-material buildable quantity is added to ProductStock.

## Readiness contract

### Ready

A valid component with ready 3.2C availability and finite non-negative quantity produces a finite non-negative integer capacity.

Explicit zero remains authoritative:

```text
availableQuantity = 0
capacityPieces = 0
status = ready
```

### Partial

Recognized source relationships with unresolved current quantity return:

```text
capacityPieces = null
```

Examples include missing/invalid ProductStock, unresolved Material inventory conversion, negative normalized Material on-hand, and corrupted ready-provider quantity evidence.

### Not ready

Invalid component/source relationships return no capacity.

Examples include malformed ProductComponent, missing/inactive source, or non-count Material source.

## Controlled issues

Implemented summary codes:

```text
INVALID_COMPONENT
SOURCE_AVAILABILITY_PARTIAL
SOURCE_AVAILABILITY_NOT_READY
AVAILABLE_QUANTITY_INVALID
DERIVED_CAPACITY_INVALID
```

Underlying ProductComponent/3.2C/domain issue codes are preserved where available.

## Application/session implementation

Added:

- `src/domain/componentCapacity.ts`;
- `src/application/productComponents/ComponentCapacityService.ts`.

Shared session instance:

`componentCapacityService`

It reuses only the shared `componentSourceAvailabilityService` for source availability.

No new repository or BusinessDataset collection was introduced.

## Validation

Added:

- `src/application/productComponents/ComponentCapacityService.test.ts` — 23 tests;
- `src/domain/componentCapacity.test.ts` — 12 tests.

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

## Completion gate

Implemented feature gates passed:

- one component-line capacity view exists;
- Material/Product availability delegates to 3.2C;
- floor formula is applied exactly once;
- explicit zero produces ready zero capacity;
- unresolved quantity remains null instead of silent zero;
- readiness is deterministic;
- source identity and availability traceability are preserved;
- ProductStock is not recursively augmented;
- no Product-level capacity synthesis or limiting-resource behavior is introduced;
- no source data is mutated or capacity persisted;
- shared session wiring exists;
- 49 test files / 524 tests pass;
- TypeScript typecheck passes;
- production build passes.

Remaining gate:

- implementation PR merges to `develop`;
- exact post-merge `develop` CI is green.

## Next task after closeout

**3.4B — Direct-Material + Component Capacity Synthesis**

Do not begin 3.4B until 3.4A is merged, exact post-merge `develop` CI is green, 3.4A is formally marked COMPLETE, and a dedicated 3.4B development plan/scope review is established.
