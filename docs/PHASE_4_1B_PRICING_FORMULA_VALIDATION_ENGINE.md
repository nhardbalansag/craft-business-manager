# Phase 4.1B — Pricing Formula & Validation Engine

## Status

**COMPLETE**

Authoritative starting base:

`develop` @ `ef06ea91caf4d0edd1d41eaf5bebf9791d9ff9f3`

Feature branch:

`feature/phase-4-1b-pricing-formula-validation-engine`

Development plan:

`docs/PHASE_4_1B_PRICING_FORMULA_VALIDATION_ENGINE_PLAN.md`

Implementation PR:

`#98 — Phase 4.1B — Pricing Formula & Validation Engine`

## Delivered engine

### Authoritative pricing validation

`src/domain/pricing.ts` now owns the Phase 4 pricing validation and formula contract.

Typed `PricingError` codes:

```text
INVALID_PRICING_METHOD
NON_FINITE_POLICY_VALUE
NEGATIVE_POLICY_VALUE
INVALID_MARGIN_RATE
NON_FINITE_UNIT_COST
NEGATIVE_UNIT_COST
NON_FINITE_SELLING_PRICE
NEGATIVE_SELLING_PRICE
```

Valid policy rules:

```text
profit-amount:   value >= 0
markup-percent:  value >= 0
margin-percent:  0 <= value < 1
```

All financial inputs must be finite. Unit cost and selling price must be non-negative. Percentage policies use canonical decimal rates such as `0.50` for 50%.

### Selling-price formulas

```text
fixed profit:
sellingPrice = unitCost + profitAmount

markup:
sellingPrice = unitCost × (1 + markupRate)

target margin:
sellingPrice = unitCost / (1 - targetMarginRate)
```

A target margin of 100% or greater fails closed with `INVALID_MARGIN_RATE`; it no longer returns a fake zero price.

Negative fixed-profit/markup values fail instead of being silently clamped. Derived non-finite selling prices also fail closed.

### Unit economics diagnostics

Delivered:

```text
calculateProfitPerUnit()
calculateEffectiveMarkup()
calculateEffectiveMargin()
deriveUnitEconomics()
```

Semantics:

```text
profitPerUnit = sellingPrice - unitCost

effectiveMarkup = profitPerUnit / unitCost
  when unitCost > 0
  otherwise null

effectiveMargin = profitPerUnit / sellingPrice
  when sellingPrice > 0
  otherwise null
```

Zero denominators return `null`, never `Infinity` or `NaN`.

An externally supplied non-negative selling price below cost remains valid for diagnostic loss analysis.

### Precision

The pricing domain performs no currency or percentage rounding. Repeating target-margin prices retain full numeric precision; PHP formatting remains presentation-only.

### Legacy costing compatibility

`src/domain/costing.ts` retains the old exports:

```text
sellingPrice()
profitPerPiece()
```

Both delegate to the authoritative Phase 4 engine.

Intentional hardening:

- invalid margin throws instead of returning zero;
- negative pricing value throws instead of clamping;
- invalid/non-finite unit cost or price throws.

`totalUnitCost()` and `plannedTotals()` remain unchanged because authoritative Phase 4 replacements belong to 4.2 and 4.4.

## Tests

Focused suites:

```text
src/domain/pricing.test.ts  50 tests
src/domain/costing.test.ts  12 tests
```

Coverage includes policy validation, all three formulas, finite/non-negative validation, invalid margins, full precision, derived non-finite result rejection, profit/loss diagnostics, zero-denominator null behavior, consolidated unit economics, and legacy wrapper delegation.

## Validation evidence

```text
Implementation head          d699f1ac11794a47a026290aa3ef2e963d84f2f4
Implementation CI            34934079592 — SUCCESS
Final documented feature head e4252a4d6c4939cc4d32cd7ba0ad74b9a9701c49
Final feature-head CI         34934177928 — SUCCESS
PR #98                        MERGED
PR CI                         34934241244 — SUCCESS
Implementation merge          408398a01c7a9002849694db504df7e25309c138
Post-merge develop CI         34934307289 — SUCCESS
```

Observed regression surface:

```text
57 test files passed
698 tests passed
50 pricing engine tests
12 costing regression tests
18 ProductFinancialProfile tests
7 React smoke tests
TypeScript typecheck passed
production Vite build passed
96 modules transformed
```

No implementation CI failure occurred.

## Scope retained

4.1B did not add:

- financial-profile repository/service/session wiring;
- Product reference lookup;
- fully loaded Product cost;
- safety-waste pricing-cost service;
- recursive Phase 4 child production cost;
- readiness-aware pricing quote service;
- physical batch financial plan;
- capacity warnings;
- React pricing UI;
- Excel/Tauri persistence;
- tax/VAT, discounts, marketplace fees, charm-price rounding, or accounting posting.

## Completion gates

- dedicated scope plan before formula implementation ✅
- authoritative fail-closed validation ✅
- all three pricing methods deterministic ✅
- zero denominator diagnostics explicit `null` ✅
- no domain rounding ✅
- legacy pricing wrappers delegate to authoritative engine ✅
- implementation CI ✅
- final feature-head CI ✅
- PR #98 CI ✅
- exact post-merge `develop` CI ✅
- documentation-only closeout branch created ✅

Final closeout PR/final `develop` CI are recorded by the Phase 4 tracker after merge.

## Next task

**4.1C — Financial Profile Repository & Application Services — NEXT / NOT STARTED**

Do not begin 4.1C until the 4.1B closeout PR is merged and exact final `develop` CI is green.
