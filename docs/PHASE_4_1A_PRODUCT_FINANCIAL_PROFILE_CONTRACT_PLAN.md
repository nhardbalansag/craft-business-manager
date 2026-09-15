# Phase 4.1A — Product Financial Profile Contract Development Plan

## Status

**PLANNED — IMPLEMENTATION NOT STARTED**

Authoritative base:

`develop` @ `691651f15156c1258a6f1ef75b43d53b6836a426`

Starting exact `develop` CI:

`34931938705 — SUCCESS`

Feature branch:

`feature/phase-4-1a-product-financial-profile-contract`

Master plan:

`docs/PHASE_4_PRICING_PRODUCTION_PLANNING_PLAN.md`

## Objective

Establish the authoritative Phase 4 source contract for Product-level financial configuration without introducing pricing formulas, repositories, application services, UI, persistence, or fully loaded cost calculations.

4.1A defines the source evidence later Phase 4 work will consume:

- Product identity;
- explicit labor cost per finished unit;
- explicit overhead cost per finished unit;
- independently optional/unconfigured pricing policy;
- optional notes;
- cloning/normalization/validation behavior;
- future `BusinessDataset` inclusion.

## Split assessment

No deeper formal roadmap split is required.

4.1A is one cohesive domain-contract task. Internal implementation slices are:

1. dedicated pricing-policy source types and compatibility export;
2. ProductFinancialProfile source contract;
3. normalization/cloning helpers;
4. pure financial-profile validation;
5. `BusinessDataset` financial-profile collection;
6. focused domain regression tests.

Repository/Product-reference existence and uniqueness belong to **4.1C**. Pricing-policy numeric business rules and selling-price formulas belong to **4.1B**.

## Existing architecture reviewed

### Product source contract

`src/domain/products.ts` owns Product identity/category/mix/safety-waste/notes/active state.

Phase 4 must not add labor, overhead, or pricing fields to this Product contract.

### ProductStock contract pattern

`src/domain/productStock.ts` demonstrates the desired source-record pattern:

- small product-keyed source record;
- clone helper;
- normalization helper;
- pure contract validation;
- Product repository existence deferred to application/repository phase.

4.1A should follow this pattern where appropriate.

### ProductComponent contract pattern

`src/domain/productComponents.ts` demonstrates:

- exported literal-value arrays and inferred union types;
- runtime type guards;
- typed domain error codes/context;
- source normalization separated from repository/reference rules.

### Existing pricing scaffold

`src/domain/types.ts` currently contains:

```text
PricingMethod = profit-amount | markup-percent | margin-percent
PricingPolicy { method, value }
```

`src/domain/costing.ts` consumes `PricingPolicy`.

Those types are Phase 4 concepts and should move to a dedicated pricing-domain module, while `types.ts` should retain compatibility re-exports so existing code/tests do not break merely because the type has a better home.

The existing pricing formulas themselves are not made authoritative by 4.1A; formula/range hardening remains 4.1B.

## Authoritative source model

Introduce:

```ts
interface ProductFinancialProfile {
  productId: string;
  laborCostPerUnit: number;
  overheadCostPerUnit: number;
  pricingPolicy: PricingPolicy | null;
  notes?: string;
}
```

### Product identity

`productId` is required source identity.

4.1A validates only that it is non-blank after trimming.

Whether the Product actually exists, whether only one profile may exist for a Product, and archive/reference behavior belong to 4.1C.

### Labor cost

`laborCostPerUnit`:

- PHP monetary amount per finished unit;
- finite;
- `>= 0`;
- explicit zero is valid and meaningful.

No time/wage/payroll model is introduced.

### Overhead cost

`overheadCostPerUnit`:

- PHP monetary amount per finished unit;
- finite;
- `>= 0`;
- explicit zero is valid and meaningful.

No percentage allocation or global overhead allocator is introduced.

### Pricing policy configuration state

`pricingPolicy` is a required field whose value is either:

```text
PricingPolicy
```

or:

```text
null
```

Semantics:

```text
null = pricing policy intentionally/unambiguously not configured yet
object = a pricing policy source value is present
```

Do not use an omitted/optional field for this configuration state; explicit null avoids ambiguity for future persistence/import.

### Pricing method source type

Dedicated pricing-domain definitions should expose:

```text
PRICING_METHODS = [
  'profit-amount',
  'markup-percent',
  'margin-percent',
]

PricingMethod
PricingPolicy
isPricingMethod(...)
clonePricingPolicy(...)
```

4.1A may enforce that a present policy uses a supported method because this is source-shape validity.

4.1A must **not** become the authoritative policy-value engine. These rules remain 4.1B:

- finite policy value;
- non-negative profit amount;
- non-negative markup rate;
- `0 <= margin < 1`;
- selling-price formulas;
- effective markup/margin diagnostics;
- invalid-margin fail-closed behavior.

Keeping the numeric policy rules in 4.1B prevents formula/validation behavior from being split across phases.

## Missing versus explicit zero semantics

A missing financial-profile record and a configured zero-cost profile are different evidence states:

```text
no ProductFinancialProfile
= Product financial configuration unresolved

ProductFinancialProfile {
  laborCostPerUnit: 0,
  overheadCostPerUnit: 0,
  pricingPolicy: null,
}
= labor/overhead explicitly known as zero; pricing not yet configured
```

