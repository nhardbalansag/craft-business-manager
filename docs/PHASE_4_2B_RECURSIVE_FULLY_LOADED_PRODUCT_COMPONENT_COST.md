# Phase 4.2B — Recursive Fully Loaded Product Component Cost

## Status

**COMPLETE**

Authoritative implementation base:

`develop` @ `03f56a7636bc4c8519fb392e6e01a16e0e6f011a`

Feature branch:

`feature/phase-4-2b-recursive-fully-loaded-product-component-cost`

Development plan:

`docs/PHASE_4_2B_RECURSIVE_FULLY_LOADED_PRODUCT_COMPONENT_COST_PLAN.md`

Implementation PR:

`#104 — Phase 4.2B — Recursive Fully Loaded Product Component Cost`

Implementation merge:

`43248152960681afb23d3c56f08712918ae58d06`

## Delivered service

Added:

`src/application/productCosts/RecursiveFullyLoadedProductComponentCostService.ts`

Public boundary:

```text
costComponent(component)
```

The service derives the fully loaded production cost for a Product-backed component edge while keeping child retail pricing completely outside internal production cost.

## Authoritative child production-cost formula

For child Product `C`:

```text
fullyLoadedUnitCost(C)
=
  C waste-adjusted direct-material cost from 4.2A
+ C Material-backed component contributions from 3.3A
+ C nested Product-backed fully loaded component contributions from 4.2B
+ C laborCostPerUnit
+ C overheadCostPerUnit
```

For parent edge `P -> C`:

```text
componentCostContribution
= fullyLoadedUnitCost(C) × quantityPerParent
```

All math remains full precision.

## Child pricing exclusion

4.2B reads only child labor/overhead from the Product financial profile.

It deliberately ignores:

```text
pricingPolicy
selling price
profit amount
markup rate
margin rate
```

A child with `pricingPolicy = null` can still be fully ready for production-cost roll-up.

Changing only the child's pricing policy does not change the parent component production cost.

## 4.2A direct-material integration

Every recursive child Product consumes:

`WasteAdjustedDirectMaterialCostService`

The service uses:

`pricingDirectMaterialCostPerUnit`

from 4.2A as the child direct-material production-cost contribution.

No additional safety-waste multiplication occurs in 4.2B.

Each child's base direct-material cost, safety-waste reserve, pricing direct-material total, and material trace remain visible through the nested 4.2A result.

## Component-only Product semantics

4.2A intentionally preserves `NO_REQUIREMENTS / not-ready` when a Product has no direct recipe.

4.2B adds the controlled mode:

```text
neutral-component-only
```

A no-direct-material child is neutral zero only when:

- its 4.2A result has no direct lines;
- no direct cost issue exists;
- underlying requirement issues are only `NO_REQUIREMENTS`;
- 4.2A synthesis issues are only the expected no-requirement readiness markers;
- the child has at least one component relationship.

This lets genuine component-only handmade assemblies become ready without globally changing 4.2A semantics.

A Product with no direct materials and no components remains unresolved. Broken/partial direct-material evidence is never neutralized.

## Financial profile readiness

Missing child profile is unresolved because labor/overhead are unknown.

Explicit:

```text
laborCostPerUnit = 0
overheadCostPerUnit = 0
```

is valid known-zero evidence.

4.2B defensively fails closed for:

- financial-profile Product identity mismatch;
- negative/non-finite labor;
- negative/non-finite overhead.

Pricing policy validity is intentionally irrelevant to production-cost roll-up.

## Known partial evidence versus authoritative totals

4.2B exposes:

```text
knownChildProductionCostSubtotal
knownComponentCostContribution
```

when partial cost evidence is available.

But if any required production-cost input remains unresolved:

```text
childFullyLoadedUnitCost = null
componentCostContribution = null
```

This prevents incomplete known subtotals from being mistaken for authoritative fully loaded cost.

## Recursive component behavior

Material-backed child components delegate to:

`MaterialBackedComponentCostService`

Product-backed child components recurse through the new 4.2B service.

Nested edge quantities are applied at every edge.

ProductStock/current availability is not a cost input.

## Deterministic graph/path behavior

Child components are ordered by:

1. source type;
2. normalized source ID;
3. normalized component ID.

