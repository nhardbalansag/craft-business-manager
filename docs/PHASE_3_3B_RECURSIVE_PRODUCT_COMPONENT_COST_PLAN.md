# Phase 3.3B — Recursive Product-Backed Component Cost Development Plan

## Status

**IN PROGRESS**

Authoritative base:

`develop` @ `e84be8cb15cf4bd7be3379ebd76302a4087376c9`

Feature branch:

`feature/phase-3-3b-recursive-product-component-cost`

## Objective

Derive the current component-aware cost of a Product-backed `ProductComponent` line recursively.

For each Product-backed edge:

```text
child component-aware unit cost
= child Phase 2 direct-material cost
+ child Phase 3 component cost

parent contribution
= child component-aware unit cost × quantityPerParent
```

The recursive result must expose enough structure to explain every contributing direct-material line, material-backed component, and nested Product-backed component without persisting derived cost.

## Split assessment

No deeper formal split is required.

3.3B remains one cohesive application-service task. Internal implementation order:

1. define the Product-backed recursive cost/readiness/tree contract;
2. reuse Phase 2 direct-material cost preview for each child Product;
3. reuse 3.3A for material-backed child components;
4. recursively cost Product-backed child components;
5. add deterministic reachable-path/cycle protection for corrupted data;
6. propagate `ready | partial | not-ready` status through the tree;
7. preserve edge quantities, Product identity/name, and leaf cost evidence;
8. add shared session wiring and focused/full validation.

These are implementation steps, not new sub-phases.

## Scope boundary

3.3B is **Product-backed component recursive costing only**.

It does not:

- create the root Product total cost view from Phase 2 + all Phase 3 components;
- expose the final Phase 4 pricing input;
- use ProductStock or current stock quantity in cost mathematics;
- calculate assembly capacity or limiting resources;
- manufacture missing child stock from raw materials;
- reserve, deduct, or transact inventory;
- apply safety-waste as a permanent cost markup;
- add labor, overhead, selling price, markup, margin, or profit;
- add React UI;
- add Excel persistence.

Root Product synthesis remains 3.3C. Capacity remains 3.4. Pricing remains Phase 4. UI remains 3.5. Persistence remains Phase 5.

## Authoritative cost sources

3.3B must compose existing derived services rather than reimplement them.

### Child direct-material cost

Use:

`RecipeMaterialCostPreviewService.previewForProduct(productId)`

This remains the authoritative Phase 2 direct-material cost view.

Preserve its:

- `status`;
- `requirementStatus`;
- material cost lines;
- total direct-material cost;
- requirement issues;
- cost issues;
- yield/calibration traceability already represented by the preview.

### Material-backed child component cost

Use:

`MaterialBackedComponentCostService.costComponent(component)`

This remains the authoritative 3.3A line-cost view.

3.3B must not reimplement Material package-cost conversion rules.

### Product-backed child component cost

Recurse through the same 3.3B service.

No ProductStock dependency is introduced because stock availability is a capacity/readiness concern, not a Product cost input.

## Active Product relationship policy

A Product-backed component must currently resolve to an active child Product.

Read-time recursive costing returns controlled `not-ready` output when the child Product is:

- missing; or
- inactive/archived.

This mirrors the active dependency rule already enforced at save time while still protecting against corrupted/imported source data.

Do not call `ComponentSourceAvailabilityService` for Product cost eligibility because that service also evaluates ProductStock. Product cost must remain independent of current finished-stock quantity.

## Recursive tree contract

Recommended Product-backed line result:

```text
ProductBackedComponentCostLine
- componentId
- parentProductId
- role
- childProductId
- childProductName: string | null
- quantityPerParent
- path: string[]
- status: ready | partial | not-ready
- childDirectMaterialCost: RecipeMaterialCostPreviewResult | null
- childComponentCostSubtotal: number
- childComponentAwareUnitCost: number | null
- componentCostContribution: number | null
- breakdown: RecursiveComponentCostBreakdown[]
- issues[]
```

