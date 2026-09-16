# Phase 5 — Excel Persistence Progress

Status: **IN PROGRESS**

Master plan:

`docs/PHASE_5_EXCEL_PERSISTENCE_PLAN.md`

Current `develop` baseline used for 5.5A planning:

```text
develop  728b9b99b1da5192fd894f04c64d7ab3d1447d07
CI       35058157911 — SUCCESS
```

The current baseline also includes later Production and Products UX improvements. Those changes did not alter the Phase 5 persistence contracts.

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

5.4 — Version Compatibility, Backup & Recovery Safety     COMPLETE
    5.4A — Schema Migration & Compatibility Framework     COMPLETE
        5.4A1 — Version Preflight / Migration Registry    COMPLETE
        5.4A2 — Migration Execution / Import Handoff      COMPLETE
        5.4A3 — Compatibility Regression Gate             COMPLETE
    5.4B — Backup & Atomic-Write Transport Contract       COMPLETE
        5.4B1 — Capability / Policy / Transaction         COMPLETE
        5.4B2 — Backup + Staged-Commit Reference          COMPLETE
        5.4B3 — Failure Recovery / Completion Gate        COMPLETE
    5.4C — Corruption, Limits & Recovery Diagnostics      COMPLETE
        5.4C1 — Resource Limit Policy & Guard Boundaries                  COMPLETE
        5.4C2 — Corruption / Recovery Diagnostic Classification          COMPLETE
        5.4C3 — Recovery Safety Regression & Phase 5.4 Completion Gate   COMPLETE

5.5 — Excel Persistence UI                                IN PROGRESS
    5.5A — Import / Open Workbook Workflow                IN PROGRESS
        5.5A1 — Browser File Selection & Import Command Boundary  NEXT / NOT STARTED
        5.5A2 — React Open/Replace Workflow & Workspace Refresh   NOT STARTED
        5.5A3 — Browser Import Regression & 5.5A Completion Gate  NOT STARTED
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
- SheetJS remains hidden behind the library-neutral `WorkbookCodec`.
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

### Corruption / resource limits / recovery

- import is guarded before decode, during SheetJS range expansion, and after neutral-document reconstruction;
- resource limits, corruption, incompatible versions, workbook structure, invalid workbook values, invalid business data, and unexpected failures remain distinct diagnostic classes;
- raw importer issues remain authoritative and recovery summaries are derived/advisory;
- expected import rejection does not call hydration and leaves the prior authoritative source snapshot unchanged;
- user-facing rich recovery UX remains 5.5C.

### Browser import / open workflow — 5.5A

Plan:

`docs/PHASE_5_5A_IMPORT_OPEN_WORKBOOK_WORKFLOW_PLAN.md`

Locked decomposition:

```text
5.5A1 — Browser File Selection & Import Command Boundary  NEXT / NOT STARTED
5.5A2 — React Open/Replace Workflow & Workspace Refresh   NOT STARTED
5.5A3 — Browser Import Regression & 5.5A Completion Gate  NOT STARTED
```

Locked decisions:

- selecting a file is non-destructive;
- browser `File`/`ArrayBuffer` acquisition remains outside workbook/domain rules;
- selected bytes are defensively owned;
- `.xlsx` filename filtering is UX only and never replaces content validation;
- destructive import requires an explicit apply/confirmation step;
- actual import/application delegates to `PersistenceCoordinator.importAndApplyWorkbook(...)`;
- React does not construct workbook sheets or enumerate repositories;
- successful hydrate must trigger a deliberate workspace refresh/remount so already-mounted local UI state cannot remain stale;
- the shared singleton repository/service graph remains intact after import;
- rejected/failed import does not advance the successful workspace revision;
- basic controlled feedback belongs to 5.5A, while rich diagnostics/recovery presentation belongs to 5.5C;
- browser export/save belongs to 5.5B;
- native dialogs, paths, filesystem I/O, and durable replacement remain Phase 6.

## Completion evidence index

Detailed phase history remains in the dedicated completion records.

### Phase 5.1 — COMPLETE

- persisted source contract covers all nine authoritative repositories;
- canonical workbook v1 contract established;
- dataset integrity/reference/graph validation established.

### Phase 5.2 — COMPLETE

- SheetJS codec boundary established;
- deterministic dataset-to-XLSX export established;
- strict XLSX-to-dataset import established.

### Phase 5.3 — COMPLETE

```text
Parent closeout PR #164 — MERGED
Final develop  0624863f59929d645acd5f6539ab311afdfcb5bd
Final CI       35039111549 — SUCCESS
```

### Phase 5.4A — COMPLETE

```text
A1 PR #166 — post-merge CI 35041385616
A2 PR #168 — post-merge CI 35042566109
A3 PR #170 — post-merge CI 35047100605
```

### Phase 5.4B — COMPLETE

```text
B1 PR #173 — post-merge CI 35049144901
B2 PR #175 — post-merge CI 35050167491
B3 PR #177 — post-merge CI 35051019882
Parent closeout PR #178 — MERGED
Final CI       35051330092 — SUCCESS
```

### Phase 5.4C / Parent 5.4 — COMPLETE

```text
C1 PR #180 — post-merge CI 35053072059
C2 PR #182 — post-merge CI 35054369314
C3 PR #184 — post-merge CI 35055416159
Parent 5.4 closeout PR #185 — MERGED
Final Phase 5.4 develop  b8584d8681e95676c209c2e5a9dde0ee6278b71a
Final Phase 5.4 CI       35055715946 — SUCCESS
111 test files / 1302 tests at the 5.4 implementation safety gate
```

### Post-5.4 UI work already merged

These later changes are part of the current planning baseline and did not change persistence contracts:

```text
PR #186 — Production planning UI / estimate reliability — MERGED
PR #187 — Products catalog / workshop UX              — MERGED
Current develop  728b9b99b1da5192fd894f04c64d7ab3d1447d07
Current CI       35058157911 — SUCCESS
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
Corruption / resource / recovery      COMPLETE — 5.4C
Browser import/open planning          ESTABLISHED — 5.5A
Browser file/import command boundary  NEXT — 5.5A1
Browser export/save                    NOT STARTED — 5.5B
Recovery/status UX                     NOT STARTED — 5.5C
Native filesystem                     Phase 6
```

## Current active task

**5.5A1 — Browser File Selection & Import Command Boundary — NEXT / NOT STARTED**

Do not begin 5.5A1 until the 5.5A planning PR is merged, the exact resulting `develop` CI is green, and the user separately says to proceed.
