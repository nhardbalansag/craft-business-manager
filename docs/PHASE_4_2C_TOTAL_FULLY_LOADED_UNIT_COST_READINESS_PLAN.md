# Phase 4.2C — Total Fully Loaded Unit Cost & Readiness Development Plan

## Status

**PLANNED — IMPLEMENTATION NOT STARTED**

Authoritative base:

`develop` @ `38e7b73f44266c6aa3c709d13e66cebddd48d425`

Starting exact `develop` CI:

`34939643842 — SUCCESS`

Feature branch:

`feature/phase-4-2c-total-fully-loaded-unit-cost`

Master plan:

`docs/PHASE_4_PRICING_PRODUCTION_PLANNING_PLAN.md`

Previous completed prerequisites:

- `4.2A — Waste-Adjusted Direct-Material Unit Cost — COMPLETE`
- `4.2B — Recursive Fully Loaded Product Component Cost — COMPLETE`

## Objective

Create the authoritative Phase 4 root-Product fully loaded unit-cost synthesis.

For Product `P`:

```text
fullyLoadedUnitCost(P)
=
  P waste-adjusted direct-material cost
+ P Material-backed component cost
+ P Product-backed fully loaded component cost
+ P laborCostPerUnit
+ P overheadCostPerUnit
```

This result becomes the authoritative cost basis for Phase 4.3 selling-price derivation.

The service must preserve traceability and fail closed: known partial cost evidence may remain visible, but `totalFullyLoadedUnitCost` must be `null` unless every required production-cost input is ready.

## Authoritative master-plan contract

4.2C must synthesize:

```text
waste-adjusted direct-material cost
+ Material-backed component cost
+ recursively fully loaded Product-backed component cost
+ own labor cost
+ own overhead cost
= total fully loaded unit cost
```

Deliver:

- input/material-component subtotal;
- labor subtotal;
- overhead subtotal;
- total unit cost;
- `ready | partial | not-ready` status;
- complete trace/issues.

This task must not derive selling price, profit, markup, margin, planned-batch financials, capacity feasibility, UI, or persistence.

## Split assessment

No deeper formal roadmap split is required.

4.2C is one cohesive root-cost synthesis capability. Internal implementation slices are:

1. root Product lookup and canonical identity;
2. root component collection and deterministic ordering;
3. root 4.2A direct-material interpretation;
4. component-only root neutral-direct interpretation;
5. root financial-profile labor/overhead evidence;
6. Material-backed component contribution synthesis;
7. Product-backed component contribution synthesis through 4.2B;
8. component-graph uniqueness guard;
9. known partial subtotal versus authoritative total;
10. readiness/issue synthesis;
11. defensive cloning;
12. shared session wiring;
13. focused tests and full regression validation.

4.3A remains responsible for combining this cost result with pricing policy to derive selling price.

## Existing architecture reviewed

### 4.2A — root direct-material input

Use:

`WasteAdjustedDirectMaterialCostService.costProduct(productId)`

Authoritative per-unit direct-material cost:

`pricingDirectMaterialCostPerUnit`

This already includes the Product's forward safety-waste reserve exactly once.

4.2C must not multiply safety waste again.

### Phase 3.3A — Material-backed components

Use:

`MaterialBackedComponentCostService.costComponent(component)`

A ready Material-backed component contributes its existing:

`componentCostContribution`

No package conversion/calibration formula is duplicated.

### 4.2B — Product-backed components

Use:

`RecursiveFullyLoadedProductComponentCostService.costComponent(component)`

A ready Product-backed component contributes its existing:

`componentCostContribution`

That contribution already includes the child Product's own waste-adjusted direct materials, Material-backed components, nested Product-backed components, labor, and overhead.

Child selling price/profit is not included.

### 4.1C — root financial profile

Use:

`ProductFinancialProfileService.getProfile(productId)`

Only these fields affect 4.2C production cost:

- `laborCostPerUnit`
- `overheadCostPerUnit`

`pricingPolicy` is ignored by 4.2C cost readiness.

