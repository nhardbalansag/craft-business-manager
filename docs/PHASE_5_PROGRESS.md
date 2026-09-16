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
        5.4C1 — Resource Limit Policy & Guard Boundaries   COMPLETE
        5.4C2 — Corruption / Recovery Diagnostic Classification       NEXT / NOT STARTED
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
- Complete reconstructed candidates validate before live repository mutation.

### Snapshot / hydration / persistence lifecycle

- 5.3A owns complete deterministic snapshots over all nine source repositories.
- 5.3B owns validation-before-write, whole-dataset replacement, rollback, and stable repository/service identity.
- 5.3C owns the single application-level persistence lifecycle over workbook bytes.
- Expected import rejection never reaches hydration.
- Optional source-field absence is evidence and may not be synthesized as an own property with `undefined`.
- Hydration rollback remains distinct from save-side transport recovery.

### Compatibility / migration

- Workbook-format and dataset-schema versions remain separate exact axes.
- Public versions remain v1/v1; no fake predecessor is created solely to demonstrate migration.
- Missing `_Meta` is rejected; metadata-free legacy guessing is unsupported.
- Version preflight runs before strict current-schema validation.
- Migration steps operate on neutral workbook documents only.
- Future versions fail closed.
- Exact current workbooks remain subject to strict current workbook schema, metadata, reconstruction, and dataset validation.
- Production migration registry remains empty until a real historical predecessor exists.
- `PersistenceCoordinator` remains unaware of migration mechanics.

### Backup / safe-save transport

- `WorkbookTransport` remains byte-only.
- Backup policies are `none`, `if-supported`, and `required`.
- Required backup cannot proceed when unsupported or when creation fails.
- Backup evidence represents exact pre-save primary bytes.
- Replacement bytes are defensively owned and staged separately by the safe reference transport.
- Pre-commit failures preserve the previous primary workbook.
- Atomic replacement is an explicit transport guarantee and is never inferred by coordinator/UI.
- `InMemoryWorkbookTransport` remains direct/non-atomic.
- `SafeInMemoryWorkbookTransport` proves logical in-memory backup/stage/commit/cleanup only.
- Native durability, locking, rename atomicity, `fsync`, and crash consistency remain Phase 6.
- Post-commit cleanup failure reports committed state and is not represented as rollback.
- `PersistenceCoordinator` forwards save options/receipts and does not implement storage rollback.

### Corruption / resource limits / recovery — 5.4C

Plan:

`docs/PHASE_5_4C_CORRUPTION_LIMITS_RECOVERY_DIAGNOSTICS_PLAN.md`

Locked decomposition:

```text
5.4C1 — Resource Limit Policy & Guard Boundaries                  COMPLETE
5.4C2 — Corruption / Recovery Diagnostic Classification          NEXT / NOT STARTED
5.4C3 — Recovery Safety Regression & Phase 5.4 Completion Gate   NOT STARTED
```

C1 completion record:

`docs/PHASE_5_4C1_RESOURCE_LIMIT_POLICY_GUARD_BOUNDARIES.md`

Locked C1 resource policy:

```text
maxWorkbookBytes       20 MiB
maxWorksheetCount      32
maxColumnsPerSheet     64
maxRowsPerSheet        50,000 data rows
maxTotalRows           150,000 data rows
maxTotalCells          2,000,000 cell slots including header rows
```

C1 guard order:

```text
XLSX bytes
  -> pre-decode byte-size guard
  -> WorkbookCodec.decode
       -> SheetJS worksheet-count / declared-range guard
       -> neutral document expansion
  -> post-decode neutral-document resource guard
  -> compatibility / migration
  -> strict schema / reconstruction / dataset validation
  -> hydration
```

C1 decisions:

- Resource limits are a safety contract, not business validation.
- Byte limits run before codec decode.
- SheetJS checks worksheet count and declared ranges before neutral row/cell expansion.
- Decoded neutral documents are checked again so alternate codecs cannot bypass policy.
- Silent truncation is forbidden.
- Limit failures are structured `resource-limit` import rejections with actual/max/sheet context.
- Resource-limit rejection never reaches hydration.
- C1 does not claim complete ZIP-bomb/malware sandboxing.
- C2 owns stable recovery classification/guidance; C3 owns integrated recovery/state-preservation regression.
- Recovery UI remains 5.5C; native filesystem concerns remain Phase 6.

## Completion evidence index

Detailed history remains in dedicated phase records; this tracker keeps authoritative gates concise.

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
5.2A PR #140 — MERGED — final CI 35003583148
5.2B PR #143 — MERGED — final CI 35008520820
5.2C PR #146 — MERGED — final CI 35012885175
```

### Phase 5.3 — COMPLETE

```text
Parent closeout PR #164 — MERGED
Final develop  0624863f59929d645acd5f6539ab311afdfcb5bd
Final CI       35039111549 — SUCCESS
96 test files / 1168 tests at 5.3C gate
```

### Phase 5.4A — COMPLETE

```text
Planning PR #165 — MERGED
A1 PR #166 — MERGED — post-merge CI 35041385616
A2 PR #168 — MERGED — post-merge CI 35042566109
A3 PR #170 — MERGED — post-merge CI 35047100605
102 test files / 1214 tests at A3 gate
```

### Phase 5.4B — COMPLETE

```text
Planning PR #172 — MERGED
B1 PR #173 — MERGED — post-merge CI 35049144901
B2 PR #175 — MERGED — post-merge CI 35050167491
B3 PR #177 — MERGED — post-merge CI 35051019882
Parent closeout PR #178 — MERGED
Final develop  3cce1f03eda8e9266c40bee3dc8218e3c04bb786
Final CI       35051330092 — SUCCESS
105 test files / 1245 tests at B3 gate
132 modules transformed
```

### Phase 5.4C — IN PROGRESS

Planning:

```text
Planning baseline      3cce1f03eda8e9266c40bee3dc8218e3c04bb786
Planning baseline CI   35051330092 — SUCCESS
Planning PR #179       MERGED
Planning merge         a973792ef1c9fca7dbd7681b7aa6dff8ee068a1c
Planning merge CI      35052042769 — SUCCESS
```

#### 5.4C1 — COMPLETE

```text
Feature head           3978afe587ae268b4f03df1b5e1303b292f13c34
Branch CI              35052920663 — SUCCESS
Implementation PR #180 MERGED
PR CI                  35052995585 — SUCCESS
Implementation merge   a5e17553a0680bd4982ce22369360df9ef6b5e79
Post-merge CI          35053072059 — SUCCESS
109 test files / 1266 tests
21 focused C1 tests
133 modules transformed
```

## Current persistence boundary

```text
BusinessDataset source contract       COMPLETE
Workbook schema contract              COMPLETE
Dataset integrity validator           COMPLETE
XLSX library / codec                   COMPLETE
Dataset <-> XLSX round-trip            COMPLETE
Snapshot / hydration                   COMPLETE — 5.3
Persistence coordinator lifecycle     COMPLETE — 5.3C
Schema compatibility / migration      COMPLETE — 5.4A
Backup / atomic-write safety          COMPLETE — 5.4B
Resource-limit guards                 COMPLETE — 5.4C1
Recovery diagnostic classification   NEXT / NOT STARTED — 5.4C2
Recovery safety completion gate       NOT STARTED — 5.4C3
Native filesystem                     Phase 6
```

## Current active task

**5.4C2 — Corruption / Recovery Diagnostic Classification — NEXT / NOT STARTED**

Do not begin 5.4C2 until the 5.4C1 closeout PR is merged, the exact resulting `develop` CI is green, and the user separately says to proceed.
