# Phase 3.3B — Recursive Product-Backed Component Cost Development Plan

## Status

**COMPLETE**

Authoritative base:

`develop` @ `e84be8cb15cf4bd7be3379ebd76302a4087376c9`

Feature branch:

`feature/phase-3-3b-recursive-product-component-cost`

Implementation PR:

`#75`

Implementation merge commit:

`14bf14436f159fcfd40d40dad8dd9ab0cf3ddc41`

Implementation record:

`docs/PHASE_3_3B_RECURSIVE_PRODUCT_COMPONENT_COST.md`

## Objective

Derive Product-backed component cost recursively:

```text
child component-aware unit cost
= child Phase 2 direct-material cost
+ child Phase 3 component cost

parent contribution
= child component-aware unit cost × quantityPerParent
```

The result is derived only and is never persisted.

## Split assessment

No deeper formal split was required. 3.3B remained one cohesive recursive application-service task.

## Scope boundary

3.3B is Product-backed component recursive costing only.

Explicitly excluded:

- final root Product total-cost synthesis;
- final Phase 4 pricing input;
- ProductStock/current-stock effects on cost;
- capacity/limiting-resource math;
- recursive make-to-order stock optimization;
- inventory reservation/deduction/transactions;
- safety-waste cost markup;
- labor, overhead, selling price, markup, margin, profit;
- UI;
- Excel persistence.

These remain 3.3C, 3.4+, Phase 4, 3.5, or Phase 5.

## Authoritative cost sources

Implemented composition reuses existing services:

- Phase 2 direct-material cost: `RecipeMaterialCostPreviewService.previewForProduct()`;
- material-backed component cost: 3.3A `MaterialBackedComponentCostService.costComponent()`;
- Product-backed nested component cost: recursive 3.3B traversal.

ProductStock is deliberately not a dependency.

## Recursive/readiness contract

Implemented Product-backed lines preserve Product identity/name, path, edge quantity, direct-material evidence, nested breakdown, known component subtotal, child component-aware unit cost, parent contribution, readiness, and controlled issues.

Readiness is:

- `ready` when all required direct/nested cost evidence is complete;
- `partial` when reliable numeric subtotal exists but required evidence is incomplete;
- `not-ready` when no reliable numeric evidence exists or the relationship is invalid.

Reliable zero remains distinguishable from missing cost evidence.

## Corruption protection

The service independently protects the active recursion path using normalized Product identity and reports closed canonical cycle paths.

It validates immediate reachable component-source uniqueness before aggregation so duplicates are not double-counted. Corruption outside the reachable requested tree does not globally block costing.

## Deterministic traversal

Immediate component ordering is source type, normalized source ID, then normalized component ID.

## Controlled issues

Implemented summary codes:

```text
INVALID_COMPONENT
NOT_PRODUCT_BACKED_COMPONENT
SOURCE_PRODUCT_NOT_FOUND
SOURCE_PRODUCT_INACTIVE
DIRECT_MATERIAL_COST_PARTIAL
DIRECT_MATERIAL_COST_NOT_READY
COMPONENT_GRAPH_INVALID
NESTED_COMPONENT_PARTIAL
NESTED_COMPONENT_NOT_READY
CYCLE_DETECTED
DERIVED_COST_INVALID
```

## Application/session implementation

Added:

`src/application/productComponents/ProductBackedComponentCostService.ts`

Shared session instance:

`productBackedComponentCostService`

Reuses:

- `productRepository`;
- `productComponentRepository`;
- `recipeMaterialCostPreviewService`;
- `materialBackedComponentCostService`.

No new repository or BusinessDataset collection was introduced.

## Validation

Dedicated suite:

`src/application/productComponents/ProductBackedComponentCostService.test.ts`

Focused suite: **26 tests**.

Final validation evidence:

```text
Test-bearing feature CI: 34917053692 — SUCCESS
Final feature-head CI:    34917215482 — SUCCESS
PR #75 CI:                34917269363 — SUCCESS
Post-merge develop CI:    34917371932 — SUCCESS

46 test files passed
464 tests passed
TypeScript typecheck passed
production build passed
```

## Completion gate

All planning and implementation gates passed:

- recursive Product-backed cost composes authoritative Phase 2 and Phase 3 cost sources;
- 3.3A remains the Material-backed cost implementation;
- finite acyclic nesting and recursive breakdown trees are supported;
- Product identities and per-edge quantity multipliers are preserved;
- partial known subtotal remains explicitly incomplete;
- zero remains distinct from missing evidence;
- missing/inactive children and corrupted reachable cycles/duplicates are controlled;
- unrelated corruption does not globally block safe roots;
- ProductStock/current stock does not affect cost;
- derived recursive cost is not persisted;
- shared session wiring exists;
- focused/full tests, TypeScript typecheck, and production build pass;
- PR #75 merged to `develop`;
- exact post-merge CI `34917371932` passed on `14bf14436f159fcfd40d40dad8dd9ab0cf3ddc41`.

## Next task

**3.3C — Total Component-Aware Product Cost & Readiness — NEXT / NOT STARTED**

Do not begin 3.3C until its own dedicated development plan/scope review is established.
