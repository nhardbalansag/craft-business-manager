# Phase 3.5A — Product Composition Editor Development Plan

## Status

**IMPLEMENTED — MERGE GATE PENDING**

Authoritative base:

`develop` @ `bce15180204eb9094b484994060c18ec9b2885c5`

Feature branch:

`feature/phase-3-5a-product-composition-editor`

## Objective

Extend the existing Products workspace with a dedicated **Components** view so users can manage the discrete Material/Product composition of a parent Product using the already-completed Phase 3 component domain and application services.

The UI must support:

- add component line;
- edit component line;
- remove component line;
- choose `material` or `product` source type;
- choose only appropriate active source candidates;
- choose component role;
- enter positive whole `quantityPerParent`;
- enter optional notes;
- inspect a readable current composition summary;
- see controlled validation/cycle/error feedback;
- inspect a guarded nested composition preview.

All authoritative writes must continue through `ProductComponentService`.

## Authoritative master-plan contract

Phase 3.5A requires:

- extend the Products workspace with a Components view;
- add/edit/remove component lines;
- choose Material or Product source type;
- source selector filtered to valid active candidates;
- role selector;
- positive whole quantity per parent;
- readable composition summary;
- cycle/error feedback;
- nested composition preview;
- UI must not bypass `ComponentService` validation.

## Split assessment

No deeper formal sub-phase is required.

3.5A remains one cohesive UI phase with internal implementation slices:

1. workspace/tab integration;
2. parent Product selection;
3. component form/CRUD;
4. source-candidate filtering;
5. composition summary;
6. nested composition preview;
7. validation/error feedback;
8. responsive styling;
9. focused UI/pure-helper tests;
10. full regression/CI.

These are implementation steps, not separate roadmap phases.

## Existing architecture

The current React Products workspace is implemented in:

`src/ui/products/ProductsPage.tsx`

It originally exposed:

- `Products` tab;
- `Mix presets` tab;
- Product master form/list;
- Mix preset form/list.

Application/session dependencies already available:

- `productService`;
- `materialService`;
- `productComponentService`.

The authoritative component application boundary already provides:

- `createComponent()`;
- `updateComponent()`;
- `removeComponent()`;
- `getComponent()`;
- `listComponents()`;
- `listComponentsByParent()`;
- active parent/source validation;
- count-based Material validation;
- duplicate source validation;
- direct/transitive cycle validation.

The UI calls these methods rather than reimplementing save rules.

## UI structure

The Products workspace view union now supports:

```text
products
mixes
components
```

The Components view is implemented as a dedicated child component:

`src/ui/products/ProductComponentsView.tsx`

`ProductsPage` remains responsible for the top-level Products workspace tabs and shared Product/Material data loading.

## Parent Product selection

The component editor operates on one selected parent Product at a time.

Implemented behavior:

- default to the first active Product when one exists;
- allow selection from all Products for historical inspection;
- active parent -> CRUD enabled;
- archived parent -> read-only composition inspection;
- show parent name, ID, category, status;
- changing parent resets component edit form/feedback.

The UI does not permit component writes on an archived parent.

## Component form contract

UI form state:

```text
id
sourceType: material | product
sourceId
role
quantityPerParent
notes
```

The parent Product ID is derived from the selected parent, not manually entered.

Create maps to:

```text
productComponentService.createComponent(...)
```

Edit maps to:

```text
productComponentService.updateComponent(componentId, changes)
```

Remove maps to:

```text
productComponentService.removeComponent(componentId)
```

The component ID remains immutable while editing.

## Component ID UX

An explicit editable ID is used on create so 3.5A does not invent a new authoritative identity-generation scheme.

Placeholder:

```text
COMP-PRODUCT-001
```

Editing keeps the ID disabled.

## Source candidate filtering

### Material-backed source candidates

The UI shows only Materials that are:

- active;
- `baseUnit === 'pc'`;
- not already used by another component line for the same parent/source type, except the line currently being edited.

### Product-backed source candidates

The UI shows only Products that are:

- active;
- not the selected parent Product itself;
- not already used by another product-backed component line for the same parent, except the current edit line;
- compatible with the current graph when checked through the existing `validateProductCompositionGraph` helper.

Direct self-reference and known transitive cycle candidates are filtered from the selector for UX.

Save-time cycle safety remains authoritative in `ProductComponentService` on create/update. Client filtering is not treated as a substitute for service validation.

## Source-type switching

Changing `sourceType` clears `sourceId` so a Material ID cannot accidentally remain selected as a Product source or vice versa.

## Role and quantity

Role selector uses the authoritative:

`PRODUCT_COMPONENT_ROLES`

Quantity input uses:

- `type=number`;
- minimum `1`;
- step `1`;
- converted with `Number(...)`;
- authoritative positive finite integer validation remains in `ProductComponentService`/domain validation.

## Readable composition summary

For the selected parent Product, every immediate component line shows:

- source name;
- source type;
- source ID;
- component ID;
- role;
- quantity per parent;
- optional notes;
- edit/remove actions when writable.

The summary is derived/read-only and is never persisted as separate source data.

## Nested composition preview

Implemented guarded read-only tree preview through:

`src/ui/products/productCompositionPreview.ts`

Input:

- root Product ID;
- Product list;
- Material list;
- ProductComponent list.

