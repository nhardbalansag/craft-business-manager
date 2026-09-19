# Phase 5.4A — Schema Migration & Compatibility Framework Plan

Status: **PLANNING ESTABLISHED — IMPLEMENTATION NOT STARTED**

Authoritative planning baseline:

```text
develop  0624863f59929d645acd5f6539ab311afdfcb5bd
CI       35039111549 — SUCCESS
```

Parent phase:

```text
5.4 — Version Compatibility, Backup & Recovery Safety
```

Previous completed boundary:

```text
5.3 — Snapshot, Hydration & Persistence Coordination — COMPLETE
```

## Purpose

Phase 5.4A adds explicit, deterministic workbook/dataset version compatibility without weakening the strict fail-closed import contract established in 5.2C and without bypassing the atomic hydration boundary established in 5.3.

The goal is not to invent historical formats. The goal is to create a compatibility architecture that can safely recognize current, future, unsupported older, and explicitly migratable version pairs, execute only registered migrations, then hand the result back to the existing current-schema validator/reconstructor.

## Repository audit findings

### Current dataset version

`src/domain/businessDataset.ts` defines:

```ts
export const CURRENT_BUSINESS_DATASET_SCHEMA_VERSION = 1 as const;
```

The code comment identifies this as the **first formally specified complete persisted business-source dataset**.

There is therefore no legitimate public dataset schema older than v1 that Phase 5.4A should pretend existed.

### Current workbook version

`src/storage/workbookSchema.ts` defines:

```ts
export const CRAFT_BUSINESS_WORKBOOK_FORMAT_ID = 'craft-business-manager' as const;
export const CURRENT_WORKBOOK_FORMAT_VERSION = 1 as const;
```

Workbook v1 is the first formal normalized workbook contract and contains the canonical 13-sheet layout.

### Current import behavior

`reconstructBusinessDatasetFromWorkbook(...)` currently:

1. validates the workbook against the **current** workbook schema;
2. reads `_Meta`;
3. rejects any format/version pair not exactly equal to the current constants with `UNSUPPORTED_CURRENT_VERSION`;
4. reconstructs the current `BusinessDataset`;
5. validates the complete dataset.

This is correct for 5.2C current-version-only import, but it is not sufficient for migration because an older workbook with a different sheet/column shape can fail current schema validation before the importer has a chance to classify its version.

### Current schema validator behavior

`validateWorkbookSchema(...)` validates `_Meta` against the current workbook and dataset version constants while also validating all current sheets/columns/cells.

That means 5.4A must introduce a deliberately smaller version-preflight boundary before strict current-schema validation. It must **not** weaken `validateWorkbookSchema(...)` into a permissive all-version validator.

## Architectural decision

Phase 5.4A will use this version-aware import sequence:

```text
XLSX bytes
  -> WorkbookCodec.decode(...)
  -> minimal _Meta version preflight
  -> compatibility classification
       ├── current
       │    -> current strict workbook validation
       ├── migratable
       │    -> registered pure migration chain
       │    -> current strict workbook validation
       ├── unsupported older
       │    -> structured compatibility rejection
       └── unsupported/future/invalid
            -> structured compatibility rejection
  -> current dataset reconstruction
  -> validateBusinessDatasetIntegrity(...)
  -> BusinessDataset candidate
  -> existing PersistenceCoordinator
  -> existing ValidatedAtomicDatasetHydrationService
```

The compatibility layer must converge on the **existing current importer contract**. It must not create a second hydration path, a second repository write path, or a migration-aware UI path.

## Version axes remain independent

The existing design correctly separates:

- workbook format version;
- dataset schema version.

5.4A must preserve that distinction.

A compatibility key should conceptually contain:

```ts
interface WorkbookVersionKey {
  workbookFormatVersion: number;
  datasetSchemaVersion: number;
}
```

Migration registration must be based on an exact source version pair and an exact target version pair. A workbook-format migration and a dataset-schema migration may occur together or separately, but neither version may be silently inferred from the other.

