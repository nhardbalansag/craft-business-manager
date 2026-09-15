# Phase 4.5B — Unit Economics / Pricing Calculator UI Development Plan

## Status

**PLAN ESTABLISHED — IMPLEMENTATION NOT STARTED**

Authoritative starting base:

`develop` @ `4003c5caa02e1bd2f19ac058548bc279d4dcd6fb`

Starting exact `develop` CI:

`34963245375 — SUCCESS`

Feature branch:

`feature/phase-4-5b-unit-economics-pricing-calculator-ui`

Previous completed task:

`4.5A — Product Financial Profile Editor — COMPLETE`

Master plan:

`docs/PHASE_4_PRICING_PRODUCTION_PLANNING_PLAN.md`

## Objective

Extend the dedicated Phase 4 Pricing workspace with an authoritative, read-only unit-economics calculator view for the selected Product.

The UI must consume the completed `ProductPricingQuoteService` and display the authoritative quote/readiness evidence with a readable separation of:

```text
Direct materials
Safety reserve
Purchased components
Handmade Product components
Labor
Overhead
------------------------------
Total unit cost
Pricing policy
Selling price
Profit per unit
Effective markup
Effective margin
```

Nested handmade Product-component cost paths must remain inspectable/readable without turning the UI into an accounting ledger.

4.5B is presentation/orchestration only. React must not duplicate authoritative Phase 4 cost, selling-price, profit, markup, or margin formulas.

## Split assessment

No deeper roadmap split is required.

4.5B is one cohesive UI capability because:

- `ProductPricingQuoteService` already provides the complete authoritative 4.3C read model;
- `FullyLoadedProductUnitCostResult` already carries direct-material, purchased-component, handmade-component, labor, overhead, nested trace, readiness, and issues;
- 4.5A already owns Product selection and source-profile editing in the Pricing workspace;
- 4.5B only adds read-only quote presentation for that same selected Product;
- 4.5C remains separately responsible for requested batch quantity, physical planned cost, revenue/profit, capacity feasibility, and warnings.

Implementation may use ordinary checkpoints for view-model mapping, quote UI, async refresh behavior, tests, and documentation. These are not additional roadmap phases.

## Authoritative service boundary

4.5B must consume the existing shared application service:

```text
productPricingQuoteService.quoteProduct(productId)
```

The UI must not directly call lower-level costing/pricing repositories or recompute:

- direct-material costing;
- safety-waste reserve;
- material-component costs;
- Product-component roll-up;
- fully loaded unit cost;
- selling price;
- profit per unit;
- effective markup;
- effective margin.

All authoritative values come from the returned 4.3C quote and its retained nested evidence.

## Integration with the existing Pricing workspace

Keep the 4.5A Product catalog and financial-profile editor intact.

Add a read-only unit-economics section below the existing source configuration workflow rather than creating a second Product selector.

The selected Product identity remains the shared context for:

```text
source profile editor
unit-economics quote
```

The page should make the distinction clear:

- **Financial source** — editable authoritative labor/overhead/pricing-policy inputs;
- **Unit economics** — derived authoritative read-only quote from completed Phase 4 services.

## Quote loading lifecycle

When a Product becomes selected:

1. request `productPricingQuoteService.quoteProduct(selectedProduct.id)`;
2. show a dedicated quote loading state;
3. retain the selected Product and profile form independently;
4. publish the quote only for the currently selected Product;
5. surface unexpected quote-load errors as read-only quote feedback.

Selection changes must not allow a stale in-flight quote to overwrite the newly selected Product's quote.

A simple cancellation/request-version guard is acceptable.

When a financial profile is successfully saved in 4.5A:

1. reload the authoritative profile as already implemented;
2. refresh the 4.3C quote for the same selected Product;
3. update the calculator without requiring Product reselection or page reload.

## Readiness presentation

Display top-level quote readiness explicitly:

```text
ready
partial
not-ready
```

Recommended human labels:

```text
Ready
Partial
Not ready
```

Do not infer readiness from null fields in React.

Use the authoritative quote status and nested cost/metrics statuses.

When quote values are unresolved:

- show `Unavailable` / `Not ready` rather than fake PHP 0;
- preserve known subtotal evidence when the service exposes it;
- show authoritative issue messages;
- never calculate missing values locally.

Archived Products remain inspectable if the quote service can derive their evidence.

## Monetary and percentage formatting

Formatting is UI-only.

### Money

Display resolved monetary values as PHP currency, for example:

```text
PHP 125.50
```

Use `Intl.NumberFormat` or an equivalent pure formatting helper.

Formatting must not mutate the underlying number or feed rounded values back into authoritative calculations.

### Percentages

