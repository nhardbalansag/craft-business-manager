# Phase 4.3C — Product Pricing Quote & Readiness Service Development Plan

## Status

**PLANNED — IMPLEMENTATION NOT STARTED**

Authoritative starting base:

`develop` @ `c19307ba99b18b35e1edbc46b3dede159700714e`

Starting exact `develop` CI:

`34945306955 — SUCCESS`

Feature branch:

`feature/phase-4-3c-product-pricing-quote-readiness`

Previous completed task:

`4.3B — Profit / Markup / Margin Metrics — COMPLETE`

Master plan:

`docs/PHASE_4_PRICING_PRODUCTION_PLANNING_PLAN.md`

## Objective

Provide one authoritative application-level Product pricing quote/readiness view suitable for Phase 4 UI, later reporting, and downstream planning.

The view consolidates existing completed Phase 4 evidence without inventing new financial formulas:

```text
Product identity
+ Product financial-profile evidence
+ full Phase 4.2C fully loaded unit-cost result
+ Phase 4.3A selling-price evidence carried through 4.3B
+ Phase 4.3B profit / markup / margin diagnostics
= Product pricing quote/readiness view
```

The service must remain a read-model/orchestration boundary. It must not become a second costing or pricing engine.

## Split assessment

No deeper roadmap split is required.

4.3C is one cohesive orchestration capability. The correct boundary is a single application service that assembles and validates already-authoritative upstream evidence.

Do not split 4.3C into formula, storage, or UI subphases because:

- all financial formulas already belong to 4.1B;
- authoritative fully loaded cost already belongs to 4.2C;
- selling price already belongs to 4.3A;
- unit-economics metrics already belong to 4.3B;
- persistence is Phase 5 work;
- UI remains Phase 4.5.

## Locked architecture

### Upstream dependencies

The quote service should consume:

```text
ProductFinancialProfileService-compatible provider
FullyLoadedProductUnitCostService-compatible provider
ProfitMarkupMarginMetricsService-compatible provider
```

4.3C should not duplicate direct calls into lower-level material, component, recipe, calibration, or pricing-formula services.

4.3B remains the authoritative unit-economics boundary and internally carries 4.3A selling-price semantics.

### Product identity

The Phase 4.2C cost result is the canonical Product identity/evidence anchor for the quote because it already resolves the Product record and exposes:

```text
productId
productName
productIsActive
```

The requested Product ID must match the canonical cost-result Product identity case-insensitively.

The financial profile and unit-economics result must also resolve to the same Product identity.

Any identity contradiction fails closed.

### Financial-profile evidence

The quote exposes the complete defensively cloned Product financial profile when present:

```text
productId
laborCostPerUnit
overheadCostPerUnit
pricingPolicy
notes
```

A missing profile remains explicit `null` evidence and must not be replaced by a synthetic zero-cost profile.

### Cost evidence

Expose the complete Phase 4.2C `FullyLoadedProductUnitCostResult` as a nested result so the UI/reporting layer can inspect:

- direct-material result and mode;
- Material-backed component lines;
- Product-backed recursive component lines;
- labor and overhead;
- known subtotal;
- authoritative total fully loaded unit cost;
- upstream issues and readiness.

Do not flatten away diagnostic detail.

### Selling-price and metrics evidence

Use the Phase 4.3B result as the source for:

```text
pricingPolicy
sellingPrice
profitPerUnit
effectiveMarkup
effectiveMargin
cost-to-price reconciliation
selling-price status
metrics status
upstream selling-price issues
metrics issues
```

Do not recalculate these values in 4.3C.

### Quote convenience fields

For UI/reporting ergonomics, the top-level result may expose convenience mirrors of the authoritative nested evidence:

```text
totalFullyLoadedUnitCost
knownFullyLoadedUnitCostSubtotal
pricingPolicy
sellingPrice
profitPerUnit
effectiveMarkup
effectiveMargin
```

These are derived references/copies only and are never persisted source data.

### Cross-source consistency checks

Because 4.3C assembles separately retrieved read-model evidence, validate that the sources describe the same snapshot semantics.

At minimum fail closed for:

- requested Product ID versus cost-result Product identity mismatch;
- financial-profile Product identity mismatch;
- unit-economics Product identity mismatch;
- cost status mismatch between 4.2C and 4.3B evidence;
- authoritative total-cost mismatch between 4.2C and 4.3B evidence;
- known-subtotal mismatch between 4.2C and 4.3B evidence;
- configured pricing-policy mismatch between financial profile and 4.3B evidence when 4.3B exposes a policy.

Do not silently select one conflicting value.

### Readiness model

Use:

```text
ready
partial
not-ready
```

Rules:

```text
ready
  identities and cross-source evidence are consistent;
  full 4.2C cost status is ready;
  financial profile exists;
  4.3B metrics status is ready.

partial
  identities/evidence are consistent;
  meaningful quote evidence exists;
  4.3B status is partial (for example ready cost but no configured pricing policy).

not-ready
  4.3B status is not-ready;
  or any cross-source contradiction exists;
  or required Product/profile evidence is missing in a way that makes the pricing quote non-authoritative.
```