Recursive child breakdown:

```text
RecursiveComponentCostBreakdown
= material-backed 3.3A line
| product-backed 3.3B line
```

Each Product-backed line therefore carries the edge multiplier to its parent, while each 3.3A material-backed line already carries its `quantityPerParent`.

The hierarchy plus per-edge quantity preserves the full multiplication path.

## Readiness contract

3.3B uses:

```text
ready
partial
not-ready
```

### `ready`

The child Product is active, its Phase 2 direct-material cost is `ready`, and every nested Phase 3 component cost is `ready`.

The complete `childComponentAwareUnitCost` and parent contribution are known.

### `partial`

At least one reliable numeric cost contribution is derivable, but one or more required child cost inputs are unresolved or partial.

Examples:

- child Phase 2 direct-material preview is `partial` while valid direct-material lines remain;
- child Phase 2 direct-material preview is `not-ready`, but one or more child components have valid costs;
- direct-material cost is ready but a nested component is unresolved;
- a nested Product child itself is partial.

For `partial`, the service returns the **known current subtotal only** and clearly marks it incomplete. It must never silently relabel that subtotal as complete.

### `not-ready`

No reliable child unit-cost evidence can currently be produced, or the relationship itself is invalid.

Examples:

- invalid ProductComponent contract;
- non-Product-backed input;
- missing/inactive child Product;
- reachable composition cycle;
- reachable duplicate/corrupted component graph prevents safe aggregation and no other reliable cost evidence exists;
- child direct-material preview has no derivable lines and no child component contribution is derivable.

`childComponentAwareUnitCost` and `componentCostContribution` are `null` when no reliable numeric cost evidence exists.

## Known-cost aggregation semantics

For one child Product:

```text
known direct-material subtotal
= Phase 2 preview total when it contains derivable cost lines
= 0 when Phase 2 has no derivable lines

known component subtotal
= sum of non-null nested component contributions

known child unit cost
= known direct-material subtotal + known component subtotal
```

A numeric zero can still be reliable evidence.

Examples:

- a ready zero-cost direct-material line counts as known evidence;
- a ready zero-cost component counts as known evidence;
- `not-ready` direct-material preview with zero lines is unresolved, not authoritative zero.

A separate internal evidence flag must distinguish authoritative/derived zero from absence of cost evidence.

## Direct-material readiness propagation

Preserve the complete Phase 2 preview result on the child node.

Recommended summary issue mapping:

```text
DIRECT_MATERIAL_COST_PARTIAL
DIRECT_MATERIAL_COST_NOT_READY
```

Do not discard the detailed Phase 2 `requirementIssues` or `costIssues`; downstream 3.3C/UI must be able to inspect the original evidence without parsing summary messages.

## Nested component readiness propagation

For each child component:

- material-backed -> delegate to 3.3A;
- Product-backed -> recurse through 3.3B.

If a nested line is `partial` or `not-ready`, the current Product node cannot be `ready`.

Known numeric nested contributions may still participate in the partial subtotal.

## Cycle/path guard

Write-time graph validation from 3.1B remains authoritative, but 3.3B must independently guard its active recursive path so corrupted/imported data cannot recurse forever.

Canonical Product path identity:

```text
trim + case-insensitive
```

Example:

```text
A -> B -> C -> A
```

When a recursive edge attempts to revisit a Product already in the active path:

- stop recursion immediately for that edge;
- return controlled `not-ready` output for that edge;
- preserve a closed canonical cycle path such as `[a, b, c, a]`;
- allow unaffected sibling lines to remain available so the parent can become `partial` rather than losing all valid evidence.

The service must not depend solely on save-time validation.

## Reachable duplicate-source corruption

A corrupted parent composition containing duplicate source identity must not be double-counted.

For each currently traversed parent Product:

- validate its immediate component collection with the 3.1B source-uniqueness rule;
- if invalid, mark that Product's component aggregation unresolved;
- preserve direct-material cost evidence when available;
- do not let unrelated duplicate corruption elsewhere in the repository block a safe root.

