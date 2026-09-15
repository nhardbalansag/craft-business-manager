# Phase 3.3B — Recursive Product-Backed Component Cost

## Status

**IMPLEMENTATION COMPLETE — MERGE GATE PENDING**

Feature branch:

`feature/phase-3-3b-recursive-product-component-cost`

Authoritative implementation base:

`develop` @ `e84be8cb15cf4bd7be3379ebd76302a4087376c9`

Development plan:

`docs/PHASE_3_3B_RECURSIVE_PRODUCT_COMPONENT_COST_PLAN.md`

## Implementation

Added:

`src/application/productComponents/ProductBackedComponentCostService.ts`

Primary operation:

```text
costComponent(component: ProductComponent)
```

The service derives the component-aware cost of a Product-backed component edge recursively without persisting derived cost.

## Authoritative composition

For every child Product:

```text
known child unit cost
= known Phase 2 direct-material cost
+ known Phase 3 nested component contributions

parent contribution
= known child unit cost × ProductComponent.quantityPerParent
```

Authoritative sources are composed, not duplicated:

- Phase 2 direct-material cost -> `RecipeMaterialCostPreviewService`;
- material-backed discrete component cost -> 3.3A `MaterialBackedComponentCostService`;
- Product-backed component cost -> recursive 3.3B traversal.

ProductStock/current stock is intentionally absent from the service dependencies and cost mathematics.

## Recursive breakdown contract

Product-backed results expose:

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

`breakdown[]` is a recursive union of:

- material-backed 3.3A cost lines;
- Product-backed 3.3B cost lines.

Every edge therefore preserves its own quantity multiplier and the hierarchy retains the complete multiplication path.

## Readiness propagation

### Ready

A Product-backed line is `ready` only when:

- the child Product exists and is active;
- its Phase 2 direct-material preview is ready;
- every reachable nested component line is ready.

### Partial

A Product-backed line is `partial` when at least one reliable numeric contribution is known but some required direct/component evidence is unresolved.

Examples covered by implementation:

- Phase 2 direct-material preview is partial;
- direct-material preview is not-ready but nested component cost is known;
- nested material component is not-ready while direct material is known;
- nested Product cost is partial;
- one reachable branch is cyclic while unaffected sibling cost remains derivable;
- reachable duplicate component-source corruption blocks component aggregation but valid direct-material evidence remains.

The returned numeric cost is explicitly the known current subtotal only.

### Not ready

A line is `not-ready` when no reliable numeric child-cost evidence can be produced or the relationship itself is invalid.

Examples:

- invalid/non-Product component input;
- missing/inactive child Product;
- direct/reachable cycle edge;
- no derivable direct-material lines and no derivable child component contribution;
- invalid aggregate numeric result.

## Zero-versus-missing cost evidence

The implementation tracks cost evidence separately from numeric value.

Therefore:

- a ready zero direct-material cost is valid numeric evidence;
- a ready zero-cost nested component is valid numeric evidence;
- a Phase 2 not-ready preview with zero lines is unresolved and is not silently interpreted as authoritative zero.

This allows partial zero subtotal to remain distinguishable from no cost evidence.

## Active Product relationship guard

Each Product-backed edge resolves the current child Product directly through `ProductRepository`.

Missing or inactive child Products return controlled `not-ready` lines.

The service intentionally does **not** use `ComponentSourceAvailabilityService` for Product cost eligibility because that resolver also evaluates ProductStock; current stock must not affect derived Product cost.

## Corrupted-data path/cycle guard

The recursive active path uses canonical Product identity:

```text
trim + case-insensitive
```

If a child attempts to revisit a Product already in the active path, recursion stops for that edge and returns:

```text
CYCLE_DETECTED
```

with a closed canonical cycle path.

Unrelated corruption does not block a safe requested root, and unaffected sibling cost evidence remains available when another reachable branch cycles.

## Duplicate-source guard

Each currently traversed Product validates only its immediate child component collection with the existing 3.1B source-uniqueness rule.

This prevents corrupted duplicate source records from being double-counted while avoiding global failure caused by unrelated corruption elsewhere in the repository.

When immediate composition is invalid:

- nested component aggregation is not performed;
- direct Phase 2 cost evidence remains available;
- result is partial when direct evidence exists;
- result is not-ready when no evidence exists.

## Deterministic traversal

Immediate child components are ordered by:

1. source type;
2. normalized source ID;
3. normalized component ID.

Recursive tree output is therefore deterministic regardless of repository insertion order.

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

Detailed Phase 2 issues and nested line evidence remain attached to the recursive tree.

## Shared session wiring

`src/application/session.ts` now exports:

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

Coverage includes:

- ready Phase 2 direct-material child;
- parent quantity multiplication;
- canonical child identity/name/path;
- 3.3A material-backed child component;
- two-level and deeper Product nesting;
- mixed direct/material/Product nested costs;
- recursive breakdown tree and edge multipliers;
- ready zero direct cost;
- partial Phase 2 direct cost;
- component-only partial cost when direct cost is unresolved;
- zero component evidence;
- nested material/Product readiness propagation;
- missing/inactive child Product;
- invalid/non-Product input;
- direct self-cycle and deep reachable cycle;
- unaffected sibling evidence around a cyclic branch;
- reachable duplicate source protection;
- unrelated corruption isolation;
- deterministic tree ordering;
- source immutability.

Feature-head CI:

```text
run 34917053692 — SUCCESS
46 test files passed
464 tests passed
TypeScript typecheck passed
production build passed
```

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

## Completion gate state

Feature implementation gates passed:

- recursive Product-backed child cost combines Phase 2 direct cost and Phase 3 component cost;
- 3.3A remains the sole material-backed component cost path;
- arbitrary finite acyclic nesting is supported;
- recursive breakdown tree and edge quantities are preserved;
- Product names/IDs and Phase 2 leaf evidence remain inspectable;
- ready/partial/not-ready propagates through the tree;
- partial known subtotal remains visibly incomplete;
- zero cost remains distinct from absence of evidence;
- missing/inactive child Products are controlled;
- reachable cycles cannot recurse indefinitely;
- duplicate sources are not double-counted;
- unrelated corruption does not globally block safe roots;
- ProductStock is excluded from cost dependencies;
- derived recursive cost is not persisted;
- shared session wiring exists;
- 46 test files / 464 tests pass;
- TypeScript typecheck passes;
- production build passes.

Remaining before 3.3B may be marked fully complete:

- implementation PR must merge to `develop`;
- exact post-merge `develop` CI must pass.

## Next task after closeout

**3.3C — Total Component-Aware Product Cost & Readiness**

Do not begin 3.3C until 3.3B is merged, exact post-merge `develop` CI is green, and a dedicated 3.3C plan/scope review is established.
