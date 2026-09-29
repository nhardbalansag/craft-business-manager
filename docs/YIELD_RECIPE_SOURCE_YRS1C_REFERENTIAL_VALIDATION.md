# Yield Recipe Source — YRS1C Referential / Exclusivity Validation

## Status

```text
YRS0 — Domain & Compatibility Audit                   COMPLETE

YRS1 — Recipe Source Domain Foundation                COMPLETE
    YRS1A — Recipe Source Resolution Contract         COMPLETE
    YRS1B — Mold Formula Provenance Source Contract   COMPLETE
    YRS1C — Referential / Exclusivity Validation      COMPLETE

YRS2 — Repository / Recording / Persistence           NEXT / NOT STARTED
```

Verified YRS1C base:

```text
develop  d6bdf63541c943ffd7d5cf8b9e081de8f81da3c1
CI       36543752092 — SUCCESS
YRS1B    COMPLETE
```

## Purpose

YRS1C closes the Yield Recipe Source domain foundation by validating the cross-record relationships that make a saved Mold Formula provenance link trustworthy.

It does not add repositories, recording orchestration, dataset/workbook v5, or UI.

## Validator

```ts
validateYieldMoldFormulaSourceReferences(...)
```

Input collections:

```text
YieldMoldFormulaSource[]
YieldSample[]
Mold[]
PlasterMoldYieldProfile[]
```

with validation mode:

```text
historical
recording
```

## Referential Rules

Each nonblank provenance record must reference:

1. an existing Yield Sample;
2. an existing Mold;
3. an existing PlasterMoldYieldProfile.

Issue codes:

```text
MISSING_YIELD_SAMPLE_REFERENCE
MISSING_MOLD_REFERENCE
MISSING_MOLD_YIELD_PROFILE_REFERENCE
```

Identity matching is trim-aware and case-insensitive.

## Recipe Source Exclusivity

If the referenced Yield Sample already has:

```text
mixPresetId
```

the same Yield Sample cannot also have Mold Formula provenance.

Issue:

```text
MIX_PRESET_SOURCE_CONFLICT
```

Therefore the YRS1A resolution contract remains unambiguous.

## Product Ownership

The referenced Mold must belong to the same Product as the Yield Sample.

```text
YieldSample.productId == Mold.productId
```

Issue:

```text
MOLD_PRODUCT_MISMATCH
```

This prevents attaching a Product A production batch to a Mold owned by Product B.

## Profile / Mold Ownership

The referenced PlasterMoldYieldProfile must belong to the Mold stored on the provenance record.

```text
PlasterMoldYieldProfile.moldId == YieldMoldFormulaSource.moldId
```

Issue:

```text
PROFILE_MOLD_MISMATCH
```

## One Source Per Yield Sample

Only one Mold Formula provenance row is allowed per Yield Sample.

Duplicate identity matching is trim-aware and case-insensitive.

Issue:

```text
DUPLICATE_YIELD_MOLD_FORMULA_SOURCE
```

This completes the YRS1B decision that `yieldSampleId` is the logical source identity.

## Historical vs Recording-Time Policy

YRS1C explicitly separates two different validation contexts.

### Historical mode

```text
mode = historical
```

This is the default.

Archived Mold/profile references remain valid.

Reason:

A real Yield Sample is immutable historical evidence. Archiving the Mold or formula profile later must not invalidate the historical statement that the batch originally used those sources.

Historical validation still requires:

- references to exist;
- Product ownership;
- profile/Mold ownership;
- source exclusivity;
- one source per Yield Sample.

### Recording mode

```text
mode = recording
```

New Mold Formula Yield evidence additionally requires:

```text
Mold.isActive == true
PlasterMoldYieldProfile.isActive == true
```

Issues:

```text
MOLD_INACTIVE_AT_RECORDING
PROFILE_INACTIVE_AT_RECORDING
```

YRS2B should use recording mode before atomically saving new Yield evidence + provenance.

YRS2 persistence/import validation should use historical mode.

## Intrinsic Validation Boundary

Blank IDs are not reported as missing references by YRS1C.

Those are already intrinsic YRS1B contract failures:

```text
INVALID_YIELD_SAMPLE_ID
INVALID_MOLD_ID
INVALID_MOLD_YIELD_PROFILE_ID
```

Keeping the two layers separate avoids duplicate diagnostics.

## Rules Deliberately Not Added

YRS1C does not require a historical provenance profile to remain active.

It also does not persist a snapshot of formula quantities.

The existence of the provenance link does not mean:

```text
theoretical formula == actual Yield evidence
```

Actual Material inputs and good/rejected piece counts remain on YieldSample and remain authoritative.

## Tests

YRS1C covers:

- valid relationship graph;
- trim/case-insensitive identity matching;
- missing Yield/Mold/profile references;
- MixPreset/Mold Formula exclusivity;
- Mold/Product ownership;
- profile/Mold ownership;
- duplicate provenance per Yield Sample;
- archived historical references;
- recording-time active requirements;
- intrinsic blank-ID boundary;
- independent multi-issue reporting;
- non-mutating validation.

## YRS1 Completion

With YRS1C complete:

```text
YRS1 — Recipe Source Domain Foundation COMPLETE
```

The domain now has:

- explicit resolved source kinds;
- authoritative Mold Formula provenance source;
- deterministic exclusivity and relationship validation.

## Next Exact Task

```text
YRS2A — Provenance Repository + Application Service
NEXT / NOT STARTED
```

Do not begin YRS2A until YRS1C is merged and exact post-merge `develop` CI is green.
