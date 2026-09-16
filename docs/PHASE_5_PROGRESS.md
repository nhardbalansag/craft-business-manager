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
    5.4A — Schema Migration & Compatibility Framework     COMPLETE
        5.4A1 — Version Preflight, Compatibility Matrix & Migration Registry Contract  COMPLETE
        5.4A2 — Version-Aware Migration Execution & Current-Contract Handoff           COMPLETE
        5.4A3 — Compatibility Regression & Completion Gate                             COMPLETE
    5.4B — Backup & Atomic-Write Transport Contract       NEXT / NOT STARTED
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
- 5.4A2 inserts compatibility/migration preparation after codec decode and before strict current reconstruction.
- Exact current workbooks remain subject to the existing strict current workbook schema, metadata, reconstruction, and dataset integrity checks.
- Every migration step receives an owned neutral-workbook clone; returned output must be structurally valid, preserve the expected format identity, and match the declared target version pair.
- Migration execution failures preserve source/target version context, step index, and original thrown causes where applicable.
- Synthetic migration targets/registries prove generic mechanics only; they do not become public supported formats.
- The production migration registry remains empty until a real older released contract exists.
- `PersistenceCoordinator` remains unaware of migration mechanics and consumes the same structured importer result shape.
- Compatibility/migration rejection remains an import rejection and must never reach hydration.
- 5.4B owns detailed backup creation, staged write, atomic replace/commit, cleanup, and recovery transport semantics.
- Native Tauri filesystem/dialog behavior remains Phase 6.

## Completion evidence index

Detailed evidence remains in dedicated phase records. This tracker keeps live progression and latest authoritative gates concise.

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

Final closeout:

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

Status: **COMPLETE**

Plan:

`docs/PHASE_5_4A_SCHEMA_MIGRATION_COMPATIBILITY_PLAN.md`

Parent completion record:

`docs/PHASE_5_4A_SCHEMA_MIGRATION_COMPATIBILITY.md`

Planning evidence:

```text
Planning baseline          0624863f59929d645acd5f6539ab311afdfcb5bd
Planning baseline CI       35039111549 — SUCCESS
Planning PR #165           MERGED
Planning merge             f773a2cd928a87c74e62a547b3043c04dcaef577
Planning post-merge CI     35040392356 — SUCCESS
```

Completed decomposition:

```text
5.4A1 — Version Preflight, Compatibility Matrix & Migration Registry Contract  COMPLETE
5.4A2 — Version-Aware Migration Execution & Current-Contract Handoff           COMPLETE
5.4A3 — Compatibility Regression & Completion Gate                             COMPLETE
```

### 5.4A1 — COMPLETE

Completion record:

`docs/PHASE_5_4A1_VERSION_PREFLIGHT_MIGRATION_REGISTRY.md`

```text
Corrected feature head     104beacd503b33b57e0180c0c642017c6ddb07a8
Corrected branch CI        35041223493 — SUCCESS
Implementation PR #166     MERGED
PR CI                      35041313805 — SUCCESS
Implementation merge       142a3b4a38b915c7e3258e490ba2b32d96490bb5
Post-merge develop CI      35041385616 — SUCCESS
97 test files / 1186 tests
18 focused 5.4A1 tests
130 modules transformed
```

A1 established minimal metadata preflight, deterministic compatibility classification, pure migration-step and registry contracts, cycle/no-downgrade protections, defensive neutral-workbook ownership, and an intentionally empty production registry at v1/v1.

### 5.4A2 — COMPLETE

Completion record:

`docs/PHASE_5_4A2_VERSION_AWARE_MIGRATION_EXECUTION.md`

```text
Authoritative baseline     049cc5cfe38090f87dbbe702b140915e8224b998
Baseline CI                35041734689 — SUCCESS
Corrected feature head     c7ed54af3b38f8f9dacee52384af39472dac5d8b
Corrected branch CI        35042353048 — SUCCESS
Implementation PR #168     MERGED
PR CI                      35042498871 — SUCCESS
Implementation merge       9dc28493b9d4b46214a11eb330416e83af236db0
Post-merge develop CI      35042566109 — SUCCESS
99 test files / 1203 tests
12 focused migration-preparation tests
5 focused importer compatibility/handoff tests
132 modules transformed
```

A2 delivered version-aware preparation/migration after codec decode, deterministic migration execution, defensive migration ownership, fail-closed migration diagnostics, and handoff to the unchanged strict current workbook/dataset contract.

### 5.4A3 — COMPLETE

Completion record:

`docs/PHASE_5_4A3_COMPATIBILITY_REGRESSION_COMPLETION_GATE.md`

```text
Authoritative baseline     c2816d5c0c293ba24f74f20c31edf2c61eb0f26f
Baseline CI                35042813430 — SUCCESS
Feature head               ca282c8c3317482bc02d74eb5ea4acc347941ab3
Branch CI                  35046943869 — SUCCESS
Implementation PR #170     MERGED
PR CI                      35047034132 — SUCCESS
Implementation merge       75473f92766a0b66d5955dec89869eaaf5712939
Post-merge develop CI      35047100605 — SUCCESS
102 test files / 1214 tests
11 focused new A3 tests
TypeScript typecheck passed
Production Vite build passed
132 modules transformed
```

A3 proved current v1/v1 preservation, fail-closed future/invalid metadata behavior, synthetic migration isolation, strict current workbook/dataset validation authority, direct/transport-backed current import, and zero-hydration compatibility/migration rejection. The A3 implementation changed tests only and introduced no production/runtime code changes.

Phase 5.4A closes with public v1/v1 unchanged and no production migration registrations until a real historical predecessor exists.

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
Schema compatibility/migration        COMPLETE — 5.4A
Version preflight/registry contract   COMPLETE — 5.4A1
Migration execution/import handoff    COMPLETE — 5.4A2
Compatibility completion gate         COMPLETE — 5.4A3
Detailed backup/atomic write          NEXT / NOT STARTED — 5.4B
Recovery/corruption limits            NOT STARTED — 5.4C
Native filesystem                     Phase 6
```

## Current active task

**5.4B — Backup & Atomic-Write Transport Contract — NEXT / NOT STARTED**

Do not begin 5.4B until the Phase 5.4A closeout PR is merged, the exact resulting `develop` CI is green, and the user separately says to proceed.
