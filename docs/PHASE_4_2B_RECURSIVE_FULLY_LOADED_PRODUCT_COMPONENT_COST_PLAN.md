# Phase 4.2B — Recursive Fully Loaded Product Component Cost Development Plan

## Status

**PLANNED — IMPLEMENTATION NOT STARTED**

Authoritative base:

`develop` @ `03f56a7636bc4c8519fb392e6e01a16e0e6f011a`

Starting exact `develop` CI:

`34937778015 — SUCCESS`

Feature branch:

`feature/phase-4-2b-recursive-fully-loaded-product-component-cost`

Master plan:

`docs/PHASE_4_PRICING_PRODUCTION_PLANNING_PLAN.md`

Previous completed prerequisite:

`4.2A — Waste-Adjusted Direct-Material Unit Cost — COMPLETE`

## Objective

Create the authoritative Phase 4 recursive cost view for a Product-backed `ProductComponent` so a parent Product consumes the child Product's **fully loaded production cost**, never the child's selling price.

For a Product-backed component edge:

```text
parent -> child × quantityPerParent
```

4.2B must derive the child production cost from:

```text
child waste-adjusted direct-material cost
+ child Material-backed component cost
+ nested Product-backed child fully loaded production cost
+ child labor cost per unit
+ child overhead cost per unit
```

and then derive the parent-edge contribution:

```text
quantityPerParent × fullyLoadedUnitCost(child)
```

Child pricing policy, selling price, markup, margin, and profit are explicitly excluded.

## Authoritative master-plan contract

The Phase 4 master plan requires 4.2B to:

- extend Phase 3 recursive component graph cost semantics;
- keep Material-backed components on the existing Phase 3/Phase 1 purchased-component cost path;
- make Product-backed components contribute `quantityPerParent × fullyLoadedUnitCost(child)`;
- expose deterministic nested breakdown;
- expose parent/child quantity multipliers;
- expose child labor and overhead;
- expose child safety-waste-adjusted direct cost;
- propagate readiness/issues;
- keep a defensive corruption/cycle guard;
- exclude child selling price/profit from internal production cost.

## Split assessment

No deeper formal roadmap split is required.

4.2B is one cohesive recursive Product-backed component-cost capability. Internal implementation slices are:

1. provider/result contracts;
2. Product-backed edge validation and canonical identity/path handling;
3. child Product lookup/current-use eligibility;
4. child 4.2A waste-adjusted direct-material cost interpretation;
5. child financial-profile cost evidence;
6. child Material-backed component costing;
7. recursive child Product-backed component costing;
8. known-subtotal versus authoritative fully-loaded-total synthesis;
9. deterministic issue/readiness propagation;
10. corruption-safe cycle/graph guards;
11. shared session wiring;
12. focused and full regression validation.

4.2C remains responsible for synthesizing the **current/root Product's** total fully loaded unit cost from its own direct cost, own Material-backed components, 4.2B Product-backed component contributions, and own labor/overhead.

4.2B must not publish a root Product selling price or root Product fully loaded quote.

## Existing architecture reviewed

### Phase 3.3B recursive Product-backed component cost

Existing:

`src/application/productComponents/ProductBackedComponentCostService.ts`

Useful semantics to preserve:

- validates the `ProductComponent` contract;
- only Product-backed edges are accepted;
- canonical path uses normalized Product identities;
- child Product must exist and be active for current recursive use;
- component children are traversed deterministically;
- Material-backed children delegate to `MaterialBackedComponentCostService`;
- Product-backed children recurse;
- source uniqueness is checked defensively;
- an active recursion path detects corrupted/transitive cycles;
- ProductStock/current availability does not participate in cost mathematics.

4.2B should build a dedicated Phase 4 service rather than mutate the Phase 3 service because Phase 3 remains the historical material/component-only cost contract.

### Phase 4.2A waste-adjusted direct material cost

Existing:

`src/application/productCosts/WasteAdjustedDirectMaterialCostService.ts`

4.2B must consume this service for every recursive child Product.

Authoritative values include:

```text
status
baseDirectMaterialCostSubtotal
safetyWasteReserveCostSubtotal
pricingDirectMaterialCostPerUnit
lines[]
requirementIssues[]
costIssues[]
issues[]
```

The child direct-material contribution to fully loaded cost is:

```text
pricingDirectMaterialCostPerUnit
```

No additional safety-waste multiplication is allowed in 4.2B.

### Phase 4.1C financial profile service

Existing:

`ProductFinancialProfileService.getProfile(productId)`

A configured child profile supplies only these cost adders to 4.2B:

```text
laborCostPerUnit
overheadCostPerUnit
```

