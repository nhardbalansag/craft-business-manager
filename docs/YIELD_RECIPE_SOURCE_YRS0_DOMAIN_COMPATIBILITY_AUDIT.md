# Yield Recipe Source Enhancement — YRS0 Domain & Compatibility Audit

## Status

```text
YRS0 — Domain & Compatibility Audit                   COMPLETE

YRS1 — Recipe Source Domain Foundation                NEXT / NOT STARTED
YRS2 — Repository / Recording / Persistence           NOT STARTED
YRS3 — Yield Recipe Source UI                         NOT STARTED
YRS4 — Mold Formula Draft Integration Refactor        NOT STARTED
YRS5 — Yield History Provenance UI                    NOT STARTED
YRS6 — Integrated Regression & Completion Gate        NOT STARTED
```

Verified audit baseline:

```text
develop  3a8e87469df35e0db939915f9dc942e99a7b33b7
CI       36533479009 — SUCCESS
Tiered Pricing TP0–TP9 — COMPLETE
Plaster Mold Yield MY0–MY8 — COMPLETE
```

YRS0 is audit/design only. It does not change the runtime Yield workflow.

---

## Requested UX Change

The current Yield workspace has:

```text
Mix preset used
[ preset / No preset ]

MOLD FORMULA ASSIST
[ separate Mold Formula workflow ]
```

The target UX is one explicit recipe-source choice:

```text
Recipe source
[ Mix preset | Mold formula | Manual ]
```

with source-specific controls below it.

The actual Material quantities, good pieces, rejected pieces, and recorded-at evidence remain authoritative regardless of source.

---

## Current Contract Findings

### Current YieldSample

The authoritative Yield evidence contract currently stores:

```ts
YieldSample {
  id
  productId
  mixPresetId?
  materialInputs
  goodPieces
  rejectedPieces
  recordedAt
  notes?
}
```

There is no recipe-source discriminator and no Mold/profile provenance.

Current interpretation is implicit:

```text
mixPresetId present  → Mix preset reference
mixPresetId absent   → Manual / no preset
```

### Current Mold Formula Draft

MY6 keeps Mold Formula provenance only in transient Yield UI state.

The current formula-draft action:

- copies theoretical Water / Plaster / Glue quantities;
- intentionally leaves good/rejected pieces blank;
- requires real-batch measurement confirmation;
- does not create Yield evidence automatically.

However, the current formula draft also initializes the ordinary Yield form's `mixPresetId` from the selected Product default.

Therefore a recorded formula-assisted sample can currently preserve a MixPreset reference while losing the fact that the draft actually originated from a Mold Formula.

That is the main provenance ambiguity YRS resolves.

### Current Evidence Validation

`YieldSampleEvidenceService` validates:

- Product existence/activity;
- optional MixPreset existence/activity/category compatibility;
- Material existence/activity/unit compatibility.

It has no Mold/profile dependency.

### Current Dataset Validation

Core dataset validation checks Yield references to:

- Product;
- optional MixPreset;
- Materials.

Physical dataset v4 separately owns:

- Storage Locations;
- Molds;
- PlasterMoldYieldProfiles.

This boundary matters: Mold Formula provenance is a physical-domain relationship, not a core Yield-only relationship.

### Current Workbook Contract

The core `YieldSamples` sheet is strict and currently contains:

```text
id
productId
mixPresetId
goodPieces
rejectedPieces
recordedAt
notes
```

The workbook schema validates canonical columns and ordering.

Changing the current YieldSamples columns in place would therefore require a core workbook migration.

---

# YRS0 Decision

## Do NOT Replace the Existing YieldSample Contract

YRS will preserve the current `YieldSample` structure.

In particular:

```text
mixPresetId
```

remains the persisted MixPreset provenance field for existing and future MixPreset-based samples.

This preserves:

- current Yield history;
- Yield learning;
- preferred Yield selection;
- core dataset v1/v2 behavior;
- core workbook compatibility;
- existing Google Sheets compatibility;
- existing Production learning.

## Add Physical Mold Formula Provenance Separately

Introduce a new physical authoritative source record conceptually:

```ts
YieldMoldFormulaSource {
  yieldSampleId: string;
  moldId: string;
  moldYieldProfileId: string;
}
```

The exact final type name belongs to YRS1.

This record exists only when a saved Yield Sample was started from a Mold Formula.

It does **not** store calculated formula quantities.

The actual YieldSample continues to store the measured batch evidence.

---

# Recipe Source Resolution Contract

The user-facing source is resolved as:

```text
1. Mold Formula source link exists
      → mold-formula

2. Otherwise YieldSample.mixPresetId exists
      → mix-preset

3. Otherwise
      → manual
```

