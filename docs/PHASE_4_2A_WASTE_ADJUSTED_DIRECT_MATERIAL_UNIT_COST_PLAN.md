# Phase 4.2A — Waste-Adjusted Direct-Material Unit Cost Development Plan

## Status

**PLANNED — IMPLEMENTATION NOT STARTED**

Authoritative base:

`develop` @ `cf5661003e575d45b82143b109cc72b8bad6d0e9`

Starting exact `develop` CI:

`34936201438 — SUCCESS`

Feature branch:

`feature/phase-4-2a-waste-adjusted-direct-material-unit-cost`

Master plan:

`docs/PHASE_4_PRICING_PRODUCTION_PLANNING_PLAN.md`

## Objective

Create the authoritative Phase 4 derived view for one Product's direct-material cost on a standard one-unit pricing basis after the Product's forward safety-waste reserve is applied exactly once.

4.2A must combine existing evidence rather than duplicate Phase 1/2 costing or quantity formulas:

- `ProductionRequirementService.plan(productId, 1)` supplies the authoritative waste-adjusted direct-material quantities;
- `RecipeMaterialCostPreviewService.previewForProduct(productId)` supplies the authoritative direct-material cost-per-base-unit evidence used by Phase 3;
- `plannedBaseQuantityPerProduct` is the pricing quantity basis;
- `plannedBatchBaseQuantity` must not be used for standard unit economics because count-material physical rounding is a batch-only concern.

Deliver:

- base direct-material cost before the safety reserve;
- safety-waste reserve cost;
- waste-adjusted/pricing direct-material cost per unit;
- per-material quantity and cost traceability;
- readiness and issues;
- shared session wiring for later 4.2B/4.2C composition.

## Split assessment

No deeper formal roadmap split is required.

4.2A is one cohesive derived-cost service with these internal slices:

1. provider contracts and result types;
2. one-unit requirement/cost evidence load;
3. deterministic per-material join;
4. precise base/reserve/planned cost derivation;
5. readiness and issue synthesis;
6. session wiring;
7. focused tests and full regression validation.

4.2B owns recursive Product-backed fully loaded child cost. 4.2C owns total fully loaded unit-cost synthesis. Neither belongs in 4.2A.

## Authoritative source behavior reviewed

### ProductionRequirementService

`src/application/production/ProductionRequirementService.ts`

Authoritative 2.4B output includes:

```text
status
plannedQuantity
safetyWasteRate
safetyWastePercentage
safetyWasteMultiplier
observedDefectRateIncluded = false
requirements[]
```

Each requirement includes:

```text
effectiveBaseQuantityPerProduct
wasteReserveBaseQuantityPerProduct
plannedBaseQuantityPerProduct
plannedBatchBaseQuantity
baseUnit
source
contributions[]
```

Locked semantic:

```text
plannedBaseQuantityPerProduct
= precise per-product requirement after safety waste
```

For count (`pc`) materials, only `plannedBatchBaseQuantity` is rounded upward at the final physical batch boundary.

Therefore 4.2A must use:

```text
plannedBaseQuantityPerProduct
```

and must not use:

```text
plannedBatchBaseQuantity
```

for standard unit economics.

### RecipeMaterialCostPreviewService

`src/application/recipeCosts/RecipeMaterialCostPreviewService.ts`

This remains the authoritative direct-material cost evidence source underneath Phase 3.3C.

Each ready cost line includes:

```text
materialId
baseUnit
baseQuantityPerProduct
source
costPerBaseUnit
materialCostPerProduct
packageCost
packageBaseQuantity
packageConversionSource
costingCalibrationId
contributions[]
```

4.2A must reuse `costPerBaseUnit`; it must not recalculate package conversion/calibration cost independently.

### Existing no-requirement semantics

`EffectiveRecipeRequirementService` deliberately emits:

```text
NO_REQUIREMENTS
status = not-ready
```

when no direct-material requirements are currently derivable.

4.2A will preserve this contract and will not reinterpret an empty direct-material plan as automatically ready-zero.

A later synthesis layer with component context may decide whether a true component-only Product has a neutral direct-material side. 4.2A itself has no Product-component context and must not invent it.

## Proposed application service

Add:

`src/application/productCosts/WasteAdjustedDirectMaterialCostService.ts`

Public API:

```ts
costProduct(productId: string): Promise<WasteAdjustedDirectMaterialCostResult>
```

Provider boundaries:

```ts
interface WasteAdjustedRequirementProvider {
  plan(productId: string, plannedQuantity: number): Promise<ProductionRequirementPlanResult>;
}

interface DirectMaterialCostEvidenceProvider {
  previewForProduct(productId: string): Promise<RecipeMaterialCostPreviewResult>;
}
```

