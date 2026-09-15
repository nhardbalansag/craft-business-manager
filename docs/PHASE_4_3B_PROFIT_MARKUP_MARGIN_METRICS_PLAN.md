# Phase 4.3B — Profit / Markup / Margin Metrics Development Plan

## Status

**PLANNED — IMPLEMENTATION NOT STARTED**

Authoritative starting base:

`develop` @ `57f0e339c88f2bb2a1a5ffbdc142e1a5a1c996e9`

Starting exact `develop` CI:

`34943235932 — SUCCESS`

Feature branch:

`feature/phase-4-3b-profit-markup-margin-metrics`

Master plan:

`docs/PHASE_4_PRICING_PRODUCTION_PLANNING_PLAN.md`

Previous completed task:

`4.3A — Selling Price Derivation — COMPLETE`

## Objective

Add the authoritative Phase 4.3B application boundary for Product-level unit-economics diagnostics using the completed 4.3A selling-price result as the source of cost, pricing-policy, and selling-price evidence.

For a ready 4.3A price result, derive and expose:

```text
profitPerUnit
=
sellingPrice - totalFullyLoadedUnitCost
```

```text
effectiveMarkup
=
profitPerUnit / totalFullyLoadedUnitCost
when totalFullyLoadedUnitCost > 0
```

```text
effectiveMargin
=
profitPerUnit / sellingPrice
when sellingPrice > 0
```

The service must also preserve the configured pricing method/value trace and provide an explicit cost-to-price reconciliation proving that:

```text
totalFullyLoadedUnitCost + profitPerUnit = sellingPrice
```

No derived metric is persisted as source data.

## Split assessment

No deeper roadmap split is required.

4.3B is one cohesive application capability and should remain independently reviewable from 4.3C.

Implementation work is limited to:

1. consuming the authoritative 4.3A result rather than recomputing selling price;
2. validating the minimum evidence required for trustworthy metrics;
3. delegating profit/markup/margin formulas to the completed 4.1B pricing domain;
4. emitting explicit zero-denominator diagnostics instead of Infinity/NaN;
5. preserving pricing method/value traceability;
6. exposing deterministic cost-to-price reconciliation;
7. controlled ready/partial/not-ready status and issues;
8. shared session wiring;
9. focused tests and full regression validation.

Do not combine the consolidated Product pricing quote/readiness orchestration planned for 4.3C into this phase.

## Locked design

### Authoritative input boundary

4.3B consumes a provider compatible with:

```text
SellingPriceDerivationService.deriveForProduct(productId)
```

4.3B must not directly load financial profiles or fully loaded cost services when the required evidence is already carried by 4.3A.

This keeps the dependency chain explicit:

```text
4.2C authoritative cost
↓
4.3A authoritative selling price
↓
4.3B derived unit-economics diagnostics
```

### Formula ownership

4.3B must reuse completed 4.1B domain functions:

```text
calculateProfitPerUnit()
calculateEffectiveMarkup()
calculateEffectiveMargin()
```

No duplicate pricing arithmetic should be introduced in the application layer.

### Ready metric evidence

Authoritative metrics require all of the following from 4.3A:

```text
status = ready
finite non-negative totalFullyLoadedUnitCost
finite non-negative sellingPrice
valid configured pricingPolicy
```

If any required evidence is absent or contradictory, fail closed and do not publish authoritative profit/markup/margin values.

### Zero-denominator semantics

A zero denominator is valid evidence, not a calculation failure.

```text
totalFullyLoadedUnitCost = 0
→ effectiveMarkup = null
```

```text
sellingPrice = 0
→ effectiveMargin = null
```

The result should add explicit diagnostic issues for the unavailable ratio while keeping the rest of the valid unit-economics evidence ready.

Neither case may return Infinity, -Infinity, or NaN.

### Pricing-policy trace

Expose an immutable/defensively cloned trace containing the configured pricing policy:

```text
method
value
```

Canonical percentage methods retain decimal-rate semantics:

```text
0.50 = 50% markup
0.25 = 25% margin
```

Do not convert to presentation percentages inside the domain/application result.

### Cost-to-price reconciliation

Expose a deterministic reconciliation snapshot containing at least:

```text
totalFullyLoadedUnitCost
profitPerUnit
recomposedSellingPrice
sellingPrice
reconciliationDifference
```

where:

```text
recomposedSellingPrice = totalFullyLoadedUnitCost + profitPerUnit
reconciliationDifference = sellingPrice - recomposedSellingPrice
```

