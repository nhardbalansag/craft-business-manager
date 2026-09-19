# Phase 3.2A — Product Stock Contract & Validation

## Status

**COMPLETE**

Implementation PR: `#67`

Feature branch: `feature/phase-3-2a-product-stock-contract`

Authoritative base:

`develop` @ `bb2441390b6d833efe567369473358f19f7efdba`

Implementation merge commit:

`afc9ec9cac417b6f47a319174166abc048e86b40`

Post-merge validation:

`develop` CI run `34912611385` — SUCCESS

Implementation record:

`docs/PHASE_3_2A_PRODUCT_STOCK_CONTRACT.md`

## Objective

Introduce the domain source contract for current finished Product/component stock without introducing repositories, stock transactions, automatic deductions, reservations, production history, or availability resolution yet.

This phase establishes only the authoritative shape and validation semantics required by later 3.2B/3.2C application layers.

## Split assessment

No deeper formal split was required.

3.2A was small and cohesive enough to implement as one task. Internally, work followed this order:

1. define the ProductStock source contract;
2. define normalization/cloning helpers;
3. define runtime validation and typed errors;
4. expose the contract through the shared domain type exports;
5. add focused unit tests;
6. run full repository regression/typecheck/build validation.

These were implementation steps, not new sub-phases.

## Authoritative contract

```text
ProductStock
- productId
- onHandQuantity
- notes?
```

Semantics:

- `productId` is the source identity and must be non-blank after trimming;
- `onHandQuantity` represents current finished units physically on hand;
- stock unit is implicitly `pc` and is never user-selectable;
- `onHandQuantity` must be finite;
- `onHandQuantity` must be an integer;
- `onHandQuantity` must be greater than or equal to zero;
- zero is valid and explicitly means known zero finished stock;
- blank notes normalize to omitted/undefined;
- stock is source data, not a value derived from raw-material capacity.

## Product identity boundary

3.2A validates Product identity only at the source-contract level:

- Product ID is required;
- Product ID is normalized by trimming.

Repository-backed existence validation belongs to 3.2B because the pure domain contract must not depend on ProductRepository.

The one-stock-record-per-Product rule is also enforced at the repository/application-service boundary in 3.2B rather than by a single isolated record validator.

## Archived Product policy

The source contract itself contains no active/archive flag.

Later application services must preserve ProductStock for an archived Product so historical stock remains inspectable. Archived Product stock must not become valid for new active parent dependencies.

That relationship behavior belongs to 3.2B/3.2C rather than this source-contract phase.

## Error contract

Implemented typed errors:

```text
INVALID_PRODUCT_ID
NON_FINITE_ON_HAND_QUANTITY
NON_INTEGER_ON_HAND_QUANTITY
NEGATIVE_ON_HAND_QUANTITY
```

Each error retains useful source context such as Product ID and offending input.

## Explicit deferrals

Not part of 3.2A:

- ProductStock repository;
- one-record-per-Product persistence enforcement;
- Product existence lookup through ProductRepository;
- set/update/list stock application services;
- BusinessDataset.productStocks;
- archived Product lifecycle/service rules;
- material/product component availability resolution;
- missing-stock versus explicit-zero availability semantics;
- stock reservations;
- automatic stock deductions;
- stock transaction ledger;
- production history;
- costing/capacity calculations;
- React UI;
- Excel persistence.

## Test coverage

Focused tests cover:

- valid zero stock;
- valid positive whole stock;
- Product ID normalization;
- notes normalization;
- defensive cloning;
- blank Product ID rejection;
- fractional stock rejection;
- negative stock rejection;
- `NaN` rejection;
- positive/negative infinity rejection;
- typed error context.

## Completion gate result

Passed:

- authoritative `ProductStock` source contract exists;
- unit semantics remain implicitly `pc`;
- zero stock is valid;
- fractional, negative, and non-finite quantities are rejected;
- Product identity is normalized and non-blank;
- no repository/storage concern leaks into the domain contract;
- focused tests and full regression tests pass;
- TypeScript typecheck passes;
- production build passes;
- implementation PR #67 merged to `develop`;
- exact post-merge `develop` CI run `34912611385` is green.

## Next task

**3.2B — Product Stock Repository & Services**

Do not begin 3.2B until its own dedicated development plan/scope review is established.
