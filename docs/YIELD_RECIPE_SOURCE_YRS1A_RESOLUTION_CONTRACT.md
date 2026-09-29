# Yield Recipe Source — YRS1A Resolution Contract

## Status

```text
YRS0 — Domain & Compatibility Audit                   COMPLETE

YRS1 — Recipe Source Domain Foundation                IN PROGRESS
    YRS1A — Recipe Source Resolution Contract         COMPLETE
    YRS1B — Mold Formula Provenance Source Contract   NEXT / NOT STARTED
    YRS1C — Referential / Exclusivity Validation      NOT STARTED
```

Verified YRS1A base:

```text
develop  fd2edb6784812bca6ce318ca381deb7597447dc1
CI       36541929302 — SUCCESS
YRS0     COMPLETE
```

## Purpose

YRS1A defines the pure, read-side contract that turns existing Yield evidence plus optional Mold Formula provenance into one explicit user-facing Recipe source.

It does not add persistence, repositories, recording behavior, or UI.

## Supported Source Kinds

The only supported source kinds are:

```text
manual
mix-preset
mold-formula
```

The domain publishes:

```ts
YIELD_RECIPE_SOURCE_KINDS
YieldRecipeSourceKind
ResolvedYieldRecipeSource
```

## Resolved Contract

```ts
type ResolvedYieldRecipeSource =
  | {
      kind: 'manual';
    }
  | {
      kind: 'mix-preset';
      mixPresetId: string;
    }
  | {
      kind: 'mold-formula';
      moldId: string;
      moldYieldProfileId: string;
    };
```

This is a derived/read-side view.

It is not a new persisted YieldSample shape.

## Resolver Input

The resolver accepts:

1. the existing YieldSample source fields needed for resolution:
   - `id`;
   - optional `mixPresetId`;
2. an optional Mold Formula provenance projection:
   - `moldId`;
   - `moldYieldProfileId`.

The projection is deliberately named:

```ts
MoldFormulaYieldRecipeSourceReference
```

and is **not** the authoritative persisted provenance source record.

YRS1B owns that source contract.

## Resolution Rules

```text
Mold Formula reference present
+ mixPresetId absent
        → mold-formula

Mold Formula reference absent
+ mixPresetId present
        → mix-preset

neither present
        → manual
```

Existing no-preset Yield Samples therefore resolve as Manual without migration.

Existing Yield Samples with `mixPresetId` continue to resolve as Mix preset.

## Ambiguity Rule

If both are present:

```text
mixPresetId
+
Mold Formula reference
```

the resolver fails closed with:

```text
AMBIGUOUS_RECIPE_SOURCE
```

It does not silently choose one source.

This protects the YRS0 exclusivity decision even before YRS1C adds full cross-record validation.

## Intrinsic Mold Projection Validation

The resolver requires nonblank:

```text
moldId
moldYieldProfileId
```

and reports:

```text
INVALID_MOLD_ID
INVALID_MOLD_YIELD_PROFILE_ID
```

This is minimum shape validation only.

The resolver does **not** check:

- whether the Mold exists;
- whether the profile exists;
- whether the profile belongs to the Mold;
- whether the Mold belongs to the Yield Sample Product;
- active/archive relationship policy.

Those belong to YRS1C.

## Legacy Defensive Read Behavior

A blank/whitespace `mixPresetId` is treated as absent by the resolver.

The authoritative YieldSample write contract already rejects blank supplied MixPreset IDs; this behavior exists only to keep read-side resolution deterministic for imperfect/legacy inputs.

## Normalization

Returned IDs are trimmed.

Example:

```text
"  MIX-PLASTER  " → "MIX-PLASTER"
" MOLD-001 "       → "MOLD-001"
" PMYP-004 "       → "PMYP-004"
```

No case rewriting occurs.

## Boundaries Preserved

YRS1A does not:

- change `YieldSample`;
- change `mixPresetId` persistence;
- define the persisted Mold Formula provenance source;
- add a repository;
- record Yield evidence;
- change Yield learning;
- change preferred/effective Yield selection;
- change Product safety waste;
- change Production requirements;
- change workbook/dataset versions;
- change UI.

## Tests

YRS1A covers:

- legacy manual resolution;
- MixPreset resolution;
- Mold Formula resolution;
- trimmed IDs;
- defensive blank legacy MixPreset behavior;
- ambiguity rejection;
- invalid Mold/profile projection rejection;
- exact supported kind tokens;
- cloning;
- stable coded error shape.

## Next Exact Task

```text
YRS1B — Mold Formula Provenance Source Contract
NEXT / NOT STARTED
```

YRS1B should define the authoritative physical-domain source record that links one Yield Sample to the Mold and PlasterMoldYieldProfile used to start that real batch.

Do not begin YRS1B until YRS1A is merged and exact post-merge `develop` CI is green.
