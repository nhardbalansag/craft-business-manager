# Phase 3.3B — Recursive Product-Backed Component Cost

## Status

**COMPLETE**

Feature branch:

`feature/phase-3-3b-recursive-product-component-cost`

Authoritative implementation base:

`develop` @ `e84be8cb15cf4bd7be3379ebd76302a4087376c9`

Implementation PR:

`#75 — Phase 3.3B — Recursive Product-Backed Component Cost`

Implementation merge commit:

`14bf14436f159fcfd40d40dad8dd9ab0cf3ddc41`

Development plan:

`docs/PHASE_3_3B_RECURSIVE_PRODUCT_COMPONENT_COST_PLAN.md`

## Implementation

Added:

`src/application/productComponents/ProductBackedComponentCostService.ts`

Primary operation:

```text
costComponent(component: ProductComponent)
```

The service derives one Product-backed component edge recursively without persisting derived cost.

## Authoritative cost composition

For every child Product:

```text
known child unit cost
= known Phase 2 direct-material cost
+ known Phase 3 nested component contributions

parent contribution
= known child unit cost × ProductComponent.quantityPerParent
```

The implementation composes existing authoritative services:

- Phase 2 direct-material cost -> `RecipeMaterialCostPreviewService`;
- material-backed discrete component cost -> 3.3A `MaterialBackedComponentCostService`;
- Product-backed component cost -> recursive 3.3B traversal.

ProductStock/current stock is intentionally absent from Product cost dependencies and mathematics.

## Recursive breakdown contract

Product-backed results preserve:

```text
componentId
parentProductId
role
childProductId
childProductName
quantityPerParent
path
status: ready | partial | not-ready
childDirectMaterialCost
childComponentCostSubtotal
childComponentAwareUnitCost
componentCostContribution
breakdown[]
issues[]
```

`breakdown[]` recursively contains either a material-backed 3.3A line or another Product-backed 3.3B line. Every edge therefore preserves its own quantity multiplier and full multiplication path.

## Readiness propagation

### Ready

A line is `ready` only when the child Product exists and is active, the Phase 2 direct-material preview is ready, and every reachable nested component cost is ready.

### Partial

A line is `partial` when at least one reliable numeric contribution is known but one or more required direct/component inputs are unresolved.

The returned numeric value is explicitly the known current subtotal only. Examples include partial direct-material cost, component-only known cost when direct cost is unresolved, unresolved nested components, partial nested Products, one cyclic branch with unaffected siblings, and reachable duplicate-source corruption with valid direct evidence.

### Not ready

A line is `not-ready` when no reliable numeric child-cost evidence can be produced or the relationship itself is invalid, including missing/inactive child Products, invalid/non-Product inputs, reachable cycle edges, or no derivable direct/component evidence.

## Zero-versus-missing cost evidence

The implementation tracks cost evidence separately from numeric value:

- ready zero direct-material cost is valid evidence;
- ready zero-cost nested component contribution is valid evidence;
- a not-ready Phase 2 preview with zero lines remains unresolved rather than being interpreted as authoritative zero.

## Active Product relationship guard

Each Product-backed edge resolves its child directly through `ProductRepository`. Missing or inactive child Products return controlled `not-ready` lines.

`ComponentSourceAvailabilityService` is intentionally not used because it also evaluates ProductStock, and current stock must not affect Product cost.

## Corrupted-data guards

Recursive Product identity is trimmed and case-insensitive.

The service maintains an independent active path, so corrupted/imported reachable cycles cannot recurse indefinitely. A cycle returns `CYCLE_DETECTED` with a closed canonical cycle path while unaffected sibling evidence remains available.

Each traversed Product also validates only its immediate child source uniqueness through the existing 3.1B rule. Reachable duplicates are not double-counted, while unrelated corruption elsewhere does not globally block a safe requested root.

## Deterministic traversal

Immediate child components are ordered by:

1. source type;
2. normalized source ID;
3. normalized component ID.

## Controlled issues

Implemented summary issue codes:

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

Detailed Phase 2 and nested cost evidence remains attached to the recursive tree.

## Shared session wiring

`src/application/session.ts` exports:

```text
productBackedComponentCostService
```

It reuses:

```text
productRepository
productComponentRepository
recipeMaterialCostPreviewService
materialBackedComponentCostService
```

No new repository or BusinessDataset source-data collection was introduced.

## Validation coverage

Added:

`src/application/productComponents/ProductBackedComponentCostService.test.ts`

Dedicated 3.3B suite: **26 tests**.

Coverage includes direct Phase 2 cost, edge multipliers, canonical identities/paths, material-backed children, two-level/deep nesting, mixed recursive composition, full breakdown trees, zero-cost evidence, partial/not-ready propagation, missing/inactive Products, invalid inputs, self/deep cycles, sibling preservation around cycles, duplicate-source protection, unrelated corruption isolation, deterministic ordering, and source immutability.

## Validation evidence

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

Exact validated implementation merge commit:

`14bf14436f159fcfd40d40dad8dd9ab0cf3ddc41`

## Explicit deferrals

Not implemented in 3.3B:

- final root Product total cost synthesis;
- final Phase 4 pricing-input cost view;
- ProductStock/current-stock cost effects;
- component/direct-material assembly capacity;
- limiting-resource analysis;
- recursive make-to-order stock optimization;
- inventory mutation/reservation/transactions;
- safety-waste cost markup;
- labor/overhead/selling price/markup/margin/profit;
- React UI;
- Excel persistence.

These remain 3.3C, 3.4+, Phase 4, 3.5, or Phase 5.

## Completion gate

All 3.3B gates passed:

- recursive Product-backed cost combines authoritative Phase 2 direct cost and Phase 3 component cost;
- 3.3A remains the sole material-backed component cost path;
- finite acyclic nesting is supported;
- recursive tree, edge quantities, Product identities, and leaf evidence remain inspectable;
- ready/partial/not-ready propagates deterministically;
- partial known subtotal remains visibly incomplete;
- zero cost remains distinct from missing evidence;
- missing/inactive child Products are controlled;
- reachable cycles cannot recurse indefinitely;
- reachable duplicate sources are not double-counted;
- unrelated corruption does not globally block safe roots;
- ProductStock is excluded from Product cost dependencies;
- derived recursive cost is not persisted;
- shared session wiring exists;
- 46 test files / 464 tests pass;
- TypeScript typecheck and production build pass;
- PR #75 merged to `develop`;
- exact post-merge `develop` CI `34917371932` passed.

## Next task

**3.3C — Total Component-Aware Product Cost & Readiness — NEXT / NOT STARTED**

Do not begin 3.3C until a dedicated development plan/scope review is established for that task.