Production session wiring will inject the existing shared:

```text
productionRequirementService
recipeMaterialCostPreviewService
```

## Proposed result contract

Readiness:

```ts
type WasteAdjustedDirectMaterialCostStatus = 'ready' | 'partial' | 'not-ready';
```

Per-material line should expose at least:

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

contributions
issues
```

Product result should expose at least:

```text
productId
productIsActive
status
planningBasisQuantity = 1
safetyWasteRate
safetyWastePercentage
safetyWasteMultiplier
observedDefectRateIncluded = false

baseDirectMaterialCostSubtotal
safetyWasteReserveCostSubtotal
pricingDirectMaterialCostPerUnit

lines[]
requirementIssues[]
costIssues[]
issues[]
```

Derived totals remain full precision. No currency rounding occurs in the service.

## Core formulas

For each matched direct material:

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

Reconciliation invariant:

```text
baseDirectMaterialCostPerUnit
+ safetyWasteReserveCostPerUnit
≈ pricingDirectMaterialCostPerUnit
```

The service must preserve numeric precision and use only a tolerance check for floating-point reconciliation.

Product subtotals are sums of the corresponding known line values.

## One-unit planning basis

The service must call:

```text
ProductionRequirementService.plan(productId, 1)
```

The `1` is a planning basis only.

The service must not use the physical one-piece batch result for costing count materials. Example:

```text
plannedBaseQuantityPerProduct = 0.44 pc
plannedBatchBaseQuantity      = 1 pc
costPerBaseUnit               = PHP 10 / pc

