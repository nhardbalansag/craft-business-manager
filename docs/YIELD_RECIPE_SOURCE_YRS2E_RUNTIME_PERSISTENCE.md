# Yield Recipe Source — YRS2E Snapshot / Hydration / Google Sheets Compatibility

## Status

```text
YRS0 — Domain & Compatibility Audit                   COMPLETE
YRS1 — Recipe Source Domain Foundation                COMPLETE

YRS2 — Repository / Recording / Persistence           COMPLETE IN THIS CHANGE
    YRS2A — Provenance Repository + Application Service  COMPLETE
    YRS2B — Atomic Yield + Provenance Recording        COMPLETE
    YRS2C — PhysicalBusinessDatasetV5                  COMPLETE
    YRS2D — Physical Workbook v5 + v4→v5 Migration    COMPLETE
    YRS2E — Snapshot / Hydration / Google Sheets Compatibility
                                                        COMPLETE IN THIS CHANGE

YRS3 — Yield Recipe Source UI                         NEXT / NOT STARTED
    YRS3A — Recipe Source Selector                     NEXT / NOT STARTED
```

Verified YRS2E base:

```text
develop  a9ec2e1a0fa7516540cc343bedf0c7204d182e02
CI       36571242833 — SUCCESS
YRS2D    COMPLETE / MERGED
```

## Purpose

YRS2E moves the YRS2C/YRS2D physical-v5 source contract into the live application persistence path.

Before YRS2E:

- `PhysicalBusinessDatasetV5` existed;
- workbook v5 could persist `YieldMoldFormulaSources`;
- v4 workbooks could migrate to v5;
- but the shared application session still snapshotted and hydrated physical dataset v4.

YRS2E closes that gap.

The live persistence graph is now:

```text
PhysicalSourceSnapshotServiceV5
        ↓
PhysicalBusinessDatasetV5
        ↓
Physical Workbook v5
        ↓
PersistenceCoordinator
        ↓
PhysicalDatasetHydrationServiceV5
```

## PhysicalSourceSnapshotServiceV5

The v5 snapshot service composes over the proven v4 snapshot service.

It snapshots:

```text
all physical-v4 source collections
+
yieldMoldFormulaSources
```

The provenance repository is read independently and its rows are deterministically ordered by canonical Yield Sample identity before entering the physical-v5 dataset.

The snapshot advertises these persistence capabilities:

```text
physicalIdentification    = true
tieredPricing             = true
plasterMoldYieldProfiles  = true
yieldMoldFormulaSources   = true
```

The final flag is what moves the PersistenceCoordinator onto the v5 physical workbook path.

## PhysicalDatasetHydrationServiceV5

Hydration validates the entire `PhysicalBusinessDatasetV5` before mutating any live repository.

Apply order:

```text
1. validate complete physical-v5 graph
2. snapshot current physical-v5 graph
3. hydrate physical-v4 base
4. replace YieldMoldFormulaSources
```

This order is required because provenance references:

- Yield Samples;
- Molds;
- Plaster Mold Yield Profiles.

Those records must already exist before provenance becomes live.

## Atomic Rollback

If provenance replacement fails after physical-v4 hydration succeeds:

```text
restore previous physical-v4 graph
restore previous YieldMoldFormulaSources
```

Successful rollback raises:

```text
APPLY_FAILED_RESTORED
```

Rollback failure remains distinct:

```text
ROLLBACK_FAILED
```

Snapshot failures remain:

```text
SNAPSHOT_FAILED
```

This preserves the established persistence operational-error contract.

## PersistenceCoordinator v5 Routing

The coordinator now recognizes:

```text
yieldMoldFormulaSources = true
```

A provenance-aware persistence source requires all earlier capabilities:

```text
physical identification
tiered pricing
plaster mold yield profiles
Mold Formula provenance
```

When physical/provenance source state exists, the coordinator exports:

```text
Physical Workbook v5 / Dataset v5
```

When the complete v5 source graph contains no physical/profile/provenance records, the existing compact core workbook behavior remains available.

Earlier coordinator modes remain intact for callers that do not advertise the v5 capability.

## Import Compatibility

The v5 live coordinator accepts physical workbook versions that can migrate through the registered chain:

```text
2 / 2
  ↓
3 / 3
  ↓
4 / 4
  ↓
5 / 5
```

A physical-v4 workbook imported through the live v5 coordinator receives:

```text
yieldMoldFormulaSources = []
```

This intentionally clears stale live provenance rather than manufacturing source relationships that are absent from the imported workbook.

Core workbook compatibility remains unchanged.

## Shared Application Session

The authoritative session now wires:

```text
physicalSourceSnapshotServiceV5
physicalDatasetHydrationServiceV5
PersistenceCoordinator(v5 snapshot, v5 hydration)
```

The existing v1-v4 services remain available as lower-level compatibility/composition boundaries.

Shared session persistence now round-trips:

- Product price tiers;
- Storage Locations;
- Molds;
- Plaster Mold Yield Profiles;
- Yield Mold Formula provenance.

## Google Sheets Compatibility

`PublicGoogleSheetsImportCommand` required no production rewrite.

Its architecture already correctly delegates fetched XLSX bytes to:

```text
PersistenceCoordinator.importAndApplyWorkbook(...)
```

Because the shared coordinator is now v5-aware, a Google Sheet published as a physical workbook v5 snapshot automatically receives:

- workbook v5 compatibility checks;
- complete provenance reconstruction;
- complete physical-v5 validation;
- atomic live hydration.

Regression coverage proves a Published-to-web physical-v5 workbook restores Mold Formula provenance through the real coordinator boundary.

Google Sheets remains a snapshot-import transport only. It does not become a separate business persistence implementation.

## Regression Coverage

YRS2E verifies:

- physical-v5 snapshot and hydration;
- Mold Formula provenance snapshot fidelity;
- validation-before-mutation;
- provenance replacement as the final apply step;
- full rollback when provenance replacement fails;
- coordinator physical-v5 XLSX export/import;
- workbook 5 / dataset 5 live metadata;
- physical-v4 import through the live v5 coordinator;
- stale provenance removal on v4 migration;
- shared-session v5 provenance round-trip;
- Public Google Sheets physical-v5 import;
- provenance survival through Google Sheets → coordinator → hydration;
- existing v1-v4 persistence tests remain green.

## Preserved Boundaries

YRS2E does not:

- change the Yield form;
- add a Recipe Source selector;
- move MY6 Mold Formula draft UI;
- change actual Yield Sample evidence semantics;
- persist theoretical formula quantities;
- add Yield History provenance presentation.

Those belong to YRS3–YRS5.

## YRS2 Completion

With YRS2E complete:

```text
YRS2 — Repository / Recording / Persistence           COMPLETE
```

The system now has an end-to-end persistence path for Mold Formula recipe-source provenance from repository state through XLSX/Google Sheets and back into atomic live hydration.

## Next Exact Task

```text
YRS3A — Recipe Source Selector
NEXT / NOT STARTED
```

Do not begin YRS3A until YRS2E is merged and exact post-merge `develop` CI is green.
