# Phase 4.1C — Financial Profile Repository & Application Services Development Plan

## Status

**PLANNED — IMPLEMENTATION NOT STARTED**

Authoritative base:

`develop` @ `5189a074a71fa77098179ab1f7c858d6d82ac047`

Starting exact `develop` CI:

`34934560619 — SUCCESS`

Feature branch:

`feature/phase-4-1c-financial-profile-repository-services`

Master plan:

`docs/PHASE_4_PRICING_PRODUCTION_PLANNING_PLAN.md`

## Objective

Establish the storage-agnostic application boundary for Product financial-profile source data created in 4.1A and hardened by the 4.1B pricing validation engine.

4.1C must provide:

- one Product financial profile per Product identity;
- storage-agnostic repository contract;
- in-memory repository implementation for the current application session;
- Product-reference validation;
- profile upsert/read/list application services;
- deterministic identity canonicalization and listing;
- defensive cloning, including nested pricing policy data;
- archived-Product profile preservation/editability;
- shared session wiring for future React use;
- no Excel/Tauri persistence.

## Split assessment

No deeper formal roadmap split is required.

4.1C is one cohesive repository/application-service task. Internal slices are:

1. repository interface;
2. in-memory product-keyed repository;
3. application service validation and canonicalization;
4. deterministic list/filter/search behavior;
5. shared session wiring;
6. focused tests and full regression validation.

The financial-profile editor belongs to 4.5A. Fully loaded Product cost belongs to 4.2. Readiness-aware pricing quote behavior belongs to 4.3.

## Existing architecture reviewed

### ProductFinancialProfile domain contract

`src/domain/productFinancialProfile.ts` already owns:

```text
ProductFinancialProfile
ProductFinancialProfileError
normalizeProductFinancialProfile()
validateProductFinancialProfileContract()
cloneProductFinancialProfile()
```

Authoritative source shape:

```ts
interface ProductFinancialProfile {
  productId: string;
  laborCostPerUnit: number;
  overheadCostPerUnit: number;
  pricingPolicy: PricingPolicy | null;
  notes?: string;
}
```

Missing profile and explicit zero-cost profile remain different states.

### Pricing validation

`src/domain/pricing.ts` now owns `validatePricingPolicy()`.

4.1C service writes must validate a configured pricing policy through the 4.1B engine rather than persisting policy values that are structurally typed but financially invalid.

`pricingPolicy: null` remains a valid explicit unconfigured state.

### Closest repository/service precedent

Phase 3 ProductStock provides the closest pattern:

```text
ProductStockRepository
InMemoryProductStockRepository
ProductStockService
```

Relevant semantics to preserve:

- case-insensitive Product-keyed identity;
- one record per Product identity through repository `upsert`;
- Product existence checked through `ProductRepository`;
- canonical Product ID restored from ProductRepository;
- archived Products remain addressable and their source record may be corrected;
- repository seed/write/read values are defensively cloned;
- service results are defensively cloned;
- deterministic list/filter/search behavior;
- no direct UI mutation of repository arrays.

### Shared session

`src/application/session.ts` currently exports singleton repositories/services for Product, ProductStock, components, costing, and production.

4.1C must add the financial-profile repository/service here so future React code receives an application-service boundary rather than mutating source arrays directly.

## Authoritative repository contract

Add:

```text
src/application/productFinancialProfiles/ProductFinancialProfileRepository.ts
```

Proposed contract:

```ts
interface ProductFinancialProfileRepository {
  list(): Promise<ProductFinancialProfile[]>;
  findByProductId(productId: string): Promise<ProductFinancialProfile | null>;
  upsert(profile: ProductFinancialProfile): Promise<void>;
}
```

### Identity semantics

Repository identity is the normalized Product ID key:

```text
trim + case-insensitive comparison
```

Therefore:

```text
candle-a
CANDLE-A
  Candle-A
```

all address the same profile identity.

The service must persist the canonical Product ID exactly as returned by `ProductRepository.findById()`.

### No delete contract

4.1C will not add a delete/reset operation.

Reason:

```text
missing profile = financial configuration unresolved
```

A delete convenience would deliberately recreate that unresolved state and needs its own product/UI semantics. The master plan does not require deletion.

Future phases may add an explicit reset/remove decision if justified.

## In-memory repository

Add:

```text
src/application/productFinancialProfiles/InMemoryProductFinancialProfileRepository.ts
```

Requirements:

- optional seed collection;
- case-insensitive Product identity map;
- seed values deep-cloned;
- upsert values deep-cloned;
- read/list values deep-cloned;
- nested `pricingPolicy` object never leaks mutable references;
- one map entry per Product identity.

The repository does not perform Product existence validation; that belongs to the application service.

## Application service

Add:

```text
src/application/productFinancialProfiles/ProductFinancialProfileService.ts
```

### Proposed write API

Use an explicit upsert-style boundary:

```ts
upsertProfile(profile: ProductFinancialProfile): Promise<ProductFinancialProfile>
```

A separate create/update distinction is not needed because the authoritative source invariant is one profile per Product and the established ProductStock precedent uses upsert replacement semantics.

### Write sequence

For each write:

1. normalize with `normalizeProductFinancialProfile()`;
2. validate 4.1A source contract with `validateProductFinancialProfileContract()`;
3. if `pricingPolicy !== null`, validate through `validatePricingPolicy()`;
4. resolve Product through `ProductRepository.findById()`;
5. reject missing Product reference;
6. canonicalize `productId` to the exact Product record ID;
7. normalize again if needed after canonicalization;
8. upsert to repository;
9. return a defensive clone.

### Application error

Introduce a typed application error for missing Product reference, equivalent in spirit to ProductStock:

