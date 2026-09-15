# Phase 4.3B — Profit / Markup / Margin Metrics

## Status

**IMPLEMENTED — FEATURE VALIDATION GREEN — PENDING PR / MERGE**

Authoritative starting base:

`develop` @ `57f0e339c88f2bb2a1a5ffbdc142e1a5a1c996e9`

Starting exact `develop` CI:

`34943235932 — SUCCESS`

Feature branch:

`feature/phase-4-3b-profit-markup-margin-metrics`

Development plan:

`docs/PHASE_4_3B_PROFIT_MARKUP_MARGIN_METRICS_PLAN.md`

Plan-before-code commit:

`5b3c3544e97d5f24df1c91b28b898ff97aeface3`

Implementation commit:

`1801ae8f0ee03c012205163bd7870992c0be383c`

Implementation CI:

`34944416475 — SUCCESS`

## Delivered capability

Phase 4.3B adds the authoritative Product-level unit-economics metrics boundary over the completed 4.3A selling-price derivation.

The dependency chain is intentionally:

```text
4.2C ready fully loaded unit cost
↓
4.3A authoritative selling price
↓
4.3B profit / markup / margin diagnostics
```

The new service does not re-derive selling price and does not directly reload financial profiles or fully loaded cost services.

## Derived metrics

For ready 4.3A evidence:

```text
profitPerUnit = sellingPrice - totalFullyLoadedUnitCost
```

```text
effectiveMarkup = profitPerUnit / totalFullyLoadedUnitCost
```

when total fully loaded unit cost is greater than zero.

```text
effectiveMargin = profitPerUnit / sellingPrice
```

when selling price is greater than zero.

Formula ownership remains in the completed 4.1B pricing domain through:

```text
calculateProfitPerUnit()
calculateEffectiveMarkup()
calculateEffectiveMargin()
```

No duplicate application-layer pricing formula was introduced.

## Pricing trace

The result preserves a defensively cloned configured pricing-policy trace:

```text
method
value
```

Canonical rate semantics remain unchanged:

```text
0.50 = 50% markup
0.25 = 25% target margin
```

No presentation conversion or rounding occurs in the service.

## Cost-to-price reconciliation

The result exposes:

```text
totalFullyLoadedUnitCost
profitPerUnit
recomposedSellingPrice
sellingPrice
reconciliationDifference
```

with:

```text
recomposedSellingPrice = totalFullyLoadedUnitCost + profitPerUnit
reconciliationDifference = sellingPrice - recomposedSellingPrice
```

This provides an explicit audit trace from authoritative production cost to authoritative selling price.

## Zero-denominator semantics

Zero is preserved as valid financial evidence.

For zero cost:

```text
effectiveMarkup = null
```

and the result includes:

```text
EFFECTIVE_MARKUP_UNAVAILABLE_ZERO_COST
```

For zero selling price:

```text
effectiveMargin = null
```

and the result includes:

```text
EFFECTIVE_MARGIN_UNAVAILABLE_ZERO_PRICE
```

These cases remain `ready` when the rest of the upstream pricing evidence is valid. The service never emits Infinity or NaN as a ratio diagnostic.

## Readiness and defensive behavior

The service preserves:

```text
ready
partial
not-ready
```

Behavior:

- ready 4.3A evidence with valid cost/price/policy derives authoritative metrics;
- partial 4.3A evidence remains partial and does not publish metrics;
- not-ready 4.3A evidence remains not-ready;
- requested/upstream Product identity mismatch fails closed;
- contradictory ready evidence with invalid/null cost fails closed;
- contradictory ready evidence with invalid/null selling price fails closed;
- missing or invalid pricing policy in a ready upstream result fails closed;
- non-finite derived metrics or reconciliation evidence fail closed;
- archived Products remain inspectable when upstream pricing evidence is valid;
- upstream issue and pricing-policy evidence are defensively cloned.

## Files delivered

Added:

```text
src/application/pricing/ProfitMarkupMarginMetricsService.ts
src/application/pricing/ProfitMarkupMarginMetricsService.test.ts
src/application/pricing/ProfitMarkupMarginMetricsSession.test.ts
docs/PHASE_4_3B_PROFIT_MARKUP_MARGIN_METRICS.md
```

Updated:

```text
src/application/session.ts
```

The shared session now exposes:

```text
profitMarkupMarginMetricsService
```

wired over:

```text
sellingPriceDerivationService
```

## Validation

Implementation-head CI `34944416475` passed all repository validation gates:

```text
TypeScript typecheck — PASS
full Vitest suite — PASS
production Vite build — PASS
```

New focused coverage:

```text
19 ProfitMarkupMarginMetricsService tests
1 Phase 4.3B shared-session wiring test
```

Based on the completed 4.3A baseline of 67 test files / 807 tests, the Phase 4.3B implementation adds two test files and 20 tests, yielding:

```text
69 test files / 827 tests
```

## Scope boundaries retained

Phase 4.3B does not implement:

- changes to 4.3A selling-price derivation;
- consolidated Product pricing quote/readiness orchestration (4.3C);
- physical batch production cost;
- expected batch revenue/profit;
- batch margin;
- capacity feasibility/warnings;
- React pricing UI;
- financial-profile editor UI;
- stock mutation/reservation/deduction/posting;
- Excel persistence;
- Tauri integration;
- tax/VAT/discount/marketplace-fee logic;
- currency/charm-price rounding.

## Remaining completion gates

Before 4.3B may be marked COMPLETE:

```text
final documented feature-head CI
implementation PR CI
expected-head merge to develop
exact post-merge develop CI
documentation-only closeout
```

Only after those gates pass should the roadmap advance to:

```text
4.3C — Product Pricing Quote & Readiness Service — NEXT / NOT STARTED
```
