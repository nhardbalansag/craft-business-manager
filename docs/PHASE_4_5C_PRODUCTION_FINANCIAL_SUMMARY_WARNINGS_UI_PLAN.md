# Phase 4.5C — Production Financial Summary & Warnings UI Development Plan

## Status

**PLAN ESTABLISHED — IMPLEMENTATION NOT STARTED**

Authoritative starting base:

`develop` @ `e696c99810a82941fd0964f4cc23adedd5a44e78`

Starting exact `develop` CI:

`34967103982 — SUCCESS`

Feature branch:

`feature/phase-4-5c-production-financial-summary-warnings-ui`

Previous completed task:

`4.5B — Unit Economics / Pricing Calculator UI — COMPLETE`

Master plan:

`docs/PHASE_4_PRICING_PRODUCTION_PLANNING_PLAN.md`

## Objective

Extend the existing Production workspace with the completed Phase 4 planned-batch financial and capacity-feasibility evidence while preserving the Phase 3 direct-material, component, current-capacity, limiter, and recursive-cost detail already present on the page.

The user must be able to enter the same requested whole finished-product quantity and see, for that unchanged request:

- physical planned production cost;
- expected revenue;
- expected profit;
- effective batch margin;
- planned average physical cost per finished unit when available;
- current assembly capacity when authoritative;
- within-capacity, over-capacity, or capacity-unresolved feasibility;
- exact overage quantity when applicable;
- all authoritative tied limiting resources;
- structured capacity warnings;
- financial/capacity readiness issues.

React must display completed Phase 4 application evidence and must not reproduce authoritative cost, revenue, profit, margin, or feasibility formulas locally.

## Split assessment

No deeper roadmap split is required.

4.5C is one cohesive UI integration task because:

- `PlannedBatchCapacityFeasibilityService` already provides the complete authoritative Phase 4.4C read model for a Product + requested quantity;
- its retained `financials` result already contains the completed 4.4B batch-financial projection;
- its retained `capacityTrace` already contains the completed Phase 3 assembly-capacity detail needed by the existing Production UI;
- the current Production page already owns Product selection, requested quantity, direct-material requirements, component detail, current inventory/capacity detail, and nested component cost trace;
- 4.5C only adds the Phase 4 summary/warning presentation and aligns the existing capacity display to the same 4.4C result;
- Phase 4.6 remains separately responsible for integrated workflow scenarios and final regression/completion gates.

Implementation may use ordinary checkpoints for view helpers, panel integration, styles, tests, and documentation. These are not additional roadmap phases.

## Authoritative application boundary

4.5C must consume:

```text
plannedBatchCapacityFeasibilityService.assessBatch(productId, plannedQuantity)
```

The UI must not directly recompute:

- physical planned production cost;
- expected revenue;
- expected profit;
- batch margin;
- planned average physical cost per finished unit;
- current authoritative assembly capacity;
- overage quantity;
- capacity feasibility classification;
- tied limiting-resource selection.

These values come directly from the completed 4.4C result and its retained 4.4B / Phase 3 evidence.

## Production workspace orchestration

The current Production page loads three Phase 3 results in parallel:

```text
productionRequirementService.plan(...)
componentAwareProductCostService.costProduct(...)
assemblyCapacityTraceService.trace(...)
```

4.5C should change that orchestration to:

```text
productionRequirementService.plan(...)
componentAwareProductCostService.costProduct(...)
plannedBatchCapacityFeasibilityService.assessBatch(...)
```

Then:

```text
capacityTrace = batchFeasibility.capacityTrace
```

This is preferred because:

- Phase 3 direct-material/component UI remains intact;
- the Production page avoids a second independent `AssemblyCapacityTraceService` request;
- current capacity shown in Phase 3 detail and Phase 4 financial feasibility comes from the exact same retained trace;
- the requested quantity stays unchanged;
- cross-source consistency remains owned by 4.4C.

The page may still use the existing Phase 3 view helpers for direct-material, component, limiter, and issue detail.

## New UI state

Add one result state:

```text
batchFeasibility: PlannedBatchCapacityFeasibilityResult | null
```

The existing `capacityTrace` may remain as a convenience state if useful, but it must be sourced from `batchFeasibility.capacityTrace` rather than independently loaded.

On invalid Product/quantity selection:

- clear Phase 4 batch feasibility/financial result;
- preserve the existing quantity validation message;
- do not synthesize a zero financial plan.

On an unexpected request/service error:

- clear the corresponding derived results;
- show controlled Production feedback;
- do not publish stale financial or capacity evidence.

## Phase 4 financial summary placement

Add a visually distinct Phase 4 section near the top of Production, after Product/quantity controls and before the detailed Phase 3 input tables.

Recommended hierarchy:

