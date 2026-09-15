# Phase 4.2B — Recursive Fully Loaded Product Component Cost Development Plan

## Status

**IMPLEMENTED — MERGE GATE PENDING**

Authoritative base:

`develop` @ `03f56a7636bc4c8519fb392e6e01a16e0e6f011a`

Starting exact `develop` CI:

`34937778015 — SUCCESS`

Feature branch:

`feature/phase-4-2b-recursive-fully-loaded-product-component-cost`

Implementation record:

`docs/PHASE_4_2B_RECURSIVE_FULLY_LOADED_PRODUCT_COMPONENT_COST.md`

Master plan:

`docs/PHASE_4_PRICING_PRODUCTION_PLANNING_PLAN.md`

## Objective

Deliver the authoritative Phase 4 recursive production-cost view for Product-backed component relationships.

For child Product `C`:

```text
fullyLoadedUnitCost(C)
=
  waste-adjusted direct-material cost from 4.2A
+ Material-backed component cost from 3.3A
+ nested Product-backed fully loaded cost from 4.2B
+ laborCostPerUnit(C)
+ overheadCostPerUnit(C)
```

For parent edge `P -> C`:

```text
componentCostContribution
= fullyLoadedUnitCost(C) × quantityPerParent
```

Child selling price, profit, markup, and margin are excluded.

## Split assessment

No deeper formal roadmap split was required.

4.2B remained one cohesive recursive Product-backed cost capability. 4.2C remains responsible for the current/root Product's final total fully loaded unit-cost synthesis.

## Delivered application service

Added:

`src/application/productCosts/RecursiveFullyLoadedProductComponentCostService.ts`

Public boundary:

```text
costComponent(component)
```

Dependencies:

```text
ProductRepository
ProductComponentRepository
WasteAdjustedDirectMaterialCostService
MaterialBackedComponentCostService
ProductFinancialProfileService
```

No Phase 3 service was repurposed as Phase 4 authority.

## Delivered result semantics

Each Product-backed edge exposes:

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

Readiness:

```text
ready
partial
not-ready
```

## 4.2A integration

Every recursive child Product consumes the existing 4.2A service.

The direct-material contribution is:

```text
pricingDirectMaterialCostPerUnit
```

The child safety-waste reserve is therefore included exactly once.

4.2B does not multiply safety waste again.

## Financial-profile semantics

Only these profile fields participate in production cost:

```text
laborCostPerUnit
overheadCostPerUnit
```

Explicit zero is valid.

Missing profile is unresolved.

Imported/corrupted negative or non-finite financial adders fail closed.

Profile Product identity mismatch fails closed.

`pricingPolicy` is ignored for production-cost roll-up. A null policy does not block cost readiness, and changing only pricing policy does not alter recursive production cost.

## Component-only child semantics

The dedicated plan established a controlled interpretation for real component-only Products.

4.2A itself remains unchanged and still reports:

```text
NO_REQUIREMENTS
not-ready
```

4.2B treats that direct-material side as neutral zero only when:

- there are no direct-material lines;
- no direct cost issue exists;
- underlying requirement issues are only `NO_REQUIREMENTS`;
- 4.2A synthesis issues are only the expected no-requirement readiness markers;
- the child actually has at least one component relationship.

The result exposes:

```text
childDirectMaterialMode = neutral-component-only
```

No-direct/no-component Products remain unresolved.

Partial/broken direct-material evidence is never neutralized.

## Recursive component semantics

Material-backed children continue through:

`MaterialBackedComponentCostService`

Product-backed children recurse through 4.2B itself.

Nested edge quantity multipliers apply at each Product relationship.

Child labor/overhead and child safety-waste direct cost are each included exactly once.

ProductStock/current stock availability does not participate in cost mathematics.

## Known partial versus authoritative cost

When incomplete evidence still provides known cost:

```text
knownChildProductionCostSubtotal
knownComponentCostContribution
```

remain visible.

But unresolved required evidence forces:

```text
childFullyLoadedUnitCost = null
componentCostContribution = null
```

This prevents an incomplete subtotal from becoming an authoritative pricing input.

## Deterministic graph behavior

Immediate components are ordered by:

1. source type;
2. normalized source ID;
3. normalized component ID.

