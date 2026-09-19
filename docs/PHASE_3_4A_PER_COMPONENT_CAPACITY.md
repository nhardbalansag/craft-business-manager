# Phase 3.4A — Per-Component Availability & Capacity

## Status

**COMPLETE**

Implementation PR:

`#79 — Phase 3.4A — Per-Component Availability & Capacity`

Implementation merge commit:

`3c2e788935baebf5154fb3080534baba9ff3f94a`

Development plan:

`docs/PHASE_3_4A_PER_COMPONENT_CAPACITY_PLAN.md`

## Completed implementation

Phase 3.4A adds one derived capacity view for a single ProductComponent line.

Pure math:

`src/domain/componentCapacity.ts`

Application service:

`src/application/productComponents/ComponentCapacityService.ts`

Shared session instance:

`componentCapacityService`

## Formula

```text
component parent capacity
= floor(available component quantity / quantityPerParent)
```

The formula is applied only after the existing ProductComponent contract and Phase 3.2C availability evidence are reliable.

## Availability authority

3.4A delegates source resolution to:

`ComponentSourceAvailabilityService.resolveComponent()`

Therefore:

- Material-backed quantity comes from normalized Phase 1 Material inventory through 3.2C;
- Product-backed quantity comes from explicit ProductStock through 3.2C;
- missing ProductStock is unresolved, never silently zero;
- explicit zero Material/ProductStock is reliable zero availability;
- Material conversion/calibration evidence and ProductStock evidence remain attached.

3.4A does not directly read Material or ProductStock repositories.

## Result/readiness contract

Each result preserves component/source identity, role, quantity per parent, available quantity, canonical `pc` unit, capacity, complete source availability evidence, and controlled issues.

Readiness:

```text
ready
partial
not-ready
```

- `ready`: reliable availability; numeric capacity is published;
- `partial`: source recognized but current quantity unresolved/corrupt; capacity is `null`;
- `not-ready`: component/source relationship invalid for current capacity; capacity is `null`.

Explicit zero is authoritative:

```text
availableQuantity = 0
capacityPieces = 0
status = ready
```

## Product-backed stock policy

Product-backed capacity uses current explicit ProductStock only.

No recursive raw-material buildable quantity is added to child stock. This preserves Phase 3 current **assembly capacity** semantics and avoids double-counting shared raw materials.

## Controlled issues

```text
INVALID_COMPONENT
SOURCE_AVAILABILITY_PARTIAL
SOURCE_AVAILABILITY_NOT_READY
AVAILABLE_QUANTITY_INVALID
DERIVED_CAPACITY_INVALID
```

Underlying ProductComponent/3.2C/domain issue codes remain available where applicable.

## Validation

Dedicated coverage:

- `ComponentCapacityService.test.ts` — 23 tests;
- `componentCapacity.test.ts` — 12 tests.

Full repository validation:

```text
49 test files passed
524 tests passed
TypeScript typecheck passed
production build passed
```

Evidence:

```text
Test-bearing feature CI  34919279213 — SUCCESS
Fully wired feature CI   34919300250 — SUCCESS
Final feature-head CI    34919390258 — SUCCESS
PR CI                    34919456454 — SUCCESS
Implementation merge     3c2e788935baebf5154fb3080534baba9ff3f94a
Post-merge develop CI    34919538278 — SUCCESS
```

## Explicit deferrals

3.4A does not implement:

- Product-level capacity synthesis;
- direct-material + component capacity combination;
- limiting-resource trace/ties;
- recursive make-to-order capacity;
- inventory mutation/reservation/transactions;
- pricing;
- UI;
- Excel persistence.

## Completion gate

All 3.4A gates passed:

- per-line Material/Product component capacity exists;
- availability delegates to 3.2C;
- floor math is validated and deterministic;
- explicit zero remains ready zero;
- unresolved quantity remains null;
- availability traceability is preserved;
- ProductStock is not recursively augmented;
- no 3.4B/3.4C logic leaked into 3.4A;
- no derived capacity is persisted;
- tests, typecheck, build, PR CI, and exact post-merge `develop` CI are green.

## Next task

**3.4B — Direct-Material + Component Capacity Synthesis — NEXT / NOT STARTED**

Do not begin 3.4B until a dedicated development plan/scope review is established.