```text
PHASE 4 · BATCH FINANCIAL PLAN

[ Planned production cost ] [ Expected revenue ]
[ Expected profit          ] [ Batch margin     ]
[ Avg physical cost / unit ] [ Current capacity ]

Feasibility banner / warning area
Authoritative tied limiting resources
Financial / feasibility readiness issues
```

The existing Phase 3 summary/detail must remain below and must not be removed.

## Financial values

Display these authoritative fields directly from:

```text
batchFeasibility.financials
```

### Planned production cost

```text
financials.plannedProductionCost
```

This is the completed 4.4A physical planned batch cost and is not `standard unit cost × Q`.

### Expected revenue

```text
financials.expectedRevenue
```

### Expected profit

```text
financials.expectedProfit
```

Finite negative expected profit is valid business evidence and must remain visibly negative.

### Effective batch margin

```text
financials.batchMargin
```

Display canonical decimal rate as a human percentage only at the presentation boundary.

`null` remains unavailable. Do not display Infinity, NaN, or fake zero.

### Planned average physical cost per finished unit

```text
financials.plannedAverageCostPerFinishedUnit
```

This may be null for zero quantity and must remain unavailable rather than becoming zero.

### Requested quantity

Use:

```text
batchFeasibility.plannedQuantity
```

for the displayed authoritative request evidence, while keeping the input text itself user-owned.

## Capacity feasibility presentation

Use only:

```text
batchFeasibility.feasibility
batchFeasibility.currentAssemblyCapacity
batchFeasibility.overageQuantity
```

Map status labels for presentation only:

```text
within-current-capacity -> Within current capacity
over-current-capacity   -> Over current capacity
capacity-unresolved     -> Capacity unresolved
```

Do not infer feasibility from `plannedQuantity > capacity` in React.

### Within current capacity

Show a positive/neutral advisory that the unchanged requested quantity is within currently authoritative assembly capacity.

### Over current capacity

Show a prominent warning containing authoritative:

- requested quantity;
- current assembly capacity;
- overage quantity;
- statement that the requested quantity has not been changed automatically.

### Capacity unresolved

Show an unresolved warning/advisory rather than inventing a capacity value.

## Structured warning presentation

Display every authoritative item from:

```text
batchFeasibility.warnings
```

Supported completed 4.4C warning codes include:

```text
OVER_CURRENT_CAPACITY
CAPACITY_UNRESOLVED
LIMITING_RESOURCE_EXPLANATION_INCOMPLETE
```

The UI may choose icons/tone classes, but warning messages themselves remain application evidence and should be rendered without changing their meaning.

No local warning formula should exist.

## Limiting resources

Display every authoritative top-level limiting resource from:

```text
batchFeasibility.limitingResources
```

Supported resource types remain:

```text
material-requirement
material-backed-component
product-backed-component
```

Use readable source labels/path/evidence derived from the retained typed resource, reusing existing `buildLimitingResourceRows(...)` when safe.

Important 4.4C rule:

- when numeric capacity is authoritative but limiter explanation is partial, top-level `limitingResources` is deliberately empty;
- the UI must not reconstruct a partial limiter subset from nested Phase 3 trace and present it as authoritative Phase 4 limiter evidence;
- instead show `LIMITING_RESOURCE_EXPLANATION_INCOMPLETE`.

The existing Phase 3 limiter section may continue showing its own trace-readiness behavior, but the Phase 4 financial feasibility section must honor the 4.4C top-level limiter contract.

## Readiness and issue presentation

Show:

```text
batchFeasibility.status
batchFeasibility.issues
financials.status
financials.issues
```

Use explicit labels:

```text
Ready
Partial
Not ready
```

The page must preserve the distinction between:

- financial readiness;
- joined 4.4C readiness;
- physical feasibility.

A fully known over-capacity request may still have:

```text
status = ready
feasibility = over-current-capacity
```

Do not style `ready + over-current-capacity` as a data failure. It is valid planning evidence with a business warning.

Where duplicate nested issues would create excessive noise, the Phase 4 summary may prioritize top-level 4.4C issues plus 4.4B financial issues while the existing Phase 3 issue section continues to expose direct/component/capacity details.

## Phase 3 detail preservation

Do not remove or weaken existing Production detail for:

- direct materials and safety-waste quantities;
- direct-material current on-hand and capacity;
- discrete components;
- current component availability / ProductStock semantics;
- component capacities;
- root component-aware input cost;
- current limiting resources;
- recursive component cost paths;
- Phase 3 readiness issues.

The existing local Phase 3 `plannedInputCost` display may remain as its historical Phase 3 input-only diagnostic, but it must be clearly separate from the new authoritative Phase 4 `plannedProductionCost` and must not be used for revenue/profit/margin calculations.

## Pure presentation helpers

Add a focused helper module, likely:

```text
src/ui/production/plannedBatchFinancialView.ts
```

It may provide presentation-only helpers such as:

