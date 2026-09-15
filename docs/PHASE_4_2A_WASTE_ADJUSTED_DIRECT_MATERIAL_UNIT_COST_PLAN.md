# Phase 4.2A — Waste-Adjusted Direct-Material Unit Cost Development Plan

## Status

**IMPLEMENTED — MERGE GATE PENDING**

Authoritative base:

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

4.2A remained one cohesive derived-cost task. Recursive Product-backed cost remains 4.2B and total fully loaded unit cost remains 4.2C.

## Delivered service

Added:

`src/application/productCosts/WasteAdjustedDirectMaterialCostService.ts`

Public API:

```text
costProduct(productId)
```

Provider calls are loaded in parallel on a one-unit planning basis.

### Standard quantity basis

4.2A uses:

```text
plannedBaseQuantityPerProduct
```

It explicitly ignores:

```text
plannedBatchBaseQuantity
```

for standard unit economics.

This prevents indivisible `pc` materials from being prematurely rounded when pricing one standard finished unit.

Physical count rounding remains a future 4.4A batch-financial concern.

## Cost formulas

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

Reconciliation:

```text
baseDirectMaterialCostPerUnit
+ safetyWasteReserveCostPerUnit
≈ pricingDirectMaterialCostPerUnit
```

Domain/application math retains full precision.

## Safety-waste semantics

The forward safety reserve is applied exactly once by consuming already-adjusted Phase 2 quantities.

The service does not:

- multiply safety waste again;
- re-apply observed defect loss;
- apply parent safety waste to discrete components;
- perform physical batch rounding.

## Evidence and integrity

Material identity joins use trimmed/case-insensitive IDs while preserving the canonical requirement Material ID.

The service fails closed for:

- missing cost evidence;
- cost evidence without a matching planned requirement;
- base-unit mismatch;
- non-finite/negative derived cost;
- cost reconciliation failure;
- Product identity mismatch between the two providers.

Provider Product mismatch raises typed:

`PRODUCT_EVIDENCE_MISMATCH`

## Readiness

Result status:

```text
ready
partial
not-ready
```

- `ready`: every planned direct material has compatible ready requirement/cost evidence;
- `partial`: at least one valid direct-material cost is known, but source/integrity evidence remains unresolved;
- `not-ready`: no valid direct-material cost line can be derived.

Known partial subtotals remain visible under `partial` status.

The existing authoritative `NO_REQUIREMENTS / not-ready` behavior is preserved. 4.2A does not invent component-only neutral semantics because it has no component context.

## Per-material traceability

Each result line includes:

```text
materialId
baseUnit
source
status

effectiveBaseQuantityPerProduct
wasteReserveBaseQuantityPerProduct
plannedBaseQuantityPerProduct

costPerBaseUnit
baseDirectMaterialCostPerUnit
safetyWasteReserveCostPerUnit
pricingDirectMaterialCostPerUnit

packageCost
packageBaseQuantity
packageConversionSource
costingCalibrationId
requirementContributions
costContributions
issues
```

## Shared session

Updated:

`src/application/session.ts`

Added:

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

Reason:

```text
A test fixture used lowercase "ml" instead of canonical BaseUnit "mL".
TypeScript failed before tests/build.
```

Corrected implementation head:

`6cd4579d6599e459b591c6f15ba8dc7a63850fc1`

Corrected implementation CI:

`34937058854 — SUCCESS`

Observed automated surface:

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
3. 4.2A derived service/result/provider contracts ✅
4. precise one-unit quantity/cost evidence join ✅
5. base/reserve/pricing cost derivation ✅
6. fail-closed readiness/issues ✅
7. shared session wiring ✅
8. focused tests ✅
9. corrected full implementation CI ✅
10. implementation record ✅

Remaining:

11. clean documented feature-head CI;
12. exact scope compare against starting `develop`;
13. implementation PR to `develop`;
14. independent PR CI;
15. merge with expected-head protection;
16. exact post-merge `develop` CI;
17. documentation-only closeout;
18. mark 4.2A COMPLETE / 4.2B NEXT;
19. closeout PR CI and exact final `develop` CI.

## Completion gate

4.2A is complete only when all implementation and closeout gates pass and the tracker advances to:

```text
4.2A — Waste-Adjusted Direct-Material Unit Cost              COMPLETE
4.2B — Recursive Fully Loaded Product Component Cost         NEXT
```

## Next task after completion

**4.2B — Recursive Fully Loaded Product Component Cost — NEXT / NOT STARTED**

Do not begin 4.2B until 4.2A is fully merged, closed out, and exact final `develop` CI is green.