## Compatibility policy for the current v1/v1 product

Phase 5.4A must **not bump the current workbook or dataset version merely to demonstrate migration code**.

Current public compatibility policy:

```text
formatId                craft-business-manager
workbook format         v1
business dataset schema v1
```

Because v1/v1 is the first formal persisted contract:

- v1/v1 is current and supported;
- missing `_Meta` is rejected;
- metadata-free legacy auto-detection is not supported;
- version 0 is not a public legacy contract and must not be treated as one;
- no fabricated v0 or fabricated v2 format is introduced;
- the production migration registry initially has no historical migration step unless repository evidence later proves a real released predecessor exists;
- migration mechanics are proven with isolated synthetic registry fixtures that do **not** become supported public workbook versions.

When a real v2 contract is introduced in the future, the migration framework created here can register the real v1 -> v2 path without redesigning import orchestration.

## Required subdivision

5.4A is too broad for one implementation PR and is formally split into three children:

```text
5.4A
├── 5.4A1 — Version Preflight, Compatibility Matrix & Migration Registry Contract
├── 5.4A2 — Version-Aware Migration Execution & Current-Contract Handoff
└── 5.4A3 — Compatibility Regression & Completion Gate
```

No deeper split is planned initially. Each child must still be reassessed against the repository before implementation and may be subdivided only if discovery proves materially larger than expected.

---

# 5.4A1 — Version Preflight, Compatibility Matrix & Migration Registry Contract

Status: **NEXT / NOT STARTED**

Planned branch:

```text
feature/phase-5-4a1-version-preflight-migration-registry
```

## Purpose

Create the storage-layer contracts that can read only the minimum authoritative version metadata needed to classify a decoded workbook before current-schema validation.

## Planned work

### 1. Version metadata preflight

Create a focused preflight function/type that reads the decoded neutral workbook and determines:

- whether `_Meta` exists exactly once;
- whether `_Meta` has exactly one authoritative row;
- whether `formatId` is present and valid;
- whether `workbookFormatVersion` is a positive integer;
- whether `datasetSchemaVersion` is a positive integer;
- the exact version pair.

The preflight must not require all current sheets or current columns.

It must not reconstruct business entities.

### 2. Compatibility classification vocabulary

Establish deterministic classification such as:

```text
current
migratable
unsupported-older
unsupported-future
invalid-metadata / invalid-format
```

Exact public names may be refined during implementation, but the semantics must remain stable.

Rules:

- exact current pair -> current;
- any future workbook or dataset version -> fail closed as unsupported future;
- an exact registered path to current -> migratable;
- an older/non-current pair without a registered path -> unsupported older;
- mixed pair containing any future axis -> unsupported future;
- wrong `formatId` -> unsupported/invalid format, never migration;
- missing metadata -> rejection, never heuristic legacy detection.

### 3. Migration step contract

Create a pure migration step abstraction conceptually similar to:

```ts
interface WorkbookMigrationStep {
  readonly from: WorkbookVersionKey;
  readonly to: WorkbookVersionKey;
  migrate(document: WorkbookNeutralDocument): WorkbookNeutralDocument;
}
```

Migration steps:

- receive neutral workbook data only;
- do not read repositories;
- do not hydrate live state;
- do not access filesystem/transport;
- do not call React/UI;
- do not calculate derived business outputs;
- return defensively owned neutral workbook data.

### 4. Migration registry contract

Create deterministic registration/path rules:

- no duplicate source step;
- no ambiguous next step;
- no self-loop;
- cycle detection;
- no implicit downgrade path;
- finite maximum traversal / cycle-safe execution contract;
- exact version-pair keys;
- deterministic lookup.

The production registry remains empty at v1/v1 unless real historical evidence is found.

### 5. Synthetic framework fixtures

Use test-only synthetic version pairs to prove:

- single-step resolution;
- multi-step resolution;
- no-path behavior;
- duplicate/ambiguous registration rejection;
- cycle rejection;
- future classification;
- source document is not mutated.

Synthetic test versions are framework fixtures only. They must not change public product version constants or imply support for nonexistent workbook formats.

## A1 completion gate

- minimal metadata preflight works without validating current business sheets;
- current v1/v1 classification is deterministic;
- future and missing-metadata states are deterministic;
- migration registry/path semantics are deterministic and cycle-safe;
- test-only migration fixtures prove the generic mechanism;
- no production version constants are bumped;
- no importer/hydration behavior is changed yet.

---

# 5.4A2 — Version-Aware Migration Execution & Current-Contract Handoff

Status: **NOT STARTED**

Planned branch:

```text
feature/phase-5-4a2-version-aware-migration-execution
```

## Purpose

Insert the compatibility/migration layer between workbook decode and the existing strict current-version reconstruction contract.

## Planned work

### 1. Version-aware decoded-document preparation

Add one compatibility operation conceptually similar to:

```text
prepareWorkbookForCurrentImport(document)
```

Behavior:

- run metadata preflight;
- classify exact version pair;
- current -> return a defensive current-form document;
- migratable -> execute registered chain;
- unsupported -> structured rejection;
- migration failure -> structured rejection.

### 2. Migration execution invariants

For every registered step:

- clone/own input before mutation-sensitive work;
- execute the pure migration;
- verify output is a valid neutral workbook shape;
- verify output metadata matches the step's declared target version pair;
- preserve the expected format ID;
- fail closed if a step throws or returns inconsistent metadata;
- never partially expose a half-migrated candidate as current.

### 3. Current strict contract remains authoritative

After migration reaches the current version pair:

```text
migrated neutral workbook
-> existing/current workbook schema validation
-> existing reconstruction
-> validateBusinessDatasetIntegrity(...)
```

Migration does not waive current validation.

A migrated workbook that still violates the current workbook or dataset contract must be rejected.

### 4. Import diagnostics

Extend import diagnostics only as needed to preserve compatibility context.

A dedicated migration stage/code family may be introduced, but existing structured issue detail must not be flattened.

At minimum distinguish:

- invalid/missing version metadata;
- unsupported future version;
- unsupported older/unregistered version;
- migration path not found;
- migration step failure;
- migration output version mismatch;
- migrated workbook failing current schema validation;
- migrated dataset failing current integrity validation.

### 5. `importBusinessDatasetFromXlsx(...)` integration

The top-level XLSX importer should become version-aware after decode while preserving the same return shape expected by `PersistenceCoordinator`.

`PersistenceCoordinator` should not need to know migration mechanics.

## A2 completion gate

- current v1/v1 import behavior remains compatible;
- compatibility classification occurs before current-schema rejection of non-current versions;
- registered migration chains reach current form deterministically;
- every migrated result is revalidated under current workbook and dataset contracts;
- unsupported/future inputs remain fail-closed;
- no live repository mutation occurs inside compatibility/migration code;
- coordinator/hydration APIs remain unchanged.

---

# 5.4A3 — Compatibility Regression & Completion Gate

Status: **NOT STARTED**

Planned branch:

```text
feature/phase-5-4a3-compatibility-completion-gate
```

## Purpose

Prove that adding migration readiness does not weaken any Phase 5.2/5.3 guarantees and formally close 5.4A.

## Required regression coverage

### Current-version preservation

Prove:

- exported v1/v1 workbooks still import successfully;
- import metadata is preserved;
- direct bytes import still works;
- transport-backed load still works;
- save A -> mutate B -> load -> restore A remains valid.

### Future-version rejection

At minimum cover independently:

- future workbook format with current dataset version;
- current workbook format with future dataset version;
- both axes future;
- mixed lower/future pairs where any future axis prevents migration.

All must reject before hydration writes.

### Missing/invalid metadata policy

