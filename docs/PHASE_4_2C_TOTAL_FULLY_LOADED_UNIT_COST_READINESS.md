# Phase 4.2C — Total Fully Loaded Unit Cost & Readiness

## Status

**IMPLEMENTED — MERGE GATE PENDING**

Authoritative base:

`develop` @ `38e7b73f44266c6aa3c709d13e66cebddd48d425`

Feature branch:

`feature/phase-4-2c-total-fully-loaded-unit-cost`

Development plan:

`docs/PHASE_4_2C_TOTAL_FULLY_LOADED_UNIT_COST_READINESS_PLAN.md`

## Delivered service

Added:

`src/application/productCosts/FullyLoadedProductUnitCostService.ts`

Public boundary:

```text
costProduct(productId)
```

The service is the authoritative Phase 4 root-Product production-cost synthesis.

## Authoritative cost formula

For Product `P`:

```text
inputMaterialComponentSubtotal
=
  wasteAdjustedDirectMaterialCost(P)
+ Material-backed component contributions(P)
+ Product-backed fully loaded component contributions(P)

fullyLoadedUnitCost(P)
=
  inputMaterialComponentSubtotal
+ laborCostPerUnit(P)
+ overheadCostPerUnit(P)
```

All unit-cost math remains full precision.

## Input authorities

4.2C composes, without duplicating formulas:

- 4.2A `WasteAdjustedDirectMaterialCostService` for the root Product's safety-waste-adjusted direct materials;
- Phase 3 `MaterialBackedComponentCostService` for purchased count-based components;
- 4.2B `RecursiveFullyLoadedProductComponentCostService` for handmade/nested Product-backed components;
- 4.1C `ProductFinancialProfileService` for the root Product's labor and overhead.

`pricingPolicy` is deliberately ignored by 4.2C. A null pricing policy does not block cost readiness, and changing only pricing policy does not change the fully loaded unit cost.

## Result semantics

The result exposes:

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

Readiness is:

```text
ready
partial
not-ready
```

`totalFullyLoadedUnitCost` is non-null only when every required production-cost input is ready.

Known valid evidence remains available through `knownFullyLoadedUnitCostSubtotal` when the result is partial, preventing incomplete cost from being mistaken for an authoritative pricing basis.

## Root direct-material semantics

4.2C uses 4.2A `pricingDirectMaterialCostPerUnit`, so root safety waste is included exactly once.

Direct-material modes are:

```text
costed
neutral-component-only
unresolved
```

A genuine component-only Product can use `neutral-component-only` only when:

- 4.2A has no direct lines;
- its direct total is null;
- no direct cost issue exists;
- requirement issues are only `NO_REQUIREMENTS`;
- synthesis issues are only the expected no-requirement readiness markers;
- the Product has at least one component relationship.

A Product with neither direct requirements nor components remains unresolved. Partial/broken direct evidence is never neutralized.

## Financial-profile semantics

Root labor and overhead are used only when both are finite and non-negative.

Explicit zero values are valid known-zero cost.

Missing, mismatched, or invalid financial profile evidence blocks the authoritative total while preserving other known production cost.

Pricing policy does not participate in root production-cost readiness.

## Component synthesis

### Material-backed

Root Material-backed components delegate to Phase 3 `MaterialBackedComponentCostService`.

The actual provider contract is `ready | not-ready`; 4.2C does not invent a Material-backed `partial` state.

### Product-backed

Root Product-backed components delegate to 4.2B.

Ready `componentCostContribution` enters the authoritative root total.

When a 4.2B line is partial, its valid `knownComponentCostContribution` may remain visible in the known root subtotal, but the root authoritative total remains null.

## Graph and deterministic trace

Immediate root components are validated with the existing source-uniqueness guard.

Corrupted duplicate sources report `COMPONENT_GRAPH_INVALID` and fail closed for the component side.

Valid component trace ordering is deterministic by:

1. source type;
2. normalized source ID;
3. normalized component ID.

Deeper Product graph/cycle protection remains delegated to 4.2B.

## Root Product lifecycle

Root Product existence is required and missing identity throws typed `PRODUCT_NOT_FOUND`.

Archived root Products remain inspectable/costable and expose `productIsActive = false`, matching the existing Product-level derived-cost convention.

