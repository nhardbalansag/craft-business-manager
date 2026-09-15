# Phase 3.5A — Product Composition Editor

## Status

**IMPLEMENTATION COMPLETE — MERGE GATE PENDING**

Feature branch:

`feature/phase-3-5a-product-composition-editor`

Authoritative implementation base:

`develop` @ `bce15180204eb9094b484994060c18ec9b2885c5`

Development plan:

`docs/PHASE_3_5A_PRODUCT_COMPOSITION_EDITOR_PLAN.md`

## Implementation summary

Phase 3.5A extends the existing Products workspace with a third **Components** view for managing the discrete Material/Product composition of a parent Product.

The UI remains a thin application client: all authoritative create/update/remove operations continue through `ProductComponentService`, so React does not bypass domain/application validation.

## Products workspace integration

Updated:

`src/ui/products/ProductsPage.tsx`

The workspace now exposes:

```text
Products
Mix presets
Components
```

The heading now reflects the Phase 3 composition scope while preserving the existing Product and Mix functionality.

The Components tab delegates to a dedicated view instead of expanding the already-large `ProductsPage` further.

## Component editor view

Added:

`src/ui/products/ProductComponentsView.tsx`

The editor supports:

- selecting one parent Product;
- adding component lines;
- editing component lines;
- removing component lines;
- choosing Material or Product source type;
- choosing a source;
- choosing an authoritative component role;
- entering positive whole `quantityPerParent`;
- optional component notes;
- readable current composition cards;
- controlled service/domain error feedback;
- guarded nested composition preview.

### Parent Product behavior

- first active Product is selected by default when available;
- all Products remain selectable for historical inspection;
- active parent Products are writable;
- archived parent Products are read-only;
- changing parent resets edit/feedback state.

## Authoritative mutation boundary

Writes map directly to the completed Phase 3.1C service:

```text
create -> productComponentService.createComponent(...)
update -> productComponentService.updateComponent(...)
remove -> productComponentService.removeComponent(...)
```

The UI displays the resulting `Error.message` when validation fails.

This keeps authoritative enforcement for:

- parent/source existence;
- active-state relationships;
- Material count-unit rules;
- duplicate component-source identity;
- direct self-reference;
- transitive cycle prevention;
- component contract validation.

## Source candidate filtering

Candidate filtering improves UX without replacing service validation.

### Material-backed candidates

The selector shows only Materials that are:

- active;
- canonical count-based (`baseUnit === 'pc'`);
- not already used by another Material-backed component line for the same parent, except the line currently being edited.

### Product-backed candidates

The selector shows only Products that are:

- active;
- not the selected parent Product;
- not already used by another Product-backed component line for the same parent, except the line currently being edited;
- compatible with the current composition graph when tested through the existing graph validator.

This graph filtering is advisory UI filtering only. Save-time validation still runs through `ProductComponentService`.

Changing source type clears the source selection.

## Role and quantity semantics

Role options come from:

`PRODUCT_COMPONENT_ROLES`

Quantity input uses:

```text
type=number
min=1
step=1
```

The submitted value is converted with `Number(...)`; authoritative positive finite integer validation remains in the domain/application layer.

## Current composition summary

For the selected parent, each immediate component card shows:

- Material/Product type;
- quantity × readable source name;
- role;
- source ID;
- component ID;
- optional notes;
- Edit/Remove actions when the parent is writable.

This summary is derived UI only and is never persisted separately.

## Guarded nested composition preview

Added pure helper:

`src/ui/products/productCompositionPreview.ts`

The preview expands Product-backed component relationships recursively for inspection and renders Material-backed lines as leaves.

Preview nodes preserve:

- component ID;
- parent Product ID;
- source type/ID/name;
- role;
- quantity per parent;
- notes;
- active/archived source state;
- child nodes;
- controlled `missing-source` / `cycle` issue markers.

### Deterministic ordering

Preview children are sorted by:

1. source type;
2. canonical source ID;
3. canonical component ID.

### Corruption guard

The helper keeps an active Product path. If a Product is encountered again on the same path, it emits a `cycle` node and stops recursion.

This protects read-only inspection from corrupted/imported legacy data even though normal component writes already reject cycles.

### Preview scope boundary

The nested preview does **not**:

- calculate cost;
- calculate capacity;
- inspect/augment ProductStock;
- manufacture missing child Products;
- mutate composition;
- replace graph validation.

## Archived and missing historical sources

Historical inspection remains readable:

- archived sources retain their name and are marked archived;
- missing sources fall back to their stored source ID and receive a `missing-source` marker.

Archived parent Products remain read-only.

## Styling and responsive behavior

Updated:

`src/ui/products/products.css`

Added styles for:

- parent Product panel;
- component editor/list layout;
- component cards/type pills;
- read-only nested tree;
- corruption/missing-source emphasis;
- tablet/mobile stacking.

The implementation reuses the existing visual system and introduces no CSS framework or new design-system dependency.

## Tests

Added:

`src/ui/products/productCompositionPreview.test.ts`

Dedicated preview-helper tests: **9**.

Coverage:

- empty composition;
- Material leaf;
- Product recursion;
- deep nested Product composition;
- quantity/role preservation;
- deterministic ordering;
- missing Material fallback;
- missing Product fallback;
- archived source visibility;
- cycle/corruption guard.

Updated:

`src/App.smoke.test.tsx`

React server-render smoke coverage now verifies:

- Products workspace exposes the Components tab;
- updated Phase 3 Products heading;
- composition editor shell renders with a parent Product;
- component ID/source/quantity controls render;
- nested composition preview panel renders.

No browser testing dependency was added. Existing `ProductComponentService` tests continue to cover authoritative mutation validation.

## Validation evidence

Fully corrected implementation head:

```text
c96c631e2938108225b0f3efbdb77f8ff29ddb09
```

CI:

```text
run 34923251592 — SUCCESS
52 test files passed
596 tests passed
9 dedicated productCompositionPreview tests
6 React workspace smoke tests
TypeScript typecheck passed
production build passed
```

Two earlier branch runs failed only on stale/case-sensitive smoke-text assertions while the implementation typechecked and the new helper tests passed. Both assertions were corrected before this merge gate. No production logic change was required for those failures.

## Explicit deferrals

Not implemented in 3.5A:

- ProductStock editing/list UI — Phase 3.5B;
- component-aware Production estimate UI — Phase 3.5C;
- new cost calculations;
- new capacity calculations;
- limiter visualization in Production;
- recursive manufacturing of child Products;
- stock reservation/deduction/transactions;
- labor/overhead/pricing/profit — Phase 4;
- Excel persistence — Phase 5.

## Completion gate state

Feature implementation gates passed:

- Components view exists in Products workspace;
- active parent can add/edit/remove through `ProductComponentService`;
- archived parent is read-only;
- Material/Product source types supported;
- Material candidates filter active/count-based/duplicate-invalid options;
- Product candidates filter active/self/duplicate/cycle-invalid options;
- authoritative roles and whole-piece quantity semantics exposed;
- service validation feedback remains visible;
- immediate composition summary exists;
- nested preview is guarded and read-only;
- no Phase 3.5B/3.5C/Phase 4/Phase 5 leakage exists;
- 52 test files / 596 tests pass;
- TypeScript typecheck passes;
- production build passes.

Remaining before 3.5A can be marked fully complete:

- final documented feature-head CI must be green;
- implementation PR must pass its own CI and merge to `develop`;
- exact post-merge `develop` CI must pass;
- documentation-only closeout must mark 3.5A COMPLETE and advance 3.5B to NEXT / NOT STARTED.

## Next task after closeout

**3.5B — Finished Component Stock UI**

Do not begin 3.5B until 3.5A is formally closed and a dedicated 3.5B scope review/development plan is established.
