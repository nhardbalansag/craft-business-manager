# Phase 3.5A — Product Composition Editor Development Plan

## Status

**COMPLETE**

Authoritative implementation base:

`develop` @ `bce15180204eb9094b484994060c18ec9b2885c5`

Feature branch:

`feature/phase-3-5a-product-composition-editor`

Implementation PR:

`#85 — Phase 3.5A — Product Composition Editor`

Implementation merge:

`b4ab27f7620de4e2d255a1816f6bfd216a954173`

## Objective

Extend the existing Products workspace with a dedicated **Components** view for managing Material/Product component composition without bypassing `ProductComponentService` validation.

## Split assessment

No deeper formal sub-phase was required.

3.5A remained one cohesive UI task covering:

1. Components workspace integration;
2. parent Product selection;
3. component CRUD form;
4. source candidate filtering;
5. immediate composition summary;
6. nested composition preview;
7. validation/cycle feedback;
8. responsive styling;
9. helper/UI tests;
10. regression and merge gates.

## Delivered contract

The completed UI supports:

- add/edit/remove component lines;
- Material/Product source type selection;
- active valid-source filtering;
- authoritative role selection;
- positive whole `quantityPerParent`;
- readable immediate composition;
- controlled validation/cycle feedback;
- guarded nested composition preview;
- archived parent historical inspection in read-only mode.

All source mutations flow through `ProductComponentService`.

## Source filtering policy

### Material

Candidates must be:

- active;
- `baseUnit === 'pc'`;
- non-duplicate for the selected parent, excluding the line currently being edited.

### Product

Candidates must be:

- active;
- not the selected parent itself;
- non-duplicate for the selected parent, excluding the line currently being edited;
- advisory graph-safe according to the existing composition graph validator.

The UI filter remains convenience only; save-time service validation is authoritative.

## Preview policy

The nested preview is read-only and guarded against corrupted cycles.

It preserves:

- Product/Material identity and readable name;
- role;
- quantity per parent;
- notes;
- archived/missing state;
- deterministic nested structure.

It does not calculate cost/capacity, modify ProductStock, mutate composition, or recursively manufacture child Products.

## Test strategy completed

Pure helper validation:

`src/ui/products/productCompositionPreview.test.ts`

React server-render smoke validation:

`src/App.smoke.test.tsx`

No new browser-testing dependency was introduced.

## Validation evidence

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

## Completion gate

All 3.5A gates passed:

- Components view exists;
- active parent CRUD exists;
- archived parent is read-only;
- Material/Product source filtering is present;
- service-backed validation remains authoritative;
- roles/whole-piece quantities are enforced through the existing contract;
- immediate summary exists;
- nested preview is guarded/read-only;
- tests/typecheck/build are green;
- implementation PR merged;
- exact post-merge `develop` CI passed;
- closeout advances the tracker to 3.5B without starting it.

## Explicit non-goals retained

Not introduced:

- ProductStock UI — 3.5B;
- Production estimate component UI — 3.5C;
- new cost/capacity formulas;
- stock mutation/transactions;
- Phase 4 pricing;
- Phase 5 persistence.

## Next task

**3.5B — Finished Component Stock UI — NEXT / NOT STARTED**

Do not begin 3.5B until a dedicated development plan/scope review is established.