Current-use eligibility for child Product components remains governed by 4.2B.

## Defensive cloning

Returned evidence is defensively cloned, including:

- 4.2A direct-material lines/issues/contributions;
- Material-backed lines and nested availability evidence;
- recursive 4.2B paths, breakdown, direct-cost evidence, and issues;
- root component and issue arrays.

## Shared session

Updated:

`src/application/session.ts`

Added:

`fullyLoadedProductUnitCostService`

wired from shared:

```text
productRepository
productComponentRepository
wasteAdjustedDirectMaterialCostService
materialBackedComponentCostService
recursiveFullyLoadedProductComponentCostService
productFinancialProfileService
```

This becomes the authoritative cost input for Phase 4.3 pricing work.

## Focused tests

Added:

```text
src/application/productCosts/FullyLoadedProductUnitCostService.test.ts
src/application/productCosts/FullyLoadedProductUnitCostSession.test.ts
```

Dedicated coverage includes:

- direct material + labor + overhead;
- explicit zero labor/overhead;
- safety-waste reserve exactly once;
- Material-backed component cost;
- Product-backed 4.2B fully loaded contribution;
- mixed input synthesis;
- component-only root neutral direct behavior;
- no-direct/no-component unresolved behavior;
- missing/mismatched/invalid financial profile;
- null and changed pricing-policy independence;
- partial direct evidence;
- Material-backed not-ready propagation;
- Product-backed partial/not-ready propagation;
- duplicate source corruption;
- deterministic valid component order;
- missing root Product typed error;
- archived root inspectability;
- no meaningful cost evidence;
- invalid derived Product-backed evidence;
- defensive cloning;
- shared session wiring.

## Validation history

### Initial branch gate

Head:

`6a52451b7db593563cd747f7926dceeed82c4f76`

CI:

`34940513808 — FAILURE`

Failure:

TypeScript correctly rejected comparisons against a nonexistent Material-backed `partial` status. Phase 3 `MaterialBackedComponentCostStatus` is only `ready | not-ready`.

Correction:

`4e5a186d3eb47a4d92d6070c98572c124d75b77d`

No business-scope change was required.

### Corrected type-contract gate

Head:

`4e5a186d3eb47a4d92d6070c98572c124d75b77d`

CI:

`34940692457 — FAILURE`

Typecheck passed. One focused test failed because its deterministic-order fixture deliberately used duplicate Material source `A`, which correctly triggered the source-uniqueness corruption guard.

Correction:

`3f048062ccc76787b38d6eeddb8b8c2372c503df`

The fixture was changed to valid unique sources while preserving deterministic ordering coverage. No implementation behavior changed in this correction.

### Green implementation gate

Implementation head:

`3f048062ccc76787b38d6eeddb8b8c2372c503df`

CI:

`34940853079 — SUCCESS`

Observed automated surface:

```text
65 test files passed
779 tests passed
24 dedicated 4.2C service tests
1 dedicated 4.2C shared-session wiring test
7 React smoke tests
TypeScript typecheck passed
production Vite build passed
103 modules transformed
```

## Scope retained

4.2C did not implement:

- selling price;
- profit per unit;
- markup/margin diagnostics;
- planned physical batch cost;
- expected revenue/profit;
- capacity feasibility/warnings;
- stock reservation/deduction;
- production posting;
- React UI;
- Excel/Tauri persistence;
- tax/VAT/discount/fee logic;
- payroll/timekeeping;
- global overhead allocation.

## Remaining lifecycle gates

1. update the 4.2C development plan to merge-gate-pending;
2. require clean CI on the exact documented feature head;
3. compare exact scope against starting `develop`;
4. open implementation PR to `develop`;
5. require independent PR CI;
6. merge with expected-head protection;
7. require exact post-merge `develop` CI;
8. create documentation-only closeout;
9. mark 4.2C COMPLETE and 4.2 COMPLETE;
10. advance 4.3A to NEXT / NOT STARTED;
11. require closeout PR CI and exact final `develop` CI.

## Next task

**4.3A — Selling Price Derivation — NOT STARTED**

Do not begin 4.3A until 4.2C is fully merged, closed out, and exact final `develop` CI is green.
