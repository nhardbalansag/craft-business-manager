# Phase 4.5A — Product Financial Profile Editor Development Plan

## Status

**IMPLEMENTED — FEATURE VALIDATED — PR NOT YET MERGED**

Authoritative starting base:

`develop` @ `b9a0f67a4184c7dcb9552e319b032bc8a94ec3bf`

Starting exact `develop` CI:

`34961231327 — SUCCESS`

Feature branch:

`feature/phase-4-5a-product-financial-profile-editor`

Previous completed task:

`4.4C — Capacity Feasibility & Warning Synthesis — COMPLETE`

Master plan:

`docs/PHASE_4_PRICING_PRODUCTION_PLANNING_PLAN.md`

## Objective

Add the first Phase 4 user-facing Pricing workspace so the business owner can configure the authoritative Product financial source profile through the completed Phase 4.1C application service.

The editor must let the user select a Product and manage only source configuration:

```text
labor cost per finished unit
overhead cost per finished unit
pricing policy method
pricing policy value
optional notes
```

The editor must preserve the distinction between:

```text
missing profile
explicit zero labor/overhead profile
configured pricing policy
explicitly unconfigured pricing policy
```

4.5A does not display or recalculate the fully loaded quote, selling price, profit, markup, margin, planned batch financials, or capacity warnings. Those belong to 4.5B/4.5C.

## Split assessment

No deeper roadmap split is required.

4.5A is one cohesive UI capability because:

- the source contract is already complete in `ProductFinancialProfile`;
- the write/read boundary is already complete in `ProductFinancialProfileService`;
- Product listing/archived visibility is already complete in `ProductService`;
- the master plan explicitly defines one dedicated Product financial profile editor;
- the new top-level Pricing navigation entry and the editor are inseparable parts of the same user workflow.

Implementation uses ordinary checkpoints for UI view-model helpers, Pricing page, App navigation, tests, and documentation. These are not additional roadmap phases.

## Authoritative existing contracts

4.5A consumes these existing shared application services:

```text
productService
productFinancialProfileService
```

The UI does not directly mutate:

- `productRepository`;
- `productFinancialProfileRepository`;
- `BusinessDataset` arrays;
- any pricing/cost repository;
- any Phase 2/3 production source.

All profile saves go through:

```text
productFinancialProfileService.upsertProfile(...)
```

Profile reads use:

```text
productFinancialProfileService.getProfile(...)
productFinancialProfileService.listProfiles(...)
```

Product selection/listing uses:

```text
productService.listProducts(...)
```

## New top-level Pricing workspace

`pricing` is added to the App section/navigation contract and renders a dedicated `PricingPage`.

The top-level nav is conceptually:

```text
Materials
Calibration
Products
Yield
Production
Pricing
```

The existing default Materials workspace remains unchanged.

Labor, overhead, and pricing fields are not added to the Products recipe/composition editor.

Page heading:

```text
PHASE 4 · PRICING
Financial profiles
```

The page explicitly describes these values as Product-level planning source data and states that downstream selling price/profit remain derived.

## Product selection and archived visibility

The Pricing workspace lists Products from `productService`, including archived Products.

Implemented behavior:

- active Products are the default visible filter;
- user can switch among active / archived / all;
- search matches Product name and Product ID;
- archived Products remain selectable and editable because the 4.1C contract preserves profiles for historical inspection/editing;
- archived state is visibly labeled;
- 4.5A exposes no Product archive/activate actions.

Selecting a Product loads its current financial profile if one exists.

If no profile exists, the editor shows an explicit **Not configured** state rather than silently pre-filling saved zero costs.

## Form state and missing-versus-zero semantics

The UI-only form state uses strings so blank input remains distinguishable from numeric zero:

```text
laborCostPerUnit: string
overheadCostPerUnit: string
pricingMethod: unconfigured | profit-amount | markup-percent | margin-percent
pricingValue: string
notes: string
```

For a Product with no profile:

```text
laborCostPerUnit = ''
overheadCostPerUnit = ''
pricingMethod = unconfigured
pricingValue = ''
notes = ''
```

Missing profile labor/overhead are never initialized to `0`, because that would visually erase the source distinction between missing configuration and explicit zero.

A user may intentionally enter:

```text
labor = 0
overhead = 0
```

and save that as authoritative known-zero source data.

## Pricing-method controls

Implemented UI choices:

```text
Not configured
Fixed profit amount
Markup percentage
Target margin percentage
```

Mapping:

```text
Not configured           -> pricingPolicy = null
Fixed profit amount      -> method = profit-amount
Markup percentage        -> method = markup-percent
Target margin percentage -> method = margin-percent
```

