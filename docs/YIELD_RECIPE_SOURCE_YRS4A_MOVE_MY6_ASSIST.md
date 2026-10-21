# Yield Recipe Source — YRS4A Move MY6 Assist Under Mold Formula Mode

## Status

```text
YRS0 — Domain & Compatibility Audit                   COMPLETE
YRS1 — Recipe Source Domain Foundation                COMPLETE
YRS2 — Repository / Recording / Persistence           COMPLETE
YRS3 — Yield Recipe Source UI                         COMPLETE

YRS4 — Mold Formula Draft Integration Refactor        IN PROGRESS
    YRS4A — Move MY6 Assist Under Mold Formula Mode    COMPLETE IN THIS CHANGE
    YRS4B — Formula Preview / Planned Pieces           NEXT / NOT STARTED
    YRS4C — Actual Measurement Confirmation            NOT STARTED
```

Verified YRS4A base:

```text
develop  9266517bf3587ca3dc68161379e78426acfa390b
CI       36582444764 — SUCCESS
YRS3     COMPLETE / MERGED
```

## Purpose

Before YRS4A, the MY6 `MOLD FORMULA ASSIST` component was rendered globally
above the Yield form.

That meant it remained visible while Recipe source was:

- Manual;
- Mix preset;
- Mold formula.

YRS4A relocates the existing assistant beneath the dedicated Mold Formula mode
introduced in YRS3C.

The new relationship is:

```text
Recipe source = Mold formula
        ↓
YieldMoldFormulaMode
        ↓
MOLD FORMULA ASSIST
```

The assistant is no longer rendered outside the Mold Formula source mode.

## Relocation Boundary

YRS4A changes placement only.

The existing `PlasterMoldYieldDraftAssist` implementation remains authoritative
for:

- eligible active Molds;
- active Plaster Mold Yield Profiles;
- planned-piece input;
- Mold Formula calculation;
- Water / Plaster / Glue estimate;
- total mixture estimate;
- required pours / capacity / extra capacity;
- `Use as Yield Sample Draft`.

No formula mathematics changed.

No calculation service changed.

No persistence contract changed.

## Source-Specific Visibility

The assistant now appears only when:

```text
recipeSourceKind = mold-formula
```

Therefore:

```text
Manual
    → no MY6 assistant

Mix preset
    → no MY6 assistant

Mold formula
    → MY6 assistant nested in Mold Formula mode
```

This completes the source-specific ownership decision made in YRS0.

## Mold Formula Mode Integration

`YieldMoldFormulaMode` now exposes an assistant slot.

The Yield workspace supplies the existing MY6 assistant into that slot.

This keeps the Mold Formula mode responsible for composition without duplicating
MY6 calculation behavior.

The mode still owns the source/provenance summary:

- selected Mold;
- selected profile;
- Mold/profile recording behavior.

The MY6 assistant still owns calculation/draft preparation.

## Empty Source State

Before an MY6 draft is applied, the Mold Formula mode continues to show:

```text
No Mold Formula is attached to this draft yet.
```

Its guidance now points to the assistant **below** rather than to a separate
assistant above the form.

The mode remains non-recordable until a real Mold/profile source draft is
attached.

## Draft Replacement Guard Compatibility

Moving the assistant introduced one important interaction:

1. an otherwise-empty draft starts in Manual or Mix preset;
2. the user selects Mold formula to reveal the assistant;
3. Recipe source state becomes different from the original draft baseline;
4. using the assistant could therefore be misclassified as replacing a dirty
   batch.

YRS4A distinguishes Recipe-source-only changes from substantive Yield evidence
changes for Formula draft replacement.

If the only changes are:

- Recipe source selection; and/or
- Mix preset source identity cleared as part of switching source;

then using the MY6 Formula draft proceeds directly.

If the user has changed actual draft evidence such as:

- recorded-at;
- Material lines;
- Material quantities;
- good pieces;
- rejected pieces;
- notes;

the existing unsaved-draft confirmation still applies.

This preserves protection for real entered evidence without forcing a false
discard prompt merely to enter Mold Formula mode.

## MY6 Safety Contract Preserved

Using `Use as Yield Sample Draft` still:

1. copies theoretical Material quantities into editable Yield inputs;
2. sets Recipe source to Mold formula;
3. clears Mix preset reference;
4. attaches exact Mold/profile source identity;
5. leaves good pieces blank;
6. leaves rejected pieces blank;
7. requires actual batch confirmation before recording.

The resulting recording path remains:

```text
YieldSample
+
YieldMoldFormulaSource
```

through the YRS2 source-aware atomic recording service.

## Styling

The relocated assistant retains its MY6 component and responsive styles.

YRS4A only normalizes the nested bottom spacing so the existing panel fits
cleanly inside the Mold Formula mode.

Deeper visual integration is intentionally left to YRS4B/YRS4C.

## Regression Coverage

YRS4A verifies:

- the MY6 assistant is absent in the default Manual mode;
- selecting Mold formula renders the assistant inside the Mold Formula mode;
- the assistant is physically nested under the mode in the DOM;
- the empty Mold Formula state points to the assistant below;
- formula calculations remain unchanged;
- planned-piece scaling remains unchanged;
- using the assistant still creates a theoretical Yield draft only;
- a source-only switch to Mold formula does not trigger a false dirty-draft
  confirmation;
- actual dirty Yield evidence still triggers the replacement guard;
- formula recording still persists Mold/profile provenance;
- formula recording still carries no Mix preset reference;
- measurement confirmation behavior remains unchanged.

## Deliberately Deferred

YRS4A does not:

- redesign the planned-pieces control;
- redesign formula estimate cards;
- combine provenance summary and formula preview;
- move/refine the actual measurement confirmation;
- alter formula math;
- alter Yield learning;
- alter Production calculations;
- add Yield History provenance.

Those remain YRS4B, YRS4C, and YRS5 work.

## Next Exact Task

```text
YRS4B — Formula Preview / Planned Pieces
NEXT / NOT STARTED
```

Do not begin YRS4B until YRS4A is merged and exact post-merge `develop` CI is green.