Recursive paths use normalized Product identities.

The service defensively validates immediate ProductComponent source uniqueness and maintains an active Product path to detect corrupted cycles.

Cycle failures expose deterministic:

```text
path
cyclePath
```

without infinite recursion.

## Readiness

Result status:

```text
ready
partial
not-ready
```

`ready` requires a valid Product-backed edge, active existing child Product, ready 4.2A direct cost or valid neutral component-only direct side, valid configured labor/overhead, ready Material-backed child costs, ready nested Product-backed child costs, valid graph/path, and finite non-negative totals.

`partial` preserves known cost evidence while one or more required production-cost inputs remain unresolved.

`not-ready` is used when structural validity fails or no usable production-cost evidence can be safely derived.

## Shared session

Updated:

`src/application/session.ts`

Added:

`recursiveFullyLoadedProductComponentCostService`

wired from the existing shared:

```text
productRepository
productComponentRepository
wasteAdjustedDirectMaterialCostService
materialBackedComponentCostService
productFinancialProfileService
```

## Tests

Added:

```text
src/application/productCosts/RecursiveFullyLoadedProductComponentCostService.test.ts
src/application/productCosts/RecursiveFullyLoadedProductComponentCostSession.test.ts
```

Focused coverage includes:

- direct + labor + overhead fully loaded cost;
- explicit zero financial adders;
- parent edge quantity multiplication;
- child safety-waste direct cost exactly once;
- Material-backed component contribution;
- nested Product recursion and quantity multipliers;
- nested child labor/overhead;
- pricing-policy exclusion;
- missing/invalid/mismatched financial profile;
- component-only neutral direct semantics;
- no-direct/no-component unresolved semantics;
- partial direct evidence preservation;
- Material-backed unresolved propagation;
- nested Product partial propagation;
- missing/inactive child Product;
- non-Product-backed root rejection;
- direct and transitive cycle protection;
- duplicate-source graph corruption;
- deterministic traversal ordering;
- known partial subtotal versus authoritative total separation;
- shared session wiring.

## Validation evidence

```text
Starting develop                  03f56a7636bc4c8519fb392e6e01a16e0e6f011a
Starting develop CI               34937778015 — SUCCESS
Plan commit                       06bb9aa4cffde4da050fda8be4c1faa17dc3d9f1
Implementation head               fbf804234896d92a18c7721dfe53470d801f89fd
Implementation CI                 34938739599 — SUCCESS
Final documented feature head     df0e6b406c0ef82763b6870b81e8d01aac34c10c
Final feature-head CI              34938953338 — SUCCESS
Implementation PR                 #104 — MERGED
PR CI                             34939051807 — SUCCESS
Implementation merge              43248152960681afb23d3c56f08712918ae58d06
Post-merge develop CI             34939144860 — SUCCESS
```

Observed automated surface:

```text
63 test files passed
754 tests passed
23 dedicated 4.2B service tests
1 4.2B shared-session wiring test
7 React smoke tests
TypeScript typecheck passed
production Vite build passed
102 modules transformed
```

No corrective implementation cycle was required.

## Scope retained

4.2B did not implement:

- root Product total fully loaded cost synthesis (4.2C);
- selling price/profit/markup/margin;
- child retail price roll-up;
- planned-batch financials;
- revenue/profit projection;
- capacity feasibility;
- ProductStock-dependent cost;
- stock reservation/deduction;
- production posting;
- React UI;
- Excel/Tauri persistence;
- payroll/timekeeping;
- global overhead allocation.

## Completion result

All implementation gates passed:

- plan-before-code gate ✅
- implementation/typecheck/tests/build gate ✅
- exact documented-head CI gate ✅
- clean scope compare ✅
- implementation PR CI gate ✅
- expected-head protected merge ✅
- exact post-merge `develop` CI gate ✅

The remaining repository action is this documentation-only closeout PR and its final exact-`develop` CI gate.

## Next task

**4.2C — Total Fully Loaded Unit Cost & Readiness — NEXT / NOT STARTED**

Do not begin 4.2C until this 4.2B documentation-only closeout is merged and exact final `develop` CI is green, and do not implement it before its own dedicated development plan/scope review is established.
