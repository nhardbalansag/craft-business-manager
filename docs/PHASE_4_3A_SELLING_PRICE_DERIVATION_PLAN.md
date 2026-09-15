# Phase 4.3A — Selling Price Derivation Development Plan

## Status

**IMPLEMENTED — FULL FEATURE VALIDATION PASSED — MERGE GATE**

Authoritative base:

`develop` @ `11a32dd4bf035465f4100c1c5146589040dda8d4`

Starting exact `develop` CI:

`34941662149 — SUCCESS`

Feature branch:

`feature/phase-4-3a-selling-price-derivation`

Master plan:

`docs/PHASE_4_PRICING_PRODUCTION_PLANNING_PLAN.md`

Previous completed prerequisites:

- `4.1B — Pricing Formula & Validation Engine — COMPLETE`
- `4.1C — Financial Profile Repository & Application Services — COMPLETE`
- `4.2C — Total Fully Loaded Unit Cost & Readiness — COMPLETE`

## Objective

Create the authoritative Product-level selling-price derivation boundary for Phase 4.

For Product `P`:

```text
4.2C authoritative totalFullyLoadedUnitCost(P)
+
P configured pricingPolicy
↓
4.1B deriveSellingPrice(...)
↓
authoritative derived sellingPrice(P)
```

4.3A fails closed. A ready fully loaded cost may remain visible while selling price is unresolved, but no default policy is invented and no partial/not-ready cost basis is ever priced.

## Split assessment

No deeper formal roadmap split was required.

4.3A remained one cohesive application capability:

1. consume authoritative 4.2C cost evidence;
2. preserve canonical Product identity;
3. read the Product financial profile through 4.1C;
4. distinguish missing profile from unconfigured pricing policy;
5. defensively verify profile Product identity;
6. validate configured pricing policy using 4.1B;
7. derive selling price only from a ready authoritative 4.2C total;
8. map controlled readiness/issues;
9. preserve full numeric precision/no presentation rounding;
10. wire the shared session boundary;
11. validate with focused and full-regression tests.

No `4.3A.1/4.3A.2` split was justified.

## Authoritative inputs

### 4.2C cost basis

Use:

`FullyLoadedProductUnitCostService.costProduct(productId)`

Only this field is priceable:

`totalFullyLoadedUnitCost`

and only when:

```text
status = ready
```

`knownFullyLoadedUnitCostSubtotal` remains diagnostic partial evidence and is never used to derive price.

### 4.1C pricing source

Use:

`ProductFinancialProfileService.getProfile(productId)`

Source field:

`pricingPolicy: PricingPolicy | null`

Semantics:

```text
profile missing       = financial source configuration unresolved
pricingPolicy = null  = cost source may be complete, pricing intentionally unconfigured
```

### 4.1B pricing engine

4.3A delegates validation and formula math to:

`src/domain/pricing.ts`

Supported policies:

```text
profit-amount
markup-percent
margin-percent
```

No formula is duplicated in the application service.

## Delivered application service

Added:

`src/application/pricing/SellingPriceDerivationService.ts`

Public boundary:

```ts
deriveForProduct(productId: string): Promise<SellingPriceDerivationResult>
```

Dependencies:

```text
FullyLoadedProductUnitCostService/provider
ProductFinancialProfileService/provider
```

A Product repository dependency was not needed because 4.2C already owns Product existence and canonical identity.

## Result contract

Readiness:

```ts
type SellingPriceDerivationStatus = 'ready' | 'partial' | 'not-ready';
```

Result fields:

```text
productId
productName
productIsActive
status
costStatus
totalFullyLoadedUnitCost
knownFullyLoadedUnitCostSubtotal
pricingPolicy
sellingPrice
issues[]
```

`selligPrice` is non-null only when all price prerequisites are valid.

## Readiness semantics

### ready

Requires:

```text
4.2C status = ready
finite non-negative totalFullyLoadedUnitCost
financial profile identity valid
pricing policy configured + valid
4.1B selling-price derivation valid
```

### partial

Use when meaningful cost evidence exists but price cannot be published.

Examples:

- ready cost + `pricingPolicy = null`;
- ready cost + missing/invalid pricing source;
- partial 4.2C cost with known subtotal;
- valid pricing policy + partial cost basis;
- valid cost/policy where derived selling price fails validation.

### not-ready

Use when 4.2C is not ready or defensive ready-cost evidence is structurally invalid.

A configured pricing policy alone never makes an unresolved production-cost basis priceable.

## Cost-basis safety

4.3A never calculates price from:

- `knownFullyLoadedUnitCostSubtotal`;
- Phase 3 `totalComponentAwareCost`;
- 4.2A direct-material cost alone;
- a child Product selling price;
- an invented/manual default cost.

Only 4.2C `totalFullyLoadedUnitCost` with `status = ready` is priceable.

