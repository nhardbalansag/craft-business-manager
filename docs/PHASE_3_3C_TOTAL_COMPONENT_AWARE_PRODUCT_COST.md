# Phase 3.3C — Total Component-Aware Product Cost & Readiness

## Status

**IMPLEMENTATION COMPLETE — MERGE GATE PENDING**

Feature branch:

`feature/phase-3-3c-total-component-aware-product-cost`

Authoritative implementation base:

`develop` @ `cb62f446ef77b42d8f41b7ea6825704a2da09c0f`

Development plan:

`docs/PHASE_3_3C_TOTAL_COMPONENT_AWARE_PRODUCT_COST_PLAN.md`

## Implementation

Added:

`src/application/productComponents/ComponentAwareProductCostService.ts`

Primary operation:

```text
costProduct(productId: string)
```

The service creates the final Phase 3 Product-level material/component cost view by composing existing Phase 2, 3.3A, and 3.3B derived services.

## Authoritative synthesis

For one Product:

```text
known Phase 2 direct-material cost
+
known root Phase 3 component contributions
=
known component-aware Product cost
```

The service does not reimplement lower-level costing.

Delegation remains authoritative:

- direct-material cost -> `RecipeMaterialCostPreviewService`;
- Material-backed component cost -> 3.3A `MaterialBackedComponentCostService`;
- Product-backed recursive component cost -> 3.3B `ProductBackedComponentCostService`.

## Result contract

The derived result exposes:

```text
productId
productName
productIsActive
status: ready | partial | not-ready
directMaterialCost
directMaterialCostSubtotal
componentCostSubtotal
totalComponentAwareCost
componentLines[]
issues[]
```

Root component lines retain a typed source discriminator and preserve the complete 3.3A or 3.3B line result.

Nested Product-backed trees therefore remain inspectable through 3.3B rather than being flattened/rebuilt by 3.3C.

## Readiness semantics

### Ready

A Product-level result is `ready` when:

- Phase 2 direct-material cost is ready and contains reliable cost evidence;
- every required root component line is ready;
- the derived total is finite and non-negative.

Direct-material-only Products can therefore be fully ready.

### Partial

A result is `partial` when at least one reliable numeric contribution exists but one or more required cost inputs remain unresolved.

Examples implemented and tested:

- Phase 2 direct cost is partial;
- Phase 2 direct cost is not-ready/no direct evidence but component cost is known;
- a Material-backed component is not-ready while direct cost is known;
- a Product-backed component is partial/not-ready while other cost evidence is known;
- a nested 3.3B branch carries cycle/corruption evidence but returns a known partial contribution;
- immediate root component-source duplication makes component aggregation unsafe while valid direct cost remains independently known;
- an invalid/non-finite component contribution is skipped while other reliable cost evidence remains.

The numeric total in a partial result is explicitly the **known current subtotal only**.

### Not ready

A result is `not-ready` when no reliable numeric cost evidence exists, or the final aggregate cannot be safely derived.

Examples:

- no derivable Phase 2 direct cost and no component contribution;
- all component cost inputs unresolved and no direct cost evidence;
- duplicate immediate root source corruption with no independent direct cost evidence;
- the only available component contribution is invalid/non-finite/negative.

When no reliable aggregate exists:

```text
totalComponentAwareCost = null
```

## Zero versus missing evidence

3.3C tracks evidence independently from the numeric value.

Therefore:

- a ready zero direct-material cost is valid numeric evidence;
- a ready zero component contribution is valid numeric evidence;
- Phase 2 `not-ready` with zero lines is unresolved rather than authoritative zero.

This prevents missing cost evidence from being silently converted into a complete zero-cost Product.

## Phase 2 `NO_REQUIREMENTS` policy

3.3C intentionally remains consistent with the readiness contract established by Phase 2 and 3.3B.

Current behavior:

```text
no reliable direct cost + no component evidence
-> not-ready

no reliable direct cost + valid component evidence
-> partial known component subtotal
```

3.3C does not invent an explicit component-only Product policy outside the existing domain contract.

## Immediate root composition guard

The service loads root ProductComponent source data and validates immediate source uniqueness before aggregation.

If corrupted root data contains duplicate source identity:

- duplicate lines are not costed/double-counted;
- `COMPONENT_GRAPH_INVALID` is reported;
- valid direct evidence is retained as a partial subtotal when available;
- result is not-ready when no independent evidence exists.

