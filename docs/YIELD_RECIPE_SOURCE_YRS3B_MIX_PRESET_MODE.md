# Yield Recipe Source — YRS3B Mix Preset Mode

## Status

```text
YRS0 — Domain & Compatibility Audit                   COMPLETE
YRS1 — Recipe Source Domain Foundation                COMPLETE
YRS2 — Repository / Recording / Persistence           COMPLETE

YRS3 — Yield Recipe Source UI                         IN PROGRESS
    YRS3A — Recipe Source Selector                     COMPLETE
    YRS3B — Mix Preset Mode                            COMPLETE IN THIS CHANGE
    YRS3C — Mold Formula Mode                          NEXT / NOT STARTED
    YRS3D — Manual Mode                                NOT STARTED
```

Verified YRS3B base:

```text
develop  f195cdb229268fb97c9c34b8f41d6b1e5f4977ec
CI       36576459748 — SUCCESS
YRS3A    COMPLETE / MERGED
```

## Purpose

YRS3A established the authoritative Recipe source selector.

YRS3B makes `mix-preset` a real source-specific UI mode instead of leaving its
control as a generic field that is merely disabled for other source kinds.

The mode now appears only when:

```text
recipeSourceKind = mix-preset
```

and contains the controls and reference information needed to choose a valid
saved Mix preset for new Yield evidence.

## Mode Contract

The Mix preset mode owns:

- active Product-category-compatible preset selection;
- selected preset identity;
- ratio basis presentation;
- saved ratio-line presentation;
- optional preset notes;
- unavailable/missing copied-reference diagnostics.

The mode does not own:

- actual consumed Material quantities;
- good/rejected piece evidence;
- Yield learning mathematics;
- Mold Formula provenance;
- Production recipe authority.

## Active Compatibility Filter

The parent Yield workflow continues to derive:

```text
compatibleMixes =
  active Mix presets
  AND
  compatible with selected Product category
```

Only those presets are offered as valid choices for new evidence.

This preserves the existing `YieldSampleEvidenceService` validation policy.

## Selected Preset Preview

After choosing a valid Mix preset, YRS3B presents:

```text
Preset name / ID
Ratio basis
Material ratio lines
Optional notes
```

Example:

```text
Standard Plaster Mix · MIX-PLASTER
Weight ratio

Plaster of Paris   2 parts   primary
Water              1 part    secondary
```

Material names are resolved for readability when available.

The preview is reference guidance only.

## Actual Evidence Boundary

A Mix preset stores relative recipe parts.

It does not automatically become actual production evidence.

Therefore YRS3B deliberately does not copy/derive those parts into the Yield
Material inputs.

The authoritative recorded evidence remains:

```text
Materials actually consumed
+
Good pieces
+
Rejected pieces
```

The mode explicitly tells the user that actual material quantities are not
replaced by the preset ratio.

This preserves the YRS0 rule:

```text
Recipe source provenance ≠ actual Yield evidence
```

## Empty Compatible-Preset State

If the user selects Mix preset but the selected Product has no active compatible
preset, the mode shows:

```text
No active compatible Mix preset is available.
```

The selector is disabled because there is no valid option, and the Yield draft
remains non-recordable.

The user can:

- create/reactivate a compatible Mix preset;
- choose Manual;
- choose Mold formula.

YRS3B does not silently fall back to Manual because that would change the
explicit Recipe source selection.

## Copied Legacy / Unavailable Presets

A copied historical Yield sample can reference a Mix preset that is now:

- archived;
- category-incompatible;
- or missing from the current repository.

YRS3B keeps that identity visible rather than silently clearing it.

The draft remains non-recordable until an active compatible preset is selected.

If the referenced preset still exists, the UI can show its saved name/ratio with
an unavailable warning.

If the referenced preset no longer exists, the raw persisted ID remains visible
with an unavailable diagnostic.

This keeps copied history honest while applying current-source rules to new
evidence.

## Recording

YRS3B does not change the YRS3A recording transaction.

Valid Mix preset recording remains:

```ts
yieldRecipeSourceRecordingService.record({
  sample,
  source: {
    kind: 'mix-preset',
    mixPresetId,
  },
});
```

Persistence remains:

```text
YieldSample.mixPresetId = selected Mix preset
YieldMoldFormulaSource  = absent
```

## Source Exclusivity

Leaving Mix preset mode still clears `mixPresetId` through the YRS3A source
selector contract.

Therefore Manual and Mold Formula drafts cannot retain hidden Mix preset
provenance.

Returning to Mix preset can reuse:

1. a still-valid current selection; or
2. the Product's active compatible default Mix preset.

Otherwise a valid preset must be chosen explicitly.

## Responsive / Accessibility Contract

The Mix preset mode:

- is rendered only for the matching Recipe source;
- exposes a labeled native select;
- keeps explicit empty and unavailable states in visible text;
- presents ratio lines in a responsive compact summary;
- does not rely on color alone for invalid/unavailable state.

## Regression Coverage

YRS3B verifies:

- Mix preset mode is absent while Recipe source is Manual;
- choosing Mix preset renders its dedicated source area;
- only active compatible presets supplied by the Yield workflow are selectable;
- a valid selected preset previews name, ID, ratio basis, and ratio lines;
- ratio preview does not replace actual Material inputs;
- selecting a preset records its `mixPresetId`;
- Mix preset recording creates no Mold Formula provenance;
- no-compatible-preset mode is explicit and non-recordable;
- archived/unavailable copied presets remain visible but invalid;
- missing copied preset IDs remain visible rather than silently clearing;
- existing YRS3A source exclusivity remains intact;
- existing Yield/MY6/history/learning regressions remain green.

## Deliberately Deferred

YRS3B does not:

- build the Mold Formula mode UI;
- move the existing MY6 Mold Formula Assist;
- build the final Manual mode presentation;
- auto-fill actual Yield Material quantities from MixPreset ratios;
- change MixPreset domain or persistence contracts;
- display source provenance in Yield History.

Those remain YRS3C–YRS5 work.

## Next Exact Task

```text
YRS3C — Mold Formula Mode
NEXT / NOT STARTED
```

Do not begin YRS3C until YRS3B is merged and exact post-merge `develop` CI is green.
