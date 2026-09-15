# Phase 4.5B — Unit Economics / Pricing Calculator UI

## Status

**IMPLEMENTED — FEATURE VALIDATED — PR NOT YET MERGED**

Feature branch:

`feature/phase-4-5b-unit-economics-pricing-calculator-ui`

Authoritative implementation base:

`develop` @ `4003c5caa02e1bd2f19ac058548bc279d4dcd6fb`

Starting base CI:

`34963245375 — SUCCESS`

Development plan:

`docs/PHASE_4_5B_UNIT_ECONOMICS_PRICING_CALCULATOR_UI_PLAN.md`

## Implementation outcome

Phase 4.5B extends the completed 4.5A Pricing workspace with a read-only Unit Economics / Pricing Calculator UI backed exclusively by the completed Phase 4.3C `ProductPricingQuoteService`.

Added:

```text
src/ui/pricing/productPricingQuoteView.ts
src/ui/pricing/productPricingQuoteView.test.ts
src/ui/pricing/ProductPricingQuotePanel.tsx
```

Updated:

```text
src/ui/pricing/PricingPage.tsx
src/ui/pricing/pricing.css
src/App.smoke.test.tsx
```

No application, domain, repository, storage, Excel, or Tauri contract was changed.

## Authoritative quote boundary

The Pricing UI now consumes:

```text
productPricingQuoteService.quoteProduct(productId)
```

for the selected Product.

React does not recompute:

- direct-material cost;
- safety reserve;
- purchased-component cost;
- handmade Product-component fully loaded cost;
- labor/overhead aggregation;
- total fully loaded unit cost;
- selling price;
- profit per unit;
- effective markup;
- effective margin.

All displayed financial values are service-provided evidence or presentation-only formatting of that evidence.

## Pricing workspace integration

The existing 4.5A Product catalog and source-profile editor remain intact.

The page now presents two intentionally separate concepts:

```text
FINANCIAL SOURCE
editable Product labor/overhead/pricing-policy source data

UNIT ECONOMICS
read-only derived quote/readiness evidence
```

The same selected Product drives both areas. There is no duplicate Product selector.

## Quote loading and stale-result protection

When the selected Product changes, the page requests a fresh 4.3C quote.

A monotonic request-version guard ensures that a slower quote request for a previously selected Product cannot overwrite the current Product's UI state.

Selection immediately clears the previous quote before the new request is published.

Quote load errors remain isolated to the read-only calculator and do not mutate the source-profile editor.

## Refresh after source save

After a successful 4.5A financial-profile save:

```text
upsert profile
-> reload authoritative profile
-> preserve selected Product
-> refresh ProductPricingQuoteService quote
```

The user therefore sees updated fully loaded cost and pricing evidence without reselecting the Product or reloading the page.

## Cost composition

The calculator presents authoritative Phase 4.2C evidence as separate readable rows:

```text
Direct materials
Safety reserve
Purchased components
Handmade Product components
Labor
Overhead
Known cost subtotal
Total unit cost
```

### Direct materials and safety reserve

When direct-material evidence exists, the UI reads:

```text
baseDirectMaterialCostSubtotal
safetyWasteReserveCostSubtotal
safetyWasteRate
```

from the retained `WasteAdjustedDirectMaterialCostResult`.

For `neutral-component-only` mode, the UI displays:

```text
None — component-only
```

instead of inventing a monetary direct-material value.

Unresolved direct evidence remains `Unavailable`.

### Purchased components

Root Material-backed components use the authoritative 4.2C:

```text
materialComponentCostSubtotal
componentLines[sourceType=material]
```

Each line displays source material identity, role, quantity per parent, authoritative cost per piece, authoritative contribution, and issue text when present.

### Handmade Product components

Root Product-backed components use:

```text
productComponentCostSubtotal
componentLines[sourceType=product]
```

The UI displays child Product identity, role, quantity, status, path, child fully loaded unit cost, known contribution, authoritative contribution, and nested evidence.

## Recursive handmade-component trace

`src/ui/pricing/productPricingQuoteView.ts` maps the service-provided recursive breakdown into a UI-only trace structure.

Each Product node preserves:

```text
component identity
child Product identity/name
role
quantity per parent
status
path
direct-material mode
base direct-material cost
safety reserve
purchased-component subtotal
handmade-component subtotal
labor
overhead
known child subtotal
child fully loaded unit cost
known parent contribution
authoritative parent contribution
nested Material components
nested Product components
issues
```

The React panel renders Product nodes with semantic `<details>` / `<summary>` disclosure controls, allowing nested handmade paths to remain inspectable without presenting a flat accounting ledger.

