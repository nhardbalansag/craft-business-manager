# Phase 4.4A — Physical Planned Batch Production Cost Development Plan

## Status

**PLANNED — IMPLEMENTATION NOT STARTED**

Authoritative starting base:

`develop` @ `1a7629385c0e6dd84255ab014a3f3ec0210bfa68`

Starting exact `develop` CI:

`34949575060 — SUCCESS`

Feature branch:

`feature/phase-4-4a-physical-planned-batch-production-cost`

Previous completed task:

`4.3C — Product Pricing Quote & Readiness Service — COMPLETE`

Master plan:

`docs/PHASE_4_PRICING_PRODUCTION_PLANNING_PLAN.md`

## Objective

Provide the authoritative Phase 4 application-level cost of a requested **physical production batch** for one Product.

The service must deliberately differ from naïve `totalFullyLoadedUnitCost × requestedQuantity` because direct count materials can round upward only at the final physical batch boundary.

Conceptually:

```text
physical Phase 2 direct-material plan for Q
× authoritative direct-material cost-per-base-unit evidence
+ Material-backed component production cost × Q
+ Product-backed fully loaded child production cost × Q
+ root labor cost per unit × Q
+ root overhead cost per unit × Q
= planned physical production cost
```

Phase 4.4A is cost planning only. It must not derive selling price, expected revenue, expected profit, batch margin, or capacity feasibility.

## Split assessment

No deeper roadmap split is required.

4.4A is one cohesive application-service capability because all required inputs already exist behind authoritative application boundaries:

- `ProductionRequirementService` owns requested physical batch direct-material quantities, safety waste, and final-batch `pc` rounding;
- `FullyLoadedProductUnitCostService` owns authoritative Phase 4 production-cost evidence for direct-material cost basis, Material-backed components, Product-backed fully loaded components, root labor, and root overhead.

Splitting 4.4A further would create artificial boundaries around one reconciliation problem and would risk duplicating cost/readiness rules already established by 4.2A–4.2C.

## Locked architecture

### Primary upstream boundaries

Create one application service that consumes only:

```text
ProductionRequirementService-compatible provider
FullyLoadedProductUnitCostService-compatible provider
```

The new service must not directly re-open lower-level repositories for:

- Material purchase/package conversion;
- yield/calibration logic;
- Product component graph traversal;
- financial profile source reads;
- pricing policy;
- inventory/capacity.

### Product identity anchor

`FullyLoadedProductUnitCostService` is the canonical Product identity anchor because it resolves:

```text
productId
productName
productIsActive
```

Recommended call order:

1. resolve the fully loaded Product cost result for the requested Product;
2. call physical production planning using the canonical Product ID and requested quantity;
3. validate that the returned physical plan still belongs to the same Product.

This gives deterministic Product-not-found behavior and avoids silently combining evidence from different Products.

### Planned quantity contract

The requested quantity must preserve the existing Phase 2 production-planning rules:

```text
finite
>= 0
whole integer
```

Do not add a new independent quantity-validation formula.

Delegate to the existing production requirement boundary and translate known planned-quantity input errors into a controlled 4.4A application error while preserving the upstream error code.

A quantity of `0` is valid.

Zero quantity must be numerically safe, but it does not excuse contradictory or incomplete source evidence from readiness checks.

### Physical direct-material cost

For each physical Phase 2 planned direct-material requirement:

```text
plannedDirectMaterialCostLine
= physical plannedBatchBaseQuantity
× authoritative costPerBaseUnit
```

Cost-per-base-unit evidence must come from the completed Phase 4 direct-material evidence carried by the 4.2C fully loaded cost result.

Do not use:

```text
pricingDirectMaterialCostPerUnit × Q
```

because that would miss final-batch upward rounding for indivisible `pc` direct materials.

Each direct-material trace line should retain at least:

```text
materialId
baseUnit
plannedBaseQuantityPerProduct
requestedQuantity
preciseBatchBaseQuantity
physicalBatchBaseQuantity
countRoundingExtraBaseQuantity
costPerBaseUnit
preciseBatchCost
countRoundingExtraCost
plannedBatchCost
status/issues
```

