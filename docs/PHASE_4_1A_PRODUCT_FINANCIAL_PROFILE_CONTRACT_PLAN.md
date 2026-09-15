# Phase 4.1A — Product Financial Profile Contract Development Plan

## Status

**COMPLETE**

Authoritative starting base:

`develop` @ `691651f15156c1258a6f1ef75b43d53b6836a426`

Starting exact `develop` CI:

`34931938705 — SUCCESS`

Feature branch:

`feature/phase-4-1a-product-financial-profile-contract`

Implementation record:

`docs/PHASE_4_1A_PRODUCT_FINANCIAL_PROFILE_CONTRACT.md`

## Objective

Establish the Phase 4 Product-level financial source contract while keeping Product recipe/composition identity clean and deferring repositories, formulas, fully loaded cost, UI, and persistence to their assigned later phases.

## Split assessment

No deeper formal split was required.

4.1A remained one cohesive domain-contract task:

1. dedicated pricing source types;
2. ProductFinancialProfile source contract;
3. clone/normalize/validation helpers;
4. BusinessDataset financial-profile collection;
5. focused contract tests.

Product reference/uniqueness enforcement remains 4.1C. Pricing-policy numeric validation/formulas remain 4.1B.

## Delivered source contract

```ts
interface ProductFinancialProfile {
  productId: string;
  laborCostPerUnit: number;
  overheadCostPerUnit: number;
  pricingPolicy: PricingPolicy | null;
  notes?: string;
}
```

Locked semantics:

- missing profile is unresolved financial configuration;
- explicit zero labor/overhead is known zero;
- `pricingPolicy: null` is explicit unconfigured pricing;
- Product itself receives no financial fields;
- monetary values retain full precision;
- blank source IDs are invalid;
- negative/non-finite labor or overhead is invalid;
- unsupported pricing method identifiers are invalid;
- pricing policy value ranges remain 4.1B authority.

## Delivered pricing source module

`src/domain/pricing.ts` owns:

```text
PRICING_METHODS
PricingMethod
PricingPolicy
isPricingMethod()
clonePricingPolicy()
```

`src/domain/types.ts` retains compatibility re-exports.

## Dataset preparation

`BusinessDataset` now includes:

```text
productFinancialProfiles: ProductFinancialProfile[]
```

No Excel/Tauri persistence was added.

## Test surface

```text
18 ProductFinancialProfile tests
3 pricing source-type tests
```

Coverage includes valid profiles, explicit zero values, null policy, invalid identity/money/method input, normalization, nested deep cloning, and BusinessDataset inclusion.

## Validation evidence

Initial test-fixture type failure:

```text
Head 87a83db3eb7cd52fa5783189582aea8df611350a
CI 34932287493 — FAILED AT TYPECHECK
```

Cause: deliberate invalid pricing method used a direct incompatible TypeScript assertion. The fixture was corrected to simulate corrupted runtime data through `unknown`; production code was unchanged.

Corrected implementation:

```text
Head 79c3f51f27b957721219a80a08078f603d7be214
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

Final observed implementation surface:

```text
57 test files passed
649 tests passed
7 React smoke tests
TypeScript typecheck passed
production Vite build passed
```

## Completion gate

Satisfied:

- dedicated Product financial profile exists ✅
- pricing source types have dedicated Phase 4 domain home ✅
- explicit zero versus missing semantics are clear ✅
- negative/non-finite labor and overhead fail validation ✅
- Product contract remains unchanged ✅
- BusinessDataset includes financial-profile source collection ✅
- 4.1B formula authority remains deferred ✅
- feature CI / final head CI / PR CI / post-merge develop CI all green ✅

Closeout advances the tracker to:

```text
4.1A — Product Financial Profile Contract  COMPLETE
4.1B — Pricing Formula & Validation Engine NEXT
```

## Next task

**4.1B — Pricing Formula & Validation Engine — NEXT / NOT STARTED**

Do not begin 4.1B until the documentation-only closeout PR and exact final `develop` CI are green.