A profile with `pricingPolicy = null` can still produce a ready fully loaded unit cost.

Changing only pricing policy must not change the 4.2C cost result.

## Proposed application service

Add:

`src/application/productCosts/FullyLoadedProductUnitCostService.ts`

Public boundary:

```ts
costProduct(productId: string): Promise<FullyLoadedProductUnitCostResult>
```

Expected dependencies:

```text
ProductRepository
ProductComponentRepository
WasteAdjustedDirectMaterialCostService/provider
MaterialBackedComponentCostService/provider
RecursiveFullyLoadedProductComponentCostService/provider
ProductFinancialProfileService/provider
```

No Phase 2/3/4.2A/4.2B formulas should be duplicated.

## Proposed result contract

Readiness:

```ts
type FullyLoadedProductUnitCostStatus = 'ready' | 'partial' | 'not-ready';
```

Direct-material mode:

```ts
type FullyLoadedRootDirectMaterialMode =
  | 'costed'
  | 'neutral-component-only'
  | 'unresolved';
```

Expected result fields:

```text
productId
productName
productIsActive
status

directMaterialCost
directMaterialMode
directMaterialCostSubtotal

materialComponentCostSubtotal
productComponentCostSubtotal
inputMaterialComponentSubtotal

laborCostPerUnit
overheadCostPerUnit

knownFullyLoadedUnitCostSubtotal
totalFullyLoadedUnitCost

componentLines[]
issues[]
```

`totalFullyLoadedUnitCost` is authoritative only when `status = ready`.

When evidence is incomplete, expose known cost through `knownFullyLoadedUnitCostSubtotal` but keep `totalFullyLoadedUnitCost = null`.

## Root direct-material semantics

### Ready direct cost

If 4.2A provides a finite non-negative `pricingDirectMaterialCostPerUnit` and status `ready`:

```text
directMaterialMode = costed
```

### Partial direct cost

If 4.2A provides finite known direct cost but status is `partial`:

- preserve the known subtotal;
- mark the root unresolved;
- add a controlled direct-material partial issue;
- do not publish an authoritative total.

### Genuine component-only Product

4.2A deliberately preserves Phase 2 `NO_REQUIREMENTS / not-ready` semantics.

4.2C may treat the root direct-material side as neutral zero only when:

1. the 4.2A result has no direct material lines;
2. `pricingDirectMaterialCostPerUnit` is `null`;
3. no direct-material cost issue exists;
4. all requirement issues are `NO_REQUIREMENTS`;
5. 4.2A synthesis issues are only expected no-requirement readiness markers;
6. the Product has at least one component relationship.

Then:

```text
directMaterialMode = neutral-component-only
direct material subtotal = 0
```

This does not alter 4.2A globally.

### No direct materials and no components

Do not assume zero-material readiness.

The Product remains unresolved because no production-input basis exists.

### Broken direct-material evidence

Partial/broken direct evidence is never neutralized.

## Root financial-profile semantics

### Profile present

Use:

```text
laborCostPerUnit
overheadCostPerUnit
```

when both are finite and non-negative.

Explicit `0` is valid known-zero evidence.

### Profile missing

Missing profile means labor/overhead are unresolved.

If material/component evidence is otherwise known:

```text
status = partial
knownFullyLoadedUnitCostSubtotal = known production-input subtotal
totalFullyLoadedUnitCost = null
```

### Defensive invalid profile

Although 4.1C validates writes, 4.2C must fail closed for future imported/corrupted records where:

- profile Product ID does not match the root Product;
- labor is negative/non-finite;
- overhead is negative/non-finite.

`pricingPolicy` validity must not affect 4.2C production-cost readiness.

## Material-backed component semantics

For each root Material-backed component:

- delegate to `MaterialBackedComponentCostService`;
- use ready finite non-negative `componentCostContribution`;
- preserve line trace/issues;
- if unresolved, mark root cost unresolved;
- parent safety waste does not multiply discrete component quantity/cost.

## Product-backed component semantics

For each root Product-backed component:

