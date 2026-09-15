# Phase 3.5B — Finished Component Stock UI Development Plan

## Status

**IN PROGRESS — PLAN ESTABLISHED BEFORE IMPLEMENTATION**

Authoritative base:

`develop` @ `5f73f642ceff9ac5d7f8bf6691739da61cf62e04`

Feature branch:

`feature/phase-3-5b-finished-component-stock-ui`

## Objective

Expose authoritative current `ProductStock` for Product-backed child components inside the existing Products workspace without adding inventory-ledger behavior.

The UI must support:

- a Product stock list/selector;
- current finished `pc` on hand;
- setting or correcting stock through `ProductStockService`;
- explicit distinction between missing stock and an explicit zero stock record;
- active/archived Product visibility;
- current child-component usage context;
- optional stock notes;
- no transaction history, reservation, deduction, or production-history behavior.

## Authoritative master-plan contract

Phase 3.5B requires:

- expose current `ProductStock` for Products used as child components;
- Product selector/list;
- current finished `pc` on hand;
- edit/set stock;
- explicit missing-vs-zero state;
- active/archive visibility;
- no transaction history yet.

## Split assessment

No deeper formal sub-phase is required.

3.5B remains one cohesive UI phase with internal implementation slices:

1. derive stock rows from Products, ProductComponents, and ProductStock;
2. integrate a Finished stock view into the Products workspace;
3. expose search/status/state filtering;
4. implement set/update stock form;
5. preserve missing-vs-zero semantics;
6. show active/archive and child-usage context;
7. add focused pure-helper tests and React smoke coverage;
8. run full regression/CI.

These are implementation steps, not separate roadmap phases.

## Existing architecture

### ProductStock domain

`src/domain/productStock.ts`

Authoritative source contract:

```text
ProductStock
- productId
- onHandQuantity
- notes?
```

Rules already enforced:

- Product ID required;
- on-hand quantity finite;
- on-hand quantity integer;
- on-hand quantity >= 0;
- unit is implicitly `pc` and is not user-selectable;
- blank notes normalize away.

### ProductStock application service

`src/application/productStocks/ProductStockService.ts`

Available operations:

```text
setStock(productId, onHandQuantity, notes?)
setStockRecord(stock)
getStock(productId)
listStocks(filter?)
```

Important existing semantics:

- writes validate that the Product exists;
- repeated writes upsert one record per Product identity;
- archived Product stock remains inspectable and correctable;
- missing ProductStock returns `null`;
- explicit zero remains a real `ProductStock` record with quantity `0`;
- service/repository results are defensively cloned.

### Product composition data

`ProductComponentService.listComponents()` already exposes all component relationships.

A Product-backed component is identified by:

```text
sourceType = product
sourceId = child Product ID
```

3.5B may use this source data to identify current child-component usage, but it must not mutate composition.

### Existing Products UI

`src/ui/products/ProductsPage.tsx`

Current tabs:

```text
Products
Mix presets
Components
```

3.5B should add one dedicated stock view rather than embedding stock editing inside the composition form.

Recommended fourth tab label:

```text
Finished stock
```

Recommended child component:

`src/ui/products/ProductStockView.tsx`

## Relevant Product set

The stock workspace should focus on Products that matter to finished-component stock while preserving historical records.

A Product is included when either:

1. it is referenced by at least one current Product-backed `ProductComponent`; or
2. it already has a `ProductStock` record.

This gives the UI both:

- current child components that may still have **missing** stock; and
- historical/archived or no-longer-referenced Products whose existing stock must remain inspectable/correctable.

Products with neither a Product-backed component relationship nor an existing stock record are outside this 3.5B stock list because the phase is specifically for finished component stock rather than a general finished-goods inventory system.

## Missing versus zero state

This distinction is mandatory and must be visible in both list and editor state.

```text
missing stock
- no ProductStock record exists
- onHandQuantity = null in the derived UI row
- status label: Missing stock data
- downstream availability remains unresolved

explicit zero
- ProductStock record exists
- onHandQuantity = 0
- status label: 0 pc / Zero stock
- this is authoritative known zero, not missing data

positive stock
- ProductStock record exists
- onHandQuantity > 0
- status label: N pc on hand
```

The UI must never coerce a missing ProductStock record to zero before the user explicitly saves zero.

## Derived stock-row helper

Add a pure UI helper so the missing/zero/relevance rules are deterministic and directly testable.

Recommended file:

`src/ui/products/productStockRows.ts`

Recommended derived row shape:

```text
ProductStockRow
- productId
- productName
- productCategory
- productIsActive
- stockState: missing | zero | available
- onHandQuantity: number | null
- notes?: string
- stockRecordExists: boolean
- usedAsChild: boolean
- parentProductIds[]
- parentProductNames[]
```

Input:

- Products;
- ProductComponents;
- ProductStocks.

Deterministic ordering:

1. Product name, case-insensitive;
2. Product ID, case-insensitive.

The helper is presentation-only and does not persist derived state.

## Missing Product/corrupted relationship policy

Normal application writes prevent Product-backed components from referencing missing Products.

For corrupted/imported historical data, the derived helper should not invent an editable Product row for a missing Product because `ProductStockService` cannot write stock without a real Product identity.

Such relationships may remain visible in the 3.5A composition preview; 3.5B stock editing is limited to Products that resolve in the Product catalog.

## Stock editor behavior

The stock view operates on one selected Product row at a time.

Recommended form state:

```text
selectedProductId
onHandQuantity
notes
```

When selection changes:

- existing stock -> prefill current quantity and notes;
- missing stock -> leave quantity blank rather than prefilling zero;
- clear success/error feedback.

Save maps directly to:

```text
productStockService.setStock(productId, Number(onHandQuantity), notes)
```

After save:

- reload ProductStock records;
- preserve selected Product when still present;
- show success/error feedback;
- explicit `0` input creates/updates a real zero stock record.

No delete/unset operation is introduced because repository/application semantics intentionally distinguish missing stock from explicit zero and expose no delete contract.

## Archived Product behavior

Archived Products with current child usage or an existing ProductStock record remain visible.

3.2B explicitly permits ProductStock correction for archived Products, so 3.5B should allow stock correction for archived Products while clearly labeling them archived.

This differs intentionally from 3.5A composition editing, where archived parent composition is read-only.

Stock editing does not make an archived Product eligible as a new active component source; 3.2C/3.1C relationship validation continues to own that rule.

## Current child-usage context

For each row, derive current Product-backed component usage:

- whether the Product is used as a child;
- count of distinct parent Products;
- readable parent Product names when available.

This is informational only.

Example:

```text
Mini Heart
Used by: Event Candle Set, Gift Box
Finished stock: 30 pc
```

If an existing ProductStock record is no longer referenced by any parent, show:

```text
Not currently used as a child component
```

This preserves historical stock visibility without pretending it is an active assembly dependency.

## Filtering/search

Provide lightweight UI filters without adding application-layer APIs:

### Search

Match:

- Product name;
- Product ID;
- ProductStock notes;
- parent Product name where useful.

### Product status

```text
active
archived
all
```

Default: `all` so archived stock remains visible.

### Stock state

```text
all
missing
zero
available
```

Default: `all`.

Do not add transaction-date/history filters because no transaction history exists.

## Unit presentation

ProductStock unit is always `pc`.

UI should display:

```text
N pc
```

The unit must not be user-editable or selectable.

## Error feedback

Save errors should display the actual `Error.message` using the existing Products workspace feedback style.

This preserves authoritative validation feedback for:

- blank/invalid Product identity where applicable;
- non-finite quantity;
- fractional quantity;
- negative quantity;
- missing Product identity.

The React layer should not duplicate the ProductStock validation contract.

## Styling

Extend:

`src/ui/products/products.css`

Reuse the existing Products visual system:

- workspace switcher;
- panels;
- filters;
- status pills;
- forms;
- empty states;
- feedback blocks;
- responsive stacking.

Recommended layout:

```text
left: selected Product stock editor
right: finished component stock list
```

On narrow screens, stack vertically.

The stock list may use cards or a table, but missing/zero/available state must be readable without relying only on color.

## Tests

### Pure stock-row helper tests

Add:

`src/ui/products/productStockRows.test.ts`

Cover at minimum:

- current child Product with missing ProductStock -> `missing` / null quantity;
- explicit zero ProductStock -> `zero` / quantity 0;
- positive ProductStock -> `available`;
- Product-backed component usage only; Material-backed components do not create Product stock rows;
- multiple parent relationships deduplicate parent identity;
- archived Product remains visible;
- existing ProductStock remains visible when no longer currently referenced;
- Product with neither component usage nor stock is excluded;
- deterministic ordering;
- notes preserved;
- missing/corrupted Product-backed source does not invent an editable Product row.

### React smoke coverage

Extend `src/App.smoke.test.tsx` so server rendering verifies:

- Products workspace exposes the `Finished stock` tab;
- stock editor shell renders with injected Product/component/stock data when feasible;
- `Current finished stock` / `pc` semantics render;
- explicit missing-stock copy renders;
- active/archive labeling renders.

No new browser-testing dependency is required for 3.5B.

Existing `ProductStockService` tests remain authoritative for mutation validation and missing-vs-zero persistence semantics.

## Expected implementation files

```text
src/ui/products/ProductsPage.tsx
src/ui/products/ProductStockView.tsx
src/ui/products/productStockRows.ts
src/ui/products/productStockRows.test.ts
src/ui/products/products.css
src/App.smoke.test.tsx
docs/PHASE_3_5B_FINISHED_COMPONENT_STOCK_UI.md
```

No domain or application source change is expected because `ProductStockService`, `ProductComponentService`, and shared session wiring already exist.

Any application/domain change discovered during implementation must be justified as strictly necessary for 3.5B UI support before being introduced.

## Explicit non-goals

3.5B does not implement:

- Product composition CRUD changes — 3.5A already complete;
- component-aware Production estimate UI — 3.5C;
- stock transaction history;
- stock movement ledger;
- reservations;
- automatic deduction after production/assembly;
- production batch completion posting;
- purchase receiving workflows;
- recursive manufacture of missing child Products;
- new cost/capacity calculations;
- labor/overhead/pricing/profit — Phase 4;
- Excel persistence — Phase 5;
- general finished-goods inventory beyond the Phase 3 ProductStock source.

## Completion gate

3.5B is complete only when:

- Products workspace exposes a Finished stock view;
- current Product-backed child Products are represented even when stock is missing;
- existing ProductStock remains inspectable even when historical/not currently referenced;
- selected Product stock can be set/updated through `ProductStockService`;
- missing stock remains visibly distinct from explicit zero;
- positive whole `pc` semantics are clear;
- archived Products remain visible and correctable;
- current parent-usage context is readable;
- no delete/unset/transaction/reservation/deduction behavior is introduced;
- focused stock-row/UI tests pass;
- full repository tests pass;
- TypeScript typecheck passes;
- production build passes;
- implementation PR passes CI and merges to `develop`;
- exact post-merge `develop` CI passes;
- documentation-only closeout marks 3.5B COMPLETE and advances 3.5C to NEXT / NOT STARTED.

## Next task after closeout

**3.5C — Component-Aware Production Estimate UI**

Do not begin 3.5C until 3.5B is merged, exact post-merge CI is green, 3.5B is formally closed, and a dedicated 3.5C scope review/development plan is established.
