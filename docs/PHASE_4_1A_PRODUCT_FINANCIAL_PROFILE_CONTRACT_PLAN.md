# Phase 4.1A — Product Financial Profile Contract Development Plan

## Status

**IMPLEMENTED — MERGE GATE PENDING**

Authoritative base:

`develop` @ `691651f15156c1258a6f1ef75b43d53b6836a426`

Starting exact `develop` CI:

`34931938705 — SUCCESS`

Feature branch:

`feature/phase-4-1a-product-financial-profile-contract`

Implementation record:

`docs/PHASE_4_1A_PRODUCT_FINANCIAL_PROFILE_CONTRACT.md`

Master plan:

`docs/PHASE_4_PRICING_PRODUCTION_PLANNING_PLAN.md`

## Objective

Establish the authoritative Phase 4 Product-level financial source contract without adding pricing formulas, repositories, application services, UI, persistence, or fully loaded costing.

The source contract provides:

- Product identity;
- explicit labor cost per finished unit;
- explicit overhead cost per finished unit;
- explicitly configured-or-unconfigured pricing policy;
- optional notes;
- safe cloning and normalization;
- future `BusinessDataset` inclusion.

## Split assessment

No deeper formal split is required.

4.1A remains one cohesive domain-contract task. Repository/Product-reference existence and uniqueness remain 4.1C. Pricing-policy numeric ranges, selling-price formulas, and economic diagnostics remain 4.1B.

## Delivered architecture

### Pricing source domain

Added `src/domain/pricing.ts` with:

```text
PRICING_METHODS
PricingMethod
PricingPolicy
isPricingMethod()
clonePricingPolicy()
```

Supported methods:

```text
profit-amount
markup-percent
margin-percent
```

`src/domain/types.ts` now compatibility-re-exports the pricing types so existing generic costing code remains source-compatible.

### ProductFinancialProfile

Added `src/domain/productFinancialProfile.ts`:

```ts
interface ProductFinancialProfile {
  productId: string;
  laborCostPerUnit: number;
  overheadCostPerUnit: number;
  pricingPolicy: PricingPolicy | null;
  notes?: string;
}
```

The Phase 2/3 `Product` contract remains unchanged.

### Missing versus explicit zero

```text
no profile
= financial configuration unresolved

profile { laborCostPerUnit: 0, overheadCostPerUnit: 0, ... }
= labor and overhead explicitly known as zero
```

`pricingPolicy: null` is the explicit unconfigured-pricing state.

No default profile is invented.

### 4.1A validation boundary

The profile contract rejects:

- blank Product ID;
- non-finite labor;
- negative labor;
- non-finite overhead;
- negative overhead;
- unsupported pricing-method identifier.

Explicit zero labor/overhead is valid.

Pricing policy numeric-value validation intentionally remains 4.1B, including:

- finite policy value;
- non-negative fixed profit;
- non-negative markup;
- `0 <= target margin < 1`;
- selling-price formulas;
- diagnostic ratios.

### Normalization and cloning

`normalizeProductFinancialProfile()`:

- trims Product ID;
- trims notes;
- omits blank notes;
- preserves monetary precision;
- preserves explicit null pricing policy;
- clones configured nested policy data.

`cloneProductFinancialProfile()` deep-clones the nested pricing policy when configured.

### BusinessDataset

`BusinessDataset` now includes:

```text
productFinancialProfiles: ProductFinancialProfile[]
```

This is source-shape preparation only; Excel/Tauri persistence is not implemented.

## Files changed

```text
docs/PHASE_4_1A_PRODUCT_FINANCIAL_PROFILE_CONTRACT_PLAN.md
src/domain/pricing.ts
src/domain/pricing.test.ts
src/domain/productFinancialProfile.ts
src/domain/productFinancialProfile.test.ts
src/domain/types.ts
docs/PHASE_4_1A_PRODUCT_FINANCIAL_PROFILE_CONTRACT.md
```

## Test coverage

Dedicated tests:

```text
src/domain/pricing.test.ts                  3 tests
src/domain/productFinancialProfile.test.ts 18 tests
```

Coverage includes:

- all supported pricing method identifiers;
- unsupported runtime pricing method;
- pricing-policy cloning;
- positive financial profile;
- explicit zero labor/overhead;
- explicit null pricing policy;
- blank Product identity;
- non-finite/negative labor;
- non-finite/negative overhead;
- normalization of IDs/notes;
- blank-note omission;
- deep nested-policy cloning;
- BusinessDataset financial-profile collection.

## Validation history

### Initial implementation CI

Head:

`87a83db3eb7cd52fa5783189582aea8df611350a`

CI:

`34932287493 — FAILED AT TYPECHECK`

The deliberate invalid-method test used a direct incompatible TypeScript assertion. The compiler correctly rejected that test fixture before runtime validation.

Correction:

- cast the corrupted runtime fixture through `unknown`;
- no production source change was required.

### Corrected implementation CI

Head:

`79c3f51f27b957721219a80a08078f603d7be214`

CI:

`34932357351 — SUCCESS`

Observed automated surface:

```text
57 test files passed
649 tests passed
18 ProductFinancialProfile tests
3 pricing source-type tests
7 React smoke tests
TypeScript typecheck passed
production Vite build passed
96 modules transformed
```

## Scope retained

4.1A does not implement:

- Product existence/reference lookup;
- one-profile-per-Product repository enforcement;
- profile repository/service/session wiring;
- pricing policy numeric-range validation;
- selling-price derivation;
- fully loaded Product cost;
- safety-waste-adjusted pricing cost;
- recursive Phase 4 child cost;
- planned batch financials;
- capacity warnings;
- React pricing UI;
- Excel/Tauri persistence.

## Remaining lifecycle

Completed:

1. dedicated plan before source changes ✅
2. pricing source-type domain ✅
3. ProductFinancialProfile contract ✅
4. BusinessDataset source collection ✅
5. focused tests ✅
6. corrected full branch CI ✅
7. implementation record ✅

Remaining:

8. clean documented feature-head CI;
9. scope compare against exact starting `develop`;
10. implementation PR to `develop`;
11. independent PR CI;
12. merge with expected-head protection;
13. exact post-merge `develop` CI;
14. documentation-only closeout;
15. mark 4.1A COMPLETE / 4.1B NEXT;
16. closeout PR CI and exact final `develop` CI.

## Completion gate

4.1A is complete only when all implementation and closeout gates pass and the repository tracker advances to:

```text
4.1A — Product Financial Profile Contract  COMPLETE
4.1B — Pricing Formula & Validation Engine NEXT
```

## Next task after completion

**4.1B — Pricing Formula & Validation Engine — NEXT / NOT STARTED**

Do not begin 4.1B until 4.1A is fully merged, closed out, and exact final `develop` CI is green.