This yields the desired discriminated presentation without rewriting all existing samples.

Conceptually:

```ts
type ResolvedYieldRecipeSource =
  | { kind: 'manual' }
  | {
      kind: 'mix-preset';
      mixPresetId: string;
    }
  | {
      kind: 'mold-formula';
      moldId: string;
      moldYieldProfileId: string;
    };
```

This is a derived/application view.

---

# Source Exclusivity Rules

For a newly recorded sample:

## Manual

```text
YieldSample.mixPresetId        absent
Mold Formula source link       absent
```

## Mix preset

```text
YieldSample.mixPresetId        required
Mold Formula source link       absent
```

## Mold formula

```text
YieldSample.mixPresetId        absent
Mold Formula source link       exactly one
```

A saved sample must never simultaneously claim:

```text
MixPreset provenance
+
Mold Formula provenance
```

This removes the current MY6 ambiguity.

---

# Mold Formula Reference Rules

For a new Mold Formula sourced Yield sample:

1. Yield Sample must exist / be recorded as part of the same application operation.
2. Mold must exist.
3. Mold must belong to the Yield Sample Product.
4. PlasterMoldYieldProfile must exist.
5. Profile must belong to the selected Mold.
6. At recording time, the chosen Mold/profile must satisfy the active/source requirements used by the current MY4 calculator.
7. Historical links remain valid if the Mold/profile is later archived.
8. Deleting or losing referenced physical source records must not be possible through normal guarded application flows while historical provenance depends on them, unless an explicit future correction policy is added.

YRS1/YRS2 must define the exact relationship guards needed for historical provenance.

---

# Important Historical Semantics

The new Mold Formula source record is provenance, not formula-result persistence.

It records:

```text
Which Mold?
Which formula profile?
```

It does not persist:

- adjusted Water;
- Plaster grams;
- Glue grams;
- total mixture;
- required pours;
- produced capacity;
- formula costs;
- stock capacity.

Those remain derived.

Also, the source link does not make theoretical formula values actual evidence.

The saved YieldSample's measured Material quantities and actual good/rejected pieces remain authoritative.

---

# Legacy Compatibility Decision

Existing persisted Yield samples migrate without rewriting their business meaning.

## Existing sample with mixPresetId

Resolve as:

```text
mix-preset
```

No new Mold Formula source link is created.

## Existing sample without mixPresetId

Resolve as:

```text
manual
```

No new Mold Formula source link is created.

This means legacy workbooks have deterministic provenance with no user intervention.

---

# Persistence Versioning Decision

## Core dataset/workbook

No core version bump is required for YRS.

The existing YieldSample contract and existing core YieldSamples workbook columns remain unchanged.

This avoids unnecessary changes to:

- BusinessDataset / BusinessDatasetV2;
- core workbook v3;
- existing legacy core migrations;
- existing Google Sheets core compatibility.

## Physical dataset/workbook

Mold Formula provenance is a physical-domain source and requires a new physical source collection.

Therefore YRS2 should introduce:

```text
PhysicalBusinessDatasetV5
Physical workbook v5
```

with one new source collection/sheet for Yield ↔ Mold Formula provenance.

Conceptual sheet:

```text
YieldMoldFormulaSources
-----------------------
yieldSampleId
moldId
moldYieldProfileId
```

The exact sheet/type naming is finalized in YRS1/YRS2.

Migration:

```text
Physical v2
   ↓
Physical v3
   ↓
Physical v4
   ↓
Physical v5
```

The v4 → v5 migration adds an empty Mold Formula provenance collection.

Thus every legacy Yield sample naturally resolves using its current `mixPresetId` state.

---

# Google Sheets Compatibility

The public Google Sheets feature fetches XLSX bytes and delegates parsing/migration to the shared PersistenceCoordinator.

Therefore YRS does not require a Google-specific source model.

Required regression:

- published legacy physical workbooks still migrate through the shared chain;
- physical v5 published snapshots import normally;
- core/legacy workbooks without physical Mold Formula provenance remain supported.

---

# Recording Transaction Decision

Mold Formula source recording cannot be implemented as:

```text
record YieldSample
then
insert provenance link
```

without coordination, because the second write could fail and leave ambiguous evidence.

YRS2 must provide one application operation that validates first and then records:

```text
YieldSample + optional Mold Formula provenance
```

with rollback/atomic semantics appropriate to the in-memory repository graph.

The existing `YieldSampleEvidenceService` remains the authoritative evidence validator.

YRS must extend/co-ordinate it rather than bypass it.

---

# Yield Learning / Production Compatibility

Yield learning currently derives only from:

