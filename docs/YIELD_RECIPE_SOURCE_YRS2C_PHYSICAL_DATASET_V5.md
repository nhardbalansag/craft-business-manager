# Yield Recipe Source — YRS2C PhysicalBusinessDatasetV5

## Status

```text
YRS0 — Domain & Compatibility Audit                   COMPLETE
YRS1 — Recipe Source Domain Foundation                COMPLETE

YRS2 — Repository / Recording / Persistence           IN PROGRESS
    YRS2A — Provenance Repository + Application Service  COMPLETE
    YRS2B — Atomic Yield + Provenance Recording        COMPLETE
    YRS2C — PhysicalBusinessDatasetV5                  COMPLETE
    YRS2D — Physical Workbook v5 + v4→v5 Migration    NEXT / NOT STARTED
    YRS2E — Snapshot / Hydration / Google Sheets Compatibility
                                                        NOT STARTED
```

Verified YRS2C base:

```text
develop  16d3a4bd3255799fdb96d68225b7a16413d15c8d
CI       36563655833 — SUCCESS
YRS2B    COMPLETE
```

## Purpose

YRS2C introduces the authoritative physical dataset version that can persist Mold Formula provenance alongside all existing physical-v4 source collections.

It is a domain/data-contract phase only.

It does not yet add XLSX sheets, workbook migration, live snapshots, hydration, Google Sheets behavior, or UI.

## PhysicalBusinessDatasetV5

```ts
interface PhysicalBusinessDatasetV5
  extends Omit<PhysicalBusinessDatasetV4, 'schemaVersion'> {
  schemaVersion: 5;
  yieldMoldFormulaSources: YieldMoldFormulaSource[];
}
```

Therefore v5 contains every existing v4 source plus:

```text
yieldMoldFormulaSources
```

No calculated formula output is added.

## Version Boundary

```text
PhysicalBusinessDatasetV4
        +
YieldMoldFormulaSource[]
        ↓
PhysicalBusinessDatasetV5
```

Schema version:

```text
5
```

The v5 contract is the persistence source model required before workbook v5 can be implemented.

## Conversion Helpers

### Extend v4 → v5

```ts
extendPhysicalBusinessDatasetV4(
  dataset,
  yieldMoldFormulaSources = [],
)
```

Legacy physical-v4 data therefore upgrades deterministically with:

```text
yieldMoldFormulaSources = []
```

unless explicit provenance is supplied.

### Downcast v5 → v4

```ts
toPhysicalBusinessDatasetV4(...)
```

This removes the v5-only provenance collection and returns an exact cloned v4 source graph.

### Clone

```ts
clonePhysicalBusinessDatasetV5(...)
```

deep-clones both inherited sources and Mold Formula provenance.

## Structural Validation

A v5 candidate must include:

```text
schemaVersion = 5
yieldMoldFormulaSources = array
```

Missing provenance collection:

```text
INVALID_DATASET
```

Wrong schema version:

```text
UNSUPPORTED_SCHEMA_VERSION
```

## Inherited v4 Validation

YRS2C delegates all inherited source integrity to:

```text
validatePhysicalBusinessDatasetV4Integrity(...)
```

Therefore v5 continues protecting:

- core BusinessDataset v2 sources;
- ProductPriceTier sources;
- StorageLocation sources;
- Mold sources;
- PlasterMoldYieldProfile sources;
- all existing v4 cross-record rules.

YRS2C does not duplicate or weaken those contracts.

## Provenance Intrinsic Validation

Each v5 provenance row passes:

```ts
validateYieldMoldFormulaSourceContract(...)
```

so these identifiers remain mandatory:

```text
yieldSampleId
moldId
moldYieldProfileId
```

Intrinsic failures are reported at:

```text
yieldMoldFormulaSources[index]
```

with the existing YRS1B coded errors.

## Provenance Referential Validation

Once all provenance rows are intrinsically valid, v5 runs:

```ts
validateYieldMoldFormulaSourceReferences({
  mode: 'historical',
  ...
})
```

against the complete dataset graph.

This protects:

```text
Yield Sample exists
Mold exists
Profile exists
MixPreset + Mold Formula exclusivity
Mold belongs to Yield Sample Product
Profile belongs to provenance Mold
One Mold Formula source per Yield Sample
```

## Historical Mode Is Intentional

Dataset validation uses:

```text
mode = historical
```

not recording mode.

Therefore a saved historical provenance link remains valid after its Mold or formula profile is archived.

This is required for import/export persistence because archive state can change after a real batch was recorded.

Recording-time active-source enforcement remains owned by YRS2B.

## Source-Only Persistence Rule

The new v5 collection stores only:

```text
yieldSampleId
moldId
moldYieldProfileId
```

It still does not persist:

- theoretical Water;
- theoretical Plaster;
- theoretical Glue;
- total mixture;
- requested pieces;
- required pours;
- Mold capacity;
- formula cost;
- stock capacity;
- Product safety waste;
- derived Yield learning.

Those remain derived or actual Yield evidence.

## Regression Coverage

YRS2C covers:

- default v4→v5 extension with empty provenance;
- explicit provenance extension;
- exact v5 schema version;
- v5→v4 downcast;
- deep clone isolation;
- required provenance collection;
- unsupported schema version;
- inherited v4 validation propagation;
- intrinsic provenance validation;
- missing Yield/Mold/profile references;
- MixPreset/Mold Formula conflict;
- duplicate provenance identity;
- Product ownership mismatch;
- profile/Mold mismatch;
- archived historical provenance validity;
- non-mutating validation.

## Deliberately Deferred

YRS2C does not add:

```text
YieldMoldFormulaSources XLSX sheet
physical workbook v5
v4 → v5 workbook migration
PhysicalSourceSnapshotServiceV5
PhysicalDatasetHydrationServiceV5
PersistenceCoordinator v5 routing
Google Sheets v5 compatibility
```

These belong to YRS2D/YRS2E.

## Next Exact Task

```text
YRS2D — Physical Workbook v5 + v4→v5 Migration
NEXT / NOT STARTED
```

Do not begin YRS2D until YRS2C is merged and exact post-merge `develop` CI is green.
