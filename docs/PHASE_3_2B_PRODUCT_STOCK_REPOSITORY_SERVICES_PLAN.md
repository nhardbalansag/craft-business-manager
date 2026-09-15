# Phase 3.2B — Product Stock Repository & Services Development Plan

## Status

**PLANNED — IMPLEMENTATION NOT STARTED**

Authoritative base:

`develop` @ `badef95776f8ef4ce23edfdcee84210802dbc71f`

## Objective

Add the storage-agnostic repository and application-service layer for the Phase 3.2A `ProductStock` contract so current finished Product/component stock can be explicitly set, retrieved, listed, and preserved independently of raw-material capacity.

## Split assessment

No deeper formal split is required.

3.2B is a cohesive repository/application boundary. Implementation should proceed in this order:

1. add `ProductStockRepository`;
2. add defensive `InMemoryProductStockRepository` keyed by Product identity;
3. add `ProductStockService` with Product existence validation and set/update/get/list behavior;
4. add `BusinessDataset.productStocks` as authoritative source data;
5. wire repository/service into `application/session.ts`;
6. add focused application/repository tests;
7. run full typecheck/test/build validation;
8. merge only after PR and exact post-merge `develop` CI are green.

These are implementation steps, not additional sub-phases.

## Locked domain/application policy

### One record per Product

`productId` is the identity of a ProductStock record.

The repository exposes a single record for a Product identity. Application operations use upsert semantics rather than creating duplicate stock rows.

Trimmed/case-insensitive Product identity is used for repository lookup consistency with the existing application architecture.

### Product existence

Before stock is created or replaced, the service resolves the Product through `ProductRepository`.

Missing Product identity is rejected with a typed application error.

The Product does **not** need to be active in 3.2B. Stock for archived Products remains legitimate source/history data and may remain inspectable or correctable.

Whether archived Product stock is eligible as a source for an active parent belongs to **3.2C**.

### Current stock semantics

`ProductStock.onHandQuantity` remains current authoritative finished stock source data.

It is not derived from:

- Phase 1 raw-material inventory;
- Phase 2 recipe capacity;
- hypothetical production capacity;
- component cost/capacity calculations.

`setStock()` creates the ProductStock record when missing and replaces the current record when one already exists.

Explicit zero remains distinct from a missing ProductStock record.

### Archive preservation

No Product archive path deletes ProductStock.

3.2B does not add a Product archive guard because stock is historical/current source data rather than a dependency constraint. Existing stock simply remains in the ProductStock repository after the Product becomes archived.

### Removal policy

The locked Phase 3 plan requires set/update/retrieve/list operations but does not require ProductStock deletion.

3.2B therefore does **not expose a stock delete operation**. A missing record carries meaningful semantics for 3.2C (unresolved availability), while explicit zero means known zero stock.

## Repository contract

```text
ProductStockRepository
- list()
- findByProductId(productId)
- upsert(stock)
```

Repository requirements:

- defensive cloning on input and output;
- one stored record per normalized Product identity;
- storage-agnostic interface;
- no Excel/filesystem concerns.

## Application service

Operations:

```text
setStock(productId, onHandQuantity, notes?)
setStockRecord(stock)
getStock(productId)
listStocks(filter?)
```

All writes must:

1. normalize using the 3.2A contract;
2. validate the 3.2A contract;
3. resolve the referenced Product;
4. persist by Product identity through repository upsert;
5. return a defensive clone.

## Filtering

Baseline useful filters:

- exact Product ID;
- free-text query over Product ID / notes.

Product active-state availability filtering is not required here because source eligibility is a 3.2C concern.

## BusinessDataset

Add authoritative source data:

```text
productStocks: ProductStock[]
```

No derived availability, capacity, costing, reservations, or production history is stored in this array.

Excel persistence remains Phase 5.

## Shared session wiring

Add shared application-session instances:

```text
productStockRepository
productStockService
```

`ProductStockService` depends on the existing shared `productRepository`.

## Application error contract

Typed application error:

```text
PRODUCT_NOT_FOUND
```

3.2A `ProductStockError` remains authoritative for malformed ProductStock records/quantities.

## Test plan

Focused tests cover:

- set stock creates a record;
- set stock replaces the same Product record rather than duplicating it;
- case-insensitive/trimmed Product identity lookup;
- explicit zero is persisted and retrievable;
- missing stock returns `null`, distinguishable from zero;
- missing Product rejection;
- archived Product stock can be read/preserved and may be corrected;
- list/filter/search behavior;
- repository defensive cloning;
- service defensive cloning;
- 3.2A validation remains enforced through the service;
- no Product archive operation deletes ProductStock.

## Explicit deferrals

Not part of 3.2B:

- component source availability resolver;
- active-parent availability eligibility;
- Material/Product source readiness synthesis;
- stock reservations;
- automatic deductions;
- stock transaction ledger;
- production history;
- cost roll-up;
- assembly capacity;
- React stock UI;
- Excel persistence.

These remain 3.2C, 3.3+, 3.4+, 3.5, or Phase 5 according to the roadmap.

## Completion gate

3.2B is complete only when:

- one ProductStock record per Product identity is enforced by repository/upsert behavior;
- all stock writes validate Product existence;
- set/update/get/list behavior is testable without React;
- missing stock remains distinguishable from explicit zero;
- archived Product stock is preserved;
- repository/service cloning is defensive;
- `BusinessDataset.productStocks` is authoritative source data;
- shared application-session wiring exists;
- storage implementation does not leak into domain/application logic;
- focused tests pass;
- full repository tests pass;
- TypeScript typecheck passes;
- production build passes;
- implementation PR merges to `develop`;
- exact post-merge `develop` CI is green.

## Next task after closeout

**3.2C — Component Source Availability & Relationship Guards**

Do not begin 3.2C until 3.2B is merged and exact post-merge `develop` CI is green.