Output preserves typed nodes sufficient to render:

- Product nodes;
- Material leaf nodes;
- role;
- quantity per parent;
- source IDs/names;
- archived/missing fallback labels;
- cycle/corruption marker when a repeated active path is detected.

### Preview boundary

The preview is informational only.

It does not:

- calculate cost;
- calculate capacity;
- alter ProductStock;
- recursively manufacture child Products;
- change composition records;
- replace graph validation.

Even though normal writes prevent cycles, the preview uses a path guard so corrupted imported/history data cannot recurse forever.

## Error and cycle feedback

All component create/update/remove actions catch service/domain errors and display the actual `Error.message` through the existing Products workspace feedback style.

This exposes controlled validation feedback without duplicating service error rules in React.

## Delete behavior

Each writable component line has an explicit `Remove` action.

After remove:

- component records refresh;
- edit state clears if the removed line was being edited;
- success/error feedback is displayed.

No new confirmation modal/undo infrastructure was introduced.

## Data loading

Products/Materials remain loaded by `ProductsPage` and are passed to the component view.

The component view loads all component records with:

```text
productComponentService.listComponents()
```

After component mutations, only component records reload.

## Styling

Extended:

`src/ui/products/products.css`

The implementation reuses the existing visual language:

- panels;
- workspace switcher;
- field styles;
- status pills;
- feedback blocks;
- card/list treatment;
- responsive behavior.

The Components layout uses an editor/list split and stacks at narrower widths. No new design system or CSS framework was introduced.

## Accessibility

Implemented ordinary labelled controls and semantic markup:

- labelled parent/source/role/quantity inputs;
- non-submit actions use `type="button"`;
- tree preview uses readable nested lists and text labels;
- issue state is not color-only;
- feedback remains normal DOM text.

No incomplete ARIA tree interaction model was introduced.

## Tests

### Pure preview/helper tests

Added:

`src/ui/products/productCompositionPreview.test.ts`

Dedicated tests: **9**.

Coverage includes:

- empty composition;
- Material leaf;
- Product child/deep nesting;
- quantity/role propagation;
- stable ordering;
- missing Material source fallback;
- missing Product source fallback;
- archived source visibility;
- cycle/corruption guard.

### React smoke coverage

Extended:

`src/App.smoke.test.tsx`

Smoke validation now confirms:

- Products workspace exposes `Components`;
- updated Product composition heading renders;
- composition editor shell renders with an active parent Product;
- component ID/source/quantity controls render;
- nested composition preview renders.

No new browser-testing dependency was added. Authoritative mutation behavior remains covered by existing `ProductComponentService` tests.

## Validation evidence

Corrected implementation head:

`c96c631e2938108225b0f3efbdb77f8ff29ddb09`

CI:

```text
34923251592 — SUCCESS
52 test files passed
596 tests passed
9 dedicated productCompositionPreview tests
6 React workspace smoke tests
TypeScript typecheck passed
production build passed
```

Earlier intermediate branch runs exposed only stale/case-sensitive smoke-text assertions. Those test expectations were corrected before the merge gate; no production-logic fix was required.

## Explicit non-goals

3.5A does not implement:

- ProductStock editing/list UI — 3.5B;
- component-aware Production estimate UI — 3.5C;
- new cost calculations;
- new capacity calculations;
- limiter visualization in Production;
- stock deduction/reservation/transactions;
- pricing/labor/overhead/profit — Phase 4;
- Excel persistence — Phase 5;
- new domain component roles/source types;
- automatic recursive production of child Products.

## Implemented file changes

```text
src/ui/products/ProductsPage.tsx
src/ui/products/ProductComponentsView.tsx
src/ui/products/productCompositionPreview.ts
src/ui/products/productCompositionPreview.test.ts
src/ui/products/products.css
src/App.smoke.test.tsx
docs/PHASE_3_5A_PRODUCT_COMPOSITION_EDITOR.md
```

No new application/domain source API was needed.

## Completion gate

Implementation-side gates are satisfied:

- Products workspace exposes a Components view;
- active parent Product can add/edit/remove components;
- archived parent is inspectable but not writable;
- source type selector supports Material/Product;
- Material selector excludes archived/non-`pc`/duplicate candidates;
- Product selector excludes archived/self/duplicate/cycle-invalid candidates;
- role selector uses authoritative roles;
- quantity uses positive whole-piece semantics;
- all writes flow through `ProductComponentService`;
- service validation/cycle errors are visible in the UI;
- immediate composition summary is readable;
- nested composition preview is guarded and read-only;
- no 3.5B/3.5C/Phase 4/Phase 5 leakage occurs;
- focused helper/UI tests pass;
- full repository tests pass;
- TypeScript typecheck passes;
- production build passes.

Remaining merge/closeout gates:

- final documented feature-head CI must pass;
- implementation PR must pass its own CI and merge to `develop`;
- exact post-merge `develop` CI must pass;
- documentation-only closeout must mark 3.5A COMPLETE and advance 3.5B to NEXT / NOT STARTED.

## Next task after closeout

**3.5B — Finished Component Stock UI**

Do not begin 3.5B until 3.5A is merged, exact post-merge CI is green, 3.5A is formally closed, and a dedicated 3.5B scope review/development plan is established.
