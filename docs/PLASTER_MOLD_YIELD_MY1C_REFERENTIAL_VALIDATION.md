# Plaster Mold Yield Automation — MY1C Mold / Material Referential Validation

## Status

```text
MY0  — Domain & Workflow Audit                       COMPLETE
MY1  — Plaster Mold Formula Foundation               COMPLETE
MY1A — Formula / Result Domain Contract              COMPLETE
MY1B — Mold Yield Profile Source Contract            COMPLETE
MY1C — Mold / Material Referential Validation        COMPLETE

MY2  — Repository & Application Services             NEXT / NOT STARTED
```

MY1C completes the MY1 domain foundation. It introduces cross-source integrity rules only; it does not add repositories, workbook persistence, UI, costing, or Yield integration.

## Purpose

Validate that each authoritative `PlasterMoldYieldProfile` can safely refer to an existing physical Mold and formula Materials without weakening the application's weight/volume separation or archive semantics.

Implemented in:

`src/domain/plasterMoldYieldProfileValidation.ts`

## Referential Rules

### Mold reference

Every nonblank `moldId` must resolve to an existing Mold using trim-aware, case-insensitive identity.

For an active profile:

```text
active profile -> active Mold
```

An archived profile may retain an archived Mold reference as historical configuration, provided the Mold still exists.

### Material references

Each of:

```text
waterMaterialId
plasterMaterialId
glueMaterialId
```

must resolve to an existing Material.

The three role references must be distinct using trim-aware, case-insensitive identity.

Material group labels are not used to infer formula eligibility.

### Weight compatibility

MY v1 remains explicitly weight-based.

Therefore each referenced formula Material must use:

```text
baseUnit = g
```

This preserves the existing system rule that generic weight-to-volume conversion is not allowed.

A Material may still have package/input units such as `kg` or an explicitly calibrated/manual cup bridge while remaining formula-compatible if its canonical Material `baseUnit` is `g`.

### Active-state policy

An active profile cannot reference archived source entities:

```text
active profile -> active Mold
active profile -> active Water Material
active profile -> active Plaster Material
active profile -> active Glue Material
```

An archived profile may retain archived references so historical/configuration evidence is not destroyed merely because the related physical source was archived.

### Active-profile uniqueness

For each Mold:

```text
maximum active PlasterMoldYieldProfile count = 1
```

Multiple archived profiles for the same Mold are allowed.

One active plus any number of archived profiles for that Mold is allowed.

## Validation Result

MY1C returns a structured validation result:

```ts
{
  valid: boolean;
  issues: PlasterMoldYieldProfileReferenceIssue[];
}
```

Issue codes distinguish:

- missing Mold/Material references;
- duplicate Material roles;
- archived references used by active profiles;
- non-weight-compatible Materials;
- multiple active profiles for one Mold.

The validator is deterministic and does not mutate source collections.

## Boundary With MY1B

MY1B remains responsible for intrinsic record shape and numeric rules.

MY1C assumes those intrinsic checks are applied separately and validates cross-source relationships only.

This keeps:

```text
record contract validation
!=
referential / collection integrity validation
```

## Persistence Boundary

MY1C does not add `PlasterMoldYieldProfile` to the current persisted Business/Physical dataset schemas.

That remains deferred to MY3.

MY2 may now reuse the completed MY1 contracts and MY1C integrity validator when implementing repository/application-service behavior.

## Preserved Business Boundaries

The following remain unchanged:

```text
Mold Water Adjustment != Product Safety Waste
Mold Formula Estimate != Yield Evidence
Formula Material eligibility != Product category
```

MY1C does not alter Yield Samples, Product safety waste, Production calculations, or product-category behavior.

## Tests

Implemented in:

`src/domain/plasterMoldYieldProfileValidation.test.ts`

Coverage includes:

- valid active references;
- trim-aware/case-insensitive reference matching;
- missing reference diagnostics;
- distinct Material role enforcement;
- `baseUnit = g` weight compatibility;
- no Material-group inference;
- active-profile/archive rules;
- one-active-profile-per-Mold uniqueness;
- multiple archived-profile allowance;
- source immutability.

## Next Task

```text
MY2 — Repository & Application Services
NEXT / NOT STARTED
```

Do not start MY2 until MY1C is merged and post-merge `develop` CI is green.
