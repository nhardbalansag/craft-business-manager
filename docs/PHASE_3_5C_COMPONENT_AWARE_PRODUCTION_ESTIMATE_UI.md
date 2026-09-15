# Phase 3.5C — Component-Aware Production Estimate UI

## Status

**COMPLETE**

Feature branch:

`feature/phase-3-5c-component-aware-production-ui`

Authoritative implementation base:

`develop` @ `0a0a93e5b2d241e05575c1414200aa55a1636542`

Implementation PR:

`#89 — Phase 3.5C — Component-Aware Production Estimate UI`

Implementation merge:

`1f2c5ee8a286104cfe0ac10a8b2fe8e414e92340`

Development plan:

`docs/PHASE_3_5C_COMPONENT_AWARE_PRODUCTION_ESTIMATE_UI_PLAN.md`

## Delivered

Phase 3.5C upgrades Production from the Phase 2 direct-material-only estimate into the Phase 3 component-aware current assembly estimate.

Production now loads the authoritative derived views in parallel:

```text
ProductionRequirementService
ComponentAwareProductCostService
AssemblyCapacityTraceService
```

No new domain/application calculation engine was introduced.

### Direct materials — make the parent

Production explicitly separates parent-making consumables under:

```text
DIRECT MATERIALS · MAKE THE PARENT
Direct materials to prepare
```

This section preserves Phase 2 recipe/yield/safety-waste quantities, direct inventory/capacity evidence, and direct price evidence.

Valid component-only Products receive neutral no-direct-material wording rather than misleading yield guidance.

### Discrete components — assemble the parent

Production separately exposes:

```text
DISCRETE COMPONENTS · ASSEMBLE THE PARENT
Components to prepare
```

Rows show:

- Material-backed or Product-backed source identity;
- role;
- whole-piece quantity per parent;
- planned whole-piece quantity;
- current availability;
- missing ProductStock versus explicit zero;
- authoritative per-component capacity;
- unit/component cost evidence;
- planned component contribution;
- capacity/cost readiness and issues.

Planned component quantity is presentation-only:

```text
quantityPerParent × planned finished pieces
```

Parent safety waste is not applied to discrete component counts.

### Overall assembly capacity and limiters

The summary uses `AssemblyCapacityTraceService` for:

- final direct + component assembly capacity;
- ready/partial/not-ready state;
- every typed tied limiting resource.

Typed limiter kinds remain:

```text
material-requirement
material-backed-component
product-backed-component
```

All ties are displayed. Partial/not-ready results never invent final limiter identity.

The planned-quantity warning now compares against overall current assembly capacity rather than direct-material capacity only.

### Component-aware cost and nested paths

Production shows:

- parent direct-material subtotal;
- root component subtotal;
- component-aware total/known partial subtotal;
- planned known input cost;
- recursive Product/component cost paths;
- nested readiness/issues.

ProductStock/current component availability does not change cost mathematics.

Labor, overhead, markup, margin, selling price, and profit remain outside Phase 3.

## Presentation helper

Added:

`src/ui/production/componentAwareProductionView.ts`

It performs presentation transformations only:

- joins root component cost and capacity evidence;
- scales planned component counts;
- preserves missing versus zero stock state;
- preserves exact upstream `capacityPieces`;
- resolves readable source names deterministically;
- flattens the existing recursive 3.3B cost tree for display;
- guards malformed circular display data;
- maps all authoritative typed limiters;
- aggregates/deduplicates readiness messages.

It does not recompute authoritative cost, availability, per-component capacity, overall capacity, or limiter selection.

## UI and styling

Updated:

- `src/ui/production/ProductionPage.tsx`
- `src/ui/production/production.css`
- `src/App.smoke.test.tsx`

The Production screen now contains Phase 3 summary cards, separate direct/component input panels, typed limiter cards, component-aware cost/readiness, and nested cost-path presentation.

No new UI framework was introduced.

## Tests

Added:

`src/ui/production/componentAwareProductionView.test.ts`

Dedicated tests: **15**.

Coverage includes Material/Product component joins, planned counts, no component waste inflation, missing/zero ProductStock, exact upstream capacity preservation, deterministic naming/order, nested paths, circular display-data guard, typed limiter ties, partial readiness evidence, and issue deduplication.

React smoke suite remains **7 tests** and now verifies the component-aware Production shell.

## Validation evidence

```text
Implementation CI          34928129692 — SUCCESS
Final feature-head CI      34928305658 — SUCCESS
PR #89 CI                  34928439683 — SUCCESS
Implementation merge       1f2c5ee8a286104cfe0ac10a8b2fe8e414e92340
Post-merge develop CI      34928507669 — SUCCESS

54 test files passed
623 tests passed
15 dedicated 3.5C presentation-helper tests
7 React workspace smoke tests
TypeScript typecheck passed
production build passed
```

## Scope retained

3.5C did not add:

- ProductComponent domain changes;
- ProductStock editing from Production;
- stock reservations/deductions/transactions;
- production completion posting;
- recursive manufacture of missing child stock;
- new cost/capacity formulas;
- component-specific safety waste;
- persisted derived Production estimates;
- Phase 4 pricing/profit;
- Phase 5 Excel persistence.

## Completion gate

All 3.5C implementation and merge gates passed.

The documentation-only closeout marks:

```text
3.5C — COMPLETE
Phase 3.5 — COMPLETE
3.6A — NEXT / NOT STARTED
```

## Next task

**3.6A — Integrated Multi-Component Workflow — NEXT / NOT STARTED**

Do not begin 3.6A until a dedicated development plan/scope review is established.