For non-`pc` materials, physical and precise batch quantities should reconcile exactly under normal evidence.

For `pc` materials, the rounding delta must remain visible instead of being hidden inside the subtotal.

### Component-only neutral direct-material semantics

A genuine component-only Product can be fully cost-ready even though Phase 2 direct-material planning returns `NO_REQUIREMENTS` / not-ready semantics for direct materials.

Preserve the controlled 4.2C interpretation:

```text
directMaterialMode = neutral-component-only
```

When 4.2C has established that mode and the physical plan contains no direct-material requirements consistent with genuine `NO_REQUIREMENTS` evidence:

```text
plannedDirectMaterialCostSubtotal = 0
```

and direct materials do not downgrade an otherwise ready physical batch cost.

Broken/partial direct-material evidence must never be converted into this neutral mode.

### Material-backed component batch cost

Use completed 4.2C Material-backed component evidence.

For each ready Material-backed component line:

```text
plannedComponentQuantity = quantityPerParent × Q
plannedComponentCost = componentCostContribution × Q
```

Equivalent trace may also expose:

```text
costPerPc
quantityPerParent
plannedComponentQuantity
```

Do not apply parent safety waste to discrete components.

Do not use current inventory quantity in the cost math.

### Product-backed component batch cost

Use completed 4.2C recursive Product-backed component evidence.

For each ready Product-backed line:

```text
plannedChildQuantity = quantityPerParent × Q
plannedProductComponentCost = componentCostContribution × Q
```

where the existing authoritative per-parent contribution already derives from:

```text
childFullyLoadedUnitCost × quantityPerParent
```

Do not use child selling price, child profit, or child pricing policy.

Preserve child identity/path and fully loaded cost trace for inspection.

### Root labor and overhead

Use 4.2C root financial cost evidence:

```text
laborBatchCost = laborCostPerUnit × Q
overheadBatchCost = overheadCostPerUnit × Q
```

Explicit zero labor/overhead remains valid known zero evidence.

Missing or invalid financial evidence must preserve known subtotals but block an authoritative final production cost.

### Batch cost synthesis

Authoritative total:

```text
plannedProductionCost
= plannedDirectMaterialCostSubtotal
+ plannedMaterialComponentCostSubtotal
+ plannedProductComponentCostSubtotal
+ laborBatchCost
+ overheadBatchCost
```

Do not derive this from standard unit cost multiplied by quantity.

Also expose:

```text
knownPlannedProductionCostSubtotal
```

when partial evidence permits a deterministic known physical subtotal while the authoritative total remains unresolved.

### Standard-cost comparison diagnostic

For traceability, the result may expose the standard comparison:

```text
standardUnitCostTimesQuantity
= totalFullyLoadedUnitCost × Q
```

only when authoritative 4.2C total unit cost exists.

Also expose:

```text
physicalVsStandardCostDifference
= plannedProductionCost - standardUnitCostTimesQuantity
```

when both totals are authoritative.

This field is diagnostic only and must not become a second pricing basis.

For typical weight/volume-only batches the difference may be zero; count-material rounding may make it positive.

### Cross-source consistency guards

Fail closed rather than selecting one conflicting source when separately retrieved evidence disagrees.

At minimum validate:

- requested/canonical Product identity versus physical-plan Product identity;
- physical-plan requested quantity versus returned `plannedQuantity`;
- physical direct-material requirement material set versus cost-evidence material set when direct mode is `costed`;
- direct-material base-unit agreement;
- finite/non-negative physical planned quantities;
- finite/non-negative cost-per-base-unit evidence;
- finite/non-negative component contribution evidence;
- finite/non-negative labor/overhead evidence;
- all derived subtotals/totals remain finite/non-negative;
- authoritative final total reconciles exactly with its authoritative cost subtotals under the repository's existing precision semantics.

### Readiness model

