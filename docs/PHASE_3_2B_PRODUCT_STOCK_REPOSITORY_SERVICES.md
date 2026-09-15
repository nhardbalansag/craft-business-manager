# Phase 3.2B — Product Stock Repository & Services

## Status

**IMPLEMENTATION COMPLETE — MERGE GATE PENDING**

Feature branch: `feature/phase-3-2b-product-stock-services`

Authoritative implementation base:

`develop` @ `badef95776f8ef4ce23edfdcee84210802dbc71f`

Development plan:

`docs/PHASE_3_2B_PRODUCT_STOCK_REPOSITORY_SERVICES_PLAN.md`

Feature validation evidence:

- CI run `34913228450` — SUCCESS;
- 43 test files passed;
- 404 tests passed;
- TypeScript typecheck passed;
- production build passed.

## Objective

Add the repository/application boundary for authoritative current finished Product/component stock while preserving the source-data semantics established in 3.2A.

## Repository boundary

Added:

```text
src/application/productStocks/ProductStockRepository.ts
src/application/productStocks/InMemoryProductStockRepository.ts
```

Repository contract:

```text
list()
findByProductId(productId)
upsert(stock)
```

`productId` is the storage identity. The in-memory repository uses trimmed, case-insensitive Product identity keys and defensively clones seed, write, and read values.

No delete operation is exposed because missing ProductStock and explicit zero have different downstream availability semantics.

## Application service

Added:

```text
src/application/productStocks/ProductStockService.ts
```

Operations:

```text
setStock(productId, onHandQuantity, notes?)
setStockRecord(stock)
getStock(productId)
listStocks(filter?)
```

Writes perform:

1. 3.2A normalization;
2. 3.2A contract validation;
3. ProductRepository existence resolution;
4. canonical Product ID replacement using the actual Product record ID;
5. repository upsert;
6. defensive cloned return.

## One-record-per-Product policy

Repeated writes for the same normalized Product identity replace the existing ProductStock record rather than creating duplicates.

This provides the planned one-stock-record-per-Product baseline without adding a separate synthetic ProductStock ID.

## Product lifecycle policy

ProductStock may exist for active or archived Products.

Archived Product stock:

- remains inspectable;
- remains correctable through ProductStockService;
- is not deleted by Product archive operations.

Whether archived Product stock is eligible as a component source for active parent assembly remains 3.2C.

## Missing versus zero stock

The service preserves a critical distinction:

```text
missing ProductStock -> null
explicit zero stock -> ProductStock { onHandQuantity: 0 }
```

3.2C can therefore treat missing stock as unresolved data instead of silently converting it to zero.

## Filtering

`listStocks()` supports:

- exact Product ID filtering;
- free-text query over Product ID / notes;
- deterministic Product ID sorting.

Active-state availability filtering is intentionally deferred to 3.2C.

## BusinessDataset source data

`BusinessDataset` now includes:

```text
productStocks: ProductStock[]
```

This array contains authoritative source data only.

It does not store derived availability, production capacity, cost, reservations, deductions, or production history.

Excel persistence remains deferred to Phase 5.

## Shared application session

`src/application/session.ts` now exposes:

```text
productStockRepository
productStockService
```

The service shares the existing application-level `productRepository` so Product identity validation uses the same Product source as other application services.

## Error contract

Added application error:

```text
PRODUCT_NOT_FOUND
```

Existing 3.2A `ProductStockError` remains authoritative for malformed stock quantities/identity.

## Validation coverage

The dedicated 3.2B suite adds 10 tests covering:

- stock creation;
- same-Product upsert/replace behavior;
- canonical Product identity;
- trimmed/case-insensitive lookup;
- explicit zero versus missing stock;
- missing Product rejection;
- archived Product stock read/correction;
- list/filter/search/sort behavior;
- repository defensive cloning;
- service defensive cloning;
- 3.2A validation enforcement through service writes;
- Product archive preservation of ProductStock.

Feature-head validation passes:

```text
43 test files
404 tests
TypeScript typecheck
production build
```

CI run: `34913228450`.

## Explicit deferrals

Not implemented in 3.2B:

- component source availability resolver;
- active-source eligibility/readiness synthesis;
- reservations;
- automatic deductions;
- transaction ledger;
- production history;
- component-aware cost roll-up;
- component-limited assembly capacity;
- ProductStock UI;
- Excel persistence.

These remain 3.2C and later roadmap phases.

## Completion gate state

Feature-head gates passed:

- one stock record per Product identity through upsert behavior;
- writes validate Product existence;
- CRUD-equivalent set/get/list behavior works without React;
- missing stock remains distinct from explicit zero;
- archived Product stock is preserved;
- repository/service cloning is defensive;
- `BusinessDataset.productStocks` is source data;
- session wiring exists;
- storage technology remains outside domain/application logic;
- typecheck/tests/build are green.

Remaining before 3.2B may be marked fully complete:

- merge implementation PR to `develop`;
- verify exact post-merge `develop` CI is green.

## Next task after closeout

**3.2C — Component Source Availability & Relationship Guards**

Do not begin 3.2C until the 3.2B merge/post-merge gate is green.
