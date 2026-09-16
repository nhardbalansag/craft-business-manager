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
        5.4A1 — Version Preflight / Migration Registry    COMPLETE
        5.4A2 — Migration Execution / Import Handoff      COMPLETE
        5.4A3 — Compatibility Regression Gate             COMPLETE
    5.4B — Backup & Atomic-Write Transport Contract       COMPLETE
        5.4B1 — Capability / Policy / Transaction         COMPLETE
        5.4B2 — Backup + Staged-Commit Reference          COMPLETE
        5.4B3 — Failure Recovery / Completion Gate        COMPLETE
    5.4C — Corruption, Limits & Recovery Diagnostics      IN PROGRESS
        5.4C1 — Resource Limit Policy & Guard Boundaries   NEXT / NOT STARTED
        5.4C2 — Corruption / Recovery Diagnostic Classification       NOT STARTED
        5.4C3 — Recovery Safety Regression & Phase 5.4 Completion Gate NOT STARTED

5.5 — Excel Persistence UI                                NOT STARTED
    5.5A — Import / Open Workbook Workflow                NOT STARTED
    5.5B — Export / Save & Backup Workflow                NOT STARTED
    5.5C — Persistence Status / Validation / Recovery UX  NOT STARTED

5.6 — Integration & Completion Gate                       NOT STARTED
    5.6A — Integrated Excel Round-Trip Workflow           NOT STARTED
    5.6B — Regression / Build / Phase 5 Completion        NOT STARTED
