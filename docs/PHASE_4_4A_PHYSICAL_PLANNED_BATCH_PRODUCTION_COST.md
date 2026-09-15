# Phase 4.4A — Physical Planned Batch Production Cost

## Status

**COMPLETE — MERGED — POST-MERGE VALIDATED**

Authoritative starting base:

`develop` @ `1a7629385c0e6dd84255ab014a3f3ec0210bfa68`

Starting exact `develop` CI:

`34949575060 — SUCCESS`

Feature branch:

`feature/phase-4-4a-physical-planned-batch-production-cost`

Development plan:

`docs/PHASE_4_4A_PHYSICAL_PLANNED_BATCH_PRODUCTION_COST_PLAN.md`

Plan-before-code commit:

`5fa6327d72766680b47b1ea95426e50ffc1f2c08`

## Completion evidence

```text
Compile/wiring checkpoint       f286189dc9bbca1736f545fb75e60b80323b4a79
Checkpoint CI                   34951009176 — SUCCESS
Initial focused-test head       4145fb51eb84111804cb5ec3d394326579fce360
Focused-test CI                 34951294935 — FAILURE (invalid-cost readiness classification corrected)
Corrected implementation head   1306cc169d112049fc5fdc635c7ce0c68db44338
Corrected CI                    34951713527 — SUCCESS
Final documented feature head   a246b2f086da1a798dee09dbe319356e6561c834
Final feature-head CI           34951843605 — SUCCESS
PR #114                         MERGED
PR CI                           34951946653 — SUCCESS
Implementation merge            eec44812067740cc26f440f6751f4e34c5bd4f4e
Post-merge develop CI           34952186409 — SUCCESS
73 test files / 884 tests
30 PhysicalPlannedBatchProductionCostService tests
1 Phase 4.4A shared-session wiring test
TypeScript typecheck passed
production Vite build passed
107 modules transformed
```

## Delivered capability

Phase 4.4A adds the authoritative application-level cost of producing a requested physical batch of a Product.

The implementation deliberately does **not** use:

```text
totalFullyLoadedUnitCost × requestedQuantity
```

as the authoritative physical production cost.

Instead it combines:

```text
Phase 2 physical direct-material plan for Q
+ Phase 4.2C authoritative direct-material cost-per-base-unit evidence
+ Material-backed component cost × Q
+ Product-backed child fully loaded production cost × Q
+ root labor × Q
+ root overhead × Q
= planned physical production cost
```

This preserves final-batch count-material rounding while reusing the completed Phase 4 costing boundaries.

## Service boundary

Added:

`src/application/production/PhysicalPlannedBatchProductionCostService.ts`

The service consumes only:

```text
ProductionRequirementService-compatible provider
FullyLoadedProductUnitCostService-compatible provider
```

It does not reopen lower-level material, calibration, component, financial-profile, pricing, inventory, or capacity repositories.

## Physical direct-material semantics

For each Phase 2 physical planned requirement:

```text
preciseBatchBaseQuantity
= plannedBaseQuantityPerProduct × Q

physicalBatchBaseQuantity
= Phase 2 plannedBatchBaseQuantity

plannedBatchCost
= physicalBatchBaseQuantity × costPerBaseUnit
```

The direct-material trace preserves:

```text
plannedBaseQuantityPerProduct
preciseBatchBaseQuantity
physicalBatchBaseQuantity
countRoundingExtraBaseQuantity
costPerBaseUnit
preciseBatchCost
countRoundingExtraCost
knownPlannedBatchCost
plannedBatchCost
```

For continuous weight/volume materials, physical and precise batch quantities normally reconcile exactly.

For `pc` direct materials, final-batch rounding remains explicit and can make physical production cost higher than standard unit cost multiplied by quantity.

Safety waste comes from the existing Phase 2 physical plan and is therefore applied exactly once. Observed yield defects are not re-applied.

## Component costing

### Material-backed components

Completed 4.2C Material-backed component evidence is scaled by the requested quantity:

```text
plannedComponentQuantity = quantityPerParent × Q
plannedBatchCost = componentCostContribution × Q
```

Parent safety waste does not inflate discrete component counts.

### Product-backed components

Completed 4.2C recursive Product-backed component evidence is scaled by the requested quantity:

```text
plannedChildQuantity = quantityPerParent × Q
plannedBatchCost = componentCostContribution × Q
```

The authoritative contribution continues to represent child fully loaded **production cost**, never child retail selling price, profit, or pricing policy.

Partial child evidence preserves `knownComponentCostContribution × Q` as known physical evidence without publishing an authoritative final batch total.

## Root labor and overhead

```text
laborBatchCost = laborCostPerUnit × Q
overheadBatchCost = overheadCostPerUnit × Q
```

Explicit zero values remain known zero evidence. Missing values preserve known subtotals but block authoritative readiness.

## Controlled component-only direct-material mode

When completed 4.2C evidence establishes:

```text
directMaterialMode = neutral-component-only
```

and the current Phase 2 physical plan consistently contains no direct requirements with only `NO_REQUIREMENTS` issues, direct-material physical cost is controlled neutral zero.

Any contradiction between neutral-component-only mode and the current physical plan fails closed.

