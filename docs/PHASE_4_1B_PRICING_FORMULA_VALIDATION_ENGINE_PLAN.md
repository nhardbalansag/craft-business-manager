# Phase 4.1B — Pricing Formula & Validation Engine Development Plan

## Status

**PLANNED — IMPLEMENTATION NOT STARTED**

Authoritative base:

`develop` @ `ef06ea91caf4d0edd1d41eaf5bebf9791d9ff9f3`

Starting exact `develop` CI:

`34932882849 — SUCCESS`

Feature branch:

`feature/phase-4-1b-pricing-formula-validation-engine`

Master plan:

`docs/PHASE_4_PRICING_PRODUCTION_PLANNING_PLAN.md`

## Objective

Turn the Phase 4 pricing source vocabulary established in 4.1A into the authoritative pure-domain pricing formula and validation engine.

4.1B must provide deterministic, full-precision formulas for:

- fixed profit amount;
- markup rate;
- target margin rate;
- selling price;
- profit per unit;
- effective markup;
- effective margin;
- explicit zero-denominator handling.

Invalid pricing inputs must fail closed with typed domain errors. No invalid target margin may become a fake `0` selling price.

## Split assessment

No deeper formal roadmap split is required.

4.1B is one cohesive pure-domain task. Internal slices are:

1. typed pricing error/validation contract;
2. validated selling-price formulas;
3. unit-profit and ratio diagnostics;
4. compatibility delegation from legacy `costing.ts` pricing helpers;
5. focused deterministic tests and regression validation.

Application readiness/quote orchestration belongs to 4.3. Financial-profile persistence/application services belong to 4.1C. Fully loaded product cost belongs to 4.2.

## Existing architecture reviewed

### Phase 4 pricing source domain

`src/domain/pricing.ts` currently owns:

```text
PRICING_METHODS
PricingMethod
PricingPolicy
isPricingMethod()
clonePricingPolicy()
```

4.1A intentionally deferred numeric policy validation and formulas to this task.

### Legacy generic costing helpers

`src/domain/costing.ts` currently exposes:

```text
sellingPrice(unitCost, pricing)
profitPerPiece(unitCost, price)
```

The current legacy behavior is not acceptable as the authoritative Phase 4 contract because:

- negative policy values are silently clamped to zero;
- target margin `>= 1` returns a fake `0` price;
- non-finite financial inputs are not rejected explicitly;
- zero-denominator ratio diagnostics do not exist.

`totalUnitCost()` and `plannedTotals()` are deliberately out of scope:

- authoritative fully loaded unit cost is 4.2;
- physical batch economics is 4.4.

4.1B must not repurpose those legacy helpers into later-phase behavior.

## Authoritative validation contract

Introduce a typed error such as:

```text
PricingError
```

with stable codes covering at least:

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

### Policy validation

For all policies:

- method must be one of the 4.1A supported methods;
- `value` must be finite.

Method-specific rules:

```text
profit-amount:   value >= 0
markup-percent:  value >= 0
margin-percent:  0 <= value < 1
```

Canonical percentage values are decimal rates:

```text
0.50 = 50% markup
0.25 = 25% target margin
```

4.1B does not accept human `50` as 50%; UI conversion belongs later.

### Unit-cost validation

Any authoritative pricing calculation receiving `unitCost` must require:

```text
finite
>= 0
```

No clamping, coercion, or rounding.

### Selling-price validation for diagnostics

Any public diagnostic accepting an externally supplied selling price must require:

```text
finite
>= 0
```

Derived selling price from a valid unit cost/policy should naturally satisfy this condition.

## Authoritative formulas

### Fixed profit amount

```text
sellingPrice = unitCost + profitAmount
```

### Markup

```text
sellingPrice = unitCost × (1 + markupRate)
```

### Target margin

```text
sellingPrice = unitCost / (1 - targetMarginRate)
```

A target margin of `1`, above `1`, or below `0` is invalid and must throw/fail closed.

### Profit per unit

```text
profitPerUnit = sellingPrice - unitCost
```

### Effective markup

```text
effectiveMarkup = profitPerUnit / unitCost
```

when `unitCost > 0`.

When `unitCost === 0`, return `null` rather than `Infinity`, `NaN`, or an invented ratio.

### Effective margin

```text
effectiveMargin = profitPerUnit / sellingPrice
```

when `sellingPrice > 0`.

When `sellingPrice === 0`, return `null`.

## Proposed pure-domain API

The exact names may be refined during implementation, but the contract should remain equivalent to:

```ts
validatePricingPolicy(policy): void
validatePricingUnitCost(unitCost): void
validatePricingSellingPrice(price): void

deriveSellingPrice(unitCost, policy): number
calculateProfitPerUnit(unitCost, sellingPrice): number
calculateEffectiveMarkup(unitCost, sellingPrice): number | null
calculateEffectiveMargin(unitCost, sellingPrice): number | null

deriveUnitEconomics(unitCost, policy): {
  sellingPrice: number;
  profitPerUnit: number;
  effectiveMarkup: number | null;
  effectiveMargin: number | null;
}
```