`pricingPolicy` is ignored for production-cost roll-up.

Missing profile and explicit zero profile are different:

```text
missing profile   = unresolved child production cost
profile 0 / 0     = known zero labor and overhead
```

## Proposed application service

Add:

`src/application/productCosts/RecursiveFullyLoadedProductComponentCostService.ts`

Public API:

```ts
costComponent(component: ProductComponent): Promise<RecursiveFullyLoadedProductComponentCostLine>
```

Expected dependencies:

```text
ProductRepository
ProductComponentRepository
WasteAdjustedDirectMaterialCostService/provider
MaterialBackedComponentCostService/provider
ProductFinancialProfileService/provider
```

No Phase 3 service is modified to become Phase 4 authoritative.

## Proposed result contract

Readiness:

```ts
type RecursiveFullyLoadedProductComponentCostStatus =
  | 'ready'
  | 'partial'
  | 'not-ready';
```

A Product-backed edge result should expose at least:

```text
componentId
parentProductId
role
childProductId
childProductName
quantityPerParent
path
status

childDirectMaterialCost
childDirectMaterialMode

childMaterialComponentCostSubtotal
childProductComponentCostSubtotal
childLaborCostPerUnit
childOverheadCostPerUnit

knownChildProductionCostSubtotal
childFullyLoadedUnitCost
knownComponentCostContribution
componentCostContribution

breakdown[]
issues[]
```

Suggested direct-material mode:

```text
costed
neutral-component-only
unresolved
```

This makes the component-only exception explicit rather than silently rewriting 4.2A status.

### Authoritative versus known partial values

`childFullyLoadedUnitCost` is authoritative only when the child recursive cost is fully `ready`.

If evidence is partial, expose known non-negative subtotals separately:

```text
knownChildProductionCostSubtotal
knownComponentCostContribution
```

but keep:

```text
childFullyLoadedUnitCost = null
componentCostContribution = null
```

This prevents an incomplete child production cost from being mistaken for a sellable/authoritative fully loaded cost.

## Child cost formula

For a ready child Product `C`:

```text
fullyLoadedUnitCost(C)
=
  wasteAdjustedDirectMaterialCost(C)
+ Σ(Material-backed child component contributions)
+ Σ(Product-backed child component fully loaded contributions)
+ laborCostPerUnit(C)
+ overheadCostPerUnit(C)
```

For the parent edge `P -> C`:

```text
componentCostContribution
= fullyLoadedUnitCost(C) × quantityPerParent(P -> C)
```

All math retains full numeric precision.

## Pricing-policy exclusion

The recursive production-cost algorithm must never use:

```text
pricingPolicy
sellingPrice
profit amount
markup rate
margin rate
```

A child profile with:

```text
pricingPolicy = null
```

can still produce a ready child production cost when labor/overhead and all production inputs are otherwise ready.

Similarly, changing only the child's pricing policy must not change the parent's 4.2B cost contribution.

## Financial-profile readiness

### Profile present

Use:

```text
laborCostPerUnit
overheadCostPerUnit
```

only when each is finite and non-negative.

Explicit zero is valid.

### Profile missing

Missing child profile means fully loaded cost is unresolved because labor/overhead configuration is unknown.

If material/component cost evidence is otherwise known:

```text
status = partial
knownChildProductionCostSubtotal = known material/component subtotal
childFullyLoadedUnitCost = null
componentCostContribution = null
```

If no meaningful child cost evidence exists:

```text
status = not-ready
```

### Defensive invalid profile

Although 4.1C validates writes, 4.2B must fail closed for future imported/corrupted records where:

- profile Product ID does not match the child Product;
- labor cost is non-finite/negative;
- overhead cost is non-finite/negative.

Do **not** reject a child cost because its pricing policy is missing or financially invalid; pricing policy is outside the recursive production-cost basis.

## Component-only child direct-material semantics

4.2A correctly preserves the Phase 2 authoritative behavior:

```text
NO_REQUIREMENTS
status = not-ready
```

4.2B now has Product-component context and must distinguish a real component-only handmade Product from broken direct-material evidence.

Treat the child direct-material side as neutral zero only when all are true:

1. 4.2A has no direct material lines;
2. no direct-material cost issue exists;
3. underlying requirement issues represent only `NO_REQUIREMENTS`;
4. the child has at least one valid component relationship to cost;
5. there is no other partial/broken direct-material evidence.

Then:

```text
childDirectMaterialMode = neutral-component-only
child direct-material contribution = 0
```

This does **not** mutate or reinterpret 4.2A globally.

If a child has no direct materials **and no components**, 4.2B keeps the child unresolved rather than assuming a zero-material Product.

