# Yield Recipe Source — YRS1B Mold Formula Provenance Source Contract

## Status

```text
YRS0 — Domain & Compatibility Audit                   COMPLETE

YRS1 — Recipe Source Domain Foundation                IN PROGRESS
    YRS1A — Recipe Source Resolution Contract         COMPLETE
    YRS1B — Mold Formula Provenance Source Contract   COMPLETE
    YRS1C — Referential / Exclusivity Validation      NEXT / NOT STARTED
```

Verified YRS1B base:

```text
develop  c01f095d17f9ae0d9923b612ceba5767e50acfc9
CI       36542702568 — SUCCESS
YRS1A    COMPLETE
```

## Purpose

YRS1B defines the authoritative physical-domain source record that preserves which physical Mold and saved Plaster Mold Yield profile were used to begin one real Yield batch.

It does not yet add repositories, cross-record validation, persistence, recording orchestration, or UI.

## Authoritative Source Contract

```ts
interface YieldMoldFormulaSource {
  yieldSampleId: string;
  moldId: string;
  moldYieldProfileId: string;
}
```

This contract is intentionally minimal.

### Identity

The source has no separate synthetic `id`.

Its logical identity is:

```text
yieldSampleId
```

because the YRS0 business rule is one optional Mold Formula provenance relationship per saved Yield Sample.

The uniqueness rule itself is deferred to YRS1C.

## Why There Is No isActive

This is historical provenance for immutable production evidence.

It is not a configurable profile that can be activated/deactivated.

A saved source link should continue describing the historical batch even if the referenced Mold or profile is later archived.

Archive/reference policy is finalized in YRS1C.

## Why There Are No Formula Quantities

The source persists only:

```text
Yield Sample identity
Mold identity
Saved formula profile identity
```

It intentionally does not persist:

- Water quantity;
- Plaster quantity;
- Glue quantity;
- total mixture;
- requested quantity;
- required pours;
- produced capacity;
- extra capacity;
- formula cost;
- inventory capacity;
- safety waste.

Those remain derived or live batch evidence.

The actual measured Material inputs remain on `YieldSample`.

## Intrinsic Validation

YRS1B validates only nonblank:

```text
yieldSampleId
moldId
moldYieldProfileId
```

Coded errors:

```text
INVALID_YIELD_SAMPLE_ID
INVALID_MOLD_ID
INVALID_MOLD_YIELD_PROFILE_ID
```

## Normalization

All IDs are trimmed.

Case is preserved.

No business identity rewriting occurs.

## YRS1A Bridge

The authoritative source can be projected into the existing YRS1A read-side resolver using:

```ts
toMoldFormulaYieldRecipeSourceReference(...)
```

Only:

```text
moldId
moldYieldProfileId
```

are exposed to the resolver because `yieldSampleId` is already supplied by the corresponding Yield Sample.

## Deliberately Deferred to YRS1C

YRS1B does not validate:

- Yield Sample existence;
- Mold existence;
- PlasterMoldYieldProfile existence;
- Mold belongs to the Yield Sample Product;
- profile belongs to the Mold;
- MixPreset + Mold Formula exclusivity;
- duplicate source rows for the same Yield Sample;
- active-at-recording policy;
- historical archive/reference guards.

Those require the surrounding source collections and therefore belong to the referential validation phase.

## Persistence Boundary

YRS1B defines the source type only.

It does not yet add the record to:

- PhysicalBusinessDatasetV5;
- workbook v5;
- snapshots;
- hydration;
- repositories.

Those remain YRS2 work.

## Tests

YRS1B covers:

- canonical valid source;
- normalization;
- cloning;
- each intrinsic invalid identifier;
- stable coded error context;
- conversion to the YRS1A resolver projection;
- absence of formula-derived outputs and active-state fields.

## Next Exact Task

```text
YRS1C — Referential / Exclusivity Validation
NEXT / NOT STARTED
```

Do not begin YRS1C until YRS1B is merged and exact post-merge `develop` CI is green.