```text
ProductFinancialProfileApplicationError
code: PRODUCT_NOT_FOUND
```

Domain/profile validation errors and 4.1B `PricingError` should propagate rather than be hidden behind a generic application error.

### Archived Product policy

An archived Product is still an existing Product identity.

Therefore:

- existing financial profile remains readable;
- profile may be corrected/updated after Product archival;
- archival does not delete the financial profile;
- service must not require `isActive === true` for writes.

This matches the historical-source behavior established by ProductStock and avoids erasing cost/pricing evidence when a Product is archived.

## Read/list API

Add:

```ts
getProfile(productId: string): Promise<ProductFinancialProfile | null>
listProfiles(filter?): Promise<ProductFinancialProfile[]>
```

Suggested list filter:

```ts
interface ProductFinancialProfileListFilter {
  productId?: string;
  query?: string;
}
```

Query search should cover source-facing fields useful before the UI exists:

- `productId`;
- `notes`;
- configured pricing method when present.

List ordering:

```text
productId localeCompare, case-insensitive
```

No Product display-name join is required in 4.1C; that is presentation/application-view work for later UI phases.

## Shared session wiring

Update:

```text
src/application/session.ts
```

Add singleton exports equivalent to:

```text
productFinancialProfileRepository
productFinancialProfileService
```

The service must share the existing `productRepository` instance so all source writes validate against the same Product session state.

No React page/component changes are part of 4.1C.

## Focused test matrix

### Repository

- seeded profile can be read;
- seed mutation after construction does not mutate repository state;
- upsert mutation after write does not mutate repository state;
- read mutation does not mutate repository state;
- list mutation does not mutate repository state;
- nested pricing-policy mutation is isolated;
- case-insensitive Product identity replaces instead of duplicating;
- list returns one record per Product identity.

### Service writes

- creates profile for existing Product;
- same Product identity upserts/replaces rather than duplicates;
- canonicalizes Product ID from `ProductRepository`;
- supports trimmed/case-insensitive Product lookup;
- explicit zero labor/overhead remains valid source data;
- `pricingPolicy: null` remains valid;
- configured valid pricing policy persists;
- 4.1A negative/non-finite labor/overhead errors propagate;
- 4.1B invalid pricing-policy value errors propagate;
- missing Product reference fails with `PRODUCT_NOT_FOUND`;
- archived Product profile remains readable and editable.

### Reads/lists

- missing profile returns `null`;
- deterministic list sorting;
- Product ID filter is case-insensitive/trim-aware;
- query matches Product ID;
- query matches notes;
- query matches configured pricing method;
- returned records are defensive clones.

### Session wiring

- shared session exposes financial-profile repository/service;
- service can save/read a profile against a Product created in the shared Product repository/service in the isolated test worker.

## Expected files

Likely source changes:

```text
src/application/productFinancialProfiles/ProductFinancialProfileRepository.ts
src/application/productFinancialProfiles/InMemoryProductFinancialProfileRepository.ts
src/application/productFinancialProfiles/ProductFinancialProfileService.ts
src/application/productFinancialProfiles/ProductFinancialProfileService.test.ts
src/application/session.ts
docs/PHASE_4_1C_FINANCIAL_PROFILE_REPOSITORY_SERVICES.md
docs/PHASE_4_1C_FINANCIAL_PROFILE_REPOSITORY_SERVICES_PLAN.md
```

A separate session wiring test may be added if it improves isolation and clarity.

No domain shape change should be necessary unless implementation exposes a genuine 4.1A defect.

## Explicit non-goals

4.1C does not implement:

- React financial-profile editor;
- fully loaded Product cost;
- safety-waste pricing-cost service;
- recursive Phase 4 child production cost;
- selling-price quote orchestration;
- production batch financials;
- capacity warning synthesis;
- delete/reset profile semantics;
- Excel persistence;
- Tauri integration;
- tax/VAT, discounts, marketplace fees, overhead allocation, payroll/timekeeping, or accounting posting.

## Implementation order

1. Create this plan before repository/service changes. ✅
2. Add repository interface.
3. Add defensive in-memory repository.
4. Add application service with Product-reference validation and canonicalization.
5. Apply 4.1A profile validation and 4.1B configured-policy validation on writes.
6. Add deterministic read/list/filter/search behavior.
7. Add shared session wiring.
8. Add focused tests.
9. Run full CI.
10. Create implementation record and advance plan to merge-gate-pending.
11. Require clean documented feature-head CI.
12. Verify diff against exact starting `develop`.
13. Open implementation PR to `develop`.
14. Require independent PR CI.
15. Merge with expected-head protection.
16. Require exact post-merge `develop` CI.
17. Create documentation-only closeout.
18. Mark 4.1C COMPLETE / 4.2A NEXT in `docs/PHASE_4_PROGRESS.md`.
19. Require closeout PR CI and exact final `develop` CI.

## Completion gate

4.1C is complete only when:

- one financial profile per Product identity is enforced by the repository key/upsert boundary;
- missing Product references are rejected;
- 4.1A profile validation is enforced on writes;
- configured pricing policy is validated by the 4.1B engine on writes;
- archived Product profiles remain readable/editable;
- repository/service reads and writes are defensively cloned;
- deterministic get/list/filter/search behavior is tested;
- the shared session exposes a Product financial-profile application-service boundary;
- no React code directly mutates repository/source arrays;
- focused tests, full tests, typecheck, and production build pass;
- implementation PR and exact post-merge `develop` CI pass;
- closeout PR and exact final `develop` CI pass.

## Next task after completion

**4.2A — Waste-Adjusted Direct-Material Unit Cost — NEXT / NOT STARTED**

Do not begin 4.2A until 4.1C is fully merged, closed out, and exact final `develop` CI is green.