Use:

```text
ready
partial
not-ready
```

Recommended semantics:

```text
ready
  canonical Product and physical-plan identity/quantity agree;
  direct-material evidence is ready or valid neutral-component-only;
  all required Material-backed component costs are ready;
  all required Product-backed fully loaded component costs are ready;
  root labor/overhead evidence is ready;
  all derived batch subtotals/totals are finite and consistent.

partial
  meaningful physical cost evidence exists;
  one or more upstream cost/requirement inputs are partial;
  known physical subtotal can be preserved;
  but no authoritative plannedProductionCost may be published.

not-ready
  required evidence is absent/not-ready;
  or cross-source identity/quantity/material-set contradiction exists;
  or invalid/non-finite evidence makes the physical batch calculation unsafe.
```

Do not publish an authoritative `plannedProductionCost` for partial/not-ready results.

### Issue model

Quote-level-style orchestration issues should remain separate from nested upstream evidence.

Suggested issue codes:

```text
PRODUCTION_PLAN_PRODUCT_MISMATCH
PRODUCTION_PLAN_QUANTITY_MISMATCH
DIRECT_MATERIAL_PARTIAL
DIRECT_MATERIAL_NOT_READY
DIRECT_MATERIAL_EVIDENCE_MISSING
DIRECT_MATERIAL_REQUIREMENT_MISSING
DIRECT_MATERIAL_BASE_UNIT_MISMATCH
DIRECT_MATERIAL_COST_INVALID
MATERIAL_COMPONENT_NOT_READY
PRODUCT_COMPONENT_PARTIAL
PRODUCT_COMPONENT_NOT_READY
LABOR_COST_INVALID
OVERHEAD_COST_INVALID
DERIVED_COST_INVALID
COST_RECONCILIATION_FAILED
```

The exact names may be refined during implementation while preserving these semantics.

### Defensive cloning

The 4.4A result must defensively clone retained upstream evidence so callers cannot mutate service-owned data.

At minimum clone:

- physical production requirement plan and nested requirement/contribution/issue arrays;
- complete 4.2C fully loaded unit-cost evidence;
- Material-backed component trace/source-availability evidence;
- recursive Product-backed path/breakdown/issues;
- derived 4.4A line issues.

### Precision

All cost math remains full precision.

Do not add:

- currency formatting;
- two-decimal rounding;
- charm pricing;
- percentage presentation conversion.

## Planned service contract

Create:

```text
src/application/production/PhysicalPlannedBatchProductionCostService.ts
```

Expected top-level result shape:

```text
productId
productName
productIsActive
status
plannedQuantity
productionRequirements
unitCostEvidence
directMaterialMode
directMaterialLines
materialComponentLines
productComponentLines
plannedDirectMaterialCostSubtotal
plannedMaterialComponentCostSubtotal
plannedProductComponentCostSubtotal
laborCostPerUnit
laborBatchCost
overheadCostPerUnit
overheadBatchCost
knownPlannedProductionCostSubtotal
plannedProductionCost
standardUnitCostTimesQuantity
physicalVsStandardCostDifference
issues
```

Exact type names may be refined during implementation while preserving the locked semantics above.

## Error behavior

Create a controlled 4.4A application error for known request-level failures.

At minimum preserve:

```text
PRODUCT_NOT_FOUND
INVALID_PLANNED_QUANTITY
```

The invalid-quantity error should retain the Phase 2 underlying code such as:

```text
NON_FINITE_PLANNED_QUANTITY
NEGATIVE_PLANNED_QUANTITY
NON_INTEGER_PLANNED_QUANTITY
```

Unexpected programming/infrastructure errors must propagate rather than being mislabeled as readiness issues.

## Test plan

Focused tests should cover at least:

1. ready weight/volume-only physical batch cost where standard unit cost × quantity reconciles exactly;
2. direct `pc` material whose final batch quantity rounds upward and makes physical batch cost exceed naïve unit-cost × quantity;
3. direct-material trace exposes precise quantity, physical quantity, rounding delta, and rounding cost;
4. safety waste is included exactly once through Phase 2 planned physical requirements;
5. observed defect loss is not applied again;
6. Material-backed discrete component quantities/cost scale by requested quantity without parent safety-waste inflation;
7. Product-backed child component fully loaded production cost scales by requested quantity;
8. child retail selling price/profit is not used;
9. root labor scales by requested quantity;
10. root overhead scales by requested quantity;
11. multiple Material-backed/Product-backed components reconcile to correct subtotals;
12. component-only Product uses controlled neutral direct-material mode and can remain ready;
13. zero requested quantity is accepted and produces numerically safe zero batch subtotals when source evidence is otherwise ready;
14. archived Product remains inspectable/plannable when cost evidence is valid;
15. upstream 4.2C partial evidence produces partial result with known physical subtotal and no authoritative total;
16. upstream 4.2C not-ready evidence produces not-ready result;
17. partial/not-ready physical direct-material requirement evidence does not publish authoritative direct-material total;
18. Product identity mismatch fails closed;
19. returned planned-quantity mismatch fails closed;
20. direct-material cost evidence missing for a planned material fails closed;
21. direct-material physical requirement missing for authoritative cost evidence fails closed;
22. base-unit mismatch fails closed;
23. invalid/non-finite direct-material cost evidence fails closed;
24. invalid/non-finite component contribution fails closed;
25. invalid labor/overhead evidence fails closed;
26. invalid derived subtotal/total fails closed;
27. Product-not-found translation;
28. negative/non-integer/non-finite planned quantity translation preserving underlying code;
29. defensive cloning of physical requirement evidence;
30. defensive cloning of 4.2C nested evidence and paths/issues;
31. shared application-session wiring.

Then run:

```text
npm run typecheck
npm test
npm run build
```

Repository CI remains the merge gate.

## Planned files

Add:

```text
src/application/production/PhysicalPlannedBatchProductionCostService.ts
src/application/production/PhysicalPlannedBatchProductionCostService.test.ts
src/application/production/PhysicalPlannedBatchProductionCostSession.test.ts
docs/PHASE_4_4A_PHYSICAL_PLANNED_BATCH_PRODUCTION_COST.md
```

Update:

```text
src/application/session.ts
docs/PHASE_4_4A_PHYSICAL_PLANNED_BATCH_PRODUCTION_COST_PLAN.md
```

After implementation merge and exact post-merge `develop` CI, perform a documentation-only closeout updating:

```text
docs/PHASE_4_PROGRESS.md
```

Then advance to:

```text
4.4B — Expected Revenue / Profit / Batch Margin — NEXT / NOT STARTED
```

## Explicit exclusions

4.4A does not implement:

- selling-price derivation;
- expected revenue;
- expected profit;
- batch margin;
- capacity feasibility or limiting-resource warnings;
- inventory reservation/deduction/posting;
- production posting/history;
- accounting journal entries;
- tax/VAT/discount/marketplace-fee logic;
- React UI;
- Excel persistence;
- Tauri integration;
- presentation rounding/formatting.

## Completion gate

4.4A is complete only when:

- exact starting `develop` SHA and CI are recorded;
- this plan exists before implementation code;
- physical direct-material cost uses Phase 2 planned batch requirements and final-batch count rounding;
- component/labor/overhead batch cost is derived from authoritative completed Phase 4 cost evidence;
- component-only neutral direct-material semantics are preserved safely;
- no selling-price/revenue/profit/capacity scope leaks into 4.4A;
- partial/not-ready evidence never publishes an authoritative production total;
- full traceability and consistency guards exist;
- focused tests pass;
- shared-session wiring passes;
- full typecheck/test/build validation passes;
- implementation record is complete;
- final feature-head CI passes;
- implementation PR passes CI and merges from the expected head;
- exact post-merge `develop` CI passes;
- documentation-only closeout merges and final `develop` CI passes;
- only then does 4.4B advance to NEXT.
