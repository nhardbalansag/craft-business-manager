# Phase 3.3B — Recursive Product-Backed Component Cost Development Plan

## Status

**IMPLEMENTED — MERGE GATE PENDING**

Authoritative base:

`develop` @ `e84be8cb15cf4bd7be3379ebd76302a4087376c9`

Feature branch:

`feature/phase-3-3b-recursive-product-component-cost`

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

No deeper formal split was required.

3.3B remained one cohesive application-service task covering recursive tree derivation, readiness propagation, local corruption guards, and shared session wiring.

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
- labor/overhead/selling price/markup/margin/profit;
- UI;
- Excel persistence.

These remain 3.3C, 3.4+, Phase 4, 3.5, or Phase 5.

## Authoritative cost sources

Implemented composition reuses existing derived services:

- Phase 2 direct-material cost: `RecipeMaterialCostPreviewService.previewForProduct()`;
- material-backed component cost: 3.3A `MaterialBackedComponentCostService.costComponent()`;
- Product-backed nested component cost: recursive 3.3B traversal.

No package-cost conversion rule was reimplemented.

ProductStock is deliberately not a dependency because current stock availability is not a Product cost input.

## Active relationship policy

Product-backed costing resolves the current child Product directly through `ProductRepository`.

Missing or inactive child Products return controlled `not-ready` results.

`ComponentSourceAvailabilityService` is not used for Product cost eligibility because it also evaluates ProductStock.

## Recursive tree contract

Implemented Product-backed line result:

```text
ProductBackedComponentCostLine
- componentId
- parentProductId
- role
- childProductId
- childProductName
- quantityPerParent
- path
- status: ready | partial | not-ready
- childDirectMaterialCost
- childComponentCostSubtotal
- childComponentAwareUnitCost
- componentCostContribution
- breakdown[]
- issues[]
```

`breakdown[]` recursively contains either:

- a 3.3A material-backed cost line; or
- another 3.3B Product-backed cost line.

Every edge therefore preserves its quantity multiplier.

## Readiness contract

### Ready

The child Product is active, its Phase 2 direct-material preview is ready, and every nested component cost is ready.

### Partial

At least one reliable numeric cost contribution is derivable, but one or more required direct/component inputs are unresolved.

The returned numeric value is the **known subtotal only**, never silently presented as complete.

Examples:

- partial Phase 2 direct-material preview;
- no direct-material cost lines but valid component cost;
- ready direct-material cost plus unresolved nested component;
- partial nested Product cost;
- one reachable cyclic branch while another sibling contribution remains valid;
- reachable duplicate-source corruption while direct-material cost remains valid.

### Not ready

No reliable child unit-cost evidence exists, or the relationship itself is invalid.

Examples:

- invalid/non-Product component input;
- missing/inactive child Product;
- direct/reachable cycle edge;
- no derivable direct-material or nested component contribution;
- invalid aggregate numeric result.

## Zero-versus-missing evidence

Cost evidence is tracked separately from numeric value.

Therefore:

- ready zero direct cost is valid evidence;
- ready zero nested component contribution is valid evidence;
- a not-ready Phase 2 preview with zero lines is unresolved, not authoritative zero.

## Cycle/path guard

Recursive Product identity uses trimmed, case-insensitive IDs.

The service maintains its own active path even though 3.1B already validates writes.

When recursion revisits a Product in the active path:

- that edge stops immediately;
- the edge returns `not-ready`;
- `CYCLE_DETECTED` carries a closed canonical path;
- unaffected sibling evidence remains available to the parent.

This prevents infinite recursion from corrupted/imported data.

## Reachable duplicate-source guard

Each traversed Product validates only its immediate child component collection with the existing 3.1B uniqueness rule.

This prevents duplicate source records from being double-counted without letting unrelated repository corruption globally block a safe requested root.

## Deterministic traversal

Immediate child components are ordered by:

1. source type;
2. normalized source ID;
3. normalized component ID.

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

Detailed Phase 2 and nested component evidence remains on the tree.

## Application/session implementation

Added:

`src/application/productComponents/ProductBackedComponentCostService.ts`

Shared session instance:

`productBackedComponentCostService`

Dependencies:

- `productRepository`;
- `productComponentRepository`;
- `recipeMaterialCostPreviewService`;
- `materialBackedComponentCostService`.

The component collection is loaded once per top-level cost request and traversed in memory.

No new repository or BusinessDataset collection was introduced.

## Validation

Dedicated suite:

`src/application/productComponents/ProductBackedComponentCostService.test.ts`

Focused suite: **26 tests**.

Feature-head CI:

```text
run 34917053692 — SUCCESS
46 test files passed
464 tests passed
TypeScript typecheck passed
production build passed
```

Coverage includes direct-cost composition, edge multipliers, deep nesting, mixed Material/Product children, full breakdown trees, zero-cost evidence, partial/not-ready propagation, missing/inactive Products, invalid inputs, direct/deep cycles, sibling preservation around a cycle, duplicate-source protection, unrelated corruption isolation, deterministic ordering, and immutability.

## Completion gate

Implemented feature gates passed:

- Product-backed child cost combines Phase 2 direct cost and Phase 3 component cost recursively;
- 3.3A remains the sole material-backed component cost path;
- arbitrary finite acyclic nesting is supported;
- recursive tree/edge multipliers and leaf evidence remain inspectable;
- ready/partial/not-ready propagates deterministically;
- partial known subtotal remains visibly incomplete;
- zero remains distinct from missing evidence;
- missing/inactive child Products are controlled;
- reachable cycles cannot recurse indefinitely;
- reachable duplicate sources are not double-counted;
- unrelated corruption does not globally block safe roots;
- ProductStock is excluded from cost dependencies;
- derived recursive cost is not persisted;
- shared session wiring exists;
- 46 test files / 464 tests pass;
- TypeScript typecheck and production build pass.

Remaining gate:

- implementation PR merges to `develop`;
- exact post-merge `develop` CI is green.

## Next task after closeout

**3.3C — Total Component-Aware Product Cost & Readiness**

Do not begin 3.3C until 3.3B is merged, exact post-merge `develop` CI is green, and a dedicated 3.3C development plan/scope review is established.
