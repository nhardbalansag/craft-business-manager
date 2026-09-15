# Phase 4.5C — Production Financial Summary & Warnings UI

## Status

**IMPLEMENTED — FEATURE BRANCH VALIDATED — PR / MERGE PENDING**

Starting base:

`develop` @ `e696c99810a82941fd0964f4cc23adedd5a44e78`

Starting exact `develop` CI:

`34967103982 — SUCCESS`

Feature branch:

`feature/phase-4-5c-production-financial-summary-warnings-ui`

Plan:

`docs/PHASE_4_5C_PRODUCTION_FINANCIAL_SUMMARY_WARNINGS_UI_PLAN.md`

## Delivered

### Production orchestration

The Production page now uses:

```text
productionRequirementService.plan(...)
componentAwareProductCostService.costProduct(...)
plannedBatchCapacityFeasibilityService.assessBatch(...)
```

The independent UI call to `assemblyCapacityTraceService.trace(...)` was removed.

The existing Phase 3 capacity detail is now sourced from:

```text
batchFeasibility.capacityTrace
```

This keeps the current-capacity evidence shown in Phase 3 detail aligned with the exact trace retained by the completed Phase 4.4C batch-feasibility result.

### Phase 4 batch financial summary

The Production workspace now displays, directly from completed application results:

- requested quantity;
- physical planned production cost;
- expected revenue;
- expected profit;
- effective batch margin;
- planned average physical cost per finished unit;
- joined 4.4C readiness;
- 4.4B financial readiness.

Negative expected profit remains visibly negative.

Null/unresolved values remain unavailable rather than becoming fake zero.

### Capacity feasibility

The new Phase 4 section displays directly from 4.4C:

- `within-current-capacity`;
- `over-current-capacity`;
- `capacity-unresolved`;
- current authoritative assembly capacity when available;
- exact overage quantity when applicable.

The UI does not compare quantity against capacity to derive its own classification.

The requested quantity is never auto-clamped.

### Structured warnings

Every authoritative 4.4C warning is rendered with its application-provided message, including support for:

```text
OVER_CURRENT_CAPACITY
CAPACITY_UNRESOLVED
LIMITING_RESOURCE_EXPLANATION_INCOMPLETE
```

A fully known over-capacity request remains valid planning evidence; it is shown as a business warning rather than a data-readiness failure.

### Authoritative tied limiters

The Phase 4 financial section uses only:

```text
batchFeasibility.limitingResources
```

It supports all completed limiter types:

```text
material-requirement
material-backed-component
product-backed-component
```

Every tied resource is preserved. No UI-side winner selection occurs.

If 4.4C deliberately publishes an empty top-level limiter set because explanation evidence is partial, the Phase 4 section keeps it empty and relies on the structured incomplete-explanation warning. It does not reconstruct a misleading partial authoritative limiter set from nested Phase 3 trace candidates.

### Financial / feasibility readiness

The Phase 4 section exposes:

- 4.4C joined status/issues;
- 4.4B financial status/issues.

The existing Phase 3 issue section remains intact for direct-requirement, component-cost, availability, and capacity-trace detail.

### Phase 3 detail preservation

The Production workspace still exposes:

- direct material requirements;
- parent safety-waste quantities;
- on-hand normalized quantities;
- direct capacities;
- discrete component requirements;
- current component availability / ProductStock semantics;
- component capacities;
- Phase 3 limiting resources;
- component-aware input cost;
- Phase 3 readiness issues;
- recursive nested component cost trace.

The historical Phase 3 `plannedInputCost` diagnostic remains visibly separate from the authoritative Phase 4 `plannedProductionCost`.

## Presentation helpers

Added:

`src/ui/production/plannedBatchFinancialView.ts`

Presentation-only helpers cover:

- PHP formatting;
- percentage formatting;
- readiness labels;
- feasibility labels;
- typed authoritative limiter rows.

These helpers do not derive financial totals, profit, margin, capacity, overage, or limiter selection.

## UI component

Added:

`src/ui/production/ProductionFinancialSummary.tsx`

Styling is isolated in:

`src/ui/production/productionFinancial.css`

No frontend dependency was added.

## Tests

Added:

`src/ui/production/plannedBatchFinancialView.test.ts`

Dedicated coverage verifies:

- PHP zero and finite negative formatting;
- null/non-finite money remains unavailable;
- canonical decimal margin becomes a human percentage;
- null/non-finite margin remains unavailable;
- all feasibility labels;
- all readiness labels;
- direct Material limiter mapping;
- purchased Material-backed component limiter mapping;
- handmade Product-backed component limiter mapping;
- all tied limiters preserved;
- empty 4.4C top-level limiter set stays empty;
- authoritative non-reconciling/negative values are formatted rather than recomputed.

App smoke coverage now verifies the complete Phase 4 batch-financial shell while preserving the existing Phase 3 Production shell assertions.

## Validated implementation checkpoint

Implementation head:

`774ee8443833c12ceec7a0de34e0f6a9735ef15b`

CI:

`34968538373 — SUCCESS`

Validation:

```text
TypeScript typecheck passed
80 test files passed
979 tests passed
12 dedicated Phase 4.5C financial-view tests passed
15 existing component-aware Production view tests passed
33 PlannedBatchCapacityFeasibilityService tests passed
22 ExpectedBatchFinancialsService tests passed
30 PhysicalPlannedBatchProductionCostService tests passed
8 React workspace smoke tests passed
production Vite build passed
117 modules transformed
```

The production build continues to emit Vite's non-blocking warning that the main minified chunk exceeds 500 kB. The build succeeds; code splitting remains a performance optimization concern rather than a Phase 4.5C financial-correctness blocker.

## No contract changes

4.5C adds no application/domain/storage contract.

It does not implement:

- financial formulas;
- capacity formulas;
- stock reservation/deduction;
- production-order mutation;
- accounting posting;
- Excel/Tauri persistence;
- Phase 4.6 integration scenarios.

## Remaining gates

1. validate the documented feature head;
2. open implementation PR to `develop`;
3. require green PR CI;
4. merge with expected-head guard;
5. require exact post-merge `develop` CI success;
6. complete documentation-only closeout;
7. require exact final closeout `develop` CI success;
8. only then mark Phase 4.5 COMPLETE and advance to `4.6A — Integrated Pricing / Production Workflow — NEXT / NOT STARTED`.
