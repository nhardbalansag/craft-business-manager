# Phase 3.4A — Per-Component Availability & Capacity Development Plan

## Status

**COMPLETE**

Authoritative implementation base:

`develop` @ `7889846430ce672de232c8b9942ff7ce5bde7ffb`

Implementation PR:

`#79 — Phase 3.4A — Per-Component Availability & Capacity`

Implementation merge commit:

`3c2e788935baebf5154fb3080534baba9ff3f94a`

Implementation record:

`docs/PHASE_3_4A_PER_COMPONENT_CAPACITY.md`

## Objective

Derive current assembly capacity for one ProductComponent line:

```text
floor(available component quantity / quantityPerParent)
```

Material-backed quantity comes from Phase 3.2C normalized Material inventory. Product-backed quantity comes from Phase 3.2C explicit ProductStock.

## Split assessment

No deeper formal split was required.

3.4A remained one cohesive per-component capacity task.

## Locked scope

Implemented:

- ProductComponent validation;
- 3.2C availability delegation;
- pure floor-capacity arithmetic;
- `ready | partial | not-ready` line readiness;
- explicit-zero semantics;
- source availability traceability;
- defensive invalid-quantity handling;
- shared session wiring;
- focused/full validation.

Explicitly deferred:

- Product-level component aggregation;
- direct-material + component capacity synthesis;
- overall assembly capacity;
- limiting-resource trace;
- recursive make-to-order child capacity;
- inventory mutation;
- pricing;
- UI;
- Excel persistence.

## Implemented contract

`ComponentCapacityResult` preserves:

```text
componentId
parentProductId
role
sourceType
sourceId
quantityPerParent
status
availableQuantity
unit = pc
capacityPieces
sourceAvailability
issues
```

Ready capacity is numeric. Partial/not-ready capacity is `null`.

Explicit zero remains:

```text
status = ready
availableQuantity = 0
capacityPieces = 0
```

## ProductStock policy

Product-backed capacity uses explicit current ProductStock only.

No raw-material-derived child buildable quantity is added to current stock.

## Implementation architecture

Added:

- `src/domain/componentCapacity.ts`;
- `src/application/productComponents/ComponentCapacityService.ts`;
- shared `componentCapacityService` session instance.

The application service depends on the shared 3.2C availability resolver rather than Material/ProductStock repositories.

## Validation evidence

```text
ComponentCapacityService tests: 23
componentCapacity domain tests: 12
49 test files passed
524 tests passed
TypeScript typecheck passed
production build passed

Test-bearing feature CI  34919279213 — SUCCESS
Fully wired feature CI   34919300250 — SUCCESS
Final feature-head CI    34919390258 — SUCCESS
PR CI                    34919456454 — SUCCESS
Post-merge develop CI    34919538278 — SUCCESS
```

## Completion gate

All required 3.4A gates passed:

- authoritative 3.2C availability reused;
- capacity formula applied exactly once;
- zero versus missing availability distinguished;
- controlled readiness and diagnostics preserved;
- no 3.4B/3.4C leakage;
- no derived persistence;
- implementation PR merged;
- exact post-merge `develop` CI passed.

## Next task

**3.4B — Direct-Material + Component Capacity Synthesis — NEXT / NOT STARTED**

Do not begin 3.4B until its dedicated development plan/scope review is established.