## Readiness

The service exposes:

```text
ready
partial
not-ready
```

`ready` requires consistent Product identity/quantity, authoritative physical direct-material evidence (or valid controlled neutral mode), ready component costs, and ready root labor/overhead evidence.

`partial` preserves meaningful known physical cost evidence while withholding `plannedProductionCost` when required evidence is incomplete.

`not-ready` is used for unavailable authoritative evidence or unsafe contradictions such as identity/quantity/material-set mismatch, base-unit mismatch, or invalid/non-finite numeric evidence.

## Batch cost result

The result exposes:

```text
productId
productName
productIsActive
status
unitCostStatus
requirementStatus
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

`standardUnitCostTimesQuantity` and `physicalVsStandardCostDifference` are diagnostics only. They do not replace the physical batch cost as the authoritative production-planning basis.

## Error behavior

Known request-level failures are translated to controlled 4.4A application errors:

```text
PRODUCT_NOT_FOUND
INVALID_PLANNED_QUANTITY
PRODUCTION_REQUIREMENT_INVALID
```

Invalid planned quantity preserves the Phase 2 underlying code, including:

```text
NON_FINITE_PLANNED_QUANTITY
NEGATIVE_PLANNED_QUANTITY
NON_INTEGER_PLANNED_QUANTITY
```

Unexpected provider/infrastructure errors propagate unchanged.

## Defensive behavior

Returned Phase 2 production-plan evidence and the complete retained 4.2C evidence are defensively cloned. Nested paths/issues and derived line issues are also copied so callers cannot mutate provider-owned evidence through the 4.4A result.

## Shared application session

Updated:

`src/application/session.ts`

The shared session now exposes:

```text
physicalPlannedBatchProductionCostService
```

wired over:

```text
productionRequirementService
fullyLoadedProductUnitCostService
```

## Validation history

### Compile/wiring checkpoint

Implementation/service wiring head:

`f286189dc9bbca1736f545fb75e60b80323b4a79`

CI:

`34951009176 — SUCCESS`

This established that the new service contract and shared-session wiring typechecked, regressed cleanly against the existing suite, and built successfully before the focused 4.4A behavioral matrix was finalized.

### Focused-test gate

Initial focused-test head:

`4145fb51eb84111804cb5ec3d394326579fce360`

CI:

`34951294935 — FAILURE`

The only failure was the deliberate corrupted direct-material cost fixture: a non-finite `costPerBaseUnit` was correctly withheld from authoritative total calculation but was classified `partial` instead of the planned fail-closed `not-ready` state.

No typecheck failure occurred.

### Corrected implementation

Corrected implementation head:

`1306cc169d112049fc5fdc635c7ce0c68db44338`

Corrected CI:

`34951713527 — SUCCESS`

Validation:

```text
TypeScript typecheck                 PASS
73 test files                        PASS
884 tests                            PASS
30 PhysicalPlannedBatchProductionCostService tests PASS
1 Phase 4.4A shared-session wiring test             PASS
production Vite build                PASS
107 modules transformed
```

The corrected service now explicitly treats non-null invalid/non-finite direct-material cost evidence as an unsafe contradiction and returns `not-ready`.

### PR and post-merge validation

Implementation PR:

`#114 — MERGED`

PR CI:

`34951946653 — SUCCESS`

Implementation merge:

`eec44812067740cc26f440f6751f4e34c5bd4f4e`

Exact post-merge `develop` CI:

`34952186409 — SUCCESS`

## Focused coverage

4.4A tests cover:

- continuous weight/volume physical batch cost;
- final-batch `pc` rounding and the resulting physical-vs-standard cost difference;
- explicit rounding quantity/cost trace;
- safety waste exactly once;
- Material-backed component scaling;
- Product-backed child fully loaded production-cost scaling;
- root labor and overhead scaling;
- multi-component reconciliation;
- controlled component-only neutral direct-material semantics;
- neutral-mode contradiction;
- zero requested quantity;
- archived Product inspectability;
- partial 4.2C evidence and known physical subtotal preservation;
- partial physical direct-material evidence;
- not-ready upstream evidence;
- Product identity and returned-quantity mismatch;
- physical/material cost-evidence set mismatch;
- base-unit mismatch;
- non-finite direct cost evidence;
- invalid component evidence;
- partial Product-backed child evidence;
- invalid root labor evidence;
- Product-not-found translation;
- all three planned-quantity validation translations;
- defensive cloning;
- unexpected provider-error propagation;
- shared-session wiring.

## Scope boundaries retained

Phase 4.4A does not implement:

- selling-price derivation;
- expected batch revenue;
- expected batch profit;
- batch margin;
- capacity feasibility or limiting-resource warnings;
- stock reservation/deduction/posting;
- production posting/history;
- accounting entries;
- tax/VAT/discount/marketplace-fee logic;
- React pricing/production UI;
- Excel persistence;
- Tauri integration;
- presentation rounding/formatting.

## Next task

After this documentation-only closeout is merged and the exact final `develop` CI is green, the next task is:

```text
4.4B — Expected Revenue / Profit / Batch Margin — NEXT / NOT STARTED
```
