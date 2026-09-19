# Phase 4.3A — Selling Price Derivation

## Status

**COMPLETE — IMPLEMENTATION MERGED AND POST-MERGE VALIDATED**

Authoritative starting base:

`develop` @ `11a32dd4bf035465f4100c1c5146589040dda8d4`

Starting exact `develop` CI:

`34941662149 — SUCCESS`

Feature branch:

`feature/phase-4-3a-selling-price-derivation`

Development plan:

`docs/PHASE_4_3A_SELLING_PRICE_DERIVATION_PLAN.md`

Implementation PR:

`#108 — Phase 4.3A — Selling Price Derivation`

## Delivered

### Authoritative selling-price application service

Added:

`src/application/pricing/SellingPriceDerivationService.ts`

Public boundary:

```ts
deriveForProduct(productId: string): Promise<SellingPriceDerivationResult>
```

The service combines only:

```text
Phase 4.2C ready totalFullyLoadedUnitCost
+
Phase 4.1C Product pricingPolicy
+
Phase 4.1B validatePricingPolicy()/deriveSellingPrice()
```

No pricing formula is duplicated in the application layer.

### Authoritative price basis

Selling price is derived only from a Phase 4.2C result where:

```text
status = ready
```

and:

```text
totalFullyLoadedUnitCost
```

is finite and non-negative.

`knownFullyLoadedUnitCostSubtotal` remains diagnostic partial evidence and is never used to derive an authoritative selling price.

### Pricing methods

The completed Phase 4.1B engine remains authoritative for:

```text
profit-amount
markup-percent
margin-percent
```

including validation, full-precision formulas, invalid-margin rejection, and non-finite result rejection.

4.3A performs no currency rounding or charm pricing.

### Unconfigured pricing policy

When cost is ready but:

```text
pricingPolicy = null
```

4.3A returns:

```text
status = partial
sellingPrice = null
```

The ready fully loaded cost remains visible. No default markup, fixed profit, or margin is invented.

### Fail-closed readiness

The service blocks selling-price publication for:

- partial or not-ready 4.2C cost;
- missing financial profile;
- Product/profile identity mismatch;
- invalid/corrupted pricing method;
- negative fixed-profit amount;
- negative markup;
- target margin outside `[0, 1)`;
- non-finite policy value;
- contradictory ready cost with null/non-finite/negative authoritative total;
- requested Product/cost-evidence identity mismatch;
- non-finite/invalid derived selling price.

Underlying Phase 4.1B `PricingError.code` remains available in controlled 4.3A issue evidence.

### Readiness result

```text
ready
  authoritative ready cost + valid configured policy + valid derived price

partial
  meaningful cost evidence exists, but selling price is unresolved

not-ready
  no trustworthy authoritative priceable cost basis
```

### Product state and defensive behavior

- archived root Products remain inspectable/priceable when cost and pricing policy are otherwise valid;
- `productIsActive` is preserved;
- source pricing policy is defensively cloned;
- canonical 4.2C Product identity is used for profile lookup;
- no Product/profile/source state is mutated.

### Shared session wiring

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

No React changes were required.

## Controlled issue categories

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

## Validation evidence

```text
Plan-before-code commit         4ae338331cf4f28d6ec6f997ab94339af9b4d056
Implementation head             3cded1826b18aa46195e9d87e60cafcafc1d9cd6
Implementation CI               34942368270 — SUCCESS
Final feature head              258eca03d64325631e04b776ab9d1a42d377e87b
Final feature-head CI           34942557415 — SUCCESS
PR #108                         MERGED
PR CI                           34942666927 — SUCCESS
Implementation merge            4a2d28ef7be757a2fe4f4f2e037ad4a6abef11fd
Post-merge develop CI           34942765862 — SUCCESS
67 test files / 807 tests
27 SellingPriceDerivationService tests
1 4.3A shared-session wiring test
50 pricing-domain tests
24 Phase 4.2C fully loaded cost tests
7 React smoke tests
TypeScript typecheck passed
production Vite build passed
104 modules transformed
```

No implementation CI failure occurred.

## Scope retained

4.3A did **not** add:

- profit per unit;
- effective markup;
- effective margin;
- consolidated Product pricing quote/readiness service;
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
- price rounding/charm pricing.

Those remain in 4.3B+, 4.4+, 4.5+, or later work.

## Completion result

Phase 4.3A implementation, feature-head validation, PR validation, merge, and exact post-merge `develop` validation are complete.

The documentation-only closeout advances the Phase 4 tracker to:

```text
4.3 — Selling Price & Unit Economics                 IN PROGRESS
    4.3A — Selling Price Derivation                       COMPLETE
    4.3B — Profit / Markup / Margin Metrics               NEXT
    4.3C — Product Pricing Quote & Readiness Service      NOT STARTED
```

## Next task

**4.3B — Profit / Markup / Margin Metrics — NEXT / NOT STARTED**

Do not begin 4.3B until this documentation-only closeout is merged and the exact final `develop` CI is green.