4.1A does not invent a default profile.

## Normalization

`normalizeProductFinancialProfile()` should:

- trim `productId`;
- trim notes;
- omit blank notes as `undefined`;
- clone a present pricing-policy object rather than retaining nested caller references;
- preserve `pricingPolicy: null` exactly;
- not coerce/sanitize monetary values;
- not round PHP amounts.

Invalid source values should be rejected by validation rather than silently repaired.

## Cloning

`cloneProductFinancialProfile()` must deep-clone the nested pricing-policy object when present.

A shallow spread alone is insufficient because future repositories/services must not leak mutable nested source references.

## Error contract

Introduce a dedicated error type such as:

```text
ProductFinancialProfileError
```

with stable codes for at least:

```text
INVALID_PRODUCT_ID
NON_FINITE_LABOR_COST
NEGATIVE_LABOR_COST
NON_FINITE_OVERHEAD_COST
NEGATIVE_OVERHEAD_COST
INVALID_PRICING_METHOD
```

Context should retain relevant `productId` / input evidence.

Do not add 4.1B pricing-value-range errors here.

## BusinessDataset inclusion

`BusinessDataset` should gain:

```text
productFinancialProfiles: ProductFinancialProfile[]
```

This establishes the future Phase 5 persistence shape without implementing Excel persistence.

`src/domain/types.ts` should export/re-export `ProductFinancialProfile` and pricing types in a compatibility-safe way.

## Expected files

Likely source changes:

```text
src/domain/pricing.ts
src/domain/pricing.test.ts              only if structural/type-guard behavior warrants focused tests
src/domain/productFinancialProfile.ts
src/domain/productFinancialProfile.test.ts
src/domain/types.ts
```

The exact test split may be consolidated if one focused profile-contract test file cleanly covers pricing-method structural behavior.

No application/repository/UI/session file should be needed.

## Focused test matrix

At minimum validate:

### Valid source records

- positive labor + overhead with configured policy;
- explicit zero labor;
- explicit zero overhead;
- explicit zero for both;
- `pricingPolicy: null` accepted;
- notes optional;
- supported pricing methods recognized.

### Invalid Product identity

- blank Product ID rejected;
- whitespace-only Product ID rejected.

### Invalid labor

- negative labor rejected;
- `NaN` labor rejected;
- `Infinity` / `-Infinity` labor rejected.

### Invalid overhead

- negative overhead rejected;
- `NaN` overhead rejected;
- infinities rejected.

### Pricing source shape

- unsupported pricing method rejected when a policy object is present;
- policy-value range is deliberately not asserted as 4.1A authority; dedicated value/formula tests belong to 4.1B.

### Normalization/cloning

- Product ID trimmed;
- blank notes omitted;
- non-blank notes trimmed;
- `pricingPolicy: null` preserved;
- present policy cloned independently;
- cloned profile policy cannot mutate original nested policy.

### Dataset shape

- TypeScript compilation proves `BusinessDataset` includes `productFinancialProfiles`;
- any existing test fixtures constructing `BusinessDataset` are updated only as necessary to satisfy the new source collection.

## Explicit non-goals

4.1A does not implement:

- Product existence/reference lookup;
- one-profile-per-Product persistence enforcement;
- profile repository;
- profile service;
- session wiring;
- pricing-policy numeric range validation;
- selling-price derivation;
- fully loaded unit cost;
- safety-waste-adjusted pricing cost;
- recursive Phase 4 child costing;
- planned batch financials;
- capacity warnings;
- React pricing UI;
- Excel/Tauri persistence.

## Implementation order

1. Create this plan before source changes. ✅
2. Add dedicated pricing source-type module and compatibility exports.
3. Add ProductFinancialProfile source contract/errors/clone/normalize/validation.
4. Add `BusinessDataset.productFinancialProfiles`.
5. Add focused domain tests.
6. Run focused tests/typecheck.
7. Run full CI.
8. Create implementation record and mark this plan implementation-complete/merge-gate-pending.
9. Require clean final documented-head CI.
10. Open PR to `develop`.
11. Require independent PR CI.
12. Merge with expected-head SHA protection.
13. Require exact post-merge `develop` CI.
14. Create documentation-only closeout branch.
15. Mark 4.1A COMPLETE and 4.1B NEXT in `docs/PHASE_4_PROGRESS.md`.
16. Require closeout PR CI and exact final `develop` CI.

## Completion gate

4.1A is complete only when:

- a dedicated Product financial-profile source contract exists;
- Product ID, labor, overhead, pricing-policy configuration state, and notes semantics are explicit;
- explicit zero labor/overhead is accepted;
- non-finite/negative labor or overhead is rejected;
- missing profile remains semantically distinct from a zero-cost profile;
- pricing-policy source types have a dedicated Phase 4 domain home;
- numeric pricing-policy/formula authority remains deferred to 4.1B;
- Product itself has no new pricing fields;
- BusinessDataset includes the future financial-profile collection;
- focused tests, full tests, typecheck, and production build pass;
- implementation PR and exact post-merge `develop` CI pass;
- closeout PR and exact final `develop` CI pass.

## Next task after completion

**4.1B — Pricing Formula & Validation Engine — NEXT / NOT STARTED**

Do not begin 4.1B until 4.1A is fully merged, closed out, and exact final `develop` CI is green.
