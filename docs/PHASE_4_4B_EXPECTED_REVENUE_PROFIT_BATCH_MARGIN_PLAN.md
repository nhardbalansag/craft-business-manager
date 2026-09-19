# Phase 4.4B — Expected Revenue / Profit / Batch Margin Development Plan

## Status

**COMPLETE — IMPLEMENTED, MERGED, AND POST-MERGE VALIDATED**

Authoritative starting base:

`develop` @ `b634689bfc5b43071ff2426d3b4cb24d09e0b5aa`

Starting exact `develop` CI:

`34953319607 — SUCCESS`

Feature branch:

`feature/phase-4-4b-expected-revenue-profit-batch-margin`

Previous completed task:

`4.4A — Physical Planned Batch Production Cost — COMPLETE`

Master plan:

`docs/PHASE_4_PRICING_PRODUCTION_PLANNING_PLAN.md`

## Objective

Provide the authoritative Phase 4 application-level financial projection for producing and selling a requested whole quantity of one Product.

The service must combine the completed pricing and physical-batch boundaries rather than re-derive their formulas:

```text
authoritative 4.3C selling price
× requested quantity Q
= expected revenue

expected revenue
- authoritative 4.4A physical planned production cost
= expected profit

expected profit / expected revenue
= effective batch margin, when expected revenue > 0
```

The result must explicitly show that physical batch profit can differ from `profitPerUnit × Q` because 4.4A uses actual final-batch count rounding while standard unit economics use precise per-unit quantities.

Phase 4.4B is financial synthesis only. It must not perform capacity feasibility, inventory mutation, persistence, accounting posting, or React presentation logic.

## Split assessment

No deeper roadmap split is required.

4.4B is one cohesive application-service/read-model capability because the required authoritative sources already exist:

- `ProductPricingQuoteService` owns the consolidated Product pricing quote, selling price, profit-per-unit, pricing readiness, and unit-economics trace;
- `PhysicalPlannedBatchProductionCostService` owns the requested physical batch cost, physical direct-material rounding, component/labor/overhead batch cost, and batch-cost readiness.

A deeper split would create artificial boundaries around a small set of batch-level derived calculations and would risk duplicating readiness/source-consistency logic.

## Locked architecture

### Primary upstream boundaries

Create one application service that consumes only:

```text
ProductPricingQuoteService-compatible provider
PhysicalPlannedBatchProductionCostService-compatible provider
```

The new service must not directly reopen:

- financial-profile repositories;
- pricing-policy repositories;
- fully loaded unit-cost repositories/services below 4.3C;
- material/yield/calibration repositories;
- component graph repositories;
- capacity services;
- inventory repositories.

### Product identity anchor and call order

Use the 4.3C pricing quote as the first Product identity resolution boundary.

Recommended call order:

1. call `quoteProduct(requestedProductId)`;
2. use the returned canonical `productId` when requesting 4.4A physical batch cost;
3. validate that the 4.4A result belongs to the same canonical Product and active-state evidence.

This preserves deterministic Product-not-found behavior while preventing independent source results from being silently combined when their Product identities disagree.

### Planned quantity contract

Do not create a new quantity-validation formula.

Delegate quantity validation to the completed 4.4A physical batch boundary, which already preserves the Phase 2 contract:

```text
finite
>= 0
whole integer
```

A quantity of `0` remains valid and must be numerically safe.

Translate known 4.4A request-level quantity errors into a controlled 4.4B application error while preserving the underlying code.

### Expected revenue

When the pricing quote is authoritative and `sellingPrice` is finite/non-negative:

```text
expectedRevenue = sellingPrice × Q
```

Expected revenue is independent of physical cost readiness.

Therefore, if pricing is ready but physical batch cost is only partial, authoritative expected revenue may remain visible while expected profit stays unresolved.

Do not use a manual/default price and do not infer selling price from unit profit.

### Expected profit

Publish authoritative expected profit only when both pricing and physical planned production cost are authoritative:

```text
expectedProfit
= expectedRevenue - plannedProductionCost
```

Expected profit may be negative.

A valid non-negative standard per-unit profit does **not** guarantee non-negative physical batch profit because final-batch count rounding can increase actual planned production cost.

Do not sanitize negative expected profit to zero.

### Effective batch margin

When authoritative expected revenue and expected profit exist and:

```text
expectedRevenue > 0
```

then:

```text
batchMargin = expectedProfit / expectedRevenue
```

When authoritative expected revenue is exactly zero:

```text
batchMargin = null
```

with an explicit zero-denominator diagnostic. Do not return Infinity or NaN and do not downgrade an otherwise ready zero-quantity/zero-revenue projection solely because this ratio is unavailable.

### Planned average physical cost per finished unit

When authoritative `plannedProductionCost` exists and:

```text
Q > 0
```

expose:

```text
plannedAverageCostPerFinishedUnit
= plannedProductionCost / Q
```

For `Q = 0`:

```text
plannedAverageCostPerFinishedUnit = null
```

with an explicit diagnostic. This is a derived physical-batch average, not a replacement for 4.2C standard `totalFullyLoadedUnitCost`.