Paths use normalized Product IDs.

The reader defensively checks immediate source uniqueness and tracks an active recursion path.

Corrupted direct/transitive cycles fail closed with deterministic:

```text
path
cyclePath
```

## Controlled issue classes

Implemented issue coverage includes:

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

## Shared session wiring

Updated:

`src/application/session.ts`

Added:

`recursiveFullyLoadedProductComponentCostService`

using the existing shared repositories/services.

This becomes the Product-backed fully loaded cost input for 4.2C.

## Files changed

```text
docs/PHASE_4_2B_RECURSIVE_FULLY_LOADED_PRODUCT_COMPONENT_COST_PLAN.md
docs/PHASE_4_2B_RECURSIVE_FULLY_LOADED_PRODUCT_COMPONENT_COST.md
src/application/productCosts/RecursiveFullyLoadedProductComponentCostService.ts
src/application/productCosts/RecursiveFullyLoadedProductComponentCostService.test.ts
src/application/productCosts/RecursiveFullyLoadedProductComponentCostSession.test.ts
src/application/session.ts
```

## Validation evidence

Implementation head:

`fbf804234896d92a18c7721dfe53470d801f89fd`

Implementation CI:

`34938739599 — SUCCESS`

Observed automated surface:

```text
63 test files passed
754 tests passed
23 dedicated 4.2B service tests
1 4.2B shared-session wiring test
7 React smoke tests
TypeScript typecheck passed
production build passed
102 modules transformed
```

No corrective implementation cycle was required.

## Focused coverage completed

- direct + labor + overhead fully loaded cost;
- explicit zero financial adders;
- parent edge multiplier;
- child safety-waste direct cost exactly once;
- purchased Material-backed child cost;
- two-level Product recursion and nested multipliers;
- child pricing-policy exclusion;
- missing/invalid/mismatched financial profiles;
- component-only neutral direct cost;
- no-direct/no-component unresolved case;
- partial direct evidence preservation;
- unresolved Material-backed component propagation;
- nested Product partial propagation;
- missing/inactive child Product;
- non-Product-backed root rejection;
- direct/transitive cycle detection;
- duplicate-source graph corruption;
- deterministic traversal;
- partial known subtotal versus authoritative total separation;
- shared session wiring.

## Scope retained

4.2B did not implement:

- root Product total fully loaded unit cost (4.2C);
- selling price/profit/markup/margin;
- child selling-price roll-up;
- physical planned-batch financials;
- revenue/profit projection;
- capacity feasibility;
- ProductStock-dependent cost;
- stock reservation/deduction;
- production posting;
- React UI;
- Excel/Tauri persistence;
- payroll/timekeeping;
- global overhead allocation.

## Lifecycle state

Completed:

1. exact authoritative `develop` verification ✅
2. master-plan/architecture review ✅
3. dedicated development plan before code ✅
4. split assessment ✅
5. recursive service/result/provider contracts ✅
6. 4.2A direct-cost integration ✅
7. child labor/overhead integration ✅
8. Material-backed delegation ✅
9. recursive Product-backed roll-up ✅
10. component-only direct semantics ✅
11. known-partial versus authoritative-total behavior ✅
12. deterministic graph/cycle protection ✅
13. shared session wiring ✅
14. focused tests ✅
15. full implementation CI ✅
16. implementation record ✅

Remaining:

17. clean CI on exact documented feature head;
18. exact scope compare against starting `develop`;
19. implementation PR to `develop`;
20. independent PR CI;
21. merge with expected-head protection;
22. exact post-merge `develop` CI;
23. documentation-only closeout;
24. mark 4.2B COMPLETE / 4.2C NEXT;
25. closeout PR CI and exact final `develop` CI.

## Completion gate

4.2B is complete only when all implementation and closeout gates pass and the tracker advances to:

```text
4.2B — Recursive Fully Loaded Product Component Cost  COMPLETE
4.2C — Total Fully Loaded Unit Cost & Readiness       NEXT
```

## Next task after completion

**4.2C — Total Fully Loaded Unit Cost & Readiness — NEXT / NOT STARTED**

Do not begin 4.2C until 4.2B is fully merged, closed out, and exact final `develop` CI is green.
