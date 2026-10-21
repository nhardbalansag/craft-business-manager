# Yield Recipe Source — YRS5C Legacy Sample Presentation

## Status

```text
YRS0 — Domain & Compatibility Audit                   COMPLETE
YRS1 — Recipe Source Domain Foundation                COMPLETE
YRS2 — Repository / Recording / Persistence           COMPLETE
YRS3 — Yield Recipe Source UI                         COMPLETE
YRS4 — Mold Formula Draft Integration Refactor        COMPLETE

YRS5 — Yield History Provenance UI                    COMPLETE IN THIS CHANGE
    YRS5A — Resolved Source Labels                    COMPLETE
    YRS5B — Mold / Profile Traceability               COMPLETE
    YRS5C — Legacy Sample Presentation                COMPLETE IN THIS CHANGE

YRS6 — Integrated Regression & Completion Gate        NEXT / NOT STARTED
```

Verified YRS5C base:

```text
develop  33e57761870189a521ec14aab436fe069e30f0d7
CI       36595594512 — SUCCESS
YRS5B    COMPLETE / MERGED
```

## Purpose

YRS preserves the existing `YieldSample` contract.

That compatibility decision means a saved Yield row contains no field such as:

```text
createdBeforeYRS
legacySource
migrationOrigin
sourceSchemaVersion
```

The physical v4 → v5 migration also deliberately adds an empty
`yieldMoldFormulaSources` collection without rewriting old Yield Samples.

Therefore the application cannot truthfully determine whether an individual
Manual or Mix-preset row was:

- recorded before YRS;
- imported from a legacy workbook; or
- recorded after YRS using the same compatible source mode.

YRS5C presents legacy compatibility without inventing that missing origin.

## No Guessed Legacy Badge

YRS5C explicitly does **not** classify a history row as `Legacy` based on:

- recorded-at date;
- missing Mold Formula provenance;
- missing Mix preset;
- workbook migration age;
- ID format.

Those signals do not prove when or how the sample was originally created.

A per-row `Legacy` badge would therefore overstate what the persisted evidence
can establish.

## Deterministic Historical Meaning

Pre-YRS samples keep the business meaning already defined in YRS0.

### Existing sample with saved Mix preset

```text
YieldSample.mixPresetId present
Mold Formula provenance absent

→ Recipe source: Mix preset
```

History presents:

```text
Recipe source
Mix preset
<Mix preset name>
Saved Mix preset reference
```

### Existing sample with no saved Mix preset

```text
YieldSample.mixPresetId absent
Mold Formula provenance absent

→ Recipe source: Manual
```

History presents:

```text
Recipe source
Manual
No saved recipe reference
```

### Explicit Mold Formula provenance

Only an actual `YieldMoldFormulaSource` relationship resolves:

```text
Recipe source
Mold formula
```

YRS5B then displays the stored Mold/profile traceability.

## History Guidance

Yield History now includes a dedicated expandable explanation:

```text
How legacy samples are shown
```

It tells the user that:

1. pre-YRS samples retain their original saved meaning;
2. history does not guess source origin from dates or migration age;
3. saved Mix preset reference resolves to Mix preset;
4. no Mix preset and no Formula provenance resolves to Manual;
5. only explicit Mold/profile provenance resolves to Mold formula.

This provides transparent legacy behavior without altering any saved evidence.

## Source-Basis Presentation

YRS5C adds a small source-basis line for non-Formula history rows.

For Mix preset:

```text
Saved Mix preset reference
```

For Manual:

```text
No saved recipe reference
```

These statements describe the persisted evidence that caused resolution.

They do not claim the row is old or migrated.

## Migration Compatibility

The existing physical migration chain remains:

```text
physical v2
    ↓
physical v3
    ↓
physical v4
    ↓
physical v5
```

The v4 → v5 edge still:

- preserves existing Yield Samples;
- preserves existing `mixPresetId` values;
- creates no Mold Formula provenance for old rows;
- defaults `yieldMoldFormulaSources` to an empty collection.

Therefore legacy rows need no rewriting to display correctly.

## Read-Only Boundary

YRS5C changes presentation only.

It does not change:

- `YieldSample`;
- `YieldMoldFormulaSource`;
- workbook migration behavior;
- source-resolution precedence;
- preferred/effective Yield selection;
- Yield learning;
- Formula calculations;
- Production calculations;
- deletion/correction semantics.

## Regression Coverage

YRS5C verifies:

- Yield History exposes the legacy-compatibility explanation;
- the explanation explicitly states that origin is not guessed from dates or
  migration age;
- a no-preset/no-provenance sample resolves and displays Manual;
- Manual displays `No saved recipe reference`;
- a saved-Mix-preset/no-provenance sample resolves and displays Mix preset;
- Mix preset displays the existing preset name;
- Mix preset displays `Saved Mix preset reference`;
- neither compatible row is falsely presented as Mold formula;
- no guessed per-row Legacy badge is introduced.

## YRS5 Completion

With YRS5C complete:

```text
YRS5A — Resolved Source Labels          COMPLETE
YRS5B — Mold / Profile Traceability     COMPLETE
YRS5C — Legacy Sample Presentation      COMPLETE
```

Yield History provenance presentation is therefore complete after this change
passes merge and exact post-merge `develop` CI.

## Next Exact Task

```text
YRS6 — Integrated Regression & Completion Gate
NEXT / NOT STARTED
```

Do not begin YRS6 until YRS5C is merged and exact post-merge `develop` CI is green.
