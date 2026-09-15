# Phase 3.5A — Product Composition Editor Development Plan

## Status

**IN PROGRESS — PLAN ESTABLISHED BEFORE IMPLEMENTATION**

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

It currently exposes:

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

The UI must call these methods rather than reimplementing save rules.

## UI structure

Extend the Products workspace view union to:

```text
products
mixes
components
```

The Components view should be implemented as a dedicated child component rather than making `ProductsPage.tsx` materially harder to maintain.

Recommended file:

`src/ui/products/ProductComponentsView.tsx`

`ProductsPage` remains responsible for the top-level Products workspace tabs and shared Product/Material data loading.

## Parent Product selection

The component editor operates on one selected parent Product at a time.

Behavior:

- default to the first active Product when one exists;
- allow selection from all Products for historical inspection;
- active parent -> CRUD enabled;
- archived parent -> read-only composition inspection;
- show parent name, ID, category, status;
- changing parent resets component edit form/feedback.

The UI must not permit adding/updating component lines on an archived parent because `ProductComponentService` rejects those writes.

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

Use an explicit editable ID on create so the UI does not invent a new authoritative identity scheme during 3.5A.

Recommended placeholder:

```text
COMP-PRODUCT-001
```

Editing keeps the ID disabled.

Automatic persistent component-ID generation is out of scope unless an existing application-level ID generator already exists.

## Source candidate filtering

### Material-backed source candidates

Show only Materials that are:

- active;
- `baseUnit === 'pc'`;
- not already used by another component line for the same parent/source type, except the line currently being edited.

This prevents obvious invalid/duplicate choices before submit.

### Product-backed source candidates

Show only Products that are:

- active;
- not the selected parent Product itself;
- not already used by another product-backed component line for the same parent, except the current edit line.

Direct self-reference is filtered from the selector.

Transitive cycle safety remains authoritative in `ProductComponentService` on create/update. The UI may additionally present known composition context, but it must not treat client filtering as a substitute for save-time validation.

## Source-type switching

Changing `sourceType` must clear `sourceId` so a Material ID cannot accidentally remain selected as a Product source or vice versa.

## Role and quantity

Role selector uses the authoritative:

`PRODUCT_COMPONENT_ROLES`

Quantity input:

- `type=number`;
- minimum `1`;
- step `1`;
- converted with `Number(...)`;
- authoritative positive finite integer validation still belongs to `ProductComponentService`/domain validation.

## Readable composition summary

For the selected parent Product, show every immediate component line with:

- source name;
- source type;
- source ID;
- role;
- quantity per parent;
- optional notes.

Example:

```text
Gift Box
├─ 1 × Candle — Product — vessel
├─ 3 × Mini Heart — Product — decorative-component
└─ 1 × Glass Jar — Material — vessel
```

The summary is derived/read-only and is never persisted as source data.

## Nested composition preview

Add a guarded read-only tree preview for Product-backed composition.

Recommended pure UI helper:

`src/ui/products/productCompositionPreview.ts`

Input:

- root Product ID;
- Product list;
- Material list;
- ProductComponent list.

Output should preserve typed nodes sufficient to render:

- Product nodes;
- Material leaf nodes;
- role;
- quantity per parent;
- source IDs/names;
- archived/missing fallback labels where historical data exists;
- cycle/corruption marker when a repeated active path is detected.

### Preview boundary

The preview is informational only.

It must not:

- calculate cost;
- calculate capacity;
- alter ProductStock;
- recursively manufacture child Products;
- change composition records;
- replace graph validation.

Even though normal writes prevent cycles, the preview must use a path/visited guard so corrupted imported/history data cannot recurse forever.

## Error and cycle feedback

All component create/update/remove actions should catch service/domain errors and display the actual `Error.message` through the existing Products workspace feedback style.

This naturally exposes:

- inactive parent/source errors;
- non-count Material errors;
- duplicate source errors;
- direct self-reference errors;
- transitive cycle errors;
- malformed quantity/role/source errors.

Do not duplicate service error-code-to-rule logic in React unless needed only for presentation.

## Delete behavior

Use an explicit `Remove` action on each component line.

3.5A does not introduce confirmation modals or undo history unless the existing UI already has a reusable confirmation pattern.

After remove:

- refresh component data;
- clear edit state if the removed line was being edited;
- show success/error feedback.

## Data loading

Reuse existing session services.

Products/Materials may remain loaded by `ProductsPage` and passed to the component view.

The component view should load:

- all component records needed for the selected-parent list and nested preview.

Recommended:

```text
productComponentService.listComponents()
```

After component mutations, reload component records only unless parent/Product/Material changes require broader reload.

## Styling

Extend:

`src/ui/products/products.css`

Maintain the existing application visual language:

- existing panels;
- workspace switcher;
- field styles;
- table/list structure;
- status pills;
- feedback blocks;
- responsive behavior.

Do not introduce a new design system or CSS framework.

Recommended Components layout:

```text
left: component editor form
right: selected-parent composition list
below/right: nested preview panel
```

The layout must remain usable on the existing responsive breakpoint by stacking panels vertically.

## Accessibility

Include:

- accessible tab/button labels;
- explicit labels for parent/source/role/quantity inputs;
- button `type="button"` for non-submit actions;
- semantic lists/tree-like readable markup without relying only on color;
- feedback text visible to screen readers through ordinary DOM content.

No ARIA tree widget is required in this phase unless keyboard tree interaction is fully implemented.

## Tests

The repository currently uses Vitest and React server-render smoke tests without a browser testing library.

3.5A should therefore use two test layers without adding a new testing dependency unless necessary:

### Pure preview/helper tests

Add tests for the nested composition helper covering:

- empty composition;
- Material leaf;
- Product child;
- deep acyclic nesting;
- quantity/role propagation;
- stable ordering;
- missing source fallback;
- archived source visibility;
- cycle/corruption guard.

### React smoke coverage

Extend `src/App.smoke.test.tsx` so server rendering confirms the Products workspace now exposes the `Components` view/tab without requiring browser effects.

If a small presentational component can be server-rendered independently with injected data, add focused render assertions for:

- source type labels;
- quantity/role summary;
- nested preview labels.

Avoid introducing jsdom/testing-library solely for 3.5A unless interaction behavior cannot otherwise be validated adequately.

Authoritative mutation behavior is already covered by `ProductComponentService` tests.

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

## Planned file changes

Expected implementation files:

```text
src/ui/products/ProductsPage.tsx
src/ui/products/ProductComponentsView.tsx
src/ui/products/productCompositionPreview.ts
src/ui/products/productCompositionPreview.test.ts
src/ui/products/products.css
src/App.smoke.test.tsx
```

Potentially no application/domain source changes are required because the component service contract is already complete.

Any need for a new application query API discovered during implementation must be justified in the implementation record and remain within 3.5A UI-support scope.

## Completion gate

3.5A is complete only when:

- Products workspace exposes a Components view;
- active parent Product can add/edit/remove components;
- archived parent is inspectable but not writable;
- source type selector supports Material/Product;
- Material selector excludes archived/non-`pc`/duplicate candidates;
- Product selector excludes archived/self/duplicate candidates;
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
- production build passes;
- implementation PR merges to `develop`;
- exact post-merge `develop` CI passes;
- documentation-only closeout marks 3.5A COMPLETE and advances 3.5B to NEXT / NOT STARTED.

## Next task after closeout

**3.5B — Finished Component Stock UI**

Do not begin 3.5B until 3.5A is merged, exact post-merge CI is green, 3.5A is formally closed, and a dedicated 3.5B scope review/development plan is established.
