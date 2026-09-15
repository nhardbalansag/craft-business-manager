# Phase 4.3A — Selling Price Derivation

## Status

**IMPLEMENTED — FEATURE-HEAD VALIDATION COMPLETE — MERGE GATE PENDING**

Authoritative starting base:

`develop` @ `11a32dd4bf035465f4100c1c5146589040dda8d4`

Starting exact `develop` CI:

`34941662149 — SUCCESS`

Feature branch:

`feature/phase-4-3a-selling-price-derivation`

Development plan:

`docs/PHASE_4_3A_SELLING_PRICE_DERIVATION_PLAN.md`

## Delivered

### Authoritative application service

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
Phase 4.1C configured Product pricingPolicy
+
Phase 4.1B validated deriveSellingPrice()
```

No pricing formula is duplicated in the application layer.

### Authoritative cost-basis rule

Selling price is derived only when 4.2C reports:

```text
status = ready
```

and exposes a finite non-negative:

```text
totalFullyLoadedUnitCost
```

`knownFullyLoadedUnitCostSubtotal` remains visible as diagnostic cost evidence but is never used as an authoritative selling-price basis.

This prevents partial production cost from becoming a misleading sale price.

### Supported pricing policies

4.3A delegates to the completed 4.1B pricing engine for:

```text
profit-amount
markup-percent
margin-percent
```

The domain remains authoritative for:

- pricing-policy validation;
- target-margin bounds;
- full-precision formulas;
- non-finite/negative cost rejection;
- non-finite/negative derived price rejection.

4.3A performs no monetary rounding.

### Unconfigured pricing policy

When a Product has a valid cost basis but:

```text
pricingPolicy = null
```

4.3A returns:

```text
status = partial
sellingPrice = null
```

The ready total unit cost remains visible.

No default markup, default profit amount, or default margin is invented.

### Missing/corrupted profile handling

The service fails closed for:

- missing financial profile;
- financial profile whose Product identity does not match the cost result Product;
- invalid/corrupted pricing method;
- negative fixed-profit amount;
- negative markup;
- target margin >= 1;
- non-finite pricing-policy value.

Underlying Phase 4.1B `PricingError.code` is preserved on controlled 4.3A issues.

### Cost readiness propagation

If 4.2C is:

```text
partial
```

4.3A preserves the known cost subtotal and returns:

```text
status = partial
sellingPrice = null
```

If 4.2C is:

```text
not-ready
```

4.3A returns:

```text
status = not-ready
sellingPrice = null
```

A configured pricing policy never makes an unresolved production-cost basis priceable.

### Defensive evidence checks

4.3A also fails closed when:

- requested Product identity and 4.2C Product identity mismatch;
- 4.2C claims `ready` while `totalFullyLoadedUnitCost` is null/non-finite/negative;
- 4.1B derivation produces a non-finite/invalid selling price.

The financial profile is not read when cost evidence belongs to another Product.

### Archived Product behavior

Archived root Products remain inspectable/priceable when cost and pricing evidence are otherwise valid.

The result preserves:

`productIsActive`

and performs no Product-state mutation.

### Shared session wiring

Updated:

`src/application/session.ts`

Added shared:

```text
sellingPriceDerivationService
```

using:

```text
fullyLoadedProductUnitCostService
productFinancialProfileService
```

No React changes were required.

## Result contract

4.3A exposes:

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

Readiness:

```text
ready      = authoritative cost + valid configured policy + valid derived price
partial    = meaningful cost evidence exists, but price is unresolved
not-ready  = no trustworthy priceable production-cost basis
```

## Controlled issues

Implemented issue categories:

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

## Tests

Added:

`src/application/pricing/SellingPriceDerivationService.test.ts`

with **27 focused tests** covering:

- fixed-profit derivation;
- markup derivation;
- target-margin derivation;
- repeating/full-precision margin result;
- zero fixed-profit/markup/margin policies;
- zero ready unit cost;
- unconfigured pricing policy;
- missing/mismatched profile;
- negative profit/markup policy;
- invalid 100% target margin;
- non-finite policy values;
- unsupported imported pricing method;
- partial cost preservation without pricing;
- not-ready cost blocking;
- contradictory ready/null cost evidence;
- non-finite ready cost evidence;
- requested/cost Product identity mismatch;
- authoritative total versus known subtotal protection;
- policy-change price recomputation with stable cost evidence;
- archived Product inspectability;
- selling-price overflow failure;
- defensive pricing-policy cloning;
- canonical Product identity for profile lookup.

Added:

`src/application/pricing/SellingPriceDerivationSession.test.ts`

with **1 shared-session wiring test**.

## Validation evidence

Implementation head:

`3cded1826b18aa46195e9d87e60cafcafc1d9cd6`

Implementation CI:

`34942368270 — SUCCESS`

Observed validation surface:

```text
67 test files passed
807 tests passed
27 SellingPriceDerivationService tests
1 4.3A shared-session wiring test
50 pricing-domain tests
24 4.2C fully loaded cost tests
7 React smoke tests
TypeScript typecheck passed
production Vite build passed
104 modules transformed
```

No implementation CI failure occurred.

## Scope retained

4.3A did not add:

- profit per unit;
- effective markup;
- effective margin;
- consolidated Product pricing quote service;
- batch production cost;
- expected revenue/profit;
- batch margin;
- capacity warnings;
- React pricing UI;
- financial-profile editing;
- stock reservation/deduction;
- production posting;
- Excel/Tauri persistence;
- tax/VAT/discount/fee logic;
- price rounding/charm-pricing policy.

## Current merge gate

Before PR creation:

1. update the dedicated plan with implementation evidence;
2. require clean CI on the exact final documented feature head;
3. compare the feature branch against starting `develop`;
4. verify no 4.3B+ leakage;
5. open the implementation PR only if all gates pass.

## Next task after full closeout

**4.3B — Profit / Markup / Margin Metrics — NEXT / NOT STARTED**

Do not begin 4.3B until 4.3A implementation and documentation closeout are merged and exact final `develop` CI is green.
