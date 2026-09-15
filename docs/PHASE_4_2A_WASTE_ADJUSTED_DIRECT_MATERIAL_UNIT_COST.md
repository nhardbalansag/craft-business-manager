# Phase 4.2A — Waste-Adjusted Direct-Material Unit Cost

## Status

**IMPLEMENTED — MERGE GATE PENDING**

Authoritative base:

`develop` @ `cf5661003e575d45b82143b109cc72b8bad6d0e9`

Feature branch:

`feature/phase-4-2a-waste-adjusted-direct-material-unit-cost`

Development plan:

`docs/PHASE_4_2A_WASTE_ADJUSTED_DIRECT_MATERIAL_UNIT_COST_PLAN.md`

## Delivered service

Added:

`src/application/productCosts/WasteAdjustedDirectMaterialCostService.ts`

Public boundary:

```text
costProduct(productId)
```

The service combines:

- `ProductionRequirementService.plan(productId, 1)` for precise safety-waste-adjusted direct-material quantities; and
- `RecipeMaterialCostPreviewService.previewForProduct(productId)` for authoritative cost-per-base-unit evidence.

It deliberately uses:

```text
plannedBaseQuantityPerProduct
```

and never uses physical one-piece:

```text
plannedBatchBaseQuantity
```

for standard unit economics.

## Cost semantics

Per material:

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

The service validates that base cost plus reserve cost reconciles to pricing direct-material cost within a floating-point tolerance.

No UI/currency rounding occurs.

## Safety-waste protection

The Product safety reserve is applied exactly once because the service consumes already-adjusted Phase 2 quantities.

It does not:

- multiply safety waste again;
- re-apply observed defect loss;
- apply parent safety waste to discrete components;
- perform batch count rounding.

For fractional count requirements, precise per-product quantity remains authoritative for standard unit economics.

## Readiness

The service exposes:

```text
ready
partial
not-ready
```

Behavior:

- `ready` requires ready requirement/cost providers and compatible cost evidence for every planned direct material;
- `partial` preserves known line/subtotal evidence while any source/integrity issue remains;
- `not-ready` publishes no pricing direct total when no valid direct-material line can be derived.

Existing `NO_REQUIREMENTS` behavior remains `not-ready` in 4.2A. The service does not invent component-only neutral semantics because Product-component context belongs to later synthesis.

## Per-material traceability

Each line carries:

- canonical requirement Material identity;
- base unit/source;
- effective quantity;
- safety reserve quantity;
- precise planned quantity;
- cost per base unit;
- base/reserve/pricing costs;
- package cost basis evidence;
- calibration/conversion evidence;
- requirement contributions;
- cost contributions;
- line readiness/issues.

Material joins are trimmed and case-insensitive.

Provider Product identity mismatch fails closed with typed `PRODUCT_EVIDENCE_MISMATCH`.

Base-unit mismatch, missing cost evidence, unmatched cost evidence, invalid derived cost, and reconciliation failure are explicit controlled issues.

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

No React source mutation path was introduced.

## Tests

Added:

```text
src/application/productCosts/WasteAdjustedDirectMaterialCostService.test.ts
src/application/productCosts/WasteAdjustedDirectMaterialCostSession.test.ts
```

Focused coverage includes:

- base/reserve/pricing cost derivation;
- zero safety reserve;
- multiple-material aggregation;
- deterministic line ordering;
- fractional `pc` standard-cost protection;
- no double application of safety waste;
- partial requirement evidence;
- missing material cost evidence with known subtotal preservation;
- no-requirement not-ready preservation;
- case-insensitive Material identity join;
- base-unit mismatch fail-closed behavior;
- unmatched cost evidence;
- Product evidence mismatch;
- invalid/reconciliation failure;
- defensive cloning;
- shared session wiring.

## Validation evidence

Initial implementation/session head:

`720cf61af18a597111c1e509888f828893c7b1c8`

Initial CI:

`34936904329 — FAILURE`

Cause:

```text
Test fixture used invalid lowercase base unit "ml" instead of canonical BaseUnit "mL".
TypeScript correctly failed before tests/build.
```

No production-service defect was involved.

Corrected implementation head:

`6cd4579d6599e459b591c6f15ba8dc7a63850fc1`

Corrected CI:

`34937058854 — SUCCESS`

Observed automated surface:

```text
61 test files passed
730 tests passed
14 WasteAdjustedDirectMaterialCostService tests
1 4.2A shared-session wiring test
7 React smoke tests
TypeScript typecheck passed
production Vite build passed
101 modules transformed
```

## Scope retained

4.2A did not implement:

- Material-backed component cost changes;
- recursive Product-backed fully loaded cost;
- labor/overhead roll-up;
- total fully loaded unit cost;
- selling price/profit/markup/margin;
- physical planned-batch financials;
- capacity warnings;
- React UI;
- Excel/Tauri persistence;
- stock reservation/deduction/production posting.

## Remaining lifecycle gates

1. Update development plan to merge-gate-pending.
2. Require clean CI on the exact documented feature head.
3. Verify scope diff against starting `develop`.
4. Open implementation PR to `develop`.
5. Require independent PR CI.
6. Merge with expected-head protection.
7. Require exact post-merge `develop` CI.
8. Create documentation-only closeout.
9. Mark 4.2A COMPLETE / 4.2B NEXT.
10. Require closeout PR CI and exact final `develop` CI.

## Next task

**4.2B — Recursive Fully Loaded Product Component Cost — NOT STARTED**

Do not begin 4.2B until every 4.2A merge/closeout gate passes.
