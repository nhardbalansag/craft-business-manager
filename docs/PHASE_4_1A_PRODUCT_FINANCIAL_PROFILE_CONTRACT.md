# Phase 4.1A — Product Financial Profile Contract

## Status

**COMPLETE**

Authoritative starting base:

`develop` @ `691651f15156c1258a6f1ef75b43d53b6836a426`

Feature branch:

`feature/phase-4-1a-product-financial-profile-contract`

Development plan:

`docs/PHASE_4_1A_PRODUCT_FINANCIAL_PROFILE_CONTRACT_PLAN.md`

## Delivered

4.1A established the authoritative Phase 4 financial source contract without changing the Phase 2/3 Product contract.

### Pricing source domain

`src/domain/pricing.ts` now owns:

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

`src/domain/types.ts` compatibility-re-exports these types so existing generic costing code remains compatible.

### ProductFinancialProfile

`src/domain/productFinancialProfile.ts` defines:

```ts
interface ProductFinancialProfile {
  productId: string;
  laborCostPerUnit: number;
  overheadCostPerUnit: number;
  pricingPolicy: PricingPolicy | null;
  notes?: string;
}
```

Semantics:

- missing profile = financial configuration unresolved;
- profile with zero labor/overhead = those costs explicitly known as zero;
- `pricingPolicy: null` = pricing is explicitly not configured yet;
- derived selling price, total cost, revenue, and profit are not stored on this source record.

### Validation

The 4.1A contract rejects:

- blank Product identity;
- non-finite/negative labor cost;
- non-finite/negative overhead cost;
- unsupported pricing method identifiers.

Explicit zero labor/overhead is valid.

Pricing-policy numeric ranges and formulas remain 4.1B.

### Normalization / cloning

The contract:

- trims Product ID and notes;
- omits blank notes;
- preserves monetary precision;
- preserves explicit null pricing state;
- deep-clones configured pricing-policy source data.

### BusinessDataset

`BusinessDataset` now includes:

```text
productFinancialProfiles: ProductFinancialProfile[]
```

This defines future source persistence shape without implementing Phase 5 persistence.

## Focused coverage

```text
src/domain/productFinancialProfile.test.ts  18 tests
src/domain/pricing.test.ts                   3 tests
```

## Validation history

Initial feature CI:

```text
87a83db3eb7cd52fa5783189582aea8df611350a
34932287493 — FAILED AT TYPECHECK
```

The failure was a test-fixture assertion used to simulate an invalid runtime method. It was corrected by casting corrupted input through `unknown`; no production contract change was required.

Corrected implementation:

```text
79c3f51f27b957721219a80a08078f603d7be214
CI 34932357351 — SUCCESS
```

Final documented feature head:

```text
8162732a7bbee01e92ce952c8c5d83a8b0d8041a
CI 34932475789 — SUCCESS
```

Implementation PR:

```text
PR #96 — MERGED
PR CI 34932585076 — SUCCESS
```

Implementation merge:

```text
cd520f581d96dbd0a3ed48d88a95e9b22f881af0
Post-merge develop CI 34932640993 — SUCCESS
```

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

4.1A did not implement:

- profile repository/application service/session wiring — 4.1C;
- pricing numeric range/formula authority — 4.1B;
- fully loaded cost — 4.2;
- selling-price quote services — 4.3;
- planned batch financials/capacity financial warnings — 4.4;
- pricing UI — 4.5;
- Excel/Tauri persistence — Phase 5/6.

## Completion result

All implementation and post-merge technical gates passed.

The documentation closeout advances the roadmap to:

```text
4.1A — Product Financial Profile Contract  COMPLETE
4.1B — Pricing Formula & Validation Engine NEXT / NOT STARTED
```
