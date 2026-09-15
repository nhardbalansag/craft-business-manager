# Phase 4.1C — Financial Profile Repository & Application Services Development Plan

## Status

**IMPLEMENTED — MERGE GATE PENDING**

Authoritative base:

`develop` @ `5189a074a71fa77098179ab1f7c858d6d82ac047`

Starting exact `develop` CI:

`34934560619 — SUCCESS`

Feature branch:

`feature/phase-4-1c-financial-profile-repository-services`

Implementation record:

`docs/PHASE_4_1C_FINANCIAL_PROFILE_REPOSITORY_SERVICES.md`

Master plan:

`docs/PHASE_4_PRICING_PRODUCTION_PLANNING_PLAN.md`

## Objective

Establish the storage-agnostic application boundary for Product financial-profile source data created in 4.1A and hardened by the 4.1B pricing validation engine.

Delivered scope:

- one Product financial profile per Product identity;
- storage-agnostic repository contract;
- defensive in-memory repository;
- Product-reference validation;
- profile upsert/read/list application services;
- deterministic identity canonicalization/filter/search/listing;
- defensive cloning, including nested pricing policy data;
- archived-Product profile preservation/editability;
- shared session wiring;
- no Excel/Tauri persistence.

## Split assessment

No deeper formal roadmap split was required.

4.1C remained one cohesive repository/application-service task. The financial-profile editor stays in 4.5A, fully loaded Product cost stays in 4.2, and readiness-aware pricing quote orchestration stays in 4.3.

## Delivered architecture

### Repository boundary

Added:

```text
src/application/productFinancialProfiles/ProductFinancialProfileRepository.ts
src/application/productFinancialProfiles/InMemoryProductFinancialProfileRepository.ts
```

Contract:

```ts
interface ProductFinancialProfileRepository {
  list(): Promise<ProductFinancialProfile[]>;
  findByProductId(productId: string): Promise<ProductFinancialProfile | null>;
  upsert(profile: ProductFinancialProfile): Promise<void>;
}
```

Identity uses trimmed, case-insensitive Product IDs. The in-memory repository deep-clones seed/write/read/list values, including nested pricing policies.

No delete/reset operation was added because a missing profile is authoritative unresolved evidence rather than equivalent to an explicit zero profile.

### Application service

Added:

`src/application/productFinancialProfiles/ProductFinancialProfileService.ts`

Public API:

```text
upsertProfile(profile)
getProfile(productId)
listProfiles(filter?)
```

Write sequence:

1. normalize via `normalizeProductFinancialProfile()`;
2. enforce `validateProductFinancialProfileContract()` from 4.1A;
3. validate configured `pricingPolicy` through 4.1B `validatePricingPolicy()`;
4. resolve Product via `ProductRepository.findById()`;
5. reject missing Product with typed `PRODUCT_NOT_FOUND` application error;
6. canonicalize `productId` to the exact repository Product identity;
7. upsert the normalized profile;
8. return a defensive clone.

Domain/profile and pricing validation errors propagate unchanged.

### Archived Products

Archived Products remain existing identities, so their financial profiles stay readable and editable/correctable. Product archival does not delete the profile.

### Missing versus explicit zero

The implementation preserves:

```text
missing profile
= unresolved financial configuration

profile with laborCostPerUnit = 0 and overheadCostPerUnit = 0
= explicit known zero adders
```

`pricingPolicy: null` remains an explicit valid unconfigured-pricing state.

### Deterministic list behavior

`listProfiles()` supports:

```text
productId filter
query search
```

Query searches Product ID, notes, and configured pricing method. Product IDs compare trimmed/case-insensitively. Results sort deterministically by Product ID.

### Shared session

Updated `src/application/session.ts` with:

```text
productFinancialProfileRepository
productFinancialProfileService
```

The service shares the existing `productRepository`, giving future React work an application-service write boundary without direct source-array mutation.

## Files changed

```text
docs/PHASE_4_1C_FINANCIAL_PROFILE_REPOSITORY_SERVICES_PLAN.md
docs/PHASE_4_1C_FINANCIAL_PROFILE_REPOSITORY_SERVICES.md
src/application/productFinancialProfiles/ProductFinancialProfileRepository.ts
src/application/productFinancialProfiles/InMemoryProductFinancialProfileRepository.ts
src/application/productFinancialProfiles/ProductFinancialProfileService.ts
src/application/productFinancialProfiles/ProductFinancialProfileService.test.ts
src/application/productFinancialProfiles/ProductFinancialProfileSession.test.ts
src/application/session.ts
```

## Test coverage

Focused new tests:

```text
ProductFinancialProfileService.test.ts          16 tests
ProductFinancialProfileSession.test.ts           1 test
```

Coverage includes:

- one-profile-per-Product upsert identity;
- canonical Product identity and trimmed/case-insensitive lookup;
- explicit zero versus missing profile;
- null and configured pricing policies;
- missing Product rejection;
- archived Product read/edit behavior;
- 4.1A profile validation propagation;
- 4.1B pricing validation propagation;
- notes normalization;
- deterministic list/filter/search/sort;
- repository seed/write/read/list cloning;
- nested pricing-policy cloning;
- service result cloning;
- shared session wiring.

## Validation evidence

Implementation head:

`29be0d69fcfc81867704a6d3b8878b923facb285`

Implementation CI:

`34935572837 — SUCCESS`

Observed automated surface:

```text
59 test files passed
715 tests passed
16 ProductFinancialProfile repository/service tests
1 shared-session wiring test
50 pricing engine tests
18 ProductFinancialProfile domain tests
7 React smoke tests
TypeScript typecheck passed
production Vite build passed
100 modules transformed
```

No implementation CI failure occurred.

## Scope retained

4.1C did not implement:

- React financial-profile editor;
- fully loaded Product unit cost;
- safety-waste pricing direct cost;
- recursive Phase 4 child production cost;
- readiness-aware pricing quote service;
- batch financial planning;
- capacity warning synthesis;
- delete/reset profile semantics;
- Excel/Tauri persistence;
- tax/VAT, discounts, marketplace fees, overhead allocation, payroll/timekeeping, or accounting posting.

## Lifecycle state

Completed:

1. dedicated development plan before code ✅
2. repository interface ✅
3. defensive in-memory repository ✅
4. application service and Product-reference validation ✅
5. 4.1A + 4.1B write validation ✅
6. deterministic get/list/filter/search ✅
7. shared session wiring ✅
8. focused tests ✅
9. full implementation CI ✅
10. implementation record ✅

Remaining:

11. clean documented feature-head CI;
12. scope compare against exact starting `develop`;
13. implementation PR to `develop`;
14. independent PR CI;
15. merge with expected-head protection;
16. exact post-merge `develop` CI;
17. documentation-only closeout;
18. mark 4.1C COMPLETE / 4.2A NEXT;
19. closeout PR CI and exact final `develop` CI.

## Completion gate

4.1C is complete only when all implementation and closeout gates pass and the tracker advances to:

```text
4.1C — Profile Repository & Application Services    COMPLETE
4.2A — Waste-Adjusted Direct-Material Unit Cost     NEXT
```

## Next task after completion

**4.2A — Waste-Adjusted Direct-Material Unit Cost — NEXT / NOT STARTED**

Do not begin 4.2A until 4.1C is fully merged, closed out, and exact final `develop` CI is green.