A consolidated economics helper is useful because it guarantees all diagnostics are derived from one validated price result without repeated caller formulas.

## Precision policy

4.1B must not round monetary values or rates.

Examples such as a 25% target margin may produce repeating decimal prices. Full JavaScript numeric precision is retained in domain/application math.

PHP two-decimal formatting belongs to presentation/UI phases.

## Legacy compatibility policy

`src/domain/costing.ts` may retain the existing exports:

```text
sellingPrice()
profitPerPiece()
```

for source compatibility, but they must delegate to the authoritative `pricing.ts` implementation rather than retain duplicate formulas.

Behavioral hardening is intentional:

- invalid negative policy values must now fail rather than clamp;
- invalid margin must now fail rather than return `0`;
- invalid non-finite unit cost/price must fail.

No compatibility wrapper may preserve the old misleading invalid behavior.

## Focused test matrix

### Policy validation

- all three supported methods accepted with valid values;
- non-finite value rejected for every method;
- negative fixed profit rejected;
- negative markup rejected;
- negative target margin rejected;
- target margin exactly `1` rejected;
- target margin above `1` rejected;
- corrupted unsupported method rejected.

### Unit-cost validation

- zero unit cost accepted;
- positive unit cost accepted;
- negative unit cost rejected;
- `NaN`, `Infinity`, `-Infinity` rejected.

### Selling price formulas

- fixed-profit deterministic example;
- zero fixed profit;
- markup deterministic example;
- zero markup;
- target-margin deterministic example;
- zero target margin;
- no domain rounding.

### Profit and diagnostics

- profit per unit derived correctly;
- effective markup derived correctly;
- effective margin derived correctly;
- zero unit cost returns `null` effective markup;
- zero selling price returns `null` effective margin;
- invalid external selling price rejected.

### Consolidated unit economics

- result contains one derived selling price plus consistent profit/markup/margin values;
- zero-cost/zero-price cases produce explicit null diagnostics.

### Legacy wrappers

- `costing.sellingPrice()` delegates to authoritative valid formula behavior;
- invalid margin no longer returns fake zero;
- `costing.profitPerPiece()` follows authoritative validated profit behavior.

## Expected files

Likely source changes:

```text
src/domain/pricing.ts
src/domain/pricing.test.ts
src/domain/costing.ts
src/domain/costing.test.ts
docs/PHASE_4_1B_PRICING_FORMULA_VALIDATION_ENGINE.md
docs/PHASE_4_1B_PRICING_FORMULA_VALIDATION_ENGINE_PLAN.md
```

No repository/application/session/React file should be required.

## Explicit non-goals

4.1B does not implement:

- financial-profile repository/service/session wiring;
- Product reference existence checks;
- fully loaded product unit cost;
- safety-waste pricing cost;
- recursive child financial cost;
- readiness-aware pricing quote service;
- batch production cost;
- revenue/profit plan;
- capacity feasibility synthesis;
- React pricing UI;
- Excel/Tauri persistence;
- tax/VAT, discounts, marketplace fees, charm-price rounding, or accounting posting.

## Implementation order

1. Create this plan before formula changes. ✅
2. Add typed pricing validation/error contract.
3. Add authoritative selling-price formulas.
4. Add unit-profit and effective markup/margin diagnostics.
5. Add consolidated unit-economics helper.
6. Delegate legacy `costing.ts` pricing exports to the new engine.
7. Add/update focused tests.
8. Run full CI.
9. Create implementation record and advance plan to merge-gate-pending.
10. Require clean documented-head CI.
11. Verify diff against exact starting `develop`.
12. Open implementation PR to `develop`.
13. Require independent PR CI.
14. Merge with expected-head protection.
15. Require exact post-merge `develop` CI.
16. Create documentation-only closeout.
17. Mark 4.1B COMPLETE / 4.1C NEXT in `docs/PHASE_4_PROGRESS.md`.
18. Require closeout PR CI and exact final `develop` CI.

## Completion gate

4.1B is complete only when:

- policy numeric validation is authoritative and fail-closed;
- all three pricing methods use canonical decimal-rate semantics;
- invalid target margin never yields fake zero selling price;
- unit cost and externally supplied selling price reject invalid/non-finite values;
- selling-price, profit, markup, and margin formulas are deterministic;
- zero denominator diagnostics return explicit `null`;
- domain math does not round;
- legacy pricing wrappers delegate rather than duplicate formulas;
- focused tests, full tests, typecheck, and production build pass;
- implementation PR and exact post-merge `develop` CI pass;
- closeout PR and exact final `develop` CI pass.

## Next task after completion

**4.1C — Financial Profile Repository & Application Services — NEXT / NOT STARTED**

Do not begin 4.1C until 4.1B is fully merged, closed out, and exact final `develop` CI is green.
