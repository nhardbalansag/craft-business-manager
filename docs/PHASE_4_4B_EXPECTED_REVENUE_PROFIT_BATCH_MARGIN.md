# Phase 4.4B — Expected Revenue / Profit / Batch Margin

## Status

**IMPLEMENTED — FEATURE VALIDATION GREEN — PENDING PR / MERGE**

Authoritative starting base:

`develop` @ `b634689bfc5b43071ff2426d3b4cb24d09e0b5aa`

Starting exact `develop` CI:

`34953319607 — SUCCESS`

Feature branch:

`feature/phase-4-4b-expected-revenue-profit-batch-margin`

Development plan:

`docs/PHASE_4_4B_EXPECTED_REVENUE_PROFIT_BATCH_MARGIN_PLAN.md`

Plan-before-code commit:

`8f19b98bcfc6c0a5f20c2459cc0d19bc0ec21463`

## Delivered capability

Phase 4.4B adds the authoritative application-level expected financial projection for a requested whole Product quantity.

The service combines completed Phase 4 boundaries rather than re-deriving their source formulas:

```text
4.3C authoritative selling price × Q
= expected revenue

expected revenue
- 4.4A authoritative physical planned production cost
= expected profit

expected profit / expected revenue
= effective batch margin when expected revenue > 0
```

The physical planned production cost remains authoritative for batch profit. Standard `profitPerUnit × Q` is exposed only as a comparison diagnostic because final-batch count rounding can make physical production cost differ from standard unit cost × quantity.

## Service boundary

Added:

`src/application/production/ExpectedBatchFinancialsService.ts`

The service consumes only:

```text
ProductPricingQuoteService-compatible provider
PhysicalPlannedBatchProductionCostService-compatible provider
```

It does not reopen financial-profile, material, calibration, component, inventory, or capacity repositories.

## Financial semantics

### Expected revenue

When the 4.3C quote is ready:

```text
expectedRevenue = sellingPrice × plannedQuantity
```

Expected revenue is independent of physical-cost readiness and may remain authoritative when pricing is ready but 4.4A is partial/not-ready.

### Expected profit

Only when both price and physical batch cost are authoritative:

```text
expectedProfit = expectedRevenue - plannedProductionCost
```

Finite negative expected profit is valid business evidence and is not sanitized to zero.

### Effective batch margin

```text
batchMargin = expectedProfit / expectedRevenue
```

when `expectedRevenue > 0`.

For zero expected revenue, `batchMargin` is `null` with an explicit diagnostic rather than Infinity/NaN.

### Planned average physical cost

When `plannedQuantity > 0`:

```text
plannedAverageCostPerFinishedUnit
= plannedProductionCost / plannedQuantity
```

For zero quantity, the field is `null` with an explicit diagnostic.

### Standard-vs-physical profit diagnostic

```text
unitProfitTimesQuantity = profitPerUnit × plannedQuantity

physicalVsUnitProfitDifference
= expectedProfit - unitProfitTimesQuantity
```

This makes the effect of 4.4A final-batch count rounding visible without creating a second profit basis.

## Readiness

The service exposes:

```text
ready
partial
not-ready
```

`ready` requires both 4.3C pricing and 4.4A physical batch cost to be ready and internally consistent.

`partial` preserves independent authoritative/known evidence while withholding expected profit unless both revenue and physical production cost are authoritative.

`not-ready` propagates required upstream not-ready state or any unsafe source contradiction/invalid numeric evidence.

## Cross-source consistency

4.4B validates and fails closed on:

- pricing quote versus physical batch Product identity mismatch;
- Product active-state mismatch;
- returned physical batch quantity mismatch;
- 4.3C cost status versus 4.4A unit-cost status mismatch;
- standard fully loaded unit-cost mismatch across retained evidence;
- invalid/non-finite ready selling price;
- invalid/non-finite ready profit-per-unit evidence;
- invalid/non-finite ready physical planned production cost;
- non-finite derived revenue/profit/margin/average/diagnostic values.

On a cross-source contradiction, top-level authoritative/derived financial values are withheld while the complete nested source evidence remains inspectable.

## Result contract

`ExpectedBatchFinancialsResult` exposes:

```text
productId
productName
productIsActive
status
plannedQuantity
pricingQuote
physicalBatchCost
sellingPrice
profitPerUnit
plannedProductionCost
expectedRevenue
expectedProfit
batchMargin
plannedAverageCostPerFinishedUnit
unitProfitTimesQuantity
physicalVsUnitProfitDifference
reconciliation
issues
```

The retained 4.3C and 4.4A results are defensively cloned.

## Error behavior

Known request-level failures are translated to controlled 4.4B application errors:

```text
PRODUCT_NOT_FOUND
INVALID_PLANNED_QUANTITY
PRODUCTION_REQUIREMENT_INVALID
```

Known 4.4A quantity/requirement errors preserve `plannedQuantity` and the underlying Phase 2 code where available. Unexpected provider/infrastructure errors propagate unchanged.

## Shared application session

Updated:

`src/application/session.ts`

The shared session now exposes:

```text
expectedBatchFinancialsService
```

wired over:

```text
productPricingQuoteService
physicalPlannedBatchProductionCostService
```

## Validation history

### Compile/wiring checkpoint

Service implementation commit:

`3283328c21c36f25cfafa739aaa0e235001ec603`

Shared-session wiring / checkpoint head:

`d6eaf6abd464306ea9eed0fd02c35588af9696f6`

Checkpoint CI:

`34953761406 — SUCCESS`

This established that the new service contract and application-session wiring typechecked, regressed against the existing suite, and built successfully before the focused 4.4B behavioral matrix was finalized.

### Initial focused-test gate

Focused service-test commit:

`4d26032126c00df78973fcd1294b0ec42b4b710f`

Session-test head:

`1a1a31a35b448f8ff64739d178e7208adc216ea5`

CI:

`34953949082 — FAILURE`

The failure occurred during TypeScript typecheck before tests executed. The only problem was a test fixture that set `ProductFinancialProfile.notes` to `null`, while the source contract defines it as optional `string | undefined`.

The production 4.4B service had already passed typecheck/build in the earlier checkpoint; no production behavior was weakened or changed to resolve this fixture error.

### Corrected focused-test validation

Corrected feature head:

`d8ca649aee3f4c782a74c707b000025145f5f0e9`

Corrected CI:

`34954110739 — SUCCESS`

Validation:

```text
TypeScript typecheck                  PASS
75 test files                         PASS
907 tests                             PASS
22 ExpectedBatchFinancialsService tests PASS
1 Phase 4.4B shared-session wiring test PASS
production Vite build                 PASS
108 modules transformed
```

## Focused coverage

4.4B tests cover:

- ready expected revenue/profit/margin/average physical cost;
- deterministic financial reconciliation;
- physical final-batch rounding changing expected profit versus `profitPerUnit × Q`;
- explicit physical-vs-standard profit difference;
- valid negative physical batch profit/margin;
- zero-quantity safe behavior;
- zero-revenue batch-margin diagnostic;
- zero-quantity average-cost diagnostic;
- zero-selling-price safe behavior;
- archived Product inspectability;
- ready pricing plus partial physical cost preserving expected revenue while withholding profit;
- partial and not-ready propagation;
- Product identity, active-state, quantity, cost-status, and unit-cost consistency guards;
- invalid selling-price/unit-profit/physical-cost evidence;
- non-finite derived revenue protection;
- Product-not-found and planned-quantity/production-requirement error translation;
- unexpected-provider error propagation;
- complete defensive cloning of retained 4.3C and 4.4A evidence;
- canonical Product identity passed to 4.4A;
- shared application-session wiring.

## Scope boundaries retained

Phase 4.4B does not implement:

- capacity feasibility or warning synthesis;
- limiting-resource lookup;
- requested-quantity auto-clamping;
- inventory reservation/deduction/posting;
- production posting/history;
- accounting entries;
- tax/VAT/discount/marketplace-fee logic;
- alternative selling-price derivation;
- financial-profile writes;
- React UI;
- Excel persistence;
- Tauri integration;
- presentation rounding/formatting.

## Remaining completion gates

Before 4.4B may be marked COMPLETE:

```text
final documented feature-head CI
implementation PR CI
expected-head merge to develop
exact post-merge develop CI
documentation-only closeout PR CI
expected-head closeout merge
exact final develop CI
```

Only after those gates should the roadmap advance to:

```text
4.4C — Capacity Feasibility & Warning Synthesis — NEXT / NOT STARTED
```