standard pricing direct cost = PHP 4.40
not PHP 10.00
```

Physical `pc` rounding belongs to 4.4A planned batch financials.

## Safety-waste semantics

4.2A must apply the Product's forward safety reserve exactly once by consuming the already-adjusted Phase 2 quantities.

It must not:

- multiply by the safety-waste rate again;
- apply observed defect rate again;
- apply parent safety waste to discrete Material-backed components;
- apply parent safety waste to Product-backed components.

Observed defect loss is already embedded in learned material consumption per good piece and `ProductionRequirementService` explicitly reports:

```text
observedDefectRateIncluded = false
```

for the separate forward reserve operation.

## Join and identity semantics

Join requirement and cost evidence by normalized Material identity:

```text
trim + case-insensitive comparison
```

Returned `materialId` should preserve the canonical requirement Material ID.

The service must compare the Product identity returned by the two providers. A provider Product mismatch is an internal evidence-integrity failure and should fail closed with a typed service error rather than silently combining records from different Products.

Per-material base units must also agree. A mismatch is an unresolved line integrity issue and must not produce a cost value.

## Readiness model

4.2A must preserve known evidence while failing closed for authoritative totals.

### ready

Use `ready` only when:

- requirement plan status is `ready`;
- direct-material cost preview status is `ready`;
- every planned direct material has compatible cost evidence;
- no unmatched/invalid evidence remains;
- every derived line cost is finite and non-negative.

Then:

```text
pricingDirectMaterialCostPerUnit
```

is authoritative.

### partial

Use `partial` when at least one valid line cost is known but any requirement/cost/evidence issue remains.

Known subtotals remain visible as partial evidence.

### not-ready

Use `not-ready` when no authoritative direct-material line cost can be derived, including the existing `NO_REQUIREMENTS` state.

`pricingDirectMaterialCostPerUnit` should be `null` when no cost evidence is derivable. Known partial results may expose a numeric known subtotal while retaining `partial` status.

## Issue categories

Add controlled 4.2A issue codes for synthesis failures, for example:

```text
REQUIREMENT_PARTIAL
REQUIREMENT_NOT_READY
COST_PARTIAL
COST_NOT_READY
MATERIAL_COST_EVIDENCE_MISSING
MATERIAL_REQUIREMENT_EVIDENCE_MISSING
MATERIAL_BASE_UNIT_MISMATCH
DERIVED_COST_INVALID
DERIVED_COST_RECONCILIATION_FAILED
```

The result must also carry cloned underlying requirement/cost issues from the source services so later UI/readiness layers can explain the original cause.

## Deterministic ordering

Lines must sort deterministically by normalized Material ID.

Issues generated by 4.2A should follow deterministic material traversal order.

## Defensive cloning

The result must not leak mutable references from provider results.

Clone:

- requirement issues;
- cost issues;
- cost-line contribution entries;
- requirement contribution entries if included in the output;
- 4.2A issues.

## Shared session wiring

Update:

`src/application/session.ts`

Add:

```text
wasteAdjustedDirectMaterialCostService
```

constructed from:

```text
productionRequirementService
recipeMaterialCostPreviewService
```

No React changes belong to 4.2A.

## Focused test matrix

### Correct cost derivation

- one weight/volume material with safety waste;
- zero safety-waste rate;
- multiple direct materials aggregate correctly;
- base cost + reserve cost reconciles to pricing direct cost;
- full numeric precision is retained.

### Count-material rounding guard

- fractional `pc` planned quantity uses `plannedBaseQuantityPerProduct`;
- one-piece `plannedBatchBaseQuantity = ceil(...)` is explicitly ignored;
- standard unit cost therefore does not overstate count-material cost.

### Readiness

- fully ready requirement + cost evidence => ready;
- partial requirement with known cost evidence => partial;
- partial cost preview with known line evidence => partial;
- missing cost evidence for one planned material => partial when another line is known;
- no derivable line evidence => not-ready;
- existing `NO_REQUIREMENTS` state remains not-ready;
- source issues are preserved.

### Evidence integrity

- case-insensitive Material join;
- base-unit mismatch fails the affected line closed;
- extra cost line without matching planned requirement is surfaced;
- provider Product identity mismatch throws typed service error;
- invalid/non-finite derived cost fails closed;
- deterministic line ordering.

### Safety-waste protection

- service does not multiply waste a second time;
- observed defect rate is not separately re-applied;
- component costs are absent from 4.2A output.

### Session wiring

- shared session exposes the 4.2A service;
- no UI/source mutation path is introduced.

## Expected files

Likely changes:

```text
docs/PHASE_4_2A_WASTE_ADJUSTED_DIRECT_MATERIAL_UNIT_COST_PLAN.md
docs/PHASE_4_2A_WASTE_ADJUSTED_DIRECT_MATERIAL_UNIT_COST.md
src/application/productCosts/WasteAdjustedDirectMaterialCostService.ts
src/application/productCosts/WasteAdjustedDirectMaterialCostService.test.ts
src/application/productCosts/WasteAdjustedDirectMaterialCostSession.test.ts
src/application/session.ts
```

No domain source-record change should be needed.

## Explicit non-goals

4.2A does not implement:

- Material-backed component cost changes;
- recursive Product-backed component cost;
- labor cost roll-up;
- overhead cost roll-up;
- total fully loaded unit cost;
- selling-price derivation;
- profit/markup/margin calculation;
- batch physical production cost;
- final-batch count rounding for standard unit economics;
- expected revenue/profit;
- capacity feasibility;
- React UI;
- Excel/Tauri persistence;
- stock reservation/deduction/production posting.

## Implementation order

1. Create this plan before implementation code. ✅
2. Add 4.2A service/result/provider contracts.
3. Load one-unit ProductionRequirement and direct cost evidence in parallel.
4. Join Material evidence deterministically.
5. Derive base/reserve/pricing direct costs from authoritative quantities and cost-per-base-unit.
6. Add fail-closed readiness/issues.
7. Add shared session wiring.
8. Add focused tests.
9. Run full CI.
10. Create implementation record and advance plan to merge-gate-pending.
11. Require clean documented feature-head CI.
12. Verify exact diff against starting `develop`.
13. Open implementation PR to `develop`.
14. Require independent PR CI.
15. Merge with expected-head protection.
16. Require exact post-merge `develop` CI.
17. Create documentation-only closeout.
18. Mark 4.2A COMPLETE / 4.2B NEXT in `docs/PHASE_4_PROGRESS.md`.
19. Require closeout PR CI and exact final `develop` CI.

## Completion gate

4.2A is complete only when:

- standard direct-material unit cost uses precise waste-adjusted per-product quantities;
- physical one-piece `pc` rounding is not used;
- base and safety-reserve cost are separately visible;
- their sum reconciles to pricing direct-material cost;
- cost-per-base-unit is reused from authoritative existing evidence;
- no conversion/package-cost formula is duplicated;
- readiness fails closed while preserving known partial evidence;
- existing no-requirement semantics are preserved;
- deterministic per-material traceability exists;
- focused tests, full tests, typecheck, and production build pass;
- implementation PR and exact post-merge `develop` CI pass;
- closeout PR and exact final `develop` CI pass.

## Next task after completion

**4.2B — Recursive Fully Loaded Product Component Cost — NEXT / NOT STARTED**

Do not begin 4.2B until 4.2A is fully merged, closed out, and exact final `develop` CI is green.
