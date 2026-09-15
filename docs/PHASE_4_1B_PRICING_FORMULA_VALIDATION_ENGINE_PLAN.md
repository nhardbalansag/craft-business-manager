# Phase 4.1B — Pricing Formula & Validation Engine Development Plan

## Status

**IMPLEMENTED — MERGE GATE PENDING**

Authoritative base:

`develop` @ `ef06ea91caf4d0edd1d41eaf5bebf9791d9ff9f3`

Starting exact `develop` CI:

`34932882849 — SUCCESS`

Feature branch:

`feature/phase-4-1b-pricing-formula-validation-engine`

Implementation record:

`docs/PHASE_4_1B_PRICING_FORMULA_VALIDATION_ENGINE.md`

Master plan:

`docs/PHASE_4_PRICING_PRODUCTION_PLANNING_PLAN.md`

## Objective

Make the Phase 4 pricing source vocabulary authoritative for validated fixed-profit, markup, and target-margin formulas plus unit-profit/markup/margin diagnostics.

Invalid financial input must fail closed. Domain calculations retain full precision and never round for UI display.

## Split assessment

No deeper formal split was required.

4.1B remained one cohesive pure-domain task. Application readiness/quote orchestration remains 4.3; profile persistence/application services remain 4.1C; fully loaded Product cost remains 4.2.

## Delivered architecture

### Typed pricing errors and validation

`src/domain/pricing.ts` now exposes `PricingError` with stable codes for:

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

Authoritative policy rules:

```text
profit-amount:   value >= 0
markup-percent:  value >= 0
margin-percent:  0 <= value < 1
```

All values must be finite. Unit cost and selling price must be non-negative.

Percentage values use canonical decimal rates such as `0.50` for 50%.

### Authoritative formulas

```text
fixed profit:
sellingPrice = unitCost + profitAmount

markup:
sellingPrice = unitCost × (1 + markupRate)

target margin:
sellingPrice = unitCost / (1 - targetMarginRate)
```

Invalid target margin fails closed instead of returning fake zero.

Negative pricing values fail instead of being silently clamped.

Derived non-finite prices are rejected.

### Unit economics

Delivered:

```text
calculateProfitPerUnit()
calculateEffectiveMarkup()
calculateEffectiveMargin()
deriveUnitEconomics()
```

Zero-denominator policy:

```text
unitCost == 0      -> effectiveMarkup = null
sellingPrice == 0  -> effectiveMargin = null
```

No Infinity/NaN sentinel is produced.

### Precision

No domain rounding was added. Repeating target-margin results retain full JavaScript numeric precision.

### Legacy compatibility

`src/domain/costing.ts` retains:

```text
sellingPrice()
profitPerPiece()
```

but both now delegate to `pricing.ts`.

This intentionally changes invalid legacy behavior from sanitize/fake-zero to typed failure.

`totalUnitCost()` and `plannedTotals()` remain unchanged because authoritative replacements belong to 4.2 and 4.4.

## Files changed

```text
docs/PHASE_4_1B_PRICING_FORMULA_VALIDATION_ENGINE_PLAN.md
docs/PHASE_4_1B_PRICING_FORMULA_VALIDATION_ENGINE.md
src/domain/pricing.ts
src/domain/pricing.test.ts
src/domain/costing.ts
src/domain/costing.test.ts
```

## Test coverage

```text
src/domain/pricing.test.ts  50 tests
src/domain/costing.test.ts  12 tests
```

Coverage includes policy validation, finite/non-negative numeric validation, all three price formulas, zero policies, invalid margins, full precision, non-finite result rejection, profit/loss diagnostics, zero-denominator null behavior, consolidated unit economics, and legacy wrapper delegation.

## Validation evidence

Implementation head:

`d699f1ac11794a47a026290aa3ef2e963d84f2f4`

Implementation CI:

`34934079592 — SUCCESS`

Observed automated surface:

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

4.1B did not implement:

- financial-profile repository/service/session wiring;
- Product reference checks;
- fully loaded Product cost;
- safety-waste pricing cost;
- recursive child financial cost;
- readiness-aware pricing quote service;
- batch production financials;
- capacity warnings;
- React pricing UI;
- Excel/Tauri persistence;
- tax/VAT, discounts, marketplace fees, price-rounding policy, or accounting posting.

## Remaining lifecycle

Completed:

1. dedicated plan before formula changes ✅
2. typed pricing validation/error contract ✅
3. authoritative selling-price formulas ✅
4. profit/markup/margin diagnostics ✅
5. consolidated unit-economics helper ✅
6. legacy compatibility delegation ✅
7. focused tests ✅
8. full implementation CI ✅
9. implementation record ✅

Remaining:

10. clean documented feature-head CI;
11. scope compare against exact starting `develop`;
12. implementation PR to `develop`;
13. independent PR CI;
14. merge with expected-head protection;
15. exact post-merge `develop` CI;
16. documentation-only closeout;
17. mark 4.1B COMPLETE / 4.1C NEXT;
18. closeout PR CI and exact final `develop` CI.

## Completion gate

4.1B is complete only when all implementation and closeout gates pass and the tracker advances to:

```text
4.1B — Pricing Formula & Validation Engine            COMPLETE
4.1C — Financial Profile Repository & Application Services NEXT
```

## Next task after completion

**4.1C — Financial Profile Repository & Application Services — NEXT / NOT STARTED**

Do not begin 4.1C until 4.1B is fully merged, closed out, and exact final `develop` CI is green.
