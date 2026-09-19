# Phase 3.5B — Finished Component Stock UI

## Status

**COMPLETE**

Implementation branch:

`feature/phase-3-5b-finished-component-stock-ui`

Implementation base:

`develop` @ `5f73f642ceff9ac5d7f8bf6691739da61cf62e04`

Implementation PR:

`#87 — Phase 3.5B — Finished Component Stock UI`

Implementation merge:

`c542021c60e1e276782fc484db7aa84ad0ac3952`

Development plan:

`docs/PHASE_3_5B_FINISHED_COMPONENT_STOCK_UI_PLAN.md`

## Delivered

Phase 3.5B adds a dedicated **Finished stock** view to the Products workspace for inspecting and correcting authoritative current `ProductStock` used by Product-backed child components.

The Products workspace now exposes:

```text
Products
Mix presets
Components
Finished stock
```

All stock writes continue through:

```text
ProductStockService.setStock(...)
```

No ProductStock domain/application source contract was changed.

## Relevant Product rows

The UI derives stock rows from the union of:

1. Products currently referenced by Product-backed ProductComponent lines; and
2. Products that already have ProductStock.

This preserves both current assembly dependencies and historical/no-longer-referenced stock records.

Products with neither Product-backed child usage nor ProductStock are not shown because 3.5B is finished **component** stock rather than a general finished-goods inventory module.

## Missing versus zero

The UI preserves the authoritative distinction:

```text
missing
- no ProductStock record
- quantity = null
- unresolved availability

zero
- ProductStock record exists
- quantity = 0
- authoritative known zero

available
- ProductStock record exists
- quantity > 0
```

Missing rows do not prefill `0`.

A blank save is rejected rather than silently converted to zero. The user must explicitly save `0` to create a known-zero ProductStock record.

## Stock editor

Implemented in:

`src/ui/products/ProductStockView.tsx`

Supports:

- relevant Product selection;
- whole-piece current stock input;
- fixed `pc` unit;
- optional notes;
- first-time stock set;
- existing stock correction;
- active/archive visibility;
- success/error feedback;
- current parent-usage context;
- search/status/stock-state filtering.

Archived Product stock remains correctable, matching the completed Phase 3.2B lifecycle contract.

## Derived row helper

Implemented:

`src/ui/products/productStockRows.ts`

Rows preserve:

- Product identity/name/category/status;
- missing/zero/available state;
- nullable current quantity;
- notes;
- whether a stock record exists;
- whether the Product is currently used as a child;
- deduplicated parent Product identities/names.

Material-backed component lines do not create ProductStock rows.

Missing/corrupted Product-backed source identities do not create phantom editable rows.

Rows are deterministically sorted by Product name then Product ID.

## No delete/unset or ledger behavior

3.5B intentionally introduces no:

- ProductStock delete/reset-to-missing operation;
- stock transaction history;
- movement ledger;
- reservation;
- automatic deduction;
- production completion posting;
- purchase receiving flow.

The existing stock application contract has no delete operation because missing ProductStock and explicit zero have different semantics.

## Tests

Added:

`src/ui/products/productStockRows.test.ts`

Dedicated tests: **11**.

Coverage includes:

- missing current child stock;
- explicit zero;
- positive stock;
- Material component exclusion;
- parent deduplication;
- archived visibility;
- historical stock visibility;
- unrelated Product exclusion;
- deterministic ordering;
- note preservation;
- missing child Product suppression.

React server-render smoke suite now contains **7** tests and covers the Finished stock tab/editor/fixed-`pc` semantics and missing-vs-zero guidance.

## Validation evidence

```text
Corrected implementation head
  d489987fb40d734cf05343346744b3afef0b87cf
  CI 34924675552 — SUCCESS

Final documented feature head
  bdcc5b097e47e910919e63910591f88dc245df96
  CI 34924830981 — SUCCESS

Implementation PR #87
  head bdcc5b097e47e910919e63910591f88dc245df96
  PR CI 34924911146 — SUCCESS

Implementation merge
  c542021c60e1e276782fc484db7aa84ad0ac3952
  post-merge develop CI 34924968637 — SUCCESS

53 test files passed
608 tests passed
11 dedicated productStockRows tests
7 React workspace smoke tests
TypeScript typecheck passed
production build passed
```

Two intermediate feature runs failed only on stale/static-render smoke expectations. No ProductStock production logic fix was required; both expectations were corrected before the successful merge gates.

## Completion gates

All Phase 3.5B implementation and merge gates passed:

- Finished stock view exists;
- current Product-backed child Products appear even when stock is missing;
- historical ProductStock remains inspectable;
- stock set/update uses ProductStockService;
- missing remains distinct from explicit zero;
- fixed whole-piece `pc` semantics are clear;
- archived Product stock remains visible/correctable;
- parent-usage context is readable;
- no transaction/reservation/deduction/delete behavior leaked into scope;
- focused and full tests pass;
- typecheck passes;
- build passes;
- PR #87 merged;
- exact implementation merge CI passes.

Phase 3.5B is therefore complete.

## Explicit deferrals

Still deferred:

- component-aware Production estimate UI — Phase 3.5C;
- stock transactions/reservations/deductions;
- new cost/capacity math;
- recursive child manufacturing;
- pricing/labor/overhead/profit — Phase 4;
- Excel persistence — Phase 5.

## Next task

**3.5C — Component-Aware Production Estimate UI — NEXT / NOT STARTED**

Do not begin 3.5C until a dedicated development plan/scope review is established.