Nested cycle/path handling remains delegated to 3.3B.

## Deterministic root traversal

Root component lines are ordered by:

1. source type;
2. normalized source ID;
3. normalized component ID.

This keeps derived output stable regardless of repository insertion order.

## Product identity behavior

Missing requested root Product throws typed:

```text
ComponentAwareProductCostServiceError
code = PRODUCT_NOT_FOUND
```

Inactive/archived root Products remain historically inspectable. Their `productIsActive` state is preserved, but inactivity alone does not discard otherwise derivable historical cost evidence.

## ProductStock exclusion

ProductStock/current finished stock is intentionally absent from 3.3C dependencies and mathematics.

```text
cost -> Phase 3.3
availability/capacity -> Phase 3.4 using Phase 3.2C
```

Finished-stock quantity therefore cannot change the derived Product cost.

## Derived-only rule

No Product/ProductComponent cost cache, repository write, or BusinessDataset derived-cost collection was added.

The result is calculated on read and is intended to become the material/component cost input for Phase 4 pricing.

## Controlled issues

Implemented Product-level summary issue codes:

```text
DIRECT_MATERIAL_COST_PARTIAL
DIRECT_MATERIAL_COST_NOT_READY
COMPONENT_GRAPH_INVALID
COMPONENT_COST_PARTIAL
COMPONENT_COST_NOT_READY
DERIVED_COST_INVALID
```

Detailed Phase 2, 3.3A, and 3.3B evidence remains attached to the result/lines.

## Shared session wiring

`src/application/session.ts` now exports:

```text
componentAwareProductCostService
```

It reuses:

```text
productRepository
productComponentRepository
recipeMaterialCostPreviewService
materialBackedComponentCostService
productBackedComponentCostService
```

No new repository or BusinessDataset collection was introduced.

## Validation coverage

Added:

`src/application/productComponents/ComponentAwareProductCostService.test.ts`

Dedicated 3.3C suite: **25 tests**.

Coverage includes:

- direct-material-only ready cost;
- Material-backed component synthesis;
- Product-backed component synthesis;
- mixed root components;
- exact-once component quantity contribution handling;
- recursive tree preservation without flattening;
- deterministic root ordering;
- zero direct/component cost evidence;
- partial Phase 2 cost;
- component-only known partial subtotal;
- no-evidence not-ready result;
- unresolved Material/Product component propagation;
- duplicate root source protection;
- nested corruption evidence preservation from 3.3B;
- typed missing Product error;
- archived root Product historical cost inspection;
- ProductStock independence;
- invalid contribution rejection;
- source record immutability.

Test-bearing feature CI:

```text
run 34918219698 — SUCCESS
47 test files passed
489 tests passed
TypeScript typecheck passed
production build passed
```

Fully wired feature-head CI:

```text
run 34918240264 — SUCCESS
TypeScript typecheck passed
full test suite passed
production build passed
```

## Explicit deferrals

Not implemented in 3.3C:

- component availability/capacity math;
- direct-material + component assembly capacity synthesis;
- limiting resource trace;
- recursive make-to-order optimization;
- inventory mutation/reservation/transactions;
- labor/overhead/pricing/markup/margin/profit;
- React UI;
- Excel persistence.

These remain Phase 3.4+, Phase 4, Phase 3.5, and Phase 5.

## Completion gate state

Feature implementation gates passed:

- one Product-level derived cost view exists;
- Phase 2 direct cost is reused rather than recalculated;
- Material-backed root lines delegate to 3.3A;
- Product-backed root lines delegate to 3.3B;
- recursive nested evidence remains inspectable;
- ready/partial/not-ready propagates deterministically;
- partial known subtotals remain visibly incomplete;
- zero cost remains distinct from missing evidence;
- duplicate root sources cannot be double-counted;
- ProductStock/current stock does not affect cost;
- no derived cost is persisted;
- shared session wiring exists;
- 47 test files / 489 tests pass;
- TypeScript typecheck passes;
- production build passes.

Remaining before 3.3C may be marked fully complete:

- implementation PR must merge to `develop`;
- exact post-merge `develop` CI must pass.

## Next task after closeout

**3.4A — Per-Component Availability & Capacity**

Do not begin 3.4A until 3.3C is merged, exact post-merge `develop` CI is green, Phase 3.3 is formally marked COMPLETE, and a dedicated 3.4A development plan/scope review is established.
