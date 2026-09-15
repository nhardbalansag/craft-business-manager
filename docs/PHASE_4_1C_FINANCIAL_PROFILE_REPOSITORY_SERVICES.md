# Phase 4.1C — Financial Profile Repository & Application Services

## Status

**IMPLEMENTED — MERGE GATE PENDING**

Authoritative base:

`develop` @ `5189a074a71fa77098179ab1f7c858d6d82ac047`

Feature branch:

`feature/phase-4-1c-financial-profile-repository-services`

Development plan:

`docs/PHASE_4_1C_FINANCIAL_PROFILE_REPOSITORY_SERVICES_PLAN.md`

## Delivered repository boundary

Added:

```text
src/application/productFinancialProfiles/ProductFinancialProfileRepository.ts
src/application/productFinancialProfiles/InMemoryProductFinancialProfileRepository.ts
```

Repository contract:

```ts
interface ProductFinancialProfileRepository {
  list(): Promise<ProductFinancialProfile[]>;
  findByProductId(productId: string): Promise<ProductFinancialProfile | null>;
  upsert(profile: ProductFinancialProfile): Promise<void>;
}
```

The in-memory repository uses a trimmed, case-insensitive Product identity key. One map entry therefore represents one Product financial profile identity.

Seed values, writes, individual reads, lists, and nested pricing-policy objects are defensively cloned.

No delete/reset contract was added. Missing profile remains a meaningful unresolved configuration state.

## Delivered application service

Added:

`src/application/productFinancialProfiles/ProductFinancialProfileService.ts`

Public boundary:

```text
upsertProfile(profile)
getProfile(productId)
listProfiles(filter?)
```

### Write validation sequence

`upsertProfile()`:

1. normalizes through `normalizeProductFinancialProfile()`;
2. enforces the Phase 4.1A profile source contract;
3. validates any configured pricing policy through the Phase 4.1B `validatePricingPolicy()` engine;
4. resolves the Product through `ProductRepository`;
5. rejects missing Product references with typed `PRODUCT_NOT_FOUND` application error;
6. canonicalizes `productId` to the exact Product repository identity;
7. upserts the normalized source record;
8. returns a defensive deep clone.

Profile-domain and pricing-domain validation errors intentionally propagate rather than being converted into generic application errors.

### Archived Product semantics

An archived Product remains a valid existing Product identity.

Therefore financial profiles remain:

- readable after archival;
- editable/correctable after archival;
- preserved rather than deleted by Product archival.

This matches the historical source-record behavior already established by ProductStock.

### Missing versus explicit zero

The service preserves the Phase 4 evidence distinction:

```text
missing profile
= unresolved financial configuration

profile with labor=0 and overhead=0
= explicit known zero adders
```

`pricingPolicy: null` remains an explicit valid unconfigured-pricing state.

## Deterministic reads and listing

`listProfiles()` supports:

```text
productId filter
query search
```

Product ID matching is trimmed/case-insensitive.

Query searches:

- Product ID;
- notes;
- configured pricing method.

Results sort deterministically by Product ID using case-insensitive locale comparison.

No Product display-name join was introduced because that belongs to later UI/view work.

## Shared application session

Updated:

`src/application/session.ts`

Added shared singleton exports:

```text
productFinancialProfileRepository
productFinancialProfileService
```

The service uses the existing shared `productRepository`, so all future financial-profile writes validate against the same Product session state.

No React component directly mutates financial-profile source arrays/repository state.

## Focused tests

Added:

```text
src/application/productFinancialProfiles/ProductFinancialProfileService.test.ts
src/application/productFinancialProfiles/ProductFinancialProfileSession.test.ts
```

Coverage includes:

- one-profile-per-Product upsert identity;
- Product ID canonicalization;
- trimmed/case-insensitive Product lookup;
- explicit zero labor/overhead;
- missing profile versus explicit-zero profile;
- null pricing policy;
- valid configured pricing policy;
- missing Product rejection;
- archived Product read/correction;
- Phase 4.1A source validation propagation;
- Phase 4.1B pricing validation propagation;
- notes normalization;
- deterministic list/filter/search/sort;
- Product ID search;
- repository defensive cloning for seed/write/read/list;
- nested pricing-policy cloning;
- service defensive cloning;
- case-insensitive seeded repository identity;
- shared session wiring.

## Validation evidence

Implementation head:

`29be0d69fcfc81867704a6d3b8878b923facb285`

CI:

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

4.1C did not add:

- financial-profile React UI;
- fully loaded Product unit cost;
- waste-adjusted pricing direct cost;
- recursive Phase 4 child cost;
- pricing quote/readiness orchestration;
- physical planned batch financials;
- capacity warning synthesis;
- profile delete/reset semantics;
- Excel persistence;
- Tauri integration;
- tax/VAT, discounts, marketplace fees, payroll/timekeeping, global overhead allocation, or accounting posting.

## Merge gates remaining

1. Update development plan to implementation-complete / merge-gate-pending.
2. Require clean final documented feature-head CI.
3. Verify diff against exact starting `develop` is limited to 4.1C repository/service/tests/session/docs.
4. Open implementation PR to `develop`.
5. Require independent PR CI on unchanged expected head.
6. Merge with expected-head protection.
7. Require exact post-merge `develop` CI.
8. Create documentation-only closeout.
9. Mark 4.1C COMPLETE / 4.2A NEXT in `docs/PHASE_4_PROGRESS.md`.
10. Require closeout PR CI and exact final `develop` CI.

## Next task

**4.2A — Waste-Adjusted Direct-Material Unit Cost — NOT STARTED**

Do not begin 4.2A until all 4.1C merge/closeout gates pass.