## Pricing-policy semantics

For `pricingPolicy = null`:

```text
sellingPrice = null
```

No default 20%, 30%, fixed peso profit, or other policy is allowed.

Corrupted/imported invalid policies fail closed through 4.1B validation. Underlying `PricingError.code` remains available on 4.3A issues.

Valid zero policies remain valid:

```text
profit-amount 0
markup-percent 0
margin-percent 0
```

No monetary rounding/charm pricing is performed.

## Defensive identity and corruption checks

4.3A verifies:

- requested Product identity matches 4.2C Product evidence;
- financial profile Product identity matches canonical cost Product identity;
- ready 4.2C cost has finite non-negative authoritative total;
- configured policy is valid;
- derived selling price is valid.

The financial profile is not read when cost evidence belongs to another Product.

## Controlled issue categories

Implemented:

```text
COST_PARTIAL
COST_NOT_READY
COST_PRODUCT_MISMATCH
COST_TOTAL_INVALID
FINANCIAL_PROFILE_MISSING
FINANCIAL_PROFILE_PRODUCT_MISMATCH
PRICING_POLICY_MISSING
PRICING_POLICY_INVALID
SELLING_PRICE_DERIVATION_FAILED
```

## Archived Product semantics

Archived root Products remain inspectable/priceable when cost and pricing evidence are otherwise valid.

`productIsActive` is preserved and no Product state is mutated.

## Scope boundaries retained

4.3A does not implement:

- profit per unit;
- effective markup;
- effective margin;
- consolidated Product pricing quote/readiness;
- batch production cost;
- expected revenue/profit;
- batch margin;
- capacity feasibility/warnings;
- React pricing UI;
- source-profile editing;
- stock reservation/deduction;
- production posting;
- Excel/Tauri persistence;
- tax/VAT/discount/marketplace-fee logic;
- currency/charm-price rounding.

Those remain in 4.3B+, 4.4+, 4.5+, or later work.

## Shared session wiring

Updated:

`src/application/session.ts`

Added:

```text
sellingPriceDerivationService
```

constructed from:

```text
fullyLoadedProductUnitCostService
productFinancialProfileService
```

No React changes were made.

## Focused validation

Added:

`src/application/pricing/SellingPriceDerivationService.test.ts`

with **27 focused tests**.

Added:

`src/application/pricing/SellingPriceDerivationSession.test.ts`

with **1 shared-session wiring test**.

Coverage includes:

- all three pricing methods;
- full precision;
- zero-value policies;
- zero ready unit cost;
- missing/unconfigured/invalid pricing source;
- invalid margin/non-finite policy values;
- partial/not-ready cost blocking;
- authoritative total versus known subtotal protection;
- Product/profile identity mismatch protection;
- archived Product behavior;
- selling-price overflow failure;
- defensive policy cloning;
- canonical Product identity lookup.

## Implementation evidence

Plan-before-code commit:

`4ae338331cf4f28d6ec6f997ab94339af9b4d056`

Implementation head:

`3cded1826b18aa46195e9d87e60cafcafc1d9cd6`

Implementation CI:

`34942368270 — SUCCESS`

Observed regression surface:

```text
67 test files passed
807 tests passed
27 SellingPriceDerivationService tests
1 4.3A shared-session wiring test
50 pricing-domain tests
24 4.2C cost tests
7 React smoke tests
TypeScript typecheck passed
production Vite build passed
104 modules transformed
```

No implementation CI failure occurred.

Implementation record:

`docs/PHASE_4_3A_SELLING_PRICE_DERIVATION.md`

## Current lifecycle gate

Completed:

1. exact `develop` verified;
2. dedicated plan committed before implementation;
3. service implemented;
4. focused tests/session wiring added;
5. full typecheck/tests/build passed;
6. implementation record created.

Pending:

7. clean CI on exact final documented feature head;
8. exact scope compare against starting `develop`;
9. implementation PR to `develop`;
10. independent PR CI;
11. expected-head merge;
12. exact post-merge `develop` CI;
13. documentation-only closeout;
14. tracker advancement to 4.3B NEXT;
15. closeout PR CI;
16. exact final `develop` CI.

## Completion gate

4.3A is complete only when all remaining lifecycle gates pass and the tracker becomes:

```text
4.3 — Selling Price & Unit Economics                 IN PROGRESS
    4.3A — Selling Price Derivation                       COMPLETE
    4.3B — Profit / Markup / Margin Metrics               NEXT
    4.3C — Product Pricing Quote & Readiness Service      NOT STARTED
```

## Next task after completion

**4.3B — Profit / Markup / Margin Metrics — NEXT / NOT STARTED**

Do not begin 4.3B until 4.3A implementation and documentation closeout are merged and the exact final `develop` CI is green.
