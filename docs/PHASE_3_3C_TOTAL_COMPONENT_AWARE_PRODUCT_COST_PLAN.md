# Phase 3.3C — Total Component-Aware Product Cost & Readiness Development Plan

## Status

**IMPLEMENTED — MERGE GATE PENDING**

Authoritative base:

`develop` @ `cb62f446ef77b42d8f41b7ea6825704a2da09c0f`

Feature branch:

`feature/phase-3-3c-total-component-aware-product-cost`

Implementation record:

`docs/PHASE_3_3C_TOTAL_COMPONENT_AWARE_PRODUCT_COST.md`

## Objective

Create one derived Product-level cost view:

```text
Phase 2 direct-material cost
+
Phase 3 component contributions
=
component-aware Product material/component cost
```

The result remains storage-agnostic and becomes the material/component cost input for Phase 4 pricing.

## Split assessment

No deeper formal split was required.

3.3C remained one cohesive application-service synthesis task covering root Product resolution, Phase 2 direct cost, 3.3A/3.3B component delegation, readiness aggregation, corruption guards, and shared session wiring.

## Scope boundary

3.3C is cost synthesis only.

Explicitly excluded:

- component/direct-material assembly capacity;
- limiting-resource analysis;
- ProductStock/current-stock effects on cost;
- recursive manufacture of missing child stock;
- inventory reservation/deduction/transactions;
- safety-waste cost markup;
- labor/overhead/selling price/markup/margin/profit;
- UI;
- Excel persistence or authoritative cached cost.

These remain Phase 3.4+, Phase 4, Phase 3.5, or Phase 5.

## Authoritative cost sources

Implemented composition reuses existing services:

- root Phase 2 direct-material cost: `RecipeMaterialCostPreviewService.previewForProduct()`;
- root Material-backed component cost: 3.3A `MaterialBackedComponentCostService.costComponent()`;
- root Product-backed recursive cost: 3.3B `ProductBackedComponentCostService.costComponent()`.

No lower-level cost formula was reimplemented.

## Product-level result contract

Implemented result:

```text
ComponentAwareProductCostResult
- productId
- productName
- productIsActive
- status: ready | partial | not-ready
- directMaterialCost
- directMaterialCostSubtotal
- componentCostSubtotal
- totalComponentAwareCost
- componentLines[]
- issues[]
```

`componentLines[]` is a typed union containing the original 3.3A or 3.3B line result. Recursive Product-backed trees remain nested in 3.3B rather than being flattened by 3.3C.

## Cost aggregation semantics

```text
known direct subtotal
= Phase 2 total when reliable direct cost lines exist
= 0 when no reliable direct evidence exists

known component subtotal
= sum of finite non-negative non-null root component contributions

known total
= known direct subtotal + known component subtotal
```

Cost evidence is tracked separately from the numeric value so authoritative zero remains distinguishable from missing evidence.

## Readiness contract

### Ready

The Phase 2 direct-material preview is ready with reliable cost evidence, every required root component line is ready, and the total is finite/non-negative.

A direct-material-only Product may therefore be ready.

### Partial

At least one reliable numeric contribution exists but one or more required direct/component inputs remain unresolved.

Implemented examples:

- partial Phase 2 direct cost;
- no reliable Phase 2 direct cost but valid component cost;
- unresolved Material-backed component while direct cost remains known;
- partial/not-ready Product-backed component while other evidence remains known;
- nested 3.3B corruption/cycle evidence with a known partial contribution;
- duplicate immediate root source corruption while independent direct evidence remains known;
- invalid component contribution while other safe evidence remains known.

The numeric result is the known current subtotal only.

### Not ready

No reliable numeric Product cost evidence exists or no safe aggregate can be produced.

Examples:

- no direct cost and no component contribution;
- all component inputs unresolved with no direct evidence;
- duplicate root source corruption with no independent evidence;
- only available component contribution is invalid.

In these cases `totalComponentAwareCost` is `null`.

## Phase 2 `NO_REQUIREMENTS` policy

3.3C preserves the Phase 2/3.3B readiness contract.

```text
no reliable direct cost + no component evidence -> not-ready
no reliable direct cost + valid component evidence -> partial
```

3.3C does not silently reinterpret a Phase 2 `not-ready`/no-requirements result as authoritative zero.

## Root component guards

Immediate root component-source uniqueness is validated using the existing 3.1B rule before aggregation.

Duplicate source corruption is never double-counted.

Nested cycle/path handling remains delegated to 3.3B.

Root lines are processed deterministically by source type, normalized source ID, then normalized component ID.

## Product identity policy

Missing root Product throws typed:

```text
ComponentAwareProductCostServiceError
code = PRODUCT_NOT_FOUND
```

Inactive root Products remain historically inspectable. `productIsActive` is preserved and inactivity alone does not erase otherwise derivable cost evidence.

## ProductStock exclusion

3.3C has no ProductStock dependency.

```text
cost -> Phase 3.3
availability/capacity -> Phase 3.4 using Phase 3.2C
```

Current finished stock therefore cannot change Product cost.

## Derived-only rule

No Product/ProductComponent cached total, repository write, or BusinessDataset derived-cost collection was added.

Phase 4 should consume the derived 3.3C view.

## Controlled issues

Implemented summary codes:

```text
DIRECT_MATERIAL_COST_PARTIAL
DIRECT_MATERIAL_COST_NOT_READY
COMPONENT_GRAPH_INVALID
COMPONENT_COST_PARTIAL
COMPONENT_COST_NOT_READY
DERIVED_COST_INVALID
```

Detailed lower-level evidence remains attached to direct/component results.

## Application/session implementation

Added:

`src/application/productComponents/ComponentAwareProductCostService.ts`

Shared session instance:

`componentAwareProductCostService`

Dependencies:

- `productRepository`;
- `productComponentRepository`;
- `recipeMaterialCostPreviewService`;
- `materialBackedComponentCostService`;
- `productBackedComponentCostService`.

No new repository or BusinessDataset collection was introduced.

## Validation

Dedicated suite:

`src/application/productComponents/ComponentAwareProductCostService.test.ts`

Focused suite: **25 tests**.

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

## Completion gate

Implemented feature gates passed:

- Product-level derived view combines Phase 2 direct cost and Phase 3 components;
- root Material lines delegate to 3.3A;
- root Product lines delegate to 3.3B;
- recursive nested evidence remains inspectable;
- ready/partial/not-ready propagates deterministically;
- partial known subtotal remains visibly incomplete;
- zero remains distinct from missing evidence;
- duplicate root sources cannot be double-counted;
- ProductStock is excluded from cost dependencies;
- derived cost is not persisted;
- shared session wiring exists;
- 47 test files / 489 tests pass;
- TypeScript typecheck and production build pass.

Remaining gate:

- implementation PR merges to `develop`;
- exact post-merge `develop` CI is green.

## Next task after closeout

**3.4A — Per-Component Availability & Capacity**

Do not begin 3.4A until 3.3C is merged, exact post-merge `develop` CI is green, Phase 3.3 is formally marked COMPLETE, and a dedicated 3.4A development plan/scope review is established.
