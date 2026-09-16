# Phase 5 — Excel Persistence Progress

Status: **IN PROGRESS**

Master plan:

`docs/PHASE_5_EXCEL_PERSISTENCE_PLAN.md`

## Live task map

```text
5.1 — Persisted Dataset & Workbook Contract Foundation   COMPLETE
    5.1A — Source Inventory & Dataset Completeness        COMPLETE
    5.1B — Workbook Schema / Sheet / Column Contracts     COMPLETE
    5.1C — Dataset Validation & Reference Integrity       COMPLETE

5.2 — XLSX Workbook Codec                                 COMPLETE
    5.2A — XLSX Library Evaluation & Codec Boundary       COMPLETE
    5.2B — Deterministic Dataset-to-XLSX Export           COMPLETE
    5.2C — Strict XLSX-to-Dataset Import & Diagnostics    COMPLETE

5.3 — Snapshot, Hydration & Persistence Coordination      COMPLETE
    5.3A — Complete Source Snapshot Service               COMPLETE
    5.3B — Validated Atomic Dataset Hydration             COMPLETE
        5.3B1 — Hydration Replacement Port & Bulk Replace COMPLETE
        5.3B2 — Validated Atomic Hydration + Rollback     COMPLETE
        5.3B3 — Session/Fault Injection/Completion Gate   COMPLETE
    5.3C — Persistence Coordinator / Load-Save Lifecycle  COMPLETE
        5.3C1 — Persistence Lifecycle & Workbook Transport Contract  COMPLETE
        5.3C2 — Snapshot-to-XLSX Export / Save Orchestration         COMPLETE
        5.3C3 — XLSX Load / Import / Hydrate & Completion Gate       COMPLETE

5.4 — Version Compatibility, Backup & Recovery Safety     IN PROGRESS
    5.4A — Schema Migration & Compatibility Framework     IN PROGRESS
        5.4A1 — Version Preflight, Compatibility Matrix & Migration Registry Contract  COMPLETE
        5.4A2 — Version-Aware Migration Execution & Current-Contract Handoff           NEXT / NOT STARTED
        5.4A3 — Compatibility Regression & Completion Gate                             NOT STARTED
    5.4B — Backup & Atomic-Write Transport Contract       NOT STARTED
    5.4C — Corruption, Limits & Recovery Diagnostics      NOT STARTED

5.5 — Excel Persistence UI                                NOT STARTED
    5.5A — Import / Open Workbook Workflow                NOT STARTED
    5.5B — Export / Save & Backup Workflow                NOT STARTED
    5.5C — Persistence Status / Validation / Recovery UX  NOT STARTED

5.6 — Integration & Completion Gate                       NOT STARTED
    5.6A — Integrated Excel Round-Trip Workflow           NOT STARTED
    5.6B — Regression / Build / Phase 5 Completion        NOT STARTED
```

## Locked Phase 5 decisions

- `.xlsx` is the authoritative Phase 5 workbook format.
- Persist authoritative source evidence only; derived outputs are recalculated after restore.
- `BusinessDataset` covers all nine authoritative source repositories.
- Dataset schema version and workbook format version remain separate.
- Workbook v1 has 13 normalized canonical sheets.
- Missing evidence stays distinct from explicit zero/null/false.
- Formula cells are not authoritative source values; formula-looking text stays literal.
- SheetJS CE 0.20.3 remains hidden behind the library-neutral `WorkbookCodec`.
- Complete reconstructed candidates validate before any live repository mutation.
- 5.3A owns complete deterministic snapshots over all nine source repositories.
- 5.3B owns validation-before-write, whole-dataset replacement, rollback, and preserved repository/service identity.
- 5.3C owns one application-level persistence lifecycle over workbook bytes; it does not create a second dataset-level persistence path.
- Optional source-field absence is source evidence and may not be synthesized as an own property with `undefined`.
- Rollback failure remains a distinct severe diagnostic and may never be reported as successful hydration.
- 5.4A keeps workbook-format and dataset-schema versions as separate exact version axes.
- Phase 5.4A does not bump the current public v1/v1 versions merely to manufacture a migration scenario.
- v1/v1 is the first formal persisted contract unless repository evidence proves a real released predecessor.
- Missing `_Meta` is rejected; metadata-free legacy auto-detection is not supported.
- Version preflight occurs before strict current-schema validation for compatibility routing, while `validateWorkbookSchema(...)` remains the strict current-form validator.
- Migration steps operate only on neutral workbook documents and cannot touch repositories, hydration, React, transport, or native filesystem APIs.
- Migration paths are explicit exact-version-pair registrations, deterministic, no-downgrade, and cycle-safe.
- Any future workbook or dataset version axis fails closed.
- Migrated output must reach the exact current version pair and then pass existing current workbook and dataset validation.
- `PersistenceCoordinator` remains unaware of migration mechanics and consumes the same structured importer result shape.
- Synthetic migration fixtures prove framework behavior only and do not become supported public product versions.
- The production migration registry remains empty until a real older released contract exists.
- 5.4B owns detailed backup creation, staged write, atomic replace/commit, cleanup, and recovery transport semantics.
- Native Tauri filesystem/dialog behavior remains Phase 6.

## Completion evidence index

Detailed evidence remains in the dedicated phase records. This tracker keeps the live progression and latest authoritative gates concise.

### Phase 5.1 — COMPLETE

```text
5.1A final develop  8a1fdc2bbc5a24c20689c933b9964903d380e37c
5.1A CI             34986791114 — SUCCESS
5.1B final develop  656add851d6eeb6841f2f6e11816bbd52f5028c1
5.1B CI             34994087842 — SUCCESS
5.1C final develop  7efef34fac309f9d9745631a54bc8a8ba404415f
5.1C CI             34998382050 — SUCCESS
```

