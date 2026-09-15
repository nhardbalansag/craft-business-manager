# Phase 3.5A — Product Composition Editor

## Status

**COMPLETE**

Implementation PR:

`#85 — Phase 3.5A — Product Composition Editor`

Implementation merge:

`b4ab27f7620de4e2d255a1816f6bfd216a954173`

Development plan:

`docs/PHASE_3_5A_PRODUCT_COMPOSITION_EDITOR_PLAN.md`

## Delivered

Phase 3.5A adds a dedicated **Components** view to the Products workspace while keeping all authoritative writes behind the completed `ProductComponentService` boundary.

The UI now supports:

- parent Product selection;
- add/edit/remove component lines;
- Material or Product source type;
- authoritative component roles;
- positive whole-piece `quantityPerParent`;
- optional notes;
- readable immediate composition summary;
- service/domain validation feedback;
- guarded nested Product composition preview.

## Parent and mutation behavior

- first active Product is selected by default when available;
- archived parent Products remain inspectable but read-only;
- create/update/remove operations use `ProductComponentService`;
- React does not bypass application/domain validation;
- changing the selected parent clears edit/feedback state.

## Source filtering

Material candidates are limited to active, canonical `pc` Materials that are not already used by another Material-backed line for the same parent.

Product candidates are limited to active, non-self, non-duplicate Product sources that are advisory graph-safe according to the existing composition graph validator.

Save-time duplicate/cycle/relationship validation remains authoritative in `ProductComponentService`.

## Composition preview

Added:

`src/ui/products/productCompositionPreview.ts`

The preview:

- recursively expands Product-backed saved composition;
- renders Material-backed components as leaves;
- preserves role, quantity, IDs/names, notes and active state;
- uses deterministic ordering;
- keeps archived sources visible;
- uses stored IDs when a historical source is missing;
- stops corrupted recursive paths with a controlled cycle marker.

It is read-only and does not calculate cost/capacity, mutate ProductStock, or recursively manufacture missing child Products.

## UI files

Implemented/updated:

```text
src/ui/products/ProductsPage.tsx
src/ui/products/ProductComponentsView.tsx
src/ui/products/productCompositionPreview.ts
src/ui/products/productCompositionPreview.test.ts
src/ui/products/products.css
src/App.smoke.test.tsx
```

No new application/domain contract was required.

## Validation

```text
Corrected implementation CI   34923251592 — SUCCESS
Final feature-head CI          34923392945 — SUCCESS
PR #85 CI                      34923453562 — SUCCESS
Post-merge develop CI          34923517417 — SUCCESS

52 test files passed
596 tests passed
9 dedicated composition-preview tests
6 React workspace smoke tests
TypeScript typecheck passed
production build passed
```

Two earlier intermediate feature runs exposed only stale/case-sensitive smoke-text assertions. Those test expectations were corrected before the merge gate; no production-logic correction was required.

## Completion gates

All Phase 3.5A completion gates passed:

- Products workspace exposes Components;
- active parent CRUD is available;
- archived parent is read-only;
- Material/Product source filtering exists;
- roles and positive whole-piece quantity semantics are exposed;
- writes remain service-backed;
- validation/cycle feedback is visible;
- immediate summary and guarded nested preview exist;
- responsive styling is included;
- no 3.5B/3.5C/Phase 4/Phase 5 leakage occurred;
- implementation PR merged;
- exact post-merge `develop` CI passed.

## Explicit deferrals

Still deferred:

- ProductStock UI — 3.5B;
- component-aware Production estimate UI — 3.5C;
- stock transactions/reservations/deductions;
- labor/overhead/pricing/profit — Phase 4;
- Excel persistence — Phase 5.

## Next task

**3.5B — Finished Component Stock UI — NEXT / NOT STARTED**

Do not begin 3.5B until a dedicated development plan/scope review is established.
