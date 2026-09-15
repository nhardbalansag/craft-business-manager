# Phase 4.3A — Selling Price Derivation Development Plan

## Status

**COMPLETE**

Authoritative starting base:

`develop` @ `11a32dd4bf035465f4100c1c5146589040dda8d4`

Starting exact `develop` CI:

`34941662149 — SUCCESS`

Feature branch:

`feature/phase-4-3a-selling-price-derivation`

Master plan:

`docs/PHASE_4_PRICING_PRODUCTION_PLANNING_PLAN.md`

Implementation record:

`docs/PHASE_4_3A_SELLING_PRICE_DERIVATION.md`

## Objective achieved

Phase 4.3A now provides the authoritative Product-level selling-price derivation boundary:

```text
ready Phase 4.2C totalFullyLoadedUnitCost
+
configured Product pricingPolicy
↓
Phase 4.1B validated deriveSellingPrice()
↓
authoritative derived sellingPrice
```

The implementation fails closed, does not invent a default pricing policy, and never prices partial/not-ready cost evidence.

## Split assessment

No deeper formal roadmap split was required.

The task remained one cohesive application capability covering:

1. 4.2C cost evidence consumption;
2. canonical Product identity;
3. 4.1C financial-profile/policy lookup;
4. missing versus unconfigured policy semantics;
5. Product/profile identity protection;
6. 4.1B pricing-policy validation;
7. selling-price derivation from ready authoritative cost only;
8. controlled readiness/issues;
9. full precision/no presentation rounding;
10. shared session wiring;
11. focused and full-regression validation.

## Locked implementation semantics

### Priceable cost

Only:

```text
4.2C status = ready
AND
finite non-negative totalFullyLoadedUnitCost
```

is priceable.

`knownFullyLoadedUnitCostSubtotal` is diagnostic only and is never used to derive selling price.

### Pricing policy

Supported methods remain owned by Phase 4.1B:

```text
profit-amount
markup-percent
margin-percent
```

4.3A delegates validation and formulas to:

```text
validatePricingPolicy()
deriveSellingPrice()
```

No application-layer formula duplication was introduced.

### Unconfigured pricing

For:

```text
pricingPolicy = null
```

with ready cost:

```text
status = partial
sellingPrice = null
```

No default policy is invented.

### Readiness

```text
ready
  ready authoritative cost + valid configured policy + valid derived price

partial
  meaningful cost evidence exists but selling price remains unresolved

not-ready
  no trustworthy authoritative priceable cost basis
```

### Defensive behavior

Fail closed for:

- cost Product identity mismatch;
- contradictory ready cost evidence;
- missing/mismatched financial profile;
- invalid/corrupted pricing policy;
- invalid/non-finite derived selling price.

Archived root Products remain inspectable/priceable where evidence is otherwise valid.

## Delivered files

Added:

```text
src/application/pricing/SellingPriceDerivationService.ts
src/application/pricing/SellingPriceDerivationService.test.ts
src/application/pricing/SellingPriceDerivationSession.test.ts
docs/PHASE_4_3A_SELLING_PRICE_DERIVATION.md
```

Updated:

```text
src/application/session.ts
docs/PHASE_4_3A_SELLING_PRICE_DERIVATION_PLAN.md
```

Documentation-only closeout updates:

```text
docs/PHASE_4_PROGRESS.md
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
1 shared-session wiring test
50 pricing-domain tests
24 Phase 4.2C cost tests
7 React smoke tests
TypeScript typecheck passed
production Vite build passed
104 modules transformed
```

No implementation CI failure occurred.

## Scope boundaries retained

Phase 4.3A did not implement:

- profit per unit;
- effective markup;
- effective margin;
- consolidated Product pricing quote/readiness service;
- physical batch production cost;
- expected batch revenue/profit;
- batch margin;
- capacity feasibility/warnings;
- React pricing UI;
- financial-profile editing;
- stock mutation;
- Excel/Tauri persistence;
- tax/VAT/discount/marketplace-fee logic;
- currency/charm-price rounding.

## Completion gate result

All implementation-side gates passed:

- exact authoritative base verified ✅
- dedicated plan committed before code ✅
- implementation completed within scope ✅
- focused tests and session wiring ✅
- full typecheck/tests/build ✅
- implementation record ✅
- exact documented feature-head CI ✅
- clean pre-PR scope compare ✅
- implementation PR #108 CI ✅
- expected-head merge ✅
- exact post-merge `develop` CI ✅

The documentation-only closeout marks:

```text
4.3A — Selling Price Derivation                  COMPLETE
4.3B — Profit / Markup / Margin Metrics          NEXT / NOT STARTED
```

## Next task

**4.3B — Profit / Markup / Margin Metrics — NEXT / NOT STARTED**

Do not begin 4.3B until the 4.3A closeout PR is merged and exact final `develop` CI is green.