Zero-denominator diagnostics from 4.3B do not downgrade an otherwise ready quote.

### Issue model

The top-level 4.3C issues should describe quote-level orchestration/readiness problems only.

Preserve detailed source issues inside the nested 4.2C and 4.3B results rather than duplicating every upstream issue at the quote level.

Suggested quote issue codes:

```text
COST_PRODUCT_MISMATCH
FINANCIAL_PROFILE_MISSING
FINANCIAL_PROFILE_PRODUCT_MISMATCH
METRICS_PRODUCT_MISMATCH
COST_STATUS_MISMATCH
TOTAL_COST_MISMATCH
KNOWN_SUBTOTAL_MISMATCH
PRICING_POLICY_MISMATCH
UPSTREAM_PARTIAL
UPSTREAM_NOT_READY
```

### Defensive cloning

The quote must defensively clone nested source evidence so callers cannot mutate repository/provider-owned structures through the quote result.

At minimum clone:

- financial profile and nested pricing policy;
- complete 4.2C result including nested direct-material/component evidence and issues;
- complete 4.3B result including pricing policy, reconciliation, upstream issues, and metrics issues.

### Precision and persistence

All numeric values remain at full domain precision.

No currency formatting, human-percentage conversion, charm-price rounding, or persistence is introduced.

## Planned service contract

Create:

```text
src/application/pricing/ProductPricingQuoteService.ts
```

Expected result shape:

```text
productId
productName
productIsActive
status
financialProfile
fullyLoadedUnitCost
unitEconomics
knownFullyLoadedUnitCostSubtotal
totalFullyLoadedUnitCost
pricingPolicy
sellingPrice
profitPerUnit
effectiveMarkup
effectiveMargin
issues
```

The exact type names may be refined during implementation while preserving these semantics.

## Error behavior

A genuinely missing Product should remain an application error rather than a synthetic quote row.

Translate known upstream Product-not-found errors into a dedicated 4.3C application error where practical.

Unexpected infrastructure/programming errors should propagate rather than being mislabeled as readiness issues.

## Test plan

Focused tests should cover at least:

- fully ready fixed-profit quote;
- fully ready markup quote;
- fully ready target-margin quote;
- complete financial-profile evidence;
- complete 4.2C nested cost evidence is retained;
- complete 4.3B unit-economics evidence is retained;
- convenience fields mirror authoritative nested evidence;
- zero-cost / zero-price ratio diagnostics remain ready where 4.3B is ready;
- pricing-policy-missing scenario is partial;
- cost partial scenario is partial when 4.3B is partial;
- cost not-ready scenario is not-ready;
- financial profile missing remains explicit and not-ready;
- requested/cost Product identity mismatch fails closed;
- financial-profile Product identity mismatch fails closed;
- metrics Product identity mismatch fails closed;
- cost-status mismatch fails closed;
- total-cost mismatch fails closed;
- known-subtotal mismatch fails closed;
- pricing-policy mismatch fails closed;
- archived Product remains inspectable;
- defensive cloning of profile, cost evidence, unit-economics evidence, nested issues, and reconciliation;
- Product-not-found error translation;
- shared application-session wiring.

Then run:

```text
npm test
npm run typecheck
npm run build
```

Repository CI remains the merge gate.

## Planned files

Add:

```text
src/application/pricing/ProductPricingQuoteService.ts
src/application/pricing/ProductPricingQuoteService.test.ts
src/application/pricing/ProductPricingQuoteSession.test.ts
docs/PHASE_4_3C_PRODUCT_PRICING_QUOTE_READINESS.md
```

Update:

```text
src/application/session.ts
docs/PHASE_4_3C_PRODUCT_PRICING_QUOTE_READINESS_PLAN.md
```

After implementation merge and exact post-merge `develop` CI, perform a documentation-only closeout updating:

```text
docs/PHASE_4_PROGRESS.md
```

Then advance to:

```text
4.4A — Physical Planned Batch Production Cost — NEXT / NOT STARTED
```

Because completion of 4.3C completes the entire 4.3 Selling Price & Unit Economics group.

## Explicit exclusions

4.3C does not implement:

- new pricing formulas;
- new cost formulas;
- batch production cost;
- expected batch revenue/profit;
- batch margin;
- capacity feasibility/warnings;
- React pricing UI;
- persistence/Excel/Tauri integration;
- stock reservation/deduction/posting;
- tax/VAT/discount/marketplace-fee logic;
- presentation rounding/formatting.

## Completion gate

4.3C is complete only when:

- exact starting `develop` SHA and CI are recorded;
- this plan exists before implementation code;
- quote service consumes existing authoritative Phase 4 boundaries instead of duplicating formulas;
- full financial-profile, cost, and unit-economics evidence are exposed;
- cross-source consistency checks fail closed;
- readiness semantics are deterministic;
- defensive cloning is verified;
- focused tests pass;
- shared-session wiring passes;
- full typecheck/test/build validation passes;
- implementation record is complete;
- feature-head CI passes;
- implementation PR passes CI and merges from the expected head;
- exact post-merge `develop` CI passes;
- documentation closeout is merged and validated;
- only then is 4.3 marked COMPLETE and 4.4A advanced to NEXT.
