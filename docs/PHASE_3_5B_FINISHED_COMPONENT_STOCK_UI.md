# Phase 3.5B — Finished Component Stock UI

## Status

**IMPLEMENTATION COMPLETE — MERGE GATE PENDING**

Feature branch:

`feature/phase-3-5b-finished-component-stock-ui`

Authoritative implementation base:

`develop` @ `5f73f642ceff9ac5d7f8bf6691739da61cf62e04`

Development plan:

`docs/PHASE_3_5B_FINISHED_COMPONENT_STOCK_UI_PLAN.md`

## Implementation summary

Phase 3.5B adds a dedicated **Finished stock** view to the existing Products workspace so current finished `ProductStock` can be inspected and corrected for Product-backed child components.

The UI remains a thin client over the completed Phase 3.2 stock application boundary. Stock writes continue through `ProductStockService`, so React does not reimplement or bypass the authoritative whole-piece/non-negative/Product-identity rules.

No inventory transaction ledger, reservation, automatic deduction, or production-history behavior is introduced.

## Products workspace integration

Updated:

`src/ui/products/ProductsPage.tsx`

The Products workspace now exposes:

```text
Products
Mix presets
Components
Finished stock
```

The top-level heading now reflects Products, composition, and finished component stock while preserving the completed Product/Mix/Components views.

The Finished stock tab delegates to a dedicated child component:

`src/ui/products/ProductStockView.tsx`

## Finished stock row model

Added pure UI helper:

`src/ui/products/productStockRows.ts`

The helper derives deterministic presentation rows from:

- Product catalog source data;
- ProductComponent relationships;
- ProductStock source data.

A Product is represented when either:

1. it is currently referenced by a Product-backed component line; or
2. it already has a ProductStock record.

This means the UI can show:

- active child Products whose ProductStock is still missing;
- explicit zero stock;
- positive current stock;
- archived/historical stock;
- existing ProductStock that is no longer referenced by a current parent.

Products with neither current Product-backed child usage nor ProductStock are not shown because 3.5B is finished **component** stock, not a general finished-goods inventory module.

## Derived row contract

The helper exposes:

```text
ProductStockRow
- productId
- productName
- productCategory
- productIsActive
- stockState: missing | zero | available
- onHandQuantity: number | null
- notes?
- stockRecordExists
- usedAsChild
- parentProductIds[]
- parentProductNames[]
```

Rows are sorted deterministically by Product name then Product ID, case-insensitively.

Material-backed component lines do not create ProductStock rows.

Corrupted Product-backed relationships whose child Product no longer resolves do not create phantom editable rows; the ProductStock application service requires a real Product identity.

## Missing versus zero semantics

3.5B preserves the critical Phase 3.2 distinction:

```text
Missing ProductStock
- no source record exists
- derived quantity = null
- UI label = Missing stock data
- downstream availability remains unresolved

Explicit zero ProductStock
- source record exists
- onHandQuantity = 0
- UI label = 0 pc · Zero stock
- downstream availability is authoritative known zero

Positive ProductStock
- source record exists
- onHandQuantity > 0
- UI label = N pc on hand
```

The stock editor deliberately leaves the quantity input blank for a missing record rather than pre-filling `0`.

A blank submission is rejected in the UI with guidance to either leave the record missing or explicitly enter `0`.

Saving `0` creates/updates an actual ProductStock record and therefore converts missing availability into known zero availability intentionally.

## ProductStock editor

Added:

`src/ui/products/ProductStockView.tsx`

The editor supports:

- Product selection from the derived relevant Product set;
- current finished `pc` count;
- optional stock notes;
- setting first ProductStock record;
- correcting an existing ProductStock record;
- explicit missing-state guidance;
- success/error feedback.

Authoritative save path:

```text
productStockService.setStock(productId, quantity, notes)
```

The unit is fixed to `pc` and is never user-selectable.

The quantity input exposes:

```text
type=number
min=0
step=1
```

Domain/application validation still owns finite, integer, non-negative enforcement.

## Archived Product policy

Archived Products remain visible when they:

- are referenced by current/historical Product-backed composition source data; or
- already have ProductStock.

3.2B explicitly permits correction of archived Product stock, so the Finished stock editor also permits correction while clearly labeling the Product `Archived`.

This does not make an archived Product eligible for a new active parent relationship. Component relationship validation remains owned by the completed ProductComponent/availability services.

## Current parent usage context

Each stock row reports whether the Product is currently used as a Product-backed child.

When used, the row shows readable parent Product names such as:

```text
Used by Event Candle Set, Gift Box
```

