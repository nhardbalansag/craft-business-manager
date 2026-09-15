# Phase 4.2A — Waste-Adjusted Direct-Material Unit Cost Development Plan

## Status

**COMPLETE**

Authoritative starting base:

`develop` @ `cf5661003e575d45b82143b109cc72b8bad6d0e9`

Starting exact `develop` CI:

`34936201438 — SUCCESS`

Feature branch:

`feature/phase-4-2a-waste-adjusted-direct-material-unit-cost`

Implementation record:

`docs/PHASE_4_2A_WASTE_ADJUSTED_DIRECT_MATERIAL_UNIT_COST.md`

Master plan:

`docs/PHASE_4_PRICING_PRODUCTION_PLANNING_PLAN.md`

## Objective

Create the authoritative Phase 4 derived view for one Product's direct-material cost on a standard one-unit pricing basis after the Product's forward safety-waste reserve is applied exactly once.

Delivered by combining:

- `ProductionRequirementService.plan(productId, 1)` for precise waste-adjusted direct-material quantities; and
- `RecipeMaterialCostPreviewService.previewForProduct(productId)` for authoritative existing cost-per-base-unit evidence.

## Split assessment

No deeper formal roadmap split was required.

4.2A remained one cohesive derived-cost task. Recursive Product-backed fully loaded cost remains 4.2B and total fully loaded unit cost remains 4.2C.

## Delivered architecture

Added:

`src/application/productCosts/WasteAdjustedDirectMaterialCostService.ts`

Public API:

```text
costProduct(productId)
```

The service loads one-unit requirement and direct cost evidence in parallel.

### Standard quantity basis

4.2A uses:

```text
plannedBaseQuantityPerProduct
```

and explicitly ignores:

```text
plannedBatchBaseQuantity
```

for standard unit economics. This prevents indivisible `pc` materials from being prematurely rounded. Physical count rounding remains a 4.4A batch-financial concern.

### Cost formulas

Per direct material:

```text
baseDirectMaterialCostPerUnit
= effectiveBaseQuantityPerProduct × costPerBaseUnit
```

```text
safetyWasteReserveCostPerUnit
= wasteReserveBaseQuantityPerProduct × costPerBaseUnit
```

```text
pricingDirectMaterialCostPerUnit
= plannedBaseQuantityPerProduct × costPerBaseUnit
```

The service checks:

```text
baseDirectMaterialCostPerUnit
+ safetyWasteReserveCostPerUnit
≈ pricingDirectMaterialCostPerUnit
```

Full numeric precision is retained.

### Safety-waste semantics

The forward reserve is applied exactly once by consuming already-adjusted Phase 2 quantities.

The service does not:

- multiply safety waste again;
- re-apply observed defect loss;
- apply parent safety waste to discrete components;
- perform physical batch rounding.

### Evidence and readiness

Material identity joins use trimmed/case-insensitive IDs while preserving canonical requirement Material identity.

The service fails closed for:

- missing cost evidence;
- cost evidence without a matching requirement;
- base-unit mismatch;
- non-finite/negative derived cost;
- cost reconciliation failure;
- Product identity mismatch between providers.

Product evidence mismatch raises typed `PRODUCT_EVIDENCE_MISMATCH`.

Readiness:

```text
ready
partial
not-ready
```

Known partial subtotals remain visible under `partial` status. Existing authoritative `NO_REQUIREMENTS / not-ready` semantics are preserved; 4.2A does not invent component-only neutral handling without component context.

### Shared session

Updated `src/application/session.ts` with:

`wasteAdjustedDirectMaterialCostService`

using the existing shared:

```text
productionRequirementService
recipeMaterialCostPreviewService
```

## Files changed

```text
docs/PHASE_4_2A_WASTE_ADJUSTED_DIRECT_MATERIAL_UNIT_COST_PLAN.md
docs/PHASE_4_2A_WASTE_ADJUSTED_DIRECT_MATERIAL_UNIT_COST.md
src/application/productCosts/WasteAdjustedDirectMaterialCostService.ts
src/application/productCosts/WasteAdjustedDirectMaterialCostService.test.ts
src/application/productCosts/WasteAdjustedDirectMaterialCostSession.test.ts
src/application/session.ts
```

## Validation evidence

Initial implementation/session head:

`720cf61af18a597111c1e509888f828893c7b1c8`

Initial CI:

`34936904329 — FAILURE`

Cause:

```text
Test fixture used lowercase "ml" instead of canonical BaseUnit "mL".
TypeScript failed before tests/build.
```

Corrected implementation head:

`6cd4579d6599e459b591c6f15ba8dc7a63850fc1`

Corrected implementation CI:

`34937058854 — SUCCESS`

Final documented feature head:

`565e519b034a53edec525440f56b6996f17097d3`

Final feature-head CI:

`34937207673 — SUCCESS`

Implementation PR:

`#102 — MERGED`

PR CI:

`34937298973 — SUCCESS`

Implementation merge:

`5603fac7d8263e4b242a7d5a7bc76a8a9da84de3`

Exact post-merge `develop` CI:

`34937447317 — SUCCESS`

Automated surface:

```text
61 test files passed
730 tests passed
14 WasteAdjustedDirectMaterialCostService tests
1 4.2A session wiring test
7 React smoke tests
TypeScript typecheck passed
production build passed
101 modules transformed
```

## Scope retained

4.2A did not implement:

- component-cost changes;
- recursive Product-backed fully loaded cost;
- labor/overhead cost;
- total fully loaded unit cost;
- selling price/profit/markup/margin;
- batch production financials;
- capacity warnings;
- React UI;
- Excel/Tauri persistence;
- stock reservation/deduction/production posting.

## Lifecycle state

Completed:

1. dedicated development plan before code ✅
2. exact authoritative source inspection ✅
3. 4.2A service/result/provider contracts ✅
4. precise one-unit quantity/cost evidence join ✅
5. base/reserve/pricing cost derivation ✅
6. fail-closed readiness/issues ✅
7. shared session wiring ✅
8. focused tests ✅
9. corrected full implementation CI ✅
10. implementation record ✅
11. clean documented feature-head CI ✅
12. exact scope compare against starting `develop` ✅
13. implementation PR #102 ✅
14. independent PR CI ✅
15. merge with expected-head protection ✅
16. exact post-merge `develop` CI ✅
17. documentation-only closeout prepared ✅

Remaining repository gates:

18. closeout PR CI;
19. closeout merge and exact final `develop` CI.

## Completion gate

The implementation work for 4.2A is complete. Repository lifecycle completion requires the documentation-only closeout to merge and final `develop` CI to pass.

After closeout the authoritative tracker must read:

```text
4.2A — Waste-Adjusted Direct-Material Unit Cost       COMPLETE
4.2B — Recursive Fully Loaded Product Component Cost  NEXT
```

## Next task after completion

**4.2B — Recursive Fully Loaded Product Component Cost — NEXT / NOT STARTED**

Do not begin 4.2B until the 4.2A closeout is merged, exact final `develop` CI is green, and a dedicated 4.2B development plan/scope review is established.
