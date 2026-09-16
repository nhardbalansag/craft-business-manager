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
    5.4B — Backup & Atomic-Write Transport Contract       COMPLETE
        5.4B1 — Safe-Save Capability, Policy & Transaction Contract                    COMPLETE
        5.4B2 — Backup + Staged-Commit In-Memory Reference Transport                   COMPLETE
        5.4B3 — Failure Recovery, Coordinator Regression & Completion Gate             COMPLETE
    5.4C — Corruption, Limits & Recovery Diagnostics      NEXT / NOT STARTED

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
- Phase 5.4A does not bump public v1/v1 merely to manufacture migration scenarios.
- v1/v1 is the first formal persisted contract unless repository evidence proves a real released predecessor.
- Missing `_Meta` is rejected; metadata-free legacy auto-detection is unsupported.
- Version preflight occurs before strict current-schema validation for compatibility routing.
- Migration steps operate only on neutral workbook documents and cannot touch repositories, hydration, React, transport, or native filesystem APIs.
- Migration paths are explicit exact-version registrations, deterministic, no-downgrade, and cycle-safe.
- Any future workbook or dataset version axis fails closed.
- Exact current workbooks remain subject to strict current workbook schema, metadata, reconstruction, and dataset-integrity checks.
- Synthetic migration targets prove generic mechanics only and do not become supported production formats.
- The production migration registry remains empty until a real older released contract exists.
- `PersistenceCoordinator` remains unaware of migration mechanics and consumes the same structured importer result shape.
- Compatibility/migration rejection remains an import rejection and must never reach hydration.
- 5.4B owns detailed backup creation, staged write, logical replace/commit, cleanup, and transport-level recovery semantics.
- `WorkbookTransport` remains byte-only and has no dataset, workbook-schema, repository, hydration, React, or native-filesystem knowledge.
- Backup policies are distinct: `none`, `if-supported`, and `required`.
- Required backup cannot proceed to replacement when unsupported or when backup creation fails.
- Backup evidence represents exact pre-save primary workbook bytes.
- No-existing-primary is not a backup failure and creates no fake backup bytes.
- Replacement bytes are defensively owned and staged separately before commit in the safe reference transport.
- Failures before commit preserve the previous primary workbook.
- Atomic replacement is an explicit transport guarantee, never an assumption inferred by coordinator or UI.
- Browser/direct transports may truthfully remain non-atomic.
- The safe in-memory transport proves logical ordering and reference-swap commit only; filesystem durability, rename atomicity, `fsync`, locking, and crash consistency remain Phase 6 concerns.
- A post-commit cleanup problem is distinct from a pre-commit failure and may not be represented as rollback.
- `WorkbookTransportSaveError` preserves stage, code, commit state, and original cause.
- `InMemoryWorkbookTransport` remains `backup: unsupported`, `stagedReplacement: false`, `direct-non-atomic`.
- `SafeInMemoryWorkbookTransport` remains `backup: supported`, `stagedReplacement: true`, `atomic` with logical in-memory semantics only.
- Safe-save fault injection for `read-existing`, `backup`, `stage`, `commit`, and `cleanup` exists only for deterministic reference/regression testing.
- B3 proves read/backup/stage/commit/cleanup recovery semantics without changing production runtime code.
- Pre-commit cleanup failure retains the previous primary and reports `not-committed` while preserving nested operation + cleanup causes.
- Post-commit cleanup failure reports `committed`; the new primary remains authoritative even if staging cleanup failed.
- `PersistenceCoordinator` forwards safe-save options and receipts, wraps transport failure as `TRANSPORT_SAVE_FAILED`, and does not implement backup/stage/commit/rollback itself.
- Coordinator orchestration never upgrades non-atomic transport guarantees and never re-exports to simulate storage rollback.
- Hydration rollback remains owned by 5.3B and is not mixed with save-side transport recovery.
- 5.4C remains the owner of workbook corruption, resource-limit, and recovery diagnostics.
- Native Tauri filesystem/dialog behavior remains Phase 6.

## Completion evidence index

Detailed evidence remains in dedicated phase records. This tracker preserves live progression and authoritative gates.

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

```text
Closeout PR #164           MERGED
Final develop              0624863f59929d645acd5f6539ab311afdfcb5bd
Final CI                   35039111549 — SUCCESS
96 test files / 1168 tests at 5.3C implementation gate
130 modules transformed
```

