# Yield Recipe Source — YRS2A Provenance Repository & Application Service

## Status

```text
YRS0 — Domain & Compatibility Audit                   COMPLETE
YRS1 — Recipe Source Domain Foundation                COMPLETE

YRS2 — Repository / Recording / Persistence           IN PROGRESS
    YRS2A — Provenance Repository + Application Service  COMPLETE
    YRS2B — Atomic Yield + Provenance Recording        NEXT / NOT STARTED
    YRS2C — PhysicalBusinessDatasetV5                  NOT STARTED
    YRS2D — Physical Workbook v5 + v4→v5 Migration    NOT STARTED
    YRS2E — Snapshot / Hydration / Google Sheets Compatibility
                                                        NOT STARTED
```

Verified YRS2A base:

```text
develop  a9a3876b94360a632bca1e99ac60b5c6f6eb7ffc
CI       36545345748 — SUCCESS
YRS1     COMPLETE
```

## Purpose

YRS2A adds the first application/persistence boundary for the YRS1 physical Mold Formula provenance source.

It provides:

- a repository contract;
- an in-memory repository;
- a validation-aware application service;
- shared session wiring.

It does not yet coordinate creation with Yield evidence, persist the collection in PhysicalBusinessDatasetV5, or expose Recipe source UI.

## Repository Contract

```ts
interface YieldMoldFormulaSourceRepository {
  list(): Promise<YieldMoldFormulaSource[]>;
  findByYieldSampleId(
    yieldSampleId: string,
  ): Promise<YieldMoldFormulaSource | null>;
  insert(source: YieldMoldFormulaSource): Promise<void>;
  delete(yieldSampleId: string): Promise<void>;
}
```

The logical identity remains:

```text
yieldSampleId
```

Repository matching is trim-aware and case-insensitive.

## Immutability Boundary

The application service does not expose update or delete operations.

A provenance source is historical evidence metadata:

```text
create once
read thereafter
```

The repository's `delete` method is intentionally an infrastructure seam only.

It exists for future YRS2B coordinated correction/rollback behavior.

Likewise, the in-memory repository implements:

```ts
CollectionReplacementPort<YieldMoldFormulaSource>
```

so YRS2C/E can later hydrate the collection atomically.

Neither infrastructure seam changes the application-level immutable provenance rule.

## Application Service

```text
YieldMoldFormulaSourceService
```

Public operations:

```text
createSource(...)
getSourceForYieldSample(...)
listSources(...)
resolveRecipeSourceForYieldSample(...)
```

### createSource

Creation performs:

1. YRS1B normalization;
2. YRS1B intrinsic validation;
3. duplicate logical identity check;
4. reference canonicalization against current repositories;
5. full proposed-collection YRS1C historical validation;
6. candidate-only YRS1C recording validation;
7. repository insert.

The two validation passes are intentional.

## Historical + Recording Validation Split

Existing provenance may legitimately point to a Mold/profile archived after the batch occurred.

Therefore creating a new source must **not** run recording-mode active checks against all historical rows.

YRS2A performs:

```text
all existing sources + candidate
        ↓
historical mode
        ↓
reference / ownership / uniqueness / exclusivity integrity

candidate only
        ↓
recording mode
        ↓
active Mold + active profile requirement
```

This preserves history while enforcing safe new recording.

## Canonical Reference Storage

When referenced records exist, YRS2A stores their canonical source IDs.

Example input:

```text
yieldSampleId       " yld-001 "
moldId              " mold-001 "
moldYieldProfileId  " pmyp-001 "
```

with authoritative records:

```text
YLD-001
MOLD-001
PMYP-001
```

is stored as:

```text
YLD-001
MOLD-001
PMYP-001
```

Case-insensitive lookup does not rewrite source identity arbitrarily.

## Application Errors

YRS2A adds:

```text
SOURCE_ALREADY_EXISTS
YIELD_SAMPLE_NOT_FOUND
```

and exposes YRS1C relationship issue codes through the application boundary, including:

```text
MISSING_YIELD_SAMPLE_REFERENCE
MISSING_MOLD_REFERENCE
MISSING_MOLD_YIELD_PROFILE_REFERENCE
MIX_PRESET_SOURCE_CONFLICT
MOLD_PRODUCT_MISMATCH
PROFILE_MOLD_MISMATCH
DUPLICATE_YIELD_MOLD_FORMULA_SOURCE
MOLD_INACTIVE_AT_RECORDING
PROFILE_INACTIVE_AT_RECORDING
```

Intrinsic YRS1B validation remains authoritative for blank source identifiers.

## Recipe Source Resolution

```text
resolveRecipeSourceForYieldSample(...)
```

combines:

- existing YieldSample;
- optional YieldMoldFormulaSource;
- YRS1A resolver.

It returns:

```text
manual
mix-preset
mold-formula
```

without changing the Yield evidence.

## Session Wiring

The shared session now exports:

```text
yieldMoldFormulaSourceRepository
yieldMoldFormulaSourceService
```

They use the same shared:

- YieldSample repository;
- Mold repository;
- PlasterMoldYieldProfile repository.

The provenance repository is **not yet** part of Physical Source Snapshot / Hydration.

That belongs to YRS2C/YRS2E.

## Tests

YRS2A covers:

- repository identity matching;
- repository cloning;
- infrastructure delete;
- future hydration replaceAll;
- canonical source creation;
- duplicate-source rejection;
- MixPreset/Mold Formula exclusivity;
- missing references;
- Product ownership mismatch;
- profile/Mold mismatch;
- recording-time archived Mold/profile rejection;
- archived historical provenance coexisting with a new active source;
- deterministic list/filter behavior;
- Manual/Mix preset/Mold formula resolution;
- missing Yield Sample resolution;
- absence of application-level update/delete methods;
- shared session wiring.

## Deliberately Deferred

YRS2A does not:

- atomically create YieldSample + provenance;
- coordinate Yield correction/deletion with provenance;
- add PhysicalBusinessDatasetV5;
- add workbook v5;
- add snapshot/hydration;
- change Google Sheets import;
- change the Yield UI.

## Next Exact Task

```text
YRS2B — Atomic Yield + Provenance Recording
NEXT / NOT STARTED
```

Do not begin YRS2B until YRS2A is merged and exact post-merge `develop` CI is green.