### Standard-vs-physical profit diagnostic

To make the master-plan distinction explicit, expose the standard unit-profit comparison when 4.3C provides authoritative `profitPerUnit`:

```text
unitProfitTimesQuantity = profitPerUnit × Q
```

When authoritative expected profit also exists, expose:

```text
physicalVsUnitProfitDifference
= expectedProfit - unitProfitTimesQuantity
```

For a physical batch with no count-rounding difference this normally reconciles to zero.

When 4.4A physical cost exceeds standard unit cost × quantity due to count rounding, the difference should normally be negative by the same amount.

These fields are diagnostics only and must not become an alternate profit basis.

### Cross-source consistency guards

Fail closed instead of selecting one conflicting source when independently produced evidence disagrees.

At minimum validate:

- requested/canonical Product identity through 4.3C;
- 4.3C Product identity versus 4.4A Product identity;
- Product active-state agreement;
- returned 4.4A `plannedQuantity` equals requested quantity;
- 4.3C `costStatus` agrees with 4.4A `unitCostStatus`;
- 4.3C `totalFullyLoadedUnitCost` agrees with the 4.4A retained 4.2C total unit cost;
- a `ready` pricing quote has a finite/non-negative selling price;
- a `ready` physical batch result has a finite/non-negative `plannedProductionCost`;
- all derived revenue/cost-average/profit/margin diagnostics are finite when present;
- authoritative expected profit reconciles exactly to `expectedRevenue - plannedProductionCost` under current repository precision semantics.

Do not reject a finite negative expected profit or finite negative batch margin; those are legitimate business outcomes.

### Readiness model

Use:

```text
ready
partial
not-ready
```

Semantics:

```text
ready
  4.3C pricing quote is ready;
  4.4A physical batch cost is ready;
  identities/status/cost evidence are consistent;
  expectedRevenue and expectedProfit are authoritative;
  zero-denominator margin/average diagnostics may still be null for Q = 0.

partial
  no source contradiction exists;
  at least one required upstream source is partial;
  useful authoritative/known evidence may remain visible;
  expectedProfit is withheld unless both price and physical cost are authoritative.

not-ready
  either required upstream source is not-ready;
  or cross-source contradiction exists;
  or invalid/non-finite authoritative/derived evidence makes the projection unsafe.
```

Do not upgrade an upstream `not-ready` financial source to `partial` merely because the other source is ready.

### Partial-value policy

Top-level fields should distinguish authoritative values from nested known evidence:

- `expectedRevenue` may be authoritative when pricing is ready even if physical batch cost is partial;
- `plannedProductionCost` mirrors 4.4A authoritative total only when 4.4A is ready;
- `expectedProfit` requires both authoritative revenue and authoritative physical planned production cost;
- partial known cost evidence remains inspectable through the retained 4.4A result rather than being mislabeled as final cost/profit;
- unit pricing evidence remains inspectable through the retained 4.3C quote.

### Issue model

Create 4.4B synthesis-level issues separate from retained upstream issue arrays.

Suggested issue codes:

```text
QUOTE_BATCH_PRODUCT_MISMATCH
PRODUCT_ACTIVE_STATE_MISMATCH
BATCH_QUANTITY_MISMATCH
UNIT_COST_STATUS_MISMATCH
TOTAL_UNIT_COST_MISMATCH
PRICING_PARTIAL
PRICING_NOT_READY
BATCH_COST_PARTIAL
BATCH_COST_NOT_READY
SELLING_PRICE_INVALID
PLANNED_PRODUCTION_COST_INVALID
READY_STATE_INCONSISTENT
DERIVED_FINANCIAL_INVALID
FINANCIAL_RECONCILIATION_FAILED
ZERO_REVENUE_BATCH_MARGIN_UNAVAILABLE
ZERO_QUANTITY_AVERAGE_COST_UNAVAILABLE
```

Exact names may be refined during implementation while preserving these semantics.

### Defensive cloning

The 4.4B result must defensively clone retained upstream evidence.

At minimum clone:

- the complete 4.3C Product pricing quote and nested financial profile / 4.2C / 4.3B evidence;
- the complete 4.4A physical planned batch cost and nested Phase 2 / 4.2C / direct/component line evidence;
- synthesis-level issues.

### Precision

All math remains full precision.

Do not add:

- currency formatting;
- two-decimal rounding;
- percentage display conversion;
- charm pricing;
- tax/fee adjustments.

## Planned service contract

Create:

`src/application/production/ExpectedBatchFinancialsService.ts`