- measured Material inputs;
- good pieces;
- rejected pieces;
- Material/calibration evidence.

It does not use `mixPresetId` as a quantity source.

Therefore adding recipe-source provenance must not alter Yield learning mathematics.

Likewise:

```text
Recipe source provenance
        ≠
Production recipe authority
```

Actual Yield evidence remains authoritative for learned requirements.

Product safety waste remains a separate Production planning policy.

---

# UI Decision

Replace the current visible batch-reference concept:

```text
Mix preset used
```

with:

```text
Recipe source
[ Mix preset | Mold formula | Manual ]
```

## Mix preset mode

Show:

```text
Recipe source
Mix preset

Mix preset
[ active compatible preset ]
```

The existing MixPreset reference behavior remains.

## Mold formula mode

Show the existing MY6 capabilities inside the source area:

```text
Recipe source
Mold formula

Mold
[ configured active Mold ]

Profile
[ saved active profile identity ]

Planned pieces
[ optional ]

Formula estimate
Water / Plaster / Glue
Required pours
Capacity / extra capacity

Use Formula as Draft
```

The current separate `MOLD FORMULA ASSIST` presentation should be refactored into this mode rather than duplicated.

## Manual mode

Show:

```text
Recipe source
Manual
```

and keep Material inputs fully manual.

---

# Draft / Confirmation Rules

Mold Formula mode keeps all MY6 safeguards:

1. Using formula quantities only creates a draft.
2. Good pieces remains blank.
3. Rejected pieces remains blank.
4. Actual Material quantities remain editable.
5. User must explicitly confirm the real batch was measured/confirmed.
6. Editing/adding/removing formula-derived Material lines resets confirmation.
7. Record Yield Sample remains the only evidence-creation action.

MixPreset and Manual modes do not require the Mold Formula measurement checkbox unless a future rule explicitly adds one.

---

# Yield History Decision

History should display resolved provenance.

Examples:

```text
Recipe source
Mix preset
Standard Plaster Mix
```

```text
Recipe source
Mold Formula
Dinosaur 4-Cavity Mold
PMYP-0004
```

```text
Recipe source
Manual
```

This is display/provenance only.

It must not change preferred/effective Yield selection.

---

# YRS Development Roadmap

```text
YRS0 — Domain & Compatibility Audit                   COMPLETE

YRS1 — Recipe Source Domain Foundation                NEXT / NOT STARTED
    YRS1A — Recipe Source Resolution Contract
    YRS1B — Mold Formula Provenance Source Contract
    YRS1C — Referential / Exclusivity Validation

YRS2 — Repository / Recording / Persistence           NOT STARTED
    YRS2A — Provenance Repository + Application Service
    YRS2B — Atomic Yield + Provenance Recording
    YRS2C — PhysicalBusinessDatasetV5
    YRS2D — Physical Workbook v5 + v4→v5 Migration
    YRS2E — Snapshot / Hydration / Google Sheets Compatibility

YRS3 — Yield Recipe Source UI                         NOT STARTED
    YRS3A — Recipe Source Selector
    YRS3B — Mix Preset Mode
    YRS3C — Mold Formula Mode
    YRS3D — Manual Mode

YRS4 — Mold Formula Draft Integration Refactor        NOT STARTED
    YRS4A — Move MY6 Assist Under Mold Formula Mode
    YRS4B — Formula Preview / Planned Pieces
    YRS4C — Actual Measurement Confirmation

YRS5 — Yield History Provenance UI                    NOT STARTED
    YRS5A — Resolved Source Labels
    YRS5B — Mold / Profile Traceability
    YRS5C — Legacy Sample Presentation

YRS6 — Integrated Regression & Completion Gate        NOT STARTED
```

---

# YRS0 Completion Gate

YRS0 is complete when the implementation contract agrees that:

```text
Existing YieldSample contract preserved                 YES
Existing MixPreset Yield samples remain compatible      YES
Legacy no-preset samples resolve Manual                  YES
Mold Formula provenance becomes explicit                YES
MixPreset + Mold Formula simultaneous source forbidden  YES
Formula outputs remain derived                          YES
Actual Yield measurements remain authoritative          YES
Core workbook version bump required                     NO
Physical workbook v5 required                           YES
Google Sheets remains shared-XLSX compatibility path    YES
Atomic Yield + provenance recording required            YES
MY6 safety confirmation retained                        YES
Yield learning / Production mathematics unchanged       YES
```

## Next Exact Task

```text
YRS1A — Recipe Source Resolution Contract
NEXT / NOT STARTED
```

Do not begin YRS1A until YRS0 is merged and exact post-merge `develop` CI is green.