When pricing is unconfigured:

- no policy value is required;
- the policy-value input is disabled;
- saving still requires explicit labor and overhead source values.

When a pricing method is configured, its value is required.

## PHP amount versus percentage semantics

The UI makes units explicit.

### Fixed profit amount

Display/input:

```text
Profit per unit (PHP)
```

The numeric value is passed through unchanged to the application/domain policy.

### Markup / target margin

Display/input human percentages:

```text
Markup (%)
Target margin (%)
```

UI-boundary conversion:

```text
humanPercent / 100 = canonical decimal rate
```

Examples:

```text
50% -> 0.50
25% -> 0.25
```

When editing an existing profile, canonical decimal rates are converted back for display:

```text
canonicalRate * 100
```

No fixed currency/percentage rounding is introduced by the form mapper. The authoritative domain remains full precision.

## Form conversion helper boundary

Implemented:

`src/ui/pricing/productFinancialProfileForm.ts`

Exports include:

```text
ProductFinancialProfileFormState
PricingMethodSelection
ProductFinancialProfileFormError
createEmptyProductFinancialProfileForm(...)
productFinancialProfileToForm(...)
productFinancialProfileFormToSource(...)
pricingValueLabel(...)
pricingValueHelp(...)
```

The conversion helper:

- preserves explicit zero values;
- rejects blank labor/overhead before save with clear form feedback;
- rejects blank configured policy value before save;
- rejects non-finite numeric text instead of coercing it;
- maps percentage values to canonical decimal rates;
- maps canonical percentage rates back to human percentages;
- trims optional notes;
- never derives selling price or profit.

Domain/application validation remains authoritative and still runs through `upsertProfile` on every write.

## Editor save behavior

Implemented submit flow:

1. require a selected Product;
2. convert UI form to `ProductFinancialProfile` source shape;
3. call `productFinancialProfileService.upsertProfile(...)`;
4. surface domain/application validation errors as textual feedback;
5. reload the authoritative profile with `getProfile(...)` after success;
6. preserve the selected Product;
7. show a clear success message.

There is no delete/reset operation because the completed 4.1C source contract intentionally defines no profile deletion.

To make pricing unconfigured while keeping known labor/overhead source values, the editor saves:

```text
pricingPolicy = null
```

## PricingPage layout

Implemented desktop structure:

```text
Pricing workspace heading

[ Product catalog / filters ] [ Financial profile editor ]
```

### Product selector panel

Includes:

- search;
- active / archived / all status filter;
- Product name;
- Product ID;
- category;
- active/archived badge;
- Configured / Not configured profile state;
- selected state.

### Financial profile panel

Includes:

- selected Product identity/status;
- configured/not-configured source-state callout;
- Labor cost per unit (PHP);
- Overhead cost per unit (PHP);
- Pricing method;
- conditional pricing value field;
- Notes;
- PHP/% unit guidance;
- Save financial profile action;
- validation/success feedback.

The editor shell remains visible but disabled when no Product is selected, which keeps units and required source fields understandable even before async catalog loading completes.

On narrow screens, catalog and editor stack vertically.

## Loading and selection behavior

Initial page load fetches Products and financial profiles in parallel.

If an active Product exists, the first active Product is selected automatically. If only archived Products exist, the first available Product can still become the initial selection while archived/all filtering remains available.

If there are no Products, the catalog shows a clear empty state directing the user to create a Product first.

Selection changes replace the form with the selected Product's authoritative profile state and clear stale feedback.

## Validation and error feedback

UI-local required-field feedback is concise and specific.

Authoritative validation errors from:

```text
ProductFinancialProfileError
PricingError
ProductFinancialProfileApplicationError
```

are surfaced rather than sanitized into successful saves.

Invalid values are never auto-clamped or silently corrected.

HTML input constraints provide guidance, but the authoritative application/domain validation remains the final gate.

## Accessibility / interaction

Implemented:

- visible labels for all inputs;
- real button/select/input filter controls;
- `aria-pressed` on Product selection cards;
- textual active/archived and configured/not-configured status labels;
- disabled editor/save controls when no Product is selected or a save is in progress;
- textual feedback rather than color-only feedback;
- visible PHP and `%` unit guidance.

## Styling

Implemented Pricing-specific stylesheet:

`src/ui/pricing/pricing.css`

The page reuses generic classes from `src/styles.css` where possible and adds only Pricing-specific layout, selector, profile-state, and unit-guide styling.

No new design system or dependency was introduced.

## Tests

### Pure form/view-model tests

Implemented:

`src/ui/pricing/productFinancialProfileForm.test.ts`

13 dedicated tests cover:

