# Phase 4.5A — Product Financial Profile Editor Development Plan

## Status

**PLAN ESTABLISHED — IMPLEMENTATION NOT STARTED**

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

Implementation will use ordinary checkpoints for UI view-model helpers, Pricing page, App navigation, tests, and documentation. These are not additional roadmap phases.

## Authoritative existing contracts

4.5A must consume these existing shared application services:

```text
productService
productFinancialProfileService
```

The UI must not directly mutate:

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

Add `pricing` to the App section/navigation contract and render a dedicated `PricingPage`.

The top-level nav should become conceptually:

```text
Materials
Calibration
Products
Yield
Production
Pricing
```

The existing default Materials workspace remains unchanged.

Do not add labor, overhead, or pricing fields to the Products recipe/composition editor.

Recommended page heading:

```text
PHASE 4 · PRICING
Financial profiles
```

The page should clearly describe that the values are Product-level planning source data and that downstream prices/profit are derived elsewhere.

## Product selection and archived visibility

The Pricing workspace must list Products from `productService`, including archived Products.

Required behavior:

- active Products remain the default visible filter;
- user can switch among active / archived / all;
- search should match Product name and Product ID;
- archived Products must remain selectable and editable because the 4.1C contract preserves profiles for historical inspection/editing;
- archived state must be visibly labeled;
- 4.5A must not expose Product archive/activate actions.

Selecting a Product loads its current financial profile if one exists.

If no profile exists, the editor must show an explicit **Not configured** state rather than silently pre-filling saved zero costs.

## Form state and missing-versus-zero semantics

Introduce a UI-only form state using strings so blank input remains distinguishable from numeric zero:

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

Do **not** initialize missing profile labor/overhead to `0`, because that would visually erase the source distinction between missing configuration and explicit zero.

A user may intentionally enter:

```text
labor = 0
overhead = 0
```

and save that as authoritative known-zero source data.

## Pricing-method controls

Expose these UI choices:

```text
Not configured
Fixed profit amount
Markup percentage
Target margin percentage
```

Mapping:

```text
Not configured          -> pricingPolicy = null
Fixed profit amount     -> method = profit-amount
Markup percentage       -> method = markup-percent
Target margin percentage-> method = margin-percent
```

When pricing is unconfigured:

- no policy value is required;
- disable/hide the policy-value input as appropriate;
- saving still requires explicit labor and overhead source values.

When a pricing method is configured, its value is required.

## PHP amount versus percentage semantics

The UI must make units unambiguous.

### Fixed profit amount

Display/input as PHP amount:

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

Convert at the UI boundary:

```text
humanPercent / 100 = canonical decimal rate
```

Examples:

```text
50% -> 0.50
25% -> 0.25
```

When editing an existing profile, convert canonical decimal rates back to human percentage display:

```text
canonicalRate * 100
```

No rounding should be introduced beyond normal string representation. The authoritative domain remains full precision.

## Form conversion helper boundary

Create a small pure UI/view-model helper module so percentage conversion and missing/zero behavior can be tested without introducing a browser DOM testing dependency.

Recommended module:

`src/ui/pricing/productFinancialProfileForm.ts`

Recommended exports may include:

```text
ProductFinancialProfileFormState
EMPTY_PRODUCT_FINANCIAL_PROFILE_FORM
productFinancialProfileToForm(...)
productFinancialProfileFormToSource(...)
pricingValueLabel(...)
pricingValueUnit(...)
```

The conversion helper must:

- preserve explicit zero values;
- reject blank labor/overhead before save with clear form feedback;
- reject blank configured policy value before save;
- parse finite numeric text without silently replacing invalid input;
- map percentage values to canonical decimal rates;
- map canonical percentage rates back to human percentages;
- trim optional notes;
- never derive price/profit.

Domain/application validation still remains authoritative and must run through `upsertProfile` on every write.

## Editor save behavior

On submit:

1. require a selected Product;
2. convert the UI form to `ProductFinancialProfile` source shape;
3. call `productFinancialProfileService.upsertProfile(...)`;
4. surface domain/application validation errors through user-readable feedback;
5. reload authoritative profile state after success;
6. preserve the selected Product;
7. show a clear success message.

There is no delete/reset operation because the completed 4.1C source contract intentionally does not define profile deletion.

To make pricing unconfigured while keeping known labor/overhead source values, save:

```text
pricingPolicy = null
```

## Recommended PricingPage layout

Use the existing visual system and generic panel/form classes.

Suggested desktop structure:

```text
Pricing workspace heading

[ Product catalog / filters ] [ Financial profile editor ]
```

