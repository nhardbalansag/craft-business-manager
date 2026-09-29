# Plaster Mold Yield Automation — MY1B Mold Yield Profile Source Contract

## Status

```text
MY0  — Domain & Workflow Audit                       COMPLETE
MY1  — Plaster Mold Formula Foundation               ACTIVE
MY1A — Formula / Result Domain Contract              COMPLETE
MY1B — Mold Yield Profile Source Contract            COMPLETE
MY1C — Mold / Material Referential Validation        NEXT / NOT STARTED
```

MY1B is source-contract work only. It does not create repositories, persistence schema, workbook sheets, UI, or reference-resolution services.

## Purpose

Introduce the authoritative source record that stores the user-configured plaster formula inputs for a physical Mold while preserving the MY0 rule that calculated quantities are always derived.

Implemented in:

`src/domain/plasterMoldYieldProfiles.ts`

## Source Contract

```ts
PlasterMoldYieldProfile {
  id: string;
  moldId: string;

  waterMaterialId: string;
  plasterMaterialId: string;
  glueMaterialId: string;

  waterFillWeightGrams: number;
  waterAdjustmentRate: number;

  plasterFactor: number;
  glueFactor: number;

  piecesPerPour: number;

  notes?: string;
  isActive: boolean;
}
```

This keeps physical Mold identity/location responsibilities unchanged. Formula inputs remain on a separate source record.

## Authoritative Inputs Only

MY1B stores only authoritative/configured values.

It does **not** store:

```text
adjusted water
plaster quantity
glue quantity
total mixture
per-piece quantities
required pours
produced capacity pieces
extra capacity pieces
```

Those values remain derived by the MY1A formula contract or later application services.

## Intrinsic Validation

MY1B validates only properties that can be decided from one source record:

- nonblank profile ID;
- nonblank Mold ID;
- nonblank water/plaster/glue Material IDs;
- finite, positive `waterFillWeightGrams`;
- finite `waterAdjustmentRate` in `[0, 1)`;
- finite, non-negative `plasterFactor`;
- finite, non-negative `glueFactor`;
- positive integer `piecesPerPour`;
- boolean `isActive`.

Textual IDs and notes can be normalized without changing numeric source precision.

## Explicit MY1C Boundary

MY1B deliberately does **not** decide whether referenced entities exist or are compatible.

Deferred to MY1C:

```text
- Mold exists
- referenced Materials exist
- required active-state policy
- water/plaster/glue material role distinctness
- weight-compatible Material units
- one active PlasterMoldYieldProfile per Mold
```

This preserves a clean distinction between a record's intrinsic shape and dataset/application referential integrity.

## Formula / Evidence Boundaries

The MY0/MY1A rules remain unchanged:

```text
Mold Water Adjustment != Product Safety Waste
Mold Formula Estimate != Yield Evidence
```

A `PlasterMoldYieldProfile` is formula configuration. It is not a `YieldSample` and does not become production evidence automatically.

## Persistence Boundary

MY1B defines the authoritative source type but does not yet add it to:

- `BusinessDataset`;
- `PhysicalBusinessDatasetV3`;
- a new `PhysicalBusinessDatasetV4`;
- XLSX/workbook sheets;
- hydration/snapshot services.

Those persistence changes belong to MY3 after repository/application-service work.

The type is exported through `src/domain/types.ts` for domain/application consumers without changing existing persisted dataset structures.

## Tests

Implemented in:

`src/domain/plasterMoldYieldProfiles.test.ts`

Coverage includes:

- canonical MY0 profile acceptance;
- authoritative-input-only source shape;
- textual normalization;
- defensive cloning;
- required ID fields;
- numeric range/finite checks;
- positive integer cavity count;
- active-state validation;
- explicit proof that MY1C reference checks are not performed in MY1B.

## Next Task

```text
MY1C — Mold / Material Referential Validation
NEXT / NOT STARTED
```

Do not start MY1C until MY1B is merged and post-merge `develop` CI is green.