### Phase 5.2 — COMPLETE

```text
5.2A implementation PR #140   MERGED
5.2A final CI                 35003583148 — SUCCESS
5.2B implementation PR #143   MERGED
5.2B final CI                 35008520820 — SUCCESS
5.2C implementation PR #146   MERGED
5.2C final CI                 35012885175 — SUCCESS
```

### Phase 5.3 — COMPLETE

Key records:

- `docs/PHASE_5_3A_COMPLETE_SOURCE_SNAPSHOT_SERVICE.md`
- `docs/PHASE_5_3B_VALIDATED_ATOMIC_DATASET_HYDRATION.md`
- `docs/PHASE_5_3C_PERSISTENCE_COORDINATOR_LOAD_SAVE_LIFECYCLE.md`

Final Phase 5.3 closeout:

```text
Closeout PR #164           MERGED
Final develop              0624863f59929d645acd5f6539ab311afdfcb5bd
Final CI                   35039111549 — SUCCESS
96 test files / 1168 tests at 5.3C implementation gate
130 modules transformed
```

Phase 5.3 established:

```text
live repositories
<-> CompleteSourceSnapshotService
<-> BusinessDataset
<-> canonical workbook import/export
<-> WorkbookCodec / XLSX bytes
<-> WorkbookTransport
```

with strict validation, atomic hydration/rollback, one shared `PersistenceCoordinator`, and source-fidelity guarantees.

## Phase 5.4A — Schema Migration & Compatibility Framework

Status: **IN PROGRESS**

Plan:

`docs/PHASE_5_4A_SCHEMA_MIGRATION_COMPATIBILITY_PLAN.md`

Planning evidence:

```text
Planning baseline          0624863f59929d645acd5f6539ab311afdfcb5bd
Planning baseline CI       35039111549 — SUCCESS
Planning PR #165           MERGED
Planning merge             f773a2cd928a87c74e62a547b3043c04dcaef577
Planning post-merge CI     35040392356 — SUCCESS
```

Locked decomposition:

```text
5.4A1 — Version Preflight, Compatibility Matrix & Migration Registry Contract  COMPLETE
5.4A2 — Version-Aware Migration Execution & Current-Contract Handoff           NEXT / NOT STARTED
5.4A3 — Compatibility Regression & Completion Gate                             NOT STARTED
```

### 5.4A1 — Version Preflight, Compatibility Matrix & Migration Registry Contract

Status: **COMPLETE**

Completion record:

`docs/PHASE_5_4A1_VERSION_PREFLIGHT_MIGRATION_REGISTRY.md`

```text
Authoritative baseline     f773a2cd928a87c74e62a547b3043c04dcaef577
Baseline CI                35040392356 — SUCCESS
Initial feature head       105f733730f66e6a89ca3a08e25b3a0513afe879
Initial CI                 35041137241 — FAILURE (test helper literal type only)
Corrected feature head     104beacd503b33b57e0180c0c642017c6ddb07a8
Corrected branch CI        35041223493 — SUCCESS
Implementation PR #166     MERGED
PR CI                      35041313805 — SUCCESS
Implementation merge       142a3b4a38b915c7e3258e490ba2b32d96490bb5
Post-merge develop CI      35041385616 — SUCCESS
97 test files / 1186 tests
18 focused 5.4A1 tests
TypeScript typecheck passed
Production Vite build passed
130 modules transformed
```

Delivered:

- minimal `_Meta` identity/version preflight independent of current business-sheet validation;
- exact independent workbook-format and dataset-schema version-pair vocabulary;
- deterministic `invalid`, `current`, `migratable`, `unsupported-older`, and `unsupported-future` classification;
- pure `WorkbookMigrationStep` contract over neutral workbook documents;
- deterministic `WorkbookMigrationRegistry` path resolution;
- duplicate/ambiguous source rejection;
- self-loop and cycle rejection;
- no-downgrade semantics;
- defensive registered version-key ownership;
- deep defensive neutral-workbook cloning;
- empty production migration registry while v1/v1 remains the first public contract;
- no changes to current importer, hydration, coordinator, or public version constants.

The initial feature CI failure occurred before tests/build and was limited to TypeScript inference in a synthetic test helper. Explicitly widening those helper parameters to `number` resolved it without changing runtime behavior.

## Current persistence boundary

```text
BusinessDataset source contract       COMPLETE
Workbook schema contract              COMPLETE
Dataset integrity validator           COMPLETE
XLSX library / byte codec             COMPLETE
Dataset -> XLSX export                COMPLETE
XLSX -> dataset reconstruction        COMPLETE
Repository snapshot service           COMPLETE — 5.3A
Repository bulk replacement primitive COMPLETE — 5.3B1
Validated atomic hydration/rollback   COMPLETE — 5.3B2
Hydration session completion gate     COMPLETE — 5.3B3
Persistence coordinator lifecycle     COMPLETE — 5.3C
Workbook transport/lifecycle contract COMPLETE — 5.3C1
Export/save orchestration             COMPLETE — 5.3C2
Load/import/hydrate orchestration     COMPLETE — 5.3C3
Schema compatibility/migration plan   ESTABLISHED — 5.4A
Version preflight/registry contract   COMPLETE — 5.4A1
Migration execution/import handoff    NEXT / NOT STARTED — 5.4A2
Compatibility completion gate         NOT STARTED — 5.4A3
Detailed backup/atomic write          NOT STARTED — 5.4B
Native filesystem                     Phase 6
```

## Current active task

**5.4A2 — Version-Aware Migration Execution & Current-Contract Handoff — NEXT / NOT STARTED**

Do not begin 5.4A2 implementation until the 5.4A1 closeout PR is merged, the exact resulting `develop` CI is green, and the user separately says to proceed.
