# Phase 4.1B — Pricing Formula & Validation Engine

## Status

**IMPLEMENTED — MERGE GATE PENDING**

Authoritative base:

`develop` @ `ef06ea91caf4d0edd1d41eaf5bebf9791d9ff9f3`

Feature branch:

`feature/phase-4-1b-pricing-formula-validation-engine`

Development plan:

`docs/PHASE_4_1B_PRICING_FORMULA_VALIDATION_ENGINE_PLAN.md`

## Delivered engine

### Authoritative pricing validation

`src/domain/pricing.ts` now owns the Phase 4 pricing validation and formula contract.

Added typed `PricingError` handling for:

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

All financial inputs must be finite. Unit cost and selling price must be non-negative.

Canonical percentage rates remain decimal values such as `0.50` for 50%.

### Selling-price formulas

Authoritative formulas:

```text
fixed profit:
sellingPrice = unitCost + profitAmount

markup:
sellingPrice = unitCost × (1 + markupRate)

target margin:
sellingPrice = unitCost / (1 - targetMarginRate)
```

A target margin of 100% or greater now fails closed with `INVALID_MARGIN_RATE` instead of returning the old fake zero price.

Negative fixed-profit/markup values now fail rather than being silently clamped to zero.

Derived non-finite selling prices also fail closed.

### Unit economics diagnostics

Added:

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

An externally supplied selling price below cost is allowed for diagnostic loss analysis as long as the price itself is finite and non-negative.

### Precision

The pricing domain performs no currency or percentage rounding.

Repeating values such as a 25% target-margin price remain full-precision domain numbers. PHP display formatting remains a later UI concern.

### Legacy costing compatibility

`src/domain/costing.ts` retains the old public exports:

```text
sellingPrice()
profitPerPiece()
```

but both now delegate to the authoritative Phase 4 engine.

This preserves source compatibility while intentionally hardening behavior:

- invalid margin throws instead of returning zero;
- negative pricing value throws instead of clamping;
- invalid unit cost/price throws.

`totalUnitCost()` and `plannedTotals()` remain unchanged because their authoritative Phase 4 replacements belong to 4.2 and 4.4.

## Focused tests

Updated:

- `src/domain/pricing.test.ts` — 50 tests;
- `src/domain/costing.test.ts` — 12 tests.

Coverage includes:

- supported pricing-method vocabulary;
- policy cloning;
- valid policy values for all methods;
- non-finite policy rejection;
- negative fixed profit rejection;
- negative markup rejection;
- negative / 100% / over-100% target margin rejection;
- corrupted unsupported method rejection;
- unit-cost validation;
- selling-price validation;
- all three selling-price formulas;
- zero-value policies;
- full-precision non-rounded results;
- derived non-finite price rejection;
- profit-per-unit calculation;
- loss diagnostics;
- effective markup/margin;
- zero-denominator `null` behavior;
- consolidated unit-economics snapshots;
- legacy wrapper delegation and fail-closed regression behavior.

## Validation evidence

Implementation head:

`d699f1ac11794a47a026290aa3ef2e963d84f2f4`

CI:

`34934079592 — SUCCESS`

Observed automated surface:

```text
57 test files passed
698 tests passed
50 pricing engine tests
12 legacy costing regression tests
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

## Merge gates remaining

1. Update development plan to implementation-complete / merge-gate-pending.
2. Require clean final documented feature-head CI.
3. Verify diff against exact starting `develop` is limited to 4.1B pricing engine/tests/docs.
4. Open implementation PR to `develop`.
5. Require independent PR CI on unchanged expected head.
6. Merge with expected-head protection.
7. Require exact post-merge `develop` CI.
8. Create documentation-only closeout.
9. Mark 4.1B COMPLETE / 4.1C NEXT in `docs/PHASE_4_PROGRESS.md`.
10. Require closeout PR CI and exact final `develop` CI.

## Next task

**4.1C — Financial Profile Repository & Application Services — NOT STARTED**

Do not begin 4.1C until all 4.1B merge/closeout gates pass.
