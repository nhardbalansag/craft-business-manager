# Phase 3.2B — Product Stock Repository & Services Development Plan

## Status

**COMPLETE**

Authoritative implementation base:

`develop` @ `badef95776f8ef4ce23edfdcee84210802dbc71f`

Implementation PR: `#69`

Implementation merge commit:

`827217607ac53dc286c6f0e64110b5d93d8672fd`

## Objective

Add the storage-agnostic repository and application-service layer for the Phase 3.2A `ProductStock` contract so current finished Product/component stock can be explicitly set, retrieved, listed, and preserved independently of raw-material capacity.

## Split assessment

No deeper formal split was required.

3.2B remained a cohesive repository/application boundary covering:

1. `ProductStockRepository`;
2. defensive `InMemoryProductStockRepository` keyed by Product identity;
3. `ProductStockService` with Product existence validation and set/get/list behavior;
4. `BusinessDataset.productStocks` authoritative source data;
5. shared application-session wiring;
6. focused application/repository tests;
7. full typecheck/test/build validation;
8. PR and exact post-merge `develop` gates.

## Locked domain/application policy

### One record per Product

`productId` is the identity of a ProductStock record.

The repository exposes a single record per normalized Product identity and uses upsert semantics rather than duplicate stock rows.

Trimmed/case-insensitive Product identity is used for repository lookup consistency.

### Product existence

Before stock is created or replaced, `ProductStockService` resolves the Product through `ProductRepository`.

Missing Product identity is rejected with `PRODUCT_NOT_FOUND`.

The Product does not need to be active in 3.2B. Stock for archived Products remains legitimate source/history data and may remain inspectable or correctable.

Whether archived Product stock is eligible as a source for an active parent remains 3.2C.

### Current stock semantics

`ProductStock.onHandQuantity` remains current authoritative finished stock source data.

It is not derived from Phase 1 raw-material inventory, Phase 2 recipe capacity, hypothetical production capacity, or later component calculations.

`setStock()` creates a ProductStock record when missing and replaces the current record when one already exists.

Explicit zero remains distinct from a missing ProductStock record.

### Archive preservation

Product archive paths do not delete ProductStock.

3.2B adds no Product archive guard because stock is source/history data rather than a dependency constraint.

### Removal policy

No stock delete operation is exposed.

A missing record carries meaningful 3.2C semantics (unresolved availability), while explicit zero means known zero stock.

## Repository contract

```text
ProductStockRepository
- list()
- findByProductId(productId)
- upsert(stock)
```

Repository behavior is defensive, storage-agnostic, and independent of Excel/filesystem concepts.

## Application service

Implemented operations:

```text
setStock(productId, onHandQuantity, notes?)
setStockRecord(stock)
getStock(productId)
listStocks(filter?)
```

Writes normalize/validate through 3.2A, resolve Product existence, canonicalize Product identity, upsert the source record, and return a defensive clone.

## Filtering

Baseline filters implemented:

- exact Product ID;
- free-text Product ID / notes query.

Product active-state eligibility remains a 3.2C concern.

## BusinessDataset

Added:

```text
productStocks: ProductStock[]
```

This is authoritative source data only. Derived availability, capacity, cost, reservations, or production history are excluded.

Excel persistence remains Phase 5.

## Shared session wiring

Added:

```text
productStockRepository
productStockService
```

`ProductStockService` uses the shared `productRepository`.

## Validation result

- feature CI `34913228450` — SUCCESS;
- PR CI `34913387142` — SUCCESS;
- post-merge `develop` CI `34913435571` — SUCCESS;
- 43 test files passed;
- 404 tests passed;
- TypeScript typecheck passed;
- production build passed.

## Explicit deferrals

Not part of 3.2B:

- component source availability resolver;
- active-parent availability eligibility;
- Material/Product source readiness synthesis;
- reservations;
- automatic deductions;
- stock transaction ledger;
- production history;
- cost roll-up;
- assembly capacity;
- React stock UI;
- Excel persistence.

These remain 3.2C, 3.3+, 3.4+, 3.5, or Phase 5.

## Completion gate

All 3.2B gates are green.

## Next task

**3.2C — Component Source Availability & Relationship Guards**

Do not begin 3.2C until its dedicated development plan/scope review is established.
