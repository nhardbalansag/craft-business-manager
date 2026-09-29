# Yield Recipe Source — YRS3D Manual Mode

## Status

```text
YRS0 — Domain & Compatibility Audit                   COMPLETE
YRS1 — Recipe Source Domain Foundation                COMPLETE
YRS2 — Repository / Recording / Persistence           COMPLETE

YRS3 — Yield Recipe Source UI                         COMPLETE IN THIS CHANGE
    YRS3A — Recipe Source Selector                     COMPLETE
    YRS3B — Mix Preset Mode                            COMPLETE
    YRS3C — Mold Formula Mode                          COMPLETE
    YRS3D — Manual Mode                                COMPLETE IN THIS CHANGE

YRS4 — Mold Formula Draft Integration Refactor        NEXT / NOT STARTED
    YRS4A — Move MY6 Assist Under Mold Formula Mode    NEXT
    YRS4B — Formula Preview / Planned Pieces
    YRS4C — Actual Measurement Confirmation
```

Verified YRS3D base:

```text
develop  6ed71aa4501628f5575d3936a5771787213c9e78
CI       36580867951 — SUCCESS
YRS3C    COMPLETE / MERGED
```

## Purpose

YRS3A introduced the explicit Recipe source selector.

YRS3B completed the Mix preset source-specific UI.

YRS3C completed the Mold Formula source/provenance UI.

YRS3D completes the YRS3 source-mode set by making `manual` an explicit
source-specific presentation instead of representing Manual only by the absence
of other controls.

## Manual Source Contract

Manual means:

```text
saved Mix preset reference       absent
Mold Formula provenance          absent
physical Mold/profile source     absent
```

The recorded batch is based only on:

```text
actual Material quantities
actual good pieces
actual rejected pieces
recorded-at timestamp
optional notes
```

No new persistence fields are required.

## Mode Visibility

The Manual mode is rendered only when:

```text
recipeSourceKind = manual
```

When Manual is active:

- Mix preset mode is absent;
- Mold Formula mode is absent;
- the MY6 formula draft source is cleared through the YRS3A source-switch
  contract;
- `mixPresetId` remains empty.

The mode itself contains no source-specific input controls because Manual has no
saved recipe identity to select.

## Evidence Guidance

The Manual mode explicitly communicates:

```text
Recipe reference
  None

Physical provenance
  None

Evidence source
  Actual batch measurements
```

This makes the persisted semantics visible to the user without creating a
duplicate set of Material or outcome inputs.

The authoritative controls remain the existing Yield sections:

- Materials actually consumed;
- Good pieces;
- Rejected pieces;
- Recorded at;
- Notes.

## Validation

Manual does not bypass normal Yield evidence validation.

The existing Yield evidence rules still require:

- selected active Product;
- valid recorded-at timestamp;
- complete active Material references;
- unit compatibility;
- positive/valid Material quantities;
- valid whole-piece counts.

Manual does not require:

- a Mix preset;
- a Mold Formula draft;
- a Mold/profile source;
- MY6 actual-measurement confirmation.

## Recording Contract

Manual continues to record through the YRS2/YRS3A source-aware coordinator:

```ts
yieldRecipeSourceRecordingService.record({
  sample,
  source: {
    kind: 'manual',
  },
});
```

The persisted result is:

```text
YieldSample.mixPresetId          absent
YieldMoldFormulaSource           absent
```

The normal Yield Sample still contains the actual batch evidence.

## Legacy Compatibility

The YRS1 source-resolution rule remains unchanged:

```text
Mold Formula provenance exists
    → mold-formula

otherwise mixPresetId exists
    → mix-preset

otherwise
    → manual
```

Therefore legacy Yield Samples that have no Mix preset and no Mold Formula
provenance continue to resolve as Manual without migration or rewritten
history.

## YRS3 Completion

With YRS3D complete, all three selectable source modes now have explicit UI:

```text
Recipe source
  Mix preset
    → dedicated Mix preset mode

  Mold formula
    → dedicated Mold Formula source/provenance mode

  Manual
    → dedicated Manual mode
```

YRS3 is therefore complete after this change passes merge and exact post-merge
CI.

## Regression Coverage

YRS3D verifies:

- Products without a default Mix preset still start in Manual;
- Manual mode is rendered for the Manual source;
- Mix preset mode is absent while Manual is active;
- Mold Formula mode is absent while Manual is active;
- Manual states that no saved recipe is linked;
- Manual states that no Mold/profile provenance is linked;
- Manual identifies actual batch measurements as the evidence source;
- the Manual source mode adds no duplicate input/select/button controls;
- Manual recording delegates with `source.kind = 'manual'`;
- recorded Manual samples contain no `mixPresetId`;
- recorded Manual samples create no `YieldMoldFormulaSource`;
- existing Mix preset and Mold Formula source-mode behavior remains unchanged.

## Deliberately Deferred

YRS3D does not:

- move the MY6 assistant;
- restructure the Mold Formula calculator;
- change formula preview or planned pieces;
- change MY6 measurement confirmation;
- add source labels to Yield History;
- add Mold/profile traceability to history;
- change persistence contracts;
- change Yield learning or Production mathematics.

## Next Exact Task

```text
YRS4A — Move MY6 Assist Under Mold Formula Mode
NEXT / NOT STARTED
```

Do not begin YRS4A until YRS3D is merged and exact post-merge `develop` CI is green.
