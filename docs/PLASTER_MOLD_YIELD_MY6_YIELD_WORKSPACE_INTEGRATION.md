# Plaster Mold Yield Automation — MY6 Yield Workspace Integration

## Status

```text
MY0 — Domain & Workflow Audit                       COMPLETE
MY1 — Plaster Mold Formula Foundation               COMPLETE
MY2 — Repository & Application Services             COMPLETE
MY3 — Physical Dataset v4 / Workbook Migration      COMPLETE
MY4 — Mold Yield Calculator Engine                  COMPLETE
MY5 — Mold Formula Configuration UI                 COMPLETE
MY6 — Yield Workspace Integration                   COMPLETE
    MY6A — Formula → Yield Draft Mapping             COMPLETE
    MY6B — Yield Workspace Draft Assist              COMPLETE
    MY6C — Evidence Guard / Responsive Regression    COMPLETE

MY7 — Cost / Capacity / Production Preview          NEXT / NOT STARTED
```

## Purpose

MY6 connects the theoretical Mold Formula workflow to the existing immutable Yield evidence workflow without weakening the distinction between:

```text
Mold Formula Estimate
        ≠
Yield Sample Evidence
```

The integration is explicitly draft-only.

## MY6A — Formula → Yield Draft Mapping

Implemented:

```text
src/ui/yield/plasterMoldYieldDraft.ts
```

The mapper consumes the existing MY4 result and produces:

- Mold identity;
- active formula profile identity;
- theoretical Water quantity;
- theoretical Plaster quantity;
- theoretical Glue quantity;
- gram units;
- requested-quantity / required-pour capacity metadata when applicable.

It deliberately does **not** produce:

- a Yield Sample ID;
- good pieces;
- rejected pieces;
- recorded-at evidence;
- a persisted `YieldSample`.

For requested quantity 21 with a four-cavity Mold:

```text
Required pours       6
Produced capacity   24

Draft material quantities
Water              210 g
Plaster          157.5 g
Glue               10.5 g
```

These quantities remain theoretical until measured or confirmed against the real batch.

Without a requested quantity, the draft mapper uses one theoretical pour.

## MY6B — Yield Workspace Assist

New Yield-side component:

```text
PlasterMoldYieldDraftAssist
```

The assistant is shown inside the existing **Batch evidence** column for the selected Product.

It:

1. finds active physical Molds for the selected Product;
2. keeps only Molds with an active `PlasterMoldYieldProfile`;
3. resolves the saved profile through the MY4 calculator;
4. optionally accepts planned pieces;
5. previews theoretical Water / Plaster / Glue / total mixture;
6. exposes the explicit action:

```text
Use as Yield Sample Draft
```

The assistant never calls:

```text
yieldSampleEvidenceService.recordSample(...)
```

and therefore cannot create evidence by itself.

## Draft Replacement Safety

Using a formula estimate follows the same unsaved-draft protection as:

- switching Product;
- copying previous Yield evidence;
- resetting the form.

If the current Yield draft is dirty, MY6 first asks whether the user wants to discard it.

## Formula-Assisted Draft Semantics

After the user chooses **Use as Yield Sample Draft**:

- Water / Plaster / Glue Material lines are copied;
- theoretical quantities are copied;
- units are `g`;
- the normal current timestamp is prepared;
- Product-default Mix reference may remain available;
- **Good pieces is blank**;
- **Rejected pieces is blank**;
- no Sample ID is reserved beyond the ordinary live draft preview;
- no Yield record is saved.

This prevents theoretical capacity from being silently treated as actual production outcome.

## MY6C — Evidence Confirmation Guard

A formula-assisted draft carries a visible evidence warning:

```text
Formula-assisted draft
Theoretical quantities only
Actual measurements remain authoritative
```

The normal **Record yield sample** action cannot become ready until the user explicitly confirms:

```text
I measured this real batch and replaced or confirmed
the material quantities against the actual consumption.
```

The guard is in addition to the existing Yield requirements:

- valid active Product;
- valid date/time;
- valid Material lines;
- positive quantities;
- whole good-piece count;
- non-negative whole rejected-piece count.

If any formula-copied Material line is edited, added, or removed after confirmation, confirmation is reset and must be performed again.

## Final Evidence Write

MY6 does not add a new save path.

The only action that creates immutable evidence remains the existing:

```text
Record yield sample
      ↓
YieldSampleEvidenceService.recordSample(...)
```

Therefore actual Yield evidence still passes through the full existing contract/reference validation and historical-learning workflow.

## Product Safety Waste Boundary

MY6 does not apply Product `safetyWasteRate`.

The quantities copied from MY4 are the same theoretical Mold Formula values calculated before Product planning waste.

Any later planning use of safety waste remains separate.

## Yield History / Learning Boundary

Opening or using the Mold Formula assistant does not:

- add history;
- change preferred Yield;
- alter effective learning;
- modify learned per-piece requirements.

Those change only after a real Yield Sample is recorded through the existing evidence workflow.

## Responsive & Accessibility

MY6 preserves:

- labeled native Mold and planned-piece controls;
- existing mobile 44px touch-target/input baseline;
- tablet/phone layout collapse;
- shrink-safe theoretical metrics;
- alert/status semantics;
- explicit confirmation checkbox;
- existing draft-discard focus behavior.

Regression files:

```text
plasterMoldYieldDraft.test.ts
YieldPage.my6.test.tsx
PlasterMoldYieldDraftResponsive.test.ts
```

Existing Yield suites are also isolated from shared Mold/profile session state.

## Preserved Boundaries

MY6 does not implement:

- Material cost preview;
- inventory feasibility;
- cost per Mold pour;
- production capacity based on stock;
- Production workspace integration;
- safety-waste planning;
- automatic Yield evidence creation.

Those cost/capacity/production concerns remain MY7.

## Next Task

```text
MY7 — Cost / Capacity / Production Preview
NEXT / NOT STARTED
```

Do not start MY7 until MY6 is merged and exact post-merge `develop` CI is green.