### Phase 5.4A — COMPLETE

Plan:

`docs/PHASE_5_4A_SCHEMA_MIGRATION_COMPATIBILITY_PLAN.md`

Parent completion record:

`docs/PHASE_5_4A_SCHEMA_MIGRATION_COMPATIBILITY.md`

```text
Planning PR #165           MERGED
Planning merge             f773a2cd928a87c74e62a547b3043c04dcaef577
Planning post-merge CI     35040392356 — SUCCESS
A1 implementation PR #166  MERGED
A1 post-merge CI           35041385616 — SUCCESS
A2 implementation PR #168  MERGED
A2 post-merge CI           35042566109 — SUCCESS
A3 implementation PR #170  MERGED
A3 post-merge CI           35047100605 — SUCCESS
102 test files / 1214 tests at A3 gate
132 modules transformed
```

5.4A closes with public v1/v1 unchanged and no production migration registrations until a real predecessor exists.

### Phase 5.4B — COMPLETE

Plan:

`docs/PHASE_5_4B_BACKUP_ATOMIC_WRITE_TRANSPORT_PLAN.md`

Parent completion record:

`docs/PHASE_5_4B_BACKUP_ATOMIC_WRITE_TRANSPORT.md`

Planning evidence:

```text
Planning baseline          e35b6f04c65dbedcd0ffe7ebbe836a22e1f59065
Planning baseline CI       35047386809 — SUCCESS
Planning PR #172           MERGED
Planning merge             55c06e9309f48345635bd5f5a543762a3ca8ce84
Planning post-merge CI     35048445692 — SUCCESS
```

#### 5.4B1 — COMPLETE

Completion record:

`docs/PHASE_5_4B1_SAFE_SAVE_CAPABILITY_TRANSACTION_CONTRACT.md`

```text
Implementation PR #173     MERGED
Implementation merge       2ec2a75c43bef03690f0de7014d4171ba7a36ea0
Post-merge CI              35049144901 — SUCCESS
102 test files / 1219 tests
13 focused transport tests
```

#### 5.4B2 — COMPLETE

Completion record:

`docs/PHASE_5_4B2_BACKUP_STAGED_COMMIT_IN_MEMORY_REFERENCE_TRANSPORT.md`

```text
Feature head               89b5f1bc49d00cfbe14bc26dc224381a019ff6a8
Branch CI                  35050007808 — SUCCESS
Implementation PR #175     MERGED
PR CI                      35050081527 — SUCCESS
Implementation merge       163fa33b6dab018b938f37071920e85cf5137d72
Post-merge CI              35050167491 — SUCCESS
103 test files / 1232 tests
13 focused B2 tests
```

#### 5.4B3 — COMPLETE

Completion record:

`docs/PHASE_5_4B3_SAFE_SAVE_RECOVERY_COMPLETION_GATE.md`

```text
Authoritative baseline     d47038ffbe3182a465233bb7d9cb5eabb25d3a31
Baseline CI                35050455351 — SUCCESS
Feature head               61a9e4360cd53de0ee965123bdd60891714b79d7
Branch CI                  35050876845 — SUCCESS
Implementation PR #177     MERGED
PR CI                      35050944517 — SUCCESS
Implementation merge       8100baf43351db501878286127ec1c21a87dee57
Post-merge CI              35051019882 — SUCCESS
105 test files / 1245 tests
13 focused B3 tests
TypeScript typecheck passed
Production Vite build passed
132 modules transformed
```

5.4B now has explicit capability/policy contracts, deterministic backup/staging reference behavior, complete failure-recovery semantics, and coordinator regression coverage without claiming native filesystem guarantees.

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
Backup/atomic-write planning          COMPLETE — 5.4B
Safe-save transport contract          COMPLETE — 5.4B1
Reference safe-save transport         COMPLETE — 5.4B2
Safe-save recovery completion gate    COMPLETE — 5.4B3
Recovery/corruption limits            NEXT / NOT STARTED — 5.4C
Native filesystem                     Phase 6
```

## Current active task

**5.4C — Corruption, Limits & Recovery Diagnostics — NEXT / NOT STARTED**

Do not begin 5.4C until the Phase 5.4B parent closeout PR is merged, the exact resulting `develop` CI is green, and the user separately says to proceed.
