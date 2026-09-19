# Phase 5.4A2 — Version-Aware Migration Execution & Current-Contract Handoff

Status: **COMPLETE**

Parent plan:

`docs/PHASE_5_4A_SCHEMA_MIGRATION_COMPATIBILITY_PLAN.md`

## Objective

Insert deterministic workbook compatibility and migration preparation between workbook decode and the existing strict current-version reconstruction contract without changing the public v1/v1 contract, hydration semantics, repository state, or `PersistenceCoordinator` API.

## Authoritative baseline

```text
develop  049cc5cfe38090f87dbbe702b140915e8224b998
CI       35041734689 — SUCCESS
```

Feature branch:

`feature/phase-5-4a2-version-aware-migration-execution`

## Delivered architecture

The XLSX import path is now:

```text
XLSX bytes
-> WorkbookCodec.decode(...)
-> prepareWorkbookForCurrentImport(...)
   -> minimal version preflight
   -> compatibility classification
   -> optional explicit migration-chain execution
-> existing reconstructBusinessDatasetFromWorkbook(...)
   -> strict current workbook schema validation
   -> current metadata validation
   -> entity reconstruction
   -> validateBusinessDatasetIntegrity(...)
-> existing PersistenceCoordinator / hydration lifecycle
```

The current strict reconstruction function remains authoritative for current-form workbook and dataset validation.

## `prepareWorkbookForCurrentImport(...)`

Added:

`src/storage/workbookImportCompatibility.ts`

The preparation operation defaults to:

- `CURRENT_WORKBOOK_VERSION_KEY` as target;
- `productionWorkbookMigrationRegistry` as the registry.

Production remains v1/v1 with an empty migration registry because no real earlier released persisted contract exists.

Test-only synthetic targets and migration registries prove generic migration mechanics without creating fictional supported production versions.

## Current workbook behavior

For an exact current version pair:

- metadata preflight succeeds;
- compatibility classifies the workbook as current;
- a defensively owned neutral workbook copy is returned;
- normal strict current-schema reconstruction continues unchanged.

Current workbooks therefore do not bypass any existing validation.

## Migration execution behavior

For an exact registered path:

1. resolve the deterministic migration chain;
2. clone the current neutral workbook before each step;
3. execute the pure `WorkbookMigrationStep`;
4. verify returned neutral workbook structure;
5. preflight returned metadata;
6. verify the expected application format identity remains unchanged;
7. verify returned version metadata equals the step's declared target pair;
8. defensively own the returned document before the next step;
9. verify the completed chain reaches the exact requested target pair.

No half-migrated candidate is exposed as current.

## Compatibility and migration diagnostics

Preparation provides controlled diagnostics for:

```text
INVALID_NEUTRAL_WORKBOOK_DOCUMENT
UNSUPPORTED_FUTURE_VERSION
MIGRATION_PATH_NOT_FOUND
MIGRATION_STEP_FAILED
MIGRATION_OUTPUT_INVALID
MIGRATION_OUTPUT_FORMAT_ID_MISMATCH
MIGRATION_OUTPUT_VERSION_MISMATCH
```

Existing version-preflight issue codes are also retained.

Migration issues may preserve:

- compatibility status;
- source version;
- target version;
- migration step index;
- original thrown cause.

The top-level importer now exposes `compatibility` and `migration` issue stages in addition to its existing stages while preserving the same success/failure result shape consumed by `PersistenceCoordinator`.

## Import handoff

`importBusinessDatasetFromXlsx(...)` now performs:

```text
codec decode
-> compatibility/migration preparation
-> strict current reconstruction
```

`PersistenceCoordinator` was not given migration knowledge and its runtime API was not changed.

Expected compatibility/migration rejection remains an ordinary structured import rejection, so hydration is not called for an invalid candidate.

## Synthetic migration framework proof

Focused tests prove:

- current-form defensive ownership;
- missing metadata rejection;
- future-version rejection;
- missing registered path rejection;
- deterministic single-step migration;
- deterministic multi-step migration order;
- source document protection even if a step mutates its owned input;
- thrown-step cause preservation;
- malformed migration output rejection;
- format identity preservation;
- declared target-version enforcement;
- defensive ownership of migration output;
- compatibility routing before current-sheet validation;
- current workbooks still reaching the existing strict validator.

Synthetic pairs are framework fixtures only and are not supported workbook versions.

## CI history

Initial feature head:

`5cf395dfd32722fc609bd269c4de48962cafef3f`

Initial feature CI:

`35042246720 — FAILURE`

The initial gate passed TypeScript typecheck and all new A2 tests. One existing Phase 5.3C3 regression assertion failed because it hard-coded import rejection stages to only `codec` or `schema`. A2 intentionally introduced structured `compatibility` and `migration` import stages.

The assertion was widened to accept the expanded structured import-stage vocabulary while preserving its actual safety invariant: rejected imports still perform zero hydration calls.

Corrected feature head:

`c7ed54af3b38f8f9dacee52384af39472dac5d8b`

Corrected branch CI:

`35042353048 — SUCCESS`

Implementation PR:

`#168 — Phase 5.4A2: version-aware migration execution and import handoff`

PR CI:

`35042498871 — SUCCESS`

Implementation merge:

`9dc28493b9d4b46214a11eb330416e83af236db0`

Post-merge develop CI:

`35042566109 — SUCCESS`

Validation at the corrected feature gate:

```text
99 test files / 1203 tests
12 focused migration-preparation tests
5 focused importer compatibility/handoff tests
TypeScript typecheck passed
Production Vite build passed
132 modules transformed
```

## Completion gate

Phase 5.4A2 is complete because:

- decoded workbook compatibility is checked before strict current-sheet validation;
- exact current v1/v1 imports still use the unchanged strict current reconstruction contract;
- explicit migration chains can be executed deterministically and defensively;
- malformed, inconsistent, future, and unregistered states fail closed;
- migrated output must match declared step targets and ultimately the exact target version pair;
- migration failures remain structured and preserve useful context;
- importer result shape remains compatible with `PersistenceCoordinator`;
- invalid imports still never reach hydration;
- public workbook/dataset versions remain v1/v1;
- production migration registry remains empty until a real older public contract exists;
- full regression, typecheck, and build gates are green after merge.

## Next task

**5.4A3 — Compatibility Regression & Completion Gate — NEXT / NOT STARTED**

Do not begin 5.4A3 until this closeout is merged, the exact resulting `develop` CI is green, and the user separately says to proceed.
