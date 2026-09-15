# Phase 4.2C — Total Fully Loaded Unit Cost & Readiness

## Status

**COMPLETE**

Authoritative starting base:

`develop` @ `38e7b73f44266c6aa3c709d13e66cebddd48d425`

Feature branch:

`feature/phase-4-2c-total-fully-loaded-unit-cost`

Development plan:

`docs/PHASE_4_2C_TOTAL_FULLY_LOADED_UNIT_COST_READINESS_PLAN.md`

## Delivered

Added `src/application/productCosts/FullyLoadedProductUnitCostService.ts` as the authoritative root Product fully loaded production-cost synthesis.

Formula:

```text
fullyLoadedUnitCost
= 4.2A waste-adjusted direct-material cost
+ Phase 3 Material-backed component cost
+ 4.2B Product-backed fully loaded component cost
+ root labor cost
+ root overhead cost
```

The result exposes root identity/active state, `ready | partial | not-ready`, direct-material evidence/mode, Material/Product component subtotals, input subtotal, labor, overhead, known partial subtotal, authoritative total, deterministic component trace, and controlled issues.

`totalFullyLoadedUnitCost` is published only when every required production-cost input is ready. Partial valid evidence remains visible only through `knownFullyLoadedUnitCostSubtotal`.

## Locked semantics

- Root safety waste is included exactly once through 4.2A `pricingDirectMaterialCostPerUnit`.
- Genuine component-only roots may use controlled `neutral-component-only` direct mode; no-direct/no-component roots remain unresolved.
- Broken/partial direct evidence is never neutralized.
- Material-backed components delegate to the existing Phase 3 cost path.
- Product-backed components delegate to 4.2B fully loaded production cost.
- Root labor/overhead come from the financial profile; explicit zero is valid.
- Missing/mismatched/invalid root financial profile blocks the authoritative total while preserving other known cost.
- Root `pricingPolicy` is excluded from production-cost math and readiness.
- Immediate component source uniqueness is validated; deeper Product recursion/cycle protection remains with 4.2B.
- Component trace is deterministic by source type, normalized source ID, then component ID.
- Archived root Products remain inspectable; missing root Product throws typed `PRODUCT_NOT_FOUND`.
- ProductStock/current availability is not a cost input.
- Returned nested evidence is defensively cloned.

## Shared session

`src/application/session.ts` now exposes:

`fullyLoadedProductUnitCostService`

wired from the shared Product/component repositories and 4.2A/3.3A/4.2B/4.1C services.

## Validation history

```text
Starting develop                38e7b73f44266c6aa3c709d13e66cebddd48d425
Starting CI                     34939643842 — SUCCESS
Plan commit                     f1fdf1957e3b17a07bc8ca756135c35d48b6d22c

Initial implementation head     6a52451b7db593563cd747f7926dceeed82c4f76
Initial CI                      34940513808 — FAILURE
Reason                          Material-backed status type was incorrectly compared with nonexistent "partial"

Corrected type-contract head    4e5a186d3eb47a4d92d6070c98572c124d75b77d
Corrected CI                    34940692457 — FAILURE
Reason                          deterministic-order test fixture intentionally duplicated source A and triggered graph protection

Green implementation head       3f048062ccc76787b38d6eeddb8b8c2372c503df
Implementation CI               34940853079 — SUCCESS

Final documented feature head   3ba9a3f7f7d1e5fb088b1318354032ffdcac4b5d
Final feature-head CI           34941112509 — SUCCESS

PR #106                         MERGED
PR CI                           34941214080 — SUCCESS
Implementation merge            ecc361cee6ed4f9e45389c00e4c1b672a0bbf632
Post-merge develop CI           34941302219 — SUCCESS

65 test files / 779 tests
24 dedicated 4.2C service tests
1 4.2C shared-session wiring test
7 React smoke tests
TypeScript typecheck passed
production build passed
103 modules transformed
```

Both pre-green failures were resolved before PR creation. The first was a real type-contract correction; the second was test-only and required no implementation behavior change.

## Scope retained

4.2C did not implement selling price, profit/markup/margin, planned-batch financials, capacity warnings, stock mutation, React UI, Excel/Tauri persistence, tax/discount/fee logic, payroll/timekeeping, or global overhead allocation.

## Completion

Implementation PR #106 merged and the exact merge commit passed `develop` CI. Phase 4.2C is technically complete; the documentation-only closeout advances the authoritative tracker to Phase 4.3A without starting it.

## Next task

**4.3A — Selling Price Derivation — NEXT / NOT STARTED**