Display canonical decimal rates as human percentages:

```text
0.25 -> 25%
0.5  -> 50%
```

Use presentation formatting only.

Do not render `Infinity`, `NaN`, or misleading `0%` for unavailable ratios. Null remains explicitly unavailable.

## Cost summary rows

The summary must use authoritative 4.2C fields rather than recomputing sums.

### Direct materials

Use retained `fullyLoadedUnitCost.directMaterialCost` evidence.

Display separately when available:

```text
Base direct materials
Safety reserve
```

Preferred authoritative values:

```text
baseDirectMaterialCostSubtotal
safetyWasteReserveCostSubtotal
```

Also show the safety-waste percentage when the direct-material result exists.

For controlled `neutral-component-only` mode, display that there are no direct-material requirements rather than inventing a missing cost.

For unresolved direct material, show the unresolved status/issues.

### Purchased components

Use:

```text
fullyLoadedUnitCost.materialComponentCostSubtotal
```

Display root Material-backed component lines from:

```text
fullyLoadedUnitCost.componentLines
  where sourceType = material
```

Each readable line may include:

- source material name/ID;
- component role;
- quantity per parent;
- cost per piece;
- component cost contribution;
- status/issues when unresolved.

### Handmade Product components

Use:

```text
fullyLoadedUnitCost.productComponentCostSubtotal
```

Display Product-backed component lines from:

```text
fullyLoadedUnitCost.componentLines
  where sourceType = product
```

Each root child line should show:

- child Product name/ID;
- component role;
- quantity per parent;
- child fully loaded unit cost when authoritative;
- component cost contribution when authoritative;
- status;
- path;
- issues.

Nested `line.breakdown` Product-backed children must remain expandable/inspectable recursively.

## Nested handmade-component presentation

Create a UI-only recursive view-model/helper for Product-backed component trace presentation.

Recommended module:

`src/ui/pricing/productPricingQuoteView.ts`

The helper should map authoritative nested evidence into stable presentation rows/nodes without deriving authoritative cost values.

Recommended node shape may include:

```text
componentId
childProductId
childProductName
role
quantityPerParent
status
path
childFullyLoadedUnitCost
componentCostContribution
knownComponentCostContribution
laborCostPerUnit
overheadCostPerUnit
materialComponentCostSubtotal
productComponentCostSubtotal
children
issues
```

The UI can render nested nodes with semantic `<details>` / `<summary>` disclosure controls or an equivalent accessible tree-like structure.

Do not flatten away the path or silently omit tied/nested unresolved issues.

## Labor and overhead

Display root authoritative:

```text
fullyLoadedUnitCost.laborCostPerUnit
fullyLoadedUnitCost.overheadCostPerUnit
```

Missing profile/unresolved financial evidence must display unavailable rather than zero.

Explicit authoritative zero must display `PHP 0.00`.

## Total unit cost

Display both where useful:

```text
knownFullyLoadedUnitCostSubtotal
totalFullyLoadedUnitCost
```

Semantics:

- `totalFullyLoadedUnitCost` is the authoritative final unit-cost basis only when provided by the service;
- `knownFullyLoadedUnitCostSubtotal` may remain visible for partial evidence but must be labeled as known subtotal, not final total.

Do not treat the known subtotal as the selling-price basis.

## Pricing-policy presentation

Display the configured pricing policy directly from:

```text
quote.pricingPolicy
```

Human labels:

```text
profit-amount   -> Fixed profit
markup-percent  -> Markup
margin-percent  -> Target margin
null            -> Not configured
```

Policy value formatting:

- fixed profit -> PHP amount;
- markup/margin -> human percentage.

Do not infer the policy from selling price or metrics.

## Selling price and unit-economics metrics

Display authoritative top-level quote mirrors:

```text
sellingPrice
profitPerUnit
effectiveMarkup
effectiveMargin
```

Use status/readiness text to explain unavailable values.

Negative profit, markup, or margin should be displayed if the authoritative service returns a finite negative business outcome; do not clamp to zero.

Zero-denominator null metrics remain explicitly unavailable.

## Issues / diagnostics

Provide a dedicated quote issue section.

Include at least:

- top-level 4.3C quote issues;
- 4.2C fully loaded cost issues;
- direct-material issues where present;
- root material-component issues;
- recursive Product-component issues.

Avoid duplicating identical text excessively in the main summary. Deep diagnostics can live inside expanded component details while top-level issues remain visible in a concise list.

## Recommended layout

Keep the existing 4.5A two-column source-editor area.

Below it, add a full-width read-only section:

```text
UNIT ECONOMICS
[ readiness badge ]

Cost composition
  Direct materials
  Safety reserve
  Purchased components
  Handmade components
  Labor
  Overhead
  ----------------
  Total unit cost

Pricing result
  Pricing policy
  Selling price
  Profit per unit
  Effective markup
  Effective margin

Component trace / issues
```

Desktop may use two read-only summary panels side by side with nested component detail below.

On narrow screens, stack all quote panels.

## View-model / formatter helper boundary

Use a pure UI helper so formatting and nested trace mapping are testable without browser DOM dependencies.

Recommended exports may include:

```text
formatPhp(...)
formatPercent(...)
pricingPolicyLabel(...)
formatPricingPolicyValue(...)
buildProductComponentTrace(...)
quoteReadinessLabel(...)
```

The helper must never perform authoritative financial aggregation.

## Tests

### Pure quote-view tests

Add focused tests covering at least:

1. PHP formatting preserves zero and finite negatives;
2. unavailable/null money remains explicit unavailable text;
3. canonical decimal markup/margin becomes human percentage;
4. null percentage remains unavailable;
5. pricing policy labels fixed-profit/markup/margin/unconfigured correctly;
6. fixed-profit policy value formats as PHP;
7. percentage policy values format as human percentages;
8. recursive Product-component trace preserves root and nested paths;
9. recursive trace preserves quantities, statuses, authoritative contribution values, and issues;
10. Material-backed breakdown does not become a Product child node;
11. no local total/profit derivation occurs in the helper.

### PricingPage smoke validation

Update static React smoke coverage to verify the read-only calculator shell contains:

- Unit economics heading;
- Cost composition;
- Direct materials;
- Safety reserve;
- Purchased components;
- Handmade Product components;
- Labor;
- Overhead;
- Total unit cost;
- Pricing policy;
- Selling price;
- Profit per unit;
- Effective markup;
- Effective margin;
- Issues / readiness area.

The shell must render without browser-side effects even before async quote loading completes.

### Regression gate

All existing 4.1–4.5A tests remain green, especially:

- `ProductPricingQuoteService` tests;
- `FullyLoadedProductUnitCostService` tests;
- recursive Product-component cost tests;
- 4.5A form-mapping tests;
- existing App smoke tests.

No new frontend dependency is required.

## Expected implementation files

Likely new files:

```text
src/ui/pricing/productPricingQuoteView.ts
src/ui/pricing/productPricingQuoteView.test.ts
```

Likely updated files:

```text
src/ui/pricing/PricingPage.tsx
src/ui/pricing/pricing.css
src/App.smoke.test.tsx
```

No application/domain/storage contract change is expected.

## Explicit non-goals / 4.5C boundary

4.5B must not implement:

- planned production quantity input;
- physical batch production cost;
- expected batch revenue;
- expected batch profit;
- batch margin;
- current capacity feasibility;
- over-capacity warnings/overage quantity;
- limiting-resource display for a planned batch;
- stock reservation/deduction;
- production-order mutation;
- Excel persistence;
- Tauri persistence.

Those remain 4.5C, Phase 5, or later concerns.

## Validation gates

Before implementation PR merge:

- dedicated quote-view helper tests pass;
- PricingPage/App smoke tests pass;
- existing 4.3C pricing quote and 4.2C costing tests remain green;
- full repository test suite passes;
- TypeScript typecheck passes;
- production Vite build passes;
- final feature-head CI is green;
- PR CI is green.

After merge:

- exact merged `develop` CI must be green before documentation closeout;
- closeout must preserve the full Phase 4 audit trail;
- roadmap advances to `4.5C — Production Financial Summary & Warnings UI — NEXT` only after closeout CI is green.

## Completion gate

4.5B is complete only when:

- selected Product automatically drives the authoritative 4.3C pricing quote;
- quote refreshes after a successful 4.5A source-profile save;
- cost composition is readable and separated by authoritative categories;
- base direct-material cost and safety reserve are separately visible when available;
- purchased and handmade Product components are separated;
- nested handmade-component paths are inspectable recursively;
- labor and overhead remain explicit;
- known subtotal is never mislabeled as authoritative final total;
- pricing policy, selling price, profit, markup, and margin come directly from 4.3C evidence;
- ready/partial/not-ready and issues are visible;
- null/unresolved evidence never becomes fake zero;
- React performs no authoritative financial formula duplication;
- focused/full tests, typecheck, build, PR CI, exact post-merge CI, and documentation closeout all pass.

## Next task after completion

`4.5C — Production Financial Summary & Warnings UI — NEXT / NOT STARTED`

Do not begin 4.5C implementation until 4.5B is fully merged, post-merge validated, documentation-closeout complete, and 4.5C receives its own scope/split assessment and development plan.