Multiple relationships to the same parent are deduplicated in the presentation helper.

When an existing ProductStock record is no longer a current child dependency, the UI shows:

```text
Not currently used as a child component
```

This context is informational only and is not persisted.

## Search and filters

The stock list supports:

- free-text search over Product name, ID, notes, and readable parent names;
- Product status filter: all / active / archived;
- stock-state filter: all / missing / zero / available.

Filters are local UI derivation and do not add application-layer APIs.

## No delete/unset operation

3.5B does not introduce a ProductStock delete/reset-to-missing action.

This follows the established 3.2B repository/service contract, which intentionally has no delete operation because:

```text
missing ProductStock != explicit zero ProductStock
```

Any future “unset stock data” workflow would require a deliberate application/domain contract rather than silently deleting source data from React.

## Styling and responsive behavior

Updated:

`src/ui/products/products.css`

Added styles for:

- Finished stock editor/list split;
- search/status/stock-state filters;
- missing/known-stock callouts;
- selectable stock cards;
- missing/zero/available textual state pills;
- responsive single-column stacking.

The existing application design language is reused; no new CSS framework or component library is introduced.

The Products workspace switcher now wraps so four tabs remain usable on narrow screens.

## Tests

### Pure finished-stock row tests

Added:

`src/ui/products/productStockRows.test.ts`

Dedicated tests: **11**.

Coverage:

- current Product-backed child with missing ProductStock;
- explicit zero ProductStock;
- positive ProductStock;
- Material-backed component exclusion;
- parent relationship deduplication;
- archived Product visibility;
- existing historical ProductStock without current child usage;
- unrelated Product exclusion;
- deterministic Product name/ID ordering;
- note preservation;
- missing/corrupted Product child source does not create a phantom row.

### React smoke coverage

Updated:

`src/App.smoke.test.tsx`

React server-render coverage now verifies:

- Products workspace exposes `Finished stock`;
- revised Products heading;
- Finished stock editor shell;
- fixed `pc` stock semantics;
- initial SSR loading state;
- missing-vs-zero explanatory copy.

The React smoke suite now contains **7** tests.

No browser-testing dependency was added.

Existing `ProductStockService` and ProductStock domain suites remain authoritative for mutation validation and persistence semantics.

## Validation evidence

Corrected implementation head:

```text
d489987fb40d734cf05343346744b3afef0b87cf
```

CI:

```text
run 34924675552 — SUCCESS
53 test files passed
608 tests passed
11 dedicated productStockRows tests
7 React workspace smoke tests
TypeScript typecheck passed
production build passed
```

Two earlier feature-branch runs failed only on React SSR smoke-text/state expectations:

1. one stale Products heading assertion after adding the Finished stock tab;
2. one assertion that expected the post-effect empty state even though React static rendering correctly shows the initial loading state.

All new finished-stock helper tests and TypeScript typechecking were already passing during those runs. Both test expectations were corrected before this merge gate; no production behavior fix was required for those failures.

## Explicit deferrals

Not implemented in 3.5B:

- Product composition contract/service changes;
- component-aware Production estimate UI — Phase 3.5C;
- new component-aware cost/capacity calculations;
- stock transaction history;
- inventory movement ledger;
- reservations;
- automatic stock deduction;
- production completion posting;
- purchase receiving workflow;
- recursive manufacture of child Products;
- general finished-goods inventory outside Phase 3 ProductStock relevance;
- labor/overhead/selling price/profit — Phase 4;
- Excel persistence — Phase 5.

## Completion gate state

Implementation-side gates passed:

- Products workspace exposes a Finished stock view;
- current Product-backed child Products appear even when stock data is missing;
- existing ProductStock remains visible even when no longer a current child dependency;
- ProductStock can be set/updated through `ProductStockService`;
- missing stock remains distinct from explicit zero;
- whole-piece fixed-`pc` semantics are clear;
- archived Product stock remains visible and correctable;
- parent-usage context is readable;
- no delete/unset/transaction/reservation/deduction behavior was introduced;
- 11 focused stock-row tests pass;
- 53 full test files / 608 tests pass;
- TypeScript typecheck passes;
- production build passes.

Remaining before 3.5B can be marked fully complete:

- final documented feature-head CI must pass;
- implementation PR must pass its own CI and merge to `develop`;
- exact post-merge `develop` CI must pass;
- documentation-only closeout must mark 3.5B COMPLETE and advance 3.5C to NEXT / NOT STARTED.

## Next task after closeout

**3.5C — Component-Aware Production Estimate UI**

Do not begin 3.5C until 3.5B is formally closed and a dedicated 3.5C scope review/development plan is established.