If direct-material evidence is partial/broken, it remains unresolved and is never neutralized.

## Material-backed child components

Continue to delegate each Material-backed child relationship to:

`MaterialBackedComponentCostService`

Use its existing:

```text
componentCostContribution
```

No package conversion/calibration formula is duplicated.

Parent Product safety waste must not multiply discrete Material-backed component quantities or cost.

## Nested Product-backed components

Recurse through 4.2B semantics.

For nested edge:

```text
Child -> Grandchild × N
```

use:

```text
N × fullyLoadedUnitCost(Grandchild)
```

not the Phase 3 material/component-only child total.

Nested known partial subtotals may remain visible for diagnostics, but only ready nested component contributions participate in an authoritative fully loaded total.

## Deterministic traversal

Use the established deterministic component order:

1. `sourceType`;
2. normalized `sourceId`;
3. normalized component `id`.

Paths use normalized Product identities and remain stable across equivalent repository ordering.

Example:

```text
gift-set -> candle -> handmade-pot
```

## Corruption and cycle protection

The Phase 3 composition write contract remains authoritative for preventing new cycles.

4.2B still needs defensive reader protection for corrupted/imported future data.

Use an active Product path during recursion.

If the next child already exists in the active path:

```text
CYCLE_DETECTED
```

Return a controlled not-ready recursive line with deterministic:

```text
path
cyclePath
```

Also defensively validate immediate child component source uniqueness before recursive synthesis.

## Issue/readiness categories

Expected controlled issue codes include at least:

```text
INVALID_COMPONENT
NOT_PRODUCT_BACKED_COMPONENT
SOURCE_PRODUCT_NOT_FOUND
SOURCE_PRODUCT_INACTIVE
DIRECT_MATERIAL_COST_PARTIAL
DIRECT_MATERIAL_COST_NOT_READY
FINANCIAL_PROFILE_MISSING
FINANCIAL_PROFILE_PRODUCT_MISMATCH
FINANCIAL_PROFILE_COST_INVALID
COMPONENT_GRAPH_INVALID
MATERIAL_COMPONENT_NOT_READY
NESTED_PRODUCT_COMPONENT_PARTIAL
NESTED_PRODUCT_COMPONENT_NOT_READY
CYCLE_DETECTED
DERIVED_COST_INVALID
```

Underlying issue codes/messages should remain available where useful.

## Readiness synthesis

### ready

A Product-backed edge is `ready` only when:

- component contract is valid and Product-backed;
- child Product exists and is active;
- child direct-material side is either ready-costed or valid neutral component-only;
- child financial profile exists with valid labor/overhead;
- every Material-backed child contribution is ready;
- every nested Product-backed child contribution is ready;
- graph/path is valid;
- all derived totals are finite and non-negative.

Then:

```text
childFullyLoadedUnitCost != null
componentCostContribution != null
```

### partial

Use `partial` when at least one meaningful child cost subtotal is known but any required input is unresolved.

Examples:

- missing financial profile with known material/component cost;
- partial direct-material cost with known valid lines;
- one nested child unresolved while another child cost is known.

Keep authoritative fully loaded total/contribution `null`.

### not-ready

Use `not-ready` when no meaningful child production-cost evidence can be derived or structural validity prevents safe synthesis.

## Defensive cloning

Do not leak provider/repository mutable references.

Clone:

- 4.2A direct-material result and nested arrays/issues;
- financial cost evidence represented in output;
- Material-backed lines/issues;
- nested Product-backed recursive lines;
- paths/cycle paths;
- issue arrays.

## Shared session wiring

Update:

`src/application/session.ts`

Add shared:

```text
recursiveFullyLoadedProductComponentCostService
```

constructed from existing shared instances:

```text
productRepository
productComponentRepository
wasteAdjustedDirectMaterialCostService
materialBackedComponentCostService
productFinancialProfileService
```

This service becomes the Product-backed component cost input for 4.2C.

No React changes belong to 4.2B.

## Focused test matrix

### Basic fully loaded child cost

- ready child direct cost + labor + overhead;
- explicit zero labor/overhead;
- parent quantity multiplier;
- child safety-waste direct cost visible and included exactly once;
- no pricing policy required.

### Material-backed children

- one Material-backed component contribution;
- multiple Material-backed component contributions;
- Material-backed not-ready propagation;
- parent safety waste does not affect component quantity/cost.

### Nested Product-backed children

- two-level recursive Product cost;
- three-level deterministic nested path;
- nested quantity multipliers at each edge;
- nested child labor/overhead included exactly once;
- nested child own safety-waste direct cost included exactly once;
- child selling price/pricing policy never contributes.

