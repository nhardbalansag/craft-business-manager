# Phase 3.2A — Product Stock Contract & Validation

## Status

**COMPLETE**

Implementation PR: `#67`

Feature branch: `feature/phase-3-2a-product-stock-contract`

Authoritative implementation base:

`develop` @ `bb2441390b6d833efe567369473358f19f7efdba`

Implementation merge commit:

`afc9ec9cac417b6f47a319174166abc048e86b40`

Validation evidence:

- feature-head CI run `34912465333` — SUCCESS;
- PR CI run `34912541378` — SUCCESS;
- post-merge `develop` CI run `34912611385` — SUCCESS;
- TypeScript typecheck passed;
- complete regression tests passed;
- production build passed.

Development plan:

`docs/PHASE_3_2A_PRODUCT_STOCK_PLAN.md`

## Objective

Introduce authoritative current finished Product/component stock as pure source data before repository/application availability behavior is added in 3.2B/3.2C.

## Contract

Added `src/domain/productStock.ts`:

```text
ProductStock
- productId
- onHandQuantity
- notes?
```

The unit is implicitly `pc` and is intentionally absent as a mutable field.

## Validation rules

- Product ID must be non-blank;
- Product ID is normalized by trimming;
- blank notes normalize to omitted/undefined;
- on-hand quantity must be finite;
- on-hand quantity must be an integer;
- on-hand quantity must be non-negative;
- explicit zero stock is valid.

Typed domain errors:

```text
INVALID_PRODUCT_ID
NON_FINITE_ON_HAND_QUANTITY
NON_INTEGER_ON_HAND_QUANTITY
NEGATIVE_ON_HAND_QUANTITY
```

## Boundary decisions

3.2A intentionally does **not** resolve ProductRepository.

Product existence validation and one-stock-record-per-Product persistence enforcement require repository/application context and remain 3.2B responsibilities.

`BusinessDataset.productStocks` also remains 3.2B, matching the locked Phase 3 plan.

Archived Product stock lifecycle/availability semantics remain 3.2B/3.2C.

## Shared domain exports

`ProductStock` is exported through `src/domain/types.ts` so later application layers can consume the authoritative contract without introducing persistence now.

## Test coverage

Focused tests cover:

- explicit zero stock;
- positive whole-piece stock;
- Product ID normalization;
- notes normalization;
- blank-note omission;
- defensive cloning;
- blank Product ID rejection;
- fractional stock rejection;
- negative stock rejection;
- `NaN` rejection;
- positive infinity rejection;
- negative infinity rejection;
- typed error context.

## Validation correction found by CI

The first test-bearing CI surfaced a TypeScript assertion typing issue in the Vitest test code: generic `objectContaining<ProductStockError>` required inherited `Error` fields. The test assertions were corrected to partial asymmetric matches. No ProductStock domain rule changed as a result.

## Explicit deferrals

Not implemented in 3.2A:

- ProductStock repository/services;
- Product existence repository lookup;
- one-record-per-Product persistence enforcement;
- `BusinessDataset.productStocks`;
- availability resolver;
- stock reservations/deductions/transactions;
- production history;
- costing/capacity integration;
- UI;
- Excel persistence.

## Completion gate result

Passed:

- authoritative ProductStock source contract exists;
- stock unit remains implicit `pc`;
- zero stock is valid;
- fractional, negative, and non-finite quantities are rejected;
- Product identity is normalized and non-blank;
- repository/storage concerns remain outside the domain contract;
- focused tests and full regression suite pass;
- TypeScript typecheck passes;
- production build passes;
- implementation PR #67 merged to `develop`;
- exact post-merge `develop` CI run `34912611385` passed.

## Next task

**3.2B — Product Stock Repository & Services**
