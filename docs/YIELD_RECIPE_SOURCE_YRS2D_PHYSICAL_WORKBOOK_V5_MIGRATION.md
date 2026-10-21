# Yield Recipe Source — YRS2D Physical Workbook v5 + v4→v5 Migration

## Status

```text
YRS0 — Domain & Compatibility Audit                   COMPLETE
YRS1 — Recipe Source Domain Foundation                COMPLETE

YRS2 — Repository / Recording / Persistence           IN PROGRESS
    YRS2A — Provenance Repository + Application Service  COMPLETE
    YRS2B — Atomic Yield + Provenance Recording        COMPLETE
    YRS2C — PhysicalBusinessDatasetV5                  COMPLETE
    YRS2D — Physical Workbook v5 + v4→v5 Migration    COMPLETE IN THIS CHANGE
    YRS2E — Snapshot / Hydration / Google Sheets Compatibility
                                                        NEXT / NOT STARTED
```

Verified YRS2D base:

```text
develop  570af60b59c9a9c60666f967659acd8aa07356ae
CI       36565962359 — SUCCESS
YRS2C    COMPLETE / MERGED
```

## Purpose

YRS2D makes the YRS2C Mold Formula provenance source graph portable through the physical workbook boundary.

It introduces workbook format version 5 and preserves the existing physical-v4 workbook as the complete base representation.

YRS2D is deliberately limited to:

- workbook document generation;
- XLSX encode/decode;
- strict workbook schema validation;
- v4 → v5 migration;
- complete physical-v5 reconstruction;
- focused regression coverage.

It does not change shared runtime snapshot/hydration, the PersistenceCoordinator, Google Sheets import, or Yield UI behavior. Those remain YRS2E/YRS3 work.

## Physical Workbook v5

Authoritative metadata:

```text
workbookFormatVersion = 5
datasetSchemaVersion  = 5
```

Canonical physical-v5 sheet order is:

```text
all canonical physical-v4 sheets
YieldMoldFormulaSources
```

The new sheet is appended after the existing physical-v4 graph so all earlier sheet contracts remain unchanged.

## YieldMoldFormulaSources Sheet

Canonical columns:

```text
yieldSampleId
moldId
moldYieldProfileId
```

Each row records only the physical provenance identifiers defined by YRS1B/YRS2C.

The workbook does not persist:

- theoretical Water;
- theoretical Plaster;
- theoretical Glue;
- total mixture;
- requested pieces;
- required pours;
- produced capacity;
- formula cost;
- Product safety waste;
- any other derived calculator output.

Actual Yield Sample measurements remain authoritative production evidence.

## Deterministic Export

Provenance rows are exported deterministically by canonical Yield Sample identity with Mold/profile identifiers as stable tie-breakers.

Export validates the complete `PhysicalBusinessDatasetV5` before producing a workbook.

An invalid source graph is therefore rejected before serialization.

## Strict Import Contract

The provenance sheet must contain the exact columns:

```text
yieldSampleId
moldId
moldYieldProfileId
```

All three cells are required nonblank text.

After workbook-shape validation:

1. the physical-v5 document is projected back to physical v4;
2. the existing physical-v4 importer reconstructs and validates all inherited sources;
3. provenance rows are reconstructed;
4. `PhysicalBusinessDatasetV5` integrity validation runs over the complete graph.

This preserves the established physical-v4 workbook behavior rather than reimplementing it.

## v4 → v5 Migration

Registered migration edge:

```text
physical workbook 4 / dataset 4
        ↓
physical workbook 5 / dataset 5
```

The complete recognized physical chain becomes:

```text
physical workbook 2 / dataset 2
        ↓
physical workbook 3 / dataset 3
        ↓
physical workbook 4 / dataset 4
        ↓
physical workbook 5 / dataset 5
```

Migration from v4 to v5:

- clones the source workbook;
- preserves every existing physical-v4 sheet and row;
- updates only the authoritative metadata version pair;
- appends an empty `YieldMoldFormulaSources` sheet.

Therefore legacy physical workbooks never invent Mold Formula provenance.

## Historical Provenance Validation

Physical-v5 dataset validation remains the authority for YRS source relationships.

Imported provenance must still satisfy:

```text
Yield Sample exists
Mold exists
Mold Yield Profile exists
MixPreset + Mold Formula exclusivity
Mold belongs to Yield Sample Product
Profile belongs to provenance Mold
One Mold Formula provenance row per Yield Sample
```

Historical mode intentionally permits archived Mold/profile references after a batch has already been recorded.

## Diagnostics

Workbook schema failures are reported against:

```text
YieldMoldFormulaSources
```

Dataset-level provenance reference failures retain their domain codes and are mapped back to the provenance sheet when their path begins with:

```text
yieldMoldFormulaSources
```

This keeps XLSX import diagnostics traceable to the user-editable source row.

## Regression Coverage

YRS2D verifies:

- workbook v5 / dataset v5 metadata;
- canonical provenance sheet position and columns;
- real XLSX provenance round-trip;
- complete 2/2 → 3/3 → 4/4 → 5/5 migration chain;
- non-mutating v4 → v5 migration;
- empty provenance for migrated v4 workbooks;
- current-v5 no-op compatibility preparation;
- strict provenance column validation;
- required provenance identifiers;
- provenance referential failure mapping;
- deterministic provenance export ordering.

## Deliberately Deferred

YRS2D does not add:

```text
PhysicalSourceSnapshotServiceV5
PhysicalDatasetHydrationServiceV5
PersistenceCoordinator v5 routing
Google Sheets v5 compatibility
Yield Recipe Source UI
Mold Formula draft integration refactor
Yield history provenance UI
```

These remain YRS2E and later YRS phases.

## Next Exact Task

```text
YRS2E — Snapshot / Hydration / Google Sheets Compatibility
NEXT / NOT STARTED
```

Do not begin YRS2E until YRS2D is merged and exact post-merge `develop` CI is green.