```

## Locked Phase 5 decisions

### Dataset / workbook foundation

- `.xlsx` is the authoritative Phase 5 workbook format.
- Persist authoritative source evidence only; derived outputs are recalculated after restore.
- `BusinessDataset` covers all nine authoritative source repositories.
- Dataset schema version and workbook format version remain separate.
- Workbook v1 has 13 normalized canonical sheets.
- Missing evidence remains distinct from explicit zero/null/false.
- Formula cells are not authoritative source values; formula-looking text remains literal.
- SheetJS CE 0.20.3 remains hidden behind the library-neutral `WorkbookCodec`.
- Complete reconstructed candidates validate before any live repository mutation.

### Snapshot / hydration / coordinator

- 5.3A owns complete deterministic snapshots over all nine source repositories.
- 5.3B owns validation-before-write, whole-dataset replacement, rollback, and preserved repository/service identity.
- 5.3C owns one application-level persistence lifecycle over workbook bytes; it does not create a second dataset-level persistence path.
- Optional source-field absence is source evidence and may not be synthesized as an own property with `undefined`.
- Rollback failure remains a distinct severe diagnostic and may never be reported as successful hydration.

### Compatibility / migration

- Workbook-format and dataset-schema versions are separate exact axes.
- Public versions remain v1/v1; no fake predecessor is created merely to demonstrate migration.
- Missing `_Meta` is rejected; metadata-free legacy auto-detection is unsupported.
- Version preflight runs before strict current-schema validation for compatibility routing.
- Migration steps operate on neutral workbook documents only and cannot touch repositories, hydration, React, transport, or native filesystem APIs.
- Migration paths are explicit, deterministic, no-downgrade, and cycle-safe.
- Future workbook/dataset versions fail closed.
- Exact current workbooks still pass through strict current workbook schema, metadata, reconstruction, and dataset-integrity checks.
- Synthetic migration fixtures prove mechanics only and do not become supported formats.
- The production migration registry remains empty until a real historical predecessor exists.
- `PersistenceCoordinator` remains unaware of migration mechanics.
- Compatibility/migration rejection remains an import rejection and never reaches hydration.

### Backup / safe-save transport

- `WorkbookTransport` remains byte-only.
- Backup policies are `none`, `if-supported`, and `required`.
- Required backup cannot proceed when unsupported or when backup creation fails.
- Backup evidence is the exact pre-save primary workbook.
- No-existing-primary is not a backup failure and creates no fake backup.
- Replacement bytes are defensively owned and staged separately before commit in the safe reference transport.
- Pre-commit failure preserves the previous primary workbook.
- Atomic replacement is an explicit transport guarantee, never an assumption inferred by coordinator/UI.
- Browser/direct transports may truthfully remain non-atomic.
- `InMemoryWorkbookTransport` remains direct/non-atomic with backup unsupported.
- `SafeInMemoryWorkbookTransport` remains backup-supported, staged, and logically atomic in memory only.
- Native durability, rename atomicity, `fsync`, locking, and crash consistency remain Phase 6.
- Post-commit cleanup failure reports committed state and does not pretend rollback occurred.
- `PersistenceCoordinator` forwards save options/receipts and wraps failures as `TRANSPORT_SAVE_FAILED`; it does not implement storage rollback.
- Hydration rollback remains owned by 5.3B.

### Corruption / resource limits / recovery — 5.4C

Plan:

`docs/PHASE_5_4C_CORRUPTION_LIMITS_RECOVERY_DIAGNOSTICS_PLAN.md`

Locked decomposition:

```text
5.4C1 — Resource Limit Policy & Guard Boundaries
5.4C2 — Corruption / Recovery Diagnostic Classification
5.4C3 — Recovery Safety Regression & Phase 5.4 Completion Gate
```

Locked decisions:

- Existing schema/compatibility/reconstruction/dataset validators remain authoritative; 5.4C does not duplicate them.
- Resource limits are a separate safety contract, not business validation.
- Workbook byte limits must be checked before codec decode.
- SheetJS should reject extreme declared worksheet ranges before large neutral row/cell expansion where feasible.
- Neutral-document limits are checked again after decode so alternate codecs cannot bypass the application policy.
- Silent row truncation is forbidden for authoritative import.
- Resource-limit failures are expected structured import rejections.
- Corrupt/unreadable XLSX remains distinguishable from resource-limit, version, schema, reconstruction, and dataset failures.
- Recovery classification summarizes raw diagnostics but never replaces or mutates them.
- Recovery actions are machine-readable guidance only; no UI or filesystem action occurs in 5.4C.
- Backup-restore guidance is advisory only; backup selection/loading remains 5.5/Phase 6 work.
- Expected import rejection must not reach hydration or mutate live source state.
- 5.4C3 closes parent 5.4 only after full regression/typecheck/build gates are green.
- Native filesystem/dialog work remains Phase 6; user-facing recovery UX remains 5.5C.

## Completion evidence index

Detailed historical evidence remains in the dedicated phase records. This tracker keeps the authoritative progression concise.

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

Records:

- `docs/PHASE_5_3A_COMPLETE_SOURCE_SNAPSHOT_SERVICE.md`
- `docs/PHASE_5_3B_VALIDATED_ATOMIC_DATASET_HYDRATION.md`
- `docs/PHASE_5_3C_PERSISTENCE_COORDINATOR_LOAD_SAVE_LIFECYCLE.md`

```text
Closeout PR #164   MERGED
Final develop      0624863f59929d645acd5f6539ab311afdfcb5bd
Final CI           35039111549 — SUCCESS
96 test files / 1168 tests at 5.3C gate
```

### Phase 5.4A — COMPLETE

Plan: `docs/PHASE_5_4A_SCHEMA_MIGRATION_COMPATIBILITY_PLAN.md`

Parent record: `docs/PHASE_5_4A_SCHEMA_MIGRATION_COMPATIBILITY.md`

```text
Planning PR #165   MERGED
A1 PR #166         MERGED — post-merge CI 35041385616
A2 PR #168         MERGED — post-merge CI 35042566109
A3 PR #170         MERGED — post-merge CI 35047100605
102 test files / 1214 tests at A3 gate
```

### Phase 5.4B — COMPLETE

Plan: `docs/PHASE_5_4B_BACKUP_ATOMIC_WRITE_TRANSPORT_PLAN.md`

Parent record: `docs/PHASE_5_4B_BACKUP_ATOMIC_WRITE_TRANSPORT.md`

```text
Planning PR #172       MERGED
B1 PR #173             MERGED — post-merge CI 35049144901
B2 PR #175             MERGED — post-merge CI 35050167491
B3 PR #177             MERGED — post-merge CI 35051019882
Parent closeout PR #178 MERGED
Final develop          3cce1f03eda8e9266c40bee3dc8218e3c04bb786
Final CI               35051330092 — SUCCESS
105 test files / 1245 tests at B3 gate
132 modules transformed
```

### Phase 5.4C — PLANNING ESTABLISHED

Planning baseline:

```text
develop  3cce1f03eda8e9266c40bee3dc8218e3c04bb786
CI       35051330092 — SUCCESS
```

Dedicated plan:

`docs/PHASE_5_4C_CORRUPTION_LIMITS_RECOVERY_DIAGNOSTICS_PLAN.md`

Implementation has **not** started.

## Current persistence boundary

```text
BusinessDataset source contract       COMPLETE
Workbook schema contract              COMPLETE
Dataset integrity validator           COMPLETE
XLSX library / byte codec             COMPLETE
Dataset -> XLSX export                COMPLETE
XLSX -> dataset reconstruction        COMPLETE
Repository snapshot/hydration         COMPLETE — 5.3
Persistence coordinator lifecycle     COMPLETE — 5.3C
Schema compatibility/migration        COMPLETE — 5.4A
Backup/atomic-write safety             COMPLETE — 5.4B
Resource-limit guards                  NEXT / NOT STARTED — 5.4C1
Recovery diagnostic classification    NOT STARTED — 5.4C2
Recovery safety completion gate        NOT STARTED — 5.4C3
Native filesystem                      Phase 6
```

## Current active task

**5.4C1 — Resource Limit Policy & Guard Boundaries — NEXT / NOT STARTED**

Do not begin 5.4C1 until the Phase 5.4C planning PR is merged, the exact resulting `develop` CI is green, and the user separately says to proceed.