With the same full-precision source values, the normal authoritative result is expected to reconcile to `0` subject only to native JavaScript floating-point representation.

No currency rounding or epsilon-based presentation adjustment is introduced in 4.3B.

### Readiness model

Use:

```text
ready
partial
not-ready
```

Guidance:

```text
ready
  4.3A ready and all core metrics derivable;
  nullable zero-denominator ratios remain an explicit ready diagnostic.

partial
  upstream 4.3A has meaningful evidence but is not price-ready.

not-ready
  upstream result is not-ready or ready state is internally contradictory/invalid.
```

### Defensive behavior

Fail closed for:

- upstream Product identity mismatch between request/result;
- ready upstream result without a valid authoritative cost;
- ready upstream result without a valid selling price;
- ready upstream result without a configured valid pricing policy;
- pricing-domain calculation errors;
- non-finite derived profit or reconciliation evidence.

Preserve upstream issues in the nested/source result or a defensively cloned equivalent so diagnostics are not lost.

### Precision

All calculations stay at full domain precision.

No PHP currency formatting, percentage formatting, charm pricing, ceiling rules, or manual rounding are introduced.

## Planned application contract

Create a dedicated service in:

```text
src/application/pricing/ProfitMarkupMarginMetricsService.ts
```

Expected result shape should include:

```text
productId
productName
productIsActive
status
upstream selling-price status/evidence
totalFullyLoadedUnitCost
sellingPrice
pricingPolicy trace
profitPerUnit
effectiveMarkup
effectiveMargin
cost-to-price reconciliation
issues
```

The final exact type names may be refined during implementation while preserving these semantics.

## Test plan

Focused tests should cover at least:

- fixed-profit pricing metrics;
- markup-policy metrics;
- target-margin metrics;
- exact pricing-policy trace preservation;
- cost-to-price reconciliation;
- full precision/no rounding;
- zero cost => null effective markup with explicit diagnostic;
- zero price => null effective margin with explicit diagnostic;
- upstream partial result remains unresolved;
- upstream not-ready result remains unresolved;
- contradictory ready result with null/invalid cost fails closed;
- contradictory ready result with null/invalid price fails closed;
- contradictory ready result with missing/invalid policy fails closed;
- requested/upstream Product identity mismatch fails closed;
- pricing-domain error translation;
- archived Product remains inspectable when upstream evidence is valid;
- defensive cloning of upstream issue/policy/reconciliation evidence;
- shared-session wiring.

Then run the complete repository validation surface:

```text
npm test
npm run typecheck
npm run build
```

and rely on repository CI as the merge gate.

## Planned files

Add:

```text
src/application/pricing/ProfitMarkupMarginMetricsService.ts
src/application/pricing/ProfitMarkupMarginMetricsService.test.ts
src/application/pricing/ProfitMarkupMarginMetricsSession.test.ts
docs/PHASE_4_3B_PROFIT_MARKUP_MARGIN_METRICS.md
```

Update:

```text
src/application/session.ts
docs/PHASE_4_3B_PROFIT_MARKUP_MARGIN_METRICS_PLAN.md
```

After implementation merge + exact post-merge `develop` CI only, perform a documentation-only closeout update to:

```text
docs/PHASE_4_PROGRESS.md
```

and advance:

```text
4.3C — Product Pricing Quote & Readiness Service — NEXT / NOT STARTED
```

## Explicit exclusions

4.3B does not implement:

- selling-price derivation changes from 4.3A;
- consolidated Product pricing quote/readiness service (4.3C);
- physical batch production cost;
- expected batch revenue/profit;
- batch margin;
- capacity feasibility/warnings;
- React pricing UI;
- financial-profile editor UI;
- stock reservation/deduction/posting;
- Excel persistence;
- Tauri integration;
- tax/VAT/discount/marketplace-fee logic;
- currency or charm-price rounding.

## Completion gate

4.3B is complete only when:

- exact starting `develop` base and CI are recorded;
- this plan exists before implementation code;
- authoritative metrics consume 4.3A evidence;
- formulas reuse 4.1B pricing-domain functions;
- zero denominators produce explicit null diagnostics;
- pricing policy trace and cost-to-price reconciliation are present;
- focused tests pass;
- shared-session wiring passes;
- full test/typecheck/build validation passes;
- implementation record is complete;
- feature-head CI passes;
- implementation PR passes CI and merges from expected head;
- exact post-merge `develop` CI passes;
- only then is the progress tracker advanced to 4.3C.
