# Phase 3.5B — Finished Component Stock UI Development Plan

## Status

**COMPLETE**

Authoritative implementation base:

`develop` @ `5f73f642ceff9ac5d7f8bf6691739da61cf62e04`

Feature branch:

`feature/phase-3-5b-finished-component-stock-ui`

Implementation PR:

`#87`

Implementation merge:

`c542021c60e1e276782fc484db7aa84ad0ac3952`

Implementation record:

`docs/PHASE_3_5B_FINISHED_COMPONENT_STOCK_UI.md`

## Objective achieved

Phase 3.5B exposes authoritative current ProductStock for Product-backed child components in the Products workspace without adding inventory-ledger behavior.

Delivered:

- Product selector/list;
- current finished `pc` on hand;
- set/correct stock through ProductStockService;
- explicit missing-vs-zero state;
- active/archive visibility;
- current parent-usage context;
- optional stock notes;
- search/status/stock-state filtering.

No deeper formal split was required.

## Locked implementation decisions

### Relevant Product set

Rows are the union of:

1. Products currently referenced by Product-backed ProductComponent lines; and
2. Products that already have ProductStock.

This keeps missing current dependencies visible while preserving historical stock records.

### Missing versus zero

```text
missing = no ProductStock record, quantity null
zero    = ProductStock record exists, quantity 0
available = ProductStock record exists, quantity > 0
```

Missing is never silently converted to zero. Users must explicitly save `0` to create known-zero stock.

### Archived Products

Relevant archived Products remain visible and ProductStock remains correctable, matching the completed 3.2B lifecycle contract.

### Source-of-truth boundary

All writes use:

`ProductStockService.setStock(...)`

No ProductStock domain/application source contract changed.

### Delete/unset policy

No delete/reset-to-missing action was added because the existing service/repository exposes no delete contract and missing stock is semantically different from explicit zero.

## Implemented files

```text
src/ui/products/ProductsPage.tsx
src/ui/products/ProductStockView.tsx
src/ui/products/productStockRows.ts
src/ui/products/productStockRows.test.ts
src/ui/products/products.css
src/App.smoke.test.tsx
docs/PHASE_3_5B_FINISHED_COMPONENT_STOCK_UI.md
docs/PHASE_3_5B_FINISHED_COMPONENT_STOCK_UI_PLAN.md
```

No application/domain source files changed.

## Test evidence

Focused stock-row tests: **11**.

React smoke tests: **7**.

Full repository state:

```text
53 test files
608 tests
TypeScript typecheck PASS
production build PASS
```

Validation chain:

```text
Corrected implementation CI 34924675552 — SUCCESS
Final feature-head CI        34924830981 — SUCCESS
PR #87 CI                    34924911146 — SUCCESS
Implementation merge         c542021c60e1e276782fc484db7aa84ad0ac3952
Post-merge develop CI        34924968637 — SUCCESS
```

Two intermediate feature runs failed only on stale React static-render expectations. Those assertions were corrected before the successful feature/PR/merge gates; no production stock logic change was needed for them.

## Explicit non-goals retained

3.5B did not implement:

- component-aware Production estimate UI — 3.5C;
- stock transaction history or movement ledger;
- reservations;
- automatic deductions;
- production completion posting;
- purchase receiving;
- recursive child manufacturing;
- general finished-goods inventory beyond the Phase 3 ProductStock relevance set;
- new cost/capacity math;
- labor/overhead/pricing/profit — Phase 4;
- Excel persistence — Phase 5.

## Completion gate

All gates passed:

- dedicated plan established before implementation;
- scope retained;
- focused tests green;
- full regression green;
- typecheck green;
- build green;
- implementation PR #87 CI green;
- PR #87 merged to develop;
- exact post-merge develop CI green.

Phase 3.5B is **COMPLETE**.

## Next task

**3.5C — Component-Aware Production Estimate UI — NEXT / NOT STARTED**

Do not begin 3.5C until a dedicated development plan/scope review is established.
