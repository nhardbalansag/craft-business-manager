# Phase 4.2C — Total Fully Loaded Unit Cost & Readiness Development Plan

## Status

**IMPLEMENTED — MERGE GATE PENDING**

Authoritative base:

`develop` @ `38e7b73f44266c6aa3c709d13e66cebddd48d425`

Starting exact `develop` CI:

`34939643842 — SUCCESS`

Feature branch:

`feature/phase-4-2c-total-fully-loaded-unit-cost`

Implementation record:

`docs/PHASE_4_2C_TOTAL_FULLY_LOADED_UNIT_COST_READINESS.md`

## Objective

Deliver the authoritative root Product production-cost synthesis:

```text
fullyLoadedUnitCost
= waste-adjusted direct materials
+ Material-backed component cost
+ Product-backed fully loaded component cost
+ root labor
+ root overhead
```

This is the cost basis for Phase 4.3 pricing. Selling price and profit remain out of scope.

## Split assessment

No deeper formal split was required. 4.2C remained one cohesive root-cost synthesis capability.

## Delivered contract

Added:

`src/application/productCosts/FullyLoadedProductUnitCostService.ts`

Public boundary:

```text
costProduct(productId)
```

The result exposes root identity/active state, readiness, 4.2A direct evidence/mode, Material/Product component subtotals, input subtotal, labor, overhead, known partial subtotal, authoritative total, component trace, and issues.

Readiness is:

```text
ready | partial | not-ready
```

`totalFullyLoadedUnitCost` is non-null only when all required production-cost evidence is ready. Partial valid evidence remains visible only through `knownFullyLoadedUnitCostSubtotal`.

## Locked implementation semantics

- 4.2A `pricingDirectMaterialCostPerUnit` is reused; safety waste is not multiplied again.
- Genuine component-only roots can use `neutral-component-only` direct mode under the same controlled `NO_REQUIREMENTS` conditions established in 4.2B.
- No-direct/no-component roots remain unresolved.
- Material-backed components delegate to Phase 3.3A and use the actual `ready | not-ready` provider contract.
- Product-backed components delegate to 4.2B; partial known contributions may remain diagnostic but block the authoritative root total.
- Root labor/overhead come from 4.1C; explicit zero is valid.
- Missing/mismatched/invalid root financial profile blocks the authoritative total.
- `pricingPolicy` is ignored by production-cost readiness and math.
- Immediate component source uniqueness is validated before component synthesis.
- Component trace is deterministic by source type, normalized source ID, then component ID.
- Archived root Products remain inspectable; missing root Product throws typed `PRODUCT_NOT_FOUND`.
- Returned nested evidence is defensively cloned.
- ProductStock/current availability is not a cost input.

## Shared session

Updated `src/application/session.ts` with:

`fullyLoadedProductUnitCostService`

using shared:

```text
productRepository
productComponentRepository
wasteAdjustedDirectMaterialCostService
materialBackedComponentCostService
recursiveFullyLoadedProductComponentCostService
productFinancialProfileService
```

## Tests

Added:

```text
src/application/productCosts/FullyLoadedProductUnitCostService.test.ts
src/application/productCosts/FullyLoadedProductUnitCostSession.test.ts
```

Focused coverage includes direct/labor/overhead, safety waste exactly once, Material and Product components, mixed total, component-only roots, missing/invalid profiles, pricing-policy independence, partial evidence, graph corruption, deterministic ordering, archived roots, typed missing-root error, invalid derived evidence, cloning, and session wiring.

## Validation history

Initial head:

`6a52451b7db593563cd747f7926dceeed82c4f76`

CI `34940513808 — FAILURE`

Reason: 4.2C initially compared Phase 3 Material-backed status with nonexistent `partial`. Corrected to the real `ready | not-ready` contract.

Corrected implementation head:

`4e5a186d3eb47a4d92d6070c98572c124d75b77d`

CI `34940692457 — FAILURE`

Typecheck passed; one deterministic-order test fixture used duplicate source `A`, correctly triggering source-uniqueness protection. Fixture corrected without changing implementation behavior.

Green implementation head:

`3f048062ccc76787b38d6eeddb8b8c2372c503df`

CI `34940853079 — SUCCESS`

```text
65 test files passed
779 tests passed
24 dedicated 4.2C service tests
1 4.2C shared-session wiring test
7 React smoke tests
TypeScript typecheck passed
production build passed
103 modules transformed
```

## Scope retained

No selling price, profit, markup/margin, batch financials, capacity warnings, stock mutation, React UI, Excel/Tauri persistence, tax/discount/fee logic, payroll/timekeeping, or global overhead allocation was implemented.

## Remaining lifecycle gates

1. clean CI on exact documented feature head;
2. exact scope compare against starting `develop`;
3. implementation PR to `develop`;
4. independent PR CI;
5. merge with expected-head protection;
6. exact post-merge `develop` CI;
7. documentation-only closeout;
8. mark 4.2C COMPLETE and 4.2 COMPLETE;
9. advance 4.3A to NEXT / NOT STARTED;
10. closeout PR CI and exact final `develop` CI.

## Next task after completion

**4.3A — Selling Price Derivation — NEXT / NOT STARTED**

Do not begin 4.3A until 4.2C is fully merged, closed out, and final exact `develop` CI is green.
