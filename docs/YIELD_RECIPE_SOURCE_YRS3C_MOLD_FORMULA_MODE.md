# Yield Recipe Source — YRS3C Mold Formula Mode

## Status

```text
YRS0 — Domain & Compatibility Audit                   COMPLETE
YRS1 — Recipe Source Domain Foundation                COMPLETE
YRS2 — Repository / Recording / Persistence           COMPLETE

YRS3 — Yield Recipe Source UI                         IN PROGRESS
    YRS3A — Recipe Source Selector                     COMPLETE
    YRS3B — Mix Preset Mode                            COMPLETE
    YRS3C — Mold Formula Mode                          COMPLETE IN THIS CHANGE
    YRS3D — Manual Mode                                NEXT / NOT STARTED
```

Verified YRS3C base:

```text
develop  4ade5c5cecfa56963a6678808b4ffa458dc16602
CI       36578589994 — SUCCESS
YRS3B    COMPLETE / MERGED
```

## Purpose

YRS3A introduced the authoritative Recipe source selector and YRS3B completed
the first source-specific mode.

YRS3C gives `mold-formula` its own source-specific area beneath that selector.

This phase deliberately separates two concerns:

```text
YRS3C
  = Mold Formula source/provenance mode

YRS4
  = move/refactor the complete MY6 Formula Assist workflow into that mode
```

That keeps the task boundary explicit and prevents the YRS4A–YRS4C work from
being pulled forward accidentally.

## Mode Visibility

The Mold Formula mode is rendered only when:

```text
recipeSourceKind = mold-formula
```

Manual and Mix preset drafts do not show the Mold Formula source panel.

The existing MY6 `MOLD FORMULA ASSIST` remains in its pre-YRS4 location above
the Yield form.

## Empty Mold Formula State

Selecting Mold formula does not invent a physical source.

Before the user applies a saved formula draft, the mode shows:

```text
No Mold Formula is attached to this draft yet.
```

and directs the user to the existing `MOLD FORMULA ASSIST` workflow.

The Yield draft remains non-recordable because YRS3A source readiness still
requires a real attached Mold Formula draft.

This preserves the principle:

```text
explicit Mold Formula source selection
    ≠
physical provenance until a real Mold/profile source is attached
```

## Attached Source Summary

After MY6 supplies a formula draft, the Mold Formula mode displays the exact
physical source identity that will become provenance:

```text
Mold
  name
  moldId

Formula profile
  moldYieldProfileId

Recording behavior
  Mold + profile provenance
```

Example:

```text
Mold
  Four Cavity Dino Mold
  MOLD-MY6

Formula profile
  PMYP-MY6

Recording behavior
  Mold + profile provenance
```

This summary is provenance-only.

It intentionally does not present:

- planned pieces;
- Water estimate;
- Plaster estimate;
- Glue estimate;
- required pours;
- produced capacity;
- extra capacity;
- total mixture;
- cost.

Those remain derived MY6/YRS4 concerns.

## Product Ownership Guard

The mode independently checks that the attached draft's Product identity matches
the currently selected Product.

A mismatch is shown visibly as invalid source state:

```text
This Mold Formula belongs to another Product.
```

YRS3A source readiness already rejects this condition for recording; YRS3C
makes that rule visible in the source-specific UI.

## Evidence Boundary

The mode explicitly distinguishes source provenance from actual Yield evidence.

The user is reminded:

```text
Formula quantities = theoretical draft guidance

Actual recorded evidence =
  measured Material quantities
  good pieces
  rejected pieces
  recorded-at timestamp
```

YRS3C does not weaken any MY6 safeguards.

## Recording Contract

YRS3C does not introduce a new persistence path.

Recording remains the YRS3A/YRS2 atomic source-aware transaction:

```ts
yieldRecipeSourceRecordingService.record({
  sample,
  source: {
    kind: 'mold-formula',
    moldId: formulaDraftSource.moldId,
    moldYieldProfileId: formulaDraftSource.profileId,
  },
});
```

The persisted result remains:

```text
YieldSample
+
YieldMoldFormulaSource {
  yieldSampleId
  moldId
  moldYieldProfileId
}
```

and:

```text
YieldSample.mixPresetId = absent
```

No theoretical formula result is persisted as provenance.

## MY6 Integration State

Using `Use as Yield Sample Draft` in the existing MY6 assistant already:

1. changes Recipe source to `mold-formula`;
2. clears Mix preset provenance;
3. attaches the exact Mold/profile source draft;
4. copies theoretical Water/Plaster/Glue quantities into editable Material
   inputs;
5. leaves good/rejected pieces blank;
6. requires actual-batch confirmation.

YRS3C now reflects step 3 visibly in the source mode.

The assistant itself is not moved in this phase.

## YRS4 Boundary

The following work remains explicitly deferred:

### YRS4A — Move MY6 Assist Under Mold Formula Mode

Move the existing assistant from above the Yield form into the Mold Formula
source area.

### YRS4B — Formula Preview / Planned Pieces

Bring the planned-piece input and theoretical quantity/capacity preview into the
mode.

### YRS4C — Actual Measurement Confirmation

Move/refine the actual-batch measurement confirmation into the final integrated
Mold Formula mode.

YRS3C must remain valid before and after those layout changes.

## Regression Coverage

YRS3C verifies:

- Mold Formula mode is absent for Manual by default;
- selecting Mold formula renders the dedicated source mode;
- an unattached Mold Formula source is explicit and non-recordable;
- the empty mode points to the current MY6 assistant;
- applying an MY6 formula draft automatically selects Mold formula;
- attached source summary displays exact Mold name/ID and profile ID;
- the source summary communicates Mold/profile provenance recording;
- the source summary does not present planned pieces or theoretical totals;
- a Product/source mismatch is visibly invalid;
- Mix preset mode remains mutually exclusive with Mold Formula mode;
- MY6 formula recording continues to create exact physical provenance;
- Mix preset provenance remains absent from formula-sourced samples;
- existing measured-batch confirmation safeguards remain unchanged.

## Deliberately Deferred

YRS3C does not:

- move the MY6 assistant;
- move planned pieces into the source mode;
- move theoretical formula output into the source mode;
- move/refactor the MY6 measurement confirmation;
- implement Manual mode presentation;
- add resolved provenance to Yield History;
- change formula mathematics;
- change Yield learning or Production behavior.

## Next Exact Task

```text
YRS3D — Manual Mode
NEXT / NOT STARTED
```

Do not begin YRS3D until YRS3C is merged and exact post-merge `develop` CI is green.
