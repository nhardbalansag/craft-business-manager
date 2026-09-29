# Plaster Mold Yield Automation — MY3 Physical Dataset v4 / Workbook Migration

## Status

```text
MY0 — Domain & Workflow Audit                       COMPLETE
MY1 — Plaster Mold Formula Foundation               COMPLETE
MY2 — Repository & Application Services             COMPLETE
MY3 — Physical Dataset v4 / Workbook Migration      COMPLETE
    MY3A — PhysicalBusinessDatasetV4 Contract        COMPLETE
    MY3B — Workbook v4 + v2/v3 Migration Chain      COMPLETE
    MY3C — Snapshot / Hydration / Session Wiring     COMPLETE
    MY3D — Compatibility / Round-Trip Regression     COMPLETE

MY4 — Mold Yield Calculator Engine                  NEXT / NOT STARTED
```

## MY3A — Dataset v4

`PhysicalBusinessDatasetV4` extends the existing physical-v3 dataset with:

```ts
plasterMoldYieldProfiles: PlasterMoldYieldProfile[]
```

Schema version:

```text
4
```

Validation composes:

- the complete PhysicalBusinessDatasetV3 integrity gate;
- MY1B intrinsic profile validation;
- duplicate profile-ID detection;
- MY1C Mold/Material reference integrity.

Calculated formula outputs remain absent from authoritative persistence.

## MY3B — Workbook v4

Current physical workbook metadata becomes:

```text
workbookFormatVersion = 4
datasetSchemaVersion  = 4
```

New canonical sheet:

```text
PlasterMoldYieldProfiles
```

Columns:

```text
id
moldId
waterMaterialId
plasterMaterialId
glueMaterialId
waterFillWeightGrams
waterAdjustmentRate
plasterFactor
glueFactor
piecesPerPour
notes
isActive
```

No derived Water/Plaster/Glue quantities, per-piece values, requested quantities, costs, or Yield evidence are persisted.

## Migration Chain

Recognized physical migration chain:

```text
physical workbook 2 / dataset 2
        ↓
physical workbook 3 / dataset 3
        ↓
physical workbook 4 / dataset 4
```

Migration from v3 to v4 preserves every existing source sheet and appends an empty `PlasterMoldYieldProfiles` sheet.

Therefore old workbooks continue importing without inventing formula configuration.

## MY3C — Atomic Runtime Persistence

New runtime services:

```text
PhysicalSourceSnapshotServiceV4
PhysicalDatasetHydrationServiceV4
```

The shared session persistence coordinator now uses v4 snapshot/hydration.

Hydration order:

```text
validate complete v4
snapshot current v4
hydrate physical v3/core/tier state
replace plaster mold yield profiles
```

If profile replacement fails, the previous physical-v3 state and previous profiles are restored.

## Coordinator Compatibility

The PersistenceCoordinator now recognizes the profile-aware v4 capability independently from legacy/v3 callers.

Current shared-session behavior:

- core-only source state may still export the compact core workbook v3;
- physical source state exports physical workbook v4;
- physical v2 and v3 imports migrate to v4 with empty profiles;
- physical v4 imports preserve profiles;
- old coordinator callers that do not advertise profile-aware persistence keep their existing behavior.

## MY3D Regression Coverage

MY3 verifies:

- workbook/dataset 4 metadata;
- canonical profile sheet shape;
- real XLSX profile round-trip;
- v3 → v4 migration;
- v2 → v3 → v4 migration;
- invalid profile reference rejection;
- v4 snapshot/hydration;
- validate-before-mutate behavior;
- shared persistence coordinator profile round-trip.

## Preserved Boundaries

MY3 does not:

- calculate plaster recipe outputs;
- persist derived quantities;
- create Yield Samples;
- apply Product safety waste;
- add formula UI;
- alter costing/capacity/Production calculations.

Those remain later MY phases.

## Next Task

```text
MY4 — Mold Yield Calculator Engine
NEXT / NOT STARTED
```

Do not start MY4 until MY3 is merged and exact post-merge `develop` CI is green.
