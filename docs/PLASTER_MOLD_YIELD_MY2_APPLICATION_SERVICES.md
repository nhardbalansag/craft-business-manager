# Plaster Mold Yield Automation — MY2 Repository & Application Services

## Status

```text
MY0 — Domain & Workflow Audit                       COMPLETE
MY1 — Plaster Mold Formula Foundation               COMPLETE
MY2 — Repository & Application Services             COMPLETE
    MY2A — Repository Contract + In-Memory Store     COMPLETE
    MY2B — Profile Service + Relationship Guards     COMPLETE
    MY2C — Shared Session Wiring + Regressions       COMPLETE

MY3 — Physical Dataset v4 / Workbook Migration      NEXT / NOT STARTED
```

MY2 introduces the runtime application layer for `PlasterMoldYieldProfile` without changing persisted workbook/dataset schemas.

## MY2A — Repository Boundary

Implemented:

- `PlasterMoldYieldProfileRepository`;
- `InMemoryPlasterMoldYieldProfileRepository`;
- trim-aware, case-insensitive ID lookup;
- defensive cloning;
- `replaceAll` support through `CollectionReplacementPort` for later MY3 hydration.

The repository stores authoritative MY1B profile sources only.

## MY2B — Application Service

Implemented:

`PlasterMoldYieldProfileService`

Supported workflows:

- create;
- update;
- get;
- list/filter/search;
- resolve active profile for one Mold;
- archive;
- restore.

The service applies:

1. MY1B intrinsic contract validation;
2. canonical Mold/Material reference resolution;
3. MY1C referential integrity;
4. duplicate profile ID protection;
5. one-active-profile-per-Mold enforcement.

Resolved references are stored using the authoritative source IDs from the existing Mold/Material repositories.

## Relationship Guards

MY2 adds a `PlasterMoldYieldProfileRelationshipGuard` so live application operations cannot break MY1C after a valid profile has been created.

### Mold archival

A Mold with an active profile cannot be archived until its profile is archived or moved to another Mold.

### Material archival

A Material used as Water, Plaster, or Glue by an active profile cannot be archived until the profile no longer actively depends on it.

### Material base-unit changes

A Material used by an active profile must remain weight-based:

```text
baseUnit = g
```

Material updates that would change it to `mL` or `pc` are rejected while an active profile depends on it.

The new guards are wired into the existing `MoldService` and `MaterialService` update/archive paths.

## MY2C — Shared Session

The shared application session now exposes:

```text
plasterMoldYieldProfileRepository
plasterMoldYieldProfileService
```

The service uses the existing shared:

```text
moldRepository
materialRepository
```

This is runtime wiring only.

## Persistence Boundary

MY2 deliberately does **not** add profiles to:

- `BusinessDataset`;
- `BusinessDatasetV2`;
- `PhysicalBusinessDatasetV3`;
- workbook sheets;
- snapshot services;
- hydration services;
- `PersistenceCoordinator`.

Therefore profile data remains session-memory-only until MY3.

The in-memory repository already exposes `replaceAll` so MY3 can add it to atomic snapshot/hydration flows without redesigning MY2.

## Preserved Boundaries

MY2 does not:

- calculate mold formula results;
- create Yield Samples;
- apply Product safety waste;
- change Product category behavior;
- migrate physical workbook schema;
- add UI.

Formula calculation remains MY1A/MY4 responsibility and persistence migration remains MY3.

## Tests

MY2 coverage includes:

- repository case-insensitive identity and cloning;
- collection replacement readiness;
- normalized profile creation;
- canonical reference storage;
- duplicate profile identity rejection;
- MY1C error propagation;
- update/archive/restore;
- one-active-profile-per-Mold behavior;
- list/filter/search semantics;
- Mold archive guards;
- Material archive/base-unit guards;
- shared-session CRUD;
- shared-session Mold/Material guard enforcement.

## Next Task

```text
MY3 — Physical Dataset v4 / Workbook Migration
NEXT / NOT STARTED
```

Do not start MY3 until MY2 is merged and exact post-merge `develop` CI is green.