A strong implementation is a responsive two-column layout:

### Product selector panel

- search;
- active / archived / all status filter;
- Product cards or compact rows;
- Product name;
- Product ID;
- category;
- active/archived badge;
- profile state: Configured / Not configured;
- selected state.

### Financial profile panel

- selected Product identity/status;
- source-state callout (configured / not configured);
- Labor cost per unit (PHP);
- Overhead cost per unit (PHP);
- Pricing method;
- conditional pricing value field;
- Notes;
- Save profile button;
- validation/success feedback.

On narrow screens, stack selector then editor.

## Loading and selection behavior

Initial page load should fetch Products and profile records in parallel where practical.

If active Products exist, selecting the first visible/available active Product automatically is acceptable and improves usability.

If no active Product exists but archived Products exist, do not silently hide the workspace's usefulness; allow archived/all filters and an explicit selection flow.

If there are no Products at all, show a clear empty state directing the user to create a Product first.

Selection changes must replace the form with the newly selected Product's authoritative profile state and clear stale feedback.

## Validation and error feedback

UI-local required-field feedback should be concise and specific.

Authoritative validation errors from:

```text
ProductFinancialProfileError
PricingError
ProductFinancialProfileApplicationError
```

must be surfaced rather than sanitized into a successful save.

Examples that must fail visibly:

- blank labor cost;
- blank overhead cost;
- negative labor/overhead;
- non-finite inputs;
- configured policy with blank value;
- negative fixed profit;
- negative markup;
- target margin below 0%;
- target margin >= 100%;
- missing Product reference if source state becomes stale.

Do not clamp or auto-correct invalid financial input.

## Accessibility / interaction requirements

- every input has a visible label;
- status/filter controls use real buttons/selects/inputs;
- selected Product state is visually and programmatically understandable;
- save button is disabled when no Product is selected or while saving;
- feedback remains textual, not color-only;
- archived badge includes readable text;
- percentage/PHP units are visible in labels/help text.

## Styling

Create a Pricing-specific stylesheet rather than expanding Product composition styles.

Recommended:

`src/ui/pricing/pricing.css`

Reuse generic classes from `src/styles.css` where possible:

```text
materials-workspace
page-heading-row
panel
panel-heading
form-grid
field
button
feedback
status-pill
```

Add only Pricing-specific selector/editor/status layouts.

Do not introduce a new design system or dependency.

## Tests

### Pure form/view-model tests

Add dedicated tests for the UI conversion boundary covering at least:

1. missing profile maps to blank labor/overhead and unconfigured policy;
2. explicit zero labor/overhead remains `0`, not blank;
3. fixed-profit PHP value round-trip;
4. markup 0.50 canonical -> 50 UI -> 0.50 source;
5. target margin 0.25 canonical -> 25 UI -> 0.25 source;
6. high-precision percent round-trip without deliberate UI rounding;
7. unconfigured policy maps to `null`;
8. blank labor rejected;
9. blank overhead rejected;
10. blank configured policy value rejected;
11. invalid numeric text rejected rather than coerced to zero;
12. notes trimming/empty notes behavior;
13. correct policy label/unit helper behavior.

### PricingPage smoke validation

Static server rendering must verify the browser-independent shell includes:

- Pricing / Financial profiles heading;
- Product selector/catalog;
- Labor cost per unit;
- Overhead cost per unit;
- Pricing method;
- not-configured option;
- save action;
- explicit PHP/% guidance.

### App smoke validation

Update App smoke coverage so the top-level navigation includes `Pricing` while preserving existing Materials default rendering.

### Regression gate

Existing Product financial-profile service/domain tests must remain green.

No new browser/test dependency is required for 4.5A.

## Expected implementation files

Likely new files:

```text
src/ui/pricing/PricingPage.tsx
src/ui/pricing/productFinancialProfileForm.ts
src/ui/pricing/productFinancialProfileForm.test.ts
src/ui/pricing/pricing.css
```

Likely updated files:

```text
src/App.tsx
src/App.smoke.test.tsx
```

A dedicated PricingPage test may be added if useful, but static page smoke assertions may live in `App.smoke.test.tsx` to match the repository's current React testing approach.

No application/domain/storage contract change is currently expected.

## Explicit non-goals / 4.5B+ boundary

4.5A must not implement:

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

## Validation gates

Before implementation PR merge:

- dedicated form/view-model tests pass;
- PricingPage/App smoke tests pass;
- existing 4.1A/4.1B/4.1C financial-profile/pricing tests remain green;
- full repository test suite passes;
- TypeScript typecheck passes;
- production Vite build passes;
- final feature-head CI is green;
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
