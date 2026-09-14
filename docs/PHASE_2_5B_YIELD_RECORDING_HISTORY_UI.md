# Phase 2.5B — Yield Recording & History UI

## Status

**IMPLEMENTED — VALIDATION / MERGE GATE**

Feature branch: `feature/phase-2-5b-yield-history-ui`

Implementation PR: **#52**

## Objective

Expose the completed Phase 2.2 yield evidence, learning, and effective-history services through React without duplicating their business rules in the UI.

## Delivered workspace

The application now has a top-level **Yield** workspace alongside Materials, Calibration, and Products.

The workspace supports:

- selecting an existing product;
- recording a new yield sample for an active product;
- viewing historical yield evidence for active or archived products;
- selecting an optional active/category-compatible mix preset reference;
- entering multiple actual material inputs with quantity and compatible unit;
- recording good-piece and rejected-piece counts;
- recording sample timestamp and notes;
- viewing the currently effective sample;
- viewing learned base-unit requirement per good piece;
- viewing defect rate separately from safety waste;
- seeing newer samples skipped because they are currently not derivable;
- viewing immutable batch history;
- deleting an evidence record only through the guarded correction service.

## Evidence-first behavior

The UI records actual source facts only:

```text
sample ID
product
optional mix preset
actual material quantities + units
good pieces
rejected pieces
recorded timestamp
notes
```

It does not persist learned grams/mL/pieces per product. Those values remain derived from the existing yield-learning domain.

## Material input units

Unit options are constrained using the existing Phase 1 conversion rules:

- same-dimension standard units are allowed;
- the explicit dry-material `cup -> g` bridge is allowed for gram-based materials;
- arbitrary cross-dimension input is not offered;
- final validation remains authoritative in `YieldSampleEvidenceService`.

## Effective history

The UI consumes `YieldHistoryService.getEffective()` and preserves the Phase 2.2C policy:

```text
latest currently derivable sample wins
```

When a newer sample cannot currently be learned (for example, calibration is missing), the workspace:

- keeps the sample in immutable history;
- shows that newer invalid samples were skipped;
- displays the older valid sample as effective.

No automatic averaging is introduced.

## Effective learning display

For the selected effective sample the workspace shows:

- good pieces;
- rejected pieces;
- observed defect rate;
- learned material quantity per good piece;
- canonical material base unit;
- conversion source;
- calibration ID where applicable.

Observed defect rate remains historical evidence and is not converted into safety waste.

## Correction/deletion protection

History records are not editable. Correction is an explicit delete operation routed through `YieldHistoryService.deleteSample()`.

For active products, the existing application rule remains authoritative:

- non-effective history can be removed;
- effective history can be removed when a valid fallback exists;
- the last valid effective sample cannot be removed until a replacement is recorded or the product is archived.

## Archived products

Archived products remain selectable for historical inspection.

The recording form is disabled for archived products, preserving the existing rule that new yield evidence requires an active product.

## Navigation

Current top-level workspaces after 2.5B:

- Materials;
- Calibration;
- Products;
- Yield;
- Production (still disabled until Phase 2.5C).

## React boundary

The workspace consumes shared application-session services:

- `productService`;
- `materialService`;
- `mixPresetService`;
- `yieldSampleEvidenceService`;
- `yieldHistoryService`.

React does not write repositories directly and does not independently implement yield selection or deletion rules.

## Validation coverage

The React smoke suite now renders the Yield workspace server-side and verifies the principal recording/history sections.

Existing domain/application regression suites remain authoritative for:

- evidence validation;
- active product/material/mix reference validation;
- yield learning;
- defect-rate derivation;
- effective sample selection;
- invalid-sample fallback;
- protected deletion.

## Scope boundaries

2.5B does **not** implement:

- production requirement/quantity estimate UI — Phase 2.5C;
- producible-piece/capacity UI — Phase 2.5C;
- inventory reservation or production orders;
- purchased vessels or molded/nested components — Phase 3;
- selling-price/profit behavior — Phase 4.

## Completion gate

2.5B may be marked complete after:

- TypeScript typecheck passes;
- all existing yield/domain/application regressions pass;
- Yield workspace smoke validation passes;
- production build passes;
- PR #52 merges into `develop`;
- post-merge `develop` CI passes.

## Next task after completion

**2.5C — Production Estimate UI**
