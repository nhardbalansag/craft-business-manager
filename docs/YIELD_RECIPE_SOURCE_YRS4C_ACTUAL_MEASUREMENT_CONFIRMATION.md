# Yield Recipe Source — YRS4C Actual Measurement Confirmation

## Status

```text
YRS0 — Domain & Compatibility Audit                   COMPLETE
YRS1 — Recipe Source Domain Foundation                COMPLETE
YRS2 — Repository / Recording / Persistence           COMPLETE
YRS3 — Yield Recipe Source UI                         COMPLETE

YRS4 — Mold Formula Draft Integration Refactor        COMPLETE IN THIS CHANGE
    YRS4A — Move MY6 Assist Under Mold Formula Mode    COMPLETE
    YRS4B — Formula Preview / Planned Pieces           COMPLETE
    YRS4C — Actual Measurement Confirmation            COMPLETE IN THIS CHANGE

YRS5 — Yield History Provenance UI                    NEXT / NOT STARTED
    YRS5A — Resolved Source Labels                    NEXT
    YRS5B — Mold / Profile Traceability
    YRS5C — Legacy Sample Presentation
```

Verified YRS4C base:

```text
develop  e79cf49d68a5a1f72472c62591725b6738b224df
CI       36588183073 — SUCCESS
YRS4B    COMPLETE / MERGED
```

## Purpose

YRS4A moved the existing MY6 Formula Assist into the Mold Formula source mode.

YRS4B integrated Formula setup, planned pieces, theoretical material preview,
and capacity preview.

YRS4C completes the Mold Formula workflow by moving the real-batch measurement
confirmation into the same source mode.

The confirmation remains a safety gate. It is not persisted as business data.

## Final Mold Formula Workflow

The integrated workflow is now:

```text
Recipe source
  Mold formula
      ↓
Formula setup
  Mold
  Profile
  Planned pieces
      ↓
Theoretical Formula preview
  Water / Plaster / Glue / Total mix
  Required pours / Capacity / Extra capacity
      ↓
Use as Yield Sample Draft
      ↓
Editable actual Material quantities
      ↓
Actual measurement confirmation
      ↓
Actual good / rejected pieces
      ↓
Record Yield Sample
```

Only the final Record action creates Yield evidence.

## Confirmation Contract

After a Formula draft is attached, the Mold Formula source mode displays:

```text
Actual measurement confirmation

Status:
  Required
or
  Confirmed
```

The user must explicitly confirm:

```text
I measured this real batch and replaced or confirmed
the Material quantities below against the actual consumption.
```

Until that confirmation is checked, a Mold Formula sourced draft is not ready
to record.

## Evidence Boundary

The confirmation applies only to the real Material evidence copied from the
Formula draft.

It does not convert theoretical Formula outputs into persisted evidence.

The saved Yield Sample remains authoritative for:

- actual Material quantities;
- actual good pieces;
- actual rejected pieces;
- recorded-at timestamp;
- optional notes.

The separate Mold Formula provenance record continues to persist only:

- Yield Sample ID;
- Mold ID;
- Plaster Mold Yield Profile ID.

## Automatic Confirmation Invalidation

The existing MY6 safety rule remains unchanged:

```text
Changing a Material
Changing a Material quantity
Changing a Material unit
Adding a Material line
Removing a Material line
        ↓
measurement confirmation = false
```

The Mold Formula source mode immediately returns to:

```text
Required
```

This ensures the confirmation always applies to the current Material evidence,
not to an earlier version of the draft.

Changing good/rejected piece counts, notes, or recorded-at does not invalidate
the Material measurement confirmation because those changes do not alter the
Formula-derived Material evidence.

## Source Switching

Leaving Mold Formula mode continues to clear:

- attached Formula draft source;
- measurement confirmation;
- Mold Formula draft source state.

Manual and Mix preset modes never require this checkbox.

Returning to Mold Formula requires a real Formula draft to be attached again
before confirmation can be completed.

## Product / Source Safety

The confirmation control is disabled if the attached Formula source does not
belong to the currently selected Product.

The existing source-readiness checks still prevent recording in that state.

The UI therefore cannot use a confirmation checkbox to bypass Mold/Product
ownership validation.

## Recording Gate

The final readiness condition remains:

```text
Manual
  valid real evidence
      → recordable

Mix preset
  valid compatible Mix preset
  + valid real evidence
      → recordable

Mold formula
  valid attached Mold/profile source
  + valid real Material evidence
  + actual measurement confirmation
  + valid real piece outcome
      → recordable
```

No new persistence rule is introduced by YRS4C.

## UI Integration

The previous standalone Formula draft guard above Batch reference is removed.

The confirmation now appears inside:

```text
Mold Formula recipe source
```

after a Formula draft has been attached.

Before attachment, the confirmation is absent because there is no Formula-derived
Material evidence to confirm.

The integrated block communicates:

- why confirmation is required;
- Required / Confirmed state;
- the explicit checkbox;
- automatic reset behavior after Material edits.

## Regression Coverage

YRS4C verifies:

- no measurement confirmation exists before a Formula draft is attached;
- applying a Formula draft displays the confirmation inside Mold Formula mode;
- confirmation initially shows Required;
- the Record action remains disabled while confirmation is Required;
- checking confirmation changes the visible state to Confirmed;
- checking confirmation makes an otherwise complete Formula draft recordable;
- saved Yield evidence and Mold/profile provenance remain unchanged;
- editing a copied Material quantity resets confirmation;
- the visible state returns from Confirmed to Required after a Material edit;
- the Record action becomes disabled again after invalidation;
- Product/source mismatch disables the confirmation control;
- responsive confirmation layout remains shrink-safe.

## Deliberately Unchanged

YRS4C does not:

- alter Mold Formula coefficients;
- alter planned-piece scaling;
- persist theoretical Formula results;
- persist the confirmation boolean;
- alter Yield learning;
- alter Production calculations;
- alter preferred/effective Yield selection;
- add source provenance to Yield History.

## YRS4 Completion

With YRS4C complete:

```text
YRS4A — assistant location               COMPLETE
YRS4B — planning / Formula preview       COMPLETE
YRS4C — real-batch confirmation          COMPLETE
```

The Mold Formula draft integration refactor is therefore complete after this
change passes merge and exact post-merge `develop` CI.

## Next Exact Task

```text
YRS5A — Resolved Source Labels
NEXT / NOT STARTED
```

Do not begin YRS5A until YRS4C is merged and exact post-merge `develop` CI is green.
