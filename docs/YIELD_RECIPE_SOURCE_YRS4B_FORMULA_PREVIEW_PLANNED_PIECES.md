# Yield Recipe Source — YRS4B Formula Preview / Planned Pieces

## Status

```text
YRS0 — Domain & Compatibility Audit                   COMPLETE
YRS1 — Recipe Source Domain Foundation                COMPLETE
YRS2 — Repository / Recording / Persistence           COMPLETE
YRS3 — Yield Recipe Source UI                         COMPLETE

YRS4 — Mold Formula Draft Integration Refactor        IN PROGRESS
    YRS4A — Move MY6 Assist Under Mold Formula Mode    COMPLETE
    YRS4B — Formula Preview / Planned Pieces           COMPLETE IN THIS CHANGE
    YRS4C — Actual Measurement Confirmation            NEXT / NOT STARTED
```

Verified YRS4B base:

```text
develop  0521efd0f45b51553e275cd715f9564c2efa05d0
CI       36584187256 — SUCCESS
YRS4A    COMPLETE / MERGED
```

## Purpose

YRS4A moved the existing MY6 assistant into the dedicated Mold Formula source
mode without changing its internals.

YRS4B completes the planning side of that integration by presenting the saved
Mold/profile source, planned-piece target, theoretical material estimate, and
production capacity as one coherent Formula setup / preview workflow.

YRS4B does not change the formula mathematics.

## Formula Setup

The Mold Formula source area now presents:

```text
Formula setup

Mold Formula
[ active configured Mold ]

Planned pieces
[ optional positive whole number ]

Source context
Mold / Mold ID
Profile / pieces per pour
```

The selected Mold continues to be limited to active Molds for the selected
Product that also have an active saved Plaster Mold Yield Profile.

The selected profile remains the authoritative source of the MY6 formula
parameters.

## Planned Pieces Contract

Planned pieces is optional.

### Blank target

A blank field means:

```text
One-pour baseline
```

The preview uses the saved profile's single-pour formula quantities and:

```text
Required pours   1
Capacity         piecesPerPour
Extra capacity   0
```

### Positive whole-number target

Entering a value such as:

```text
21
```

requests the existing calculator to scale the formula to that production
target.

For a four-piece-per-pour Mold this resolves to:

```text
Required pours   6
Capacity         24
Extra capacity   3
```

The planned target is not saved as Yield evidence.

It is planning input used to derive the theoretical draft quantities.

### Invalid target

Existing MY6 validation remains:

```text
Planned pieces must be a positive whole number.
```

An invalid target produces no usable formula draft until corrected.

## Theoretical Formula Preview

The preview now groups the calculation into two explicit evidence-free sections.

### Material estimate

```text
Water
Plaster
Glue
Total mix
```

Values continue to come directly from the existing
`PlasterMoldYieldCalculatorService`.

When planned pieces is blank, the preview uses per-pour values.

When planned pieces is supplied, the preview uses the calculator's requested
quantity totals.

### Production capacity

```text
Required pours
Capacity
Extra capacity
```

The UI no longer compresses these into a single sentence. They are explicit
structured preview values so the user can distinguish production target from
physical Mold capacity.

## Source Context

Before copying the Formula into the Yield draft, YRS4B surfaces the candidate
source that is driving the calculation:

```text
Mold
  name
  ID

Profile
  profile ID
  pieces per pour
```

This is the candidate planning source.

After the user chooses `Use as Yield Sample Draft`, the existing YRS3C source
summary continues to represent the attached draft provenance that will be
recorded.

No new source record is created merely by previewing the formula.

## Draft Boundary

The call to action remains:

```text
Use as Yield Sample Draft
```

It continues to:

- copy Water / Plaster / Glue theoretical quantities into editable Yield
  Material inputs;
- attach exact Mold/profile source identity to the draft;
- keep good pieces blank;
- keep rejected pieces blank;
- create no Yield evidence;
- require actual-batch confirmation before recording.

The preview explicitly states that copied quantities remain editable and are
not evidence yet.

## YRS4C Boundary

YRS4B deliberately leaves the actual measurement confirmation workflow
unchanged.

The existing confirmation currently remains outside the Formula setup/preview
area and still gates recording after a formula draft has been applied.

YRS4C owns:

- integrating that confirmation into the final Mold Formula workflow;
- refining its placement and copy;
- preserving confirmation invalidation when formula-derived Material evidence
  changes.

YRS4B does not move or weaken that safeguard.

## Regression Coverage

YRS4B verifies:

- the Formula setup appears only inside Mold Formula mode;
- the active Mold and profile are shown as source context;
- blank planned pieces produces a one-pour baseline;
- one-pour preview exposes required pours, capacity, and zero extra capacity;
- a planned target scales Water / Plaster / Glue / total mix through the
  existing calculator;
- a planned target exposes structured required pours / capacity / extra
  capacity;
- theoretical preview values remain unchanged from MY6 mathematics;
- using the preview still creates only an editable Yield draft;
- good/rejected pieces remain blank;
- actual measurement confirmation remains required;
- Mold/profile provenance recording remains unchanged.

## Deliberately Deferred

YRS4B does not:

- change formula coefficients or calculator math;
- persist planned pieces;
- persist theoretical formula results;
- move/refine actual measurement confirmation;
- change source persistence;
- change Yield learning;
- change Production calculations;
- add provenance to Yield History.

## Next Exact Task

```text
YRS4C — Actual Measurement Confirmation
NEXT / NOT STARTED
```

Do not begin YRS4C until YRS4B is merged and exact post-merge `develop` CI is green.
