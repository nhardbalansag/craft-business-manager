# Yield Recipe Source — YRS3A Recipe Source Selector

## Status

```text
YRS0 — Domain & Compatibility Audit                   COMPLETE
YRS1 — Recipe Source Domain Foundation                COMPLETE
YRS2 — Repository / Recording / Persistence           COMPLETE

YRS3 — Yield Recipe Source UI                         IN PROGRESS
    YRS3A — Recipe Source Selector                     COMPLETE IN THIS CHANGE
    YRS3B — Mix Preset Mode                            NEXT / NOT STARTED
    YRS3C — Mold Formula Mode                          NOT STARTED
    YRS3D — Manual Mode                                NOT STARTED
```

Verified YRS3A base:

```text
develop  c40d221549b006571e94a5650214d4e0f632da06
CI       36573687770 — SUCCESS
YRS2     COMPLETE / MERGED
```

## Purpose

YRS3A replaces the Yield draft's implicit source interpretation with one explicit
controlled Recipe source selection:

```text
Recipe source
[ Mix preset | Mold formula | Manual ]
```

The selector does not change what constitutes authoritative Yield evidence.

The saved evidence remains:

- actual Material quantities;
- actual good pieces;
- actual rejected pieces;
- actual recorded-at timestamp;
- optional notes.

Recipe source is provenance describing what guided the batch.

## Selector Contract

The UI uses one controlled source kind from the YRS1 domain contract:

```ts
type YieldRecipeSourceKind =
  | 'manual'
  | 'mix-preset'
  | 'mold-formula';
```

The selector is implemented as one accessible radio group so the three choices
are mutually exclusive by construction.

The selector owns only source selection. Source-specific controls remain in the
Yield workflow and are refined in YRS3B–YRS3D.

## Draft State Rules

The recipe source kind is now part of the live Yield draft state.

That means changing source is treated as a real draft change rather than a
decorative view preference.

### New/reset draft

If the selected Product has a default Mix preset:

```text
recipeSourceKind = mix-preset
mixPresetId      = Product.mixPresetId
```

Otherwise:

```text
recipeSourceKind = manual
mixPresetId      = absent
```

### Copy historical Yield sample

Existing persisted semantics remain authoritative:

```text
sample.mixPresetId present
    → mix-preset

sample.mixPresetId absent
    → manual
```

Historical Mold Formula presentation is intentionally deferred to YRS5 because
the history list does not yet resolve physical provenance.

### Use MY6 Mold Formula draft

Using the existing Mold Formula assistant now explicitly changes the draft to:

```text
recipeSourceKind = mold-formula
mixPresetId      = absent
```

This removes the old ambiguity where a formula-assisted draft could inherit the
Product default Mix preset.

## Source Exclusivity in the Draft

Switching to Manual or Mold formula clears the draft Mix preset reference.

Switching away from a Mold Formula draft clears its transient formula source and
measurement confirmation so stale physical provenance cannot silently survive a
source change.

Switching to Mix preset may reuse a currently valid compatible preset or the
Product default compatible preset. Otherwise the user must choose a preset
before the draft is recordable.

## Source Readiness

The draft reference step now depends on the selected source.

### Manual

```text
source ready = true
```

No saved recipe reference is required.

### Mix preset

```text
source ready =
  nonblank Mix preset
  +
  active compatible Mix preset
```

### Mold formula

```text
source ready =
  attached MY6 Mold Formula draft
  +
  Formula Mold belongs to selected Product
```

The existing MY6 measured-batch confirmation remains required before Formula
material quantities become recordable evidence.

## Source-Aware Recording

YRS3A moves the Yield UI from the legacy direct call:

```text
YieldSampleEvidenceService.recordSample(...)
```

to the already-completed YRS2 atomic boundary:

```text
YieldRecipeSourceRecordingService.record(...)
```

This is required for the selector to be authoritative rather than decorative.

Recording maps the selected source as follows:

```text
Manual
  → source: { kind: 'manual' }

Mix preset
  → source: {
      kind: 'mix-preset',
      mixPresetId
    }

Mold formula
  → source: {
      kind: 'mold-formula',
      moldId,
      moldYieldProfileId
    }
```

Mold Formula recording therefore creates:

```text
YieldSample
+
YieldMoldFormulaSource
```

through the YRS2B coordinated write/rollback path.

It does not persist theoretical Water, Plaster, Glue, capacity, pours, or cost.

## Mold Formula Correction Safety

The existing Yield history delete command knows only about Yield evidence.

After YRS3A, a Mold Formula sample can also own physical provenance.

Deleting only the Yield Sample would create an orphan provenance record and make
the physical-v5 source graph invalid.

Therefore YRS3A fails closed:

```text
Mold Formula provenance exists
    → legacy Yield-only deletion blocked
```

Manual and Mix preset correction behavior remains unchanged.

A future coordinated correction workflow must remove/restore Yield evidence and
physical provenance together. YRS3A deliberately does not implement a partial
correction path.

## Transitional UI Boundaries

YRS3A intentionally does not complete all source-specific presentation.

### Mix preset

The existing Mix preset select remains in the Batch reference section but is
enabled only while Recipe source = Mix preset.

Its mode-specific layout/refinement belongs to:

```text
YRS3B — Mix Preset Mode
```

### Mold formula

The existing MY6 `MOLD FORMULA ASSIST` panel remains in its current location.

Using it automatically selects Mold formula and attaches the exact Mold/profile
source needed for provenance recording.

Moving that assistant inside the Mold Formula source area belongs to:

```text
YRS4 — Mold Formula Draft Integration Refactor
```

### Manual

Manual selection already guarantees no Mix preset or Mold Formula provenance.

Dedicated Manual-mode presentation belongs to:

```text
YRS3D — Manual Mode
```

## Regression Coverage

YRS3A verifies:

- the selector exposes exactly Manual / Mix preset / Mold formula;
- selection is mutually exclusive;
- selector disabled state follows Yield editability;
- a Product without a default preset starts in Manual;
- Mix preset controls are disabled outside Mix preset source;
- selecting Mix preset enables its reference and records `mixPresetId`;
- Mix preset recording creates no Mold Formula provenance;
- using an MY6 Formula draft selects Mold formula;
- formula draft recording does not inherit Product Mix preset provenance;
- formula recording creates the exact Mold/profile provenance link;
- formula quantities remain draft-only until measured confirmation;
- repeat-save protection still works through the source-aware recorder;
- failed source-aware recording preserves the entered draft;
- existing Yield, MY6, learning, and history regressions remain intact.

## Deliberately Deferred

YRS3A does not:

- move the Mix preset controls into their final mode-specific presentation;
- move the MY6 Formula Assist panel;
- redesign Manual source fields;
- add resolved Recipe source labels to history;
- add Mold/profile traceability to history;
- implement coordinated deletion/correction for physical provenance;
- change Yield learning or Production mathematics.

## Next Exact Task

```text
YRS3B — Mix Preset Mode
NEXT / NOT STARTED
```

Do not begin YRS3B until YRS3A is merged and exact post-merge `develop` CI is green.