This keeps corruption handling local to the reachable tree.

## Deterministic traversal

For every parent Product, component lines must be processed in deterministic order.

Recommended ordering:

1. normalized source type;
2. normalized source ID;
3. normalized component ID.

This makes tree output and tests stable regardless of repository insertion order.

## Issue contract

Baseline Product-backed issue codes:

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

Issue records may preserve:

- component/product IDs;
- current Product path;
- cycle path;
- underlying ProductComponent or 3.1B graph error code;
- direct-material issue summary.

Detailed nested/direct evidence remains available on the tree itself.

## Application service

Add:

```text
ProductBackedComponentCostService
```

Primary public operation:

```text
costComponent(component: ProductComponent)
```

Recommended dependencies:

- `ProductRepository`;
- `ProductComponentRepository`;
- Phase 2 direct-material cost preview provider;
- 3.3A material-backed component cost provider.

The service should load the current component collection once per top-level call, then traverse the reachable tree in memory so recursion does not repeatedly fetch the full repository.

## Shared application session

Add one shared instance:

```text
productBackedComponentCostService
```

Reuse:

```text
productRepository
productComponentRepository
recipeMaterialCostPreviewService
materialBackedComponentCostService
```

No new repository or BusinessDataset collection is introduced.

## Test plan

Focused tests must cover at minimum:

- one Product-backed child with ready Phase 2 direct-material cost and no nested components;
- parent edge quantity multiplier;
- child Product identity/name/path preservation;
- child with one 3.3A material-backed component;
- two-level Product nesting;
- three-level/deep acyclic nesting;
- mixed direct materials + material-backed + Product-backed nested components;
- complete recursive breakdown tree and edge multipliers;
- ready zero direct/component cost evidence remains numeric zero;
- Phase 2 partial direct-material cost -> partial child cost with known subtotal;
- Phase 2 not-ready/no direct lines + ready component -> partial child cost;
- Phase 2 not-ready/no direct lines + no derivable components -> not-ready/null cost;
- nested material component not-ready -> propagated partial/not-ready state;
- nested Product component partial -> propagated partial state;
- missing child Product -> controlled not-ready;
- inactive child Product -> controlled not-ready;
- top-level non-Product component -> controlled not-ready;
- invalid ProductComponent -> controlled not-ready;
- direct self-cycle corruption;
- deep reachable cycle corruption with closed path;
- unaffected sibling cost remains available when another branch cycles;
- reachable duplicate component source is not double-counted;
- unrelated duplicate/cycle corruption does not block a safe root where practical;
- deterministic tree ordering independent of insertion order;
- no ProductStock dependency/current stock influence;
- source Product/ProductComponent records are not mutated.

## Completion gate

3.3B is complete only when:

- Product-backed component cost recursively combines child Phase 2 direct-material cost and child Phase 3 component cost;
- 3.3A remains the sole Material-backed component cost implementation;
- nested Product cost supports arbitrary finite acyclic depth;
- full recursive breakdown tree is returned;
- Product IDs/names and edge quantity multipliers are preserved;
- Phase 2 direct-material lines and nested leaf component costs remain inspectable;
- ready/partial/not-ready propagates deterministically;
- partial known subtotal is distinguishable from complete cost;
- zero cost is distinguishable from absence of cost evidence;
- missing/inactive child Products are controlled not-ready results;
- reachable corrupted cycles cannot recurse indefinitely;
- reachable duplicate component sources are not double-counted;
- ProductStock/current stock does not affect Product cost;
- no derived recursive cost is persisted;
- shared session wiring exists;
- focused tests pass;
- full repository tests pass;
- TypeScript typecheck passes;
- production build passes;
- implementation PR merges to `develop`;
- exact post-merge `develop` CI is green.

## Next task after closeout

**3.3C — Total Component-Aware Product Cost & Readiness**

Do not begin 3.3C until 3.3B is merged, exact post-merge `develop` CI is green, and a dedicated 3.3C development plan/scope review is established.