Expected top-level result shape:

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
issues
```

Exact type names may be refined during implementation while preserving these locked semantics.

## Error behavior

Create a controlled 4.4B application error for known request-level failures.

At minimum preserve:

```text
PRODUCT_NOT_FOUND
INVALID_PLANNED_QUANTITY
PRODUCTION_REQUIREMENT_INVALID
```

For quantity/production-requirement errors, retain the 4.4A/Phase 2 underlying code when present.

Unexpected programming/infrastructure failures must propagate rather than being mislabeled as readiness issues.

## Test plan

Focused tests should cover at least:

1. ready batch with no physical rounding difference;
2. expected revenue = selling price × quantity;
3. expected profit = revenue - physical planned production cost;
4. effective batch margin from authoritative expected revenue/profit;
5. planned average physical cost per finished unit for quantity > 0;
6. final-batch count rounding makes expected profit differ from `profitPerUnit × Q`;
7. physical-vs-unit-profit diagnostic exposes that difference;
8. physical rounding may produce a valid negative expected profit;
9. zero quantity returns ready zero revenue/profit when sources are otherwise ready;
10. zero quantity returns null average physical cost with explicit diagnostic;
11. zero revenue returns null batch margin with explicit diagnostic;
12. archived Product remains inspectable/plannable when evidence is valid;
13. ready pricing + partial physical cost preserves expected revenue but withholds expected profit;
14. partial pricing propagates partial readiness and withholds authoritative revenue/profit as appropriate;
15. not-ready pricing propagates not-ready;
16. not-ready physical cost propagates not-ready;
17. quote/batch Product identity mismatch fails closed;
18. Product active-state mismatch fails closed;
19. returned batch quantity mismatch fails closed;
20. unit-cost status mismatch fails closed;
21. total standard unit-cost mismatch fails closed;
22. ready quote with invalid/non-finite/negative selling price fails closed;
23. ready physical batch with invalid/non-finite/negative planned cost fails closed;
24. derived revenue overflow/non-finite result fails closed;
25. finite negative expected profit/margin remains valid rather than sanitized;
26. expected-profit reconciliation is deterministic;
27. Product-not-found translation;
28. invalid planned-quantity translation with underlying code preservation;
29. production-requirement error translation;
30. unexpected provider failures propagate;
31. complete defensive cloning of 4.3C and 4.4A retained evidence;
32. shared application-session wiring.

Then run:

```text
npm run typecheck
npm test
npm run build
```

Repository CI remains the merge gate.

## Planned files

Add:

```text
src/application/production/ExpectedBatchFinancialsService.ts
src/application/production/ExpectedBatchFinancialsService.test.ts
src/application/production/ExpectedBatchFinancialsSession.test.ts
docs/PHASE_4_4B_EXPECTED_REVENUE_PROFIT_BATCH_MARGIN.md
```

Update:

```text
src/application/session.ts
docs/PHASE_4_4B_EXPECTED_REVENUE_PROFIT_BATCH_MARGIN_PLAN.md
```

After implementation merge and exact post-merge `develop` CI, perform a documentation-only closeout updating:

```text
docs/PHASE_4_PROGRESS.md
```

Then advance to:

```text
4.4C — Capacity Feasibility & Warning Synthesis — NEXT / NOT STARTED
```

## Explicit exclusions

4.4B does not implement:

- capacity feasibility or capacity warning synthesis;
- limiting-resource lookup;
- requested-quantity auto-clamping;
- inventory reservation/deduction/posting;
- production posting/history;
- accounting entries;
- tax/VAT/discount/marketplace-fee logic;
- alternative selling-price derivation;
- Product financial-profile writes;
- React pricing/production UI;
- Excel persistence;
- Tauri integration;
- presentation rounding/formatting.

## Implementation evidence

Implementation followed this plan without introducing a deeper roadmap split.

```text
Plan-before-code commit         8f19b98bcfc6c0a5f20c2459cc0d19bc0ec21463
Service implementation          3283328c21c36f25cfafa739aaa0e235001ec603
Session/wiring checkpoint       d6eaf6abd464306ea9eed0fd02c35588af9696f6
Checkpoint CI                   34953761406 — SUCCESS
Focused service-test commit     4d26032126c00df78973fcd1294b0ec42b4b710f
Initial session-test head       1a1a31a35b448f8ff64739d178e7208adc216ea5
Initial focused-test CI         34953949082 — FAILURE (test fixture typing only: notes null vs optional string)
Corrected validation head       d8ca649aee3f4c782a74c707b000025145f5f0e9
Corrected validation CI         34954110739 — SUCCESS
Implementation record commit    bef3c09fcaa1b9cb8f13a23fea9c10239210a59f
Final documented feature head   578fc3412c53f01d7c70ad5104288faeb110666b
Final feature-head CI           34954391569 — SUCCESS
Implementation PR               #116 — MERGED
PR CI                           34954486934 — SUCCESS
Implementation merge            d12f336a9e64a32e8bd0ffbecba0b6522006b67c
Post-merge develop CI           34954576204 — SUCCESS
75 test files / 907 tests
22 ExpectedBatchFinancialsService tests
1 4.4B shared-session wiring test
TypeScript typecheck passed
production Vite build passed
108 modules transformed
```

Implementation record:

`docs/PHASE_4_4B_EXPECTED_REVENUE_PROFIT_BATCH_MARGIN.md`

## Completion gate

All implementation and post-merge validation gates above are complete. This documentation-only closeout preserves the evidence and advances only the roadmap state.

The next task is:

```text
4.4C — Capacity Feasibility & Warning Synthesis — NEXT / NOT STARTED
```

No 4.4C implementation is included in this closeout.