- delegate to `RecursiveFullyLoadedProductComponentCostService`;
- use ready finite non-negative `componentCostContribution`;
- preserve nested trace/path/issues;
- if 4.2B is partial/not-ready, root cost becomes unresolved;
- known 4.2B partial contribution may contribute to `knownFullyLoadedUnitCostSubtotal`, but never to authoritative `totalFullyLoadedUnitCost`.

## Component graph integrity

Collect immediate root components and validate source uniqueness using the existing composition-graph helper.

If root component source uniqueness is corrupted:

```text
COMPONENT_GRAPH_INVALID
```

Fail closed for the component side.

The deeper Product graph cycle/corruption guard remains delegated to 4.2B.

## Deterministic ordering

Immediate root components must be ordered by:

1. `sourceType`;
2. normalized `sourceId`;
3. normalized component `id`.

This keeps trace output stable across repository insertion order.

## Known subtotal versus authoritative total

Known subtotal may include only valid known evidence:

```text
known direct cost
+ known Material-backed component contributions
+ known Product-backed component contributions
+ labor/overhead when financial profile is resolved
```

If any required evidence is unresolved:

```text
totalFullyLoadedUnitCost = null
```

Do not expose an incomplete subtotal under the authoritative total field.

## Total formula

When all evidence is ready:

```text
inputMaterialComponentSubtotal
=
  directMaterialCostSubtotal
+ materialComponentCostSubtotal
+ productComponentCostSubtotal

fullyLoadedUnitCost
=
  inputMaterialComponentSubtotal
+ laborCostPerUnit
+ overheadCostPerUnit
```

All math retains full numeric precision.

## Readiness synthesis

### ready

Requires:

- root Product exists;
- direct side is ready-costed or valid neutral component-only;
- root financial profile is present and valid for labor/overhead;
- root component graph source uniqueness is valid;
- every Material-backed component contribution is ready;
- every Product-backed component contribution is ready through 4.2B;
- all derived subtotals/totals are finite and non-negative.

Then:

```text
totalFullyLoadedUnitCost != null
```

### partial

Use when meaningful cost evidence is known but at least one required input is unresolved.

Examples:

- missing financial profile with known production-input cost;
- partial direct-material evidence with known subtotal;
- one unresolved component while another contribution is known;
- partial nested Product-backed cost from 4.2B.

Keep authoritative total `null`.

### not-ready

Use when:

- no meaningful production-cost evidence is available; or
- structural validity prevents safe synthesis and no valid known subtotal exists.

## Root Product active state

4.2C should preserve the existing Phase 3 root-cost convention:

- root Product existence is required;
- archived root Product identity may still be inspected/costed for historical/planning visibility;
- `productIsActive` is exposed in the result;
- current-use eligibility of Product-backed child components remains governed by 4.2B, which requires active child Products.

4.2C must not silently reactivate or mutate Product state.

## Controlled issue categories

Expected issue codes include at least:

```text
DIRECT_MATERIAL_COST_PARTIAL
DIRECT_MATERIAL_COST_NOT_READY
FINANCIAL_PROFILE_MISSING
FINANCIAL_PROFILE_PRODUCT_MISMATCH
FINANCIAL_PROFILE_COST_INVALID
COMPONENT_GRAPH_INVALID
MATERIAL_COMPONENT_PARTIAL
MATERIAL_COMPONENT_NOT_READY
PRODUCT_COMPONENT_PARTIAL
PRODUCT_COMPONENT_NOT_READY
DERIVED_COST_INVALID
```

A missing root Product may remain a typed service exception, consistent with existing Product-level derived services.

Underlying provider issue codes/messages should remain available where useful.

## Defensive cloning

Do not leak mutable provider/repository references.

Clone:

- 4.2A result and nested arrays/issues;
- Material-backed component lines and nested availability/issues;
- 4.2B recursive component lines, paths, nested breakdown, and issues;
- root issue arrays;
- component line arrays.

## Shared session wiring

Update:

`src/application/session.ts`

Add shared:

```text
fullyLoadedProductUnitCostService
```

constructed from existing shared:

```text
productRepository
productComponentRepository
wasteAdjustedDirectMaterialCostService
materialBackedComponentCostService
recursiveFullyLoadedProductComponentCostService
productFinancialProfileService
```

This service becomes the authoritative Phase 4.3 cost-basis input.

No React changes belong to 4.2C.

## Focused test matrix

Cover at least:

1. root direct material + labor + overhead;
2. explicit zero labor/overhead;
3. root direct safety-waste reserve included exactly once;
4. Material-backed root component cost;
5. Product-backed root component uses 4.2B fully loaded contribution;
6. mixed direct + Material-backed + Product-backed + labor + overhead total;
7. multiple component quantity multipliers already reflected in provider contributions;
8. component-only root neutral direct behavior;
9. no-direct/no-component root remains unresolved;
10. missing root financial profile;
11. invalid/mismatched root profile;
12. `pricingPolicy = null` does not block cost readiness;
13. changing pricing policy alone does not change fully loaded cost;
14. partial direct-material evidence preserves known subtotal but blocks total;
15. Material-backed partial/not-ready propagation;
16. Product-backed partial/not-ready propagation;
17. component graph duplicate-source corruption;
18. deterministic component order;
19. invalid derived subtotal/total fails closed;
20. root Product not found typed error;
21. archived root Product remains inspectable;
22. deep-cloning/non-aliasing of returned evidence;
23. shared session wiring.

## Scope boundaries

4.2C must not implement:

- selling-price derivation;
- profit per unit;
- markup/margin metrics;
- pricing-policy validation beyond ignoring it for cost readiness;
- planned physical batch cost;
- revenue/profit projection;
- capacity feasibility/warnings;
- stock reservation/deduction;
- production posting;
- React UI;
- Excel/Tauri persistence;
- payroll/timekeeping;
- global overhead allocation;
- tax/VAT/discount/fee logic.

## Planned files

Expected additions:

```text
src/application/productCosts/FullyLoadedProductUnitCostService.ts
src/application/productCosts/FullyLoadedProductUnitCostService.test.ts
src/application/productCosts/FullyLoadedProductUnitCostSession.test.ts
docs/PHASE_4_2C_TOTAL_FULLY_LOADED_UNIT_COST_READINESS.md
```

Expected updates:

```text
src/application/session.ts
docs/PHASE_4_2C_TOTAL_FULLY_LOADED_UNIT_COST_READINESS_PLAN.md
```

Closeout later updates:

```text
docs/PHASE_4_PROGRESS.md
```

No other file is expected unless implementation evidence proves a tightly related 4.2C correction is necessary.

## Lifecycle

1. verify exact authoritative `develop`;
2. establish this dedicated plan before implementation;
3. implement root fully loaded cost synthesis;
4. add focused tests and session wiring;
5. run full typecheck/tests/build;
6. create implementation record;
7. require clean CI on exact documented feature head;
8. compare exact scope against starting `develop`;
9. open implementation PR to `develop`;
10. require independent PR CI;
11. merge with expected-head protection;
12. require exact post-merge `develop` CI;
13. create documentation-only closeout;
14. mark `4.2C COMPLETE` and `4.2 COMPLETE`;
15. advance `4.3A — Selling Price Derivation` to `NEXT / NOT STARTED`;
16. require closeout PR CI and exact final `develop` CI.

## Completion gate

4.2C is complete only when all implementation and closeout gates pass and the tracker advances to:

```text
4.2 — Fully Loaded Product Unit Cost                 COMPLETE
    4.2A — Waste-Adjusted Direct-Material Unit Cost       COMPLETE
    4.2B — Recursive Fully Loaded Product Component Cost  COMPLETE
    4.2C — Total Fully Loaded Unit Cost & Readiness       COMPLETE

4.3 — Selling Price & Unit Economics                 IN PROGRESS
    4.3A — Selling Price Derivation                       NEXT
```

## Next task after completion

**4.3A — Selling Price Derivation — NEXT / NOT STARTED**

Do not begin 4.3A until 4.2C is fully merged, closed out, and exact final `develop` CI is green.
