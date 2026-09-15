# Phase 3.5B — Finished Component Stock UI Development Plan

## Status

**IMPLEMENTED — MERGE GATE PENDING**

Authoritative base:

`develop` @ `5f73f642ceff9ac5d7f8bf6691739da61cf62e04`

Feature branch:

`feature/phase-3-5b-finished-component-stock-ui`

Implementation record:

`docs/PHASE_3_5B_FINISHED_COMPONENT_STOCK_UI.md`

## Objective

Expose authoritative current `ProductStock` for Product-backed child components inside the Products workspace while preserving the completed Phase 3.2 stock semantics.

The UI supports:

- Product selector/list;
- current finished `pc` on hand;
- set/correct stock through `ProductStockService`;
- explicit missing-vs-zero state;
- active/archive visibility;
- current child-component parent usage;
- optional stock notes;
- no transaction history, reservation, deduction, or production-history behavior.

## Split assessment

No deeper formal sub-phase was required.

3.5B remained one cohesive UI phase implemented through:

1. deterministic finished-stock row derivation;
2. Products workspace integration;
3. stock set/update form;
4. missing/zero/available presentation;
5. archived/historical visibility;
6. search/status/state filtering;
7. focused helper and React smoke tests;
8. full regression/CI.

## Existing authoritative contracts reused

### ProductStock

`src/domain/productStock.ts`

The existing domain contract remains unchanged:

- Product identity required;
- quantity finite;
- quantity integer;
- quantity non-negative;
- unit implicitly `pc`;
- blank notes normalize away.

### ProductStockService

`src/application/productStocks/ProductStockService.ts`

3.5B writes exclusively through:

```text
productStockService.setStock(productId, onHandQuantity, notes?)
```

Existing semantics remain authoritative:

- Product must exist;
- one ProductStock record per Product identity through upsert;
- archived Product stock remains inspectable/correctable;
- missing ProductStock is `null`;
- explicit zero is a real record with quantity `0`;
- no delete operation exists.

No application/domain source changes were required for 3.5B.

## Implemented Products workspace structure

`src/ui/products/ProductsPage.tsx` now exposes:

```text
Products
Mix presets
Components
Finished stock
```

The Finished stock view is implemented in:

`src/ui/products/ProductStockView.tsx`

## Relevant Product set

The UI derives rows from the union of:

1. Products referenced by at least one Product-backed `ProductComponent`; and
2. Products that already have a `ProductStock` record.

Therefore:

- current child Products remain visible even if stock is missing;
- historical/no-longer-referenced stock remains inspectable;
- unrelated Products with neither child usage nor ProductStock are excluded.

A corrupted Product-backed relationship whose child Product cannot be resolved does not create a phantom editable stock row.

## Derived row helper

Implemented:

`src/ui/products/productStockRows.ts`

Derived row fields:

```text
productId
productName
productCategory
productIsActive
stockState: missing | zero | available
onHandQuantity: number | null
notes?
stockRecordExists
usedAsChild
parentProductIds[]
parentProductNames[]
```

Rows are presentation-only and deterministically sorted by Product name then Product ID.

Only Product-backed component lines create child-Product stock relevance. Material-backed lines do not.

## Missing versus zero

The UI preserves the locked distinction:

```text
missing
- no ProductStock source record
- onHandQuantity = null
- unresolved availability

zero
- ProductStock source record exists
- onHandQuantity = 0
- authoritative known zero

available
- ProductStock source record exists
- onHandQuantity > 0
```

A missing row leaves the stock input blank.

Blank submit is rejected rather than silently converted to zero.

The user must explicitly enter `0` to create an authoritative known-zero ProductStock record.

## Archived Product behavior

Archived relevant Products remain visible and their ProductStock remains correctable.

This is intentional and follows the completed 3.2B stock lifecycle contract.

Stock correction does not make an archived Product eligible as a new active component source; component relationship validation remains owned by the existing ProductComponent/availability services.

## Parent usage context

Rows show current Product-backed child usage and readable parent Product names.

Repeated relationships to the same parent are deduplicated for presentation.

Existing stock with no current child relationship is labelled as not currently used as a child component.

This is derived UI context only.

## Filters

Implemented local UI filters:

- free-text search across Product name/ID, notes, and parent Product names;
- Product status: all / active / archived;
- stock state: all / missing / zero / available.

No application query API was added.

## Unit and validation presentation

Finished ProductStock unit is fixed to `pc` and is not selectable.

The quantity control uses:

```text
type=number
min=0
step=1
```

Authoritative finite/integer/non-negative validation remains in ProductStock domain/application code.

Service/domain `Error.message` is surfaced through the existing feedback UI.

## No delete/unset behavior

3.5B intentionally adds no delete/reset-to-missing action.

The existing ProductStock repository/application boundary exposes no delete operation because missing stock and explicit zero have different meanings.

A future unset workflow would require its own deliberate source-data contract rather than a React-only deletion shortcut.

## Tests

### Pure helper

Added:

`src/ui/products/productStockRows.test.ts`

Dedicated tests: **11**.

Coverage includes:

- missing current child stock;
- explicit zero;
- positive available stock;
- Material-backed line exclusion;
- parent identity deduplication;
- archived Product visibility;
- historical/no-longer-referenced stock visibility;
- unrelated Product exclusion;
- deterministic ordering;
- note preservation;
- corrupted missing child Product source suppression.

### React smoke

Updated:

`src/App.smoke.test.tsx`

Smoke suite now contains **7** tests and verifies:

- `Finished stock` workspace tab;
- revised Products heading;
- stock editor shell;
- fixed `pc` semantics;
- SSR loading state;
- explicit missing-vs-zero guidance.

No browser-testing dependency was added.

## Validation evidence

Corrected implementation head:

`d489987fb40d734cf05343346744b3afef0b87cf`

CI:

```text
34924675552 — SUCCESS
53 test files passed
608 tests passed
11 dedicated productStockRows tests
7 React workspace smoke tests
TypeScript typecheck passed
production build passed
```

Two earlier intermediate branch runs failed only on stale/static-render smoke expectations:

- old Products heading after Finished stock was added;
- post-effect empty-state text expected during server static rendering, which correctly renders the initial loading state.

The expectations were corrected before the merge gate. No ProductStock production-logic fix was required for those failures.

## Explicit non-goals retained

3.5B does not implement:

- changes to Product composition contracts/services;
- component-aware Production estimate UI — 3.5C;
- new cost/capacity math;
- stock transaction history or movement ledger;
- reservations;
- automatic deduction;
- production completion posting;
- purchase receiving;
- recursive child manufacturing;
- general finished-goods inventory outside Phase 3 ProductStock relevance;
- labor/overhead/pricing/profit — Phase 4;
- Excel persistence — Phase 5.

## Merge/closeout gates remaining

Implementation-side gates are satisfied. Before 3.5B is marked COMPLETE:

- final documented feature-head CI must pass;
- implementation PR must pass independent PR CI;
- implementation PR must merge to `develop`;
- exact implementation merge `develop` CI must pass;
- documentation-only closeout must mark 3.5B COMPLETE;
- closeout must advance 3.5C to NEXT / NOT STARTED;
- exact final closeout `develop` CI must pass.

## Next task after closeout

**3.5C — Component-Aware Production Estimate UI**

Do not begin 3.5C until 3.5B is fully merged/closed and a dedicated 3.5C development plan/scope review is established.
