# Phase 2.5A — Products & Mix Presets UI

## Status

**IMPLEMENTED — VALIDATION / MERGE GATE**

Feature branch: `feature/phase-2-5a-products-mix-ui`

Implementation PR: **#50**

## Objective

Expose the completed Phase 2.1 Product and MixPreset application services through the React application without bypassing domain/application validation.

## Delivered Product UI

The Products workspace now supports:

- create product;
- edit product;
- archive product;
- search by product ID, name, notes, or mix reference;
- filter by category;
- filter by active/archived status;
- category selection using the locked Phase 2 product categories;
- safety-waste percentage input backed by the Product `safetyWasteRate` contract;
- optional compatible mix-preset assignment;
- notes;
- active/archived state display.

Product category guidance is visible in the form, including production style and typical mix basis.

Only mix presets compatible with the selected product category are offered. Active/new products receive active compatible options; an existing archived reference can remain visible while editing historical data.

## Delivered Mix Preset UI

The same top-level Products workspace includes a dedicated **Mix presets** view with:

- create mix preset;
- edit mix preset;
- archive mix preset;
- search by ID/name/material/category/notes;
- filter by ratio basis;
- filter by active/archived status;
- weight or volume ratio basis;
- one or more compatible product categories;
- dynamic material lines;
- line role selection (`primary`, `secondary`, `additive`);
- positive ratio-parts entry;
- notes;
- readable ratio summaries in the list.

The UI does not implement its own duplicate/material/dependency rules. Saves flow through `MixPresetService`, which remains authoritative for:

- contract validation;
- active material references;
- duplicate identity/name rules;
- active-product dependency protection.

## Navigation

The top application navigation now enables **Products**.

Current top-level workspaces:

- Materials;
- Calibration;
- Products;
- Production (still disabled until Phase 2.5C).

Within Products, the user switches between:

- Products;
- Mix presets.

## Service boundaries

The React workspace consumes the shared application session services:

- `productService`;
- `mixPresetService`;
- `materialService`.

React does not write repositories directly and does not duplicate domain validation.

## Important scope boundaries

Phase 2.5A does **not** implement:

- yield sample recording/history — Phase 2.5B;
- production estimates/capacity UI — Phase 2.5C;
- purchased vessels or molded/nested product components — Phase 3;
- selling-price/profit policy — Phase 4;
- persistence migration — later storage phases.

## Validation coverage

The React smoke suite now renders the Products workspace server-side and verifies the principal Product/Mix UI sections without requiring browser effects.

Existing ProductService and MixPresetService regression suites remain authoritative for CRUD and relationship behavior beneath the UI.

## Completion gate

2.5A may be marked complete after:

- TypeScript typecheck passes;
- all existing Product/Mix service/domain regressions pass;
- Products workspace smoke validation passes;
- production build passes;
- PR #50 merges into `develop`;
- post-merge `develop` CI passes.

## Next task after completion

**2.5B — Yield Recording & History UI**