Material-backed lines remain separate from Product child nodes.

## No local financial reconciliation

The quote-view helper deliberately performs no authoritative financial aggregation.

Focused regression coverage includes a deliberately non-reconciling Product-component fixture where:

```text
subtotals
known subtotal
child fully loaded total
known contribution
authoritative contribution
```

are intentionally inconsistent.

The UI helper preserves each supplied value unchanged instead of recalculating or sanitizing it. Cross-source financial consistency remains the responsibility of the completed Phase 4 application services.

## Pricing result

The read-only Pricing Result panel displays authoritative 4.3C mirrors:

```text
Pricing policy
Policy value
Selling price
Profit per unit
Effective markup
Effective margin
```

Pricing policy labels are presentation-only mappings:

```text
profit-amount   -> Fixed profit
markup-percent  -> Markup
margin-percent  -> Target margin
null            -> Not configured
```

Policy values use PHP formatting for fixed profit and human percentage formatting for markup/margin.

## Readiness and unavailable values

The UI displays top-level quote readiness:

```text
Ready
Partial
Not ready
```

and also exposes cost/selling-price/metrics status evidence.

Null or non-finite presentation inputs render:

```text
Unavailable
```

rather than fake zero, Infinity, or NaN.

Explicit authoritative zero remains visible as:

```text
PHP 0.00
0%
```

where the underlying field is an actual finite zero.

Known fully loaded subtotal remains separately labeled and is never presented as the authoritative final total unit cost.

## PHP and percentage formatting

Formatting is confined to the UI helper.

Resolved money displays as:

```text
PHP 125.50
```

Canonical decimal rates display as human percentages:

```text
0.25 -> 25%
0.50 -> 50%
```

Presentation formatting does not feed rounded values back into Phase 4 calculations.

## Issues and diagnostics

The calculator includes a dedicated Readiness & Issues section for:

- 4.3C top-level pricing quote issues;
- 4.2C fully loaded cost issues;
- direct-material issues.

Root Material-backed component issues are displayed with their component rows.

Recursive Product-component issues remain attached to their expandable Product trace nodes.

This keeps top-level diagnostics concise while retaining deep traceability.

## Responsive UI

The 4.5A source editor remains a two-column Product catalog / profile editor on desktop.

4.5B adds:

```text
[ Cost composition ] [ Pricing result ]
[ Purchased components ] [ Handmade Product components ]
[ Readiness & issues ]
```

The quote panels stack on narrower screens.

No new frontend dependency or design system was introduced.

## Explicit 4.5C boundary

4.5B does not implement:

- requested production quantity;
- physical planned production cost;
- expected revenue;
- expected batch profit;
- batch margin;
- current capacity feasibility;
- over-capacity warning/overage;
- planned-batch limiting resources;
- inventory reservation/deduction;
- production-order mutation.

Those remain Phase 4.5C concerns.

## Validation

Validated implementation head:

`1a66120dfa6a67cbccfa5e6fe48c7bdc59de4d67`

CI:

`34964259080 — SUCCESS`

Validation result:

```text
TypeScript typecheck passed
79 test files passed
967 tests passed
12 dedicated Phase 4.5B quote-view tests passed
13 Phase 4.5A form-mapping tests passed
8 React workspace smoke tests passed
production Vite build passed
114 modules transformed
```

The production build emits Vite's non-blocking warning that the main minified chunk is slightly above 500 kB. The build succeeds; code-splitting is a performance optimization concern rather than a Phase 4.5B financial-correctness blocker.

## Focused 4.5B coverage

The 12 dedicated quote-view tests verify:

- PHP zero and finite negative formatting;
- null/non-finite money remains unavailable;
- canonical decimal percentages become human percentages;
- null/non-finite percentages remain unavailable;
- pricing-policy/readiness labels;
- fixed-profit PHP policy formatting;
- markup/margin percentage policy formatting;
- recursive root/nested Product paths;
- quantities/status/contribution/issues preservation;
- Material-backed nested lines do not become Product nodes;
- deliberately non-reconciling authoritative values remain unchanged;
- root Material-backed rows preserve authoritative source values.

## Completion state

The application/UI implementation and full validation are complete on the feature branch.

Remaining gates:

1. record implementation evidence in the dedicated development plan;
2. validate the final documented feature head;
3. open implementation PR to `develop`;
4. require green PR CI and merge with expected-head guarding;
5. require exact post-merge `develop` CI success;
6. merge a documentation-only closeout;
7. require exact final closeout `develop` CI success;
8. only then advance the roadmap to 4.5C.
