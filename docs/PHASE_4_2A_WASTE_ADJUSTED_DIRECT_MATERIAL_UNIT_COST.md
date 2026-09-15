# Phase 4.2A — Waste-Adjusted Direct-Material Unit Cost

## Status

**COMPLETE**

Authoritative starting base:

`develop` @ `cf5661003e575d45b82143b109cc72b8bad6d0e9`

Feature branch:

`feature/phase-4-2a-waste-adjusted-direct-material-unit-cost`

Implementation PR:

`#102 — MERGED`

Implementation merge:

`5603fac7d8263e4b242a7d5a7bc76a8a9da84de3`

Post-merge `develop` CI:

`34937447317 — SUCCESS`

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

and never physical one-piece:

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

The service validates that base cost plus reserve cost reconciles to pricing direct-material cost within floating-point tolerance. Domain/application math remains full precision; currency formatting is a later presentation concern.

## Safety-waste protection

The Product safety reserve is applied exactly once because the service consumes already-adjusted Phase 2 quantities.

It does not:

- multiply safety waste again;
- re-apply observed defect loss;
- apply parent safety waste to discrete components;
- perform physical batch count rounding.

For fractional count requirements, precise per-product quantity remains authoritative for standard unit economics. Physical count rounding remains a future 4.4A batch concern.

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

Existing `NO_REQUIREMENTS` behavior remains `not-ready` in 4.2A. This phase does not invent component-only neutral semantics because Product-component context belongs to later fully loaded synthesis.

## Per-material traceability and integrity

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
- requirement and cost contributions;
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

## Complete validation evidence

Initial implementation/session head:

`720cf61af18a597111c1e509888f828893c7b1c8`

Initial CI:

`34936904329 — FAILURE`

Cause:

```text
A test fixture used invalid lowercase BaseUnit "ml" instead of canonical "mL".
TypeScript correctly failed before tests/build.
```

No production-service defect was involved.

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

Independent PR CI:

`34937298973 — SUCCESS`

Implementation merge:

`5603fac7d8263e4b242a7d5a7bc76a8a9da84de3`

Exact post-merge `develop` CI:

`34937447317 — SUCCESS`

Validated automated surface:

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

## Completion statement

All implementation gates are complete:

1. dedicated development plan before code ✅
2. implementation and focused tests ✅
3. corrected full implementation CI ✅
4. final documented feature-head CI ✅
5. scope compare against exact starting `develop` ✅
6. implementation PR #102 CI ✅
7. merge with expected-head protection ✅
8. exact post-merge `develop` CI ✅
9. documentation-only closeout prepared ✅

The remaining repository lifecycle gate is the closeout PR and exact final `develop` CI.

## Next task

**4.2B — Recursive Fully Loaded Product Component Cost — NEXT / NOT STARTED**

Do not begin 4.2B until this documentation-only closeout is merged, exact final `develop` CI is green, and a dedicated 4.2B development plan/scope review is established.