1. missing profile -> blank labor/overhead + unconfigured policy;
2. explicit zero labor/overhead remains `0`;
3. fixed-profit PHP round-trip;
4. markup 0.50 canonical -> 50 UI -> 0.50 source;
5. target margin 0.25 canonical -> 25 UI -> 0.25 source;
6. higher-precision percent round-trip without fixed two-decimal rounding;
7. unconfigured policy -> `null`;
8. blank labor rejected;
9. blank overhead rejected;
10. blank configured policy value rejected;
11. non-finite numeric text rejected instead of coerced to zero;
12. notes trimming/empty notes behavior;
13. correct policy label/help behavior.

### PricingPage smoke validation

`src/App.smoke.test.tsx` now verifies the browser-independent Pricing shell includes:

- Phase 4 Pricing / Financial profiles heading;
- Product catalog/search;
- Labor cost per unit;
- Overhead cost per unit;
- Pricing method;
- not-configured option;
- save action;
- human percentage guidance.

### App smoke validation

The top-level App smoke test verifies `Pricing` navigation while preserving the Materials default render.

### Regression gate

Existing Product financial-profile service/domain and pricing tests remain green.

No new browser/test dependency was added.

## Implementation files

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

No application/domain/storage contract change was required.

## Explicit non-goals / 4.5B+ boundary

4.5A does not implement:

- fully loaded cost display;
- direct/safety-reserve cost breakdown;
- purchased/handmade component cost display;
- selling-price calculation UI;
- profit-per-unit display;
- effective markup/margin display;
- production batch quantity controls;
- planned production cost/revenue/profit display;
- capacity warning UI;
- inventory reservation/deduction;
- Excel persistence;
- Tauri persistence.

Those remain 4.5B, 4.5C, Phase 5, or later concerns.

## Implementation evidence

Plan-before-code commit:

`3a9c60eec6cac706d3a12d229791d72684810489`

Form-mapping helper commit:

`654adc19c491b6a51b8f287e1016a98a987d9318`

Focused form-test commit:

`080467876e1b86dd941a1b29bffd6e96d71a11fa`

PricingPage commit:

`e53d5ca6bd49c96b9e43b6c24c4b24d9559d6634`

Pricing styling commit:

`f2125f19bb5fa00508eb02f92d9034f4f7782ca5`

App navigation commit:

`7fe68c50912bfbe6082ffd5f9a33712e6b9d756d`

Editor-shell accessibility/smoke-support commit:

`69f2830f475fea64b3241ddb26270448ba5eca6a`

Validated implementation checkpoint:

`8e8cdf8ac3cbede360b0212ac50421e398dce975`

Checkpoint CI:

`34962216103 — SUCCESS`

Validated repository state:

```text
TypeScript typecheck passed
78 test files passed
955 tests passed
13 dedicated 4.5A form-mapping tests passed
8 React workspace smoke tests passed
production Vite build passed
112 modules transformed
```

Implementation record commit:

`ff1e9b335d7e462d279daacc85f7b7b44b7fae6c`

No implementation checkpoint failure occurred before this validated state.

## Validation gates

Before implementation PR merge:

- dedicated form/view-model tests pass;
- PricingPage/App smoke tests pass;
- existing 4.1A/4.1B/4.1C financial-profile/pricing tests remain green;
- full repository test suite passes;
- TypeScript typecheck passes;
- production Vite build passes;
- final documented feature-head CI is green;
- PR CI is green.

After merge:

- exact merged `develop` CI must be green before documentation closeout;
- closeout must preserve the full Phase 4 audit trail;
- roadmap advances to `4.5B — Unit Economics / Pricing Calculator UI — NEXT` only after closeout CI is green.

## Completion gate

4.5A is complete only when:

- a dedicated top-level Pricing workspace exists;
- Products, including archived Products, can be selected for financial configuration;
- missing profile is visibly different from explicit zero profile;
- labor and overhead use explicit PHP-per-unit inputs;
- pricing policy supports unconfigured, fixed-profit, markup, and target-margin choices;
- percentage inputs use human `%` presentation and canonical decimal-rate persistence;
- all writes go through `ProductFinancialProfileService`;
- validation failures are visible and never silently clamped/sanitized;
- existing profile values reload correctly after save/selection;
- no 4.5B/4.5C derived financial UI is leaked into the editor;
- focused/full tests, typecheck, build, PR CI, exact post-merge CI, and documentation closeout all pass.

## Next task after completion

`4.5B — Unit Economics / Pricing Calculator UI — NEXT / NOT STARTED`

Do not begin 4.5B implementation until 4.5A is fully merged, post-merge validated, documentation-closeout complete, and 4.5B receives its own scope/split assessment and development plan.