```text
formatBatchMoney(...)
formatBatchPercent(...)
capacityFeasibilityLabel(...)
financialReadinessLabel(...)
buildFinancialLimiterRows(...)
```

The helper must not aggregate, reconcile, derive, or clamp authoritative financial/capacity values.

## Tests

### Pure financial-view tests

Add focused tests covering at least:

1. PHP formatting preserves zero and finite negatives;
2. null/non-finite money remains unavailable;
3. decimal batch margin becomes a human percentage;
4. null/non-finite margin remains unavailable;
5. all three feasibility labels are deterministic;
6. ready/partial/not-ready labels are deterministic;
7. typed Material-requirement limiter mapping preserves source/capacity/path evidence;
8. Material-backed component limiter mapping preserves source/capacity/path evidence;
9. Product-backed component limiter mapping preserves source/capacity/path evidence;
10. tied limiters remain all visible with no local winner selection;
11. empty 4.4C top-level limiter set remains empty even if nested capacity trace has candidate limiters;
12. authoritative negative profit and non-reconciling values are formatted, not recomputed.

### ProductionPage smoke coverage

Extend static React smoke coverage to verify the Phase 4 batch-financial shell includes:

- Batch financial plan;
- Planned production cost;
- Expected revenue;
- Expected profit;
- Effective batch margin;
- Average physical cost per unit;
- Capacity feasibility;
- Current capacity;
- Overage;
- Capacity warnings;
- Limiting resources;
- Financial / feasibility readiness issues.

Existing Phase 3 Production shell assertions must continue to pass.

### Regression gate

All existing tests remain green, especially:

- 4.4A PhysicalPlannedBatchProductionCostService tests;
- 4.4B ExpectedBatchFinancialsService tests;
- 4.4C PlannedBatchCapacityFeasibilityService tests;
- Phase 3 assembly-capacity/trace tests;
- component-aware Production view tests;
- 4.5A/4.5B Pricing UI tests;
- App smoke tests.

No new frontend dependency is required.

## Expected implementation files

Likely new files:

```text
src/ui/production/plannedBatchFinancialView.ts
src/ui/production/plannedBatchFinancialView.test.ts
```

Likely updated files:

```text
src/ui/production/ProductionPage.tsx
src/ui/production/production.css
src/App.smoke.test.tsx
```

Documentation:

```text
docs/PHASE_4_5C_PRODUCTION_FINANCIAL_SUMMARY_WARNINGS_UI.md
```

No application/domain/storage contract change is expected.

## Explicit non-goals

4.5C must not implement:

- new financial formulas;
- new capacity formulas;
- inventory reservation or deduction;
- production-order creation;
- accounting journal posting;
- tax/VAT calculation;
- discounts/marketplace fees;
- persistence/Excel/Tauri;
- final Phase 4 cross-scenario integration suite.

Those remain Phase 4.6, Phase 5, or later concerns.

## Validation gates

Before implementation PR merge:

- dedicated Phase 4.5C financial-view tests pass;
- Production/App smoke tests pass;
- existing Phase 3 Production view tests remain green;
- 4.4A/4.4B/4.4C service tests remain green;
- full repository test suite passes;
- TypeScript typecheck passes;
- production Vite build passes;
- final documented feature-head CI is green;
- PR CI is green.

After merge:

- exact implementation-merge `develop` CI must be green before documentation closeout;
- closeout must preserve the full Phase 4 audit trail;
- `4.5 — Pricing & Production Planning UI` may become COMPLETE only after 4.5C closeout and exact final closeout CI are green;
- roadmap may advance to `4.6A — Integrated Pricing / Production Workflow — NEXT` only after those gates.

## Completion gate

4.5C is complete only when:

- the same Product + quantity request drives both existing Phase 3 Production detail and completed Phase 4.4C financial/capacity evidence;
- no independent duplicate capacity request is needed by the page;
- physical planned production cost, revenue, profit, margin, and average cost are directly presented from 4.4B evidence;
- negative profit is preserved;
- null diagnostics stay unavailable rather than fake zero;
- within/over/unresolved feasibility comes directly from 4.4C;
- overage comes directly from 4.4C;
- requested quantity is never auto-clamped;
- every authoritative 4.4C warning is visible;
- every authoritative 4.4C tied limiter is visible when published;
- partial limiter explanation never becomes a misleading partial top-level limiter set;
- financial/joined readiness issues are visible;
- existing Phase 3 Production input/capacity detail remains available;
- React performs no authoritative financial/capacity formula duplication;
- focused/full tests, typecheck, build, PR CI, exact post-merge CI, and documentation closeout all pass.

## Next task after completion

`4.6A — Integrated Pricing / Production Workflow — NEXT / NOT STARTED`

Do not begin 4.6A implementation until 4.5C is fully merged, post-merge validated, documentation-closeout complete, and 4.6A receives its own scope/split assessment and development plan.