Prove:

- missing `_Meta` does not trigger legacy inference;
- malformed version numbers reject;
- version 0 rejects;
- wrong format ID rejects;
- missing version fields reject.

### Migration framework proof

Use isolated synthetic fixtures to prove migration mechanics without changing the public v1/v1 product version.

If a real historical predecessor is discovered before A3, add a real fixture and explicitly register it. Otherwise document that there is **no production legacy migration at v1 because v1 is the first formal persisted contract**.

### Migration-to-current validation

Synthetic migration tests must prove a migration cannot bypass:

- current workbook sheet/header/cell validation;
- current dataset row/domain validation;
- duplicate/reference/cycle validation.

### Atomicity integration

Prove compatibility rejection/migration failure results in zero hydration writes.

For a valid current-form result, the existing 5.3B hydration/rollback guarantees remain authoritative.

### Full repository gate

Run:

```text
TypeScript typecheck
full automated test suite
production Vite build
```

## A3 completion gate

Phase 5.4A is complete only when:

- version preflight is explicit and tested;
- current/future/unsupported/migratable states are deterministic;
- migration registry/executor is pure and cycle-safe;
- current strict schema/dataset validation remains the final authority;
- no fabricated product version was introduced just for tests;
- current v1/v1 round trip remains green;
- unsupported/future/migration failures cause zero live writes;
- all CI gates pass.

After A3 is complete and merged, create the 5.4A parent completion record and advance exactly to:

```text
5.4B — Backup & Atomic-Write Transport Contract — NEXT / NOT STARTED
```

Do not begin 5.4B automatically.

---

# Locked 5.4A decisions

1. Workbook format version and dataset schema version remain separate axes.
2. v1/v1 remains the current public contract during 5.4A.
3. Do not bump versions solely to manufacture migration work.
4. v1 is the first formal persisted dataset/workbook contract unless repository evidence proves otherwise.
5. No metadata-free legacy auto-detection.
6. Missing `_Meta` remains a rejection.
7. Wrong format ID is never migrated.
8. Version preflight occurs before strict current-schema validation for compatibility routing.
9. `validateWorkbookSchema(...)` remains the strict **current** workbook validator; do not turn it into a permissive multi-version validator.
10. Migration operates on neutral workbook data and is pure/storage-agnostic.
11. Migration steps cannot touch repositories, hydration, transport, React, or native filesystem APIs.
12. Migration paths are explicit, deterministic, exact-version-pair based, and cycle-safe.
13. Any future version axis fails closed; no downgrade logic.
14. Migrated output must reach the exact current version pair before reconstruction.
15. Migrated output must pass the existing current workbook validator and complete dataset validator.
16. `PersistenceCoordinator` remains unaware of migration mechanics and continues consuming the same importer result shape.
17. Compatibility/migration rejection means zero hydration writes.
18. Synthetic migration fixtures prove framework behavior but do not become supported public product versions.
19. Production migration registry remains empty until a real older released contract exists.
20. 5.4B remains the owner of backup/staged/atomic-write transport semantics; 5.4A does not expand into file replacement/recovery.

# Out of scope

Phase 5.4A does not implement:

- backup creation;
- staged writes;
- atomic filesystem replacement;
- temporary-file cleanup;
- restore/recovery workflow;
- browser download/upload UI;
- React persistence UI;
- Tauri filesystem/dialog behavior;
- arbitrary Excel repair;
- corruption/size/row-limit policy beyond version-compatibility-specific diagnostics;
- business-domain changes merely to create a new schema version.

Those remain assigned to 5.4B, 5.4C, 5.5, Phase 6, or future schema evolution work.

# Next action after planning merge

After this docs-only plan is merged and the exact resulting `develop` CI is green:

```text
5.4A1 — Version Preflight, Compatibility Matrix & Migration Registry Contract
NEXT / NOT STARTED
```

Do not begin 5.4A1 until the user separately says to proceed.
