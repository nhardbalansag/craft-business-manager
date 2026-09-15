# Phase 4.1B — Pricing Formula & Validation Engine Development Plan

## Status

**COMPLETE**

Authoritative base:

`develop` @ `ef06ea91caf4d0edd1d41eaf5bebf9791d9ff9f3`

Starting exact `develop` CI:

`34932882849 — SUCCESS`

Feature branch:

`feature/phase-4-1b-pricing-formula-validation-engine`

Implementation record:

`docs/PHASE_4_1B_PRICING_FORMULA_VALIDATION_ENGINE.md`

Implementation PR:

`#98 — Phase 4.1B — Pricing Formula & Validation Engine`

## Objective

Make the Phase 4 pricing source vocabulary authoritative for validated fixed-profit, markup, and target-margin formulas plus unit-profit/markup/margin diagnostics.

Invalid financial input fails closed. Domain calculations retain full precision and never round for UI display.

## Split assessment

No deeper formal split was required.

4.1B remained one cohesive pure-domain task. Application readiness/quote orchestration remains 4.3; profile persistence/application services remain 4.1C; fully loaded Product cost remains 4.2.

## Delivered architecture

`src/domain/pricing.ts` now owns:

```text
PricingError
validatePricingPolicy()
validatePricingUnitCost()
validatePricingSellingPrice()
deriveSellingPrice()
calculateProfitPerUnit()
calculateEffectiveMarkup()
calculateEffectiveMargin()
deriveUnitEconomics()
```

Authoritative policy rules:

```text
profit-amount:   value >= 0
markup-percent:  value >= 0
margin-percent:  0 <= value < 1
```

Canonical percentage values are decimal rates.

Authoritative formulas:

```text
fixed profit:
sellingPrice = unitCost + profitAmount

markup:
sellingPrice = unitCost × (1 + markupRate)

target margin:
sellingPrice = unitCost / (1 - targetMarginRate)
```

Zero denominators return explicit `null` diagnostics:

```text
unitCost == 0      -> effectiveMarkup = null
sellingPrice == 0  -> effectiveMargin = null
```

No domain rounding is performed.

Legacy `costing.ts` pricing exports delegate to the new engine; old invalid sanitize/fake-zero behavior is intentionally removed.

`totalUnitCost()` and `plannedTotals()` remain unchanged for later 4.2/4.4 replacement.

## Test coverage

```text
src/domain/pricing.test.ts  50 tests
src/domain/costing.test.ts  12 tests
```

Full regression surface:

```text
57 test files passed
698 tests passed
7 React smoke tests
TypeScript typecheck passed
production Vite build passed
```

## Validation chain

```text
Implementation head          d699f1ac11794a47a026290aa3ef2e963d84f2f4
Implementation CI            34934079592 — SUCCESS
Final feature head            e4252a4d6c4939cc4d32cd7ba0ad74b9a9701c49
Final feature-head CI         34934177928 — SUCCESS
PR #98                        MERGED
PR CI                         34934241244 — SUCCESS
Implementation merge          408398a01c7a9002849694db504df7e25309c138
Post-merge develop CI         34934307289 — SUCCESS
```

## Scope retained

4.1B did not implement repository/service/session wiring, fully loaded Product cost, readiness-aware quote orchestration, batch financials, capacity warnings, React UI, Excel/Tauri persistence, tax/VAT, discounts, marketplace fees, or price-rounding policy.

## Completion gate

- dedicated plan before implementation ✅
- fail-closed policy validation ✅
- deterministic fixed-profit/markup/margin formulas ✅
- explicit decimal-rate semantics ✅
- invalid target margin never yields fake zero ✅
- finite/non-negative unit cost and selling-price validation ✅
- zero denominator diagnostics return `null` ✅
- no domain rounding ✅
- legacy wrappers delegate rather than duplicate formulas ✅
- focused/full tests, typecheck, build ✅
- implementation PR and exact post-merge `develop` CI ✅
- documentation-only closeout prepared ✅

The remaining repository lifecycle step is merging the documentation-only closeout and validating exact final `develop` CI.

## Next task after completion

**4.1C — Financial Profile Repository & Application Services — NEXT / NOT STARTED**

Do not begin 4.1C until this closeout is merged and exact final `develop` CI is green.
