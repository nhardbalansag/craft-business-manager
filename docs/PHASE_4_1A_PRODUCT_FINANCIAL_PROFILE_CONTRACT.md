# Phase 4.1A — Product Financial Profile Contract

## Status

**IMPLEMENTED — MERGE GATE PENDING**

Authoritative base:

`develop` @ `691651f15156c1258a6f1ef75b43d53b6836a426`

Feature branch:

`feature/phase-4-1a-product-financial-profile-contract`

Development plan:

`docs/PHASE_4_1A_PRODUCT_FINANCIAL_PROFILE_CONTRACT_PLAN.md`

## Delivered contract

### Dedicated pricing source domain

Added:

`src/domain/pricing.ts`

It now owns:

```text
PRICING_METHODS
PricingMethod
PricingPolicy
isPricingMethod()
clonePricingPolicy()
```

Supported source methods remain:

```text
profit-amount
markup-percent
margin-percent
```

`src/domain/types.ts` re-exports `PricingMethod` and `PricingPolicy`, preserving compatibility for existing costing code while moving the Phase 4 concepts to their proper domain home.

4.1A intentionally does not validate numeric policy-value ranges or make the old selling-price helpers authoritative. That belongs to 4.1B.

### ProductFinancialProfile

Added:

`src/domain/productFinancialProfile.ts`

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

The financial profile remains separate from the Phase 2/3 `Product` record.

No pricing/labor/overhead fields were added to `Product`.

### Missing versus explicit zero

The contract preserves the master-plan evidence distinction:

```text
missing ProductFinancialProfile
= financial configuration unresolved

profile with labor=0 and overhead=0
= labor and overhead explicitly known as zero
```

`pricingPolicy: null` explicitly means that pricing policy is not configured yet while known cost adders may still exist.

### Validation

`validateProductFinancialProfileContract()` rejects:

- blank Product ID;
- non-finite labor cost;
- negative labor cost;
- non-finite overhead cost;
- negative overhead cost;
- unsupported pricing method identifiers when a pricing-policy object is present.

Explicit zero labor and overhead are valid.

Pricing policy numeric value/range validation remains intentionally deferred to 4.1B.

### Normalization and cloning

Added:

```text
normalizeProductFinancialProfile()
cloneProductFinancialProfile()
```

Normalization:

- trims Product ID;
- trims notes;
- omits blank notes;
- preserves monetary precision;
- preserves `pricingPolicy: null`;
- clones a configured nested pricing-policy object.

Cloning deep-clones the nested policy so repository/service layers added later cannot leak nested mutable source references.

### BusinessDataset

`BusinessDataset` now includes:

```text
productFinancialProfiles: ProductFinancialProfile[]
```

This establishes the future Phase 5 source-data persistence shape without implementing persistence.

## Focused tests

Added:

- `src/domain/pricing.test.ts` — 3 tests;
- `src/domain/productFinancialProfile.test.ts` — 18 tests.

Focused coverage includes:

- all supported pricing methods;
- unsupported pricing-method detection;
- pricing-policy cloning;
- valid configured profile;
- explicit zero labor/overhead;
- explicit null pricing policy;
- blank Product identity rejection;
- NaN/infinite/negative labor rejection;
- NaN/infinite/negative overhead rejection;
- runtime unsupported pricing-method rejection;
- Product ID/notes normalization;
- blank-notes omission;
- nested-policy deep cloning;
- `BusinessDataset.productFinancialProfiles` source shape.

## Validation evidence

### Initial branch CI

Head:

`87a83db3eb7cd52fa5783189582aea8df611350a`

CI:

`34932287493 — FAILED at typecheck`

Cause:

The runtime-corruption test directly cast an object containing the deliberately invalid method `retail-price` to `PricingPolicy`. TypeScript correctly rejected the incompatible direct assertion before tests ran.

This was a test-fixture typing issue, not a production-contract defect.

Correction:

The invalid runtime fixture now explicitly casts through `unknown`, accurately representing corrupted/imported runtime data that bypasses compile-time typing.

No production source change was required for the failure.

### Corrected implementation CI

Head:

`79c3f51f27b957721219a80a08078f603d7be214`

CI:

`34932357351 — SUCCESS`

Observed surface:

```text
57 test files passed
649 tests passed
18 ProductFinancialProfile contract tests
3 pricing source-type tests
7 React smoke tests
TypeScript typecheck passed
production Vite build passed
96 modules transformed
```

## Scope retained

4.1A did not add:

- Product repository/reference validation;
- one-profile-per-Product persistence enforcement;
- financial profile repository/service;
- session wiring;
- pricing policy numeric-value validation;
- selling-price formulas;
- fully loaded cost;
- safety-waste pricing-cost service;
- recursive Phase 4 child cost;
- batch financial planning;
- capacity warnings;
- React pricing UI;
- Excel/Tauri persistence.

Those remain assigned to later Phase 4/5/6 tasks.

## Merge gates remaining

1. Update the development plan to implementation-complete / merge-gate-pending.
2. Require a clean final documented feature-head CI.
3. Verify diff against exact starting `develop` is limited to 4.1A contract/tests/docs.
4. Open implementation PR to `develop`.
5. Require independent PR CI on unchanged expected head.
6. Merge with expected-head protection.
7. Require exact post-merge `develop` CI.
8. Create documentation-only closeout.
9. Mark 4.1A COMPLETE / 4.1B NEXT in `docs/PHASE_4_PROGRESS.md`.
10. Require closeout PR CI and exact final `develop` CI.

## Next task

**4.1B — Pricing Formula & Validation Engine — NOT STARTED**

Do not begin 4.1B until all 4.1A merge/closeout gates pass.
