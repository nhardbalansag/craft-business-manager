# Phase 4.5A — Product Financial Profile Editor

## Status

**IMPLEMENTED — FEATURE VALIDATED — PR NOT YET MERGED**

Feature branch:

`feature/phase-4-5a-product-financial-profile-editor`

Authoritative implementation base:

`develop` @ `b9a0f67a4184c7dcb9552e319b032bc8a94ec3bf`

Starting base CI:

`34961231327 — SUCCESS`

Development plan:

`docs/PHASE_4_5A_PRODUCT_FINANCIAL_PROFILE_EDITOR_PLAN.md`

## Implementation outcome

Phase 4.5A adds the first user-facing Phase 4 Pricing workspace without changing any domain, application-service, repository, or persistence contract.

Added:

```text
src/ui/pricing/PricingPage.tsx
src/ui/pricing/productFinancialProfileForm.ts
src/ui/pricing/productFinancialProfileForm.test.ts
src/ui/pricing/pricing.css
```

Updated:

```text
src/App.tsx
src/App.smoke.test.tsx
```

## Top-level Pricing workspace

`src/App.tsx` now includes a dedicated top-level:

```text
Pricing
```

workspace alongside Materials, Calibration, Products, Yield, and Production.

The existing Materials workspace remains the default initial section.

Financial source fields were deliberately not added to the Products recipe/composition editor.

## Authoritative service boundaries

The Pricing UI consumes the existing shared session services:

```text
productService
productFinancialProfileService
```

Reads:

```text
productService.listProducts()
productFinancialProfileService.listProfiles()
productFinancialProfileService.getProfile(...)
```

Writes:

```text
productFinancialProfileService.upsertProfile(...)
```

No UI path directly mutates repositories or source arrays.

No new repository/service graph was created.

## Product selection and archived visibility

The Product catalog supports:

```text
active
archived
all
```

status filters plus Product name/ID search.

Each row/card shows:

- Product name;
- Product ID;
- Product category;
- Active / Archived status;
- Configured / Not configured financial-profile status.

Archived Products remain selectable and editable, consistent with the completed Phase 4.1C application contract.

4.5A does not expose Product archive/activate actions.

## Missing profile versus explicit zero

The UI preserves the authoritative source distinction:

```text
missing profile != explicit zero-cost profile
```

A Product with no profile loads this form state:

```text
laborCostPerUnit = ''
overheadCostPerUnit = ''
pricingMethod = unconfigured
pricingValue = ''
notes = ''
```

The editor explicitly tells the user that no source profile exists and that `0` should be entered only when zero labor/overhead is intentional.

An existing profile with:

```text
laborCostPerUnit = 0
overheadCostPerUnit = 0
```

loads visible `0` values and remains known-zero evidence.

## Pricing-method controls

The UI exposes:

```text
Not configured
Fixed profit amount
Markup percentage
Target margin percentage
```

Mappings remain authoritative:

```text
Not configured           -> pricingPolicy = null
Fixed profit amount      -> profit-amount
Markup percentage        -> markup-percent
Target margin percentage -> margin-percent
```

Pricing can remain unconfigured while explicit labor/overhead source values are saved.

There is no profile-delete/reset operation because the completed 4.1C contract intentionally defines no delete contract.

## PHP / percentage UI boundary

Labor and overhead inputs are labeled:

```text
Labor cost per unit (PHP)
Overhead cost per unit (PHP)
```

Fixed-profit policy is labeled:

```text
Profit per unit (PHP)
```

Percentage policies are labeled:

```text
Markup (%)
Target margin (%)
```

The pure UI conversion helper converts:

```text
human percentage / 100 -> canonical decimal rate
canonical decimal rate * 100 -> human percentage
```

Examples:

```text
50 -> 0.50 -> 50
25 -> 0.25 -> 25
```

No derived selling-price/profit math occurs in the UI helper.

## Form conversion and validation

`src/ui/pricing/productFinancialProfileForm.ts` owns only UI-form mapping concerns.

It preserves string form state so blank remains distinct from zero.

It rejects locally before save:

- blank labor cost;
- blank overhead cost;
- blank configured policy value;
- non-finite numeric text.

It does not clamp/sanitize negative or invalid domain ranges. Those continue into the authoritative service/domain validation path, where existing:

```text
ProductFinancialProfileError
PricingError
ProductFinancialProfileApplicationError
```

fail closed and are surfaced as textual editor feedback.

## Save and reload flow

The save flow is:

```text
form state
  -> ProductFinancialProfile source mapping
  -> productFinancialProfileService.upsertProfile(...)
  -> productFinancialProfileService.getProfile(...)
  -> reload authoritative saved profile into form/list state
```

The selected Product remains selected after save.

Success and validation/error feedback are displayed textually.

## Responsive UI

Desktop uses a two-column layout:

```text
Product catalog | Financial profile editor
```

Narrow layouts stack the panels.

The page reuses existing application panel/form/button/feedback styles and adds only Pricing-specific selector/editor/status styling.

No new frontend dependency or design system was introduced.

## Explicit 4.5B+ boundary

4.5A does not display or calculate:

- fully loaded unit cost;
- direct-material/safety-reserve breakdown;
- purchased/handmade component cost breakdown;
- selling price;
- profit per unit;
- effective markup/margin;
- requested production quantity;
- planned production cost;
- expected revenue/profit;
- capacity warnings/limiters.

Those remain 4.5B/4.5C concerns.

## Validation

Validated feature checkpoint:

`8e8cdf8ac3cbede360b0212ac50421e398dce975`

CI:

`34962216103 — SUCCESS`

Validation result:

```text
TypeScript typecheck passed
78 test files passed
955 tests passed
13 dedicated Phase 4.5A form-mapping tests passed
8 React workspace smoke tests passed
production Vite build passed
112 modules transformed
```

### Dedicated form-mapping coverage

The 13 focused tests verify:

- missing profile -> blank explicit-cost inputs;
- explicit zero remains visible zero;
- fixed PHP profit round-trip;
- markup decimal/percent conversion;
- margin decimal/percent conversion;
- higher-precision percentage preservation without fixed two-decimal formatting;
- unconfigured policy -> `null`;
- blank labor rejection;
- blank overhead rejection;
- blank configured policy-value rejection;
- non-finite numeric rejection;
- notes normalization;
- clear PHP/% labels and help text.

### React smoke coverage

The repository smoke suite now verifies:

- top-level Pricing navigation exists;
- Pricing workspace renders without browser-side effects;
- Product catalog/search shell exists;
- labor/overhead PHP fields exist;
- pricing method and unconfigured option exist;
- save action exists;
- human-percentage guidance is visible.

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
8. only then advance the roadmap to 4.5B.