### Financial profile readiness

- missing child profile => partial with known subtotal, authoritative total null;
- explicit 0/0 profile => known/ready zero adders;
- Product ID mismatch => fail closed;
- negative/non-finite labor/overhead => fail closed;
- `pricingPolicy: null` does not block production cost;
- changing only pricing policy leaves recursive cost unchanged.

### Component-only semantics

- child with `NO_REQUIREMENTS` plus valid component(s) treats direct side as neutral zero;
- component-only child can become ready when components/profile are ready;
- `NO_REQUIREMENTS` with no components remains unresolved;
- partial/broken direct evidence is never neutralized.

### Structural protection

- invalid component contract;
- non-Product-backed root edge;
- missing child Product;
- inactive child Product;
- duplicate immediate source relationship corruption;
- direct self-cycle;
- transitive cycle;
- deterministic cycle path;
- deterministic traversal independent of repository insertion order.

### Partial evidence

- partial direct material known subtotal;
- nested partial Product component;
- material child unresolved while another cost is known;
- known subtotal remains visible;
- authoritative fully loaded total/contribution remains null whenever unresolved.

### Session wiring

- shared session exposes 4.2B service;
- no ProductStock dependency;
- no UI/source mutation path.

## Expected files

Likely changes:

```text
docs/PHASE_4_2B_RECURSIVE_FULLY_LOADED_PRODUCT_COMPONENT_COST_PLAN.md
docs/PHASE_4_2B_RECURSIVE_FULLY_LOADED_PRODUCT_COMPONENT_COST.md
src/application/productCosts/RecursiveFullyLoadedProductComponentCostService.ts
src/application/productCosts/RecursiveFullyLoadedProductComponentCostService.test.ts
src/application/productCosts/RecursiveFullyLoadedProductComponentCostSession.test.ts
src/application/session.ts
```

No new persisted source/domain entity is expected.

## Explicit non-goals

4.2B does not implement:

- root Product total fully loaded unit cost synthesis (4.2C);
- selling price derivation;
- child retail/selling-price roll-up;
- profit, markup, or margin roll-up;
- physical planned-batch financials;
- expected revenue/profit;
- capacity feasibility/warnings;
- ProductStock-dependent costing;
- stock reservation/deduction;
- production posting;
- React UI;
- Excel/Tauri persistence;
- payroll/timekeeping;
- global overhead allocation.

## Implementation order

1. Create this dedicated plan before implementation code. ✅
2. Add 4.2B service/provider/result contracts.
3. Validate Product-backed root edge and canonical path.
4. Load child Product and all component relationships.
5. Resolve child 4.2A direct-material cost semantics.
6. Resolve child labor/overhead financial profile while ignoring pricing policy.
7. Cost Material-backed child components through existing 3.3A service.
8. Recurse Product-backed child components through 4.2B.
9. Add known-subtotal versus authoritative-total synthesis.
10. Add deterministic readiness/issues/path/cycle behavior.
11. Add shared session wiring.
12. Add focused tests.
13. Run full CI.
14. Create implementation record and advance plan to merge-gate-pending.
15. Require green CI on exact documented feature head.
16. Compare exact branch scope against starting `develop`.
17. Open implementation PR to `develop`.
18. Require independent PR CI.
19. Merge with expected-head protection.
20. Require exact post-merge `develop` CI.
21. Create documentation-only closeout.
22. Mark 4.2B COMPLETE / 4.2C NEXT in `docs/PHASE_4_PROGRESS.md`.
23. Require closeout PR CI and exact final `develop` CI.

## Completion gate

4.2B is complete only when:

- Product-backed child cost uses fully loaded production cost, not Phase 3 material-only cost;
- each child's 4.2A safety-waste direct cost is included exactly once;
- each child's labor/overhead is included exactly once;
- Material-backed child costs remain delegated to existing authoritative costing;
- nested Product-backed costs recurse deterministically;
- child pricing policy/profit is excluded;
- missing/invalid financial cost evidence fails closed;
- component-only child semantics are explicit and tested;
- partial known subtotals never masquerade as authoritative fully loaded totals;
- defensive graph/cycle handling is deterministic;
- ProductStock/current availability does not affect cost;
- focused tests, full tests, typecheck, and production build pass;
- implementation PR and exact post-merge `develop` CI pass;
- closeout PR and exact final `develop` CI pass.

## Next task after completion

**4.2C — Total Fully Loaded Unit Cost & Readiness — NEXT / NOT STARTED**

Do not begin 4.2C until 4.2B is fully merged, closed out, and exact final `develop` CI is green.
